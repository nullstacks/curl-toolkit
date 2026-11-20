import {
  DEFAULT_TIMEOUT_MS,
  emptyRequest,
  kv,
  type AuthConfig,
  type BodyType,
  type KV,
  type MultipartField,
  type RequestModel,
} from '../../types';
import { base64DecodeUtf8 } from '../utils';
import { isBrowserRestricted } from '../http/prepare';

export interface UnsupportedOption {
  option: string;
  reason: string;
}

export interface ParseResult {
  request: RequestModel | null;
  errors: string[];
  warnings: string[];
  unsupported: UnsupportedOption[];
}

/** Splits a shell command into arguments: handles quotes, escapes and line continuations. */
export function tokenize(input: string): { tokens: string[]; error?: string } {
  const src = input.replace(/\\\r?\n/g, ' ');
  const tokens: string[] = [];
  let cur = '';
  let has = false;
  let i = 0;

  while (i < src.length) {
    const c = src[i] as string;

    if (/\s/.test(c)) {
      if (has) {
        tokens.push(cur);
        cur = '';
        has = false;
      }
      i++;
      continue;
    }

    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end === -1) return { tokens, error: 'Unclosed single quote in the command.' };
      cur += src.slice(i + 1, end);
      has = true;
      i = end + 1;
      continue;
    }

    if (c === '"') {
      i++;
      let closed = false;
      while (i < src.length) {
        const d = src[i] as string;
        const next = src[i + 1];
        if (d === '\\' && next !== undefined && '"\\$`\n'.includes(next)) {
          cur += next;
          i += 2;
          continue;
        }
        if (d === '"') {
          closed = true;
          i++;
          break;
        }
        cur += d;
        i++;
      }
      if (!closed) return { tokens, error: 'Unclosed double quote in the command.' };
      has = true;
      continue;
    }

    if (c === '\\' && i + 1 < src.length) {
      cur += src[i + 1];
      has = true;
      i += 2;
      continue;
    }

    cur += c;
    has = true;
    i++;
  }

  if (has) tokens.push(cur);
  return { tokens };
}

const SHORT_WITH_ARG: Record<string, string> = {
  X: '--request',
  H: '--header',
  d: '--data',
  F: '--form',
  u: '--user',
  A: '--user-agent',
  e: '--referer',
  b: '--cookie',
  m: '--max-time',
  o: '--output',
  w: '--write-out',
  c: '--cookie-jar',
  x: '--proxy',
  E: '--cert',
  r: '--range',
  T: '--upload-file',
  K: '--config',
  z: '--time-cond',
  C: '--continue-at',
  Y: '--speed-limit',
  y: '--speed-time',
};

const SHORT_FLAG: Record<string, string> = {
  k: '--insecure',
  G: '--get',
  I: '--head',
  L: '--location',
  s: '--silent',
  S: '--show-error',
  v: '--verbose',
  i: '--include',
  f: '--fail',
  g: '--globoff',
  N: '--no-buffer',
  j: '--junk-session-cookies',
};

const LONG_WITH_ARG = new Set([
  '--request', '--header', '--data', '--data-raw', '--data-binary', '--data-ascii',
  '--data-urlencode', '--form', '--form-string', '--user', '--user-agent', '--referer',
  '--cookie', '--cookie-jar', '--max-time', '--connect-timeout', '--output', '--write-out',
  '--proxy', '--proxy-user', '--cert', '--key', '--cacert', '--resolve', '--connect-to',
  '--interface', '--local-port', '--url', '--json', '--oauth2-bearer', '--retry',
  '--retry-delay', '--retry-max-time', '--max-redirs', '--limit-rate', '--header-file',
  '--dns-servers', '--ciphers', '--upload-file', '--range', '--time-cond', '--config',
  '--max-filesize', '--continue-at', '--keepalive-time', '--expect100-timeout',
]);

/** Options with no browser equivalent. Each entry explains why. */
const UNSUPPORTED_REASON: Record<string, string> = {
  '--insecure': 'Browsers never allow disabling TLS certificate verification.',
  '--proxy': 'Proxies are set by the browser or operating system, not by the page.',
  '--proxy-user': 'Proxies are set by the browser or operating system, not by the page.',
  '--cert': 'Client certificates must be installed in the browser; a page cannot attach them.',
  '--key': 'Client certificates must be installed in the browser; a page cannot attach them.',
  '--cacert': 'Custom certificate authorities cannot be supplied to the browser.',
  '--resolve': 'DNS overrides are not possible from the browser.',
  '--connect-to': 'DNS and connection overrides are not possible from the browser.',
  '--interface': 'Network interfaces cannot be chosen from the browser.',
  '--local-port': 'Local ports cannot be chosen from the browser.',
  '--dns-servers': 'DNS resolver selection is not possible from the browser.',
  '--ciphers': 'TLS cipher selection is controlled by the browser.',
  '--cookie-jar': 'Writing cookies to a file is not possible in the browser.',
  '--write-out': 'Custom write-out formats are not supported.',
  '--range': 'Partial ranges are not supported; add a Range header instead.',
  '--upload-file': 'Reading files from disk is not possible in the browser.',
  '--config': 'Reading curl config files is not possible in the browser.',
  '--limit-rate': 'Bandwidth limiting is not supported.',
  '--retry': 'Automatic retries are not supported.',
  '--retry-delay': 'Automatic retries are not supported.',
  '--retry-max-time': 'Automatic retries are not supported.',
  '--header-file': 'Reading headers from a file is not possible in the browser.',
  '--max-filesize': 'Response size limits are not supported.',
  '--continue-at': 'Resuming transfers is not supported.',
  '--time-cond': 'Conditional requests need explicit If-Modified-Since headers.',
  '--keepalive-time': 'Connection reuse is managed by the browser.',
  '--expect100-timeout': 'Expect: 100-continue is managed by the browser.',
  '--speed-limit': 'Bandwidth limiting is not supported.',
  '--speed-time': 'Bandwidth limiting is not supported.',
};

/** Options that are accepted but have no effect in the browser. */
const NOOP_NOTE: Record<string, string> = {
  '--silent': '',
  '--show-error': '',
  '--fail': '',
  '--globoff': '',
  '--no-buffer': '',
  '--junk-session-cookies': '',
  '--verbose': 'Details appear in the Response Inspector instead.',
  '--include': 'Response headers are always displayed.',
  '--compressed': 'The browser negotiates compression automatically.',
  '--output': 'Use Download in the Response Inspector instead.',
  '--connect-timeout': 'Only the overall timeout applies.',
  '--max-redirs': 'Redirect limits are set by the browser.',
};

interface ParseState {
  method?: string;
  url?: string;
  headers: Array<[string, string]>;
  dataParts: string[];
  forms: Array<{ name: string; value: string; fileName?: string }>;
  get: boolean;
  head: boolean;
  location: boolean;
  json: boolean;
  user?: string;
  bearer?: string;
  cookieStrings: string[];
  cookieFile: boolean;
  timeoutMs?: number;
}

function encodeUrlencoded(value: string, warnings: string[]): string {
  if (value.startsWith('=')) return encodeURIComponent(value.slice(1));
  const eq = value.indexOf('=');
  if (eq > 0) {
    return `${encodeURIComponent(value.slice(0, eq))}=${encodeURIComponent(value.slice(eq + 1))}`;
  }
  if (value.startsWith('@')) {
    warnings.push(`Data file ${value.slice(1)} cannot be read in the browser; its name is kept as text.`);
  }
  return encodeURIComponent(value);
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Parses a cURL command into an editable request. Never throws; problems are returned as data. */
export function parseCurl(input: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unsupported: UnsupportedOption[] = [];
  const seen = new Set<string>();
  const unsupport = (option: string, reason: string) => {
    if (seen.has(option)) return;
    seen.add(option);
    unsupported.push({ option, reason });
  };

  const trimmed = input.trim();
  if (!trimmed) {
    return { request: null, errors: ['Paste a cURL command to convert.'], warnings, unsupported };
  }

  const lexed = tokenize(trimmed);
  if (lexed.error) return { request: null, errors: [lexed.error], warnings, unsupported };

  let tokens = lexed.tokens;
  const first = tokens[0];
  if (first !== undefined && /(^|[\\/])curl(\.exe)?$/i.test(first)) tokens = tokens.slice(1);
  if (tokens.length === 0) {
    return { request: null, errors: ['No curl options found after "curl".'], warnings, unsupported };
  }

  const st: ParseState = {
    headers: [],
    dataParts: [],
    forms: [],
    get: false,
    head: false,
    location: false,
    json: false,
    cookieStrings: [],
    cookieFile: false,
  };

  const addHeader = (raw: string) => {
    const idx = raw.indexOf(':');
    if (idx === -1) {
      // curl's "Name;" form sends an empty header; it is safe to skip.
      if (!raw.trim().endsWith(';')) warnings.push(`Malformed header ignored: ${raw}`);
      return;
    }
    const name = raw.slice(0, idx).trim();
    if (name) st.headers.push([name, raw.slice(idx + 1).trim()]);
  };

  const handle = (name: string, value: string | undefined) => {
    if (name in NOOP_NOTE) {
      const note = NOOP_NOTE[name];
      if (note) warnings.push(`${name}: ${note}`);
      return;
    }
    switch (name) {
      case '--request':
        st.method = (value ?? '').toUpperCase();
        return;
      case '--header':
        addHeader(value ?? '');
        return;
      case '--user-agent':
        st.headers.push(['User-Agent', value ?? '']);
        return;
      case '--referer':
        st.headers.push(['Referer', value ?? '']);
        return;
      case '--user':
        st.user = value ?? '';
        return;
      case '--oauth2-bearer':
        st.bearer = value ?? '';
        return;
      case '--cookie': {
        const v = value ?? '';
        if (v.includes('=')) st.cookieStrings.push(v);
        else st.cookieFile = true;
        return;
      }
      case '--data':
      case '--data-ascii':
      case '--data-binary':
      case '--data-raw': {
        const v = value ?? '';
        if (name !== '--data-raw' && v.startsWith('@')) {
          warnings.push(`Data file ${v.slice(1)} cannot be read in the browser; its name is kept as text.`);
        }
        st.dataParts.push(v);
        return;
      }
      case '--data-urlencode':
        st.dataParts.push(encodeUrlencoded(value ?? '', warnings));
        return;
      case '--json':
        st.json = true;
        st.dataParts.push(value ?? '');
        return;
      case '--form':
      case '--form-string': {
        const v = value ?? '';
        const eq = v.indexOf('=');
        if (eq <= 0) {
          warnings.push(`Invalid form field ignored: ${v}`);
          return;
        }
        const fieldName = v.slice(0, eq);
        const raw = v.slice(eq + 1);
        if (name === '--form' && (raw.startsWith('@') || raw.startsWith('<'))) {
          const path = raw.slice(1).split(';')[0] ?? '';
          const fileName = path.split(/[\\/]/).pop() ?? path;
          st.forms.push({ name: fieldName, value: '', fileName });
          warnings.push(`File field "${fieldName}" must be selected again in the Body tab.`);
        } else {
          st.forms.push({
            name: fieldName,
            value: name === '--form' ? raw.replace(/;type=[^;]*$/, '') : raw,
          });
        }
        return;
      }
      case '--get':
        st.get = true;
        return;
      case '--head':
        st.head = true;
        return;
      case '--location':
        st.location = true;
        return;
      case '--max-time': {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) warnings.push(`Invalid max time ignored: ${value ?? ''}`);
        else st.timeoutMs = n * 1000;
        return;
      }
      case '--url':
        if (st.url === undefined) st.url = value;
        else warnings.push('Multiple URLs found; only the first is used.');
        return;
      default:
        break;
    }
    if (UNSUPPORTED_REASON[name]) {
      unsupport(name, UNSUPPORTED_REASON[name]);
      return;
    }
    unsupport(name, 'Unknown or unsupported option. It was ignored.');
  };

  scan: for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as string;

    if (t.startsWith('--') && t.length > 2) {
      const eq = t.indexOf('=');
      const name = eq === -1 ? t : t.slice(0, eq);
      let value: string | undefined = eq === -1 ? undefined : t.slice(eq + 1);
      if (value === undefined && LONG_WITH_ARG.has(name)) {
        value = tokens[++i];
        if (value === undefined) {
          errors.push(`Option ${name} needs a value.`);
          break scan;
        }
      }
      handle(name, value);
    } else if (t.startsWith('-') && t.length > 1) {
      for (let j = 1; j < t.length; j++) {
        const ch = t[j] as string;
        const withArg = SHORT_WITH_ARG[ch];
        if (withArg) {
          let value: string | undefined = t.slice(j + 1);
          if (value === '') value = tokens[++i];
          if (value === undefined) {
            errors.push(`Option -${ch} needs a value.`);
            break scan;
          }
          handle(withArg, value);
          break;
        }
        handle(SHORT_FLAG[ch] ?? `-${ch}`, undefined);
      }
    } else if (st.url === undefined) {
      st.url = t;
    } else {
      warnings.push(`Extra argument ignored: ${t}`);
    }
  }

  if (errors.length > 0) return { request: null, errors, warnings, unsupported };

  if (st.cookieFile) {
    warnings.push('Cookie files cannot be read in the browser; -b file arguments were ignored.');
  }

  if (!st.url || st.url.trim() === '') {
    return {
      request: null,
      errors: ['No URL found. Add one such as https://api.example.com/users.'],
      warnings,
      unsupported,
    };
  }

  let rawUrl = st.url.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) {
    warnings.push('No scheme given; assuming http:// as curl does.');
    rawUrl = `http://${rawUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { request: null, errors: [`Invalid URL: ${rawUrl}`], warnings, unsupported };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      request: null,
      errors: [`Unsupported protocol: ${parsed.protocol}`],
      warnings,
      unsupported,
    };
  }
  if (parsed.hash) warnings.push('URL fragments are never sent to servers and were removed.');

  const params: KV[] = [];
  parsed.searchParams.forEach((v, k) => params.push(kv(k, v)));

  let auth: AuthConfig = emptyRequest().auth;
  if (parsed.username) {
    auth = {
      ...auth,
      type: 'basic',
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  }
  if (st.user !== undefined) {
    const idx = st.user.indexOf(':');
    auth = {
      ...auth,
      type: 'basic',
      username: idx === -1 ? st.user : st.user.slice(0, idx),
      password: idx === -1 ? '' : st.user.slice(idx + 1),
    };
    if (idx === -1) {
      warnings.push('-u without a password would prompt for one; enter the password in the Auth tab.');
    }
  }
  if (st.bearer !== undefined) auth = { ...auth, type: 'bearer', token: st.bearer };

  const headers = st.headers;
  const authIdx = headers.findIndex(([n]) => n.toLowerCase() === 'authorization');
  if (authIdx !== -1 && auth.type === 'none') {
    const value = headers[authIdx]?.[1] ?? '';
    if (/^bearer\s+/i.test(value)) {
      auth = { ...auth, type: 'bearer', token: value.replace(/^bearer\s+/i, '') };
      headers.splice(authIdx, 1);
    } else if (/^basic\s+/i.test(value)) {
      try {
        const decoded = base64DecodeUtf8(value.replace(/^basic\s+/i, ''));
        const idx = decoded.indexOf(':');
        auth = {
          ...auth,
          type: 'basic',
          username: idx === -1 ? decoded : decoded.slice(0, idx),
          password: idx === -1 ? '' : decoded.slice(idx + 1),
        };
        headers.splice(authIdx, 1);
      } catch {
        warnings.push('Basic credentials could not be decoded; the header was kept as written.');
      }
    }
  }

  const cookies: KV[] = [];
  const cookieIdx = headers.findIndex(([n]) => n.toLowerCase() === 'cookie');
  if (cookieIdx !== -1) {
    st.cookieStrings.push(headers[cookieIdx]?.[1] ?? '');
    headers.splice(cookieIdx, 1);
  }
  for (const s of st.cookieStrings) {
    for (const part of s.split(';')) {
      const p = part.trim();
      const eq = p.indexOf('=');
      if (eq > 0) cookies.push(kv(p.slice(0, eq).trim(), p.slice(eq + 1).trim()));
    }
  }

  const hasHeader = (name: string) => headers.some(([h]) => h.toLowerCase() === name);
  const joined = st.dataParts.join('&');
  let hasData = st.dataParts.length > 0;
  if (st.get && hasData) {
    new URLSearchParams(joined).forEach((v, k) => params.push(kv(k, v)));
    hasData = false;
  }

  let bodyType: BodyType = 'none';
  let body = '';
  let formFields: KV[] = [];
  let multipart: MultipartField[] = [];

  if (st.forms.length > 0) {
    if (hasData) warnings.push('Both -d and -F were given; only the multipart fields were kept.');
    bodyType = 'multipart';
    multipart = st.forms.map(
      (f): MultipartField => ({
        ...kv(f.name, f.value),
        kind: f.fileName !== undefined ? 'file' : 'text',
        fileName: f.fileName,
      }),
    );
  } else if (hasData) {
    const contentType = (headers.find(([n]) => n.toLowerCase() === 'content-type')?.[1] ?? '').toLowerCase();
    if (st.json || contentType.includes('json')) {
      bodyType = isJson(joined) ? 'json' : 'raw';
      body = joined;
    } else if (contentType === '' || contentType.includes('x-www-form-urlencoded')) {
      if (joined.includes('=')) {
        bodyType = 'form-urlencoded';
        formFields = Array.from(new URLSearchParams(joined), ([k, v]) => kv(k, v));
      } else {
        bodyType = 'raw';
        body = joined;
      }
      if (contentType === '') headers.push(['Content-Type', 'application/x-www-form-urlencoded']);
    } else {
      bodyType = 'raw';
      body = joined;
    }
  }

  if (st.json) {
    if (!hasHeader('content-type')) headers.push(['Content-Type', 'application/json']);
    if (!hasHeader('accept')) headers.push(['Accept', 'application/json']);
  }

  const method =
    st.method ?? (st.head ? 'HEAD' : st.get ? 'GET' : bodyType !== 'none' ? 'POST' : 'GET');
  if (st.head && st.method && st.method !== 'HEAD') {
    warnings.push(`-I was overridden by -X ${st.method}.`);
  }

  const restrictedSeen = new Set<string>();
  for (const [name] of headers) {
    if (isBrowserRestricted(name) && !restrictedSeen.has(name.toLowerCase())) {
      restrictedSeen.add(name.toLowerCase());
      warnings.push(`${name} cannot be set by browser scripts; it is shown but not sent by this app.`);
    }
  }

  const request = emptyRequest({
    method,
    url: `${parsed.origin}${parsed.pathname}`,
    params,
    headers: headers.map(([k, v]) => kv(k, v)),
    cookies,
    auth,
    bodyType,
    body,
    formFields,
    multipart,
    timeoutMs: st.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    followRedirects: st.location,
  });

  return { request, errors, warnings, unsupported };
}

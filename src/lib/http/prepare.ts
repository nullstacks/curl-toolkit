import type { KV, RequestModel } from '../../types';
import { base64EncodeUtf8 } from '../utils';

export class PrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrepareError';
  }
}

export interface PreparedPart {
  name: string;
  value: string;
  fileName?: string;
  file?: Blob;
}

export type PreparedBody =
  | { kind: 'none' }
  | { kind: 'text'; text: string }
  | { kind: 'form'; fields: Array<[string, string]> }
  | { kind: 'multipart'; parts: PreparedPart[] };

export interface PreparedRequest {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body: PreparedBody;
}

export interface PrepareOptions {
  /** Applied to every user-supplied string (variable substitution). */
  transform?: (value: string) => string;
  /** Strict mode throws on invalid or unresolved URLs. Code generation runs non-strict. */
  strict?: boolean;
}

/**
 * Headers the Fetch specification forbids scripts from setting.
 * Browsers silently drop these, so the runner reports them instead of sending them.
 */
const BROWSER_RESTRICTED = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via',
]);

export function isBrowserRestricted(name: string): boolean {
  const n = name.trim().toLowerCase();
  return BROWSER_RESTRICTED.has(n) || n.startsWith('proxy-') || n.startsWith('sec-');
}

function enabledRows(rows: KV[]): KV[] {
  return rows.filter((r) => r.enabled && r.key.trim() !== '');
}

/** Turns the editable request model into the exact method, URL, headers and body to send or print. */
export function prepareRequest(req: RequestModel, options: PrepareOptions = {}): PreparedRequest {
  const t = options.transform ?? ((v: string) => v);
  const strict = options.strict ?? true;
  const method = req.method.trim().toUpperCase() || 'GET';
  const rawUrl = t(req.url.trim());

  if (!rawUrl) throw new PrepareError('URL is required.');
  const hasTemplate = rawUrl.includes('{{');
  if (hasTemplate && strict) {
    throw new PrepareError(`URL contains an unresolved variable: ${rawUrl}`);
  }

  const extraQuery: Array<[string, string]> = enabledRows(req.params).map((p) => [
    t(p.key.trim()),
    t(p.value),
  ]);
  if (req.auth.type === 'apikey' && req.auth.apiKeyIn === 'query' && req.auth.apiKeyName.trim()) {
    extraQuery.push([t(req.auth.apiKeyName.trim()), t(req.auth.apiKeyValue)]);
  }

  let url: string;
  let parsed: URL | null = null;
  if (!hasTemplate) {
    try {
      parsed = new URL(rawUrl);
    } catch {
      parsed = null;
    }
  }

  if (parsed) {
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new PrepareError(`Only http and https URLs are supported (got ${parsed.protocol}).`);
    }
    for (const [k, v] of extraQuery) parsed.searchParams.append(k, v);
    url = parsed.toString();
  } else {
    if (strict) throw new PrepareError(`Invalid URL: ${rawUrl}`);
    const query = new URLSearchParams(extraQuery).toString();
    url = query ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}${query}` : rawUrl;
  }

  const headers: Array<[string, string]> = enabledRows(req.headers).map((h) => [
    t(h.key.trim()),
    t(h.value),
  ]);

  const cookieParts = enabledRows(req.cookies).map((c) => `${t(c.key.trim())}=${t(c.value)}`);
  if (cookieParts.length > 0) headers.push(['Cookie', cookieParts.join('; ')]);

  const hasHeader = (name: string) => headers.some(([k]) => k.toLowerCase() === name);

  if (!hasHeader('authorization')) {
    if (req.auth.type === 'basic') {
      const credentials = `${t(req.auth.username)}:${t(req.auth.password)}`;
      headers.push(['Authorization', `Basic ${base64EncodeUtf8(credentials)}`]);
    }
    if (req.auth.type === 'bearer') {
      headers.push(['Authorization', `Bearer ${t(req.auth.token)}`]);
    }
  }
  if (req.auth.type === 'apikey' && req.auth.apiKeyIn === 'header' && req.auth.apiKeyName.trim()) {
    headers.push([req.auth.apiKeyName.trim(), t(req.auth.apiKeyValue)]);
  }

  let body: PreparedBody = { kind: 'none' };
  switch (req.bodyType) {
    case 'json':
    case 'raw': {
      const text = t(req.body);
      if (text.length > 0) {
        body = { kind: 'text', text };
        if (req.bodyType === 'json' && !hasHeader('content-type')) {
          headers.push(['Content-Type', 'application/json']);
        }
      }
      break;
    }
    case 'form-urlencoded': {
      const fields = enabledRows(req.formFields).map((f): [string, string] => [
        t(f.key.trim()),
        t(f.value),
      ]);
      if (fields.length > 0) {
        body = { kind: 'form', fields };
        if (!hasHeader('content-type')) {
          headers.push(['Content-Type', 'application/x-www-form-urlencoded']);
        }
      }
      break;
    }
    case 'multipart': {
      const parts = req.multipart
        .filter((p) => p.enabled && p.key.trim() !== '')
        .map((p): PreparedPart =>
          p.kind === 'file'
            ? { name: t(p.key.trim()), value: '', fileName: p.fileName, file: p.file }
            : { name: t(p.key.trim()), value: t(p.value) },
        );
      if (parts.length > 0) body = { kind: 'multipart', parts };
      break;
    }
    default:
      break;
  }

  return { method, url, headers, body };
}

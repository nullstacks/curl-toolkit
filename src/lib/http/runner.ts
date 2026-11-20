import type { RequestModel } from '../../types';
import { interpolate } from '../utils';
import { PrepareError, isBrowserRestricted, prepareRequest, type PreparedRequest } from './prepare';
import { classifyContentType, decodeBody, type ResponseKind } from './response';

export type RunErrorKind = 'cancelled' | 'timeout' | 'network' | 'invalid';

export class RunError extends Error {
  readonly kind: RunErrorKind;
  readonly hint: string | undefined;

  constructor(kind: RunErrorKind, message: string, hint?: string) {
    super(message);
    this.name = 'RunError';
    this.kind = kind;
    this.hint = hint;
  }
}

export interface RunOutcome {
  status: number;
  statusText: string;
  url: string;
  redirected: boolean;
  /** Only CORS-safelisted headers (plus Access-Control-Expose-Headers) are readable. */
  headers: Array<[string, string]>;
  contentType: string;
  kind: ResponseKind;
  durationMs: number;
  sizeBytes: number;
  bytes: ArrayBuffer;
  text: string | null;
  ignoredHeaders: string[];
  opaqueRedirect: boolean;
}

export interface ExecuteOptions {
  vars?: Record<string, string>;
  signal?: AbortSignal;
}

const NETWORK_HINT =
  'Browsers do not reveal why a request failed. If the server answers curl but not this app, ' +
  'it likely lacks CORS headers that allow this origin, or the host is unreachable. This app cannot ' +
  'bypass CORS, so the API must allow browser requests from the origin serving this page.';

/** Sends a request with the browser Fetch API. Throws RunError for every failure path. */
export async function executeRequest(
  req: RequestModel,
  options: ExecuteOptions = {},
): Promise<RunOutcome> {
  const vars = options.vars ?? {};
  let prepared: PreparedRequest;
  try {
    prepared = prepareRequest(req, { transform: (v) => interpolate(v, vars), strict: true });
  } catch (err) {
    throw new RunError(
      'invalid',
      err instanceof PrepareError ? err.message : 'The request could not be built.',
    );
  }

  const { method, url, body } = prepared;

  if ((method === 'GET' || method === 'HEAD') && body.kind !== 'none') {
    throw new RunError(
      'invalid',
      `${method} requests cannot include a body in the browser.`,
      'Change the method or remove the body.',
    );
  }

  if (req.bodyType === 'json' && body.kind === 'text') {
    try {
      JSON.parse(body.text);
    } catch (err) {
      throw new RunError(
        'invalid',
        `Body is not valid JSON: ${err instanceof Error ? err.message : 'parse error'}`,
      );
    }
  }

  if (body.kind === 'multipart') {
    const missing = body.parts.find((p) => p.fileName && !p.file);
    if (missing) {
      throw new RunError('invalid', `Choose a file for the "${missing.name}" field.`);
    }
  }

  const headers = new Headers();
  const ignoredHeaders: string[] = [];
  for (const [name, value] of prepared.headers) {
    if (isBrowserRestricted(name)) {
      ignoredHeaders.push(name);
      continue;
    }
    // The browser must set the multipart boundary itself.
    if (body.kind === 'multipart' && name.toLowerCase() === 'content-type') continue;
    try {
      headers.append(name, value);
    } catch {
      throw new RunError('invalid', `Invalid header name: ${name}`);
    }
  }

  let init: BodyInit | undefined;
  if (body.kind === 'text') {
    init = body.text;
  } else if (body.kind === 'form') {
    init = new URLSearchParams(body.fields);
  } else if (body.kind === 'multipart') {
    const form = new FormData();
    for (const part of body.parts) {
      if (part.file) form.append(part.name, part.file, part.fileName ?? 'file');
      else form.append(part.name, part.value);
    }
    init = form;
  }

  const controller = new AbortController();
  const state = { timedOut: false };
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, req.timeoutMs);
  const onUserAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', onUserAbort);
  const started = performance.now();

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: init,
      redirect: req.followRedirects ? 'follow' : 'manual',
      credentials: req.sendCredentials ? 'include' : 'omit',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (res.type === 'opaqueredirect') {
      return {
        status: 0,
        statusText: 'Redirect not followed',
        url,
        redirected: false,
        headers: [],
        contentType: '',
        kind: 'text',
        durationMs: performance.now() - started,
        sizeBytes: 0,
        bytes: new ArrayBuffer(0),
        text: '',
        ignoredHeaders,
        opaqueRedirect: true,
      };
    }

    const bytes = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? '';
    const kind = classifyContentType(contentType);

    return {
      status: res.status,
      statusText: res.statusText,
      url: res.url || url,
      redirected: res.redirected,
      headers: Array.from(res.headers.entries()),
      contentType,
      kind,
      durationMs: performance.now() - started,
      sizeBytes: bytes.byteLength,
      bytes,
      text: kind === 'image' || kind === 'binary' ? null : decodeBody(bytes, contentType),
      ignoredHeaders,
      opaqueRedirect: false,
    };
  } catch (err) {
    if (state.timedOut) {
      throw new RunError(
        'timeout',
        `No complete response within ${Math.round(req.timeoutMs / 1000)} seconds.`,
        'Increase the timeout in the request settings.',
      );
    }
    if (options.signal?.aborted) throw new RunError('cancelled', 'The request was cancelled.');
    if (err instanceof RunError) throw err;
    throw new RunError('network', 'The request failed before a response was received.', NETWORK_HINT);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onUserAbort);
  }
}

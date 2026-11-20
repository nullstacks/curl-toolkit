import type { KV, RequestModel } from '../../types';

const SECRET_HEADER = /^(authorization|proxy-authorization|x-api-key|api-key|x-auth-token|x-access-token|cookie|set-cookie)$/i;
const SECRET_NAME = /(token|secret|password|passwd|api[-_]?key|auth|session|credential)/i;

export const REDACTED = '';

function isSecretKey(name: string): boolean {
  return SECRET_HEADER.test(name.trim()) || SECRET_NAME.test(name);
}

function scrubRows(rows: KV[], flagged: { value: boolean }): KV[] {
  return rows.map((r) => {
    if (isSecretKey(r.key) && r.value !== '') {
      flagged.value = true;
      return { ...r, value: REDACTED };
    }
    return r;
  });
}

/**
 * Returns a copy safe to write to IndexedDB. Passwords, tokens, API keys and secret-looking
 * headers or query parameters are removed; `secretsRedacted` marks the request so the UI
 * asks the user to re-enter them. Pass `excludeSensitive` to drop them from the saved copy entirely.
 */
export function redactForStorage(req: RequestModel, excludeSensitive: boolean): RequestModel {
  const flagged = { value: false };
  const auth = { ...req.auth };
  if (auth.password) {
    auth.password = REDACTED;
    flagged.value = true;
  }
  if (auth.token) {
    auth.token = REDACTED;
    flagged.value = true;
  }
  if (auth.apiKeyValue) {
    auth.apiKeyValue = REDACTED;
    flagged.value = true;
  }

  const next: RequestModel = {
    ...req,
    auth,
    headers: scrubRows(req.headers, flagged),
    params: scrubRows(req.params, flagged),
    cookies: req.cookies.map((c) => {
      if (c.value) flagged.value = true;
      return { ...c, value: REDACTED };
    }),
    multipart: req.multipart.map((m) => ({ ...m, file: undefined })),
    secretsRedacted: flagged.value || req.secretsRedacted,
  };

  if (excludeSensitive) {
    next.auth = { ...auth, type: 'none' };
    next.headers = next.headers.filter((h) => !isSecretKey(h.key));
    next.cookies = [];
  }
  return next;
}

/** Returns true when a request still contains a secret value (used to warn before export). */
export function containsSecrets(req: RequestModel): boolean {
  return (
    Boolean(req.auth.password || req.auth.token || req.auth.apiKeyValue) ||
    req.headers.some((h) => isSecretKey(h.key) && h.value !== '') ||
    req.cookies.some((c) => c.value !== '')
  );
}

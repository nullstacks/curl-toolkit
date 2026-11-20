export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export const DEFAULT_TIMEOUT_MS = 30_000;

export type BodyType = 'none' | 'json' | 'raw' | 'form-urlencoded' | 'multipart';
export type AuthType = 'none' | 'basic' | 'bearer' | 'apikey';

export interface KV {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface MultipartField extends KV {
  kind: 'text' | 'file';
  fileName?: string;
  /** Runtime-only. Never persisted; re-selected after a reload. */
  file?: Blob;
}

export interface AuthConfig {
  type: AuthType;
  username: string;
  password: string;
  token: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: 'header' | 'query';
}

export interface RequestModel {
  method: string;
  url: string;
  params: KV[];
  headers: KV[];
  cookies: KV[];
  auth: AuthConfig;
  bodyType: BodyType;
  body: string;
  formFields: KV[];
  multipart: MultipartField[];
  timeoutMs: number;
  followRedirects: boolean;
  sendCredentials: boolean;
  /** True when secret values were removed for storage and must be re-entered. */
  secretsRedacted: boolean;
}

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function kv(key = '', value = '', enabled = true): KV {
  return { id: newId(), key, value, enabled };
}

export function emptyRequest(overrides: Partial<RequestModel> = {}): RequestModel {
  return {
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    cookies: [],
    auth: {
      type: 'none',
      username: '',
      password: '',
      token: '',
      apiKeyName: '',
      apiKeyValue: '',
      apiKeyIn: 'header',
    },
    bodyType: 'none',
    body: '',
    formFields: [],
    multipart: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    followRedirects: true,
    sendCredentials: false,
    secretsRedacted: false,
    ...overrides,
  };
}

/** Copies a request with fresh row ids so duplicated tabs never share React keys. */
export function cloneRequest(req: RequestModel): RequestModel {
  const rekey = <T extends KV>(rows: T[]): T[] => rows.map((r) => ({ ...r, id: newId() }));
  return {
    ...req,
    params: rekey(req.params),
    headers: rekey(req.headers),
    cookies: rekey(req.cookies),
    formFields: rekey(req.formFields),
    multipart: rekey(req.multipart),
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeRequest, RunError } from '../lib/http/runner';
import { emptyRequest, kv } from '../types';

const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('executeRequest', () => {
  it('sends the prepared request and classifies the JSON response', async () => {
    const out = await executeRequest(
      emptyRequest({ method: 'POST', url: 'https://api.test/items', bodyType: 'json', body: '{"a":1}', headers: [kv('X-Trace', '1')] }),
    );
    expect(out.status).toBe(201);
    expect(out.kind).toBe('json');
    expect(out.text).toBe('{"ok":true}');
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call?.[0]).toBe('https://api.test/items');
  });

  it('interpolates {{variables}} from the active environment', async () => {
    await executeRequest(emptyRequest({ url: '{{base}}/users' }), { vars: { base: 'https://api.test' } });
    const url = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0];
    expect(url).toBe('https://api.test/users');
  });

  it('refuses an unresolved variable instead of sending it', async () => {
    await expect(executeRequest(emptyRequest({ url: '{{missing}}/x' }))).rejects.toBeInstanceOf(RunError);
  });

  it('reports network failures with a CORS-aware hint', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const err = await executeRequest(emptyRequest({ url: 'https://api.test' })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RunError);
    expect((err as RunError).kind).toBe('network');
    expect((err as RunError).hint).toMatch(/CORS/);
  });

  it('aborts when the timeout elapses', async () => {
    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      }),
    ) as unknown as typeof fetch;
    const err = await executeRequest(emptyRequest({ url: 'https://api.test', timeoutMs: 20 })).catch((e: unknown) => e);
    expect((err as RunError).kind).toBe('timeout');
  });

  it('reports user cancellation distinctly from timeouts', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      }),
    ) as unknown as typeof fetch;
    const pending = executeRequest(emptyRequest({ url: 'https://api.test' }), { signal: controller.signal }).catch((e: unknown) => e);
    controller.abort();
    expect(((await pending) as RunError).kind).toBe('cancelled');
  });

  it('rejects GET with a body before sending', async () => {
    await expect(
      executeRequest(emptyRequest({ method: 'GET', url: 'https://api.test', bodyType: 'raw', body: 'x' })),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../lib/storage/db';
import { repo } from '../lib/storage/repository';
import { buildBackup, parseBackup, restoreBackup } from '../lib/storage/backup';
import { redactForStorage, containsSecrets, REDACTED } from '../lib/storage/redact';
import { emptyRequest, kv } from '../types';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('secret redaction', () => {
  const secretReq = emptyRequest({
    url: 'https://x.test',
    headers: [kv('Authorization', 'Bearer t0ken'), kv('Accept', 'json')],
    auth: { type: 'basic', username: 'u', password: 'pw', token: '', apiKeyName: '', apiKeyValue: '', apiKeyIn: 'header' },
  });

  it('masks passwords and secret headers but keeps ordinary ones', () => {
    const stored = redactForStorage(secretReq, false);
    expect(stored.auth.password).toBe(REDACTED);
    expect(stored.headers[0]?.value).toBe(REDACTED);
    expect(stored.headers[1]?.value).toBe('json');
    expect(stored.secretsRedacted).toBe(true);
  });

  it('drops secrets entirely when the exclude option is on', () => {
    const stored = redactForStorage(secretReq, true);
    expect(stored.headers.map((h) => h.key)).toEqual(['Accept']);
    expect(stored.auth.type).toBe('none');
  });

  it('detects secrets before export', () => {
    expect(containsSecrets(secretReq)).toBe(true);
    expect(containsSecrets(emptyRequest({ url: 'https://x.test' }))).toBe(false);
  });
});

describe('local persistence', () => {
  it('saves a request and reads it back with secrets masked', async () => {
    const req = emptyRequest({ url: 'https://x.test', auth: { type: 'bearer', token: 'abc', username: '', password: '', apiKeyName: '', apiKeyValue: '', apiKeyIn: 'header' } });
    const { id } = await repo.saveRequest('Ping', req, null, null);
    const row = await db.requests.get(id);
    expect(row?.name).toBe('Ping');
    expect(row?.request.auth.token).toBe(REDACTED);
  });

  it('caps history at the configured limit', async () => {
    await repo.savePreferences({ historyLimit: 3 });
    for (let i = 0; i < 5; i++) {
      await repo.addHistory(emptyRequest({ url: `https://x.test/${i}` }), { status: 200, durationMs: 1, error: null });
    }
    expect(await db.history.count()).toBe(3);
  });

  it('exports and re-imports without duplicating rows', async () => {
    const c = await repo.createCollection('Core API');
    await repo.saveRequest('List', emptyRequest({ url: 'https://x.test/list' }), c.id, null);

    const backup = await buildBackup(false);
    const parsed = parseBackup(JSON.stringify(backup));
    await restoreBackup(parsed);
    await restoreBackup(parsed);

    expect(await db.collections.count()).toBe(1);
    expect(await db.requests.count()).toBe(1);
  });

  it('rejects files that were not produced by this app', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(/not exported/);
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/);
  });

  it('clearing data removes everything', async () => {
    await repo.createCollection('X');
    await repo.clearAll();
    expect(await db.collections.count()).toBe(0);
  });
});

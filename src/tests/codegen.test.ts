import { describe, expect, it } from 'vitest';
import { emptyRequest, kv } from '../types';
import { generateCode, GENERATORS } from '../lib/codegen/generators';
import { parseCurl } from '../lib/curl/parser';

const sample = emptyRequest({
  method: 'POST',
  url: 'https://api.example.com/items',
  headers: [kv('Accept', 'application/json')],
  bodyType: 'json',
  body: '{"name":"it\'s"}',
});

describe('code generation', () => {
  it('produces output for every registered language', () => {
    for (const g of GENERATORS) {
      const out = generateCode(sample, g.info.id);
      expect(out.length, g.info.id).toBeGreaterThan(10);
    }
  });

  it('shell-quotes single quotes in the cURL output', () => {
    const out = generateCode(sample, 'curl');
    expect(out).toContain(`'\\''`);
    expect(out).toContain('-X POST');
  });

  it('emits Python requests call with the body', () => {
    const out = generateCode(sample, 'python');
    expect(out).toContain('requests.request("POST"');
    expect(out).toContain('data="{\\"name\\":\\"it\'s\\"}"');
  });

  it('round-trips: a cURL produced by the generator parses back to the same method, URL and body', () => {
    const out = generateCode(sample, 'curl').replace(/ \\\n/g, ' ');
    const back = parseCurl(out);
    expect(back.request?.method).toBe('POST');
    expect(back.request?.url).toBe('https://api.example.com/items');
    expect(JSON.parse(back.request?.body ?? '')).toEqual({ name: "it's" });
  });

  it('writes a HAR document that is valid JSON', () => {
    expect(() => JSON.parse(generateCode(sample, 'har'))).not.toThrow();
  });
});

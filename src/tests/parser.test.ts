import { describe, expect, it } from 'vitest';
import { parseCurl, tokenize } from '../lib/curl/parser';

describe('tokenize', () => {
  it('splits on whitespace and honours single quotes', () => {
    expect(tokenize(`curl -H 'A: b c' url`).tokens).toEqual(['curl', '-H', 'A: b c', 'url']);
  });

  it('joins line continuations and handles escaped double quotes', () => {
    const { tokens } = tokenize('curl \\\n  -d "say \\"hi\\""');
    expect(tokens).toEqual(['curl', '-d', 'say "hi"']);
  });

  it('reports unclosed quotes', () => {
    expect(tokenize(`curl 'oops`).error).toMatch(/Unclosed single quote/);
  });
});

describe('parseCurl', () => {
  it('parses method, URL, headers and JSON body', () => {
    const r = parseCurl(`curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{"a":1}'`);
    expect(r.errors).toEqual([]);
    expect(r.request?.method).toBe('POST');
    expect(r.request?.url).toBe('https://api.example.com/users');
    expect(r.request?.bodyType).toBe('json');
    expect(r.request?.body).toBe('{"a":1}');
    expect(r.request?.headers.map((h) => h.key)).toContain('Content-Type');
  });

  it('infers POST when data is given without -X', () => {
    const r = parseCurl(`curl https://x.test -d 'name=a'`);
    expect(r.request?.method).toBe('POST');
    expect(r.request?.bodyType).toBe('form-urlencoded');
    expect(r.request?.formFields[0]).toMatchObject({ key: 'name', value: 'a' });
  });

  it('moves query parameters from the URL into the params table', () => {
    const r = parseCurl(`curl 'https://x.test/search?q=hi&page=2'`);
    expect(r.request?.url).toBe('https://x.test/search');
    expect(r.request?.params.map((p) => [p.key, p.value])).toEqual([['q', 'hi'], ['page', '2']]);
  });

  it('converts basic auth and bearer tokens into the auth model', () => {
    const basic = parseCurl(`curl -u alice:secret https://x.test`);
    expect(basic.request?.auth).toMatchObject({ type: 'basic', username: 'alice', password: 'secret' });

    const bearer = parseCurl(`curl -H 'Authorization: Bearer abc.def' https://x.test`);
    expect(bearer.request?.auth).toMatchObject({ type: 'bearer', token: 'abc.def' });
    expect(bearer.request?.headers.some((h) => h.key === 'Authorization')).toBe(false);
  });

  it('turns -F fields into multipart rows and flags file fields', () => {
    const r = parseCurl(`curl -F 'title=Report' -F 'doc=@/tmp/report.pdf' https://x.test/upload`);
    expect(r.request?.bodyType).toBe('multipart');
    expect(r.request?.multipart).toHaveLength(2);
    expect(r.request?.multipart[1]).toMatchObject({ kind: 'file', fileName: 'report.pdf' });
    expect(r.warnings.some((w) => w.includes('selected again'))).toBe(true);
  });

  it('lists options that have no browser equivalent', () => {
    const r = parseCurl(`curl -k --proxy http://p:8080 https://x.test`);
    expect(r.request).not.toBeNull();
    const names = r.unsupported.map((u) => u.option);
    expect(names).toContain('--insecure');
    expect(names).toContain('--proxy');
  });

  it('returns an error instead of throwing for an empty command', () => {
    expect(parseCurl('   ').errors.length).toBeGreaterThan(0);
  });

  it('reports a missing URL', () => {
    expect(parseCurl('curl -X GET').errors[0]).toMatch(/No URL/);
  });

  it('rejects non-HTTP schemes', () => {
    expect(parseCurl('curl ftp://files.test/a').errors[0]).toMatch(/Unsupported protocol/);
  });

  it('decodes the cookie option into rows', () => {
    const r = parseCurl(`curl -b 'session=abc; theme=dark' https://x.test`);
    expect(r.request?.cookies.map((c) => [c.key, c.value])).toEqual([['session', 'abc'], ['theme', 'dark']]);
  });
});

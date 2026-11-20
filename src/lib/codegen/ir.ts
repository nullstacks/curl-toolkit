import type { RequestModel } from '../../types';
import { prepareRequest, type PreparedRequest } from '../http/prepare';

/**
 * Language-neutral description of a request. Generators read only this,
 * never the editable model, so every target agrees on what is sent.
 */
export interface CodegenIR {
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body:
    | { kind: 'none' }
    | { kind: 'text'; text: string; contentType: string }
    | { kind: 'form'; fields: Array<[string, string]> }
    | {
        kind: 'multipart';
        parts: Array<{ name: string; value: string; fileName?: string }>;
      };
  /** Notes shown beside the output, e.g. files that must be supplied by the user. */
  notes: string[];
}

export function buildIR(req: RequestModel): CodegenIR {
  // Codegen stays non-strict so partial requests still produce useful output.
  const prepared: PreparedRequest = prepareRequest(req, { strict: false });
  const notes: string[] = [];
  const headers = prepared.headers.filter(([name]) => {
    const n = name.toLowerCase();
    if (n === 'content-length') return false;
    return true;
  });

  const b = prepared.body;
  let body: CodegenIR['body'] = { kind: 'none' };
  if (b.kind === 'text') {
    const ct = headers.find(([n]) => n.toLowerCase() === 'content-type')?.[1] ?? 'text/plain';
    body = { kind: 'text', text: b.text, contentType: ct };
  } else if (b.kind === 'form') {
    body = { kind: 'form', fields: b.fields };
  } else if (b.kind === 'multipart') {
    body = {
      kind: 'multipart',
      parts: b.parts.map((p) =>
        p.fileName !== undefined
          ? { name: p.name, value: '', fileName: p.fileName }
          : { name: p.name, value: p.value },
      ),
    };
    for (const p of b.parts) {
      if (p.fileName !== undefined) notes.push(`Replace "${p.fileName}" with the real file path for field "${p.name}".`);
    }
  }

  return { method: prepared.method, url: prepared.url, headers, body, notes };
}

export function hasBody(ir: CodegenIR): boolean {
  return ir.body.kind !== 'none';
}

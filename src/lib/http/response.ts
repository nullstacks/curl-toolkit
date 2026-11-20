export type ResponseKind = 'json' | 'html' | 'xml' | 'image' | 'text' | 'binary';
export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';

export function classifyContentType(contentType: string): ResponseKind {
  const ct = contentType.toLowerCase();
  if (ct === '') return 'text';
  if (ct.includes('svg')) return 'image';
  if (ct.includes('json')) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.includes('xml')) return 'xml';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('text/') || /javascript|x-www-form-urlencoded|csv|yaml|graphql/.test(ct)) {
    return 'text';
  }
  return 'binary';
}

export function decodeBody(bytes: ArrayBuffer, contentType: string): string {
  const match = /charset=([^;]+)/i.exec(contentType);
  const label = match?.[1]?.trim().replace(/^"|"$/g, '') ?? 'utf-8';
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function formatJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

/** Indents XML by tag depth. Good enough for display; it does not reflow text content. */
export function formatXml(text: string): string {
  const lines = text.replace(/>\s*</g, '>\n<').split('\n');
  let depth = 0;
  const out: string[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    const isClose = /^<\//.test(t);
    const isDeclaration = /^<[?!]/.test(t);
    const selfClosing = /\/>$/.test(t);
    const inline = /<\/[^>]+>$/.test(t);
    const isOpen = /^<[^/?!]/.test(t) && !selfClosing && !inline && !isDeclaration;
    if (isClose) depth = Math.max(0, depth - 1);
    out.push(`${'  '.repeat(depth)}${t}`);
    if (isOpen) depth += 1;
  }
  return out.join('\n');
}

export function monacoLanguageFor(kind: ResponseKind): string {
  switch (kind) {
    case 'json':
      return 'json';
    case 'xml':
      return 'xml';
    case 'html':
      return 'html';
    default:
      return 'plaintext';
  }
}

export function responseExtension(contentType: string, kind: ResponseKind): string {
  if (kind === 'json') return 'json';
  if (kind === 'html') return 'html';
  if (kind === 'xml') return 'xml';
  if (kind === 'text') return 'txt';
  if (kind === 'image') {
    const sub = contentType.split('/')[1]?.split(';')[0]?.trim();
    return sub && sub.length < 12 ? sub : 'img';
  }
  return 'bin';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function statusTone(status: number): Tone {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 300 && status < 400) return 'accent';
  if (status >= 400 && status < 500) return 'warn';
  if (status >= 500) return 'danger';
  return 'neutral';
}

/** Single-quoted shell string, safe for POSIX shells. */
export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Double-quoted string literal with escapes for most C-family, Java, Ruby, PHP, and Go languages. */
export function dq(s: string): string {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\$/g, '\\$')}"`;
}

/** JSON-compatible string literal; valid JavaScript, Python, and many other languages. */
export function jsStr(s: string): string {
  return JSON.stringify(s);
}

export function pyStr(s: string): string {
  return jsStr(s);
}

export function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((l) => (l.length ? pad + l : l))
    .join('\n');
}

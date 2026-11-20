export function base64EncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64DecodeUtf8(input: string): string {
  const binary = atob(input);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const VARIABLE = /\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g;

/** Replaces {{name}} placeholders. Unknown names are left untouched. */
export function interpolate(input: string, vars: Record<string, string>): string {
  return input.replace(VARIABLE, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? (vars[name] ?? match) : match,
  );
}

export function findVariables(input: string): string[] {
  const names = Array.from(input.matchAll(VARIABLE), (m) => m[1] ?? '');
  return Array.from(new Set(names)).filter(Boolean);
}

export function downloadBlob(data: BlobPart, type: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

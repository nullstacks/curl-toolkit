export interface Shortcut {
  keys: string;
  label: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: 'Ctrl/⌘ + Enter', label: 'Send request' },
  { keys: 'Ctrl/⌘ + S', label: 'Save request' },
  { keys: 'Ctrl/⌘ + T', label: 'New request tab' },
  { keys: 'Ctrl/⌘ + W', label: 'Close request tab' },
  { keys: 'Ctrl/⌘ + D', label: 'Duplicate request' },
  { keys: 'Ctrl/⌘ + 1…6', label: 'Switch main view' },
  { keys: 'Esc', label: 'Close dialog' },
];

/** Maps a keydown event to a shortcut action id, or null. Pure so it can be unit tested. */
export function shortcutAction(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey'>): string | null {
  if (!(e.metaKey || e.ctrlKey)) return null;
  const k = e.key.toLowerCase();
  if (e.key === 'Enter') return 'send';
  if (k === 's') return 'save';
  if (k === 't') return 'new-tab';
  if (k === 'w') return 'close-tab';
  if (k === 'd') return 'duplicate';
  if (/^[1-6]$/.test(k)) return `view-${k}`;
  return null;
}

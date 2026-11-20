import Editor, { type OnMount } from '@monaco-editor/react';
import { useUiStore } from '../store/uiStore';

interface Props {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  height?: string | number;
  ariaLabel: string;
}

/** Monaco wrapper that follows the app theme and stays read-only where requested. */
export function CodeEditor({ value, onChange, language, readOnly = false, height = '100%', ariaLabel }: Props) {
  const theme = useUiStore((s) => s.preferences.theme);

  const onMount: OnMount = (editor) => {
    editor.updateOptions({ ariaLabel });
  };

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      onChange={(v) => onChange?.(v ?? '')}
      onMount={onMount}
      loading={<div className="p-3 text-[12px] text-muted">Loading editor…</div>}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 12.5,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 8, bottom: 8 },
        renderLineHighlight: 'none',
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      }}
    />
  );
}

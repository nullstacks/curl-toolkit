import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, Trash2 } from 'lucide-react';
import { repo } from '../lib/storage/repository';
import { buildBackup, parseBackup, restoreBackup } from '../lib/storage/backup';
import { downloadBlob } from '../lib/utils';
import { useUiStore } from '../store/uiStore';
import { Button, Notice, Panel } from '../components/ui';
import { SHORTCUTS } from '../lib/shortcuts';

export function SettingsView() {
  const storedPrefs = useUiStore((s) => s.preferences);
  const prefs = useLiveQuery(() => repo.getPreferences(), [], storedPrefs);
  const setTheme = useUiStore((s) => s.setTheme);
  const [message, setMessage] = useState<{ tone: 'neutral' | 'danger'; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [includeHistory, setIncludeHistory] = useState(true);

  const applyTheme = (theme: 'dark' | 'light') => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    setTheme(theme);
    void repo.savePreferences({ theme });
  };

  const exportData = async () => {
    const backup = await buildBackup(includeHistory);
    downloadBlob(JSON.stringify(backup, null, 2), 'application/json', `curl-toolkit-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setMessage({ tone: 'neutral', text: 'Exported. The file contains request URLs and bodies; secret values are masked unless you turned off masking.' });
  };

  const importData = async (file: File) => {
    try {
      const parsed = parseBackup(await file.text());
      const count = await restoreBackup(parsed);
      setMessage({ tone: 'neutral', text: `Imported ${count} records.` });
    } catch (err) {
      setMessage({ tone: 'danger', text: err instanceof Error ? err.message : 'Import failed.' });
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 overflow-auto p-4">
      <Panel title="Appearance">
        <div className="flex items-center gap-3 p-3 text-[12.5px]">
          <span className="w-32 text-muted">Theme</span>
          <Button size="sm" variant={prefs.theme === 'dark' ? 'secondary' : 'ghost'} aria-pressed={prefs.theme === 'dark'} onClick={() => applyTheme('dark')}>Dark</Button>
          <Button size="sm" variant={prefs.theme === 'light' ? 'secondary' : 'ghost'} aria-pressed={prefs.theme === 'light'} onClick={() => applyTheme('light')}>Light</Button>
        </div>
      </Panel>

      <Panel title="Privacy">
        <div className="flex flex-col gap-3 p-3 text-[12.5px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefs.excludeSensitiveOnSave}
              onChange={(e) => void repo.savePreferences({ excludeSensitiveOnSave: e.target.checked })}
            />
            Exclude passwords, tokens, API keys and cookies from history and saved requests
          </label>
          <label className="flex items-center gap-2">
            History limit
            <input
              type="number"
              min={10}
              max={5000}
              aria-label="History limit"
              value={prefs.historyLimit}
              onChange={(e) => void repo.savePreferences({ historyLimit: Math.min(5000, Math.max(10, Number(e.target.value) || 10)) })}
              className="h-8 w-24 rounded-md border border-border bg-bg px-2"
            />
          </label>
          <p className="text-muted">Everything stays on this device. This app has no server, analytics or sync.</p>
        </div>
      </Panel>

      <Panel title="Data">
        <div className="flex flex-col gap-3 p-3 text-[12.5px]">
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" checked={includeHistory} onChange={(e) => setIncludeHistory(e.target.checked)} />
            Include request history in export
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={exportData}><Download size={13} /> Export data</Button>
            <Button size="sm" onClick={() => fileInput.current?.click()}><Upload size={13} /> Import data</Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              aria-label="Import backup file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importData(f);
                e.target.value = '';
              }}
            />
            {!confirmClear ? (
              <Button size="sm" variant="danger" onClick={() => setConfirmClear(true)}><Trash2 size={13} /> Clear local data</Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-danger">Delete everything stored in this browser?</span>
                <Button size="sm" variant="danger" onClick={async () => { await repo.clearAll(); setConfirmClear(false); setMessage({ tone: 'neutral', text: 'Local data cleared.' }); }}>Yes, delete</Button>
                <Button size="sm" onClick={() => setConfirmClear(false)}>Cancel</Button>
              </div>
            )}
          </div>
          {message && <Notice tone={message.tone === 'danger' ? 'danger' : 'neutral'}>{message.text}</Notice>}
        </div>
      </Panel>

      <Panel title="Keyboard shortcuts">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 text-[12.5px]">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-3">
              <span className="text-muted">{s.label}</span>
              <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{s.keys}</kbd>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/storage/db';
import { repo } from '../lib/storage/repository';
import { useAppStore, type Tab } from '../store/appStore';
import { Button, Input, Notice, Select } from './ui';

export function SaveDialog({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const collections = useLiveQuery(() => db.collections.toArray(), [], []);
  const [name, setName] = useState(tab.title || 'Untitled request');
  const [collectionId, setCollectionId] = useState<string>('');
  const [status, setStatus] = useState<string | null>(null);
  const renameTab = useAppStore((s) => s.renameTab);
  const linkSaved = useAppStore((s) => s.linkSaved);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    try {
      const { id, containsSecrets } = await repo.saveRequest(
        name.trim() || 'Untitled request',
        tab.request,
        collectionId || null,
        null,
        tab.savedId ?? undefined,
      );
      linkSaved(tab.id, id);
      renameTab(tab.id, name.trim() || 'Untitled request');
      setStatus(containsSecrets ? 'Saved. Secret values were masked; re-enter them when you reuse this request.' : 'Saved.');
      if (!containsSecrets) window.setTimeout(onClose, 500);
    } catch (err) {
      setStatus(`Could not save: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-title"
        className="w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="save-title" className="mb-3 text-sm font-medium">Save request</h2>
        <div className="flex flex-col gap-3 text-[12.5px]">
          <label className="flex flex-col gap-1">
            <span className="text-muted">Name</span>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted">Collection</span>
            <Select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
              <option value="">No collection</option>
              {collections?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </label>
          {status && <Notice>{status}</Notice>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}

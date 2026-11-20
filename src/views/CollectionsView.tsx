import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderPlus, FolderOpen, Trash2, Star, Plus } from 'lucide-react';
import { db, type Collection, type Folder, type SavedRequest } from '../lib/storage/db';
import { repo } from '../lib/storage/repository';
import { useAppStore } from '../store/appStore';
import { Button, Empty, Input, Panel } from '../components/ui';
import { Badge } from '../components/ui';

export function CollectionsView() {
  const collections = useLiveQuery(() => db.collections.orderBy('name').toArray(), [], [] as Collection[]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [search, setSearch] = useState('');
  const loadIntoRunner = useAppStore((s) => s.loadIntoRunner);

  const current = collections?.find((c) => c.id === selected) ?? collections?.[0] ?? null;
  const folders = useLiveQuery(
    () => (current ? db.folders.where('collectionId').equals(current.id).toArray() : Promise.resolve([] as Folder[])),
    [current?.id],
    [] as Folder[],
  );
  const requests = useLiveQuery(
    () => (current ? db.requests.where('collectionId').equals(current.id).toArray() : Promise.resolve([] as SavedRequest[])),
    [current?.id],
    [] as SavedRequest[],
  );
  const favorites = useLiveQuery(() => db.requests.filter((r) => r.favorite).toArray(), [], [] as SavedRequest[]);

  const visible = (requests ?? []).filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid h-full grid-cols-[260px_minmax(0,1fr)] gap-3 p-3">
      <Panel title="Collections" actions={null}>
        <div className="flex flex-col gap-2 p-2">
          <form
            className="flex gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const c = await repo.createCollection(name.trim());
              setSelected(c.id);
              setName('');
            }}
          >
            <Input aria-label="New collection name" placeholder="New collection" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="icon" variant="secondary" aria-label="Create collection"><Plus size={14} /></Button>
          </form>
          <ul className="flex flex-col gap-0.5" aria-label="Collections list">
            {collections?.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  aria-current={current?.id === c.id}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] ${current?.id === c.id ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'}`}
                >
                  <FolderOpen size={13} /> <span className="truncate">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {(favorites?.length ?? 0) > 0 && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-muted">Favorites</p>
              {favorites?.map((r) => (
                <button key={r.id} onClick={() => loadIntoRunner(r.request, r.name)} className="flex w-full items-center gap-2 truncate rounded px-2 py-1 text-left text-[12.5px] text-muted hover:text-fg">
                  <Star size={11} className="fill-warn text-warn" /> <span className="truncate">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {!current ? (
        <Empty icon={<FolderOpen size={28} />} title="No collection selected" body="Create a collection to group related requests. Collections are stored only in this browser." />
      ) : (
        <Panel
          title={current.name}
          actions={
            <Button size="sm" variant="danger" onClick={async () => { await repo.deleteCollection(current.id); setSelected(null); }}>
              <Trash2 size={13} /> Delete collection
            </Button>
          }
        >
          <div className="flex h-full flex-col gap-3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Search requests in collection" placeholder="Search requests" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
              <form
                className="flex items-center gap-1.5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!folderName.trim()) return;
                  await repo.createFolder(current.id, folderName.trim(), null);
                  setFolderName('');
                }}
              >
                <Input aria-label="New folder name" placeholder="New folder" value={folderName} onChange={(e) => setFolderName(e.target.value)} className="w-40" />
                <Button type="submit" size="sm" variant="secondary"><FolderPlus size={13} /> Folder</Button>
              </form>
            </div>
            {(folders?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {folders?.map((f) => <Badge key={f.id}>{f.name}</Badge>)}
              </div>
            )}
            <ul className="min-h-0 flex-1 divide-y divide-border overflow-auto rounded-md border border-border" aria-label="Saved requests">
              {visible.length === 0 && <li className="p-4 text-[12.5px] text-muted">No saved requests here. Use Save in the Runner to add one.</li>}
              {visible.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                  <span className="w-16 font-mono text-accent">{r.request.method}</span>
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="max-w-[40%] truncate font-mono text-muted">{r.request.url}</span>
                  <Button size="icon" variant="ghost" aria-label={r.favorite ? 'Unfavorite' : 'Favorite'} onClick={() => db.requests.update(r.id, { favorite: !r.favorite })}>
                    <Star size={13} className={r.favorite ? 'fill-warn text-warn' : ''} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => loadIntoRunner(r.request, r.name)}>Open</Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => db.requests.delete(r.id)}>
                    <Trash2 size={13} />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Star, Trash2, RotateCcw } from 'lucide-react';
import { db } from '../lib/storage/db';
import { useAppStore } from '../store/appStore';
import { Badge, Button, Empty, Input, Panel, Select } from '../components/ui';
import { statusTone } from '../lib/http/response';

export function HistoryView() {
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const loadIntoRunner = useAppStore((s) => s.loadIntoRunner);
  const rows = useLiveQuery(() => db.history.orderBy('createdAt').reverse().toArray(), [], []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (method && r.method !== method) return false;
      if (onlyFavorites && !r.favorite) return false;
      if (onlyErrors && (r.error === null && (r.status ?? 0) < 400)) return false;
      if (q && !r.url.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, method, onlyFavorites, onlyErrors]);

  const methods = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.method))).sort(), [rows]);

  if (!rows || rows.length === 0) {
    return <Empty icon={<RotateCcw size={28} />} title="No history yet" body="Requests you send from the Runner are recorded here, stored only in this browser." />;
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Filter history by URL" placeholder="Filter by URL" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        <Select aria-label="Filter by method" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">All methods</option>
          {methods.map((m) => <option key={m}>{m}</option>)}
        </Select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted"><input type="checkbox" checked={onlyFavorites} onChange={(e) => setOnlyFavorites(e.target.checked)} /> Favorites</label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted"><input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Errors only</label>
        <span className="ml-auto text-[12px] text-muted">{filtered.length} of {rows.length}</span>
      </div>
      <Panel className="min-h-0 flex-1">
        <ul className="h-full divide-y divide-border overflow-auto" aria-label="Request history">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px] hover:bg-surface-2/60">
              <span className="w-16 shrink-0 font-mono text-accent">{r.method}</span>
              <span className="min-w-0 flex-1 truncate font-mono" title={r.url}>{r.url}</span>
              {r.error ? <Badge tone="danger">error</Badge> : <Badge tone={statusTone(r.status ?? 0)}>{r.status}</Badge>}
              <span className="w-16 shrink-0 text-right text-muted">{r.durationMs !== null ? `${Math.round(r.durationMs)} ms` : ''}</span>
              <span className="w-32 shrink-0 text-right text-muted">{new Date(r.createdAt).toLocaleString()}</span>
              <Button size="icon" variant="ghost" aria-label={r.favorite ? 'Remove favorite' : 'Add favorite'} onClick={() => db.history.update(r.id, { favorite: !r.favorite })}>
                <Star size={13} className={r.favorite ? 'fill-warn text-warn' : ''} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => loadIntoRunner(r.request, r.url)}>Open</Button>
              <Button size="icon" variant="ghost" aria-label="Delete history entry" onClick={() => db.history.delete(r.id)}>
                <Trash2 size={13} />
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={async () => { await db.history.clear(); }}>Clear history</Button>
      </div>
    </div>
  );
}

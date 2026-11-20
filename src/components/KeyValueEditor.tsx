import { Trash2, Plus } from 'lucide-react';
import type { KV } from '../types';
import { kv } from '../types';
import { Button, Input } from './ui';

interface Props {
  rows: KV[];
  onChange: (rows: KV[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  label: string;
  secretKeys?: RegExp;
}

export function KeyValueEditor({ rows, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', label, secretKeys }: Props) {
  const update = (id: string, patch: Partial<KV>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-1.5 p-3" role="group" aria-label={label}>
      {rows.length === 0 && <p className="py-2 text-[12.5px] text-muted">No entries yet.</p>}
      {rows.map((row) => {
        const secret = secretKeys?.test(row.key) ?? false;
        return (
          <div key={row.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <input
              type="checkbox"
              aria-label={`Enable ${row.key || 'row'}`}
              checked={row.enabled}
              onChange={(e) => update(row.id, { enabled: e.target.checked })}
            />
            <Input aria-label={`${label} key`} placeholder={keyPlaceholder} value={row.key} onChange={(e) => update(row.id, { key: e.target.value })} />
            <Input
              aria-label={`${label} value`}
              placeholder={valuePlaceholder}
              type={secret ? 'password' : 'text'}
              autoComplete="off"
              value={row.value}
              onChange={(e) => update(row.id, { value: e.target.value })}
              className="order-last col-span-3 sm:order-none sm:col-span-1"
            />
            <Button variant="ghost" size="icon" className="order-3 sm:order-none" aria-label={`Remove ${row.key || 'row'}`} onClick={() => onChange(rows.filter((r) => r.id !== row.id))}>
              <Trash2 size={14} />
            </Button>
          </div>
        );
      })}
      <div>
        <Button size="sm" variant="ghost" onClick={() => onChange([...rows, kv()])}>
          <Plus size={13} /> Add row
        </Button>
      </div>
    </div>
  );
}

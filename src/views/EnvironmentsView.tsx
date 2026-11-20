import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Check } from 'lucide-react';
import { db, type Environment } from '../lib/storage/db';
import { repo } from '../lib/storage/repository';
import { newId } from '../types';
import { Button, Empty, Input, Notice, Panel } from '../components/ui';

export function EnvironmentsView() {
  const envs = useLiveQuery(() => db.environments.orderBy('name').toArray(), [], []);
  const prefs = useLiveQuery(() => repo.getPreferences(), [], null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = envs?.find((e) => e.id === (selectedId ?? envs[0]?.id)) ?? null;

  const create = async () => {
    const now = Date.now();
    const env: Environment = { id: newId(), name: `Environment ${(envs?.length ?? 0) + 1}`, variables: [], createdAt: now, updatedAt: now };
    await repo.saveEnvironment(env);
    setSelectedId(env.id);
  };

  const patch = (next: Environment) => repo.saveEnvironment(next);

  return (
    <div className="grid min-h-full grid-cols-1 gap-3 p-3 md:h-full md:grid-cols-[260px_minmax(0,1fr)]">
      <Panel title="Environments" actions={<Button size="icon" variant="ghost" aria-label="New environment" onClick={create}><Plus size={14} /></Button>}>
        <ul className="flex flex-col gap-0.5 p-2" aria-label="Environments list">
          {envs?.map((e) => (
            <li key={e.id}>
              <button onClick={() => setSelectedId(e.id)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12.5px] ${current?.id === e.id ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'}`}>
                <span className="truncate">{e.name}</span>
                {prefs?.activeEnvironmentId === e.id && <Check size={13} className="text-ok" aria-label="Active" />}
              </button>
            </li>
          ))}
          {envs?.length === 0 && <li className="p-2 text-[12.5px] text-muted">No environments yet.</li>}
        </ul>
      </Panel>

      {!current ? (
        <Empty icon={<Plus size={28} />} title="No environment selected" body="Environments hold variables such as {{baseUrl}} that requests can reference." />
      ) : (
        <Panel
          title={current.name}
          className="min-h-[24rem] md:min-h-0"
          actions={
            <>
              <Button size="sm" variant={prefs?.activeEnvironmentId === current.id ? 'secondary' : 'ghost'} onClick={() => repo.savePreferences({ activeEnvironmentId: prefs?.activeEnvironmentId === current.id ? null : current.id })}>
                {prefs?.activeEnvironmentId === current.id ? 'Active' : 'Set active'}
              </Button>
              <Button size="sm" variant="danger" onClick={async () => { await db.environments.delete(current.id); setSelectedId(null); }}>
                <Trash2 size={13} /> Delete
              </Button>
            </>
          }
        >
          <div className="flex h-full flex-col gap-3 p-3">
            <Input aria-label="Environment name" value={current.name} onChange={(e) => patch({ ...current, name: e.target.value })} className="max-w-sm" />
            <Notice>
              Values marked as secret are kept in this browser&apos;s IndexedDB and are not masked from anyone who can use this device.
              Do not store production credentials on a shared computer.
            </Notice>
            <div className="flex flex-col gap-1.5">
              {current.variables.map((v) => (
                <div key={v.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)_auto_auto]">
                  <input type="checkbox" aria-label={`Enable ${v.key}`} checked={v.enabled} onChange={(e) => patch({ ...current, variables: current.variables.map((x) => x.id === v.id ? { ...x, enabled: e.target.checked } : x) })} />
                  <Input aria-label="Variable name" placeholder="baseUrl" value={v.key} onChange={(e) => patch({ ...current, variables: current.variables.map((x) => x.id === v.id ? { ...x, key: e.target.value } : x) })} />
                  <Input aria-label="Variable value" type={v.secret ? 'password' : 'text'} autoComplete="off" value={v.value} onChange={(e) => patch({ ...current, variables: current.variables.map((x) => x.id === v.id ? { ...x, value: e.target.value } : x) })} />
                  <label className="flex items-center gap-1 text-[11.5px] text-muted"><input type="checkbox" checked={v.secret} onChange={(e) => patch({ ...current, variables: current.variables.map((x) => x.id === v.id ? { ...x, secret: e.target.checked } : x) })} /> Secret</label>
                  <Button size="icon" variant="ghost" aria-label="Remove variable" onClick={() => patch({ ...current, variables: current.variables.filter((x) => x.id !== v.id) })}><Trash2 size={13} /></Button>
                </div>
              ))}
              <div>
                <Button size="sm" variant="ghost" onClick={() => patch({ ...current, variables: [...current.variables, { id: newId(), key: '', value: '', secret: false, enabled: true }] })}>
                  <Plus size={13} /> Add variable
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

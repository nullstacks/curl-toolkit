import { useState } from 'react';
import { Lock, Send, Square } from 'lucide-react';
import { METHODS, type AuthConfig, type BodyType, type KV, type MultipartField, type RequestModel } from '../types';
import { KeyValueEditor } from './KeyValueEditor';
import { CodeEditor } from './CodeEditor';
import { Button, Input, Notice, Select } from './ui';
import { findVariables } from '../lib/utils';
import { cn } from '../lib/cn';

type Section = 'params' | 'headers' | 'cookies' | 'auth' | 'body' | 'settings';
const SECTIONS: Array<[Section, string]> = [
  ['params', 'Params'],
  ['headers', 'Headers'],
  ['cookies', 'Cookies'],
  ['auth', 'Auth'],
  ['body', 'Body'],
  ['settings', 'Settings'],
];

const SECRET_KEY = /(authorization|token|secret|password|api[-_]?key|cookie)/i;

interface Props {
  request: RequestModel;
  onChange: (patch: Partial<RequestModel>) => void;
  onSend: () => void;
  onCancel: () => void;
  running: boolean;
  variables: Record<string, string>;
  counts: Partial<Record<Section, number>>;
}

export function RequestEditor({ request, onChange, onSend, onCancel, running, variables, counts }: Props) {
  const [section, setSection] = useState<Section>('params');
  const unresolved = findVariables(request.url).filter((v) => !(v in variables));
  const methodIsCustom = !(METHODS as readonly string[]).includes(request.method);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        <Select
          aria-label="HTTP method"
          value={methodIsCustom ? '__custom' : request.method}
          onChange={(e) => onChange({ method: e.target.value === '__custom' ? 'PROPFIND' : e.target.value })}
          className="w-[104px] font-mono font-medium max-md:h-9"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
          <option value="__custom">CUSTOM</option>
        </Select>
        {methodIsCustom && (
          <Input
            aria-label="Custom HTTP method"
            value={request.method}
            onChange={(e) => onChange({ method: e.target.value.toUpperCase().replace(/[^A-Z!#$%&'*+.^_`|~-]/g, '') })}
            className="w-28 font-mono"
          />
        )}
        <Input
          aria-label="Request URL"
          placeholder="https://api.example.com/resource or {{baseUrl}}/resource"
          value={request.url}
          onChange={(e) => onChange({ url: e.target.value })}
          className="order-last h-8 min-w-0 basis-full font-mono max-md:h-9 sm:order-none sm:basis-auto sm:flex-1"
        />
        {running ? (
          <Button variant="danger" onClick={onCancel} aria-label="Cancel request">
            <Square size={13} /> Cancel
          </Button>
        ) : (
          <Button variant="primary" onClick={onSend} aria-keyshortcuts="Control+Enter Meta+Enter">
            <Send size={13} /> Send
          </Button>
        )}
      </div>

      {unresolved.length > 0 && (
        <div className="px-2 pt-2">
          <Notice tone="warn">
            Variables not set in the active environment: {unresolved.map((v) => `{{${v}}}`).join(', ')}
          </Notice>
        </div>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-border px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Request sections">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={cn(
              'relative -mb-px shrink-0 border-b-2 px-2.5 py-2.5 text-[12.5px] transition-colors md:py-2',
              section === id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {label}
            {counts[id] ? <span className="ml-1 font-mono text-[10.5px] text-muted">{counts[id]}</span> : null}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-auto">
        {section === 'params' && (
          <KeyValueEditor label="Query parameter" rows={request.params} onChange={(params) => onChange({ params })} keyPlaceholder="name" />
        )}
        {section === 'headers' && (
          <KeyValueEditor label="Header" rows={request.headers} onChange={(headers) => onChange({ headers })} keyPlaceholder="Header-Name" secretKeys={SECRET_KEY} />
        )}
        {section === 'cookies' && (
          <KeyValueEditor label="Cookie" rows={request.cookies} onChange={(cookies) => onChange({ cookies })} keyPlaceholder="name" secretKeys={SECRET_KEY} />
        )}
        {section === 'auth' && <AuthEditor auth={request.auth} onChange={(auth) => onChange({ auth })} />}
        {section === 'body' && (
          <BodyEditor
            request={request}
            onChange={onChange}
          />
        )}
        {section === 'settings' && (
          <div className="flex flex-col gap-4 p-3 text-[12.5px]">
            <label className="flex items-center gap-2">
              <span className="w-40 text-muted">Timeout (seconds)</span>
              <Input
                type="number"
                min={1}
                max={600}
                aria-label="Timeout in seconds"
                value={Math.round(request.timeoutMs / 1000)}
                onChange={(e) => onChange({ timeoutMs: Math.min(600, Math.max(1, Number(e.target.value) || 1)) * 1000 })}
                className="w-28"
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={request.followRedirects} onChange={(e) => onChange({ followRedirects: e.target.checked })} />
              Follow redirects
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={request.sendCredentials} onChange={(e) => onChange({ sendCredentials: e.target.checked })} />
              Send cookies with cross-site requests (credentials: include)
            </label>
            <p className="max-w-prose text-muted">
              Browsers hide the response of a cross-origin request unless the server allows it. Credentials mode also requires the server to send
              Access-Control-Allow-Credentials with a specific origin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthEditor({ auth, onChange }: { auth: AuthConfig; onChange: (a: AuthConfig) => void }) {
  const set = (patch: Partial<AuthConfig>) => onChange({ ...auth, ...patch });
  return (
    <div className="flex flex-col gap-3 p-3 text-[12.5px]">
      <label className="flex items-center gap-2">
        <span className="w-28 text-muted">Type</span>
        <Select aria-label="Auth type" value={auth.type} onChange={(e) => set({ type: e.target.value as AuthConfig['type'] })}>
          <option value="none">No auth</option>
          <option value="basic">Basic</option>
          <option value="bearer">Bearer token</option>
          <option value="apikey">API key</option>
        </Select>
      </label>
      {auth.type === 'basic' && (
        <>
          <label className="flex items-center gap-2"><span className="w-28 text-muted">Username</span><Input value={auth.username} onChange={(e) => set({ username: e.target.value })} /></label>
          <label className="flex items-center gap-2"><span className="w-28 text-muted">Password</span><Input type="password" autoComplete="off" value={auth.password} onChange={(e) => set({ password: e.target.value })} /></label>
        </>
      )}
      {auth.type === 'bearer' && (
        <label className="flex items-center gap-2"><span className="w-28 text-muted">Token</span><Input type="password" autoComplete="off" value={auth.token} onChange={(e) => set({ token: e.target.value })} /></label>
      )}
      {auth.type === 'apikey' && (
        <>
          <label className="flex items-center gap-2"><span className="w-28 text-muted">Key name</span><Input value={auth.apiKeyName} onChange={(e) => set({ apiKeyName: e.target.value })} /></label>
          <label className="flex items-center gap-2"><span className="w-28 text-muted">Key value</span><Input type="password" autoComplete="off" value={auth.apiKeyValue} onChange={(e) => set({ apiKeyValue: e.target.value })} /></label>
          <label className="flex items-center gap-2">
            <span className="w-28 text-muted">Add to</span>
            <Select value={auth.apiKeyIn} onChange={(e) => set({ apiKeyIn: e.target.value as 'header' | 'query' })}>
              <option value="header">Header</option>
              <option value="query">Query string</option>
            </Select>
          </label>
        </>
      )}
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <Lock size={12} /> Secrets are masked in history and saved requests unless you choose to keep them.
      </p>
    </div>
  );
}

function BodyEditor({ request, onChange }: { request: RequestModel; onChange: (p: Partial<RequestModel>) => void }) {
  const types: Array<[BodyType, string]> = [
    ['none', 'None'],
    ['json', 'JSON'],
    ['raw', 'Raw text'],
    ['form-urlencoded', 'Form URL-encoded'],
    ['multipart', 'Multipart form'],
  ];
  const setMultipart = (rows: MultipartField[]) => onChange({ multipart: rows });

  return (
    <div className="flex flex-col gap-3 p-3">
      <div role="radiogroup" aria-label="Body type" className="flex flex-wrap gap-1">
        {types.map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={request.bodyType === id ? 'secondary' : 'ghost'}
            role="radio"
            aria-checked={request.bodyType === id}
            onClick={() => onChange({ bodyType: id })}
          >
            {label}
          </Button>
        ))}
      </div>

      {(request.bodyType === 'json' || request.bodyType === 'raw') && (
        <div className="h-64 overflow-hidden rounded-md border border-border">
          <CodeEditor
            value={request.body}
            onChange={(body) => onChange({ body })}
            language={request.bodyType === 'json' ? 'json' : 'plaintext'}
            ariaLabel="Request body"
          />
        </div>
      )}
      {request.bodyType === 'form-urlencoded' && (
        <div className="rounded-md border border-border">
          <KeyValueEditor label="Form field" rows={request.formFields} onChange={(formFields: KV[]) => onChange({ formFields })} />
        </div>
      )}
      {request.bodyType === 'multipart' && (
        <MultipartEditor rows={request.multipart} onChange={setMultipart} />
      )}
    </div>
  );
}

function MultipartEditor({ rows, onChange }: { rows: MultipartField[]; onChange: (rows: MultipartField[]) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)_auto] items-center gap-2">
          <Input aria-label="Field name" value={row.key} onChange={(e) => onChange(rows.map((r) => (r.id === row.id ? { ...r, key: e.target.value } : r)))} />
          <Select
            aria-label="Field type"
            value={row.kind}
            onChange={(e) => onChange(rows.map((r) => (r.id === row.id ? { ...r, kind: e.target.value as 'text' | 'file' } : r)))}
          >
            <option value="text">Text</option>
            <option value="file">File</option>
          </Select>
          {row.kind === 'text' ? (
            <Input aria-label="Field value" value={row.value} onChange={(e) => onChange(rows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)))} />
          ) : (
            <label className="flex min-w-0 items-center gap-2 text-[12px] text-muted">
              <input
                type="file"
                aria-label={`Choose file for ${row.key || 'field'}`}
                className="min-w-0 text-[12px] file:mr-2 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-fg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  onChange(rows.map((r) => (r.id === row.id ? { ...r, file: f, fileName: f?.name } : r)));
                }}
              />
              <span className="truncate">{row.fileName ?? 'No file chosen'}</span>
            </label>
          )}
          <Button size="sm" variant="ghost" aria-label={`Remove ${row.key || 'field'}`} onClick={() => onChange(rows.filter((r) => r.id !== row.id))}>
            ×
          </Button>
        </div>
      ))}
      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([
              ...rows,
              { id: crypto.randomUUID(), key: '', value: '', enabled: true, kind: 'text' },
            ])
          }
        >
          + Add field
        </Button>
      </div>
    </div>
  );
}

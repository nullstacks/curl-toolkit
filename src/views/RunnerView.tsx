import { useState } from 'react';
import { Copy, Plus, Save, Send, X } from 'lucide-react';
import { useAppStore, type Tab } from '../store/appStore';
import { RequestEditor } from '../components/RequestEditor';
import { ResponseInspector } from '../components/ResponseInspector';
import { Splitter } from '../components/Splitter';
import { useActiveVariables, useRunner } from '../hooks/useRunner';
import { Button, Empty, Notice } from '../components/ui';
import { SaveDialog } from '../components/SaveDialog';

export function RunnerView() {
  const tabs = useAppStore((s) => s.tabs);
  const activeId = useAppStore((s) => s.activeTabId);
  const openTab = useAppStore((s) => s.openTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const duplicateTab = useAppStore((s) => s.duplicateTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const tab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface px-2" role="tablist" aria-label="Open requests">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`group flex h-9 max-w-[200px] shrink-0 items-center gap-2 border-b-2 px-2.5 ${t.id === tab?.id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`}
          >
            <button role="tab" aria-selected={t.id === tab?.id} className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px]" onClick={() => setActiveTab(t.id)}>
              <span className="font-mono text-[10.5px] text-accent">{t.request.method}</span>
              <span className="truncate">{t.title || 'Untitled'}</span>
            </button>
            <button aria-label={`Close ${t.title}`} onClick={() => closeTab(t.id)} className="rounded p-0.5 opacity-0 hover:bg-surface-2 group-hover:opacity-100 focus:opacity-100">
              <X size={12} />
            </button>
          </div>
        ))}
        <Button size="icon" variant="ghost" aria-label="New request tab" onClick={() => openTab()}>
          <Plus size={14} />
        </Button>
        {tab && (
          <Button size="icon" variant="ghost" aria-label="Duplicate request" onClick={() => duplicateTab(tab.id)} className="ml-auto">
            <Copy size={13} />
          </Button>
        )}
      </div>

      {tab ? <TabWorkspace key={tab.id} tab={tab} /> : <Empty icon={<Send />} title="No requests open" body="Open a new tab to build a request." />}
    </div>
  );
}

function TabWorkspace({ tab }: { tab: Tab }) {
  const updateRequest = useAppStore((s) => s.updateRequest);
  const variables = useActiveVariables();
  const { send, cancel, running } = useRunner(tab);
  const [saving, setSaving] = useState(false);
  const req = tab.request;

  const counts = {
    params: req.params.filter((p) => p.enabled && p.key).length,
    headers: req.headers.filter((h) => h.enabled && h.key).length,
    cookies: req.cookies.filter((c) => c.enabled && c.key).length,
    body: req.bodyType === 'none' ? 0 : 1,
  };

  return (
    <div
      className="min-h-0 flex-1 p-2"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          if (!running) send();
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          setSaving(true);
        }
      }}
    >
      <div className="flex items-center justify-end gap-2 pb-2">
        <Button size="sm" variant="ghost" onClick={() => setSaving(true)} aria-keyshortcuts="Control+S Meta+S">
          <Save size={13} /> Save
        </Button>
      </div>
      <div className="h-[calc(100%-2.25rem)] overflow-hidden rounded-lg border border-border bg-surface">
        <Splitter
          direction="vertical"
          initial={48}
          label="Resize request and response panels"
          first={
            <RequestEditor
              request={req}
              onChange={(patch) => updateRequest(tab.id, patch)}
              onSend={send}
              onCancel={cancel}
              running={running}
              variables={variables}
              counts={counts}
            />
          }
          second={
            <div className="h-full p-2">
              <ResponseInspector run={tab.run} />
            </div>
          }
        />
      </div>
      {saving && <SaveDialog tab={tab} onClose={() => setSaving(false)} />}
      {tab.run.status === 'done' && tab.run.outcome?.status === 0 && (
        <div className="pt-2">
          <Notice tone="warn">Response status 0 usually means a network or CORS failure, or a redirect that was not followed.</Notice>
        </div>
      )}
    </div>
  );
}

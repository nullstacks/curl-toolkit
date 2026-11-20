import { useMemo, useState } from 'react';
import { Copy, Download, Search } from 'lucide-react';
import type { RunState } from '../store/appStore';
import { CodeEditor } from './CodeEditor';
import { Badge, Button, Input, Notice, Panel } from './ui';
import { formatBytes, formatJson, formatXml, monacoLanguageFor, responseExtension, statusTone } from '../lib/http/response';
import { copyText, downloadBlob } from '../lib/utils';

type Pane = 'body' | 'headers' | 'preview';

export function ResponseInspector({ run }: { run: RunState }) {
  const [pane, setPane] = useState<Pane>('body');
  const [pretty, setPretty] = useState(true);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const outcome = run.outcome;
  const display = useMemo(() => {
    if (!outcome?.text) return '';
    if (outcome.kind === 'json' && pretty) return formatJson(outcome.text) ?? outcome.text;
    if (outcome.kind === 'xml' && pretty) return formatXml(outcome.text);
    return outcome.text;
  }, [outcome, pretty]);

  const matchCount = useMemo(() => {
    if (!query || !display) return 0;
    return display.toLowerCase().split(query.toLowerCase()).length - 1;
  }, [display, query]);

  if (run.status === 'idle') {
    return (
      <Panel title="Response">
        <p className="p-4 text-[12.5px] text-muted">Send a request to see its response here.</p>
      </Panel>
    );
  }

  if (run.status === 'running') {
    return (
      <Panel title="Response">
        <div className="p-4 text-[12.5px] text-muted" role="status">Waiting for the server…</div>
      </Panel>
    );
  }

  if (run.status === 'error' && run.error) {
    return (
      <Panel title="Response">
        <div className="p-4">
          <Notice tone="danger" title={run.error.message}>
            {run.error.hint && <p>{run.error.hint}</p>}
            {run.error.kind === 'network' && (
              <p className="mt-1">
                Check the URL, that the server is running, and that it returns CORS headers for this page&apos;s origin.
              </p>
            )}
          </Notice>
        </div>
      </Panel>
    );
  }

  if (!outcome) return null;
  const ext = responseExtension(outcome.contentType, outcome.kind);
  const fileName = `response.${ext}`;

  const copy = async () => {
    if (display && (await copyText(display))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <Panel
      title="Response"
      actions={
        <>
          <Badge tone={statusTone(outcome.status)}>{outcome.status || '—'} {outcome.statusText}</Badge>
          <Badge>{Math.round(outcome.durationMs)} ms</Badge>
          <Badge>{formatBytes(outcome.sizeBytes)}</Badge>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
          {(['body', 'headers', 'preview'] as Pane[]).map((p) => (
            <Button key={p} size="sm" variant={pane === p ? 'secondary' : 'ghost'} onClick={() => setPane(p)} aria-pressed={pane === p}>
              {p === 'body' ? 'Body' : p === 'headers' ? `Headers (${outcome.headers.length})` : 'Preview'}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-2.5 text-muted" />
              <Input
                aria-label="Search response"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-7 w-36 pl-6 text-xs"
              />
            </div>
            {query && <span className="text-[11px] text-muted">{matchCount} match{matchCount === 1 ? '' : 'es'}</span>}
            {(outcome.kind === 'json' || outcome.kind === 'xml') && (
              <Button size="sm" variant="ghost" onClick={() => setPretty((p) => !p)} aria-pressed={pretty}>
                {pretty ? 'Pretty' : 'Raw'}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={copy} aria-label="Copy response body">
              <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Download response body"
              onClick={() => {
                const data: BlobPart = outcome.text !== null ? outcome.text : outcome.bytes;
                downloadBlob(data, outcome.contentType || 'application/octet-stream', fileName);
              }}
            >
              <Download size={13} /> Download
            </Button>
          </div>
        </div>

        {outcome.redirected && <p className="px-3 pt-2 text-[12px] text-muted">Followed redirect to {outcome.url}</p>}
        {outcome.opaqueRedirect && (
          <div className="p-3">
            <Notice tone="warn" title="Redirect not followed">
              Turn on &quot;Follow redirects&quot; in request settings to fetch the final response.
            </Notice>
          </div>
        )}
        {outcome.ignoredHeaders.length > 0 && (
          <div className="p-3 pb-0">
            <Notice tone="warn" title="Some headers were not sent">
              Browsers do not allow scripts to set {outcome.ignoredHeaders.join(', ')}. Your browser set these itself or dropped them.
            </Notice>
          </div>
        )}

        {pane === 'body' && (
          <div className="min-h-0 flex-1">
            {outcome.kind === 'image' ? (
              <div className="flex h-full items-center justify-center p-4">
                <img
                  src={URL.createObjectURL(new Blob([outcome.bytes], { type: outcome.contentType }))}
                  alt="Response image"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : outcome.text === null ? (
              <p className="p-4 text-[12.5px] text-muted">Binary response ({formatBytes(outcome.sizeBytes)}). Use Download to save it.</p>
            ) : (
              <CodeEditor value={display} language={monacoLanguageFor(outcome.kind)} readOnly ariaLabel="Response body" />
            )}
          </div>
        )}

        {pane === 'headers' && (
          <div className="overflow-auto p-3">
            <table className="w-full text-left text-[12.5px]">
              <thead className="text-muted">
                <tr>
                  <th className="pb-1.5 font-medium">Name</th>
                  <th className="pb-1.5 font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {outcome.headers.map(([k, v]) => (
                  <tr key={k} className="border-t border-border/60 align-top">
                    <td className="py-1 pr-4 text-accent">{k}</td>
                    <td className="break-all py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11.5px] text-muted">
              Browsers only expose CORS-safelisted headers. Other headers the server sent are hidden unless it lists them in Access-Control-Expose-Headers.
            </p>
          </div>
        )}

        {pane === 'preview' && (
          <div className="min-h-0 flex-1">
            {outcome.kind === 'html' && outcome.text !== null ? (
              <iframe
                title="HTML preview"
                sandbox=""
                srcDoc={outcome.text}
                className="h-full w-full border-0 bg-white"
              />
            ) : (
              <p className="p-4 text-[12.5px] text-muted">HTML preview is available for HTML responses only.</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

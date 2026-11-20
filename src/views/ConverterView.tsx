import { useMemo, useState } from 'react';
import { Copy, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CodeEditor } from '../components/CodeEditor';
import { Splitter } from '../components/Splitter';
import { Button, Notice, Panel, Select, Badge } from '../components/ui';
import { parseCurl } from '../lib/curl/parser';
import { GENERATORS, generateCode, type LanguageId } from '../lib/codegen/generators';
import { useAppStore } from '../store/appStore';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { copyText, downloadBlob } from '../lib/utils';

const SAMPLE = `curl -X POST 'https://api.example.com/v1/items' \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json' \\
  -u 'demo:secret' \\
  -d '{"name":"Widget","price":9.99}'`;

export function ConverterView() {
  const input = useAppStore((s) => s.converterInput);
  const setInput = useAppStore((s) => s.setConverterInput);
  const language = useAppStore((s) => s.converterLanguage);
  const setLanguage = useAppStore((s) => s.setConverterLanguage);
  const loadIntoRunner = useAppStore((s) => s.loadIntoRunner);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => parseCurl(input), [input]);
  const generated = useMemo(() => {
    if (!parsed.request) return '';
    try {
      return generateCode(parsed.request, language);
    } catch (err) {
      return `// Could not generate ${language}: ${err instanceof Error ? err.message : 'unknown error'}`;
    }
  }, [parsed, language]);

  const isDesktop = useIsDesktop();
  const gen = GENERATORS.find((g) => g.info.id === language);
  const groups = ['Shell', 'Scripting', 'Compiled', 'Mobile', 'Data'] as const;

  const copy = async () => {
    if (await copyText(generated)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2 md:p-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex w-full items-center gap-2 text-[12.5px] text-muted sm:w-auto">
          Output
          <Select aria-label="Output language" value={language} onChange={(e) => setLanguage(e.target.value as LanguageId)} className="min-w-0 flex-1 sm:min-w-[200px] sm:flex-none">
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {GENERATORS.filter((x) => x.info.group === g).map((x) => (
                  <option key={x.info.id} value={x.info.id}>{x.info.label}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </label>
        <div className="flex w-full gap-1.5 sm:ml-auto sm:w-auto">
          <Button size="sm" variant="ghost" onClick={() => setInput(SAMPLE)}>Load example</Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!parsed.request}
            onClick={() => parsed.request && loadIntoRunner(parsed.request, parsed.request.url)}
          >
            Open in Runner
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface">
        <Splitter
          direction={isDesktop ? 'horizontal' : 'vertical'}
          initial={isDesktop ? 45 : 40}
          label="Resize input and output panels"
          first={
            <Panel title="cURL command" actions={<Button size="sm" variant="ghost" onClick={() => setInput('')} disabled={!input}>Clear</Button>} className="h-full rounded-none border-0">
              <div className="h-full">
                <CodeEditor value={input} onChange={setInput} language="shell" ariaLabel="cURL command input" />
              </div>
            </Panel>
          }
          second={
            <Panel
              title={gen ? gen.info.label : 'Output'}
              className="h-full rounded-none border-0"
              actions={
                <>
                  <Button size="sm" variant="ghost" onClick={copy} disabled={!generated} aria-label="Copy generated code">
                    <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!generated}
                    aria-label="Download generated code"
                    onClick={() => gen && downloadBlob(generated, 'text/plain', `request.${gen.info.extension}`)}
                  >
                    <Download size={13} /> Download
                  </Button>
                </>
              }
            >
              <div className="flex h-full min-h-0 flex-col">
                <ConverterStatus errors={parsed.errors} warnings={parsed.warnings} unsupported={parsed.unsupported} empty={input.trim() === ''} />
                <div className="min-h-0 flex-1">
                  {parsed.request ? (
                    <CodeEditor value={generated} language={monacoFor(language)} readOnly ariaLabel="Generated code" />
                  ) : (
                    <p className="p-4 text-[12.5px] text-muted">Paste a cURL command on the left. Output appears here as you type.</p>
                  )}
                </div>
              </div>
            </Panel>
          }
        />
      </div>
      <p className="text-[11.5px] text-muted">
        Parsing and code generation run entirely in your browser. Nothing you paste is sent to any server.
      </p>
    </div>
  );
}

function ConverterStatus({ errors, warnings, unsupported, empty }: { errors: string[]; warnings: string[]; unsupported: Array<{ option: string; reason: string }>; empty: boolean }) {
  if (empty) return null;
  if (errors.length === 0 && warnings.length === 0 && unsupported.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12px] text-ok">
        <CheckCircle2 size={14} /> Parsed without issues.
      </div>
    );
  }
  return (
    <div className="flex max-h-44 flex-col gap-2 overflow-auto border-b border-border p-3 text-[12px]">
      {errors.map((e) => (
        <Notice key={e} tone="danger" title="Parse error">{e}</Notice>
      ))}
      {unsupported.length > 0 && (
        <Notice tone="warn" title="Unsupported options (ignored)">
          <ul className="mt-1 flex flex-col gap-1">
            {unsupported.map((u) => (
              <li key={u.option} className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">{u.option}</Badge>
                <span>{u.reason}</span>
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-1 text-muted">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0 text-warn" />{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function monacoFor(language: LanguageId): string {
  switch (language) {
    case 'python': return 'python';
    case 'javascript':
    case 'node': return 'javascript';
    case 'go': return 'go';
    case 'php': return 'php';
    case 'ruby': return 'ruby';
    case 'java':
    case 'kotlin': return 'java';
    case 'csharp': return 'csharp';
    case 'rust': return 'rust';
    case 'swift': return 'swift';
    case 'dart': return 'dart';
    case 'powershell': return 'powershell';
    case 'har': return 'json';
    case 'raw': return 'plaintext';
    default: return 'shell';
  }
}

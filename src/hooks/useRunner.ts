import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/storage/db';
import { executeRequest, RunError } from '../lib/http/runner';
import { repo } from '../lib/storage/repository';
import { inFlight, useAppStore, type Tab } from '../store/appStore';

/** Variables from the active environment, with disabled rows removed. */
export function useActiveVariables(): Record<string, string> {
  const envs = useLiveQuery(() => db.environments.toArray(), [], []);
  const active = useLiveQuery(() => repo.getPreferences(), [], null);
  return useMemo(() => {
    const env = envs?.find((e) => e.id === active?.activeEnvironmentId);
    const vars: Record<string, string> = {};
    for (const v of env?.variables ?? []) if (v.enabled && v.key) vars[v.key] = v.value;
    return vars;
  }, [envs, active]);
}

/** Runs a tab's request, records the outcome in state, and writes a history entry. */
export function useRunner(tab: Tab | undefined) {
  const setRun = useAppStore((s) => s.setRun);
  const vars = useActiveVariables();

  const send = useCallback(async () => {
    if (!tab) return;
    const controller = new AbortController();
    inFlight.set(tab.id, controller);
    setRun(tab.id, { status: 'running', outcome: null, error: null, startedAt: Date.now() });
    try {
      const outcome = await executeRequest(tab.request, { vars, signal: controller.signal });
      setRun(tab.id, { status: 'done', outcome, error: null, startedAt: null });
      void repo.addHistory(tab.request, { status: outcome.status, durationMs: outcome.durationMs, error: null });
    } catch (err) {
      const e = err instanceof RunError ? err : new RunError('network', String(err));
      setRun(tab.id, {
        status: 'error',
        outcome: null,
        error: { kind: e.kind, message: e.message, hint: e.hint },
        startedAt: null,
      });
      void repo.addHistory(tab.request, { status: null, durationMs: null, error: e.message });
    } finally {
      inFlight.delete(tab.id);
    }
  }, [tab, vars, setRun]);

  const cancel = useCallback(() => {
    if (tab) inFlight.get(tab.id)?.abort();
  }, [tab]);

  return { send, cancel, running: tab?.run.status === 'running' };
}


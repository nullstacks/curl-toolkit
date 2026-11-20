import { create } from 'zustand';
import { cloneRequest, emptyRequest, newId, type RequestModel } from '../types';
import type { RunOutcome } from '../lib/http/runner';
import type { RunError } from '../lib/http/runner';
import type { LanguageId } from '../lib/codegen/generators';

export type View = 'converter' | 'runner' | 'history' | 'collections' | 'environments' | 'settings';

export interface RunState {
  status: 'idle' | 'running' | 'done' | 'error';
  outcome: RunOutcome | null;
  error: { kind: string; message: string; hint?: string } | null;
  startedAt: number | null;
}

export interface Tab {
  id: string;
  title: string;
  request: RequestModel;
  savedId: string | null;
  run: RunState;
}

const idleRun = (): RunState => ({ status: 'idle', outcome: null, error: null, startedAt: null });

export function makeTab(request: RequestModel = emptyRequest(), title = 'Untitled'): Tab {
  return { id: newId(), title, request, savedId: null, run: idleRun() };
}

/** Abort controllers are not serialisable, so they live outside the store. */
export const inFlight = new Map<string, AbortController>();

interface AppState {
  view: View;
  tabs: Tab[];
  activeTabId: string;
  converterInput: string;
  converterLanguage: LanguageId;
  commandPaletteOpen: boolean;

  setView(view: View): void;
  openTab(request?: RequestModel, title?: string): string;
  closeTab(id: string): void;
  duplicateTab(id: string): void;
  setActiveTab(id: string): void;
  updateRequest(tabId: string, patch: Partial<RequestModel>): void;
  renameTab(tabId: string, title: string): void;
  linkSaved(tabId: string, savedId: string | null): void;
  setRun(tabId: string, run: RunState): void;
  setConverterInput(text: string): void;
  setConverterLanguage(language: LanguageId): void;
  setCommandPalette(open: boolean): void;
  loadIntoRunner(request: RequestModel, title?: string): void;
}

export const useAppStore = create<AppState>((set, get) => {
  const first = makeTab();
  return {
    view: 'converter',
    tabs: [first],
    activeTabId: first.id,
    converterInput: '',
    converterLanguage: 'curl',
    commandPaletteOpen: false,

    setView: (view) => set({ view }),

    openTab(request, title) {
      const tab = makeTab(request ? cloneRequest(request) : emptyRequest(), title ?? request?.url ?? 'Untitled');
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
      return tab.id;
    },

    closeTab(id) {
      const { tabs, activeTabId } = get();
      inFlight.get(id)?.abort();
      inFlight.delete(id);
      const remaining = tabs.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const fresh = makeTab();
        set({ tabs: [fresh], activeTabId: fresh.id });
        return;
      }
      const nextActive =
        activeTabId === id ? (remaining[Math.max(0, tabs.findIndex((t) => t.id === id) - 1)]?.id ?? remaining[0]!.id) : activeTabId;
      set({ tabs: remaining, activeTabId: nextActive });
    },

    duplicateTab(id) {
      const src = get().tabs.find((t) => t.id === id);
      if (!src) return;
      const copy = makeTab(cloneRequest(src.request), `${src.title} copy`);
      set((s) => {
        const idx = s.tabs.findIndex((t) => t.id === id);
        const tabs = [...s.tabs];
        tabs.splice(idx + 1, 0, copy);
        return { tabs, activeTabId: copy.id };
      });
    },

    setActiveTab: (id) => set({ activeTabId: id, view: 'runner' }),

    updateRequest(tabId, patch) {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, request: { ...t.request, ...patch } } : t)),
      }));
    },

    renameTab: (tabId, title) =>
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)) })),

    linkSaved: (tabId, savedId) =>
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, savedId } : t)) })),

    setRun: (tabId, run) =>
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, run } : t)) })),

    setConverterInput: (converterInput) => set({ converterInput }),
    setConverterLanguage: (converterLanguage) => set({ converterLanguage }),
    setCommandPalette: (commandPaletteOpen) => set({ commandPaletteOpen }),

    loadIntoRunner(request, title) {
      const id = get().openTab(request, title);
      set({ activeTabId: id, view: 'runner' });
    },
  };
});

export type { RunError };

import { useEffect, type ReactNode } from 'react';
import { useAppStore, type View } from './store/appStore';
import { useUiStore } from './store/uiStore';
import { repo } from './lib/storage/repository';
import { Sidebar } from './components/Sidebar';
import { shortcutAction } from './lib/shortcuts';
import { ConverterView } from './views/ConverterView';
import { RunnerView } from './views/RunnerView';
import { HistoryView } from './views/HistoryView';
import { CollectionsView } from './views/CollectionsView';
import { EnvironmentsView } from './views/EnvironmentsView';
import { SettingsView } from './views/SettingsView';

const VIEW_ORDER: View[] = ['converter', 'runner', 'history', 'collections', 'environments', 'settings'];

export default function App() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const openTab = useAppStore((s) => s.openTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const duplicateTab = useAppStore((s) => s.duplicateTab);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setPreferences = useUiStore((s) => s.setPreferences);
  const theme = useUiStore((s) => s.preferences.theme);

  useEffect(() => {
    let cancelled = false;
    repo
      .getPreferences()
      .then((p) => {
        if (!cancelled) setPreferences(p);
      })
      .catch(() => {
        // IndexedDB can be blocked (private modes, storage disabled). The app still works without it.
        if (!cancelled) setPreferences(useUiStore.getState().preferences);
      });
    return () => {
      cancelled = true;
    };
  }, [setPreferences]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutAction(e);
      if (!action) return;
      // Avoid stealing shortcuts from Monaco when it is focused, except Send and Save.
      const inMonaco = (e.target as HTMLElement | null)?.closest?.('.monaco-editor') !== null && action !== 'send' && action !== 'save';
      if (inMonaco) return;
      if (action === 'send' || action === 'save') return; // handled inside the Runner view
      e.preventDefault();
      if (action === 'new-tab') {
        openTab();
        setView('runner');
      } else if (action === 'close-tab') {
        closeTab(activeTabId);
      } else if (action === 'duplicate') {
        duplicateTab(activeTabId);
      } else if (action.startsWith('view-')) {
        const v = VIEW_ORDER[Number(action.slice(5)) - 1];
        if (v) setView(v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTab, closeTab, duplicateTab, setView, activeTabId]);

  const pages: Record<View, ReactNode> = {
    converter: <ConverterView />,
    runner: <RunnerView />,
    history: <HistoryView />,
    collections: <CollectionsView />,
    environments: <EnvironmentsView />,
    settings: <SettingsView />,
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      <Sidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden" aria-label={view}>
        {pages[view]}
      </main>
    </div>
  );
}

import { Binary, Clock, FolderKanban, Globe, Play, Settings as SettingsIcon, Terminal } from 'lucide-react';
import type { View } from '../store/appStore';
import { useAppStore } from '../store/appStore';
import { cn } from '../lib/cn';

export const NAV: Array<{ id: View; label: string; icon: typeof Terminal }> = [
  { id: 'converter', label: 'Converter', icon: Terminal },
  { id: 'runner', label: 'Runner', icon: Play },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'collections', label: 'Collections', icon: FolderKanban },
  { id: 'environments', label: 'Environments', icon: Globe },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  return (
    <nav aria-label="Main" className="flex w-full shrink-0 items-center gap-1 border-b border-border bg-surface p-2 md:h-full md:w-52 md:flex-col md:items-stretch md:border-b-0 md:border-r md:p-3">
      <div className="mb-3 hidden items-center gap-2 px-2 md:flex">
        <Binary size={16} className="text-accent" />
        <span className="text-[13px] font-semibold tracking-tight">cURL Toolkit</span>
      </div>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors',
              active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
            )}
          >
            <Icon size={15} className={active ? 'text-accent' : ''} />
            <span>{item.label}</span>
          </button>
        );
      })}
      <p className="mt-auto hidden px-2 pt-4 text-[11px] leading-relaxed text-muted md:block">
        Runs entirely in your browser. No server stores your data.
      </p>
    </nav>
  );
}

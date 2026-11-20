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

/**
 * Desktop: fixed-width left column. Phones: bottom tab bar that respects the home-indicator inset.
 */
export function Sidebar({ className }: { className?: string }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  return (
    <nav
      aria-label="Main"
      className={cn(
        'shrink-0 border-border bg-surface',
        'grid grid-cols-6 border-t pb-[env(safe-area-inset-bottom)]',
        'md:flex md:h-full md:w-52 md:flex-col md:border-r md:border-t-0 md:p-3 md:pb-3',
        className,
      )}
    >
      <div className="mb-3 hidden items-center gap-2 px-2 md:flex">
        <Binary size={16} className="text-accent" aria-hidden="true" />
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
              'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] transition-colors',
              'md:min-h-0 md:flex-row md:justify-start md:gap-2 md:rounded-md md:px-2.5 md:py-1.5 md:text-[12.5px]',
              active ? 'text-fg md:bg-surface-2' : 'text-muted hover:text-fg md:hover:bg-surface-2/60',
            )}
          >
            <Icon size={18} className={cn('md:h-[15px] md:w-[15px]', active && 'text-accent')} aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </button>
        );
      })}
      <p className="mt-auto hidden px-2 pt-4 text-[11px] leading-relaxed text-muted md:block">
        Runs entirely in your browser. No server stores your data.
      </p>
    </nav>
  );
}

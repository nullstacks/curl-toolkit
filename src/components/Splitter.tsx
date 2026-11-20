import { useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface Props {
  direction: 'horizontal' | 'vertical';
  initial: number;
  min?: number;
  max?: number;
  first: ReactNode;
  second: ReactNode;
  label: string;
}

/**
 * Two panels with a draggable divider. `initial` is a percentage of the first panel.
 * Keyboard users can resize with the arrow keys while the divider has focus.
 */
export function Splitter({ direction, initial, min = 20, max = 80, first, second, label }: Props) {
  const [pct, setPct] = useState(initial);
  const container = useRef<HTMLDivElement>(null);
  const horizontal = direction === 'horizontal';

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const box = container.current?.getBoundingClientRect();
    if (!box) return;
    const move = (ev: PointerEvent) => {
      const raw = horizontal ? ((ev.clientX - box.left) / box.width) * 100 : ((ev.clientY - box.top) / box.height) * 100;
      setPct(Math.min(max, Math.max(min, raw)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKey = (e: RKeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1;
    const grow = horizontal ? 'ArrowRight' : 'ArrowDown';
    const shrink = horizontal ? 'ArrowLeft' : 'ArrowUp';
    if (e.key === grow) setPct((p) => Math.min(max, p + step));
    if (e.key === shrink) setPct((p) => Math.max(min, p - step));
  };

  return (
    <div ref={container} className={cn('flex h-full min-h-0 w-full', horizontal ? 'flex-row' : 'flex-col')}>
      <div className="min-h-0 min-w-0 overflow-hidden" style={{ [horizontal ? 'width' : 'height']: `${pct}%` }}>
        {first}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        onPointerDown={onPointerDown}
        onKeyDown={onKey}
        className={cn(
          'touch-none shrink-0 bg-border/70 transition-colors hover:bg-accent/60 focus:bg-accent/60 focus:outline-none',
          horizontal ? 'w-1 cursor-col-resize' : 'h-2 cursor-row-resize md:h-1',
        )}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}

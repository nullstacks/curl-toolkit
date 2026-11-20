/* Local primitives written in the shadcn/ui style (Radix-free). Each is a plain, accessible element. */
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-bg hover:brightness-110',
  secondary: 'border border-border bg-surface-2 text-fg hover:bg-border/60',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'icon' }>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'h-7 px-2 text-xs',
        size === 'md' && 'h-8 px-3 text-[13px]',
        size === 'icon' && 'h-7 w-7 max-md:h-9 max-md:w-9',
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-8 w-full min-w-0 rounded-md border border-border bg-bg px-2.5 text-[16px] text-fg placeholder:text-muted/70 focus:border-accent/60 focus:outline-none md:text-[13px] max-md:h-9',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-8 rounded-md border border-border bg-bg px-2 text-[16px] text-fg focus:border-accent/60 focus:outline-none md:text-[13px] max-md:h-9',
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent' }) {
  const tones = {
    neutral: 'border-border text-muted',
    ok: 'border-ok/40 text-ok',
    warn: 'border-warn/40 text-warn',
    danger: 'border-danger/40 text-danger',
    accent: 'border-accent/40 text-accent',
  } as const;
  return (
    <span className={cn('inline-flex items-center rounded border px-1.5 py-px font-mono text-[11px]', tones[tone])}>{children}</span>
  );
}

export function Notice({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'warn' | 'danger'; title?: string; children?: ReactNode }) {
  const tones = {
    neutral: 'border-border bg-surface-2 text-fg',
    warn: 'border-warn/30 bg-warn/5 text-fg',
    danger: 'border-danger/30 bg-danger/5 text-fg',
  } as const;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-md border px-3 py-2 text-[12.5px] leading-relaxed', tones[tone])}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className="text-muted">{children}</div>}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-muted/70">{icon}</div>
      <div>
        <p className="font-medium text-fg">{title}</p>
        <p className="mt-1 max-w-sm text-[12.5px] text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex min-h-0 flex-col rounded-lg border border-border bg-surface', className)}>
      {(title || actions) && (
        <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <h2 className="text-[12px] font-medium text-muted">{title}</h2>
          <div className="flex items-center gap-1">{actions}</div>
        </header>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10.5px] text-muted">{children}</kbd>;
}

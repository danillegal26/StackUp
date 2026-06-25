import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/utils';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  const t = useT();
  return (
    <div
      className={cn(
        'rounded-2xl border border-hairline/10 bg-felt-light/60 p-5 shadow-lg shadow-black/20 backdrop-blur-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';
  const sizes: Record<string, string> = {
    md: 'px-4 py-3 text-sm min-h-[48px]',
    sm: 'px-3 py-2 text-xs min-h-[40px]',
  };
  const variants: Record<string, string> = {
    // text-coal/text-paper зафиксированы и не зависят от темы — brass и clay
    // в обеих темах подобраны так, чтобы оставаться контрастными именно с ними.
    primary: 'bg-brass text-coal hover:bg-brass-light',
    secondary: 'bg-transparent border border-ivory/30 text-ivory hover:border-ivory/60',
    danger: 'bg-clay text-paper hover:bg-clay-light',
    ghost: 'bg-hairline/5 text-ivory hover:bg-hairline/10',
  };
  return <button className={cn(base, sizes[size], variants[variant], className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-hairline/15 bg-felt-deep/60 px-4 py-3 text-ivory placeholder:text-muted outline-none focus:border-brass min-h-[48px]',
        className
      )}
      {...props}
    />
  );
}

export function Spinner() {
  return (
    <div
      className="h-6 w-6 animate-spin rounded-full border-2 border-ivory/20 border-t-brass"
      role="status"
      aria-label="Загрузка"
    />
  );
}

export function Banner({ kind = 'error', children }: { kind?: 'error' | 'info'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        kind === 'error'
          ? 'border-clay/40 bg-clay/10 text-clay-light'
          : 'border-brass/40 bg-brass/10 text-brass-light'
      )}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

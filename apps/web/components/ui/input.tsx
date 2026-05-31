import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] ' +
          'bg-[var(--bg-surface)] px-3 py-1 ' +
          '[font-size:var(--text-sm)] text-[var(--fg-default)] ' +
          'placeholder:text-[var(--fg-subtle)] ' +
          'transition-colors duration-[var(--motion-duration-quick)] ' +
          'focus-visible:outline-none focus-visible:border-[var(--border-focus)] ' +
          'focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20 ' +
          'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 ' +
    '[font-size:var(--text-xs)] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--bg-muted)] text-[var(--fg-default)]',
        active: 'bg-[var(--color-positive-100)] text-[var(--color-positive-500)]',
        draft: 'bg-[var(--color-warning-500)]/15 text-[var(--color-warning-500)]',
        sold: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
        archived: 'bg-[var(--bg-muted)] text-[var(--fg-subtle)]',
        info: 'bg-[var(--color-info-500)]/15 text-[var(--color-info-500)]',
        negative: 'bg-[var(--color-negative-100)] text-[var(--color-negative-500)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium select-none whitespace-nowrap ' +
    'transition-colors duration-[var(--motion-duration-quick)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-accent-600)] text-[var(--fg-on-accent)] hover:bg-[var(--color-accent-700)]',
        secondary:
          'bg-[var(--bg-muted)] text-[var(--fg-default)] hover:bg-[var(--color-neutral-200)]',
        ghost: 'hover:bg-[var(--bg-muted)] text-[var(--fg-default)]',
        link: 'underline-offset-4 hover:underline text-[var(--color-accent-600)] p-0 h-auto',
        danger: 'bg-[var(--color-negative-500)] text-[var(--fg-on-accent)] hover:opacity-90',
      },
      size: {
        sm: 'h-8  px-3 [font-size:var(--text-sm)]  gap-1.5',
        md: 'h-9  px-4 [font-size:var(--text-md)]  gap-2',
        lg: 'h-11 px-6 [font-size:var(--text-lg)]  gap-2',
        icon: 'h-9  w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

/**
 * EquityLens design token exports for Tailwind config and Recharts theming.
 * All values are CSS var() references — the tokens.css file is the numeric source.
 * Import tokens.css separately (e.g. in globals.css) to make the vars available.
 */

export const colors = {
  // Surfaces
  'bg-page': 'var(--bg-page)',
  'bg-surface': 'var(--bg-surface)',
  'bg-elevated': 'var(--bg-elevated)',
  'bg-muted': 'var(--bg-muted)',
  'bg-overlay': 'var(--bg-overlay)',
  // Foregrounds
  'fg-default': 'var(--fg-default)',
  'fg-muted': 'var(--fg-muted)',
  'fg-subtle': 'var(--fg-subtle)',
  'fg-on-accent': 'var(--fg-on-accent)',
  'fg-positive': 'var(--fg-positive)',
  'fg-negative': 'var(--fg-negative)',
  // Borders
  'border-default': 'var(--border-default)',
  'border-strong': 'var(--border-strong)',
  'border-focus': 'var(--border-focus)',
  // Neutral ramp
  'neutral-0': 'var(--color-neutral-0)',
  'neutral-50': 'var(--color-neutral-50)',
  'neutral-100': 'var(--color-neutral-100)',
  'neutral-200': 'var(--color-neutral-200)',
  'neutral-300': 'var(--color-neutral-300)',
  'neutral-400': 'var(--color-neutral-400)',
  'neutral-500': 'var(--color-neutral-500)',
  'neutral-600': 'var(--color-neutral-600)',
  'neutral-700': 'var(--color-neutral-700)',
  'neutral-800': 'var(--color-neutral-800)',
  'neutral-900': 'var(--color-neutral-900)',
  'neutral-950': 'var(--color-neutral-950)',
  // Accent
  'accent-500': 'var(--color-accent-500)',
  'accent-600': 'var(--color-accent-600)',
  'accent-700': 'var(--color-accent-700)',
  // Semantic
  'positive-500': 'var(--color-positive-500)',
  'positive-100': 'var(--color-positive-100)',
  'negative-500': 'var(--color-negative-500)',
  'negative-100': 'var(--color-negative-100)',
  'warning-500': 'var(--color-warning-500)',
  'info-500': 'var(--color-info-500)',
  // Chart palette (8 series, ordered — do not reorder)
  'chart-1': 'var(--chart-1)',
  'chart-2': 'var(--chart-2)',
  'chart-3': 'var(--chart-3)',
  'chart-4': 'var(--chart-4)',
  'chart-5': 'var(--chart-5)',
  'chart-6': 'var(--chart-6)',
  'chart-7': 'var(--chart-7)',
  'chart-8': 'var(--chart-8)',
} as const;

export const spacing = {
  '1': 'var(--space-1)',
  '2': 'var(--space-2)',
  '3': 'var(--space-3)',
  '4': 'var(--space-4)',
  '5': 'var(--space-5)',
  '6': 'var(--space-6)',
  '7': 'var(--space-7)',
  '8': 'var(--space-8)',
  '9': 'var(--space-9)',
} as const;

export const borderRadius = {
  xs: 'var(--radius-xs)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  pill: 'var(--radius-pill)',
} as const;

export const fontSize = {
  '2xs': ['var(--text-2xs)', { lineHeight: 'var(--leading-snug)' }],
  xs: ['var(--text-xs)', { lineHeight: 'var(--leading-snug)' }],
  sm: ['var(--text-sm)', { lineHeight: 'var(--leading-snug)' }],
  md: ['var(--text-md)', { lineHeight: 'var(--leading-normal)' }],
  lg: ['var(--text-lg)', { lineHeight: 'var(--leading-normal)' }],
  xl: ['var(--text-xl)', { lineHeight: 'var(--leading-snug)' }],
  '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
  '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
  '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-tight)' }],
  '5xl': ['var(--text-5xl)', { lineHeight: 'var(--leading-tight)' }],
} as const;

export const boxShadow = {
  '1': 'var(--shadow-1)',
  '2': 'var(--shadow-2)',
  '3': 'var(--shadow-3)',
  'ring-focus': 'var(--shadow-ring-focus)',
} as const;

export const transitionDuration = {
  instant: 'var(--motion-duration-instant)',
  quick: 'var(--motion-duration-quick)',
  default: 'var(--motion-duration-default)',
  slow: 'var(--motion-duration-slow)',
} as const;

export const transitionTimingFunction = {
  standard: 'var(--motion-ease-standard)',
  emphasized: 'var(--motion-ease-emphasized)',
  spring: 'var(--motion-ease-spring)',
} as const;

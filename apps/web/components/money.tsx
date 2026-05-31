/**
 * Renders a monetary value from bigint cents as AU currency.
 * Uses tabular-nums so columns align in tables.
 */

const AU_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const AU_FORMATTER_CENTS = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface MoneyProps {
  cents: bigint | number;
  /** When true, renders cents with 2 decimal places. Default: false (whole dollars). */
  showCents?: boolean;
  className?: string;
}

export function Money({ cents, showCents = false, className }: MoneyProps) {
  const dollars = Number(cents) / 100;
  const formatted = showCents ? AU_FORMATTER_CENTS.format(dollars) : AU_FORMATTER.format(dollars);
  const isNegative = dollars < 0;

  return (
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums' }}
      aria-label={formatted}
      data-negative={isNegative || undefined}
    >
      {formatted}
    </span>
  );
}

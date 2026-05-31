'use client';

import { useRef } from 'react';

// Chart palette from design tokens — 8 colours, OKLCH-based, WCAG AA on bg-surface.
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];

export interface ChartPalette {
  assign: (seriesId: string) => string;
  get: (seriesId: string) => string | undefined;
}

/** Stable colour assignment: same series ID always gets the same colour within a component lifetime. */
export function useChartPalette(): ChartPalette {
  const mapRef = useRef<Map<string, string>>(new Map());

  return {
    assign(seriesId: string): string {
      if (!mapRef.current.has(seriesId)) {
        const idx = mapRef.current.size % PALETTE.length;
        mapRef.current.set(seriesId, PALETTE[idx]!);
      }
      return mapRef.current.get(seriesId)!;
    },
    get(seriesId: string): string | undefined {
      return mapRef.current.get(seriesId);
    },
  };
}

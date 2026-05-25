'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useChartPalette } from './palette';

export interface ChartSeries<TDatum> {
  id: string;
  key: keyof TDatum & string;
  label: string;
  dashed?: boolean;
  stack?: string;
}

export interface ProjectionMarker {
  fromIndex: number;
}

export type ChartType = 'line' | 'area' | 'stacked-area' | 'bar' | 'stacked-bar';

export interface ChartProps<TDatum extends Record<string, unknown>> {
  data: readonly TDatum[];
  type: ChartType;
  series: ChartSeries<TDatum>[];
  xKey: keyof TDatum & string;
  yLabel?: string;
  marker?: ProjectionMarker;
  height?: number;
  title?: string;
  description?: string;
  hideCompanionTable?: boolean;
  className?: string;
  yTickFormatter?: (v: number) => string;
}

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v)}`;
}

const AXIS_TICK = { fill: 'var(--fg-subtle)', fontSize: 11 };
const AXIS_LINE = { stroke: 'var(--border-strong)' };

export function Chart<TDatum extends Record<string, unknown>>({
  data,
  type,
  series,
  xKey,
  yLabel,
  marker,
  height = 300,
  title,
  description,
  hideCompanionTable = false,
  className,
  yTickFormatter = formatCompact,
}: ChartProps<TDatum>) {
  const [showTable, setShowTable] = useState(false);
  const palette = useChartPalette();
  // colours is always parallel to series (same .map), so index access is safe.
  const colours = series.map((s) => palette.assign(s.id)) as string[];
  const dataArr = data as TDatum[];
  const markerX = marker
    ? (dataArr[marker.fromIndex]?.[xKey] as string | number | undefined)
    : undefined;

  function renderLines() {
    return series.map((s, i) => (
      <Line
        key={s.id}
        type="monotone"
        dataKey={s.key as string}
        name={s.label}
        stroke={colours[i] ?? 'var(--chart-1)'}
        strokeWidth={2}
        strokeDasharray={s.dashed ? '4 4' : ''}
        dot={false}
        activeDot={{ r: 4 }}
        isAnimationActive={false}
      />
    ));
  }

  function renderAreas() {
    return series.map((s, i) => (
      <Area
        key={s.id}
        type="monotone"
        dataKey={s.key as string}
        name={s.label}
        stroke={colours[i] ?? 'var(--chart-1)'}
        fill={colours[i] ?? 'var(--chart-1)'}
        fillOpacity={0.15}
        strokeWidth={1.5}
        strokeDasharray={s.dashed ? '4 4' : ''}
        stackId={type === 'stacked-area' ? (s.stack ?? 'default') : 'none'}
        isAnimationActive={false}
      />
    ));
  }

  function renderBars() {
    return series.map((s, i) => (
      <Bar
        key={s.id}
        dataKey={s.key as string}
        name={s.label}
        fill={colours[i] ?? 'var(--chart-1)'}
        radius={[3, 3, 0, 0]}
        stackId={type === 'stacked-bar' ? (s.stack ?? 'default') : 'none'}
        isAnimationActive={false}
      />
    ));
  }

  const descId = title ? `chart-desc-${title.replace(/\W+/g, '-').toLowerCase()}` : undefined;

  const sharedAxes = (
    <>
      <CartesianGrid
        stroke="var(--border-default)"
        strokeDasharray="3 3"
        horizontal
        vertical={false}
      />
      <XAxis
        dataKey={xKey as string}
        tick={AXIS_TICK}
        axisLine={AXIS_LINE}
        tickLine={false}
        stroke="var(--border-strong)"
      />
      <YAxis
        tick={AXIS_TICK}
        axisLine={AXIS_LINE}
        tickLine={false}
        stroke="var(--border-strong)"
        tickFormatter={yTickFormatter}
        {...(yLabel
          ? {
              label: {
                value: yLabel,
                angle: -90,
                position: 'insideLeft' as const,
                fill: 'var(--fg-subtle)',
                fontSize: 11,
              },
            }
          : {})}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
        }}
        formatter={(value) => {
          const num = typeof value === 'number' ? value : Number(value);
          return [yTickFormatter(num)];
        }}
      />
      {markerX !== undefined && (
        <ReferenceLine
          x={markerX}
          stroke="var(--border-strong)"
          strokeDasharray="2 2"
          label={{
            value: 'Projected →',
            position: 'top' as const,
            fill: 'var(--fg-subtle)',
            fontSize: 11,
          }}
        />
      )}
    </>
  );

  return (
    <figure className={className} aria-label={title} aria-describedby={descId}>
      {description && (
        <p id={descId} className="sr-only">
          {description}
        </p>
      )}

      <ResponsiveContainer width="100%" height={height}>
        {type === 'area' || type === 'stacked-area' ? (
          <AreaChart data={dataArr}>
            {sharedAxes}
            {renderAreas()}
          </AreaChart>
        ) : type === 'bar' || type === 'stacked-bar' ? (
          <BarChart data={dataArr}>
            {sharedAxes}
            {renderBars()}
          </BarChart>
        ) : (
          <LineChart data={dataArr}>
            {sharedAxes}
            {renderLines()}
          </LineChart>
        )}
      </ResponsiveContainer>

      {!hideCompanionTable && (
        <div className="mt-[var(--space-2)]">
          <button
            type="button"
            onClick={() => setShowTable((p) => !p)}
            className="[font-size:var(--text-xs)] text-[var(--fg-muted)] underline-offset-2 hover:underline"
            aria-expanded={showTable}
          >
            {showTable ? 'Hide data' : 'Show data'}
          </button>

          <div className={showTable ? undefined : 'sr-only'} aria-hidden={!showTable || undefined}>
            <table className="mt-[var(--space-2)] w-full border-collapse [font-size:var(--text-xs)]">
              {title && <caption className="sr-only">{title}</caption>}
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-b border-[var(--border-default)] pb-1 text-left text-[var(--fg-subtle)]"
                  >
                    {xKey}
                  </th>
                  {series.map((s) => (
                    <th
                      key={s.id}
                      scope="col"
                      className="border-b border-[var(--border-default)] pb-1 text-right text-[var(--fg-subtle)]"
                    >
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataArr.map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--border-muted)]">
                    <td className="py-0.5 text-left tabular-nums text-[var(--fg-muted)]">
                      {String(row[xKey])}
                    </td>
                    {series.map((s) => (
                      <td
                        key={s.id}
                        className="py-0.5 text-right tabular-nums text-[var(--fg-default)]"
                      >
                        {typeof row[s.key] === 'number'
                          ? yTickFormatter(row[s.key] as number)
                          : String(row[s.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </figure>
  );
}

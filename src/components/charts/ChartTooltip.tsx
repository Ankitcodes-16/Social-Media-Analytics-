interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  // Injected by Recharts
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  // Ours
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number, name: string) => string;
  /** Adds a total row summing these dataKeys */
  sumKeys?: string[];
  sumLabel?: string;
}

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, sumKeys, sumLabel = "Total" }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const fmt = valueFormatter ?? ((v: number) => Math.round(v).toLocaleString("en-US"));
  const total = sumKeys
    ? payload.filter((p) => sumKeys.includes(String(p.dataKey))).reduce((n, p) => n + Number(p.value ?? 0), 0)
    : null;

  return (
    <div className="min-w-[9rem] rounded-md border border-line-strong bg-ink-850/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label !== undefined ? (
        <div className="mb-1.5 font-medium text-fg">{labelFormatter ? labelFormatter(label) : String(label)}</div>
      ) : null}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="tabular-nums text-fg">{fmt(Number(p.value ?? 0), String(p.name ?? ""))}</span>
          </div>
        ))}
        {total !== null ? (
          <div className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-1">
            <span className="text-fg-dim">{sumLabel}</span>
            <span className="tabular-nums font-medium text-fg">{fmt(total, sumLabel)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3.5 rounded"
            style={it.dashed ? { backgroundImage: `linear-gradient(90deg, ${it.color} 60%, transparent 0)`, backgroundSize: "6px 2px" } : { backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

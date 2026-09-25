"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlatformComparison } from "@/types";
import { COLORS } from "@/lib/colors";
import { AXIS_LINE, AXIS_TICK } from "./common";
import { ChartLegend, ChartTooltip } from "./ChartTooltip";

/** Grouped bars comparing X and Telegram on the same 0–100% scale. */
export function PlatformComparisonChart({ data }: { data: PlatformComparison[] }) {
  const x = data.find((d) => d.platform === "x");
  const tg = data.find((d) => d.platform === "telegram");
  const rows = [
    { metric: "Share of mentions", x: x?.sharePct ?? 0, telegram: tg?.sharePct ?? 0 },
    { metric: "Negative posts", x: x?.negativePct ?? 0, telegram: tg?.negativePct ?? 0 },
  ];
  return (
    <div>
      <div className="mb-2">
        <ChartLegend
          items={[
            { label: "X", color: COLORS.x },
            { label: "Telegram", color: COLORS.telegram },
          ]}
        />
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: -10 }} barGap={4}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="metric" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} />} />
            <Bar dataKey="x" name="X" fill={COLORS.x} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false} />
            <Bar dataKey="telegram" name="Telegram" fill={COLORS.telegram} fillOpacity={0.9} radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

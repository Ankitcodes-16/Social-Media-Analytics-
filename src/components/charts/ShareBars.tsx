"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SentimentSummary } from "@/types";
import { COLORS } from "@/lib/colors";
import { AXIS_TICK } from "./common";
import { ChartTooltip } from "./ChartTooltip";

export interface ShareRow {
  key: string;
  name: string;
  summary: SentimentSummary;
}

/** 100%-stacked horizontal bars of sentiment share, one row per platform/topic. */
export function ShareBars({ rows, labelWidth = 150, rowHeight = 34 }: { rows: ShareRow[]; labelWidth?: number; rowHeight?: number }) {
  const data = rows.map((r) => ({
    name: r.name,
    negative: r.summary.negativePct,
    neutral: r.summary.neutralPct,
    positive: r.summary.positivePct,
  }));
  return (
    <div style={{ height: Math.max(80, rows.length * rowHeight + 16) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={6}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="name" width={labelWidth} tick={{ ...AXIS_TICK, fill: "#98a2b3" }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} />}
          />
          <Bar dataKey="negative" name="Negative" stackId="s" fill={COLORS.negative} isAnimationActive={false} />
          <Bar dataKey="neutral" name="Neutral" stackId="s" fill={COLORS.neutral} fillOpacity={0.45} isAnimationActive={false} />
          <Bar dataKey="positive" name="Positive" stackId="s" fill={COLORS.positive} radius={[0, 3, 3, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

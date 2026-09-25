"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SentimentPoint } from "@/types";
import { COLORS } from "@/lib/colors";
import { formatCompact, formatDateTime, formatTime } from "@/lib/format";
import { AXIS_LINE, AXIS_TICK } from "./common";
import { ChartLegend, ChartTooltip } from "./ChartTooltip";

export type SentimentTimelineMode = "share" | "volume";

/** Stacked sentiment over time — negative at the bottom so its growth is easy to see. */
export function SentimentTimeline({
  data,
  mode = "share",
  height = 288,
}: {
  data: SentimentPoint[];
  mode?: SentimentTimelineMode;
  height?: number;
}) {
  const rows = data.map((p) => ({
    ts: p.ts,
    negative: mode === "share" ? p.negativePct : p.counts.negative,
    neutral: mode === "share" ? p.neutralPct : p.counts.neutral,
    positive: mode === "share" ? p.positivePct : p.counts.positive,
  }));
  const isShare = mode === "share";
  return (
    <div>
      <div className="mb-2">
        <ChartLegend
          items={[
            { label: "Negative", color: COLORS.negative },
            { label: "Neutral", color: COLORS.neutral },
            { label: "Positive", color: COLORS.positive },
          ]}
        />
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 6, right: 12, bottom: 0, left: -6 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatTime} tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} minTickGap={32} />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={46}
              domain={isShare ? [0, 100] : [0, "auto"]}
              tickFormatter={(v: number) => (isShare ? `${v}%` : formatCompact(v))}
            />
            <Tooltip
              cursor={{ stroke: "#2b3546" }}
              content={
                <ChartTooltip
                  labelFormatter={(l) => formatDateTime(String(l))}
                  valueFormatter={(v) => (isShare ? `${v.toFixed(1)}%` : Math.round(v).toLocaleString("en-US"))}
                />
              }
            />
            <Area type="monotone" dataKey="negative" name="Negative" stackId="s" stroke={COLORS.negative} fill={COLORS.negative} fillOpacity={0.55} strokeWidth={1} isAnimationActive={false} />
            <Area type="monotone" dataKey="neutral" name="Neutral" stackId="s" stroke={COLORS.neutral} fill={COLORS.neutral} fillOpacity={0.22} strokeWidth={1} isAnimationActive={false} />
            <Area type="monotone" dataKey="positive" name="Positive" stackId="s" stroke={COLORS.positive} fill={COLORS.positive} fillOpacity={0.45} strokeWidth={1} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

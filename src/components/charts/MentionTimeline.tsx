"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimePoint, TrendMilestone } from "@/types";
import { COLORS } from "@/lib/colors";
import { formatCompact, formatDateTime, formatTime } from "@/lib/format";
import { AXIS_LINE, AXIS_TICK, floorToHour } from "./common";
import { ChartLegend, ChartTooltip } from "./ChartTooltip";

const MARKER_COLOR: Record<string, string> = { detected: COLORS.signal, alert: "#fb923c" };

/** Mentions per hour by platform, with baseline and key milestones. */
export function MentionTimeline({
  data,
  baseline,
  milestones,
}: {
  data: TimePoint[];
  baseline?: number;
  milestones: TrendMilestone[];
}) {
  const markers = milestones.filter((m) => m.kind === "detected" || m.kind === "alert");
  return (
    <div>
      <div className="mb-2">
        <ChartLegend
          items={[
            { label: "X", color: COLORS.x },
            { label: "Telegram", color: COLORS.telegram },
            ...(baseline !== undefined ? [{ label: `Baseline (${baseline}/h median)`, color: COLORS.axis, dashed: true }] : []),
          ]}
        />
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: -6 }}>
            <defs>
              <linearGradient id="mtX" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.x} stopOpacity={0.3} />
                <stop offset="100%" stopColor={COLORS.x} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="mtTg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.telegram} stopOpacity={0.4} />
                <stop offset="100%" stopColor={COLORS.telegram} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatTime} tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} minTickGap={32} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={46} tickFormatter={formatCompact} />
            <Tooltip
              cursor={{ stroke: "#2b3546" }}
              content={<ChartTooltip labelFormatter={(l) => formatDateTime(String(l))} sumKeys={["x", "telegram"]} sumLabel="Mentions" />}
            />
            {baseline !== undefined ? <ReferenceLine y={baseline} stroke={COLORS.axis} strokeDasharray="3 4" /> : null}
            <Area type="monotone" dataKey="x" name="X" stackId="m" stroke={COLORS.x} strokeWidth={1.25} fill="url(#mtX)" isAnimationActive={false} />
            <Area type="monotone" dataKey="telegram" name="Telegram" stackId="m" stroke={COLORS.telegram} strokeWidth={1.25} fill="url(#mtTg)" isAnimationActive={false} />
            {markers.map((m) => (
              <ReferenceLine
                key={`${m.kind}-${m.ts}`}
                x={floorToHour(m.ts)}
                stroke={MARKER_COLOR[m.kind]}
                strokeDasharray="4 3"
                label={{ value: m.kind === "alert" ? "Alert" : "Detected", position: "top", fill: MARKER_COLOR[m.kind], fontSize: 10 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

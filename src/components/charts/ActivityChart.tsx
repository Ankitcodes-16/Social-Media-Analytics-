"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivityPoint } from "@/types";
import { COLORS } from "@/lib/colors";
import { formatCompact, formatDateTime, formatTime } from "@/lib/format";
import { AXIS_LINE, AXIS_TICK, floorToHour } from "./common";
import { ChartLegend, ChartTooltip } from "./ChartTooltip";

/** Total activity by platform, with the emerging topic drawn on top and the alert marked. */
export function ActivityChart({
  data,
  emergingName,
  alertAt,
}: {
  data: ActivityPoint[];
  emergingName: string | null;
  alertAt: string | null;
}) {
  const legend = [
    { label: "X", color: COLORS.x },
    { label: "Telegram", color: COLORS.telegram },
    ...(emergingName ? [{ label: emergingName, color: COLORS.signal }] : []),
  ];
  return (
    <div>
      <div className="mb-2">
        <ChartLegend items={legend} />
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: -6 }}>
            <defs>
              <linearGradient id="fillX" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.x} stopOpacity={0.22} />
                <stop offset="100%" stopColor={COLORS.x} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillTg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.telegram} stopOpacity={0.3} />
                <stop offset="100%" stopColor={COLORS.telegram} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatTime} tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} minTickGap={32} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={46} tickFormatter={formatCompact} />
            <Tooltip
              cursor={{ stroke: "#2b3546" }}
              content={<ChartTooltip labelFormatter={(l) => formatDateTime(String(l))} sumKeys={["x", "telegram"]} sumLabel="All topics" />}
            />
            <Area type="monotone" dataKey="x" name="X" stackId="a" stroke={COLORS.x} strokeWidth={1.25} fill="url(#fillX)" isAnimationActive={false} />
            <Area type="monotone" dataKey="telegram" name="Telegram" stackId="a" stroke={COLORS.telegram} strokeWidth={1.25} fill="url(#fillTg)" isAnimationActive={false} />
            {emergingName ? (
              <Line type="monotone" dataKey="emerging" name={emergingName} stroke={COLORS.signal} strokeWidth={2.25} dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
            ) : null}
            {alertAt ? (
              <ReferenceLine
                x={floorToHour(alertAt)}
                stroke="#fb923c"
                strokeDasharray="4 3"
                label={{ value: "Alert raised", position: "top", fill: "#fb923c", fontSize: 10 }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

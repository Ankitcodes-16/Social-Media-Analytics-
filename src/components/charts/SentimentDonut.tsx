"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { SentimentSummary } from "@/types";
import { SENTIMENT_COLORS } from "@/lib/colors";
import { formatCompact, formatSigned } from "@/lib/format";

/** Sentiment split as a donut with the net score in the middle. */
export function SentimentDonut({ summary, size = 176 }: { summary: SentimentSummary; size?: number }) {
  const data = [
    { name: "Positive", value: summary.counts.positive, color: SENTIMENT_COLORS.positive },
    { name: "Neutral", value: summary.counts.neutral, color: SENTIMENT_COLORS.neutral },
    { name: "Negative", value: summary.counts.negative, color: SENTIMENT_COLORS.negative },
  ];
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="94%"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} fillOpacity={d.name === "Neutral" ? 0.55 : 1} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-fg">{formatSigned(summary.netScore, 1)}</span>
        <span className="eyebrow mt-0.5">Net sentiment</span>
        <span className="mt-0.5 text-[11px] tabular-nums text-fg-dim">{formatCompact(summary.total)} posts</span>
      </div>
    </div>
  );
}

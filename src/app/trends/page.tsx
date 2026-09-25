"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import type { Platform, TrendSort, TrendStatus } from "@/types";
import { getTrends } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { AsyncBoundary } from "@/components/ui/AsyncBoundary";
import { EmptyState, ListSkeleton } from "@/components/ui/States";
import { Button, SelectField, Segmented } from "@/components/ui/Controls";
import { TrendRow } from "@/components/trends/TrendRows";

type StatusFilter = TrendStatus | "all";

export default function TrendsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [sort, setSort] = useState<TrendSort>("score");

  // Status is filtered locally so every tab can show its count.
  const trends = useAsync(() => getTrends({ platform, sort }), [platform, sort]);
  const data = trends.data ?? [];
  const count = (s: TrendStatus): number => data.filter((t) => t.status === s).length;
  const visible = status === "all" ? data : data.filter((t) => t.status === status);

  return (
    <>
      <PageHeader
        title="Trends"
        description="Topics ranked by how strongly the detection signals agree. Open a trend to see the evidence behind its score."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<StatusFilter>
          ariaLabel="Filter by trend status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: data.length },
            { value: "emerging", label: "Emerging", count: count("emerging") },
            { value: "rising", label: "Rising", count: count("rising") },
            { value: "stable", label: "Stable", count: count("stable") },
            { value: "declining", label: "Declining", count: count("declining") },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SelectField<Platform | "all">
            label="Platform"
            value={platform}
            onChange={setPlatform}
            options={[
              { value: "all", label: "All platforms" },
              { value: "x", label: "X" },
              { value: "telegram", label: "Telegram" },
            ]}
          />
          <SelectField<TrendSort>
            label="Sort by"
            value={sort}
            onChange={setSort}
            options={[
              { value: "score", label: "Trend score" },
              { value: "growth", label: "Growth rate" },
              { value: "volume", label: "Volume (24h)" },
              { value: "recent", label: "Recently detected" },
            ]}
          />
        </div>
      </div>

      <AsyncBoundary
        state={trends}
        loading={<ListSkeleton rows={5} />}
        errorTitle="Couldn't load trends"
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="No topics match this platform"
            description="Try another platform filter."
            icon={<TrendingUp size={22} />}
            action={<Button onClick={() => setPlatform("all")}>Show all platforms</Button>}
          />
        }
      >
        {() =>
          visible.length === 0 ? (
            <EmptyState
              title={`No ${status} trends right now`}
              description="Nothing currently matches this status. Try a different tab."
              icon={<TrendingUp size={22} />}
              action={<Button onClick={() => setStatus("all")}>Show all trends</Button>}
            />
          ) : (
            <div className="space-y-3">
              {visible.map((t) => (
                <TrendRow key={t.id} trend={t} />
              ))}
            </div>
          )
        }
      </AsyncBoundary>
    </>
  );
}

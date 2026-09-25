"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import type { AlertSeverity, AlertStatus } from "@/types";
import { getAlerts } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { AsyncBoundary } from "@/components/ui/AsyncBoundary";
import { EmptyState, ListSkeleton } from "@/components/ui/States";
import { ImplementationBadge } from "@/components/ui/Badge";
import { Button, Segmented, SelectField } from "@/components/ui/Controls";
import { AlertRow } from "@/components/alerts/AlertRow";

type StatusFilter = AlertStatus | "all";

export default function AlertsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");

  const alerts = useAsync(() => getAlerts({ severity }), [severity]);
  const data = alerts.data ?? [];
  const count = (s: AlertStatus): number => data.filter((a) => a.status === s).length;
  const visible = status === "all" ? data : data.filter((a) => a.status === status);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Raised when several detection signals fire together. Every alert explains exactly why it was generated."
        meta={
          <span className="flex items-center gap-2">
            <ImplementationBadge status="simulated" />
            Status changes are kept in memory for this session only.
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<StatusFilter>
          ariaLabel="Filter by alert status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: data.length },
            { value: "new", label: "New", count: count("new") },
            { value: "investigating", label: "Investigating", count: count("investigating") },
            { value: "resolved", label: "Resolved", count: count("resolved") },
          ]}
        />
        <SelectField<AlertSeverity | "all">
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={[
            { value: "all", label: "All severities" },
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
      </div>

      <AsyncBoundary
        state={alerts}
        loading={<ListSkeleton rows={3} />}
        errorTitle="Couldn't load alerts"
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            title="No alerts for this severity"
            description="Nothing has crossed the alert rule for the selected severity."
            icon={<Bell size={22} />}
            action={<Button onClick={() => setSeverity("all")}>Show all severities</Button>}
          />
        }
      >
        {() =>
          visible.length === 0 ? (
            <EmptyState
              title={`No ${status} alerts`}
              description="Nothing is in this state right now."
              icon={<Bell size={22} />}
              action={<Button onClick={() => setStatus("all")}>Show all alerts</Button>}
            />
          ) : (
            <div className="space-y-3">
              {visible.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </div>
          )
        }
      </AsyncBoundary>
    </>
  );
}

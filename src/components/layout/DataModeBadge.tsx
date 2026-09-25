import { Database, FlaskConical } from "lucide-react";
import { getDataMode } from "@/services";
import { Badge } from "@/components/ui/Badge";

/** Always-visible statement of where the numbers come from. */
export function DataModeBadge() {
  const mode = getDataMode();
  if (mode === "simulated") {
    return (
      <Badge
        tone="warning"
        title="Every number, post and account on this dashboard is synthetic. Services switch to the FastAPI backend in Phase 2."
      >
        <FlaskConical size={11} />
        Simulated data
      </Badge>
    );
  }
  if (mode === "live") {
    return (
      <Badge tone="positive" title="All services read from the backend API.">
        <Database size={11} />
        Live API
      </Badge>
    );
  }
  return (
    <Badge tone="info" title="Some services read from the backend API, the rest are still simulated.">
      <Database size={11} />
      API + simulated
    </Badge>
  );
}

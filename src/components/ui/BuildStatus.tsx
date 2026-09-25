import { IMPLEMENTATION_STATUS } from "@/lib/implementation";
import { ImplementationBadge } from "./Badge";

/** What is real, what is simulated, and what is still to come. */
export function BuildStatus() {
  return (
    <ul className="divide-y divide-line">
      {IMPLEMENTATION_STATUS.map((item) => (
        <li key={item.area} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-fg">{item.area}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-dim">{item.detail}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ImplementationBadge status={item.status} />
            <span className="text-[10px] uppercase tracking-wider text-fg-dim">{item.phase}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

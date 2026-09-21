import { STATUSES } from "../../lib/constants";
import { statusStyle } from "../../lib/theme";

/**
 * Quick status update: one click on a segment changes the task's status.
 * The active segment is filled with the status colour; the others stay neutral.
 */
export default function StatusControl({ task, onChange, busy = false, size = "sm" }) {
  const canEdit = task.permissions?.canEdit;
  const padding = size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm";

  return (
    <div role="group" aria-label={`Status of ${task.title}`} className="inline-flex w-full overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      {STATUSES.map((status) => {
        const { icon: Icon, active } = statusStyle(status);
        const selected = task.status === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={selected}
            disabled={!canEdit || busy}
            title={canEdit ? `Mark as ${status}` : "You only have view access"}
            onClick={() => !selected && onChange(status)}
            className={`flex flex-1 items-center justify-center gap-1 border-r border-slate-200 font-semibold transition-colors last:border-r-0 disabled:cursor-not-allowed ${padding} ${selected ? active : "bg-white text-slate-600 hover:bg-slate-100 disabled:hover:bg-white"}`}
          >
            <Icon size={13} className="hidden shrink-0 min-[400px]:block" aria-hidden="true" />
            <span className="truncate">{status}</span>
          </button>
        );
      })}
    </div>
  );
}

import { AlertTriangle, Flag, FolderKanban, Clock } from "lucide-react";
import { OVERDUE_STYLE, priorityStyle, statusStyle } from "../../lib/theme";
import { deadlineInfo } from "../../lib/format";

export function StatusBadge({ status, className = "" }) {
  const { icon: Icon, badge } = statusStyle(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${badge} ${className}`} data-testid="status-badge">
      <Icon size={13} aria-hidden="true" /> {status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityStyle(priority).badge}`} data-testid="priority-badge">
      <Flag size={12} aria-hidden="true" /> {priority} priority
    </span>
  );
}

export function CategoryBadge({ category }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
      <FolderKanban size={12} aria-hidden="true" /> {category}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${OVERDUE_STYLE.badge}`} data-testid="overdue-badge">
      <AlertTriangle size={13} aria-hidden="true" /> Overdue
    </span>
  );
}

const TONE_TEXT = { overdue: "text-red-700 font-semibold", soon: "text-amber-800 font-semibold", normal: "text-slate-700", done: "text-slate-600", none: "text-slate-500" };

/** Deadline with a relative hint: "Sep 25, 2026, 5:00 PM · Due in 3 days" / "Overdue by 2 days". */
export function DeadlineLabel({ task }) {
  const info = deadlineInfo(task);
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 text-sm ${TONE_TEXT[info.tone]}`}>
      <Clock size={14} aria-hidden="true" />
      <span>{info.label}</span>
      {info.detail && info.tone !== "done" && <span className="text-xs">· {info.detail}</span>}
    </span>
  );
}

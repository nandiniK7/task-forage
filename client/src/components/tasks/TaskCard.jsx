import { Link } from "react-router-dom";
import { MessageSquare, Paperclip, Pencil, Share2, Trash2 } from "lucide-react";
import { CategoryBadge, DeadlineLabel, OverdueBadge, PriorityBadge, StatusBadge } from "./badges";
import StatusControl from "./StatusControl";
import AssignmentInfo from "./AssignmentInfo";
import { IconButton } from "../ui/primitives";
import { statusStyle } from "../../lib/theme";

const ACCESS_LABEL = { edit: "Shared with you · can edit", view: "Shared with you · view only" };

export default function TaskCard({ task, onEdit, onDelete, onStatusChange, statusBusy = false }) {
  const style = statusStyle(task.status);
  const completed = task.status === "Completed";
  const sharedCount = task.sharedWith?.length ?? 0;
  const guestLabel = task.access !== "owner" ? ACCESS_LABEL[task.access] : null;

  return (
    <article
      data-testid="task-card"
      data-status={task.status}
      className={`flex flex-col rounded-xl border border-l-8 p-4 shadow-sm transition-shadow hover:shadow-md ${style.card} ${task.isOverdue ? "ring-2 ring-red-500" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        {task.isOverdue && <OverdueBadge />}
        <PriorityBadge priority={task.priority} />
        <CategoryBadge category={task.category} />
        <div className="ml-auto flex items-center gap-0.5">
          {task.permissions?.canEdit && <IconButton label={`Edit ${task.title}`} onClick={() => onEdit(task)}><Pencil size={16} /></IconButton>}
          {task.permissions?.canDelete && <IconButton label={`Delete ${task.title}`} onClick={() => onDelete(task)} className="hover:bg-red-100 hover:text-red-700"><Trash2 size={16} /></IconButton>}
        </div>
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-900">
        <Link to={`/tasks/${task._id}`} className={`hover:text-brand-700 hover:underline ${completed ? "text-slate-600 line-through decoration-emerald-600/60" : ""}`}>
          {task.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-slate-700">{task.description || <span className="text-slate-500 italic">No description</span>}</p>

      <div className="mt-3"><DeadlineLabel task={task} /></div>

      <div className="mt-3 rounded-lg bg-white/70 p-2.5"><AssignmentInfo task={task} /></div>

      <div className="mt-3">
        <StatusControl task={task} busy={statusBusy} onChange={(status) => onStatusChange(task, status)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1"><MessageSquare size={13} aria-hidden="true" /> {task.commentCount}<span className="sr-only"> comments</span></span>
        <span className="inline-flex items-center gap-1"><Paperclip size={13} aria-hidden="true" /> {task.attachments.length}<span className="sr-only"> attachments</span></span>
        {sharedCount > 0 && <span className="inline-flex items-center gap-1"><Share2 size={13} aria-hidden="true" /> Shared with {sharedCount}</span>}
        {guestLabel && <span className="rounded bg-white/80 px-1.5 py-0.5 font-medium text-slate-700">{guestLabel}</span>}
        <Link to={`/tasks/${task._id}`} className="ml-auto font-semibold text-brand-700 hover:underline">Open details →</Link>
      </div>
    </article>
  );
}

import { Link } from "react-router-dom";
import { OVERDUE_STYLE } from "../../lib/theme";
import { DeadlineLabel, PriorityBadge, StatusBadge } from "../tasks/badges";
import { personName } from "../../lib/format";

export default function TaskMiniList({ title, tasks, emptyText, tone, testId, action }) {
  return (
    <section className="card p-5" aria-label={title} data-testid={testId}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={`text-base font-semibold ${tone === "danger" ? OVERDUE_STYLE.text : "text-slate-900"}`}>{title}</h2>
        {action}
      </div>
      {tasks.length === 0 ? <p className="py-4 text-sm text-slate-600">{emptyText}</p> : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <li key={task._id} className="py-2.5">
              <Link to={`/tasks/${task._id}`} className="group block">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700 group-hover:underline">{task.title}</span>
                  <StatusBadge status={task.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <DeadlineLabel task={task} />
                  <PriorityBadge priority={task.priority} />
                  <span>→ {personName(task.assignedTo, "Unassigned")}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

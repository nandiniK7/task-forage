import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { tasksApi } from "../api/services";
import { useApiData, useTaskForm } from "../hooks/hooks";
import { Button, ErrorState, IconButton, PageHeader } from "../components/ui/primitives";
import { StatusBadge, PriorityBadge } from "../components/tasks/badges";
import TaskMiniList from "../components/dashboard/TaskMiniList";
import { STATUSES } from "../lib/constants";
import { OVERDUE_STYLE, STATUS_STYLES, statusStyle } from "../lib/theme";
import { formatTime, personName, sameDay } from "../lib/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthTitle = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const buildGrid = (cursor) => {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const chipClass = (task) => (task.isOverdue ? OVERDUE_STYLE.chip : statusStyle(task.status).chip);

export default function Calendar() {
  const { openCreate } = useTaskForm();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date());

  const grid = useMemo(() => buildGrid(cursor), [cursor]);
  const rangeStart = grid[0].toISOString();
  const rangeEnd = new Date(grid[41].getFullYear(), grid[41].getMonth(), grid[41].getDate(), 23, 59, 59, 999).toISOString();

  const monthTasks = useApiData((params, signal) => tasksApi.list(params, signal), { dueFrom: rangeStart, dueTo: rangeEnd, sort: "deadline_asc", limit: 500 });
  const stats = useApiData((_params, signal) => tasksApi.stats(signal));

  const byDay = useMemo(() => {
    const map = new Map();
    (monthTasks.data?.tasks ?? []).forEach((task) => {
      const key = dayKey(new Date(task.deadline));
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return map;
  }, [monthTasks.data]);

  const selectedTasks = byDay.get(dayKey(selected)) ?? [];
  const move = (months) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + months, 1));
  const goToday = () => { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(now); };

  const addOnSelected = () => {
    const at = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 17, 0);
    openCreate({ deadline: at.toISOString() });
  };

  return (
    <div>
      <PageHeader title="Calendar" description="Every task on its deadline, colour-coded by status." actions={<Button onClick={addOnSelected}><Plus size={16} /> New task on {selected.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-700" aria-label="Legend">
        {STATUSES.map((status) => <span key={status} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${STATUS_STYLES[status].dot}`} /> {status}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-600" /> Overdue</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2" aria-label="Month calendar">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <IconButton label="Previous month" onClick={() => move(-1)}><ChevronLeft size={20} /></IconButton>
            <h2 className="min-w-0 flex-1 text-center text-lg font-semibold text-slate-900" data-testid="calendar-title" aria-live="polite">{monthTitle.format(cursor)}</h2>
            <IconButton label="Next month" onClick={() => move(1)}><ChevronRight size={20} /></IconButton>
            <Button size="sm" variant="secondary" onClick={goToday}>Today</Button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-600">
            {WEEKDAYS.map((day) => <div key={day} className="py-2"><span className="hidden sm:inline">{day}</span><span className="sm:hidden">{day[0]}</span></div>)}
          </div>

          {monthTasks.error && !monthTasks.data ? <div className="p-4"><ErrorState message={monthTasks.error} onRetry={monthTasks.reload} /></div> : (
            <div className="grid grid-cols-7" role="grid">
              {grid.map((day) => {
                const tasks = byDay.get(dayKey(day)) ?? [];
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = sameDay(day, today);
                const isSelected = sameDay(day, selected);
                return (
                  <button
                    key={dayKey(day)}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${longDate.format(day)}, ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
                    data-testid="calendar-day"
                    data-date={dayKey(day)}
                    onClick={() => setSelected(day)}
                    className={`min-h-16 border-b border-r border-slate-100 p-1 text-left align-top transition-colors sm:min-h-28 sm:p-1.5 ${inMonth ? "bg-white" : "bg-slate-50 text-slate-400"} ${isSelected ? "outline outline-2 -outline-offset-2 outline-brand-600" : "hover:bg-brand-50"}`}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-brand-600 text-white" : inMonth ? "text-slate-800" : "text-slate-400"}`}>{day.getDate()}</span>
                    <span className="mt-1 hidden flex-col gap-1 sm:flex">
                      {tasks.slice(0, 3).map((task) => (
                        <span key={task._id} data-testid="calendar-chip" data-status={task.status} className={`truncate rounded border-l-4 px-1.5 py-0.5 text-[11px] font-semibold ${chipClass(task)}`} title={`${task.title} (${task.isOverdue ? "Overdue" : task.status})`}>
                          {task.isOverdue ? "! " : ""}{task.title}
                        </span>
                      ))}
                      {tasks.length > 3 && <span className="px-1 text-[11px] font-semibold text-slate-600">+{tasks.length - 3} more</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                      {tasks.slice(0, 4).map((task) => <span key={task._id} className={`h-2 w-2 rounded-full ${task.isOverdue ? "bg-red-600" : statusStyle(task.status).dot}`} />)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="card p-5" aria-label="Selected day" data-testid="day-panel">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><CalendarDays size={18} className="text-brand-600" aria-hidden="true" /> {longDate.format(selected)}</h2>
          {selectedTasks.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No tasks are due on this day.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {selectedTasks.map((task) => (
                <li key={task._id} className={`rounded-lg border border-l-8 p-3 ${statusStyle(task.status).card}`}>
                  <Link to={`/tasks/${task._id}`} className="block text-sm font-semibold text-slate-900 hover:text-brand-700 hover:underline">{task.title}</Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.status} />
                    {task.isOverdue && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${OVERDUE_STYLE.badge}`}>Overdue</span>}
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <p className="mt-2 text-xs text-slate-700">Due {formatTime(task.deadline)} · Assigned to {personName(task.assignedTo, "nobody")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TaskMiniList testId="calendar-overdue" title="Overdue" tone="danger" tasks={stats.data?.stats.overdueTasks ?? []} emptyText="No overdue tasks." />
        <TaskMiniList testId="calendar-upcoming" title="Upcoming deadlines" tasks={stats.data?.stats.upcoming ?? []} emptyText="No upcoming deadlines." />
      </div>
    </div>
  );
}

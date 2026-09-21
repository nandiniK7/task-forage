import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bell, CalendarClock, Pencil, Tag, Trash2 } from "lucide-react";
import { tasksApi } from "../api/services";
import { useApiData, useAuth, useTaskEvents, useTaskForm } from "../hooks/hooks";
import useTaskActions from "../hooks/useTaskActions";
import { Button, ErrorState, LoadingBlock } from "../components/ui/primitives";
import { ConfirmDialog } from "../components/ui/Modal";
import { CategoryBadge, DeadlineLabel, OverdueBadge, PriorityBadge, StatusBadge } from "../components/tasks/badges";
import StatusControl from "../components/tasks/StatusControl";
import AssignmentInfo from "../components/tasks/AssignmentInfo";
import Comments from "../components/tasks/Comments";
import Attachments from "../components/tasks/Attachments";
import SharePanel from "../components/tasks/SharePanel";
import { REMINDER_OPTIONS } from "../lib/constants";
import { formatDateTime } from "../lib/format";
import { statusStyle } from "../lib/theme";

const ACCESS_TEXT = { owner: "You own this task", edit: "You can edit this task", view: "You have view-only access" };

function Meta({ icon: Icon, label, children }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500"><Icon size={13} aria-hidden="true" /> {label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openEdit } = useTaskForm();
  const { notifyChanged } = useTaskEvents();
  const { busyId, deleting, changeStatus, deleteTask } = useTaskActions();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const result = useApiData((params, signal) => tasksApi.get(params.id, signal), { id });
  const task = result.data?.task;

  if (result.loading) return <LoadingBlock label="Loading task…" />;
  if (!task) {
    return (
      <div>
        <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft size={16} /> Back to tasks</Link>
        <ErrorState message={result.error || "Task not found."} onRetry={result.reload} />
      </div>
    );
  }

  const style = statusStyle(task.status);
  const reminder = REMINDER_OPTIONS.find((option) => option.value === task.reminderBefore)?.label ?? `${task.reminderBefore}h before`;
  const onTaskChange = (updated) => { result.setData((data) => ({ ...data, task: updated })); notifyChanged(); };

  const confirmDelete = async () => {
    if (await deleteTask(task)) navigate("/tasks", { replace: true });
    else setConfirmingDelete(false);
  };

  return (
    <div>
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft size={16} /> Back to tasks</Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <article className={`rounded-xl border border-l-8 p-5 shadow-sm ${style.card} ${task.isOverdue ? "ring-2 ring-red-500" : ""}`} data-testid="task-detail" data-status={task.status}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              {task.isOverdue && <OverdueBadge />}
              <PriorityBadge priority={task.priority} />
              <CategoryBadge category={task.category} />
              <div className="ml-auto flex gap-2">
                {task.permissions.canEdit && <Button size="sm" variant="secondary" onClick={() => openEdit(task)}><Pencil size={14} /> Edit</Button>}
                {task.permissions.canDelete && <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)}><Trash2 size={14} /> Delete</Button>}
              </div>
            </div>

            <h1 className={`mt-3 break-words text-2xl font-bold text-slate-900 ${task.status === "Completed" ? "line-through decoration-emerald-600/60" : ""}`}>{task.title}</h1>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{task.description || <span className="italic text-slate-500">No description provided.</span>}</p>

            <dl className="mt-5 grid gap-4 rounded-lg bg-white/70 p-4 sm:grid-cols-2">
              <Meta icon={CalendarClock} label="Deadline"><DeadlineLabel task={task} /></Meta>
              <Meta icon={Bell} label="Reminder email">{task.deadline ? reminder : "Needs a deadline"}</Meta>
              <Meta icon={Tag} label="Created">{formatDateTime(task.createdAt)}</Meta>
              <Meta icon={Tag} label="Last updated">{formatDateTime(task.updatedAt)}</Meta>
            </dl>

            <div className="mt-5">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-600">Update status</p>
              <StatusControl task={task} size="md" busy={busyId === task._id} onChange={(status) => changeStatus(task, status)} />
            </div>
          </article>

          <Comments taskId={task._id} currentUser={user} isTaskOwner={task.permissions.canDelete} />
        </div>

        <aside className="space-y-6">
          <section className="card p-5" aria-labelledby="people-heading">
            <h2 id="people-heading" className="mb-3 text-lg font-semibold text-slate-900">People</h2>
            <AssignmentInfo task={task} showCreator layout="column" />
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700" data-testid="access-note">{ACCESS_TEXT[task.access]}</p>
          </section>
          <SharePanel task={task} currentUser={user} onTaskChange={onTaskChange} onLeft={() => { notifyChanged(); navigate("/tasks", { replace: true }); }} />
          <Attachments task={task} onTaskChange={onTaskChange} />
        </aside>
      </div>

      <ConfirmDialog open={confirmingDelete} title="Delete task?" message={`“${task.title}” and its comments and attachments will be permanently deleted.`} loading={deleting} onConfirm={confirmDelete} onCancel={() => setConfirmingDelete(false)} />
    </div>
  );
}

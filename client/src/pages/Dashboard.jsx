import { AlertTriangle, CheckCircle2, CircleDashed, ClipboardList, Loader, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { tasksApi } from "../api/services";
import { useApiData, useAuth, useTaskForm } from "../hooks/hooks";
import { Button, EmptyState, ErrorState, LoadingBlock, PageHeader } from "../components/ui/primitives";
import {
  ChartCard, ProgressBar, StackedBar, StatCard, StatusPie,
} from "../components/dashboard/widgets";
import TaskMiniList from "../components/dashboard/TaskMiniList";

const TONES = {
  total: { border: "border-l-slate-500", icon: "bg-slate-100 text-slate-700" },
  pending: { border: "border-l-amber-500", icon: "bg-amber-100 text-amber-800" },
  progress: { border: "border-l-blue-600", icon: "bg-blue-100 text-blue-800" },
  completed: { border: "border-l-emerald-600", icon: "bg-emerald-100 text-emerald-800" },
  overdue: { border: "border-l-red-600", icon: "bg-red-100 text-red-800" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { openCreate } = useTaskForm();
  const result = useApiData((_params, signal) => tasksApi.stats(signal));
  const s = result.data?.stats;

  const header = (
    <PageHeader
      title="Dashboard"
      description={`Welcome back, ${user.name.split(" ")[0]}. Here is where your work stands.`}
      actions={<Button onClick={() => openCreate()}><Plus size={16} /> New task</Button>}
    />
  );

  if (result.loading) return <>{header}<LoadingBlock label="Loading your dashboard…" /></>;
  if (!s) return <>{header}<ErrorState message={result.error} onRetry={result.reload} /></>;

  if (s.total === 0) {
    return (
      <>
        {header}
        <EmptyState icon={ClipboardList} title="No tasks yet" description="Create your first task and this dashboard will fill up with progress charts and deadlines." action={<Button onClick={() => openCreate()}><Plus size={16} /> Create your first task</Button>} />
      </>
    );
  }

  return (
    <>
      {header}

      <section aria-label="Task summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard testId="stat-total" label="Total tasks" value={s.total} to="/tasks" icon={ClipboardList} tone={TONES.total} />
        <StatCard testId="stat-pending" label="Pending" value={s.byStatus.Pending} to="/tasks?status=Pending" icon={CircleDashed} tone={TONES.pending} />
        <StatCard testId="stat-progress" label="In progress" value={s.byStatus["In Progress"]} to="/tasks?status=In%20Progress" icon={Loader} tone={TONES.progress} />
        <StatCard testId="stat-completed" label="Completed" value={s.byStatus.Completed} to="/tasks?status=Completed" icon={CheckCircle2} tone={TONES.completed} />
        <StatCard testId="stat-overdue" label="Overdue" value={s.overdue} to="/tasks?overdue=true" icon={AlertTriangle} tone={TONES.overdue} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard title="Overall progress" description="Share of your tasks that are completed." testId="chart-progress">
          <ProgressBar rate={s.completionRate} byStatus={s.byStatus} total={s.total} />
        </ChartCard>
        <div className="lg:col-span-2">
          <ChartCard title="Tasks by status" description="Distribution of all your tasks." testId="chart-status">
            <StatusPie byStatus={s.byStatus} total={s.total} />
          </ChartCard>
        </div>
        <div className="lg:col-span-3 grid gap-6 md:grid-cols-2">
          <ChartCard title="Tasks by priority" description="Each bar is split by status." testId="chart-priority">
            <StackedBar rows={s.byPriority} field="priority" />
          </ChartCard>
          <ChartCard title="Tasks by category" description="Work, Personal and Projects, split by status." testId="chart-category">
            <StackedBar rows={s.byCategory} field="category" />
          </ChartCard>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TaskMiniList testId="list-upcoming" title="Upcoming deadlines" tasks={s.upcoming} emptyText="No upcoming deadlines. Add deadlines to your tasks to see them here." />
        <TaskMiniList
          testId="list-overdue"
          title={`Overdue tasks${s.overdue ? ` (${s.overdue})` : ""}`}
          tone="danger"
          tasks={s.overdueTasks}
          emptyText="Nothing is overdue. Nice work!"
          action={s.overdue > 0 ? <Link to="/tasks?overdue=true" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link> : null}
        />
      </div>

      <div className="mt-6">
        <TaskMiniList testId="list-recent" title="Recently added" tasks={s.recent} emptyText="No tasks yet." action={<Link to="/tasks" className="text-sm font-semibold text-brand-700 hover:underline">All tasks</Link>} />
      </div>
    </>
  );
}

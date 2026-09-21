import { useSearchParams } from "react-router-dom";
import { ClipboardList, Plus, SearchX, X } from "lucide-react";
import { tasksApi } from "../api/services";
import { useApiData, useTaskForm } from "../hooks/hooks";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonCards } from "../components/ui/primitives";
import TaskList from "../components/tasks/TaskList";
import { CATEGORIES, PRIORITIES, SCOPE_OPTIONS, SORT_OPTIONS, STATUSES } from "../lib/constants";
import { statusStyle, OVERDUE_STYLE } from "../lib/theme";

const FILTER_KEYS = ["search", "status", "priority", "category", "scope", "sort", "overdue"];

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select className="field py-1.5" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function OverviewChip({ label, count, active, onClick, dot, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${active ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
    >
      {dot && <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />}
      <span>{label}</span>
      <span className="ml-auto rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-800">{count ?? "–"}</span>
    </button>
  );
}

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { openCreate } = useTaskForm();

  const filters = {
    search: searchParams.get("search") ?? "",
    status: searchParams.get("status") ?? "All",
    priority: searchParams.get("priority") ?? "All",
    category: searchParams.get("category") ?? "All",
    scope: searchParams.get("scope") ?? "all",
    sort: searchParams.get("sort") ?? "recent",
    overdue: searchParams.get("overdue") === "true",
  };

  const tasks = useApiData((params, signal) => tasksApi.list(params, signal), { ...filters, overdue: filters.overdue ? "true" : undefined });
  const stats = useApiData((_params, signal) => tasksApi.stats(signal));

  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === "" || value === "All" || value === false || value == null || (key === "scope" && value === "all") || (key === "sort" && value === "recent")) next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const clearAll = () => setSearchParams(new URLSearchParams(), { replace: true });
  const hasActiveFilters = FILTER_KEYS.some((key) => searchParams.has(key));
  const s = stats.data?.stats;
  const list = tasks.data?.tasks ?? [];

  return (
    <div>
      <PageHeader
        title="My Tasks"
        description="Everything you created, were assigned, or that was shared with you."
        actions={<Button onClick={() => openCreate()}><Plus size={16} /> New task</Button>}
      />

      <section aria-label="Task overview" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <OverviewChip testId="chip-all" label="All" count={s?.total} active={filters.status === "All" && !filters.overdue} onClick={() => update({ status: "All", overdue: false })} />
        {STATUSES.map((status) => (
          <OverviewChip key={status} testId={`chip-${status}`} label={status} count={s?.byStatus[status]} dot={statusStyle(status).dot} active={filters.status === status && !filters.overdue} onClick={() => update({ status, overdue: false })} />
        ))}
        <OverviewChip testId="chip-overdue" label="Overdue" count={s?.overdue} dot="bg-red-600" active={filters.overdue} onClick={() => update({ overdue: !filters.overdue, status: "All" })} />
      </section>

      <section aria-label="Filters and sorting" className="card mb-4 p-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <FilterSelect label="Status" value={filters.status} onChange={(status) => update({ status, overdue: false })}>
            <option value="All">All statuses</option>
            {STATUSES.map((item) => <option key={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect label="Priority" value={filters.priority} onChange={(priority) => update({ priority })}>
            <option value="All">All priorities</option>
            {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect label="Category" value={filters.category} onChange={(category) => update({ category })}>
            <option value="All">All categories</option>
            {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect label="Show" value={filters.scope} onChange={(scope) => update({ scope })}>
            {SCOPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </FilterSelect>
          <FilterSelect label="Sort by" value={filters.sort} onChange={(sort) => update({ sort })}>
            {SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </FilterSelect>
        </div>
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        {filters.search && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 py-1 pl-3 pr-1 font-medium text-brand-700" data-testid="search-banner">
            Results for “{filters.search}”
            <button type="button" aria-label="Clear search" onClick={() => update({ search: "" })} className="rounded-full p-1 hover:bg-brand-200"><X size={14} /></button>
          </span>
        )}
        {filters.overdue && <span className={`rounded-full px-3 py-1 text-xs font-bold ${OVERDUE_STYLE.badge}`}>Showing overdue only</span>}
        <span className="text-slate-600" data-testid="result-count">
          {tasks.data ? `${list.length}${tasks.data.total > list.length ? ` of ${tasks.data.total}` : ""} task${tasks.data.total === 1 ? "" : "s"}` : ""}
        </span>
        {hasActiveFilters && <button type="button" onClick={clearAll} className="font-semibold text-brand-700 hover:underline">Clear all filters</button>}
      </div>

      {tasks.loading ? <SkeletonCards />
        : tasks.error && !tasks.data ? <ErrorState message={tasks.error} onRetry={tasks.reload} />
          : list.length === 0 ? (
            hasActiveFilters
              ? <EmptyState icon={SearchX} title="No tasks match" description="Nothing matches your current search and filters." action={<Button variant="secondary" onClick={clearAll}>Clear search and filters</Button>} />
              : <EmptyState icon={ClipboardList} title="No tasks yet" description="Create your first task to start tracking your work." action={<Button onClick={() => openCreate()}><Plus size={16} /> Create task</Button>} />
          ) : <TaskList tasks={list} />}
    </div>
  );
}

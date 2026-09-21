import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { STATUSES } from "../../lib/constants";
import { STATUS_STYLES } from "../../lib/theme";

export function StatCard({ label, value, to, icon: Icon, tone, testId }) {
  return (
    <Link to={to} data-testid={testId} className={`card flex items-center gap-4 border-l-8 p-4 transition-shadow hover:shadow-md ${tone.border}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}><Icon size={22} aria-hidden="true" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-600">{label}</span>
        <span className="block text-3xl font-bold leading-tight text-slate-900" data-testid={`${testId}-value`}>{value}</span>
      </span>
    </Link>
  );
}

export function ChartCard({ title, description, children, testId }) {
  return (
    <section className="card p-5" aria-label={title} data-testid={testId}>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mb-3 text-sm text-slate-600">{description}</p>}
      {children}
    </section>
  );
}

export function StatusPie({ byStatus, total }) {
  const data = STATUSES.map((status) => ({ name: status, value: byStatus[status] }));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={data.filter((d) => d.value).length > 1 ? 2 : 0} stroke="none">
              {data.map((entry) => <Cell key={entry.name} fill={STATUS_STYLES[entry.name].hex} />)}
            </Pie>
            <Tooltip formatter={(value, name) => [`${value} task${value === 1 ? "" : "s"}`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-900">{total}</span>
          <span className="text-xs text-slate-600">tasks</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${STATUS_STYLES[entry.name].dot}`} aria-hidden="true" />
            <span className="text-slate-700">{entry.name}</span>
            <span className="ml-auto font-semibold text-slate-900">{entry.value}</span>
            <span className="w-10 text-right text-xs text-slate-500">{total ? Math.round((entry.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StackedBar({ rows, field }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey={field} tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {STATUSES.map((status) => <Bar key={status} dataKey={status} stackId="a" fill={STATUS_STYLES[status].hex} maxBarSize={48} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressBar({ rate, byStatus, total }) {
  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="text-4xl font-bold text-slate-900" data-testid="completion-rate">{rate}%</span>
        <span className="text-sm text-slate-600">{byStatus.Completed} of {total} completed</span>
      </div>
      <div
        className="mt-3 flex h-4 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={rate}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall completion"
      >
        {STATUSES.slice().reverse().map((status) => (
          <div key={status} className={STATUS_STYLES[status].bar} style={{ width: `${total ? (byStatus[status] / total) * 100 : 0}%` }} title={`${status}: ${byStatus[status]}`} />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">Green completed · Blue in progress · Amber pending</p>
    </div>
  );
}

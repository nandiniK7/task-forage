import { CheckCircle2, CircleDashed, Loader } from "lucide-react";

// Full class names are spelled out so Tailwind can see them at build time.
// Status is the primary visual signal on every task: a thick coloured edge, a tinted card,
// and a solid badge. Icons and text labels back the colour up, so it never relies on colour alone.
export const STATUS_STYLES = {
  Pending: {
    icon: CircleDashed,
    card: "border-amber-300 bg-amber-50 border-l-amber-500",
    badge: "bg-amber-500 text-amber-950",
    soft: "bg-amber-100 text-amber-900 border-amber-300",
    active: "bg-amber-500 text-amber-950 border-amber-600",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-900 border-amber-400",
    bar: "bg-amber-500",
    hex: "#f59e0b",
  },
  "In Progress": {
    icon: Loader,
    card: "border-blue-300 bg-blue-50 border-l-blue-600",
    badge: "bg-blue-600 text-white",
    soft: "bg-blue-100 text-blue-900 border-blue-300",
    active: "bg-blue-600 text-white border-blue-700",
    dot: "bg-blue-600",
    chip: "bg-blue-100 text-blue-900 border-blue-400",
    bar: "bg-blue-600",
    hex: "#2563eb",
  },
  Completed: {
    icon: CheckCircle2,
    card: "border-emerald-300 bg-emerald-50 border-l-emerald-600",
    badge: "bg-emerald-600 text-white",
    soft: "bg-emerald-100 text-emerald-900 border-emerald-300",
    active: "bg-emerald-600 text-white border-emerald-700",
    dot: "bg-emerald-600",
    chip: "bg-emerald-100 text-emerald-900 border-emerald-400",
    bar: "bg-emerald-600",
    hex: "#059669",
  },
};

export const PRIORITY_STYLES = {
  High: { badge: "bg-red-100 text-red-800 border-red-300", text: "text-red-700", hex: "#dc2626" },
  Medium: { badge: "bg-orange-100 text-orange-800 border-orange-300", text: "text-orange-700", hex: "#ea580c" },
  Low: { badge: "bg-slate-100 text-slate-700 border-slate-300", text: "text-slate-600", hex: "#64748b" },
};

export const OVERDUE_STYLE = {
  badge: "bg-red-600 text-white",
  chip: "bg-red-100 text-red-900 border-red-500",
  text: "text-red-700",
  hex: "#dc2626",
};

export const statusStyle = (status) => STATUS_STYLES[status] ?? STATUS_STYLES.Pending;
export const priorityStyle = (priority) => PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.Low;

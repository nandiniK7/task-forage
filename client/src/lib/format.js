const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const isValid = (date) => date instanceof Date && !Number.isNaN(date.getTime());
const toDate = (value) => (value ? new Date(value) : null);

export const formatDate = (value) => {
  const date = toDate(value);
  return isValid(date) ? dateFormat.format(date) : "—";
};
export const formatTime = (value) => {
  const date = toDate(value);
  return isValid(date) ? timeFormat.format(date) : "";
};
export const formatDateTime = (value) => {
  const date = toDate(value);
  return isValid(date) ? dateTimeFormat.format(date) : "—";
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "5 minutes ago", "3 days ago", or a date for anything older than a month. */
export const timeAgo = (value) => {
  const date = toDate(value);
  if (!isValid(date)) return "";
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${plural(Math.floor(diff / MINUTE), "minute")} ago`;
  if (diff < DAY) return `${plural(Math.floor(diff / HOUR), "hour")} ago`;
  if (diff < 30 * DAY) return `${plural(Math.floor(diff / DAY), "day")} ago`;
  return formatDate(date);
};

/**
 * Describes where a task stands against its deadline.
 * tone: "none" | "done" | "overdue" | "soon" (within 3 days) | "normal"
 */
export const deadlineInfo = (task) => {
  if (!task.deadline) return { tone: "none", label: "No deadline", detail: "" };
  const date = new Date(task.deadline);
  const diff = date.getTime() - Date.now();
  const absolute = formatDateTime(date);

  if (task.status === "Completed") return { tone: "done", label: absolute, detail: "Completed" };
  if (diff < 0) {
    const late = -diff;
    const detail = late < HOUR ? "Overdue by minutes" : late < DAY ? `Overdue by ${plural(Math.floor(late / HOUR), "hour")}` : `Overdue by ${plural(Math.floor(late / DAY), "day")}`;
    return { tone: "overdue", label: absolute, detail };
  }
  const detail = diff < HOUR ? "Due within the hour" : diff < DAY ? `Due in ${plural(Math.floor(diff / HOUR), "hour")}` : `Due in ${plural(Math.floor(diff / DAY), "day")}`;
  return { tone: diff <= 3 * DAY ? "soon" : "normal", label: absolute, detail };
};

/** ISO string -> value for <input type="datetime-local"> in the user's own timezone. */
export const toDateTimeLocal = (value) => {
  const date = toDate(value);
  if (!isValid(date)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** <input type="datetime-local"> value -> ISO string (UTC), or null when empty. */
export const fromDateTimeLocal = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? date.toISOString() : null;
};

export const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";

export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const personName = (user, fallback = "Deleted user") => user?.name || user?.email || fallback;

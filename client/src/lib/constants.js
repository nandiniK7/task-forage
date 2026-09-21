export const STATUSES = ["Pending", "In Progress", "Completed"];
export const PRIORITIES = ["Low", "Medium", "High"];
export const CATEGORIES = ["Work", "Personal", "Projects"];

export const REMINDER_OPTIONS = [
  { value: 0, label: "No reminder" },
  { value: 1, label: "1 hour before" },
  { value: 3, label: "3 hours before" },
  { value: 24, label: "1 day before" },
  { value: 48, label: "2 days before" },
  { value: 72, label: "3 days before" },
];

export const SORT_OPTIONS = [
  { value: "recent", label: "Recently created" },
  { value: "deadline_asc", label: "Deadline: soonest first" },
  { value: "deadline_desc", label: "Deadline: latest first" },
  { value: "priority", label: "Priority: high to low" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
];

export const SCOPE_OPTIONS = [
  { value: "all", label: "All my tasks" },
  { value: "assigned", label: "Assigned to me" },
  { value: "created", label: "Created by me" },
  { value: "shared", label: "Shared with me" },
];

export const PERMISSION_OPTIONS = [
  { value: "view", label: "View only" },
  { value: "edit", label: "Can edit" },
];

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip",
];

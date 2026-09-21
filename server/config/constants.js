export const CATEGORIES = ["Work", "Personal", "Projects"];
export const PRIORITIES = ["Low", "Medium", "High"];
export const STATUSES = ["Pending", "In Progress", "Completed"];
export const PERMISSIONS = ["view", "edit"];

export const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3 };

// Hours before the deadline at which a reminder email is sent. 0 disables reminders.
export const REMINDER_OPTIONS = [0, 1, 3, 24, 48, 72];
export const DEFAULT_REMINDER_HOURS = 24;

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TASK = 10;

// Extension -> content type we serve the file back with. The client-supplied mime type is never trusted.
export const ALLOWED_FILE_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".zip": "application/zip",
};

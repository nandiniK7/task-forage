import env from "../config/env.js";
import sendEmail from "../utils/sendEmail.js";
import { escapeHtml } from "../utils/text.js";

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "No deadline";

const layout = ({ heading, intro, task, extraLines = [] }) => {
  const link = `${env.clientUrl.replace(/\/+$/, "")}/tasks/${task._id}`;
  const rows = [
    ["Status", task.status],
    ["Priority", task.priority],
    ["Category", task.category],
    ["Deadline", formatDate(task.deadline)],
    ...extraLines,
  ]
    .map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${escapeHtml(label)}</td><td style="padding:4px 0"><strong>${escapeHtml(value)}</strong></td></tr>`)
    .join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#0f172a">
    <h2 style="margin:0 0 4px">${escapeHtml(heading)}</h2>
    <p style="margin:0 0 16px;color:#334155">${intro}</p>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px">
      <h3 style="margin:0 0 8px">${escapeHtml(task.title)}</h3>
      <table style="font-size:14px;border-collapse:collapse">${rows}</table>
    </div>
    <p style="margin-top:16px"><a href="${escapeHtml(link)}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open task</a></p>
    <p style="color:#94a3b8;font-size:12px">You are receiving this because of activity on a task you are involved in. You can turn email notifications off in Settings.</p>
  </div>`;
};

/**
 * Queues emails without awaiting them. The caller's work is already committed and its
 * response is not delayed or affected by mail delivery; failures are only logged.
 * Users who opted out, the acting user and duplicates are filtered out.
 */
export const notify = ({ recipients, actorId, subject, heading, intro, task, extraLines }) => {
  const seen = new Set(actorId ? [String(actorId)] : []);
  const targets = [];
  for (const user of recipients) {
    if (!user?.email || user.emailNotifications === false) continue;
    const key = String(user._id ?? user.email);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(user);
  }
  if (!targets.length) return;

  const html = layout({ heading, intro, task, extraLines });
  setImmediate(() => {
    for (const user of targets) {
      sendEmail({ to: user.email, subject, html }).catch((error) => console.error("[email] Unexpected error:", error.message));
    }
  });
};

export const taskAssignedEmail = ({ task, actor, recipients }) =>
  notify({
    recipients,
    actorId: actor._id,
    subject: `Task assigned to you: ${task.title}`,
    heading: "A task was assigned to you",
    intro: `<strong>${escapeHtml(actor.name)}</strong> assigned you a task.`,
    task,
  });

export const taskStatusChangedEmail = ({ task, actor, from, recipients }) =>
  notify({
    recipients,
    actorId: actor._id,
    subject: `Status changed to ${task.status}: ${task.title}`,
    heading: "Task status changed",
    intro: `<strong>${escapeHtml(actor.name)}</strong> moved this task from <strong>${escapeHtml(from)}</strong> to <strong>${escapeHtml(task.status)}</strong>.`,
    task,
  });

export const taskUpdatedEmail = ({ task, actor, changes, recipients }) =>
  notify({
    recipients,
    actorId: actor._id,
    subject: `Task updated: ${task.title}`,
    heading: "A task was updated",
    intro: `<strong>${escapeHtml(actor.name)}</strong> updated: ${escapeHtml(changes.join(", "))}.`,
    task,
  });

export const taskSharedEmail = ({ task, actor, recipient, permission }) =>
  notify({
    recipients: [recipient],
    actorId: actor._id,
    subject: `Task shared with you: ${task.title}`,
    heading: "A task was shared with you",
    intro: `<strong>${escapeHtml(actor.name)}</strong> shared a task with you (${permission === "edit" ? "can edit" : "view only"}).`,
    task,
  });

export const deadlineReminderEmail = ({ task, recipients }) =>
  notify({
    recipients,
    subject: `Deadline approaching: ${task.title}`,
    heading: "Deadline approaching",
    intro: `This task is due <strong>${escapeHtml(formatDate(task.deadline))}</strong>.`,
    task,
  });

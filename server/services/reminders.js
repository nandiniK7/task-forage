import Task from "../models/Task.js";
import { deadlineReminderEmail } from "./notifications.js";

/**
 * Finds tasks whose reminder window has opened (deadline - reminderBefore hours <= now),
 * that are not completed and have not been reminded yet, claims each one atomically
 * (so overlapping runs never double-send) and queues the reminder email.
 * Returns the number of tasks reminded.
 */
export const runReminderCheck = async (now = new Date()) => {
  const candidates = await Task.find({
    deadline: { $gt: now },
    status: { $ne: "Completed" },
    reminderBefore: { $gt: 0 },
    reminderSentAt: null,
    $expr: { $lte: [{ $subtract: ["$deadline", { $multiply: ["$reminderBefore", 3600000] }] }, now] },
  })
    .select("_id")
    .limit(200)
    .lean();

  let reminded = 0;
  for (const { _id } of candidates) {
    const task = await Task.findOneAndUpdate({ _id, reminderSentAt: null }, { reminderSentAt: now }, { returnDocument: "after" })
      .populate("createdBy", "name email emailNotifications")
      .populate("assignedTo", "name email emailNotifications");
    if (!task) continue;
    deadlineReminderEmail({ task, recipients: [task.assignedTo, task.createdBy] });
    reminded += 1;
  }
  return reminded;
};

export const startReminderScheduler = (intervalMinutes) => {
  const run = () => runReminderCheck().catch((error) => console.error("Deadline reminder check failed:", error.message));
  run();
  const timer = setInterval(run, intervalMinutes * 60 * 1000);
  timer.unref();
  return timer;
};

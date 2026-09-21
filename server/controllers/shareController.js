import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { getAccess } from "../utils/permissions.js";
import { validateShare } from "../utils/validators.js";
import { loadTask, presentTask } from "../services/taskService.js";
import { taskSharedEmail } from "../services/notifications.js";

/** Owner only: share a task with a registered user as "view" or "edit", or change an existing share. */
export const shareTask = async (req, res) => {
  const { task } = await loadTask(req.params.id, req.user, "owner");
  const { permission, userId, email } = validateShare(req.body);

  const target = userId ? await User.findById(userId) : await User.findOne({ email });
  if (!target) {
    throw ApiError.notFound("No registered user was found. They need to create an account first.");
  }
  if (String(target._id) === String(task.createdBy)) {
    throw ApiError.badRequest("That user already owns this task.");
  }

  const existing = task.sharedWith.find((share) => String(share.user) === String(target._id));
  const changed = !existing || existing.permission !== permission;
  if (existing) existing.permission = permission;
  else task.sharedWith.push({ user: target._id, permission, sharedBy: req.user._id });
  await task.save();

  const { populated, dto } = await presentTask(task._id, req.user._id);
  if (changed) taskSharedEmail({ task: populated, actor: req.user, recipient: target, permission });

  res.json({ success: true, message: `Task shared with ${target.name} (${permission === "edit" ? "can edit" : "view only"}).`, task: dto });
};

/** The owner can remove anyone; a user the task is shared with can remove themselves. */
export const removeShare = async (req, res) => {
  const { task, access } = await loadTask(req.params.id, req.user, "view");
  const targetId = String(req.params.userId);
  const isSelf = targetId === String(req.user._id);

  if (access !== "owner" && !isSelf) throw ApiError.forbidden("Only the task owner can remove other people's access.");

  const before = task.sharedWith.length;
  task.sharedWith = task.sharedWith.filter((share) => String(share.user) !== targetId);
  if (task.sharedWith.length === before) throw ApiError.notFound("This task is not shared with that user.");
  await task.save();

  const stillHasAccess = getAccess(task, req.user._id);
  const task_ = stillHasAccess ? (await presentTask(task._id, req.user._id)).dto : null;
  res.json({ success: true, message: isSelf && access !== "owner" ? "You no longer have access to this task." : "Access removed.", task: task_ });
};

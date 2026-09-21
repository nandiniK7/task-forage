import Task from "../models/Task.js";
import Comment from "../models/Comment.js";
import ApiError from "../utils/ApiError.js";
import { getAccess, hasAccess } from "../utils/permissions.js";
import { toTaskDto } from "../utils/serializers.js";

const USER_FIELDS = "name email emailNotifications";

export const POPULATE_PATHS = [
  { path: "createdBy", select: USER_FIELDS },
  { path: "assignedBy", select: USER_FIELDS },
  { path: "assignedTo", select: USER_FIELDS },
  { path: "sharedWith.user", select: USER_FIELDS },
  { path: "attachments.uploadedBy", select: USER_FIELDS },
];

export const populateTask = (query) => query.populate(POPULATE_PATHS);

/**
 * Loads a task (unpopulated, ready to modify) and enforces the required access level.
 * This is the single place permission checks happen for task-scoped routes.
 */
export const loadTask = async (taskId, user, required = "view") => {
  const task = await Task.findById(taskId);
  if (!task) throw ApiError.notFound("Task not found.");

  const access = getAccess(task, user._id);
  if (!access) throw ApiError.forbidden("You do not have access to this task.");
  if (!hasAccess(access, required)) {
    const message = {
      edit: "You only have view access to this task.",
      owner: "Only the task owner can do that.",
    }[required] ?? "You do not have permission to do that.";
    throw ApiError.forbidden(message);
  }
  return { task, access };
};

export const commentCountFor = (taskId) => Comment.countDocuments({ task: taskId });

/** Re-reads a task with populated users and returns the API shape plus the raw populated doc (for emails). */
export const presentTask = async (taskId, viewerId) => {
  const populated = await populateTask(Task.findById(taskId));
  return { populated, dto: toTaskDto(populated, viewerId, { commentCount: await commentCountFor(taskId) }) };
};

/** Everyone involved with a task: owner, assignee and users it is shared with. */
export const involvedUsers = (populatedTask) => [
  populatedTask.createdBy,
  populatedTask.assignedTo,
  ...populatedTask.sharedWith.map((share) => share.user),
].filter(Boolean);

import { getAccess, permissionsFor } from "./permissions.js";

const plain = (doc) => (doc?.toObject ? doc.toObject() : doc);

const userDto = (user) => (user && user._id ? { _id: user._id, name: user.name, email: user.email } : null);

export const isOverdue = (task, now = new Date()) =>
  Boolean(task.deadline) && task.status !== "Completed" && new Date(task.deadline) < now;

/**
 * Shapes a (populated) task for the API. Users that were deleted come back as `null`,
 * so the client can render "Deleted user" instead of crashing.
 */
export const toTaskDto = (task, viewerId, { commentCount = 0 } = {}) => {
  const t = plain(task);
  const access = getAccess(t, viewerId);
  return {
    _id: t._id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    deadline: t.deadline ?? null,
    completedAt: t.completedAt ?? null,
    reminderBefore: t.reminderBefore,
    isOverdue: isOverdue(t),
    createdBy: userDto(t.createdBy),
    assignedTo: userDto(t.assignedTo),
    assignedBy: userDto(t.assignedBy ?? t.createdBy),
    sharedWith: (t.sharedWith ?? [])
      .map((share) => ({ user: userDto(share.user), permission: share.permission, sharedAt: share.sharedAt }))
      .filter((share) => share.user),
    attachments: (t.attachments ?? []).map((file) => ({
      _id: file._id,
      filename: file.filename,
      contentType: file.contentType,
      size: file.size,
      uploadedBy: userDto(file.uploadedBy),
      uploadedAt: file.uploadedAt,
    })),
    commentCount,
    access,
    permissions: permissionsFor(access),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
};

export const toCommentDto = (comment) => {
  const c = plain(comment);
  return {
    _id: c._id,
    task: c.task,
    parent: c.parent ?? null,
    text: c.text,
    author: userDto(c.author),
    edited: Boolean(c.editedAt),
    editedAt: c.editedAt ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

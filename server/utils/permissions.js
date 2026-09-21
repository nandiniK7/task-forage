const idOf = (value) => String(value?._id ?? value ?? "");

/**
 * Resolves what `userId` may do with `task`. Works with documents and plain/populated objects.
 *   owner - creator of the task: everything, including sharing and deleting
 *   edit  - assignee or a user the task is shared with "edit": may change the task and its files
 *   view  - user the task is shared with "view": read-only (may still join the discussion)
 *   null  - no access
 */
export const getAccess = (task, userId) => {
  const id = idOf(userId);
  if (!id) return null;
  if (idOf(task.createdBy) === id) return "owner";
  const share = (task.sharedWith ?? []).find((item) => idOf(item.user) === id);
  if (idOf(task.assignedTo) === id || share?.permission === "edit") return "edit";
  if (share) return "view";
  return null;
};

const RANK = { view: 1, edit: 2, owner: 3 };

export const hasAccess = (access, required) => Boolean(access) && RANK[access] >= RANK[required];

export const permissionsFor = (access) => ({
  canView: hasAccess(access, "view"),
  canEdit: hasAccess(access, "edit"),
  canDelete: access === "owner",
  canShare: access === "owner",
});

/** Mongo filter matching every task the user can see. */
export const accessFilter = (userId) => ({
  $or: [{ createdBy: userId }, { assignedTo: userId }, { "sharedWith.user": userId }],
});

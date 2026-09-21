import Task from "../models/Task.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import ApiError from "../utils/ApiError.js";
import { CATEGORIES, PRIORITIES, STATUSES } from "../config/constants.js";
import { accessFilter } from "../utils/permissions.js";
import { toTaskDto } from "../utils/serializers.js";
import { escapeRegex } from "../utils/text.js";
import { removeFile } from "../utils/files.js";
import { validateTaskInput } from "../utils/validators.js";
import {
  POPULATE_PATHS, loadTask, presentTask, involvedUsers, populateTask,
} from "../services/taskService.js";
import {
  taskAssignedEmail, taskStatusChangedEmail, taskUpdatedEmail,
} from "../services/notifications.js";

const SORTS = {
  deadline_asc: { noDeadline: 1, deadline: 1, createdAt: -1 },
  deadline_desc: { noDeadline: 1, deadline: -1, createdAt: -1 },
  priority: { priorityRank: -1, noDeadline: 1, deadline: 1, createdAt: -1 },
  recent: { createdAt: -1 },
  oldest: { createdAt: 1 },
  title: { title: 1 },
};
const SORT_ALIASES = { deadline: "deadline_asc", latest: "recent", newest: "recent" };

const param = (value) => (typeof value === "string" ? value.trim() : "");

const parseEnumFilter = (value, allowed, label) => {
  const v = param(value);
  if (!v || v === "All") return null;
  if (!allowed.includes(v)) throw ApiError.badRequest(`Invalid ${label} filter.`);
  return v;
};

const parseDateParam = (value, label) => {
  const v = param(value);
  if (!v) return null;
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest(`Invalid ${label} date.`);
  return date;
};

/** Builds the Mongo filter for the tasks list from query-string parameters. */
const buildListFilter = async (query, userId) => {
  const clauses = [];
  const scope = param(query.scope) || "all";

  if (scope === "assigned") clauses.push({ assignedTo: userId });
  else if (scope === "created") clauses.push({ createdBy: userId });
  else if (scope === "shared") clauses.push({ "sharedWith.user": userId });
  else if (scope === "all") clauses.push(accessFilter(userId));
  else throw ApiError.badRequest("Invalid scope filter.");

  const status = parseEnumFilter(query.status, STATUSES, "status");
  const priority = parseEnumFilter(query.priority, PRIORITIES, "priority");
  const category = parseEnumFilter(query.category, CATEGORIES, "category");
  if (status) clauses.push({ status });
  if (priority) clauses.push({ priority });
  if (category) clauses.push({ category });

  if (param(query.overdue) === "true") {
    clauses.push({ deadline: { $lt: new Date() }, status: { $ne: "Completed" } });
  }

  const dueFrom = parseDateParam(query.dueFrom, "dueFrom");
  const dueTo = parseDateParam(query.dueTo, "dueTo");
  if (dueFrom || dueTo) {
    clauses.push({ deadline: { ...(dueFrom && { $gte: dueFrom }), ...(dueTo && { $lte: dueTo }) } });
  }

  const search = param(query.search).slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const people = await User.find({ $or: [{ name: regex }, { email: regex }] }).select("_id").limit(100).lean();
    const ids = people.map((person) => person._id);
    clauses.push({
      $or: [
        { title: regex },
        { description: regex },
        { category: regex },
        { createdBy: { $in: ids } },
        { assignedBy: { $in: ids } },
        { assignedTo: { $in: ids } },
      ],
    });
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
};

const commentCounts = async (taskIds) => {
  if (!taskIds.length) return new Map();
  const rows = await Comment.aggregate([
    { $match: { task: { $in: taskIds } } },
    { $group: { _id: "$task", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
};

export const listTasks = async (req, res) => {
  const match = await buildListFilter(req.query, req.user._id);
  const sortKey = SORT_ALIASES[param(req.query.sort)] ?? (param(req.query.sort) || "recent");
  const sort = SORTS[sortKey];
  if (!sort) throw ApiError.badRequest(`Invalid sort. Use one of: ${Object.keys(SORTS).join(", ")}.`);
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);

  const [rows, total] = await Promise.all([
    Task.aggregate([
      { $match: match },
      { $addFields: { noDeadline: { $cond: [{ $eq: [{ $type: "$deadline" }, "date"] }, 0, 1] } } },
      { $sort: { ...sort, _id: -1 } },
      { $limit: limit },
    ]).collation({ locale: "en" }),
    Task.countDocuments(match),
  ]);

  const populated = await Task.populate(rows, POPULATE_PATHS);
  const counts = await commentCounts(populated.map((task) => task._id));

  res.json({
    success: true,
    total,
    count: populated.length,
    tasks: populated.map((task) => toTaskDto(task, req.user._id, { commentCount: counts.get(String(task._id)) ?? 0 })),
  });
};

const zeroStatuses = () => Object.fromEntries(STATUSES.map((status) => [status, 0]));

const stackedBreakdown = (rows, keys, field) =>
  keys.map((key) => {
    const entry = { [field]: key, ...zeroStatuses(), total: 0 };
    rows.filter((row) => row._id[field] === key).forEach((row) => {
      entry[row._id.status] = row.count;
      entry.total += row.count;
    });
    return entry;
  });

export const getTaskStats = async (req, res) => {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const match = accessFilter(req.user._id);
  const open = { status: { $ne: "Completed" } };

  const [facets] = await Task.aggregate([
    { $match: match },
    {
      $facet: {
        status: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        priority: [{ $group: { _id: { priority: "$priority", status: "$status" }, count: { $sum: 1 } } }],
        category: [{ $group: { _id: { category: "$category", status: "$status" }, count: { $sum: 1 } } }],
        overdue: [{ $match: { ...open, deadline: { $lt: now } } }, { $count: "n" }],
        dueSoon: [{ $match: { ...open, deadline: { $gte: now, $lte: soon } } }, { $count: "n" }],
      },
    },
  ]);

  const byStatus = zeroStatuses();
  facets.status.forEach((row) => { byStatus[row._id] = row.count; });
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

  const list = (filter, sort, limit) =>
    populateTask(Task.find({ $and: [match, filter] }).sort(sort).limit(limit));

  const [upcoming, overdueTasks, recent] = await Promise.all([
    list({ ...open, deadline: { $gte: now } }, { deadline: 1 }, 8),
    list({ ...open, deadline: { $lt: now } }, { deadline: 1 }, 8),
    list({}, { createdAt: -1 }, 5),
  ]);

  const dto = (task) => toTaskDto(task, req.user._id);

  res.json({
    success: true,
    stats: {
      total,
      byStatus,
      completionRate: total ? Math.round((byStatus.Completed / total) * 100) : 0,
      overdue: facets.overdue[0]?.n ?? 0,
      dueSoon: facets.dueSoon[0]?.n ?? 0,
      byPriority: stackedBreakdown(facets.priority, PRIORITIES, "priority"),
      byCategory: stackedBreakdown(facets.category, CATEGORIES, "category"),
      upcoming: upcoming.map(dto),
      overdueTasks: overdueTasks.map(dto),
      recent: recent.map(dto),
    },
  });
};

export const getTask = async (req, res) => {
  await loadTask(req.params.id, req.user, "view");
  const { dto } = await presentTask(req.params.id, req.user._id);
  res.json({ success: true, task: dto });
};

export const createTask = async (req, res) => {
  const data = validateTaskInput(req.body);

  // Omitted assignee means "assign to me"; an explicit null means unassigned.
  const assigneeId = data.assignedTo === undefined ? req.user._id : data.assignedTo;
  const assignee = assigneeId ? await User.findById(assigneeId) : null;
  if (assigneeId && !assignee) {
    throw ApiError.badRequest("The selected user does not exist.", { errors: { assignedTo: "The selected user does not exist." } });
  }

  const task = await Task.create({
    ...data,
    assignedTo: assignee?._id ?? null,
    assignedBy: assignee ? req.user._id : null,
    createdBy: req.user._id,
  });

  const { populated, dto } = await presentTask(task._id, req.user._id);

  // The task is already saved; email is queued separately and can never fail this request.
  if (assignee) taskAssignedEmail({ task: populated, actor: req.user, recipients: [populated.assignedTo] });

  res.status(201).json({ success: true, message: "Task created.", task: dto });
};

const sameDate = (a, b) => (a ? +new Date(a) : null) === (b ? +new Date(b) : null);

export const updateTask = async (req, res) => {
  const { task } = await loadTask(req.params.id, req.user, "edit");
  const data = validateTaskInput(req.body, { partial: true });
  if (!Object.keys(data).length) throw ApiError.badRequest("Nothing to update.");

  const previousStatus = task.status;
  const changes = [];
  let newAssigneeId = null;

  if ("assignedTo" in data) {
    const nextId = data.assignedTo;
    if (nextId && !(await User.exists({ _id: nextId }))) {
      throw ApiError.badRequest("The selected user does not exist.", { errors: { assignedTo: "The selected user does not exist." } });
    }
    if (String(nextId ?? "") !== String(task.assignedTo ?? "")) {
      task.assignedTo = nextId;
      task.assignedBy = req.user._id;
      newAssigneeId = nextId;
    }
    delete data.assignedTo;
  }

  for (const key of ["title", "description", "category", "priority"]) {
    if (key in data && data[key] !== task[key]) changes.push(key);
  }
  if ("deadline" in data && !sameDate(data.deadline, task.deadline)) changes.push("deadline");

  const reminderInputsChanged = ("deadline" in data && !sameDate(data.deadline, task.deadline))
    || ("reminderBefore" in data && data.reminderBefore !== task.reminderBefore);

  task.set(data);
  if (reminderInputsChanged || (previousStatus === "Completed" && task.status !== "Completed")) {
    task.reminderSentAt = null;
  }
  await task.save();

  const { populated, dto } = await presentTask(task._id, req.user._id);

  let recipients = involvedUsers(populated);
  if (newAssigneeId) {
    taskAssignedEmail({ task: populated, actor: req.user, recipients: [populated.assignedTo] });
    recipients = recipients.filter((user) => String(user._id) !== String(newAssigneeId));
  }
  if (previousStatus !== populated.status) {
    taskStatusChangedEmail({ task: populated, actor: req.user, from: previousStatus, recipients });
  } else if (changes.length) {
    taskUpdatedEmail({ task: populated, actor: req.user, changes, recipients });
  }

  res.json({ success: true, message: "Task updated.", task: dto });
};

export const deleteTask = async (req, res) => {
  const { task } = await loadTask(req.params.id, req.user, "owner");
  await Comment.deleteMany({ task: task._id });
  await Promise.all(task.attachments.map((file) => removeFile(file.fileId)));
  await task.deleteOne();
  res.json({ success: true, message: "Task deleted." });
};

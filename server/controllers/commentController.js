import Comment from "../models/Comment.js";
import ApiError from "../utils/ApiError.js";
import { toCommentDto } from "../utils/serializers.js";
import { validateComment } from "../utils/validators.js";
import { loadTask } from "../services/taskService.js";

const AUTHOR_FIELDS = "name email";

const findComment = async (taskId, commentId) => {
  const comment = await Comment.findOne({ _id: commentId, task: taskId });
  if (!comment) throw ApiError.notFound("Comment not found.");
  return comment;
};

export const listComments = async (req, res) => {
  await loadTask(req.params.id, req.user, "view");
  const comments = await Comment.find({ task: req.params.id }).sort({ createdAt: 1 }).populate("author", AUTHOR_FIELDS);
  res.json({ success: true, comments: comments.map(toCommentDto) });
};

/** Anyone with access to the task (including view-only) can join the discussion. */
export const addComment = async (req, res) => {
  await loadTask(req.params.id, req.user, "view");
  const text = validateComment(req.body);

  let parent = null;
  if (req.body.parentId) {
    parent = await findComment(req.params.id, req.body.parentId).catch(() => {
      throw ApiError.badRequest("The comment you are replying to no longer exists.");
    });
  }

  const comment = await Comment.create({ task: req.params.id, author: req.user._id, parent: parent?._id ?? null, text });
  await comment.populate("author", AUTHOR_FIELDS);
  res.status(201).json({ success: true, message: parent ? "Reply added." : "Comment added.", comment: toCommentDto(comment) });
};

/** Only the author may edit their own comment. */
export const updateComment = async (req, res) => {
  await loadTask(req.params.id, req.user, "view");
  const comment = await findComment(req.params.id, req.params.commentId);
  if (String(comment.author) !== String(req.user._id)) throw ApiError.forbidden("You can only edit your own comments.");

  const text = validateComment(req.body);
  if (text !== comment.text) {
    comment.text = text;
    comment.editedAt = new Date();
    await comment.save();
  }
  await comment.populate("author", AUTHOR_FIELDS);
  res.json({ success: true, message: "Comment updated.", comment: toCommentDto(comment) });
};

/** The author or the task owner may delete a comment; its replies are removed with it. */
export const deleteComment = async (req, res) => {
  const { access } = await loadTask(req.params.id, req.user, "view");
  const comment = await findComment(req.params.id, req.params.commentId);
  const isAuthor = String(comment.author) === String(req.user._id);
  if (!isAuthor && access !== "owner") throw ApiError.forbidden("You can only delete your own comments.");

  const all = await Comment.find({ task: req.params.id }).select("_id parent").lean();
  const childrenOf = new Map();
  all.forEach((item) => {
    const key = String(item.parent ?? "");
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), String(item._id)]);
  });

  const deletedIds = [];
  const queue = [String(comment._id)];
  while (queue.length) {
    const id = queue.shift();
    deletedIds.push(id);
    queue.push(...(childrenOf.get(id) ?? []));
  }

  await Comment.deleteMany({ _id: { $in: deletedIds } });
  res.json({ success: true, message: deletedIds.length > 1 ? "Comment and its replies deleted." : "Comment deleted.", deletedIds });
};

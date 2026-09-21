import { useMemo, useState } from "react";
import { CornerDownRight, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { tasksApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useApiData, useToast } from "../../hooks/hooks";
import { Alert, Avatar, Button, LoadingBlock, ErrorState } from "../ui/primitives";
import { ConfirmDialog } from "../ui/Modal";
import { formatDateTime, personName, timeAgo } from "../../lib/format";

const MAX_INDENT_DEPTH = 5;

function CommentForm({ initialText = "", submitLabel, placeholder, autoFocus = false, onSubmit, onCancel, rows = 3 }) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) { setError("Comment cannot be empty."); return; }
    setBusy(true);
    setError("");
    try {
      await onSubmit(text.trim());
      setText("");
    } catch (err) {
      setError(getFieldErrors(err).text || getErrorMessage(err, "Could not save the comment."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <textarea
        rows={rows}
        value={text}
        autoFocus={autoFocus}
        onChange={(event) => { setText(event.target.value); setError(""); }}
        placeholder={placeholder}
        maxLength={2000}
        aria-label={placeholder}
        className={`field ${error ? "field-error" : ""}`}
      />
      {error && <p className="text-xs font-medium text-red-600" role="alert">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={busy}>{submitLabel}</Button>
        {onCancel && <Button size="sm" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>}
        <span className="ml-auto text-xs text-slate-500">{text.length}/2000</span>
      </div>
    </form>
  );
}

function CommentNode({ node, depth, ctx }) {
  const [mode, setMode] = useState(null); // "reply" | "edit" | null
  const { comment, children } = node;
  const isAuthor = comment.author?._id === ctx.currentUserId;
  const canDelete = isAuthor || ctx.isTaskOwner;
  const author = personName(comment.author);

  return (
    <li className={depth > 0 ? `mt-3 border-l-2 border-brand-200 ${depth <= MAX_INDENT_DEPTH ? "ml-3 pl-3 sm:ml-6 sm:pl-4" : "pl-0"}` : "mt-4 first:mt-0"} data-testid="comment" data-depth={depth}>
      <div className="flex gap-3">
        <Avatar name={author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-slate-900" data-testid="comment-author">{author}</span>
            <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)} className="text-xs text-slate-500">{timeAgo(comment.createdAt)}</time>
            {comment.edited && <span className="text-xs italic text-slate-500" title={`Edited ${formatDateTime(comment.editedAt)}`} data-testid="comment-edited">(edited)</span>}
          </div>

          {mode === "edit" ? (
            <div className="mt-2">
              <CommentForm
                initialText={comment.text}
                submitLabel="Save"
                placeholder="Edit your comment"
                autoFocus
                onCancel={() => setMode(null)}
                onSubmit={async (text) => { await ctx.edit(comment._id, text); setMode(null); }}
              />
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{comment.text}</p>
          )}

          {mode !== "edit" && (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
              <button type="button" onClick={() => setMode(mode === "reply" ? null : "reply")} className="inline-flex items-center gap-1 rounded px-1.5 py-1 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                <CornerDownRight size={13} aria-hidden="true" /> Reply
              </button>
              {isAuthor && (
                <button type="button" onClick={() => setMode("edit")} className="inline-flex items-center gap-1 rounded px-1.5 py-1 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  <Pencil size={13} aria-hidden="true" /> Edit
                </button>
              )}
              {canDelete && (
                <button type="button" onClick={() => ctx.askDelete(comment, children.length)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 font-medium text-red-700 hover:bg-red-50">
                  <Trash2 size={13} aria-hidden="true" /> Delete
                </button>
              )}
            </div>
          )}

          {mode === "reply" && (
            <div className="mt-2">
              <CommentForm
                submitLabel="Post reply"
                placeholder={`Reply to ${author}`}
                autoFocus
                rows={2}
                onCancel={() => setMode(null)}
                onSubmit={async (text) => { await ctx.add(text, comment._id); setMode(null); }}
              />
            </div>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <ul className="list-none">
          {children.map((child) => <CommentNode key={child.comment._id} node={child} depth={depth + 1} ctx={ctx} />)}
        </ul>
      )}
    </li>
  );
}

const buildTree = (comments) => {
  const nodes = new Map(comments.map((comment) => [comment._id, { comment, children: [] }]));
  const roots = [];
  nodes.forEach((node) => {
    const parent = node.comment.parent && nodes.get(node.comment.parent);
    (parent ? parent.children : roots).push(node);
  });
  return roots;
};

export default function Comments({ taskId, currentUser, isTaskOwner }) {
  const toast = useToast();
  const result = useApiData((_params, signal) => tasksApi.comments(taskId, signal), { taskId }, { watchTasks: false });
  const { setData } = result;
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const comments = useMemo(() => result.data?.comments ?? [], [result.data]);
  const tree = useMemo(() => buildTree(comments), [comments]);

  const ctx = useMemo(() => ({
    currentUserId: currentUser._id,
    isTaskOwner,
    add: async (text, parentId = null) => {
      const { comment, message } = await tasksApi.addComment(taskId, { text, parentId });
      setData((data) => ({ ...data, comments: [...data.comments, comment] }));
      toast.success(message);
    },
    edit: async (commentId, text) => {
      const { comment, message } = await tasksApi.updateComment(taskId, commentId, text);
      setData((data) => ({ ...data, comments: data.comments.map((item) => (item._id === commentId ? comment : item)) }));
      toast.success(message);
    },
    askDelete: (comment, replies) => setPendingDelete({ comment, replies }),
  }), [taskId, currentUser._id, isTaskOwner, toast, setData]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const { deletedIds, message } = await tasksApi.deleteComment(taskId, pendingDelete.comment._id);
      setData((data) => ({ ...data, comments: data.comments.filter((item) => !deletedIds.includes(item._id)) }));
      toast.success(message);
      setPendingDelete(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete the comment."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="card p-5" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <MessageSquare size={20} className="text-brand-600" aria-hidden="true" /> Discussion
        <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-700">{comments.length}</span>
      </h2>

      <CommentForm submitLabel="Add comment" placeholder="Write a comment…" onSubmit={(text) => ctx.add(text)} />

      <div className="mt-5">
        {result.loading ? <LoadingBlock label="Loading comments…" />
          : result.error && !result.data ? <ErrorState message={result.error} onRetry={result.reload} />
            : tree.length === 0 ? <Alert tone="info">No comments yet. Start the discussion above.</Alert>
              : <ul className="list-none" data-testid="comment-list">{tree.map((node) => <CommentNode key={node.comment._id} node={node} depth={0} ctx={ctx} />)}</ul>}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete comment?"
        message={pendingDelete?.replies ? "This comment and all replies to it will be permanently deleted." : "This comment will be permanently deleted."}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}

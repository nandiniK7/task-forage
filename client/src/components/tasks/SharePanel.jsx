import { useState } from "react";
import { LogOut, Share2, X } from "lucide-react";
import { tasksApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useToast } from "../../hooks/hooks";
import { Alert, Avatar, Button, IconButton } from "../ui/primitives";
import UserSelect from "./UserSelect";
import { PERMISSION_OPTIONS } from "../../lib/constants";

export default function SharePanel({ task, currentUser, onTaskChange, onLeft }) {
  const toast = useToast();
  const [target, setTarget] = useState(null);
  const [permission, setPermission] = useState("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isOwner = task.permissions.canShare;

  const excludeIds = [task.createdBy?._id, ...task.sharedWith.map((share) => share.user._id)].filter(Boolean);

  const share = async (userId, level) => {
    setBusy(true);
    setError("");
    try {
      const { task: updated, message } = await tasksApi.share(task._id, { userId, permission: level });
      onTaskChange(updated);
      toast.success(message);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "Could not share the task."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!target) { setError("Choose a user to share with."); return; }
    if (await share(target._id, permission)) setTarget(null);
  };

  const remove = async (userId) => {
    setBusy(true);
    setError("");
    try {
      const { task: updated, message } = await tasksApi.unshare(task._id, userId);
      toast.success(message);
      if (updated) onTaskChange(updated);
      else onLeft();
    } catch (err) {
      setError(getErrorMessage(err, "Could not remove access."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5" aria-labelledby="sharing-heading">
      <h2 id="sharing-heading" className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Share2 size={20} className="text-brand-600" aria-hidden="true" /> Sharing
      </h2>

      {error && <Alert className="mb-3">{error}</Alert>}

      {task.sharedWith.length === 0 ? (
        <p className="mb-3 text-sm text-slate-600">{isOwner ? "This task is private. Share it with a registered user to collaborate." : "Not shared with anyone else."}</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100" data-testid="share-list">
          {task.sharedWith.map(({ user, permission: level }) => {
            const isMe = user._id === currentUser._id;
            return (
              <li key={user._id} className="flex items-center gap-2 py-2">
                <Avatar name={user.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{user.name}{isMe ? " (you)" : ""}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                {isOwner ? (
                  <>
                    <select aria-label={`Permission for ${user.name}`} className="field w-auto py-1 text-xs" value={level} disabled={busy} onChange={(event) => share(user._id, event.target.value)}>
                      {PERMISSION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <IconButton label={`Remove access for ${user.name}`} disabled={busy} onClick={() => remove(user._id)} className="hover:bg-red-50 hover:text-red-700"><X size={16} /></IconButton>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{level === "edit" ? "Can edit" : "View only"}</span>
                    {isMe && <Button size="sm" variant="secondary" disabled={busy} onClick={() => remove(user._id)}><LogOut size={14} /> Leave</Button>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isOwner && (
        <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-3" noValidate>
          <div>
            <label htmlFor="share-user" className="mb-1 block text-sm font-medium text-slate-700">Share with</label>
            <UserSelect id="share-user" value={target} onChange={setTarget} excludeIds={excludeIds} placeholder="Choose a registered user" />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="share-permission" className="mb-1 block text-sm font-medium text-slate-700">Permission</label>
              <select id="share-permission" className="field" value={permission} onChange={(event) => setPermission(event.target.value)}>
                {PERMISSION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <Button type="submit" loading={busy}>Share</Button>
          </div>
        </form>
      )}
    </section>
  );
}

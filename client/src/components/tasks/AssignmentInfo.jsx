import { UserCheck, UserPlus, UserRound, Users } from "lucide-react";
import { Avatar } from "../ui/primitives";
import { personName } from "../../lib/format";

function Person({ icon: Icon, label, user, empty, testId }) {
  return (
    <div className="flex min-w-0 items-center gap-2" data-testid={testId}>
      {user ? <Avatar name={personName(user)} size="sm" /> : <Icon size={16} className="text-slate-400" aria-hidden="true" />}
      <div className="min-w-0 leading-tight">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="truncate text-sm font-semibold text-slate-900" title={user?.email}>{user ? personName(user) : empty}</div>
      </div>
    </div>
  );
}

/** "Assigned to" can be several people (a team) at once — shows stacked avatars and the full list of names. */
function Team({ users, testId }) {
  const names = users.map((user) => personName(user)).join(", ");
  return (
    <div className="flex min-w-0 items-center gap-2" data-testid={testId}>
      {users.length === 0 ? (
        <UserRound size={16} className="text-slate-400" aria-hidden="true" />
      ) : users.length === 1 ? (
        <Avatar name={personName(users[0])} size="sm" />
      ) : (
        <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
          {users.slice(0, 3).map((user) => <Avatar key={user._id} name={personName(user)} size="sm" />)}
          {users.length > 3 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">+{users.length - 3}</span>
          )}
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {users.length > 1 && <Users size={11} aria-hidden="true" />} Assigned to
        </div>
        <div className="truncate text-sm font-semibold text-slate-900" title={names}>{users.length ? names : "Unassigned"}</div>
      </div>
    </div>
  );
}

/**
 * Always shows who the task is assigned to (one or more people — a team) and who assigned it.
 * With `showCreator`, the creator is listed too (used on the details page and in the edit dialog).
 */
export default function AssignmentInfo({ task, showCreator = false, layout = "row" }) {
  const sameAsAssigner = task.createdBy?._id && task.createdBy._id === task.assignedBy?._id;
  return (
    <div className={layout === "row" ? "grid grid-cols-1 gap-2 min-[420px]:grid-cols-2" : "space-y-3"}>
      <Team users={task.assignedTo ?? []} testId="assigned-to" />
      <Person icon={UserPlus} label="Assigned by" user={task.assignedBy} empty="Deleted user" testId="assigned-by" />
      {showCreator && !sameAsAssigner && <Person icon={UserCheck} label="Created by" user={task.createdBy} empty="Deleted user" testId="created-by" />}
    </div>
  );
}

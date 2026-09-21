import { UserCheck, UserPlus, UserRound } from "lucide-react";
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

/**
 * Always shows who the task is assigned to and who assigned it.
 * With `showCreator`, the creator is listed too (used on the details page and in the edit dialog).
 */
export default function AssignmentInfo({ task, showCreator = false, layout = "row" }) {
  const sameAsAssigner = task.createdBy?._id && task.createdBy._id === task.assignedBy?._id;
  return (
    <div className={layout === "row" ? "grid grid-cols-1 gap-2 min-[420px]:grid-cols-2" : "space-y-3"}>
      <Person icon={UserRound} label="Assigned to" user={task.assignedTo} empty="Unassigned" testId="assigned-to" />
      <Person icon={UserPlus} label="Assigned by" user={task.assignedBy} empty="Deleted user" testId="assigned-by" />
      {showCreator && !sameAsAssigner && <Person icon={UserCheck} label="Created by" user={task.createdBy} empty="Deleted user" testId="created-by" />}
    </div>
  );
}

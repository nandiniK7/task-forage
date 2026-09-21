import { useState } from "react";
import TaskCard from "./TaskCard";
import { ConfirmDialog } from "../ui/Modal";
import useTaskActions from "../../hooks/useTaskActions";
import { useTaskForm } from "../../hooks/hooks";

/** A grid of task cards wired to edit, delete-with-confirmation and quick status change. */
export default function TaskList({ tasks, columns = "lg:grid-cols-2" }) {
  const { openEdit } = useTaskForm();
  const { busyId, deleting, changeStatus, deleteTask } = useTaskActions();
  const [pendingDelete, setPendingDelete] = useState(null);

  const confirmDelete = async () => {
    if (await deleteTask(pendingDelete)) setPendingDelete(null);
  };

  return (
    <>
      <div className={`grid gap-4 ${columns}`}>
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} onEdit={openEdit} onDelete={setPendingDelete} onStatusChange={changeStatus} statusBusy={busyId === task._id} />
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete task?"
        message={pendingDelete ? `“${pendingDelete.title}” and its comments and attachments will be permanently deleted.` : ""}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

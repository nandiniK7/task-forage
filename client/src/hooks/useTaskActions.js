import { useCallback, useState } from "react";
import { tasksApi } from "../api/services";
import { getErrorMessage } from "../api/client";
import { useTaskEvents, useToast } from "./hooks";

/** Quick status changes and deletion, with toast feedback and a refresh of every task view. */
export default function useTaskActions() {
  const toast = useToast();
  const { notifyChanged } = useTaskEvents();
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const changeStatus = useCallback(async (task, status) => {
    setBusyId(task._id);
    try {
      await tasksApi.update(task._id, { status });
      toast.success(`“${task.title}” marked as ${status}.`);
      notifyChanged();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not change the status."));
    } finally {
      setBusyId(null);
    }
  }, [toast, notifyChanged]);

  const deleteTask = useCallback(async (task) => {
    setDeleting(true);
    try {
      await tasksApi.remove(task._id);
      toast.success(`“${task.title}” was deleted.`);
      notifyChanged();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete the task."));
      return false;
    } finally {
      setDeleting(false);
    }
  }, [toast, notifyChanged]);

  return { busyId, deleting, changeStatus, deleteTask };
}

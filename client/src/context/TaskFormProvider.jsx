import { useCallback, useMemo, useRef, useState } from "react";
import { TaskFormContext } from "./contexts";
import TaskFormModal from "../components/tasks/TaskFormModal";
import { useTaskEvents } from "../hooks/hooks";

/** Hosts the single create/edit dialog so any page can open it with openCreate() / openEdit(task). */
export default function TaskFormProvider({ children }) {
  const { notifyChanged } = useTaskEvents();
  const [dialog, setDialog] = useState(null);
  const nonce = useRef(0);

  const openCreate = useCallback((defaults = {}) => setDialog({ key: ++nonce.current, task: null, defaults }), []);
  const openEdit = useCallback((task) => setDialog({ key: ++nonce.current, task, defaults: {} }), []);
  const close = useCallback(() => setDialog(null), []);

  const value = useMemo(() => ({ openCreate, openEdit }), [openCreate, openEdit]);

  return (
    <TaskFormContext.Provider value={value}>
      {children}
      {dialog && <TaskFormModal key={dialog.key} task={dialog.task} defaults={dialog.defaults} onClose={close} onSaved={notifyChanged} />}
    </TaskFormContext.Provider>
  );
}

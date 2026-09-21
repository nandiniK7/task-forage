import { useState } from "react";
import Modal from "../ui/Modal";
import { Alert, Button, Field } from "../ui/primitives";
import UserSelect from "./UserSelect";
import AssignmentInfo from "./AssignmentInfo";
import { tasksApi } from "../../api/services";
import { getErrorMessage, getFieldErrors } from "../../api/client";
import { useAuth, useToast } from "../../hooks/hooks";
import { CATEGORIES, PRIORITIES, REMINDER_OPTIONS, STATUSES } from "../../lib/constants";
import { fromDateTimeLocal, toDateTimeLocal } from "../../lib/format";

const initialValues = (task, defaults, me) => ({
  title: task?.title ?? defaults.title ?? "",
  description: task?.description ?? "",
  deadline: toDateTimeLocal(task ? task.deadline : defaults.deadline),
  priority: task?.priority ?? "Medium",
  status: task?.status ?? "Pending",
  category: task?.category ?? defaults.category ?? "Work",
  reminderBefore: task?.reminderBefore ?? 24,
  assignedTo: task ? task.assignedTo : (defaults.assignedTo ?? { _id: me._id, name: me.name, email: me.email }),
});

const validate = (values) => {
  const errors = {};
  if (!values.title.trim()) errors.title = "Title is required.";
  else if (values.title.trim().length > 150) errors.title = "Title must be 150 characters or fewer.";
  if (values.description.length > 5000) errors.description = "Description must be 5000 characters or fewer.";
  if (values.deadline && Number.isNaN(new Date(values.deadline).getTime())) errors.deadline = "Enter a valid date and time.";
  return errors;
};

/** Create or edit a task. Mounted fresh (via `key`) each time it opens, so its state always starts clean. */
export default function TaskFormModal({ task = null, defaults = {}, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState(() => initialValues(task, defaults, user));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(task);

  const set = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validate(values);
    if (Object.keys(found).length) { setErrors(found); return; }

    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      deadline: fromDateTimeLocal(values.deadline),
      priority: values.priority,
      status: values.status,
      category: values.category,
      reminderBefore: Number(values.reminderBefore),
      assignedTo: values.assignedTo?._id ?? null,
    };

    setSaving(true);
    setFormError("");
    try {
      const { task: saved, message } = editing ? await tasksApi.update(task._id, payload) : await tasksApi.create(payload);
      toast.success(message || (editing ? "Task updated." : "Task created."));
      onSaved(saved);
      onClose();
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error, "Could not save the task."));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={saving}
      title={editing ? "Edit task" : "Create task"}
      description={editing ? "Changes are saved to your workspace immediately." : "Add the details below. You can share it and attach files afterwards."}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="task-form" loading={saving}>{editing ? "Save changes" : "Create task"}</Button>
        </>
      )}
    >
      <form id="task-form" onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}

        {editing && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><AssignmentInfo task={task} showCreator /></div>
        )}

        <Field label="Title" htmlFor="task-title" error={errors.title} required>
          <input id="task-title" data-autofocus className={`field ${errors.title ? "field-error" : ""}`} value={values.title} onChange={set("title")} maxLength={150} placeholder="e.g. Prepare quarterly report" />
        </Field>

        <Field label="Description" htmlFor="task-description" error={errors.description}>
          <textarea id="task-description" rows={3} className={`field ${errors.description ? "field-error" : ""}`} value={values.description} onChange={set("description")} placeholder="Add any details, links or acceptance criteria" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline" htmlFor="task-deadline" error={errors.deadline} hint="Shown in your local time zone.">
            <input id="task-deadline" type="datetime-local" className={`field ${errors.deadline ? "field-error" : ""}`} value={values.deadline} onChange={set("deadline")} />
          </Field>
          <Field label="Reminder email" htmlFor="task-reminder" error={errors.reminderBefore} hint={values.deadline ? undefined : "Set a deadline to enable reminders."}>
            <select id="task-reminder" className="field" value={values.reminderBefore} onChange={set("reminderBefore")} disabled={!values.deadline}>
              {REMINDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Priority" htmlFor="task-priority" error={errors.priority}>
            <select id="task-priority" className="field" value={values.priority} onChange={set("priority")}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select>
          </Field>
          <Field label="Status" htmlFor="task-status" error={errors.status}>
            <select id="task-status" className="field" value={values.status} onChange={set("status")}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
          </Field>
          <Field label="Category" htmlFor="task-category" error={errors.category}>
            <select id="task-category" className="field" value={values.category} onChange={set("category")}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
          </Field>
        </div>

        <Field label="Assigned to" htmlFor="task-assignee" error={errors.assignedTo} hint="Assign the task to yourself or any registered user.">
          <UserSelect id="task-assignee" value={values.assignedTo} onChange={set("assignedTo")} allowUnassigned invalid={Boolean(errors.assignedTo)} />
        </Field>
      </form>
    </Modal>
  );
}

import { useState } from "react";
import { Bell, KeyRound, LogOut, Trash2, User } from "lucide-react";
import { authApi } from "../api/services";
import { getErrorMessage, getFieldErrors } from "../api/client";
import { useAuth, useToast } from "../hooks/hooks";
import { Alert, Avatar, Button, Field, PageHeader } from "../components/ui/primitives";
import Modal from "../components/ui/Modal";
import { formatDate } from "../lib/format";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Section({ icon: Icon, title, description, children, tone = "default" }) {
  return (
    <section className={`card p-5 ${tone === "danger" ? "border-red-200" : ""}`}>
      <h2 className={`flex items-center gap-2 text-lg font-semibold ${tone === "danger" ? "text-red-700" : "text-slate-900"}`}><Icon size={20} aria-hidden="true" /> {title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ name: user.name, email: user.email });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const unchanged = values.name.trim() === user.name && values.email.trim().toLowerCase() === user.email;

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (values.name.trim().length < 2) found.name = "Name must be at least 2 characters.";
    if (!EMAIL_PATTERN.test(values.email.trim())) found.email = "Enter a valid email address.";
    if (Object.keys(found).length) { setErrors(found); return; }

    setBusy(true);
    setFormError("");
    try {
      const { user: updated, message } = await authApi.updateProfile({ name: values.name.trim(), email: values.email.trim() });
      setUser(updated);
      setValues({ name: updated.name, email: updated.email });
      setErrors({});
      toast.success(message);
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <div className="flex items-center gap-3">
        <Avatar name={user.name} size="lg" />
        <p className="text-sm text-slate-600">Member since {formatDate(user.createdAt)}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="profile-name" error={errors.name}>
          <input id="profile-name" className={`field ${errors.name ? "field-error" : ""}`} value={values.name} onChange={(e) => { setValues({ ...values, name: e.target.value }); setErrors({}); }} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="profile-email" error={errors.email}>
          <input id="profile-email" type="email" className={`field ${errors.email ? "field-error" : ""}`} value={values.email} onChange={(e) => { setValues({ ...values, email: e.target.value }); setErrors({}); }} autoComplete="email" />
        </Field>
      </div>
      <Button type="submit" loading={busy} disabled={unchanged}>Save profile</Button>
    </form>
  );
}

function NotificationToggle() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const enabled = user.emailNotifications !== false;

  const toggle = async () => {
    setBusy(true);
    try {
      const { user: updated } = await authApi.updateProfile({ emailNotifications: !enabled });
      setUser(updated);
      toast.success(updated.emailNotifications ? "Email notifications turned on." : "Email notifications turned off.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-900">Email notifications</p>
        <p className="text-sm text-slate-600">Assignments, updates, status changes and approaching deadlines are sent to {user.email}.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Email notifications"
        disabled={busy}
        onClick={toggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-brand-600" : "bg-slate-300"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function PasswordForm() {
  const toast = useToast();
  const empty = { currentPassword: "", newPassword: "", confirm: "" };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => { setValues({ ...values, [key]: event.target.value }); setErrors({}); };

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!values.currentPassword) found.currentPassword = "Enter your current password.";
    if (values.newPassword.length < 8) found.newPassword = "New password must be at least 8 characters.";
    if (values.confirm !== values.newPassword) found.confirm = "Passwords do not match.";
    if (Object.keys(found).length) { setErrors(found); return; }

    setBusy(true);
    setFormError("");
    try {
      const { message } = await authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success(message);
      setValues(empty);
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <Field label="Current password" htmlFor="current-password" error={errors.currentPassword}>
        <input id="current-password" type="password" autoComplete="current-password" className={`field ${errors.currentPassword ? "field-error" : ""}`} value={values.currentPassword} onChange={set("currentPassword")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="new-password" error={errors.newPassword} hint="At least 8 characters.">
          <input id="new-password" type="password" autoComplete="new-password" className={`field ${errors.newPassword ? "field-error" : ""}`} value={values.newPassword} onChange={set("newPassword")} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-password" error={errors.confirm}>
          <input id="confirm-password" type="password" autoComplete="new-password" className={`field ${errors.confirm ? "field-error" : ""}`} value={values.confirm} onChange={set("confirm")} />
        </Field>
      </div>
      <Button type="submit" loading={busy}>Change password</Button>
    </form>
  );
}

function DeleteAccount() {
  const { logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => { if (!busy) { setOpen(false); setPassword(""); setError(""); } };

  const confirm = async (event) => {
    event.preventDefault();
    if (!password) { setError("Enter your password to confirm."); return; }
    setBusy(true);
    setError("");
    try {
      await authApi.deleteAccount(password);
      toast.success("Your account was deleted.");
      logout();
    } catch (err) {
      setError(getFieldErrors(err).password || getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}><Trash2 size={16} /> Delete my account</Button>
      <Modal
        open={open}
        onClose={close}
        closeDisabled={busy}
        size="sm"
        title="Delete your account?"
        footer={<><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" form="delete-account-form" variant="danger" loading={busy}>Delete permanently</Button></>}
      >
        <form id="delete-account-form" onSubmit={confirm} noValidate className="space-y-3">
          <p className="text-sm text-slate-700">This permanently deletes your account and every task you created, including their comments and files. Tasks assigned to you by others stay, but become unassigned.</p>
          <Field label="Confirm with your password" htmlFor="delete-password" error={error}>
            <input id="delete-password" data-autofocus type="password" autoComplete="current-password" className={`field ${error ? "field-error" : ""}`} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} />
          </Field>
        </form>
      </Modal>
    </>
  );
}

export default function Settings() {
  const { logout } = useAuth();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile, notifications and security." />
      <Section icon={User} title="Profile" description="Your name and email are visible to teammates when tasks are assigned or shared."><ProfileForm /></Section>
      <Section icon={Bell} title="Notifications"><NotificationToggle /></Section>
      <Section icon={KeyRound} title="Password"><PasswordForm /></Section>
      <Section icon={LogOut} title="Session" description="Sign out of TaskForage on this device.">
        <Button variant="secondary" onClick={logout} data-testid="settings-logout"><LogOut size={16} /> Log out</Button>
      </Section>
      <Section icon={Trash2} title="Danger zone" description="Deleting your account cannot be undone." tone="danger"><DeleteAccount /></Section>
    </div>
  );
}

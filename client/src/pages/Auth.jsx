import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { useAuth, useSlowHint } from "../hooks/hooks";
import { getErrorMessage, getFieldErrors } from "../api/client";
import { Alert, Button, Field } from "../components/ui/primitives";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-slate-100 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><CheckSquare size={22} aria-hidden="true" /></span>
          TaskForage
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>
      </div>
    </div>
  );
}

/** Where to go once signed in: the page the user originally asked for, or the dashboard. */
function useDestination() {
  const { state } = useLocation();
  return state?.from?.pathname ? `${state.from.pathname}${state.from.search ?? ""}` : "/dashboard";
}

function useAuthForm(initial, validate, submitAction) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const slow = useSlowHint(busy);

  const set = (key) => (event) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validate(values);
    if (Object.keys(found).length) { setErrors(found); return; }
    setBusy(true);
    setFormError("");
    try {
      await submitAction(values);
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
      setBusy(false);
    }
  };

  return { values, errors, formError, busy, slow, set, submit };
}

export function Login() {
  const { user, login, sessionExpired } = useAuth();
  const destination = useDestination();
  const form = useAuthForm(
    { email: "", password: "" },
    (v) => ({
      ...(!v.email.trim() ? { email: "Email is required." } : !EMAIL_PATTERN.test(v.email.trim()) ? { email: "Enter a valid email address." } : {}),
      ...(!v.password ? { password: "Password is required." } : {}),
    }),
    (v) => login({ email: v.email.trim(), password: v.password })
  );

  if (user) return <Navigate to={destination} replace />;

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your tasks." footer={<>New to TaskForage? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link></>}>
      <form onSubmit={form.submit} noValidate className="space-y-4">
        {sessionExpired && !form.formError && <Alert tone="warning">Your session expired. Please sign in again.</Alert>}
        {form.formError && <Alert>{form.formError}</Alert>}
        <Field label="Email" htmlFor="email" error={form.errors.email}>
          <input id="email" name="email" type="email" autoComplete="email" autoFocus className={`field ${form.errors.email ? "field-error" : ""}`} value={form.values.email} onChange={form.set("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={form.errors.password}>
          <input id="password" name="password" type="password" autoComplete="current-password" className={`field ${form.errors.password ? "field-error" : ""}`} value={form.values.password} onChange={form.set("password")} />
        </Field>
        <Button type="submit" className="w-full" loading={form.busy}>{form.busy ? "Signing in…" : "Sign in"}</Button>
        {form.slow && <Alert tone="info">The server is waking up after being idle. This can take up to a minute the first time.</Alert>}
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const destination = useDestination();
  const form = useAuthForm(
    { name: "", email: "", password: "", confirm: "" },
    (v) => ({
      ...(v.name.trim().length < 2 ? { name: "Name must be at least 2 characters." } : {}),
      ...(!v.email.trim() ? { email: "Email is required." } : !EMAIL_PATTERN.test(v.email.trim()) ? { email: "Enter a valid email address." } : {}),
      ...(v.password.length < 8 ? { password: "Password must be at least 8 characters." } : {}),
      ...(v.confirm !== v.password ? { confirm: "Passwords do not match." } : {}),
    }),
    (v) => register({ name: v.name.trim(), email: v.email.trim(), password: v.password })
  );

  if (user) return <Navigate to={destination} replace />;

  return (
    <AuthShell title="Create your account" subtitle="Start organising, assigning and tracking tasks." footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></>}>
      <form onSubmit={form.submit} noValidate className="space-y-4">
        {form.formError && <Alert>{form.formError}</Alert>}
        <Field label="Full name" htmlFor="name" error={form.errors.name}>
          <input id="name" name="name" autoComplete="name" autoFocus className={`field ${form.errors.name ? "field-error" : ""}`} value={form.values.name} onChange={form.set("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={form.errors.email}>
          <input id="email" name="email" type="email" autoComplete="email" className={`field ${form.errors.email ? "field-error" : ""}`} value={form.values.email} onChange={form.set("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={form.errors.password} hint="At least 8 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" className={`field ${form.errors.password ? "field-error" : ""}`} value={form.values.password} onChange={form.set("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={form.errors.confirm}>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" className={`field ${form.errors.confirm ? "field-error" : ""}`} value={form.values.confirm} onChange={form.set("confirm")} />
        </Field>
        <Button type="submit" className="w-full" loading={form.busy}>{form.busy ? "Creating account…" : "Create account"}</Button>
        {form.slow && <Alert tone="info">The server is waking up after being idle. This can take up to a minute the first time.</Alert>}
      </form>
    </AuthShell>
  );
}

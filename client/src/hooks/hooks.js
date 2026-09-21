import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext, TaskEventsContext, TaskFormContext, ToastContext } from "../context/contexts";
import { getErrorMessage, isCancelled } from "../api/client";

const useRequiredContext = (context, name) => {
  const value = useContext(context);
  if (!value) throw new Error(`${name} must be used inside its provider.`);
  return value;
};

export const useAuth = () => useRequiredContext(AuthContext, "useAuth");
export const useToast = () => useRequiredContext(ToastContext, "useToast");
export const useTaskEvents = () => useRequiredContext(TaskEventsContext, "useTaskEvents");
/** Returns { openCreate(defaults?), openEdit(task) } for the shared create/edit task dialog. */
export const useTaskForm = () => useRequiredContext(TaskFormContext, "useTaskForm");

/**
 * Loads data and keeps it fresh.
 *  - `fetcher(params, signal)` is re-run when `params` change, when any task changes
 *    (unless `watchTasks` is false), or when `reload()` is called.
 *  - In-flight requests are aborted when superseded, so a slow old response can never overwrite a newer one.
 *  - Existing data stays on screen while it refreshes; `loading` is only true for the first load.
 */
export function useApiData(fetcher, params = {}, { watchTasks = true } = {}) {
  const { version } = useTaskEvents();
  const [state, setState] = useState({ data: null, dataKey: null, settledKey: null, error: null });
  const [reloadCount, setReloadCount] = useState(0);
  const fetcherRef = useRef(fetcher);
  const paramsKey = JSON.stringify(params);
  const requestKey = `${paramsKey}|${watchTasks ? version : 0}|${reloadCount}`;

  useEffect(() => { fetcherRef.current = fetcher; });

  useEffect(() => {
    const controller = new AbortController();

    fetcherRef.current(JSON.parse(paramsKey), controller.signal)
      .then((data) => setState({ data, dataKey: paramsKey, settledKey: requestKey, error: null }))
      .catch((error) => {
        if (isCancelled(error)) return;
        setState((current) => ({ ...current, settledKey: requestKey, error: getErrorMessage(error, "Could not load data.") }));
      });

    return () => controller.abort();
  }, [paramsKey, requestKey]);

  // Loading state is derived, not stored: data belongs to the params it was fetched with, and a request is
  // "pending" until the latest request key has settled. Changing params shows the loading state again,
  // while a refresh (a task changed, or reload()) keeps the current data on screen.
  const data = state.dataKey === paramsKey ? state.data : null;
  const pending = state.settledKey !== requestKey;
  const error = pending ? null : state.error;

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const setData = useCallback((updater) => setState((current) => ({ ...current, data: typeof updater === "function" ? updater(current.data) : updater })), []);

  return { data, loading: pending && data === null, refreshing: pending && data !== null, error, reload, setData };
}

/** Returns `value` after it has stopped changing for `delay` ms. */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** True once `active` has been true for `delay` ms; used to explain slow (cold-start) requests. */
export function useSlowHint(active, delay = 5000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setSlow(true), delay);
    return () => { window.clearTimeout(timer); setSlow(false); };
  }, [active, delay]);
  return slow;
}

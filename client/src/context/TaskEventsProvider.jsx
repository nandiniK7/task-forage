import { useCallback, useMemo, useState } from "react";
import { TaskEventsContext } from "./contexts";

/**
 * A tiny change signal. Whenever a task is created, edited, deleted or shared, `notifyChanged()`
 * bumps `version`, and every page or widget that loads task data re-fetches. That keeps the
 * task list, dashboard, calendar and navbar alerts in step without a page refresh.
 */
export default function TaskEventsProvider({ children }) {
  const [version, setVersion] = useState(0);
  const notifyChanged = useCallback(() => setVersion((current) => current + 1), []);
  const value = useMemo(() => ({ version, notifyChanged }), [version, notifyChanged]);
  return <TaskEventsContext.Provider value={value}>{children}</TaskEventsContext.Provider>;
}

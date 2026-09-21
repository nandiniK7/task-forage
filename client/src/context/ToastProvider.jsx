import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { ToastContext } from "./contexts";

const STYLES = {
  success: { icon: CheckCircle2, classes: "border-emerald-300 bg-emerald-50 text-emerald-900", iconClass: "text-emerald-600" },
  error: { icon: XCircle, classes: "border-red-300 bg-red-50 text-red-900", iconClass: "text-red-600" },
  info: { icon: Info, classes: "border-blue-300 bg-blue-50 text-blue-900", iconClass: "text-blue-600" },
};

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const push = useCallback((type, message, duration) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-3), { id, type, message }]);
    window.setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (message) => push("success", message, 4000),
    error: (message) => push("error", message, 7000),
    info: (message) => push("info", message, 5000),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-start sm:pl-6" role="region" aria-label="Notifications">
        {toasts.map(({ id, type, message }) => {
          const { icon: Icon, classes, iconClass } = STYLES[type];
          return (
            <div key={id} role={type === "error" ? "alert" : "status"} className={`pointer-events-none flex w-full max-w-sm items-start gap-3 rounded-lg border p-3 text-sm shadow-lg ${classes}`}>
              <Icon size={18} className={`mt-0.5 shrink-0 ${iconClass}`} aria-hidden="true" />
              <p className="min-w-0 flex-1 break-words">{message}</p>
              <button type="button" onClick={() => dismiss(id)} aria-label="Dismiss notification" className="pointer-events-auto rounded p-0.5 opacity-70 hover:opacity-100"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

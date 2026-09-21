import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/hooks";
import { FullPageLoader } from "./primitives";
import TaskFormProvider from "../../context/TaskFormProvider";

/** Only signed-in users get past this; everyone else is sent to /login and returned afterwards. */
export default function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return (
    <TaskFormProvider>
      <Outlet />
    </TaskFormProvider>
  );
}

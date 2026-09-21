import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthProvider from "./context/AuthProvider";
import ToastProvider from "./context/ToastProvider";
import TaskEventsProvider from "./context/TaskEventsProvider";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import { Login, Register } from "./pages/Auth";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Calendar from "./pages/Calendar";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { LoadingBlock } from "./components/ui/primitives";

// The dashboard pulls in the charting library, so it is loaded on demand.
const Dashboard = lazy(() => import("./pages/Dashboard"));

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <TaskEventsProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Suspense fallback={<LoadingBlock />}><Dashboard /></Suspense>} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/tasks/:id" element={<TaskDetail />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Route>
              </Routes>
            </TaskEventsProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

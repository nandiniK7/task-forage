import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CalendarDays, CheckSquare, LayoutDashboard, ListChecks, Plus, Settings, Users, X } from "lucide-react";
import Navbar from "./Navbar";
import { IconButton } from "../ui/primitives";
import { useTaskForm } from "../../hooks/hooks";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "My Tasks", icon: ListChecks },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/team", label: "Team", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavigate, onClose }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><CheckSquare size={18} aria-hidden="true" /></span>
          TaskForage
        </span>
        {onClose && <IconButton label="Close navigation menu" onClick={onClose}><X size={20} /></IconButton>}
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to !== "/tasks"}
            onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"}`}
          >
            <Icon size={18} aria-hidden="true" /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function AppLayout() {
  // The mobile menu is open only for the page it was opened on, so any navigation closes it.
  const [menuPath, setMenuPath] = useState(null);
  const { pathname } = useLocation();
  const { openCreate } = useTaskForm();
  const menuOpen = menuPath === pathname;
  const setMenuOpen = (open) => setMenuPath(open ? pathname : null);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <SidebarContent onNavigate={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <Navbar onMenuClick={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6"><Outlet /></main>
      </div>

      <button
        type="button"
        onClick={() => openCreate()}
        aria-label="Create task"
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 sm:hidden"
      >
        <Plus size={26} />
      </button>
    </div>
  );
}

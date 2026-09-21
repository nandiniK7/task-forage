import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Bell, Clock, LogOut, Menu, Plus, Search, Settings, X } from "lucide-react";
import { tasksApi } from "../../api/services";
import { useApiData, useAuth, useDebounced, useTaskForm } from "../../hooks/hooks";
import { Avatar, IconButton } from "../ui/primitives";
import { deadlineInfo } from "../../lib/format";

/**
 * Global task search. The query lives in the URL (/tasks?search=...), so results survive
 * refreshes and shared links, and the Tasks page reads it and asks the API to filter.
 * Typing searches after a short pause; Enter searches immediately; the X clears it.
 */
function NavbarSearch() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const urlQuery = pathname === "/tasks" ? (searchParams.get("search") ?? "") : "";
  const [query, setQuery] = useState(urlQuery);
  const lastPushed = useRef(urlQuery);
  const debounced = useDebounced(query, 400);

  // Follow external changes (clear button on the page, back/forward, links) but ignore our own pushes,
  // so a slow navigation can never overwrite what the user is still typing.
  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery;
      setQuery(urlQuery);
    }
  }, [urlQuery]);

  const go = (value) => {
    const term = value.trim();
    if (term === lastPushed.current && pathname === "/tasks") return;
    lastPushed.current = term;
    const next = new URLSearchParams(pathname === "/tasks" ? searchParams : undefined);
    if (term) next.set("search", term); else next.delete("search");
    const qs = next.toString();
    navigate(`/tasks${qs ? `?${qs}` : ""}`, { replace: pathname === "/tasks" });
  };

  // Live search: only after typing, never on the initial mount.
  useEffect(() => {
    if (debounced.trim() !== lastPushed.current && debounced === query) go(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` reads current router state; only a settled query should trigger it
  }, [debounced]);

  const clear = () => { setQuery(""); go(""); };

  return (
    <form role="search" onSubmit={(event) => { event.preventDefault(); go(query); }} className="relative min-w-0 flex-1 sm:max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search tasks, people, categories…"
        aria-label="Search tasks"
        data-testid="navbar-search"
        className="field h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button type="button" onClick={clear} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><X size={16} /></button>
      )}
    </form>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const stats = useApiData((_params, signal) => tasksApi.stats(signal));
  const s = stats.data?.stats;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const overdue = s?.overdueTasks ?? [];
  const upcoming = (s?.upcoming ?? []).filter((task) => deadlineInfo(task).tone === "soon");
  const count = (s?.overdue ?? 0) + (s?.dueSoon ?? 0);

  return (
    <div ref={ref} className="relative">
      <IconButton label={count ? `${count} task alerts` : "No task alerts"} onClick={() => setOpen((value) => !value)} aria-expanded={open} className="relative">
        <Bell size={20} />
        {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white" data-testid="alert-count">{count > 9 ? "9+" : count}</span>}
      </IconButton>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Deadline alerts</div>
          <div className="max-h-80 overflow-y-auto py-1">
            {overdue.length === 0 && upcoming.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">You’re all caught up. Nothing is overdue or due soon.</p>}
            {overdue.map((task) => (
              <Link key={task._id} to={`/tasks/${task._id}`} onClick={() => setOpen(false)} className="flex items-start gap-2 px-4 py-2 hover:bg-slate-50">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{task.title}</span><span className="text-xs font-semibold text-red-700">{deadlineInfo(task).detail}</span></span>
              </Link>
            ))}
            {upcoming.map((task) => (
              <Link key={task._id} to={`/tasks/${task._id}`} onClick={() => setOpen(false)} className="flex items-start gap-2 px-4 py-2 hover:bg-slate-50">
                <Clock size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{task.title}</span><span className="text-xs font-semibold text-amber-800">{deadlineInfo(task).detail}</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Account menu" className="flex items-center rounded-full p-0.5 hover:bg-slate-100"><Avatar name={user.name} size="lg" /></button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900" data-testid="menu-user-name">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Settings size={16} /> Profile &amp; settings</Link>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50" data-testid="logout"><LogOut size={16} /> Log out</button>
        </div>
      )}
    </div>
  );
}

export default function Navbar({ onMenuClick }) {
  const { openCreate } = useTaskForm();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <IconButton label="Open navigation menu" onClick={onMenuClick} className="lg:hidden"><Menu size={22} /></IconButton>
        <NavbarSearch />
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button type="button" onClick={() => openCreate()} className="hidden items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 sm:inline-flex"><Plus size={16} /> New task</button>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

import { useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { usersApi } from "../api/services";
import { useApiData, useDebounced, useTaskForm } from "../hooks/hooks";
import { Avatar, Button, EmptyState, ErrorState, LoadingBlock, PageHeader } from "../components/ui/primitives";

export default function Team() {
  const { openCreate } = useTaskForm();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim(), 300);
  const result = useApiData((params, signal) => usersApi.list(params.search, signal, 100), { search }, { watchTasks: false });
  const users = result.data?.users ?? [];

  return (
    <div>
      <PageHeader title="Team" description="Everyone registered on TaskForage. Assign work to a teammate straight from here." />

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" aria-label="Search team members" className="field pl-9" />
      </div>

      {result.loading ? <LoadingBlock label="Loading team…" />
        : result.error && !result.data ? <ErrorState message={result.error} onRetry={result.reload} />
          : users.length === 0 ? <EmptyState icon={Users} title="No one found" description="No registered user matches your search." />
            : (
              <ul className="card divide-y divide-slate-100" data-testid="team-list">
                {users.map((member) => (
                  <li key={member._id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={member.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{member.name}{member.isMe && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">You</span>}</p>
                      <p className="truncate text-xs text-slate-600">{member.email}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => openCreate({ assignedTo: { _id: member._id, name: member.name, email: member.email } })}>
                      <UserPlus size={14} /> <span className="hidden sm:inline">Assign a task</span><span className="sm:hidden">Assign</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
    </div>
  );
}

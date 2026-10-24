import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, UserX, X } from "lucide-react";
import { usersApi } from "../../api/services";
import { getErrorMessage, isCancelled } from "../../api/client";
import { useDebounced } from "../../hooks/hooks";
import { Avatar, Spinner } from "../ui/primitives";

/**
 * Searchable picker for registered users, backed by GET /users?search=.
 *
 * Single mode (default): `value` is a user object ({ _id, name, email }) or null.
 * With `allowUnassigned`, "Unassigned" is offered.
 *
 * `multiple`: `value` is an array of user objects — lets a task be assigned to several
 * people at once (a team), not just one. Already-selected people are excluded from the
 * list and the dropdown stays open so more than one can be picked in a row.
 */
export default function UserSelect({ id, value, onChange, allowUnassigned = false, multiple = false, excludeIds = [], disabled = false, invalid = false, placeholder = "Select a user" }) {
  const generatedId = useId();
  const listId = `${generatedId}-list`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ key: null, users: [], error: "" });
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebounced(query, 250);
  const selectedIds = multiple ? (value ?? []).map((user) => user._id) : [];
  const excludeKey = [...excludeIds, ...selectedIds].join(",");
  const requestKey = `${debouncedQuery}|${excludeKey}`;
  const { users, error } = result;
  const loading = open && result.key !== requestKey;

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    usersApi
      .list(debouncedQuery, controller.signal)
      .then(({ users: found }) => {
        const excluded = excludeKey ? excludeKey.split(",") : [];
        const visible = found.filter((user) => !excluded.includes(user._id));
        setResult({ key: requestKey, users: [...visible].sort((a, b) => Number(b.isMe) - Number(a.isMe)), error: "" });
        setActiveIndex(0);
      })
      .catch((err) => {
        if (isCancelled(err)) return;
        setResult({ key: requestKey, users: [], error: getErrorMessage(err, "Could not load users.") });
      });
    return () => controller.abort();
  }, [open, debouncedQuery, excludeKey, requestKey]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const options = [...(allowUnassigned && !multiple && !query.trim() ? [{ _id: null, name: "Unassigned" }] : []), ...users];

  const choose = (option) => {
    if (multiple) {
      const next = [...(value ?? []), { _id: option._id, name: option.name, email: option.email }];
      onChange(next);
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    onChange(option._id ? { _id: option._id, name: option.name, email: option.email } : null);
    setOpen(false);
    setQuery("");
  };

  const remove = (userId) => onChange((value ?? []).filter((user) => user._id !== userId));

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, options.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter") { event.preventDefault(); if (options[activeIndex]) choose(options[activeIndex]); }
    else if (event.key === "Escape") { event.stopPropagation(); setOpen(false); }
  };

  return (
    <div ref={rootRef} className="relative">
      {multiple ? (
        <div className={`field flex flex-wrap items-center gap-1.5 ${invalid ? "field-error" : ""} ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          {(value ?? []).length === 0 && <span className="mr-auto text-slate-500">{placeholder}</span>}
          {(value ?? []).map((user) => (
            <span key={user._id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-1 pr-1 text-xs font-medium text-brand-700">
              <Avatar name={user.name || user.email} size="sm" />
              <span className="max-w-[9rem] truncate">{user.name || user.email}</span>
              <button type="button" aria-label={`Remove ${user.name || user.email}`} onClick={() => remove(user._id)} className="rounded-full p-0.5 hover:bg-brand-100">
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            id={id}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((current) => !current)}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Plus size={14} aria-hidden="true" /> Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
          className={`field flex items-center justify-between gap-2 text-left ${invalid ? "field-error" : ""}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {value ? <Avatar name={value.name || value.email} size="sm" /> : <UserX size={16} className="text-slate-400" aria-hidden="true" />}
            <span className={`truncate ${value ? "text-slate-900" : "text-slate-500"}`}>{value ? (value.name || value.email) : (allowUnassigned ? "Unassigned" : placeholder)}</span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
        </button>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
            <Search size={16} className="text-slate-400" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search by name or email"
              aria-label="Search users"
              aria-controls={listId}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            {loading && <Spinner className="h-4 w-4 text-slate-400" />}
          </div>
          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto py-1">
            {error && <li className="px-3 py-2 text-sm text-red-600">{error}</li>}
            {!error && !loading && options.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No registered users found.</li>}
            {options.map((option, index) => {
              const selected = multiple ? false : (value?._id ?? null) === option._id;
              return (
                <li
                  key={option._id ?? "unassigned"}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => { event.preventDefault(); choose(option); }}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${index === activeIndex ? "bg-brand-50" : ""}`}
                >
                  {option._id ? <Avatar name={option.name} size="sm" /> : <UserX size={16} className="text-slate-400" aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">{option.name}{option.isMe ? " (you)" : ""}</span>
                    {option.email && <span className="block truncate text-xs text-slate-500">{option.email}</span>}
                  </span>
                  {selected && <Check size={16} className="text-brand-600" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

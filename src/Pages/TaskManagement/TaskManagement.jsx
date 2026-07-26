import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../Firebase";
import { COLLECTIONS } from "../../collections";
import { getAdminSession } from "../../Utils/adminSession";
import {
  getTaskRole,
  getTaskRoleLabel,
  normalizeTaskRoleKey,
  TASK_ROLE_OPTIONS,
  TASK_STATUSES,
} from "../../Utils/taskManagement";

const STATUSES = TASK_STATUSES;
const PAGE_SIZES = [10, 20, 50];

const STATUS_STYLE = {
  Initiated: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20",
  Working: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
  Pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
};

function IconTasks() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
    </svg>
  );
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(toMillis(value) || value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i += 1) pages.push(i);
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700 disabled:opacity-40">Previous</button>
      {pages[0] > 1 && <button type="button" onClick={() => onChange(1)} className="w-8 h-8 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800">1</button>}
      {pages[0] > 2 && <span className="text-gray-400">…</span>}
      {pages.map((number) => (
        <button key={number} type="button" onClick={() => onChange(number)} className={`w-8 h-8 rounded-lg text-sm font-semibold ${number === page ? "bg-violet-600 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
          {number}
        </button>
      ))}
      {pages.at(-1) < totalPages - 1 && <span className="text-gray-400">…</span>}
      {pages.at(-1) < totalPages && <button type="button" onClick={() => onChange(totalPages)} className="w-8 h-8 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800">{totalPages}</button>}
      <button type="button" disabled={page === totalPages} onClick={() => onChange(page + 1)} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700 disabled:opacity-40">Next</button>
    </div>
  );
}

function EditTaskModal({ task, saving, canReassign, onSave, onClose }) {
  const existingRole = getTaskRole(task.assignedRoleKey || task.assignedRole);
  const [form, setForm] = useState({
    name: task.name || "",
    taskDate: task.taskDate || "",
    description: task.description || "",
    companyName: task.companyName || "",
    status: STATUSES.includes(task.status) ? task.status : "Initiated",
    assignedRoleKey: existingRole.key,
  });
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const selectedRole = getTaskRole(form.assignedRoleKey);
    if (!form.name.trim() || !form.taskDate || !form.description.trim() || !normalizeTaskRoleKey(selectedRole.key)) {
      setError("Name, date, description and assigned role are required.");
      return;
    }
    onSave({
      name: form.name.trim(),
      taskDate: form.taskDate,
      description: form.description.trim(),
      companyName: form.companyName.trim(),
      status: form.status,
      assignedRoleKey: selectedRole.key,
      assignedRole: selectedRole.label,
    });
  };

  const set = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Task</h2>
            <p className="text-xs text-gray-400">Updates are visible to the marketing member.</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Task Name
              <input value={form.name} maxLength={120} onChange={(event) => set("name", event.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 normal-case font-normal" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Task Date
              <input type="date" value={form.taskDate} onChange={(event) => set("taskDate", event.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 normal-case font-normal" />
            </label>
          </div>
          <label className="space-y-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide block">
            Company Name <span className="normal-case text-gray-400 font-normal">(optional)</span>
            <input value={form.companyName} maxLength={150} onChange={(event) => set("companyName", event.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 normal-case font-normal" />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Status
              <select value={form.status} onChange={(event) => set("status", event.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 normal-case font-normal">
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Assigned Role
              <select
                value={form.assignedRoleKey}
                disabled={!canReassign}
                onChange={(event) => set("assignedRoleKey", event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 normal-case font-normal disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {TASK_ROLE_OPTIONS.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
              </select>
            </label>
          </div>
          <label className="space-y-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide block">
            Description
            <textarea rows={5} value={form.description} maxLength={2000} onChange={(event) => set("description", event.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 resize-y normal-case font-normal" />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TaskManagement() {
  const admin = useMemo(() => getAdminSession() || {}, []);
  const adminRoleKey = useMemo(() => normalizeTaskRoleKey(admin.role), [admin.role]);
  const isMasterAdmin = adminRoleKey === "master_admin";
  const canAccess = isMasterAdmin || (admin.assigntab || []).includes("taskmanagement");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return undefined;
    }
    if (!isMasterAdmin && !adminRoleKey) {
      setTasks([]);
      setError("Your admin role is not supported for role-based task assignment. Ask Master Admin to update your role.");
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");
    const taskSource = isMasterAdmin
      ? collection(db, COLLECTIONS.TASKM)
      : query(
        collection(db, COLLECTIONS.TASKM),
        where("assignedRoleKey", "==", adminRoleKey),
      );

    const unsubscribe = onSnapshot(
      taskSource,
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        items.sort((a, b) => (b.taskDate || "").localeCompare(a.taskDate || "") || toMillis(b.createdAt) - toMillis(a.createdAt));
        setTasks(items);
        setSelected((previous) => {
          const visibleIds = new Set(items.map((item) => item.id));
          return new Set(Array.from(previous).filter((id) => visibleIds.has(id)));
        });
        setLoading(false);
      },
      (taskError) => {
        console.error(taskError);
        setError("Tasks could not be loaded. Apply the included role-based Firestore rule update and try again.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [adminRoleKey, canAccess, isMasterAdmin, reloadKey]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (status && task.status !== status) return false;
      if (roleFilter && normalizeTaskRoleKey(task.assignedRoleKey || task.assignedRole) !== roleFilter) return false;
      if (dateFrom && (task.taskDate || "") < dateFrom) return false;
      if (dateTo && (task.taskDate || "") > dateTo) return false;
      if (!needle) return true;
      return [task.name, task.description, task.companyName, task.createdByName, task.assignedRole]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [tasks, search, status, roleFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, status, roleFilter, dateFrom, dateTo, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pageSelected = pageItems.length > 0 && pageItems.every((task) => selected.has(task.id));
  const togglePage = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      pageItems.forEach((task) => pageSelected ? next.delete(task.id) : next.add(task.id));
      return next;
    });
  };
  const toggleOne = (id) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const updateStatus = async (task, nextStatus) => {
    if (!STATUSES.includes(nextStatus) || nextStatus === task.status) return;
    const previousStatus = task.status;
    const assignedRole = getTaskRole(task.assignedRoleKey || task.assignedRole);
    setTasks((items) => items.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    try {
      await updateDoc(doc(db, COLLECTIONS.TASKM, task.id), {
        status: nextStatus,
        assignedRoleKey: assignedRole.key,
        assignedRole: assignedRole.label,
        updatedAt: serverTimestamp(),
        updatedByUid: admin.uid || "",
        updatedByName: admin.name || "Admin",
        updatedByPanel: "admin",
      });
    } catch (statusError) {
      console.error(statusError);
      setTasks((items) => items.map((item) => item.id === task.id ? { ...item, status: previousStatus } : item));
      setError("Task status could not be updated.");
    }
  };

  const saveEdit = async (payload) => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const updates = {
        ...payload,
        updatedAt: serverTimestamp(),
        updatedByUid: admin.uid || "",
        updatedByName: admin.name || "Admin",
        updatedByPanel: "admin",
      };
      await updateDoc(doc(db, COLLECTIONS.TASKM, editing.id), updates);
      setTasks((items) => items.map((item) => item.id === editing.id ? { ...item, ...payload } : item));
      setEditing(null);
    } catch (saveError) {
      console.error(saveError);
      setError("Task could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteIds = async (ids) => {
    if (!ids.length) return;
    const label = ids.length === 1 ? "this task" : `${ids.length} selected tasks`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    setError("");
    try {
      if (ids.length === 1) {
        await deleteDoc(doc(db, COLLECTIONS.TASKM, ids[0]));
      } else {
        // Firestore accepts at most 500 writes per batch. Keep headroom so a
        // large cross-page selection remains safe.
        for (let start = 0; start < ids.length; start += 450) {
          const batch = writeBatch(db);
          ids.slice(start, start + 450).forEach((id) => batch.delete(doc(db, COLLECTIONS.TASKM, id)));
          await batch.commit();
        }
      }
      const removed = new Set(ids);
      setTasks((items) => items.filter((item) => !removed.has(item.id)));
      setSelected((previous) => {
        const next = new Set(previous);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } catch (deleteError) {
      console.error(deleteError);
      setError("Selected tasks could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setRoleFilter("");
    setDateFrom("");
    setDateTo("");
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center"><IconTasks /></div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Task Management access not assigned</h2>
        <p className="text-sm text-gray-400 max-w-sm">Master Admin can enable the Task Management tab from Admin Management.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-violet-600"><IconTasks /></span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Task Management</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {isMasterAdmin
              ? "All role-based tasks sent by marketing members."
              : `Tasks assigned to the ${getTaskRoleLabel(adminRoleKey, admin.role || "current")} role.`}
          </p>
        </div>
        <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-50">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          ["Total", tasks.length, "text-gray-700 dark:text-gray-200"],
          ["Initiated", tasks.filter((task) => task.status === "Initiated").length, "text-sky-600"],
          ["Working", tasks.filter((task) => task.status === "Working").length, "text-violet-600"],
          ["Pending", tasks.filter((task) => task.status === "Pending").length, "text-amber-600"],
          ["Completed", tasks.filter((task) => task.status === "Completed").length, "text-emerald-600"],
        ].map(([label, count, style]) => (
          <div key={label} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${style}`}>{count}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="grid md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_150px_175px_150px_150px_auto] gap-3">
          <div className="relative md:col-span-2 xl:col-span-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><IconSearch /></span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task, company, member or role…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200">
            <option value="">All Statuses</option>
            {STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select
            aria-label="Filter by assigned role"
            value={isMasterAdmin ? roleFilter : adminRoleKey}
            disabled={!isMasterAdmin}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isMasterAdmin && <option value="">All Roles</option>}
            {TASK_ROLE_OPTIONS.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
          </select>
          <input type="date" aria-label="From date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200" />
          <input type="date" aria-label="To date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200" />
          <button type="button" onClick={clearFilters} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Clear</button>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-400">{filtered.length} matching task{filtered.length === 1 ? "" : "s"}</p>
          {selected.size > 0 && (
            <button type="button" disabled={deleting} onClick={() => deleteIds(Array.from(selected))} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 text-sm font-semibold border border-red-200 dark:border-red-500/20 disabled:opacity-50">
              <IconTrash /> {deleting ? "Deleting…" : `Delete Selected (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center"><div className="w-8 h-8 rounded-full border-3 border-violet-500 border-t-transparent animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 text-left"><input type="checkbox" checked={pageSelected} onChange={togglePage} aria-label="Select current page" className="accent-violet-600" /></th>
                  {['Task', 'Date', 'Company', 'Assigned Role', 'Created By', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-gray-500 font-bold whitespace-nowrap">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {pageItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400">No tasks match the selected role and filters.</td></tr>
                ) : pageItems.map((task) => (
                  <tr key={task.id} className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/30 ${selected.has(task.id) ? "bg-violet-50/50 dark:bg-violet-500/5" : ""}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(task.id)} onChange={() => toggleOne(task.id)} aria-label={`Select ${task.name}`} className="accent-violet-600" /></td>
                    <td className="px-4 py-3 min-w-[260px]">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{task.name || "Untitled Task"}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 max-w-md" title={task.description}>{task.description || "—"}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{formatDate(task.taskDate)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{task.companyName || <span className="text-gray-300">Optional</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-semibold">
                        {getTaskRoleLabel(task.assignedRoleKey || task.assignedRole)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-gray-700 dark:text-gray-200">{task.createdByName || "Marketing Member"}</p>
                      <p className="text-[10px] text-gray-400">Marketing</p>
                    </td>
                    <td className="px-4 py-3">
                      <select value={STATUSES.includes(task.status) ? task.status : "Initiated"} onChange={(event) => updateStatus(task, event.target.value)} className={`px-2.5 py-1.5 rounded-full border text-xs font-semibold outline-none ${STATUS_STYLE[task.status] || STATUS_STYLE.Initiated}`}>
                        {STATUSES.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setEditing(task)} title="Edit task" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10"><IconEdit /></button>
                        <button type="button" disabled={deleting} onClick={() => deleteIds([task.id])} title="Delete task" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            Rows per page
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              {PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}
            </select>
          </label>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          <p className="text-xs text-gray-400">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</p>
        </div>
      )}

      {editing && <EditTaskModal task={editing} saving={saving} canReassign={isMasterAdmin} onSave={saveEdit} onClose={() => !saving && setEditing(null)} />}
    </div>
  );
}

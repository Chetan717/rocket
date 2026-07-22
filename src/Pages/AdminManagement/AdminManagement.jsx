import { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../../../Firebase";
import { COLLECTIONS } from "../../collections";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";
import { getAdminSession } from "../../Utils/adminSession";

// ── Tab options (must match Sidebar NAV_ITEMS ids) ─────────────────────────
const ALL_TABS = [
  { id: "dashboard",            label: "Dashboard" },
  { id: "companies",            label: "Companies" },
  { id: "templates",            label: "Templates (Full Access)" },
  { id: "templates_operation",  label: "Templates — Operation Only" },
  { id: "templates_quality",    label: "Templates — Quality Check Only" },
  { id: "Graphics",             label: "App Graphics" },
  { id: "marketing",            label: "Marketing" },
  { id: "removebg",             label: "Remove BG API" },
  { id: "userdashboard",        label: "User Dashboard" },
  { id: "adminmanagement",      label: "Admin Management" },
  { id: "templatedata",         label: "Template Data Report" },
  { id: "taskmanagement",       label: "Task Management" },
];

const ROLES = ["Master Admin", "Admin", "Viewer", "Marketing", "Support"];

const EMPTY_FORM = {
  name: "",
  role: "Admin",
  mobile: "",
  assigntab: [],
  active: true,
};

// ── Icons ──────────────────────────────────────────────────────────────────
const IconPlus    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
const IconEdit    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z"/></svg>;
const IconTrash   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16"/></svg>;
const IconClose   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
const IconSave    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
const IconSearch  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/></svg>;
const IconShield  = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>;

// ── Validate ────────────────────────────────────────────────────────────────
function validate(form) {
  const e = {};
  if (!form.name.trim())              e.name   = "Name is required";
  if (!/^\d{10}$/.test(form.mobile))  e.mobile = "Must be 10 digits";
  if (!form.role)                     e.role   = "Select a role";
  return e;
}

// ── Tab checkbox group ──────────────────────────────────────────────────────
function TabSelector({ selected, onChange, isMaster }) {
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter(t => t !== id));
    else onChange([...selected, id]);
  };
  const selectAll = () => onChange(ALL_TABS.map(t => t.id));
  const clearAll  = () => onChange([]);

  // Group: Templates sub-items
  const TEMPLATE_GROUPS = [
    { id: "templates",           label: "Templates (Full Access)",          color: "violet" },
    { id: "templates_operation", label: "Templates — Operation Only",       color: "indigo" },
    { id: "templates_quality",   label: "Templates — Quality Check Only",   color: "emerald" },
  ];
  const otherTabs = ALL_TABS.filter(t => !TEMPLATE_GROUPS.find(g => g.id === t.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assign Tabs</label>
        <div className="flex gap-2">
          <button type="button" onClick={selectAll} className="text-[11px] text-violet-600 font-semibold hover:underline">All</button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={clearAll}  className="text-[11px] text-gray-500 font-semibold hover:underline">Clear</button>
        </div>
      </div>
      {isMaster && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2">
          Master Admin always sees all tabs regardless of selection.
        </p>
      )}

      {/* Templates group */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest font-bold text-violet-500 mb-1.5 px-1">Templates Access</p>
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-violet-50/50 border border-violet-100">
          {TEMPLATE_GROUPS.map(tab => {
            const checked = selected.includes(tab.id);
            const colorMap = {
              violet: checked ? "bg-violet-50 border-violet-300 text-violet-700 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50",
              indigo:  checked ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50",
              emerald: checked ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50",
            };
            return (
              <label key={tab.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm ${colorMap[tab.color]}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(tab.id)} className="accent-violet-600" />
                {tab.label}
              </label>
            );
          })}
          <p className="text-[10px] text-gray-400 px-1 mt-0.5">
            Assign one: Full gives both operation & quality. Operation-only = edit/add/delete. Quality-only = flag review.
          </p>
        </div>
      </div>

      {/* Other tabs */}
      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1.5 px-1">Other Tabs</p>
      <div className="grid grid-cols-2 gap-2">
        {otherTabs.map(tab => {
          const checked = selected.includes(tab.id);
          return (
            <label key={tab.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm ${checked ? "bg-violet-50 border-violet-300 text-violet-700 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(tab.id)} className="accent-violet-600" />
              {tab.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────
function AdminModal({ mode, initial, onSave, onClose, saving }) {
  const [form,   setForm]   = useState(initial);
  const [errors, setErrors] = useState({});
  const isEdit = mode === "edit";

  const set = (field, val) => {
    setForm(p => ({ ...p, [field]: val }));
    setErrors(p => { const c = { ...p }; delete c[field]; return c; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    await onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            {isEdit ? "Edit Admin User" : "Add Admin User"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <IconClose />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Full Name</label>
            <input
              value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="e.g. Rajesh Kumar"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 ${errors.name ? "border-red-400" : "border-gray-200"}`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Role</label>
            <select
              value={form.role} onChange={e => set("role", e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 ${errors.role ? "border-red-400" : "border-gray-200"}`}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
          </div>

          {/* Mobile */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Mobile No.</label>
            <input
              value={form.mobile} onChange={e => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 ${errors.mobile ? "border-red-400" : "border-gray-200"}`}
            />
            {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
          </div>

          {/* Assign Tabs */}
          <TabSelector
            selected={form.assigntab}
            onChange={val => set("assigntab", val)}
            isMaster={form.role === "Master Admin"}
          />

          {/* Active */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={form.active} onChange={e => set("active", e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-violet-600 transition-colors" />
              <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all peer-checked:translate-x-5 shadow" />
            </label>
            <span className="text-sm text-gray-700 font-medium">Account Active</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : <IconSave />}
              {isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role badge ──────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const styles = {
    "Master Admin": "bg-violet-100 text-violet-700",
    "Admin":        "bg-blue-100 text-blue-700",
    "Marketing":    "bg-amber-100 text-amber-700",
    "Viewer":       "bg-gray-100 text-gray-600",
    "Support":      "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${styles[role] || "bg-gray-100 text-gray-600"}`}>
      {role}
    </span>
  );
}

// ════════════════════════════════════════════════════════════
//  AdminManagement
// ════════════════════════════════════════════════════════════
export default function AdminManagement() {
  const [admins,  setAdmins]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState("");
  const [deleting,setDeleting]= useState(null);

  const me = useMemo(() => {
    return getAdminSession() || {};
  }, []);
  const isMasterAdmin = me.role === "Master Admin";

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, COLLECTIONS.ADMINUSER), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.mobile?.includes(q) ||
      a.role?.toLowerCase().includes(q)
    );
  }, [admins, search]);

  const handleSave = useCallback(async (form) => {
    setSaving(true);
    try {
      if (modal.mode === "add") {
        const payload = {
          name:      form.name.trim(),
          role:      form.role,
          mobile:    form.mobile,
          ownerAdminId: me.ownerAdminId || me.id,
          assigntab: form.assigntab,
          active:    form.active,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, COLLECTIONS.ADMINUSER), payload);
        setAdmins(prev => [{ id: ref.id, ...payload, createdAt: new Date(), updatedAt: new Date() }, ...prev]);
      } else {
        const payload = {
          name:      form.name.trim(),
          role:      form.role,
          mobile:    form.mobile,
          assigntab: form.assigntab,
          active:    form.active,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(doc(db, COLLECTIONS.ADMINUSER, modal.data.id), payload);
        setAdmins(prev => prev.map(a => a.id === modal.data.id ? { ...a, ...payload } : a));
      }
      setModal(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [modal, me.id, me.ownerAdminId]);

  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const handleDelete = useCallback((admin) => {
    if (admin.id === me.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!window.confirm(`Delete admin "${admin.name}"? This cannot be undone.`)) return;
    requestDelete(async () => {
      setDeleting(admin.id);
      try {
        await deleteDoc(doc(db, COLLECTIONS.ADMINUSER, admin.id));
        setAdmins(prev => prev.filter(a => a.id !== admin.id));
      } catch (err) {
        console.error(err);
        alert("Delete failed.");
      } finally {
        setDeleting(null);
      }
    });
  }, [me.id, requestDelete]);

  const toggleActive = useCallback(async (admin) => {
    const next = !admin.active;
    setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, active: next } : a));
    try {
      await updateDoc(doc(db, COLLECTIONS.ADMINUSER, admin.id), { active: next, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error(err);
      setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, active: admin.active } : a));
    }
  }, []);

  if (!isMasterAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <IconShield />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Access Denied</h3>
        <p className="text-sm text-gray-500 text-center max-w-xs">Only Master Admin can manage admin users.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            Admin Management
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage admin users &amp; tab access — {admins.length} user{admins.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "add", data: EMPTY_FORM })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 transition-colors"
        >
          <IconPlus /> Add Admin User
        </button>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><IconSearch /></span>
        <input
          type="text" placeholder="Search by name, mobile, role…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["#", "Name", "Role", "Mobile", "Assigned Tabs", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400 text-sm">
                      {search ? `No results for "${search}".` : "No admin users yet. Click Add Admin User to create one."}
                    </td>
                  </tr>
                ) : filtered.map((admin, i) => (
                  <tr key={admin.id} className={`hover:bg-gray-50/80 transition-colors ${admin.id === me.id ? "bg-violet-50/40" : ""}`}>
                    <td className="px-4 py-3 text-gray-400 text-[11px]">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {admin.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{admin.name}</p>
                          {admin.id === me.id && <p className="text-[10px] text-violet-500 font-semibold">You</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={admin.role} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{admin.mobile}</td>
                    <td className="px-4 py-3">
                      {admin.role === "Master Admin" ? (
                        <span className="text-xs text-violet-600 font-semibold">All tabs</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {(admin.assigntab || []).length === 0 ? (
                            <span className="text-xs text-gray-400">None assigned</span>
                          ) : (admin.assigntab || []).map(tabId => {
                            const tab = ALL_TABS.find(t => t.id === tabId);
                            return tab ? (
                              <span key={tabId} className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">{tab.label}</span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(admin)} className="flex items-center gap-1.5 cursor-pointer group">
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${admin.active ? "bg-emerald-500" : "bg-gray-300"}`}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${admin.active ? "translate-x-4" : "translate-x-0"}`} />
                        </div>
                        <span className={`text-xs font-semibold ${admin.active ? "text-emerald-600" : "text-gray-400"}`}>
                          {admin.active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModal({ mode: "edit", data: { ...EMPTY_FORM, ...admin } })}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          title="Edit"
                        >
                          <IconEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(admin)}
                          disabled={deleting === admin.id || admin.id === me.id}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                          title={admin.id === me.id ? "Cannot delete yourself" : "Delete"}
                        >
                          {deleting === admin.id
                            ? <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            : <IconTrash />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">How tab access works:</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-600">
          <li>Master Admin always has full access to everything.</li>
          <li>Assign <strong>Templates (Full Access)</strong> → user can do operations AND quality checks.</li>
          <li>Assign <strong>Templates — Operation Only</strong> → user can add/edit/delete templates only.</li>
          <li>Assign <strong>Templates — Quality Check Only</strong> → user can only review quality flags.</li>
          <li>Assigning multiple template permissions gives access to all assigned features.</li>
        </ul>
      </div>

      {modal && (
        <AdminModal
          mode={modal.mode}
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
      {DeleteAuthModal}
      {BlockedToast}
    </div>
  );
}

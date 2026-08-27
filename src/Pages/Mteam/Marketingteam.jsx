import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../Firebase";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";

const EMPTY_FORM = {
  name: "",
  loginEmail: "",
  mobile: "",
  parentMteamId: "",
  commissionPercentage: "10",
  uplineBonusPercentage: "10",
  referCode: "",
  active: true,
};

const messageOf = error => String(error?.message || "Request could not be completed.")
  .replace(/^Firebase(?:Error)?:?\s*/i, "")
  .replace(/functions\/[a-z-]+\)?\.?/gi, "")
  .trim();

function validate(form, parent) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Name is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.loginEmail.trim())) errors.loginEmail = "Valid email is required";
  if (!/^\d{10}$/.test(form.mobile)) errors.mobile = "Enter 10 digits";
  if (form.referCode && !/^[A-Za-z0-9]{6}$/.test(form.referCode)) errors.referCode = "Exactly 6 letters/numbers";
  const percentage = Number(form.commissionPercentage);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) errors.commissionPercentage = "Enter 0–100";
  if (parent && percentage > Number(parent.commissionPercentage || 0)) errors.commissionPercentage = `Maximum ${parent.commissionPercentage}% (parent limit)`;
  const bonus = Number(form.uplineBonusPercentage);
  if (!Number.isFinite(bonus) || bonus < 0 || bonus > 100) errors.uplineBonusPercentage = "Enter 0–100";
  return errors;
}

function Field({ label, error, hint, children }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
      <span>{label}</span>
      {children}
      {hint && !error && <span className="text-xs font-normal text-gray-400">{hint}</span>}
      {error && <span className="text-xs font-normal text-red-500">{error}</span>}
    </label>
  );
}

const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950";

function MemberForm({ member, members, onSaved, onCancel }) {
  const [form, setForm] = useState(() => member ? {
    name: member.name || "",
    loginEmail: member.loginEmail || "",
    mobile: member.mobile || "",
    parentMteamId: member.parentMteamId || "",
    commissionPercentage: String(member.commissionPercentage ?? 0),
    uplineBonusPercentage: String(member.uplineBonusPercentage ?? 10),
    referCode: member.referCode || "",
    active: member.active === true,
  } : EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const parent = members.find(item => item.id === form.parentMteamId);
  const parentOptions = members.filter(item => item.id !== member?.id && !(item.ancestorIds || []).includes(member?.id));
  const set = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
  };
  const save = async event => {
    event.preventDefault();
    const nextErrors = validate(form, parent);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setSaving(true);
    try {
      await httpsCallable(functions, "panelUpsertMarketingMember")({
        memberId: member?.id || "",
        ...form,
        loginEmail: form.loginEmail.trim().toLowerCase(),
        referCode: form.referCode.trim().toUpperCase(),
        commissionPercentage: Number(form.commissionPercentage),
        uplineBonusPercentage: Number(form.uplineBonusPercentage),
      });
      await onSaved(member ? "Member updated." : "Member created. Add a coupon before using the portal.");
    } catch (error) {
      setErrors({ form: messageOf(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="font-bold">{member ? `Edit ${member.name}` : "Add Marketing Member"}</h2><p className="text-xs text-gray-500">Only Admin controls email, parent assignment and commission.</p></div>
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Close</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Full name" error={errors.name}><input className={inputClass} value={form.name} maxLength={80} onChange={event => set("name", event.target.value)} /></Field>
        <Field label="Login email" error={errors.loginEmail} hint="OTP will be sent only to this registered email"><input className={inputClass} type="email" autoComplete="off" value={form.loginEmail} maxLength={254} onChange={event => set("loginEmail", event.target.value)} placeholder="member@example.com" /></Field>
        <Field label="Mobile (profile only)" error={errors.mobile} hint="Mobile OTP is disabled"><input className={inputClass} inputMode="numeric" value={form.mobile} maxLength={10} onChange={event => set("mobile", event.target.value.replace(/\D/g, "").slice(0, 10))} /></Field>
        <Field label="Parent Marketing member" hint="Leave blank for a root member"><select className={inputClass} value={form.parentMteamId} onChange={event => set("parentMteamId", event.target.value)}><option value="">No parent (root)</option>{parentOptions.map(item => <option key={item.id} value={item.id}>{item.name} · {item.commissionPercentage}%</option>)}</select></Field>
        <Field label="Member commission %" error={errors.commissionPercentage} hint={parent ? `Cannot exceed ${parent.commissionPercentage}%` : "Root limit: 100%"}><input className={inputClass} type="number" min="0" max={parent?.commissionPercentage ?? 100} step="0.01" value={form.commissionPercentage} onChange={event => set("commissionPercentage", event.target.value)} /></Field>
        <Field label="Parent bonus %" error={errors.uplineBonusPercentage} hint="Parent earns this % of this member's commission"><input className={inputClass} type="number" min="0" max="100" step="0.01" value={form.uplineBonusPercentage} onChange={event => set("uplineBonusPercentage", event.target.value)} /></Field>
        <Field label="Refer code" error={errors.referCode} hint="Optional until coupon is assigned"><input className={`${inputClass} font-mono uppercase`} value={form.referCode} maxLength={6} onChange={event => set("referCode", event.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></Field>
        <Field label="Account status"><span className="flex h-11 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 font-normal dark:border-gray-700 dark:bg-gray-950"><input type="checkbox" checked={form.active} onChange={event => set("active", event.target.checked)} /><span>{form.active ? "Active" : "Inactive"}</span></span></Field>
      </div>
      {errors.form && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30">{errors.form}</p>}
      <button disabled={saving} className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : member ? "Save Changes" : "Create Member"}</button>
    </form>
  );
}

export default function MarketingTeam() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(undefined);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(null);
  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await httpsCallable(functions, "panelListMarketingHierarchy")({});
      setMembers(result.data.members || []);
    } catch (error) {
      setStatus({ type: "error", text: messageOf(error) });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const ordered = useMemo(() => {
    const byId = new Map(members.map(member => [member.id, member]));
    const children = new Map();
    for (const member of members) {
      const parentId = byId.has(member.parentMteamId) ? member.parentMteamId : "";
      children.set(parentId, [...(children.get(parentId) || []), member]);
    }
    for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    const result = [], visited = new Set();
    const visit = member => { if (visited.has(member.id)) return; visited.add(member.id); result.push(member); for (const child of children.get(member.id) || []) visit(child); };
    for (const root of children.get("") || []) visit(root);
    for (const member of members) visit(member);
    return result;
  }, [members]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter(member => [member.name, member.loginEmail, member.mobile, member.referCode, member.parentName].some(value => String(value || "").toLowerCase().includes(needle)));
  }, [ordered, search]);

  const saved = async text => { setEditing(undefined); setStatus({ type: "ok", text }); await load(); };
  const remove = member => {
    if (!window.confirm(`Delete ${member.name}? Members with a team or sales history cannot be deleted.`)) return;
    requestDelete(async () => {
      try {
        await httpsCallable(functions, "panelDeleteMarketingMember")({ memberId: member.id });
        setStatus({ type: "ok", text: "Member deleted." });
        await load();
      } catch (error) { setStatus({ type: "error", text: messageOf(error) }); }
    });
  };

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div><h1 className="text-xl font-bold">Marketing Hierarchy</h1><p className="text-sm text-gray-500">{members.length} members · Admin-managed parent, email and percentage</p></div>
        <button onClick={() => setEditing(null)} disabled={editing !== undefined} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">+ Add Member</button>
      </div>
      {editing !== undefined && <MemberForm key={editing?.id || "new"} member={editing} members={members} onSaved={saved} onCancel={() => setEditing(undefined)} />}
      {status && <div className={`mb-4 rounded-xl p-3 text-sm ${status.type === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-red-50 text-red-700 dark:bg-red-950/30"}`}>{status.text}</div>}
      <div className="overflow-hidden rounded-2xl border bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b p-4 dark:border-gray-800"><input className={`${inputClass} max-w-md`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, mobile, parent or code…" /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70"><tr>{["Member", "Login Email", "Mobile", "Parent", "Commission", "Parent Bonus", "Coupon / Refer", "Status", "Actions"].map(title => <th key={title} className="px-4 py-3">{title}</th>)}</tr></thead>
            <tbody className="divide-y dark:divide-gray-800">
              {filtered.map(member => <tr key={member.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30">
                <td className="px-4 py-3"><div style={{ paddingLeft: `${Math.min(Number(member.level || 0), 6) * 14}px` }}><div className="font-bold">{member.level ? "↳ " : ""}{member.name}</div><div className="text-xs text-gray-400">Level {member.level || 0}</div></div></td>
                <td className="px-4 py-3">{member.loginEmail ? <span>{member.loginEmail}</span> : <span className="font-semibold text-red-500">Email required</span>}</td>
                <td className="px-4 py-3 text-gray-500">{member.mobile}</td>
                <td className="px-4 py-3">{member.parentName || <span className="text-gray-400">Root</span>}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700 dark:bg-violet-950/30">{member.commissionPercentage}%</span></td>
                <td className="px-4 py-3">{member.parentMteamId ? `${member.uplineBonusPercentage}%` : "—"}</td>
                <td className="px-4 py-3"><div className="font-mono text-xs">{member.assign_coupon_id || "Not assigned"}</div><div className="font-mono text-xs text-gray-400">{member.referCode || "No refer code"}</div></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-red-50 text-red-700 dark:bg-red-950/30"}`}>{member.active ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => setEditing(member)} className="rounded-lg border px-3 py-1.5 text-indigo-600 dark:border-gray-700">Edit</button><button onClick={() => remove(member)} className="rounded-lg border px-3 py-1.5 text-red-600 dark:border-gray-700">Delete</button></div></td>
              </tr>)}
              {!loading && filtered.length === 0 && <tr><td colSpan="9" className="px-4 py-14 text-center text-gray-400">No Marketing members found.</td></tr>}
              {loading && <tr><td colSpan="9" className="px-4 py-14 text-center text-gray-400">Loading hierarchy…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {DeleteAuthModal}
      {BlockedToast}
    </div>
  );
}

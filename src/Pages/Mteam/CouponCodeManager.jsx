import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../Firebase";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";

const EMPTY = { code: "", referCode: "", assignedMteamId: "", userDiscount: "0", marketingPercentage: "10", active: true };
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950";
const messageOf = error => String(error?.message || "Request could not be completed.").replace(/^Firebase(?:Error)?:?\s*/i, "").replace(/functions\/[a-z-]+\)?\.?/gi, "").trim();

function CouponForm({ coupon, members, onSaved, onCancel }) {
  const [form, setForm] = useState(() => coupon ? {
    code: coupon.code || "",
    referCode: coupon.referCode || "",
    assignedMteamId: coupon.assigned_user?.id || "",
    userDiscount: String(coupon.user_discount ?? 0),
    marketingPercentage: String(coupon.marketing_member_percentage ?? 0),
    active: coupon.active === true,
  } : EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const selected = members.find(member => member.id === form.assignedMteamId);
  const parent = members.find(member => member.id === selected?.parentMteamId);
  const cap = parent ? Number(parent.commissionPercentage || 0) : 100;
  const set = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: undefined, form: undefined })); };
  const submit = async event => {
    event.preventDefault();
    const next = {};
    if (!/^[A-Za-z0-9]{6}$/.test(form.code)) next.code = "Exactly 6 letters/numbers";
    if (form.referCode && !/^[A-Za-z0-9]{6}$/.test(form.referCode)) next.referCode = "Exactly 6 letters/numbers";
    if (!selected) next.assignedMteamId = "Select a member";
    const discount = Number(form.userDiscount), percentage = Number(form.marketingPercentage);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) next.userDiscount = "Enter 0–100";
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > cap) next.marketingPercentage = `Enter 0–${cap}`;
    if (Object.keys(next).length) { setErrors(next); return; }
    setSaving(true);
    try {
      await httpsCallable(functions, "panelUpsertMarketingCoupon")({
        couponId: coupon?.id || "",
        code: form.code.toUpperCase(),
        referCode: form.referCode.toUpperCase(),
        assignedMteamId: form.assignedMteamId,
        userDiscount: discount,
        marketingPercentage: percentage,
        active: form.active,
      });
      await onSaved(coupon ? "Coupon updated." : "Coupon created.");
    } catch (error) { setErrors({ form: messageOf(error) }); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="mb-4 flex justify-between"><div><h2 className="font-bold">{coupon ? `Edit ${coupon.code}` : "Add Coupon"}</h2><p className="text-xs text-gray-500">Coupon and member commission are saved atomically.</p></div><button type="button" onClick={onCancel} className="text-sm text-gray-500">Close</button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Coupon code" error={errors.code}><input className={`${inputClass} font-mono uppercase`} maxLength={6} value={form.code} onChange={event => set("code", event.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></Field>
        <Field label="Refer code" error={errors.referCode}><input className={`${inputClass} font-mono uppercase`} maxLength={6} value={form.referCode} onChange={event => set("referCode", event.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></Field>
        <Field label="Assigned member" error={errors.assignedMteamId}><select className={inputClass} value={form.assignedMteamId} onChange={event => set("assignedMteamId", event.target.value)}><option value="">Select member</option>{members.filter(member => !member.assign_coupon_id || member.assign_coupon_id === coupon?.id).map(member => <option key={member.id} value={member.id}>{member.name} {member.parentName ? `· under ${member.parentName}` : "· root"}</option>)}</select></Field>
        <Field label="User discount %" error={errors.userDiscount}><input className={inputClass} type="number" min="0" max="100" step="0.01" value={form.userDiscount} onChange={event => set("userDiscount", event.target.value)} /></Field>
        <Field label="Member commission %" error={errors.marketingPercentage} hint={parent ? `Parent cap: ${cap}%` : "Root cap: 100%"}><input className={inputClass} type="number" min="0" max={cap} step="0.01" value={form.marketingPercentage} onChange={event => set("marketingPercentage", event.target.value)} /></Field>
        <Field label="Status"><div className="flex h-11 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-950"><input type="checkbox" checked={form.active} onChange={event => set("active", event.target.checked)} /><span className="text-sm">{form.active ? "Active" : "Inactive"}</span></div></Field>
      </div>
      {errors.form && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30">{errors.form}</p>}
      <button disabled={saving} className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Coupon"}</button>
    </form>
  );
}

function Field({ label, error, hint, children }) {
  return <div className="grid gap-1"><span className="text-sm font-semibold">{label}</span>{children}{hint && !error && <span className="text-xs text-gray-400">{hint}</span>}{error && <span className="text-xs text-red-500">{error}</span>}</div>;
}

export default function CouponCodeManager() {
  const [members, setMembers] = useState([]), [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true), [editing, setEditing] = useState(undefined), [search, setSearch] = useState(""), [status, setStatus] = useState(null);
  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await httpsCallable(functions, "panelListMarketingHierarchy")({}); setMembers(result.data.members || []); setCoupons(result.data.coupons || []); }
    catch (error) { setStatus({ type: "error", text: messageOf(error) }); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return q ? coupons.filter(coupon => [coupon.code, coupon.referCode, coupon.assigned_user?.name].some(value => String(value || "").toLowerCase().includes(q))) : coupons; }, [coupons, search]);
  const saved = async text => { setEditing(undefined); setStatus({ type: "ok", text }); await load(); };
  const remove = coupon => {
    if (!window.confirm(`Delete ${coupon.code}? Coupons with sales history must be deactivated instead.`)) return;
    requestDelete(async () => {
      try { await httpsCallable(functions, "panelDeleteMarketingCoupon")({ couponId: coupon.id }); setStatus({ type: "ok", text: "Coupon deleted." }); await load(); }
      catch (error) { setStatus({ type: "error", text: messageOf(error) }); }
    });
  };
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><div><h1 className="text-xl font-bold">Coupon Codes</h1><p className="text-sm text-gray-500">{coupons.length} coupons · percentage follows hierarchy cap</p></div><button onClick={() => setEditing(null)} disabled={editing !== undefined} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">+ Add Coupon</button></div>
      {editing !== undefined && <CouponForm key={editing?.id || "new"} coupon={editing} members={members} onSaved={saved} onCancel={() => setEditing(undefined)} />}
      {status && <div className={`mb-4 rounded-xl p-3 text-sm ${status.type === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-red-50 text-red-700 dark:bg-red-950/30"}`}>{status.text}</div>}
      <div className="overflow-hidden rounded-2xl border bg-white dark:border-gray-800 dark:bg-gray-900"><div className="border-b p-4 dark:border-gray-800"><input className={`${inputClass} max-w-md`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search coupon, refer code or member…" /></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70"><tr>{["Coupon", "Refer", "Member", "User Discount", "Commission", "Parent Cap", "Status", "Actions"].map(title => <th key={title} className="px-4 py-3">{title}</th>)}</tr></thead><tbody className="divide-y dark:divide-gray-800">
        {filtered.map(coupon => { const member = members.find(item => item.id === coupon.assigned_user?.id); const parent = members.find(item => item.id === member?.parentMteamId); return <tr key={coupon.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30"><td className="px-4 py-3 font-mono font-bold text-indigo-600">{coupon.code}</td><td className="px-4 py-3 font-mono">{coupon.referCode || "—"}</td><td className="px-4 py-3"><div className="font-semibold">{coupon.assigned_user?.name || "Unassigned"}</div><div className="text-xs text-gray-400">{member?.parentName ? `Under ${member.parentName}` : "Root"}</div></td><td className="px-4 py-3">{coupon.user_discount}%</td><td className="px-4 py-3 font-bold text-violet-600">{coupon.marketing_member_percentage}%</td><td className="px-4 py-3">{parent ? `${parent.commissionPercentage}%` : "100%"}</td><td className="px-4 py-3"><span className={coupon.active ? "text-emerald-600" : "text-red-600"}>{coupon.active ? "Active" : "Inactive"}</span></td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => setEditing(coupon)} className="rounded-lg border px-3 py-1.5 text-indigo-600 dark:border-gray-700">Edit</button><button onClick={() => remove(coupon)} className="rounded-lg border px-3 py-1.5 text-red-600 dark:border-gray-700">Delete</button></div></td></tr>; })}
        {!loading && !filtered.length && <tr><td colSpan="8" className="py-14 text-center text-gray-400">No coupons found.</td></tr>}{loading && <tr><td colSpan="8" className="py-14 text-center text-gray-400">Loading coupons…</td></tr>}
      </tbody></table></div></div>
      {DeleteAuthModal}{BlockedToast}
    </div>
  );
}

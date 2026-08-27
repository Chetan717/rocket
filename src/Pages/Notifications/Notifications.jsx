import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../Firebase";
import { useAdminAuth } from "../../Auth/AdminAuthContext";

const EMPTY = { title: "MLM LIVE", body: "", url: "/" };
const when = value => value ? new Date(value).toLocaleString("en-IN") : "—";
const messageOf = error => String(error?.message || "Request could not be completed.").replace(/^Firebase(?:Error)?:?\s*/i, "").replace(/functions\/[a-z-]+\)?\.?/gi, "").trim();

export default function Notifications() {
  const { session } = useAdminAuth();
  const [form, setForm] = useState(EMPTY);
  const [overview, setOverview] = useState({ deviceCount: 0, campaigns: [] });
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [deleting, setDeleting] = useState(false), [status, setStatus] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await httpsCallable(functions, "panelPushOverview")({});
      setOverview(result.data);
      setSelected(previous => new Set([...previous].filter(id => (result.data.campaigns || []).some(item => item.id === id))));
    } catch (error) { setStatus({ type: "error", text: messageOf(error) }); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (session?.role === "Master Admin") void load(); }, [load, session?.role]);
  const allSelected = useMemo(() => overview.campaigns.length > 0 && overview.campaigns.every(item => selected.has(item.id)), [overview.campaigns, selected]);
  if (session?.role !== "Master Admin") return <div className="p-8"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-2 text-gray-500">Only Master Admin can manage app notifications.</p></div>;

  const send = async event => {
    event.preventDefault();
    if (!window.confirm(`Send this notification to ${overview.deviceCount} registered devices?`)) return;
    setSending(true); setStatus(null);
    try {
      const result = await httpsCallable(functions, "panelSendPushNotification")(form);
      setStatus({ type: "ok", text: `${result.data.accepted} notifications were accepted by Expo.` });
      setForm(EMPTY); await load();
    } catch (error) { setStatus({ type: "error", text: messageOf(error) }); } finally { setSending(false); }
  };
  const remove = async clearAll => {
    const count = clearAll ? overview.campaigns.length : selected.size;
    if (!count) return;
    const prompt = clearAll ? "Clear the complete notification history? This cannot be undone." : `Delete ${count} selected notification record${count === 1 ? "" : "s"}?`;
    if (!window.confirm(prompt)) return;
    setDeleting(true); setStatus(null);
    try {
      const result = await httpsCallable(functions, "panelDeletePushCampaigns")({ clearAll, campaignIds: clearAll ? [] : [...selected] });
      setSelected(new Set());
      setStatus({ type: "ok", text: `${result.data.deletedCount} notification record${result.data.deletedCount === 1 ? "" : "s"} deleted.` });
      await load();
    } catch (error) { setStatus({ type: "error", text: messageOf(error) }); } finally { setDeleting(false); }
  };
  const toggle = id => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(overview.campaigns.map(item => item.id)));

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <div className="mb-6"><h1 className="text-2xl font-bold">App Notifications</h1><p className="text-sm text-gray-500">Registered devices: <b>{loading ? "…" : overview.deviceCount}</b></p></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_.95fr]">
        <form onSubmit={send} className="space-y-4 rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <label className="block text-sm font-semibold">Title<input className="mt-1 w-full rounded-xl border p-3 dark:border-gray-700 dark:bg-gray-950" maxLength={100} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} required /></label>
          <label className="block text-sm font-semibold">Message<textarea className="mt-1 min-h-32 w-full rounded-xl border p-3 dark:border-gray-700 dark:bg-gray-950" maxLength={1000} value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} required /><span className="text-xs text-gray-400">{form.body.length}/1000</span></label>
          <label className="block text-sm font-semibold">App page path<input className="mt-1 w-full rounded-xl border p-3 dark:border-gray-700 dark:bg-gray-950" value={form.url} onChange={event => setForm({ ...form, url: event.target.value })} placeholder="/dashboard" required /></label>
          {status && <p className={`rounded-xl p-3 text-sm ${status.type === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-red-50 text-red-700 dark:bg-red-950/30"}`}>{status.text}</p>}
          <button disabled={sending || !overview.deviceCount} className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-50">{sending ? "Sending…" : "Send Notification"}</button>
        </form>
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><input type="checkbox" aria-label="Select all recent notifications" checked={allSelected} onChange={toggleAll} disabled={!overview.campaigns.length || deleting} /><h2 className="font-bold">Recent notifications</h2></div>
            <div className="flex gap-2"><button onClick={() => remove(false)} disabled={!selected.size || deleting} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-40">Delete selected ({selected.size})</button><button onClick={() => remove(true)} disabled={!overview.campaigns.length || deleting} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">Clear All</button></div>
          </div>
          <div className="space-y-3">{overview.campaigns.map(item => <article key={item.id} className={`rounded-2xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${selected.has(item.id) ? "ring-2 ring-violet-500" : ""}`}><div className="flex gap-3"><input type="checkbox" aria-label={`Select ${item.title}`} checked={selected.has(item.id)} onChange={() => toggle(item.id)} disabled={deleting} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><b className="truncate">{item.title}</b><span className="whitespace-nowrap text-xs text-gray-400">{when(item.createdAt)}</span></div><p className="mt-2 text-sm">{item.body}</p><p className="mt-2 text-xs text-gray-500">Accepted {item.accepted}/{item.targeted} · {item.url}</p></div></div></article>)}{!loading && !overview.campaigns.length && <p className="rounded-2xl border border-dashed p-8 text-center text-gray-500 dark:border-gray-800">No recent notifications.</p>}{loading && <p className="p-8 text-center text-gray-400">Loading…</p>}</div>
        </section>
      </div>
    </div>
  );
}

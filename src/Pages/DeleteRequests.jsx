import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useNavigate } from "react-router";
import { functions } from "../../Firebase";
import { getAdminSession } from "../Utils/adminSession";

const STATUS_STYLE = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-gray-50 text-gray-600 border-gray-200",
  deleted: "bg-red-50 text-red-700 border-red-200",
};

function when(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString(); } catch { return "—"; }
}

export default function DeleteRequests() {
  const navigate = useNavigate();
  const admin = getAdminSession() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await httpsCallable(functions, "panelListDeleteRequests")({});
      setItems(result.data?.requests || []);
    } catch (err) {
      console.error(err); setError("Delete requests load nahi ho sake.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (admin.role === "Master Admin") load(); else setLoading(false); }, [admin.role, load]);

  const review = async (item, decision) => {
    setWorking(item.id); setError("");
    try {
      await httpsCallable(functions, "panelReviewDeleteRequest")({ requestId: item.id, decision });
      if (decision === "approved") {
        const separator = item.returnUrl.includes("?") ? "&" : "?";
        navigate(`${item.returnUrl}${separator}deleteRequest=${encodeURIComponent(item.id)}`);
        return;
      }
      await load();
    } catch (err) { console.error(err); setError("Request update nahi ho saka."); }
    finally { setWorking(""); }
  };

  if (admin.role !== "Master Admin") return <div className="p-6"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">Only Master Admin can review delete requests.</div></div>;

  return <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Delete Approval Requests</h1><p className="text-sm text-gray-500 mt-1">Sub-user requests approve/cancel karein. Approve karne par original edit page khulega, jahan final delete Master Admin karega.</p></div><button onClick={load} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold">Refresh</button></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading ? <p className="text-sm text-gray-500">Loading…</p> : items.length === 0 ? <div className="rounded-2xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-8 text-center text-gray-500">No delete requests.</div> : <div className="grid gap-3">{items.map(item => <div key={item.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-gray-900 dark:text-white">{item.resourceType === "template" ? "Template" : "Company"}: {item.resourceLabel || item.resourceId}</span><span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${STATUS_STYLE[item.status] || STATUS_STYLE.pending}`}>{item.status}</span></div><p className="text-sm text-gray-500 mt-1">Requested by {item.requestedByName || "Admin"} ({item.requestedByRole || "—"})</p><p className="text-xs text-gray-400 mt-1">{when(item.createdAt)}</p></div>
      {item.status === "pending" ? <div className="flex gap-2"><button disabled={working === item.id} onClick={() => review(item, "cancelled")} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 disabled:opacity-50">Cancel Request</button><button disabled={working === item.id} onClick={() => review(item, "approved")} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">Approve & Open</button></div> : item.status === "approved" ? <button onClick={() => { const separator = item.returnUrl.includes("?") ? "&" : "?"; navigate(`${item.returnUrl}${separator}deleteRequest=${encodeURIComponent(item.id)}`); }} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold">Open for Final Delete</button> : null}
    </div>)}</div>}
  </div>;
}

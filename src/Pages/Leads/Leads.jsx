import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../../Firebase";
import * as XLSX from "xlsx";
import { COLLECTIONS } from "../../collections";

// ── Icons ────────────────────────────────────────────────────
const Ico = ({ d, cls = "w-4 h-4" }) => <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>;
const IcoRefresh   = () => <Ico d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />;
const IcoSearch    = () => <Ico d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />;
const IcoCSV       = () => <Ico d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />;
const IcoFilter    = () => <Ico d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />;
const IcoChevL     = () => <Ico d="M15.75 19.5L8.25 12l7.5-7.5" />;
const IcoChevR     = () => <Ico d="M8.25 4.5l7.5 7.5-7.5 7.5" />;
const IcoClose     = () => <Ico d="M6 18L18 6M6 6l12 12" />;
const IcoNote      = () => <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />;
const IcoChevD     = () => <Ico d="M19 9l-7 7-7-7" />;
const IcoChevU     = () => <Ico d="M5 15l7-7 7 7" />;
const IcoCheck     = () => <Ico d="M5 13l4 4L19 7" />;
const IcoBell      = () => <Ico d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" cls="w-5 h-5" />;
const IcoWarning   = () => <Ico d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" cls="w-5 h-5" />;
const IcoUsers     = () => <Ico d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />;
const IcoLink      = () => <Ico d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />;

// ── Helpers ──────────────────────────────────────────────────
function toDate(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") { const d = new Date(val); return isNaN(d) ? null : d; }
  if (typeof val === "number") return new Date(val);
  return null;
}
function fmt(val) {
  const d = toDate(val);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_OPTIONS = ["New", "Hot", "Warm", "Cold", "Converted", "Lost", "Follow Up"];
const STATUS_COLORS = {
  New: "bg-blue-50 text-blue-700 border-blue-200",
  Hot: "bg-red-50 text-red-700 border-red-200",
  Warm: "bg-orange-50 text-orange-700 border-orange-200",
  Cold: "bg-gray-100 text-gray-600 border-gray-200",
  Converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Lost: "bg-slate-100 text-slate-500 border-slate-200",
  "Follow Up": "bg-violet-50 text-violet-700 border-violet-200",
};

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, sub, color, active, onClick }) {
  const pal = {
    violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-400", num: "text-violet-700" },
    green:  { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-400", num: "text-emerald-700" },
    red:    { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-400", num: "text-red-700" },
    blue:   { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-400", num: "text-blue-700" },
    amber:  { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-400", num: "text-amber-700" },
    rose:   { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-400", num: "text-rose-700" },
    gray:   { bg: "bg-gray-50", text: "text-gray-600", ring: "ring-gray-300", num: "text-gray-700" },
  }[color] || {};
  return (
    <button onClick={onClick}
      className={`flex flex-col gap-1 p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left w-full ${active ? `${pal.bg} border-transparent ring-2 ${pal.ring} shadow-md` : "bg-white border-gray-100 hover:shadow-md hover:-translate-y-0.5"}`}>
      <p className={`text-2xl font-bold leading-tight ${active ? pal.num : "text-gray-900"}`}>{value}</p>
      <p className={`text-xs font-semibold ${active ? pal.text : "text-gray-500"}`}>{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </button>
  );
}

// ── Lead Detail Panel ────────────────────────────────────────
function LeadPanel({ lead, onClose, onSave }) {
  const [status, setStatus] = useState(lead.leadStatus || "New");
  const [notes, setNotes] = useState(lead.leadNotes || "");
  const [followupDate, setFollowupDate] = useState(lead.leadFollowup || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const mobile = lead.mobile;
      const docRef = doc(db, COLLECTIONS.LEADMANAGEMENT, mobile);
      const data = { status, notes, followupDate, updatedAt: new Date(), mobile, name: lead.name };
      await setDoc(docRef, data, { merge: true });
      onSave(mobile, { leadStatus: status, leadNotes: notes, leadFollowup: followupDate });
      onClose();
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const subs = lead.allSubs || [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-900 text-base">{lead.name}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{lead.mobile}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"><IcoClose /></button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">User Info</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ["Name", lead.name],
                ["Mobile", lead.mobile],
                ["MLM Profile", lead.hasProfile ? "✅ Yes" : "❌ No"],
                ["Company", lead.companyName || "—"],
                ["Refer Code", lead.referCode || "—"],
                ["Referred By", lead.referredBy || "—"],
                ["Mktg. Member", lead.referredByMteam ? "✅ Assigned" : "—"],
                ["Joined", fmt(lead.joinDate)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">{k}</p>
                  <p className="text-gray-800 font-medium text-xs mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Subscription ({subs.length} total)</p>
            {subs.length === 0
              ? <p className="text-sm text-gray-400">No subscription records found.</p>
              : <div className="space-y-2">
                  {subs.map((s, i) => (
                    <div key={i} className={`rounded-xl px-3 py-2.5 border text-xs ${s.Active ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-800">{s.plan || s.planType || "Plan"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.Active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {s.Active ? "Active" : "Expired"}
                        </span>
                      </div>
                      <div className="flex gap-4 text-gray-500">
                        <span>Purchased: {fmt(s.PurchaseAt)}</span>
                        <span>Expires: {s.expirydate || "—"}</span>
                      </div>
                      {s.PaymentAmount && <p className="text-gray-600 font-semibold mt-1">₹{s.PaymentAmount}</p>}
                    </div>
                  ))}
                </div>}
          </div>

          <div className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Lead Management</p>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block">Lead Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${status === s ? STATUS_COLORS[s] + " ring-2 ring-offset-1" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                    {status === s && <span className="mr-1">✓</span>}{s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Follow-up Date</label>
              <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Add follow-up notes, call summary, remarks..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 bg-white sticky bottom-0">
          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : <><IcoCheck /> Save Lead</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Mteam Modal ───────────────────────────────────────
function AssignMteamModal({ mteamList, selectedCount, onConfirm, onCancel, assigning }) {
  const [selectedMteam, setSelectedMteam] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = mteamList.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.mobile?.includes(search) ||
    m.referCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Assign to Marketing Member</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedCount} user{selectedCount !== 1 ? "s" : ""} will be assigned
            </p>
          </div>
          <button onClick={onCancel} disabled={assigning}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
            <IcoClose />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><IcoSearch /></span>
            <input type="text" placeholder="Search member by name, mobile, code…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No marketing members found</p>
          )}
          {filtered.map(m => {
            const isSelected = selectedMteam?.id === m.id;
            const hasCode = !!m.referCode;
            return (
              <button key={m.id} onClick={() => setSelectedMteam(m)}
                disabled={!hasCode}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  isSelected ? "bg-violet-50 border-violet-300 ring-2 ring-violet-300"
                  : hasCode ? "border-gray-200 hover:border-violet-200 hover:bg-violet-50/40"
                  : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                }`}>
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm shrink-0">
                  {m.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{m.name || "—"}</p>
                  <p className="text-xs text-gray-400 font-mono">{m.mobile || "—"}</p>
                </div>
                {hasCode ? (
                  <span className="font-mono font-bold text-xs bg-teal-50 text-teal-600 border border-teal-200 px-2 py-0.5 rounded-lg shrink-0">
                    {m.referCode}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 italic shrink-0">No code</span>
                )}
                {isSelected && (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-violet-600 text-white shrink-0">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onCancel} disabled={assigning}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => selectedMteam && onConfirm(selectedMteam)}
            disabled={!selectedMteam || assigning}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {assigning ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Assigning…</>
            ) : (
              <><IcoLink /> Assign</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Leads Page ──────────────────────────────────────────
export default function Leads() {
  const [users,     setUsers]     = useState([]);
  const [profiles,  setProfiles]  = useState([]);
  const [subs,      setSubs]      = useState([]);
  const [leadMgmt,  setLeadMgmt]  = useState({});
  const [mteamList, setMteamList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const [filterType,     setFilterType]     = useState("all");
  const [filterPlan,     setFilterPlan]     = useState("all");
  const [filterExpiry,   setFilterExpiry]   = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterCompany,  setFilterCompany]  = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [search,         setSearch]         = useState("");
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState(20);
  const [selectedLead,   setSelectedLead]   = useState(null);
  const [statFilter,     setStatFilter]     = useState("all");
  const [expandedRow,    setExpandedRow]    = useState(null);
  const [dismissedMobiles, setDismissedMobiles] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("dismissed_reminders") || "[]"); } catch { return []; }
  });
  const [reminderCollapsed, setReminderCollapsed] = useState(false);

  // Batch assign state
  const [selectedUserIds, setSelectedUserIds]   = useState(new Set());
  const [showAssignModal,  setShowAssignModal]   = useState(false);
  const [assigning,        setAssigning]         = useState(false);
  const [assignResult,     setAssignResult]      = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [uSnap, pSnap, sSnap, lSnap, mSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.USERS)),
        getDocs(collection(db, COLLECTIONS.MLMPROFILES)),
        getDocs(collection(db, COLLECTIONS.SUBSCRIPTION)),
        getDocs(collection(db, COLLECTIONS.LEADMANAGEMENT)),
        getDocs(collection(db, COLLECTIONS.MTEAM)),
      ]);
      setUsers(uSnap.docs.map(d => ({ _id: d.id, ...d.data() })));
      setProfiles(pSnap.docs.map(d => ({ _id: d.id, ...d.data() })));
      setSubs(sSnap.docs.map(d => ({ _id: d.id, ...d.data() })));
      const lm = {};
      lSnap.docs.forEach(d => { lm[d.id] = d.data(); });
      setLeadMgmt(lm);
      setMteamList(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError("Failed to load data: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Build leads ──────────────────────────────────────────
  const leads = useMemo(() => {
    const profileMap = {};
    profiles.forEach(p => {
      const m = String(p.mobile || p.mobileNo || "").trim();
      if (m) profileMap[m] = p;
    });

    const subsMap = {};
    const subNameMap = {};
    const subCompanyMap = {};
    subs.forEach(s => {
      const m = String(s.mobileNo || s.mobile || "").trim();
      if (!m) return;
      if (!subsMap[m]) subsMap[m] = [];
      subsMap[m].push(s);
      if (!subNameMap[m] && (s.UserName || s.userName)) subNameMap[m] = s.UserName || s.userName;
      if (!subCompanyMap[m] && (s.company || s.companyName)) subCompanyMap[m] = s.company || s.companyName;
    });

    const userMap = {};
    users.forEach(u => {
      const m = String(u.mobileNo || u.mobile || u.phone || "").trim();
      if (m) userMap[m] = u;
    });

    const now = new Date(); now.setHours(0, 0, 0, 0);

    const buildRow = (mobile, u = {}) => {
      const profile = profileMap[mobile] || null;
      const userSubs = subsMap[mobile] || [];

      const activeSubs = userSubs.filter(s => s.Active === true);
      const hasAnySub = userSubs.length > 0;
      const hasActiveSub = activeSubs.length > 0;

      let latestActive = null;
      if (activeSubs.length > 0) {
        latestActive = activeSubs.sort((a, b) => {
          const da = toDate(a.PurchaseAt), db2 = toDate(b.PurchaseAt);
          if (!da && !db2) return 0; if (!da) return 1; if (!db2) return -1;
          return db2 - da;
        })[0];
      }

      let expiryDate = null;
      let daysToExp = null;
      if (latestActive) {
        expiryDate = toDate(latestActive.expirydate);
        if (expiryDate) daysToExp = Math.round((expiryDate - now) / 86400000);
      }

      const isFullyExpired = hasAnySub && !hasActiveSub;
      const lm = leadMgmt[mobile] || {};

      return {
        _userId: u._id || null,
        mobile,
        name: u.name || subNameMap[mobile] || profile?.fullName || profile?.name || "—",
        joinDate: toDate(u.createdAt || u.joinDate || u.registeredAt),
        hasProfile: !!profile,
        companyName: profile?.companyName || subCompanyMap[mobile] || "—",
        designation: profile?.designation || "—",
        profileId: profile?._id || null,
        hasAnySub,
        hasActiveSub,
        isFullyExpired,
        latestPlan: latestActive?.plan || latestActive?.planType || "—",
        expiryDate,
        daysToExpiry: daysToExp,
        totalSubs: userSubs.length,
        allSubs: userSubs,
        leadStatus: lm.status || "New",
        leadNotes: lm.notes || "",
        leadFollowup: lm.followupDate || "",
        referCode: u.referCode || "",
        referredBy: u.referredBy || "",
        referredByMteam: u.referredByMteam || null,
        mteamCouponCode: u.mteamCouponCode || null,
      };
    };

    const seenMobiles = new Set();
    const list = users
      .map(u => {
        const mobile = String(u.mobileNo || u.mobile || u.phone || "").trim();
        if (!mobile) return null;
        seenMobiles.add(mobile);
        return buildRow(mobile, u);
      })
      .filter(Boolean);

    const extraMobiles = new Set([...Object.keys(subsMap), ...Object.keys(profileMap)]);
    extraMobiles.forEach(mobile => {
      if (!seenMobiles.has(mobile)) list.push(buildRow(mobile, {}));
    });

    return list;
  }, [users, profiles, subs, leadMgmt]);

  // ── Unique companies for filter ──────────────────────────
  const companyOptions = useMemo(() => {
    const names = new Set();
    leads.forEach(l => { if (l.companyName && l.companyName !== "—") names.add(l.companyName); });
    return Array.from(names).sort();
  }, [leads]);

  // ── Due reminders ────────────────────────────────────────
  const dueReminders = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return leads.filter(l => {
      if (!l.leadFollowup) return false;
      if (l.leadStatus === "Converted" || l.leadStatus === "Lost") return false;
      if (dismissedMobiles.includes(l.mobile)) return false;
      return l.leadFollowup <= todayStr;
    }).sort((a, b) => a.leadFollowup.localeCompare(b.leadFollowup));
  }, [leads, dismissedMobiles]);

  const dismissReminder = (mobile) => {
    const next = [...dismissedMobiles, mobile];
    setDismissedMobiles(next);
    try { sessionStorage.setItem("dismissed_reminders", JSON.stringify(next)); } catch {}
  };

  const dismissAll = () => {
    const mobiles = dueReminders.map(l => l.mobile);
    const next = [...new Set([...dismissedMobiles, ...mobiles])];
    setDismissedMobiles(next);
    try { sessionStorage.setItem("dismissed_reminders", JSON.stringify(next)); } catch {}
  };

  const overdueCount = dueReminders.filter(l => l.leadFollowup < new Date().toISOString().slice(0, 10)).length;
  const dueTodayCount = dueReminders.length - overdueCount;

  // ── Date-filtered leads ──────────────────────────────────
  const dateFilteredLeads = useMemo(() => {
    let rows = leads;
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      rows = rows.filter(l => l.joinDate && l.joinDate >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo); to.setHours(23, 59, 59, 999);
      rows = rows.filter(l => l.joinDate && l.joinDate <= to);
    }
    return rows;
  }, [leads, filterDateFrom, filterDateTo]);

  // ── Stats ────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:       dateFilteredLeads.length,
    withProfile: dateFilteredLeads.filter(l => l.hasProfile).length,
    noProfile:   dateFilteredLeads.filter(l => !l.hasProfile).length,
    withPlan:    dateFilteredLeads.filter(l => l.hasActiveSub).length,
    noPlan:      dateFilteredLeads.filter(l => !l.hasAnySub).length,
    expired:     dateFilteredLeads.filter(l => l.isFullyExpired).length,
    expiring1:   dateFilteredLeads.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 1).length,
    expiring3:   dateFilteredLeads.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 3).length,
    expiring7:   dateFilteredLeads.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 7).length,
    expiring15:  dateFilteredLeads.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 15).length,
  }), [dateFilteredLeads]);

  // ── Filtered list ────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = dateFilteredLeads;

    if (statFilter === "withProfile")  rows = rows.filter(l => l.hasProfile);
    else if (statFilter === "noProfile")   rows = rows.filter(l => !l.hasProfile);
    else if (statFilter === "withPlan")    rows = rows.filter(l => l.hasActiveSub);
    else if (statFilter === "noPlan")      rows = rows.filter(l => !l.hasAnySub);
    else if (statFilter === "expired")     rows = rows.filter(l => l.isFullyExpired);
    else if (statFilter === "expiring1")   rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 1);
    else if (statFilter === "expiring3")   rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 3);
    else if (statFilter === "expiring7")   rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 7);
    else if (statFilter === "expiring15")  rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 15);

    if (filterType === "withProfile") rows = rows.filter(l => l.hasProfile);
    if (filterType === "noProfile")   rows = rows.filter(l => !l.hasProfile);

    if (filterPlan === "withPlan")  rows = rows.filter(l => l.hasActiveSub);
    if (filterPlan === "noPlan")    rows = rows.filter(l => !l.hasAnySub);
    if (filterPlan === "expired")   rows = rows.filter(l => l.isFullyExpired);

    if (filterExpiry === "1day")  rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 1);
    if (filterExpiry === "2day")  rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 2);
    if (filterExpiry === "3day")  rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 3);
    if (filterExpiry === "7day")  rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 7);
    if (filterExpiry === "15day") rows = rows.filter(l => l.daysToExpiry !== null && l.daysToExpiry >= 0 && l.daysToExpiry <= 15);

    if (filterStatus !== "all") rows = rows.filter(l => l.leadStatus === filterStatus);

    // Company filter
    if (filterCompany !== "all") rows = rows.filter(l => l.companyName === filterCompany);

    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.mobile?.includes(q) ||
      l.companyName?.toLowerCase().includes(q) ||
      l.referredBy?.toLowerCase().includes(q)
    );

    // Newest leads (most recently joined) appear first; leads with no known
    // join date are pushed to the bottom rather than jumping to the top.
    rows = [...rows].sort((a, b) => {
      const ta = a.joinDate ? a.joinDate.getTime() : -Infinity;
      const tb = b.joinDate ? b.joinDate.getTime() : -Infinity;
      return tb - ta;
    });

    return rows;
  }, [dateFilteredLeads, statFilter, filterType, filterPlan, filterExpiry, filterStatus, filterCompany, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageSlice   = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Assignable for batch actions: any lead with a linked user record
  const isAssignable = (lead) => !!lead._userId;

  const resetFilters = () => {
    setFilterType("all"); setFilterPlan("all"); setFilterExpiry("all");
    setFilterStatus("all"); setFilterCompany("all"); setFilterDateFrom(""); setFilterDateTo("");
    setSearch(""); setStatFilter("all"); setPage(1);
  };

  const handleLeadSave = (mobile, updates) => {
    setLeadMgmt(prev => ({ ...prev, [mobile]: { ...prev[mobile], ...updates } }));
  };

  // ── Checkbox selection ───────────────────────────────────
  const toggleSelect = (userId) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  // Select all eligible on current page
  const selectAllOnPage = () => {
    const eligible = pageSlice.filter(isAssignable).map(l => l._userId);
    const allSelected = eligible.every(id => selectedUserIds.has(id));
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (allSelected) { eligible.forEach(id => next.delete(id)); }
      else             { eligible.forEach(id => next.add(id)); }
      return next;
    });
  };

  const clearSelection = () => setSelectedUserIds(new Set());

  // ── Batch assign to mteam member ────────────────────────
  const handleAssignConfirm = async (mteamMember) => {
    if (!mteamMember?.referCode) {
      alert("This marketing member has no Refer Code set. Please add one first.");
      return;
    }

    setAssigning(true);
    try {
      let mteamCouponCode = null;
      if (mteamMember.assign_coupon_id) {
        const couponSnap = await getDoc(doc(db, COLLECTIONS.COUPONCODE, mteamMember.assign_coupon_id));
        if (couponSnap.exists() && couponSnap.data().active) {
          mteamCouponCode = couponSnap.data().code || null;
        }
      }

      const promises = Array.from(selectedUserIds).map(async (userId) => {
        await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
          referredBy:      mteamMember.referCode,
          referredByMteam: mteamMember.id,
          mteamCouponCode: mteamCouponCode,
        });
      });
      await Promise.all(promises);

      setAssignResult({ success: true, count: selectedUserIds.size, member: mteamMember.name });
      setSelectedUserIds(new Set());
      setShowAssignModal(false);
      await fetchAll();
    } catch (e) {
      setAssignResult({ success: false, error: e.message });
    } finally {
      setAssigning(false);
    }
  };

  // ── Export CSV ───────────────────────────────────────────
  const exportCSV = () => {
    const rows = filtered.map(l => ({
      "Name":              l.name,
      "Mobile":            l.mobile,
      "Joined":            fmt(l.joinDate),
      "MLM Profile":       l.hasProfile ? "Yes" : "No",
      "Company":           l.companyName,
      "Designation":       l.designation,
      "Refer Code":        l.referCode || "—",
      "Referred By":       l.referredBy || "—",
      "Mktg Member":       l.referredByMteam ? "Yes" : "No",
      "Has Subscription":  l.hasAnySub ? "Yes" : "No",
      "Active Plan":       l.hasActiveSub ? "Yes" : "No",
      "Expired":           l.isFullyExpired ? "Yes" : "No",
      "Plan":              l.latestPlan,
      "Expiry Date":       fmt(l.expiryDate),
      "Days To Expiry":    l.daysToExpiry ?? "—",
      "Total Plans":       l.totalSubs,
      "Lead Status":       l.leadStatus,
      "Follow-up Date":    l.leadFollowup || "—",
      "Notes":             l.leadNotes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const hasActiveFilters = filterType !== "all" || filterPlan !== "all" || filterExpiry !== "all" ||
    filterStatus !== "all" || filterCompany !== "all" || filterDateFrom || filterDateTo || search || statFilter !== "all";

  const pageEligibleCount = pageSlice.filter(isAssignable).length;
  const allPageEligibleSelected = pageEligibleCount > 0 && pageSlice.filter(isAssignable).every(l => selectedUserIds.has(l._userId));

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Loading lead data…</p>
    </div>
  );
  if (error) return (
    <div className="m-6 p-5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
      <span className="font-bold">Error:</span> {error}
      <button onClick={fetchAll} className="ml-auto px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold">Retry</button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Modals */}
      {showAssignModal && (
        <AssignMteamModal
          mteamList={mteamList}
          selectedCount={selectedUserIds.size}
          onConfirm={handleAssignConfirm}
          onCancel={() => setShowAssignModal(false)}
          assigning={assigning}
        />
      )}
      {selectedLead && (
        <LeadPanel lead={selectedLead} onClose={() => setSelectedLead(null)} onSave={handleLeadSave} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            User Leads
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {leads.length} total users · {stats.withPlan} active plans · {stats.expired} need renewal
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            <IcoRefresh /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors">
            <IcoCSV /> Export CSV
          </button>
        </div>
      </div>

      {/* Assign result toast */}
      {assignResult && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-medium ${
          assignResult.success
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {assignResult.success
            ? `✅ ${assignResult.count} user${assignResult.count !== 1 ? "s" : ""} successfully assigned to ${assignResult.member}.`
            : `❌ Assignment failed: ${assignResult.error}`}
          <button onClick={() => setAssignResult(null)} className="ml-3 text-inherit opacity-60 hover:opacity-100">
            <IcoClose />
          </button>
        </div>
      )}

      {/* Due reminders */}
      {dueReminders.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden shadow-sm ${overdueCount > 0 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <div className={`flex items-center justify-between px-4 py-3 ${overdueCount > 0 ? "bg-red-100/60" : "bg-amber-100/60"}`}>
            <div className="flex items-center gap-2.5">
              <span className={`flex-shrink-0 ${overdueCount > 0 ? "text-red-500" : "text-amber-500"}`}>
                {overdueCount > 0 ? <IcoWarning /> : <IcoBell />}
              </span>
              <div>
                <p className={`font-bold text-sm ${overdueCount > 0 ? "text-red-800" : "text-amber-800"}`}>
                  {overdueCount > 0
                    ? `${overdueCount} Overdue follow-up${overdueCount > 1 ? "s" : ""}${dueTodayCount > 0 ? ` + ${dueTodayCount} due today` : ""}`
                    : `${dueTodayCount} Follow-up${dueTodayCount > 1 ? "s" : ""} due today`}
                </p>
                <p className={`text-[11px] ${overdueCount > 0 ? "text-red-600" : "text-amber-600"}`}>
                  Click a card to open the lead and update it, or dismiss when done.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={dismissAll}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${overdueCount > 0 ? "border-red-300 text-red-700 hover:bg-red-200" : "border-amber-300 text-amber-700 hover:bg-amber-200"}`}>
                Dismiss all
              </button>
              <button onClick={() => setReminderCollapsed(p => !p)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${overdueCount > 0 ? "text-red-500 hover:bg-red-200" : "text-amber-500 hover:bg-amber-200"}`}>
                {reminderCollapsed ? <IcoChevD /> : <IcoChevU />}
              </button>
            </div>
          </div>
          {!reminderCollapsed && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto">
              {dueReminders.map(lead => {
                const isOverdue = lead.leadFollowup < new Date().toISOString().slice(0, 10);
                const daysOverdue = isOverdue ? Math.round((new Date() - new Date(lead.leadFollowup)) / 86400000) : 0;
                return (
                  <div key={lead.mobile}
                    className={`rounded-xl border p-3 bg-white shadow-sm flex flex-col gap-2 hover:shadow-md transition-all ${isOverdue ? "border-red-200" : "border-amber-200"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 text-sm truncate">{lead.name}</p>
                        <p className="text-[11px] font-mono text-gray-400 truncate">{lead.mobile}</p>
                      </div>
                      <button onClick={() => dismissReminder(lead.mobile)}
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                        <IcoClose />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[lead.leadStatus] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {lead.leadStatus}
                      </span>
                      {isOverdue
                        ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">{daysOverdue === 0 ? "Overdue" : `${daysOverdue}d overdue`}</span>
                        : <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Due today</span>}
                    </div>
                    <p className={`text-[11px] font-semibold ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
                      📅 Was due: {new Date(lead.leadFollowup).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    {lead.leadNotes && <p className="text-[11px] text-gray-500 italic line-clamp-2">"{lead.leadNotes}"</p>}
                    <div className="flex items-center gap-1.5">
                      {lead.hasActiveSub
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">Active Plan</span>
                        : lead.isFullyExpired
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold">Plan Expired</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 font-semibold">No Plan</span>}
                    </div>
                    <button onClick={() => setSelectedLead(lead)}
                      className={`mt-auto w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${isOverdue ? "bg-red-500 hover:bg-red-600 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}`}>
                      Open &amp; Update Lead →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Date Range */}
      <div className="bg-white rounded-2xl border border-violet-100 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-violet-700 mb-1 sm:mb-0 sm:pb-0.5 whitespace-nowrap">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
            Date Range
          </div>
          <div className="flex flex-wrap items-end gap-3 flex-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Join From</label>
              <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setStatFilter("all"); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Join To</label>
              <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setStatFilter("all"); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            {(filterDateFrom || filterDateTo) && (
              <button onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setPage(1); }}
                className="self-end px-3 py-1.5 text-xs font-semibold text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors">
                Clear dates
              </button>
            )}
            {(filterDateFrom || filterDateTo) && (
              <span className="self-end text-[11px] text-violet-500 font-medium pb-1.5">
                Showing {dateFilteredLeads.length} of {leads.length} users in range
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total Users"  value={stats.total}       color="violet" active={statFilter === "all"}        onClick={() => { setStatFilter("all"); setPage(1); }} />
        <StatCard label="With Profile" value={stats.withProfile} color="blue"   active={statFilter === "withProfile"} onClick={() => { setStatFilter(p => p === "withProfile" ? "all" : "withProfile"); setPage(1); }} />
        <StatCard label="No Profile"   value={stats.noProfile}   color="gray"   active={statFilter === "noProfile"}   onClick={() => { setStatFilter(p => p === "noProfile" ? "all" : "noProfile"); setPage(1); }} />
        <StatCard label="Active Plan"  value={stats.withPlan}    color="green"  active={statFilter === "withPlan"}    onClick={() => { setStatFilter(p => p === "withPlan" ? "all" : "withPlan"); setPage(1); }} />
        <StatCard label="No Plan"      value={stats.noPlan}      color="amber"  active={statFilter === "noPlan"}      onClick={() => { setStatFilter(p => p === "noPlan" ? "all" : "noPlan"); setPage(1); }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Need Renewal"   value={stats.expired}   color="red"   sub="Fully expired"   active={statFilter === "expired"}   onClick={() => { setStatFilter(p => p === "expired" ? "all" : "expired"); setPage(1); }} />
        <StatCard label="Expiring Today" value={stats.expiring1} color="rose"  sub="Within 1 day"   active={statFilter === "expiring1"}  onClick={() => { setStatFilter(p => p === "expiring1" ? "all" : "expiring1"); setPage(1); }} />
        <StatCard label="Expiring Soon"  value={stats.expiring3} color="amber" sub="Within 3 days"  active={statFilter === "expiring3"}  onClick={() => { setStatFilter(p => p === "expiring3" ? "all" : "expiring3"); setPage(1); }} />
        <StatCard label="Expiring 7d"    value={stats.expiring7} color="amber" sub="Within 7 days"  active={statFilter === "expiring7"}  onClick={() => { setStatFilter(p => p === "expiring7" ? "all" : "expiring7"); setPage(1); }} />
        <StatCard label="Expiring 15d"   value={stats.expiring15}color="blue"  sub="Within 15 days" active={statFilter === "expiring15"} onClick={() => { setStatFilter(p => p === "expiring15" ? "all" : "expiring15"); setPage(1); }} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <IcoFilter /> Filters
            {hasActiveFilters && <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[11px]">Active</span>}
          </div>
          <button onClick={resetFilters} className="text-xs text-violet-600 font-semibold hover:text-violet-800">Reset all</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Profile filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">MLM Profile</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="all">All Users</option>
              <option value="withProfile">Has Profile</option>
              <option value="noProfile">No Profile</option>
            </select>
          </div>
          {/* Plan filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Plan Status</label>
            <select value={filterPlan} onChange={e => { setFilterPlan(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="all">All</option>
              <option value="withPlan">Active Plan</option>
              <option value="noPlan">No Plan</option>
              <option value="expired">Expired (Need Renewal)</option>
            </select>
          </div>
          {/* Expiry filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Expiring In</label>
            <select value={filterExpiry} onChange={e => { setFilterExpiry(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="all">Any Time</option>
              <option value="1day">1 Day</option>
              <option value="2day">2 Days</option>
              <option value="3day">3 Days</option>
              <option value="7day">7 Days</option>
              <option value="15day">15 Days</option>
            </select>
          </div>
          {/* Lead Status */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Lead Status</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Company filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Company</label>
            <select value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="all">All Companies</option>
              {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><IcoSearch /></span>
          <input type="text" placeholder="Search by name, mobile, company or refer code…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>

        <p className="text-xs text-gray-400">
          Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{leads.length}</span> users
        </p>
      </div>

      {/* Batch action bar */}
      {selectedUserIds.size > 0 && (
        <div className="bg-violet-600 rounded-2xl px-5 py-3 flex items-center justify-between gap-3 shadow-lg shadow-violet-500/25">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {selectedUserIds.size}
            </div>
            <p className="text-white font-semibold text-sm">
              {selectedUserIds.size} user{selectedUserIds.size !== 1 ? "s" : ""} selected
              <span className="text-white/70 font-normal ml-1">(selected leads can be assigned or reassigned)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-violet-700 text-sm font-bold hover:bg-violet-50 transition-colors">
              <IcoLink /> Assign to Marketing Member
            </button>
            <button onClick={clearSelection}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors">
              <IcoClose />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-3 text-left">
                  <div className="flex items-center gap-1">
                    <input type="checkbox"
                      checked={allPageEligibleSelected}
                      onChange={selectAllOnPage}
                      disabled={pageEligibleCount === 0}
                      title="Select all eligible on this page"
                      className="w-3.5 h-3.5 rounded accent-violet-600 cursor-pointer disabled:cursor-not-allowed" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">#</span>
                  </div>
                </th>
                {["User", "Created At", "Mobile", "Referred By", "MLM Profile", "Plan Status", "Plan", "Expiry", "Days Left", "Lead Status", "Follow-up", "Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageSlice.length === 0
                ? <tr><td colSpan={13} className="py-16 text-center text-gray-400 text-sm">No leads match your filters.</td></tr>
                : pageSlice.map((lead, i) => {
                  const isExpanded = expandedRow === lead.mobile;
                  const days = lead.daysToExpiry;
                  const daysColor = days === null ? "" : days <= 1 ? "text-red-600 font-bold" : days <= 7 ? "text-orange-500 font-semibold" : days <= 15 ? "text-amber-500" : "text-emerald-600";
                  const eligible = isAssignable(lead);
                  const isChecked = lead._userId && selectedUserIds.has(lead._userId);
                  return (
                    <>
                      <tr key={lead.mobile} className={`hover:bg-gray-50/80 transition-colors ${isExpanded ? "bg-violet-50/30" : ""} ${isChecked ? "bg-violet-50/50" : ""}`}>
                        {/* Checkbox */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            {eligible ? (
                              <input type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelect(lead._userId)}
                                className="w-3.5 h-3.5 rounded accent-violet-600 cursor-pointer" />
                            ) : (
                              <span className="w-3.5 h-3.5" />
                            )}
                            <span className="text-gray-400 text-[11px]">{(currentPage - 1) * pageSize + i + 1}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-gray-800 whitespace-nowrap">{lead.name}</div>
                          {lead.companyName !== "—" && <div className="text-[10px] text-gray-400">{lead.companyName}</div>}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(lead.joinDate)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-600">{lead.mobile}</td>
                        {/* Referred By column */}
                        <td className="px-3 py-3">
                          {lead.referredBy ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg inline-block">
                                {lead.referredBy}
                              </span>
                              {lead.referredByMteam && (
                                <span className="text-[10px] text-teal-600 font-semibold">Mktg. Member</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${lead.hasProfile ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {lead.hasProfile ? "✓ Profile" : "No Profile"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {lead.hasActiveSub
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
                            : lead.isFullyExpired
                              ? <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600">Expired</span>
                              : <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">No Plan</span>}
                        </td>
                        <td className="px-3 py-3">
                          {lead.latestPlan !== "—"
                            ? <span className="inline-block px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-semibold">{lead.latestPlan}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(lead.expiryDate)}</td>
                        <td className={`px-3 py-3 text-xs whitespace-nowrap ${daysColor}`}>
                          {days === null ? "—" : days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "Today!" : `${days}d`}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[lead.leadStatus] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {lead.leadStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{lead.leadFollowup || "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedLead(lead)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                              title="Manage Lead">
                              <IcoNote />
                            </button>
                            {lead.totalSubs > 0 && (
                              <button onClick={() => setExpandedRow(isExpanded ? null : lead.mobile)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                                title="View Subscriptions">
                                {isExpanded ? <IcoChevU /> : <IcoChevD />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={lead.mobile + "_exp"} className="bg-violet-50/20">
                          <td colSpan={13} className="px-6 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Subscription History ({lead.allSubs.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {lead.allSubs.map((s, si) => (
                                <div key={si} className={`rounded-xl px-3 py-2 border text-xs min-w-[200px] ${s.Active ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-gray-800">{s.plan || s.planType || "Plan"}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.Active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                      {s.Active ? "Active" : "Expired"}
                                    </span>
                                  </div>
                                  <div className="flex gap-4 text-gray-500">
                                    <span>Purchased: {fmt(s.PurchaseAt)}</span>
                                    <span>Expires: {s.expirydate || "—"}</span>
                                  </div>
                                  {s.PaymentAmount && <p className="text-gray-600 font-semibold mt-1">₹{s.PaymentAmount}</p>}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Rows per page:</span>
              {[10, 20, 50, 100].map(n => (
                <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
                  className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${pageSize === n ? "bg-violet-600 border-violet-600 text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <IcoChevL />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p;
                if (totalPages <= 7) p = i + 1;
                else if (currentPage <= 4) p = i + 1;
                else if (currentPage >= totalPages - 3) p = totalPages - 6 + i;
                else p = currentPage - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${currentPage === p ? "bg-violet-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <IcoChevR />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
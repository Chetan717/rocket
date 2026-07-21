import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../Firebase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";
import { COLLECTIONS } from "../../collections";

const COLORS = {
  violet: "#7c3aed", green: "#10b981", red: "#ef4444",
  blue: "#3b82f6", amber: "#f59e0b", gray: "#6b7280",
};
const PIE_COLORS = [COLORS.green, COLORS.red, COLORS.blue, COLORS.amber, COLORS.violet];

// ── Icons ────────────────────────────────────────────────────
const Ico = ({ d, cls = "w-4 h-4" }) => <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>;
const IcoRefresh = () => <Ico d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />;
const IcoExcel   = () => <Ico d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
const IcoCSV     = () => <Ico d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />;
const IcoFilter  = () => <Ico d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />;
const IcoSearch  = () => <Ico d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />;
const IcoChevL   = () => <Ico d="M15.75 19.5L8.25 12l7.5-7.5" />;
const IcoChevR   = () => <Ico d="M8.25 4.5l7.5 7.5-7.5 7.5" />;
const IcoChevD   = () => <Ico d="M19 9l-7 7-7-7" />;
const IcoChevU   = () => <Ico d="M5 15l7-7 7 7" />;

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
function monthLabel(d) {
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color, active, onClick }) {
  const pal = {
    violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-400" },
    green:  { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-400" },
    red:    { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-400" },
    blue:   { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-400" },
    amber:  { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-400" },
  }[color] || {};
  return (
    <button onClick={onClick}
      className={`flex flex-col gap-1 p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left w-full ${active ? `${pal.bg} border-transparent ring-2 ${pal.ring} shadow-md` : "bg-white border-gray-100 hover:shadow-md hover:-translate-y-0.5"}`}>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      <p className={`text-xs font-semibold mt-0.5 ${active ? pal.text : "text-gray-500"}`}>{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </button>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>)}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function UserSubscriptionDashboard() {
  const [subs,      setSubs]      = useState([]);
  const [users,     setUsers]     = useState([]);
  const [profiles,  setProfiles]  = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterCompany,  setFilterCompany]  = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [search,         setSearch]         = useState("");
  const [statFilter,     setStatFilter]     = useState("all");
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState(10);
  const [expandedMobile, setExpandedMobile] = useState(null);
  const [viewMode,       setViewMode]       = useState("users"); // "users" | "subscriptions"

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [subSnap, userSnap, profileSnap, compSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.SUBSCRIPTION)),
        getDocs(collection(db, COLLECTIONS.USERS)),
        getDocs(collection(db, COLLECTIONS.MLMPROFILES)),
        getDocs(collection(db, COLLECTIONS.MLMCOMP)),
      ]);
      setSubs(subSnap.docs.map(d => ({ _id: d.id, ...d.data() })));
      setUsers(userSnap.docs.map(d => ({ _id: d.id, ...d.data() })));
      setProfiles(profileSnap.docs.map(d => ({ _id: d.id, ...d.data() })));
      setCompanies(compSnap.docs.map(d => ({ _id: d.id, ...d.data() })));
    } catch (e) {
      setError("Failed to load: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Maps ────────────────────────────────────────────────────
  const companyMap = useMemo(() => {
    const m = {};
    companies.forEach(c => { if (c._id) m[c._id] = c; });
    return m;
  }, [companies]);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => {
      const k = String(u.mobileNo || u.mobile || u.phone || "").trim();
      if (k) m[k] = u;
    });
    return m;
  }, [users]);

  const profileMap = useMemo(() => {
    const m = {};
    profiles.forEach(p => {
      const k = String(p.mobile || p.mobileNo || "").trim();
      if (k) m[k] = p;
    });
    return m;
  }, [profiles]);

  // ── Enrich each subscription ─────────────────────────────────
  const allEnriched = useMemo(() => subs.map(s => {
    const mobile  = String(s.mobileNo || s.mobile || "").trim();
    const user    = userMap[mobile] || {};
    const profile = profileMap[mobile] || {};
    const companyId = profile.companyId || s.companyId || "";
    const companyFromMap = companyId ? (companyMap[companyId]?.name || "") : "";
    const companyName = profile.companyName || companyFromMap || s.company || s.companyName || "—";
    const purchaseDate = toDate(s.PurchaseAt);
    const expiryDateVal = toDate(s.expirydate) || toDate(s.expiryDate);
    const isActive  = s.Active === true;
    const isExpired = s.Expire === true || s.Active === false;

    return {
      ...s,
      mobile,
      userName:    s.UserName || s.userName || user.name || profile.fullName || profile.name || "—",
      companyName,
      designation: profile.designation || "—",
      referCode:   user.referCode || profile.referCode || "—",
      referredBy:  user.referredBy || profile.referredBy || "—",
      isActive,
      isExpired,
      purchaseDate,
      expiryDateVal,
    };
  }), [subs, userMap, profileMap, companyMap]);

  // ── Group by unique user (mobile) ────────────────────────────
  const userGroups = useMemo(() => {
    const map = {};
    allEnriched.forEach(s => {
      if (!s.mobile) return;
      if (!map[s.mobile]) {
        map[s.mobile] = {
          mobile: s.mobile,
          userName: s.userName,
          companyName: s.companyName,
          designation: s.designation,
          referCode: s.referCode,
          referredBy: s.referredBy,
          subs: [],
        };
      }
      map[s.mobile].subs.push(s);
    });

    // For each user group, compute derived fields
    return Object.values(map).map(g => {
      const sorted = [...g.subs].sort((a, b) => {
        if (!a.purchaseDate && !b.purchaseDate) return 0;
        if (!a.purchaseDate) return 1;
        if (!b.purchaseDate) return -1;
        return b.purchaseDate - a.purchaseDate;
      });

      const activeSubs  = sorted.filter(s => s.isActive);
      const expiredSubs = sorted.filter(s => s.isExpired);
      const latestActive = activeSubs[0] || null;
      const latestSub    = sorted[0] || null;

      const totalRevenue = g.subs.reduce((sum, s) => sum + (Number(s.PaymentAmount) || 0), 0);

      return {
        ...g,
        subs: sorted,
        activeSubs,
        expiredSubs,
        latestActive,
        latestSub,
        hasActive:   activeSubs.length > 0,
        totalSubs:   g.subs.length,
        totalRevenue,
        firstPurchase: sorted[sorted.length - 1]?.purchaseDate || null,
        lastPurchase:  sorted[0]?.purchaseDate || null,
      };
    });
  }, [allEnriched]);

  const companyOptions = useMemo(() => {
    const names = new Set(allEnriched.map(r => r.companyName).filter(Boolean));
    return ["all", ...Array.from(names).sort()];
  }, [allEnriched]);

  // ── Global stats (not date-filtered) ────────────────────────
  const globalStats = useMemo(() => {
    const totalUsers       = userGroups.length;
    const activeUsers      = userGroups.filter(g => g.hasActive).length;
    const expiredUsers     = userGroups.filter(g => !g.hasActive && g.expiredSubs.length > 0).length;
    const noSubUsers       = userGroups.filter(g => g.totalSubs === 0).length;
    const totalSubs        = allEnriched.length;
    const totalActiveSubs  = allEnriched.filter(s => s.isActive).length;
    const totalExpiredSubs = allEnriched.filter(s => s.isExpired).length;
    const totalRevenue     = allEnriched.reduce((sum, s) => sum + (Number(s.PaymentAmount) || 0), 0);
    return { totalUsers, activeUsers, expiredUsers, noSubUsers, totalSubs, totalActiveSubs, totalExpiredSubs, totalRevenue };
  }, [userGroups, allEnriched]);

  // ── Filter user groups ───────────────────────────────────────
  // Date filter applies to: which subscriptions fall in the range
  // A user is shown if they have at least one subscription in range (or no date filter)
  const filteredGroups = useMemo(() => {
    let groups = userGroups;

    // Date filter: filter subscriptions within range, keep users who have any
    const from = filterDateFrom ? new Date(filterDateFrom) : null;
    const to   = filterDateTo   ? (() => { const d = new Date(filterDateTo); d.setHours(23,59,59,999); return d; })() : null;

    if (from || to) {
      groups = groups.map(g => {
        const filteredSubs = g.subs.filter(s => {
          if (!s.purchaseDate) return false;
          if (from && s.purchaseDate < from) return false;
          if (to   && s.purchaseDate > to)   return false;
          return true;
        });
        if (filteredSubs.length === 0) return null;

        const activeSubs  = filteredSubs.filter(s => s.isActive);
        const expiredSubs = filteredSubs.filter(s => s.isExpired);
        return {
          ...g,
          subs:        filteredSubs,
          activeSubs,
          expiredSubs,
          hasActive:   activeSubs.length > 0,
          totalSubs:   filteredSubs.length,
          latestActive: activeSubs[0] || null,
          latestSub:    filteredSubs[0] || null,
          totalRevenue: filteredSubs.reduce((sum, s) => sum + (Number(s.PaymentAmount) || 0), 0),
        };
      }).filter(Boolean);
    }

    // Stat / status filter
    if (statFilter === "active" || filterStatus === "active")   groups = groups.filter(g => g.hasActive);
    if (statFilter === "expired" || filterStatus === "expired") groups = groups.filter(g => !g.hasActive && g.expiredSubs.length > 0);

    // Company filter
    if (filterCompany !== "all") groups = groups.filter(g => g.companyName === filterCompany);

    // Search
    const q = search.trim().toLowerCase();
    if (q) groups = groups.filter(g =>
      g.userName?.toLowerCase().includes(q) ||
      g.mobile?.includes(q) ||
      g.companyName?.toLowerCase().includes(q) ||
      g.subs.some(s => (s.plan || s.planType || "").toLowerCase().includes(q))
    );

    return groups;
  }, [userGroups, statFilter, filterStatus, filterCompany, filterDateFrom, filterDateTo, search]);

  // ── Stats from filtered ──────────────────────────────────────
  const filteredStats = useMemo(() => ({
    users:      filteredGroups.length,
    active:     filteredGroups.filter(g => g.hasActive).length,
    expired:    filteredGroups.filter(g => !g.hasActive).length,
    subs:       filteredGroups.reduce((s, g) => s + g.totalSubs, 0),
    revenue:    filteredGroups.reduce((s, g) => s + g.totalRevenue, 0),
  }), [filteredGroups]);

  // ── Chart: monthly subs purchased in filtered set ────────────
  const monthlyData = useMemo(() => {
    const map = {};
    filteredGroups.forEach(g => {
      g.subs.forEach(s => {
        if (!s.purchaseDate) return;
        const key = monthLabel(s.purchaseDate);
        if (!map[key]) map[key] = { month: key, New: 0, Renewal: 0, Active: 0, Expired: 0 };
        const isNew = g.totalSubs === 1 || s === g.subs[g.subs.length - 1];
        if (isNew) map[key].New++; else map[key].Renewal++;
        if (s.isActive) map[key].Active++;
        if (s.isExpired) map[key].Expired++;
      });
    });
    return Object.values(map).sort((a, b) => new Date("01 " + a.month) - new Date("01 " + b.month));
  }, [filteredGroups]);

  const planData = useMemo(() => {
    const map = {};
    filteredGroups.forEach(g => {
      g.subs.forEach(s => {
        const p = s.plan || s.planType || "Unknown";
        map[p] = (map[p] || 0) + 1;
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredGroups]);

  // ── Pagination ───────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageSlice   = filteredGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setFilterStatus("all"); setFilterCompany("all");
    setFilterDateFrom(""); setFilterDateTo("");
    setSearch(""); setStatFilter("all"); setPage(1);
  };

  // ── Export ───────────────────────────────────────────────────
  const exportRows = useMemo(() => {
    const rows = [];
    filteredGroups.forEach(g => {
      g.subs.forEach((s, i) => {
        rows.push({
          "Mobile":       g.mobile,
          "Name":         g.userName,
          "Company":      g.companyName,
          "Designation":  g.designation,
          "Plan":         s.plan || s.planType || "—",
          "Status":       s.isActive ? "Active" : "Expired",
          "Purchase Date":fmt(s.PurchaseAt),
          "Expiry Date":  s.expirydate || "—",
          "Duration (days)": s.duration || "—",
          "Amount (₹)":   s.PaymentAmount ?? "—",
          "Payment Mode": s.payment || "—",
          "Order ID":     s.OrderId || "—",
          "Coupon":       s.couponApplied || "—",
          "Refer Code":   g.referCode,
          "Referred By":  g.referredBy,
          "Sub #":        i + 1,
          "Total Plans":  g.totalSubs,
        });
      });
    });
    return rows;
  }, [filteredGroups]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subscriptions");
    XLSX.writeFile(wb, `subscriptions_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportCSV = () => {
    const ws  = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const a   = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `subscriptions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Loading subscription data…</p>
    </div>
  );
  if (error) return (
    <div className="m-6 p-5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
      <span className="font-bold">Error:</span> {error}
      <button onClick={fetchAll} className="ml-auto px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold">Retry</button>
    </div>
  );

  const hasActiveFilters = filterStatus !== "all" || filterCompany !== "all" || filterDateFrom || filterDateTo || search || statFilter !== "all";

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            User Subscription Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {globalStats.totalUsers} unique users · {globalStats.totalSubs} total subscriptions · ₹{globalStats.totalRevenue.toLocaleString("en-IN")} total revenue
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            <IcoRefresh /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            <IcoCSV /> CSV
          </button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors">
            <IcoExcel /> Export Excel
          </button>
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="All Users" value={globalStats.totalUsers}
          sub={`${globalStats.totalSubs} subscriptions`}
          color="violet" active={statFilter === "all"}
          onClick={() => { setStatFilter("all"); setPage(1); }} />
        <StatCard
          label="Active Users" value={globalStats.activeUsers}
          sub="Have active plan"
          color="green" active={statFilter === "active"}
          onClick={() => { setStatFilter(p => p === "active" ? "all" : "active"); setPage(1); }} />
        <StatCard
          label="Expired Users" value={globalStats.expiredUsers}
          sub="Need renewal"
          color="red" active={statFilter === "expired"}
          onClick={() => { setStatFilter(p => p === "expired" ? "all" : "expired"); setPage(1); }} />
        <StatCard
          label="Total Revenue" value={`₹${(globalStats.totalRevenue / 1000).toFixed(1)}k`}
          sub="All time"
          color="amber" active={false}
          onClick={() => {}} />
        <StatCard
          label="Active Plans" value={globalStats.totalActiveSubs}
          sub={`${globalStats.totalExpiredSubs} expired`}
          color="blue" active={false}
          onClick={() => {}} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Subscription Purchases</h3>
          {monthlyData.length === 0
            ? <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data for selected filters</div>
            : <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                  <RechartTooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="New"     fill={COLORS.blue}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Renewal" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Active"  fill={COLORS.green} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expired" fill={COLORS.red}   radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Plan Distribution</h3>
          {planData.length === 0
            ? <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data</div>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={planData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                    {planData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartTooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>}
        </div>
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
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Purchase From</label>
            <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Purchase To</label>
            <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="all">All Users</option>
              <option value="active">Active Only</option>
              <option value="expired">Expired Only</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Company</label>
            <select value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400">
              {companyOptions.map(o => <option key={o} value={o}>{o === "all" ? "All Companies" : o}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Search</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><IcoSearch /></span>
              <input type="text" placeholder="Name or mobile…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Showing <span className="font-semibold text-gray-600">{filteredGroups.length}</span> users ·{" "}
            <span className="font-semibold text-gray-600">{filteredStats.subs}</span> subscriptions ·{" "}
            ₹<span className="font-semibold text-gray-600">{filteredStats.revenue.toLocaleString("en-IN")}</span> revenue
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">View:</span>
            <button onClick={() => setViewMode("users")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${viewMode === "users" ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              By User
            </button>
            <button onClick={() => setViewMode("subscriptions")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${viewMode === "subscriptions" ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              By Subscription
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {viewMode === "users" ? (
        /* ── User-grouped view ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["#", "User", "Mobile", "Company", "Active Plan", "Total Plans", "Last Purchase", "Expiry Date", "Revenue ₹", "History"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageSlice.length === 0
                  ? <tr><td colSpan={10} className="py-16 text-center text-gray-400 text-sm">No records match your filters.</td></tr>
                  : pageSlice.map((g, i) => {
                    const isExpanded = expandedMobile === g.mobile;
                    const latest = g.latestActive || g.latestSub;
                    return (
                      <>
                        <tr key={g.mobile} className={`hover:bg-gray-50/80 transition-colors ${isExpanded ? "bg-violet-50/20" : ""}`}>
                          <td className="px-3 py-3 text-gray-400 text-[11px]">{(currentPage - 1) * pageSize + i + 1}</td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-gray-800 whitespace-nowrap">{g.userName}</div>
                            {g.designation !== "—" && <div className="text-[10px] text-gray-400">{g.designation}</div>}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-gray-600">{g.mobile}</td>
                          <td className="px-3 py-3">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-semibold whitespace-nowrap">{g.companyName}</span>
                          </td>
                          <td className="px-3 py-3">
                            {g.hasActive
                              ? <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {g.latestActive?.plan || g.latestActive?.planType || "Active"}
                                  </span>
                                </div>
                              : <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600">Expired</span>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-block w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold text-center leading-6">{g.totalSubs}</span>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(g.lastPurchase)}</td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {latest?.expirydate || "—"}
                          </td>
                          <td className="px-3 py-3 font-semibold text-gray-800">₹{g.totalRevenue.toLocaleString("en-IN")}</td>
                          <td className="px-3 py-3">
                            <button onClick={() => setExpandedMobile(isExpanded ? null : g.mobile)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-violet-50 hover:text-violet-600 transition-colors">
                              {isExpanded ? <IcoChevU /> : <IcoChevD />}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={g.mobile + "_exp"} className="bg-violet-50/20">
                            <td colSpan={10} className="px-6 py-4">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                                Subscription History for {g.userName} ({g.totalSubs} plans)
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {g.subs.map((s, si) => (
                                  <div key={si} className={`rounded-xl p-3 border text-xs ${s.isActive ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-bold text-gray-800 text-sm">{s.plan || s.planType || "Plan"}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                        {s.isActive ? "Active" : "Expired"}
                                      </span>
                                    </div>
                                    <div className="space-y-1 text-gray-600">
                                      <p>📅 Purchased: <span className="font-medium">{fmt(s.PurchaseAt)}</span></p>
                                      <p>⏰ Expires: <span className="font-medium">{s.expirydate || "—"}</span></p>
                                      {s.duration && <p>⏱ Duration: <span className="font-medium">{s.duration} days</span></p>}
                                      {s.PaymentAmount && <p>💰 Amount: <span className="font-semibold text-gray-800">₹{s.PaymentAmount}</span></p>}
                                      {s.payment && <p>💳 Mode: {s.payment}</p>}
                                      {s.couponApplied && <p>🎫 Coupon: <span className="font-mono">{s.couponApplied}</span></p>}
                                      {s.OrderId && <p className="font-mono text-[10px] text-gray-400">Order: {s.OrderId}</p>}
                                    </div>
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
          {filteredGroups.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Rows:</span>
                {[10, 20, 50, 100].map(n => (
                  <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
                    className={`px-2 py-0.5 rounded font-semibold border transition-colors ${pageSize === n ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 hover:border-violet-400 text-gray-600"}`}>{n}</button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><IcoChevL /></button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, idx) => {
                  let p;
                  if (totalPages <= 7) p = idx + 1;
                  else if (currentPage <= 4) p = idx + 1;
                  else if (currentPage >= totalPages - 3) p = totalPages - 6 + idx;
                  else p = currentPage - 3 + idx;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${p === currentPage ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>{p}</button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><IcoChevR /></button>
              </div>
              <p className="text-xs text-gray-400">Page {currentPage} of {totalPages} · {filteredGroups.length} users</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Flat subscription view ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["#", "Name", "Mobile", "Company", "Plan", "Type", "Status", "Purchase Date", "Expiry Date", "Duration", "Amount ₹", "Coupon"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(() => {
                  const flatSubs = [];
                  filteredGroups.forEach(g => {
                    g.subs.forEach(s => {
                      flatSubs.push({ ...s, userName: g.userName, mobile: g.mobile, companyName: g.companyName, totalSubs: g.totalSubs });
                    });
                  });
                  const paged = flatSubs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                  if (paged.length === 0) return <tr><td colSpan={12} className="py-16 text-center text-gray-400 text-sm">No records.</td></tr>;
                  return paged.map((s, i) => (
                    <tr key={s._id || i} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-3 py-3 text-gray-400 text-[11px]">{(currentPage - 1) * pageSize + i + 1}</td>
                      <td className="px-3 py-3 font-semibold text-gray-800 whitespace-nowrap">{s.userName}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-600">{s.mobile}</td>
                      <td className="px-3 py-3"><span className="inline-block px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-semibold">{s.companyName}</span></td>
                      <td className="px-3 py-3"><span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">{s.plan || s.planType || "—"}</span></td>
                      <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.totalSubs === 1 ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{s.totalSubs === 1 ? "New" : "Renewal"}</span></td>
                      <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}><span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-red-400"}`} />{s.isActive ? "Active" : "Expired"}</span></td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(s.PurchaseAt)}</td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{s.expirydate || "—"}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{s.duration || "—"}</td>
                      <td className="px-3 py-3 font-semibold text-gray-800">₹{s.PaymentAmount ?? "—"}</td>
                      <td className="px-3 py-3">{s.couponApplied ? <span className="font-mono text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{s.couponApplied}</span> : <span className="text-gray-300">—</span>}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Rows:</span>
              {[10, 20, 50, 100].map(n => (
                <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
                  className={`px-2 py-0.5 rounded font-semibold border transition-colors ${pageSize === n ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 hover:border-violet-400 text-gray-600"}`}>{n}</button>
              ))}
            </div>
            <p className="text-xs text-gray-400">{filteredStats.subs} total subscriptions</p>
          </div>
        </div>
      )}
    </div>
  );
}

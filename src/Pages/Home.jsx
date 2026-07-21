import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../Firebase";
import { COLLECTIONS } from "../collections";
import { getAdminSession } from "../Utils/adminSession";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const COLORS = [
  "#7c3aed",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
];

function toDate(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d) ? null : d;
  }
  return null;
}
function monthLabel(d) {
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

const IconUsers = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m5-4a4 4 0 10-6 0 4 4 0 006 0zm6 4a2 2 0 100-4 2 2 0 000 4zM3 16a2 2 0 100-4 2 2 0 000 4z" />
  </svg>
);
const IconTeam = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
);
const IconSub = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
  </svg>
);
const IconActive = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconExpired = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconCompany = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);
const IconAdmin = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);
const IconRefresh = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconNewUser = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
  </svg>
);
const IconLock = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

function StatCard({ label, value, icon, color, sub }) {
  const p = {
    violet: { bg: "bg-violet-50", text: "text-violet-600", icon: "bg-violet-100 text-violet-600", border: "border-violet-100" },
    green:  { bg: "bg-emerald-50", text: "text-emerald-600", icon: "bg-emerald-100 text-emerald-600", border: "border-emerald-100" },
    red:    { bg: "bg-red-50", text: "text-red-600", icon: "bg-red-100 text-red-600", border: "border-red-100" },
    blue:   { bg: "bg-blue-50", text: "text-blue-600", icon: "bg-blue-100 text-blue-600", border: "border-blue-100" },
    amber:  { bg: "bg-amber-50", text: "text-amber-600", icon: "bg-amber-100 text-amber-600", border: "border-amber-100" },
    pink:   { bg: "bg-pink-50", text: "text-pink-600", icon: "bg-pink-100 text-pink-600", border: "border-pink-100" },
    teal:   { bg: "bg-teal-50", text: "text-teal-600", icon: "bg-teal-100 text-teal-600", border: "border-teal-100" },
  }[color] || {};
  return (
    <div className={`flex items-center gap-4 p-5 rounded-2xl border ${p.border} bg-white shadow-sm hover:shadow-md transition-shadow duration-200`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${p.icon}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className={`text-xs font-semibold mt-0.5 ${p.text}`}>{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ── Access denied banner (non-admin users) ────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
        <IconLock />
      </div>
      <h3 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Syne', sans-serif" }}>
        Dashboard — Admin Only
      </h3>
      <p className="text-sm text-gray-500 max-w-xs">
        This page is only accessible to Master Admin and authorised admin users.
        Please use the sidebar to navigate to your assigned tabs.
      </p>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const adminInfo = useMemo(() => {
    return getAdminSession() || {};
  }, []);

  // ── Access control ─────────────────────────────────────────────────────────
  // Master Admin always sees it. Other roles see it only if "dashboard" is in assigntab.
  const isMasterAdmin = adminInfo.role === "Master Admin";
  const hasTabAccess  = isMasterAdmin || (adminInfo.assigntab && adminInfo.assigntab.includes("dashboard"));

  const greet = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const fetchAll = useCallback(async () => {
    if (!hasTabAccess) return;
    setLoading(true);
    setError(null);
    try {
      const [userSnap, mteamSnap, subSnap, compSnap, profileSnap, adminSnap] =
        await Promise.all([
          getDocs(collection(db, COLLECTIONS.USERS)),
          getDocs(collection(db, COLLECTIONS.MTEAM)),
          getDocs(collection(db, COLLECTIONS.SUBSCRIPTION)),
          getDocs(collection(db, COLLECTIONS.MLMCOMP)),
          getDocs(collection(db, COLLECTIONS.MLMPROFILES)),
          isMasterAdmin ? getDocs(collection(db, COLLECTIONS.ADMINUSER)) : Promise.resolve({ docs: [] }),
        ]);

      const users    = userSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      const mteam    = mteamSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      const subs     = subSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      const comps    = compSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      const profiles = profileSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      const admins   = adminSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));

      const activeSubs  = subs.filter((s) => s.Active === true);
      const expiredSubs = subs.filter((s) => s.Expire === true || s.Active === false);
      const activeMteam = mteam.filter((m) => m.active !== false);

      const monthMap = {};
      subs.forEach((s) => {
        const d = toDate(s.PurchaseAt);
        if (!d) return;
        const key = monthLabel(d);
        if (!monthMap[key]) monthMap[key] = { month: key, Total: 0, Active: 0, Expired: 0 };
        monthMap[key].Total++;
        if (s.Active === true) monthMap[key].Active++;
        if (s.Expire === true || s.Active === false) monthMap[key].Expired++;
      });
      const monthlyTrend = Object.values(monthMap)
        .sort((a, b) => new Date("01 " + a.month) - new Date("01 " + b.month))
        .slice(-7);

      const compSubCount = {};
      subs.forEach((s) => {
        const name = s.company || s.companyName || "—";
        compSubCount[name] = (compSubCount[name] || 0) + 1;
      });
      const companySubData = Object.entries(compSubCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      const planMap = {};
      subs.forEach((s) => {
        const p = s.plan || s.planType || "Unknown";
        planMap[p] = (planMap[p] || 0) + 1;
      });
      const planData = Object.entries(planMap).map(([name, value]) => ({ name, value }));

      const uniqueMobiles = new Set(
        subs.map((s) => String(s.mobileNo || s.mobile || "").trim()).filter(Boolean),
      );

      setData({
        totalUsers: users.length,
        totalMteam: mteam.length,
        activeMteam: activeMteam.length,
        totalSubs: subs.length,
        activeSubs: activeSubs.length,
        expiredSubs: expiredSubs.length,
        totalCompanies: comps.length,
        totalAdmins: admins.length,
        totalProfiles: profiles.length,
        uniqueSubUsers: uniqueMobiles.size,
        monthlyTrend,
        companySubData,
        planData,
      });
    } catch (e) {
      console.error("[Dashboard] Fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [hasTabAccess, isMasterAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Access denied ──────────────────────────────────────────────────────────
  if (!hasTabAccess) return <AccessDenied />;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-700 p-6 text-white shadow-xl shadow-violet-500/20">
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-violet-200 text-sm font-medium mb-1">{greet} 👋</p>
            <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
              Welcome back, {adminInfo.name || "Admin"}!
            </h2>
            <p className="text-violet-200 text-sm">Here's a live overview of your MLMLIVE platform.</p>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors border border-white/20"
          >
            <IconRefresh /> {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -right-4 -bottom-12 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-28 -top-6 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
          <span className="font-bold">Error:</span> {error}
          <button onClick={fetchAll} className="ml-auto px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold">Retry</button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading dashboard…</p>
        </div>
      ) : data ? (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard label="Total App Users"        value={data.totalUsers}    icon={<IconUsers />}   color="violet" sub="Registered in app" />
            <StatCard label="Marketing Team"         value={data.totalMteam}    icon={<IconTeam />}    color="blue"   sub={`${data.activeMteam} active`} />
            <StatCard label="Total Subscriptions"    value={data.totalSubs}     icon={<IconSub />}     color="amber"  sub={`${data.uniqueSubUsers} unique users`} />
            <StatCard label="Active Subscriptions"   value={data.activeSubs}    icon={<IconActive />}  color="green"  sub="Currently active" />
            <StatCard label="Expired Subscriptions"  value={data.expiredSubs}   icon={<IconExpired />} color="red"    sub="Needs renewal" />
            <StatCard label="Total Companies"        value={data.totalCompanies} icon={<IconCompany />} color="teal"  sub="On the platform" />
            <StatCard label="MLM Profiles"           value={data.totalProfiles} icon={<IconNewUser />} color="pink"   sub="Created profiles" />
            <StatCard label="Admin Users"            value={data.totalAdmins}   icon={<IconAdmin />}   color="violet" sub="Platform admins" />
          </div>

          {/* ── Charts Row 1 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Subscription Trend</h3>
              {data.monthlyTrend.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-400 text-sm">No subscription data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.monthlyTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                    <RechartTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Total"   fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Active"  fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expired" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Plan Distribution</h3>
              {data.planData.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-400 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={data.planData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {data.planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Charts Row 2 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.companySubData.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Subscriptions by Company</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.companySubData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} width={90} />
                    <RechartTooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Subscriptions" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Active vs Expired Subscriptions</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[{ name: "Active", value: data.activeSubs }, { name: "Expired", value: data.expiredSubs }]}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <RechartTooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-emerald-600">{data.activeSubs}</p>
                  <p className="text-[11px] text-gray-400 font-medium">Active</p>
                </div>
                <div className="w-px bg-gray-100" />
                <div className="text-center">
                  <p className="text-xl font-bold text-red-500">{data.expiredSubs}</p>
                  <p className="text-[11px] text-gray-400 font-medium">Expired</p>
                </div>
                <div className="w-px bg-gray-100" />
                <div className="text-center">
                  <p className="text-xl font-bold text-violet-600">
                    {data.totalSubs > 0 ? Math.round((data.activeSubs / data.totalSubs) * 100) : 0}%
                  </p>
                  <p className="text-[11px] text-gray-400 font-medium">Active Rate</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Platform summary ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Platform Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "New Clients",        value: data.totalSubs > 0 ? data.totalSubs - data.uniqueSubUsers : 0, color: "text-blue-600" },
                { label: "Unique Subscribers", value: data.uniqueSubUsers, color: "text-violet-600" },
                { label: "Active Marketing",   value: data.activeMteam,    color: "text-emerald-600" },
                { label: "Platform Admins",    value: data.totalAdmins,    color: "text-amber-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center p-4 rounded-xl bg-gray-50">
                  <p className={`text-3xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1 text-center">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

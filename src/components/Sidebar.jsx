import {
  Dots9,
  LogoMicrosoftOffice,
  LayoutHeaderColumns,
  GeoPolygons,
  ChartTreemap,
  Hand,
} from "@gravity-ui/icons";
import { useNavigate } from "react-router";
import logo from "/mlmboo2.ico?url";
import { getAdminSession } from "../Utils/adminSession";
import { useAdminAuth } from "../Auth/AdminAuthContext";

const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const BarChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const PersonIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m5-4a4 4 0 10-6 0 4 4 0 006 0zm6 4a2 2 0 100-4 2 2 0 000 4zM3 16a2 2 0 100-4 2 2 0 000 4z" />
  </svg>
);

// Chart / report icon for Template Data
const ReportIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TaskIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01" />
  </svg>
);

// ── Template-related tab IDs that give access to /templates ────────────────
const TEMPLATE_TAB_IDS = ["templates", "templates_operation", "templates_quality"];

// ── All possible nav items ─────────────────────────────────────────────────
const ALL_NAV_ITEMS = [
  { icon: Dots9,              label: "Dashboard",              id: "dashboard",       link: "/" },
  { icon: LogoMicrosoftOffice,label: "Companies",              id: "companies",       link: "/companies" },
  { icon: LayoutHeaderColumns, label: "Templates",             id: "templates",       link: "/templates",
    // also shown when user has sub-permissions
    altIds: ["templates_operation", "templates_quality"] },
  { icon: GeoPolygons,        label: "App Graphics",           id: "Graphics",        link: "/graphics" },
  { icon: ChartTreemap,       label: "Marketing",              id: "marketing",       link: "/marketing" },
  { icon: ChartTreemap,       label: "Remove Background API",  id: "removebg",        link: "/removebg" },
  { iconComponent: BarChartIcon, label: "Subscription Dashboard", id: "userdashboard", link: "/userdashboard" },
  { iconComponent: PersonIcon,   label: "User Leads",          id: "leads",           link: "/leads" },
  { iconComponent: ReportIcon,   label: "Template Data",       id: "templatedata",    link: "/templatedata" },
  { iconComponent: TaskIcon,     label: "Task Management",     id: "taskmanagement", link: "/taskmanagement" },
  { iconComponent: ShieldIcon,   label: "Admin Management",    id: "adminmanagement", link: "/adminmanagement" },
];

const BOTTOM_ITEMS = [
  { label: "Logout", id: "logout" },
];

function getAdminUser() {
  return getAdminSession() || {};
}

function getVisibleNavItems(admin) {
  if (!admin || !admin.role) return [];
  if (admin.role === "Master Admin") return ALL_NAV_ITEMS;
  const assigned = Array.isArray(admin.assigntab) ? admin.assigntab : [];

  return ALL_NAV_ITEMS.filter(item => {
    // Primary tab id match
    if (assigned.includes(item.id)) return true;
    // Alt IDs (e.g. templates_operation / templates_quality both show Templates nav)
    if (item.altIds && item.altIds.some(a => assigned.includes(a))) return true;
    return false;
  });
}

export default function Sidebar({
  collapsed,
  mobileOpen, setMobileOpen,
  active, setActive,
}) {
  const navigate  = useNavigate();
  const { logout } = useAdminAuth();
  const adminUser = getAdminUser();
  const navItems  = getVisibleNavItems(adminUser);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const hanClick = (id, link) => {
    setActive(id);
    setMobileOpen(false);
    navigate(link);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed md:relative top-0 left-0 z-50 md:z-auto",
          "h-full flex flex-col",
          "bg-white dark:bg-[#0f1117]",
          "border-r border-gray-100 dark:border-gray-800/70",
          "transition-all duration-300 ease-in-out",
          "shadow-xl md:shadow-none overflow-hidden",
          collapsed ? "md:w-[72px]" : "md:w-60",
          mobileOpen ? "w-60 translate-x-0" : "w-60 -translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-[18px] border-b border-gray-100 dark:border-gray-800/70">
          <div className="min-w-[36px] w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
            <img src={logo} alt="logo" />
          </div>
          <span
            className={["font-bold text-[17px] text-gray-900 dark:text-white tracking-tight whitespace-nowrap transition-all duration-300", collapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : "opacity-100"].join(" ")}
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            <span className="text-violet-500">MLMLIVE</span>
          </span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          <p className={["text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-600 px-3 mb-2 transition-all duration-200 whitespace-nowrap", collapsed ? "md:opacity-0 md:h-0 md:mb-0 md:overflow-hidden" : "opacity-100"].join(" ")}>
            Menu
          </p>

          {navItems.map(({ icon: Icon, iconComponent: IconComp, label, id, badge, link }) => {
            // A Templates sub-permission user is "active" on templates id
            const isActive = active === id ||
              (id === "templates" && TEMPLATE_TAB_IDS.includes(active));
            const RenderIcon = IconComp ? IconComp : Icon ? () => <Icon className="w-5 h-5" /> : null;
            return (
              <button
                key={id}
                onClick={() => hanClick(id, link)}
                className={[
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-800 dark:hover:text-gray-200",
                ].join(" ")}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-violet-500 rounded-r-full" />
                )}
                <span className={["min-w-[20px] flex-shrink-0 transition-colors", isActive ? "text-violet-500" : "group-hover:text-violet-400"].join(" ")}>
                  {RenderIcon && <RenderIcon />}
                </span>
                <span className={["flex-1 text-left whitespace-nowrap transition-all duration-300", collapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : "opacity-100"].join(" ")}>
                  {label}
                </span>
                {badge && !collapsed && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500 text-white min-w-[18px] text-center leading-none">{badge}</span>
                )}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg hidden md:flex items-center gap-1.5">
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: logout + user strip */}
        <div className="border-t border-gray-100 dark:border-gray-800/70 px-2 py-3 space-y-0.5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500"
          >
            <span className="min-w-[20px] flex-shrink-0">
              <Hand className="w-5 h-5" />
            </span>
            <span className={["flex-1 text-left whitespace-nowrap transition-all duration-300", collapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : "opacity-100"].join(" ")}>
              Logout
            </span>
            {collapsed && (
              <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg hidden md:block">
                Logout
              </span>
            )}
          </button>

          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            <div className="min-w-[36px] w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {adminUser.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div className={["overflow-hidden transition-all duration-300", collapsed ? "md:opacity-0 md:w-0" : "opacity-100"].join(" ")}>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight whitespace-nowrap">
                {adminUser.name || "Admin"}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {adminUser.role || "—"}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

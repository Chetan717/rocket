import { memo, useMemo, useState, useEffect } from "react";
import { Ellipsis } from "@gravity-ui/icons";
import { Pagination } from "./TempHome";

const PAGE_SIZE = 20;

function typeBadge(mainType) {
  return mainType === "MLM"
    ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20"
    : "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20";
}

function Tab({ label, count, active, onClick, color }) {
  const colors = {
    violet: active
      ? "bg-violet-600 text-white shadow-sm shadow-violet-500/20"
      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
    sky: active
      ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${colors[color]}`}
    >
      {label}
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${active ? "bg-white/25" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>
        {count}
      </span>
    </button>
  );
}

function StatusPill({ value, yes = "Active", no = "Inactive" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      value
        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value ? "bg-emerald-500" : "bg-gray-400"}`} />
      {value ? yes : no}
    </span>
  );
}

function IssuePill({ count }) {
  if (!count) return <span className="text-gray-300 dark:text-gray-600 text-[11px]">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-[10px] font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      {count}
    </span>
  );
}

function EmptyState({ filtered, type }) {
  return (
    <tr>
      <td colSpan={10} className="py-20 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Ellipsis className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            {filtered ? `No ${type} templates match this filter` : `No ${type} templates found`}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {filtered ? "Try a different search or filter." : "Click Add Template to create one."}
          </p>
        </div>
      </td>
    </tr>
  );
}

const SectionTable = memo(function SectionTable({ templates, onSelect, filtered, type, companiesMap, issueCountMap }) {
  const [page, setPage] = useState(1);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(templates.length / PAGE_SIZE)), [templates]);

  useEffect(() => {
    setPage((p) => (p > Math.max(1, Math.ceil(templates.length / PAGE_SIZE)) ? 1 : p));
  }, [templates]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return templates.slice(start, start + PAGE_SIZE);
  }, [templates, page]);

  const TH = ({ children, className = "" }) => (
    <th className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap ${className}`}>
      {children}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                <TH>#</TH>
                <TH>Company Name</TH>
                <TH>Type</TH>
                <TH>Select Type</TH>
                <TH>Subtype</TH>
                <TH>Date</TH>
                <TH className="text-center">Graphics</TH>
                <TH className="text-center">Active</TH>
                <TH className="text-center">Launched</TH>
                <TH className="text-center">Issues</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {paginated.length === 0 ? (
                <EmptyState filtered={filtered} type={type} />
              ) : paginated.map((tpl, i) => {
                const companyName = companiesMap?.[tpl.Company] || tpl.Company || "—";
                const issueCount  = issueCountMap?.[tpl.id] || 0;
                return (
                  <tr
                    key={tpl.id}
                    onClick={() => onSelect(tpl)}
                    className="hover:bg-violet-50/40 dark:hover:bg-violet-500/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-[11px]">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
                      {companyName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${typeBadge(tpl.MainType)}`}>
                        {tpl.MainType || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                      {tpl.SelectType ? tpl.SelectType.replace(/_/g, " ") : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[140px] truncate text-xs">
                      {tpl.Subtype || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {tpl.Date || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold">
                        {(tpl.GraphicsLink || []).length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill value={tpl.Active} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill value={tpl.Launched} yes="Launched" no="Draft" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <IssuePill count={issueCount} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
});

// ── Main export ────────────────────────────────────────────────────────────
export default function TemplateTable({
  templates,
  onSelect,
  filtered,
  companiesMap,
  issueCountMap,
  activeTab,
  onTabChange,
}) {
  const mlmTemplates     = useMemo(() => templates.filter(t => t.MainType === "MLM"),     [templates]);
  const generalTemplates = useMemo(() => templates.filter(t => t.MainType === "General"), [templates]);

  const shown = activeTab === "MLM" ? mlmTemplates : generalTemplates;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
        <Tab
          label="MLM Templates"
          count={mlmTemplates.length}
          active={activeTab === "MLM"}
          onClick={() => onTabChange("MLM")}
          color="violet"
        />
        <Tab
          label="General Templates"
          count={generalTemplates.length}
          active={activeTab === "General"}
          onClick={() => onTabChange("General")}
          color="sky"
        />
      </div>

      {/* Table */}
      <SectionTable
        key={activeTab}
        templates={shown}
        onSelect={onSelect}
        filtered={filtered}
        type={activeTab}
        companiesMap={companiesMap}
        issueCountMap={issueCountMap}
      />
    </div>
  );
}

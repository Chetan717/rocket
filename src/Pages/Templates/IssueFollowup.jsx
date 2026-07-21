import { memo, useState, useMemo, useCallback } from "react";

const PAGE_SIZE = 10;

function IconFix() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
function IconChevron({ open }) {
  return (
    <svg className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
    </svg>
  );
}

function typeBadge(mainType) {
  return mainType === "MLM"
    ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20"
    : "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20";
}

const IssueRow = memo(function IssueRow({ item, idx, onFix, companies }) {
  const { template, issueCount, issueNotes } = item;
  const firstNote = issueNotes.find(n => n.trim()) || "";
  const companyName = companies?.[template.Company] || template.Company || "—";

  return (
    <tr
      className="hover:bg-red-50/40 dark:hover:bg-red-500/5 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
    >
      {/* # */}
      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-[11px] text-center">
        {idx + 1}
      </td>

      {/* Company Name */}
      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
        {companyName}
      </td>

      {/* Select Type */}
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
        {template.SelectType ? template.SelectType.replace(/_/g, " ") : "—"}
      </td>

      {/* Subtype */}
      <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs max-w-[120px] truncate">
        {template.Subtype || <span className="text-gray-300 dark:text-gray-600">—</span>}
      </td>

      {/* Issue count */}
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-[11px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          {issueCount} issue{issueCount !== 1 ? "s" : ""}
        </span>
      </td>

      {/* Note preview */}
      <td className="px-4 py-3 max-w-[180px]">
        {firstNote ? (
          <span className="text-xs text-red-500 dark:text-red-400 truncate block italic" title={firstNote}>
            "{firstNote}"
          </span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">No note</span>
        )}
      </td>

      {/* Fix button */}
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onFix(template)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold transition-colors shadow-sm shadow-red-500/20"
        >
          <IconFix />
          Fix Issue
        </button>
      </td>
    </tr>
  );
});

function SummaryChips({ items }) {
  const byType = useMemo(() => {
    const map = {};
    items.forEach(({ template, issueCount }) => {
      const key = template.MainType;
      if (!map[key]) map[key] = { type: template.MainType, count: 0 };
      map[key].count += issueCount;
    });
    return Object.values(map);
  }, [items]);

  const totalIssues = useMemo(() => items.reduce((s, i) => s + i.issueCount, 0), [items]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-xs font-bold">
        {totalIssues} total issue{totalIssues !== 1 ? "s" : ""}
      </span>
      <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold">
        {items.length} template{items.length !== 1 ? "s" : ""} affected
      </span>
      {byType.map(({ type, count }) => (
        <span key={type} className={`px-3 py-1 rounded-full text-xs font-semibold border ${typeBadge(type)}`}>
          {type}: {count}
        </span>
      ))}
    </div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800">
      <button
        onClick={() => onPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400 px-2">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPage(p => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

export default function IssueFollowup({ items, onFix, loading, companies = {} }) {
  const [open,          setOpen]         = useState(true);
  const [search,        setSearch]       = useState("");
  const [filterCompany, setFilterCompany]= useState("");
  const [page,          setPage]         = useState(1);

  const totalIssues = useMemo(() => items.reduce((s, i) => s + i.issueCount, 0), [items]);

  // Build company options from items
  const companyOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    items.forEach(({ template }) => {
      const cId = template.Company;
      if (cId && !seen.has(cId)) {
        seen.add(cId);
        opts.push({ id: cId, name: companies[cId] || cId });
      }
    });
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, companies]);

  const filtered = useMemo(() => {
    let list = items;
    if (filterCompany) list = list.filter(i => i.template.Company === filterCompany);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i => {
        const t = i.template;
        const cName = (companies[t.Company] || t.Company || "").toLowerCase();
        return (
          cName.includes(q) ||
          (t.SelectType || "").toLowerCase().includes(q) ||
          (t.Subtype    || "").toLowerCase().includes(q) ||
          i.issueNotes.some(n => n.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [items, filterCompany, search, companies]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Reset page when filters change
  const handleSearch = useCallback((e) => { setSearch(e.target.value); setPage(1); }, []);
  const handleCompany = useCallback((e) => { setFilterCompany(e.target.value); setPage(1); }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-red-100 dark:border-red-500/20 bg-red-50/40 dark:bg-red-500/5 p-4 flex items-center gap-3">
        <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-sm text-red-500 dark:text-red-400">Checking for issues…</span>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">

      {/* Header */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-red-50 dark:bg-red-500/10 hover:bg-red-100/60 dark:hover:bg-red-500/15 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0 text-red-500 dark:text-red-400">
          <IconAlert />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-red-700 dark:text-red-400">Issues Follow-up</span>
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
              {totalIssues}
            </span>
          </div>
          <p className="text-xs text-red-400 dark:text-red-500 mt-0.5">
            {items.length} template{items.length !== 1 ? "s" : ""} need attention — click Fix Issue to open edit page
          </p>
        </div>
        <span className="text-red-400 flex-shrink-0">
          <IconChevron open={open} />
        </span>
      </button>

      {open && (
        <div>
          {/* Summary chips */}
          <div className="px-5 py-3 border-b border-red-100 dark:border-red-500/20 bg-red-50/40 dark:bg-red-500/5">
            <SummaryChips items={items} />
          </div>

          {/* Search + Company filter */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <IconSearch />
              </span>
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Search by company, type, subtype, note…"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300/40 focus:border-red-400 transition-all"
              />
            </div>
            {companyOptions.length > 0 && (
              <select
                value={filterCompany}
                onChange={handleCompany}
                className="pl-3 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-300/40 focus:border-red-400 transition-all appearance-none cursor-pointer"
              >
                <option value="">All Companies</option>
                {companyOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-gray-400 self-center flex-shrink-0">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                  {["#", "Company Name", "Select Type", "Subtype", "Issues", "Note Action", "Action"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-gray-400">
                      No issues match the current filter.
                    </td>
                  </tr>
                ) : paginated.map((item, idx) => (
                  <IssueRow
                    key={item.template.id}
                    item={item}
                    idx={(page - 1) * PAGE_SIZE + idx}
                    onFix={onFix}
                    companies={companies}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPage={setPage} />

          {/* Footer hint */}
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              💡 Click <strong>Fix Issue</strong> to open the template editor — issue-flagged graphics rows are highlighted. You must update the quality check status before saving.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

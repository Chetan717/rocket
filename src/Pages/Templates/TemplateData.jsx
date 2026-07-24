import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../../Firebase";
import { COLLECTIONS } from "../../collections";
import {
  getGraphicsStableKey,
  getSubtypeQualityKey,
  hasSelectedCurrentFlag,
  isSubtypeQualityDoc,
  normalizeQualityFlag,
} from "./qualityUtils";

// ── Icons ──────────────────────────────────────────────────────────────────
function IconDownload() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

// ── Pill badge ─────────────────────────────────────────────────────────────
function Pill({ value, color = "gray" }) {
  const map = {
    gray:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    violet:  "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
    blue:    "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    red:     "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    sky:     "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
    amber:   "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    orange:  "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  };
  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${map[color]}`}>
      {value}
    </span>
  );
}

/**
 * Match the Quality Check modal exactly: graphics links only have OK or Issue.
 * A link without either saved flag stays unselected; it is never counted as OK.
 * Legacy Checked/Working records are normalized by normalizeQualityFlag().
 * Stale checks that belong to deleted graphics links are intentionally ignored.
 */
function getTemplateQualityCounts(template, qualityDoc) {
  const links = Array.isArray(template?.GraphicsLink) ? template.GraphicsLink : [];
  const checks = qualityDoc?.checks && typeof qualityDoc.checks === "object"
    ? qualityDoc.checks
    : {};
  const counts = {
    graphics: links.length,
    ok: 0,
    issues: 0,
    unselected: 0,
  };

  links.forEach((link, index) => {
    const stableKey = getGraphicsStableKey(link, index);
    const flag = normalizeQualityFlag(checks[stableKey]?.flag);
    if (flag === "ok") counts.ok += 1;
    else if (flag === "issue") counts.issues += 1;
    else counts.unselected += 1;
  });

  return counts;
}

function SubtypeStatusBadge({ checked }) {
  return checked ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      Checked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
      Unchecked
    </span>
  );
}

function PaginationBar({ page, total, onPage }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
      <button onClick={() => onPage(p => Math.max(1, p - 1))} disabled={page === 1}
        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
        ← Prev
      </button>
      <span className="text-xs text-gray-500 px-2">Page {page} / {total}</span>
      <button onClick={() => onPage(p => Math.min(total, p + 1))} disabled={page === total}
        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
        Next →
      </button>
    </div>
  );
}

function QualityAnalyticsTable({
  rows,
  page,
  totalPages,
  onPage,
  pageSize,
  emptyMessage,
  subtypeLevel = false,
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
              {["Sn", "Company", "Type", "Select Type", "Subtype", "Subtype Check", subtypeLevel ? "Templates" : "Serial", "Graphics Links", "OK", "Issue", "Not Selected"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {rows.length === 0 ? (
              <tr><td colSpan={11} className="py-16 text-center text-sm text-gray-400">{emptyMessage}</td></tr>
            ) : rows.map((row, i) => (
              <tr key={row.id || row.QualityKey} className={`hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors ${row.Issues > 0 ? "bg-red-50/20 dark:bg-red-500/5" : ""}`}>
                <td className="px-4 py-3 text-[11px] text-gray-400">{(page - 1) * pageSize + i + 1}</td>
                <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.Company}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    row.MainType === "MLM"
                      ? "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-500/10 dark:text-violet-400"
                      : "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400"
                  }`}>{row.MainType}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{row.SelectType}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{row.Subtype}</td>
                <td className="px-4 py-3"><SubtypeStatusBadge checked={row.SubtypeChecked} /></td>
                <td className="px-4 py-3">
                  {subtypeLevel
                    ? <Pill value={row.Total} color="gray" />
                    : <span className="text-xs font-mono text-violet-600 dark:text-violet-400">#{row.Serial}</span>}
                </td>
                <td className="px-4 py-3"><Pill value={row.Graphics} color="violet" /></td>
                <td className="px-4 py-3"><Pill value={row.OK} color="emerald" /></td>
                <td className="px-4 py-3">
                  {row.Issues > 0
                    ? <Pill value={row.Issues} color="red" />
                    : <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3"><Pill value={row.Unselected} color="gray" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} total={totalPages} onPage={onPage} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  EXCEL GENERATION  — matches the sample file format exactly
// ══════════════════════════════════════════════════════════════════════════

/**
 * Cell styles
 */
const STYLE = {
  title: { font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "7C3AED" } }, alignment: { horizontal: "center", vertical: "center" } },
  header1: { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4C1D95" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
  header2: { font: { bold: true, sz: 9, color: { rgb: "1F2937" } }, fill: { fgColor: { rgb: "DDD6FE" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } },
  data:     { font: { sz: 9 }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } } },
  dataLeft: { font: { sz: 9, bold: true }, alignment: { horizontal: "left", vertical: "center" }, border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } }, left: { style: "thin", color: { rgb: "E5E7EB" } }, right: { style: "thin", color: { rgb: "E5E7EB" } } } },
  issueCell:{ font: { sz: 9, color: { rgb: "DC2626" } }, fill: { fgColor: { rgb: "FEF2F2" } }, alignment: { horizontal: "left", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: "FCA5A5" } }, bottom: { style: "thin", color: { rgb: "FCA5A5" } }, left: { style: "thin", color: { rgb: "FCA5A5" } }, right: { style: "thin", color: { rgb: "FCA5A5" } } } },
  workCell: { font: { sz: 9, color: { rgb: "D97706" } }, fill: { fgColor: { rgb: "FFFBEB" } }, alignment: { horizontal: "left", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: "FCD34D" } }, bottom: { style: "thin", color: { rgb: "FCD34D" } }, left: { style: "thin", color: { rgb: "FCD34D" } }, right: { style: "thin", color: { rgb: "FCD34D" } } } },
};

function cell(v, s) {
  return { v, t: typeof v === "number" ? "n" : "s", s };
}

/**
 * Build one worksheet for a group of templates (one company or "General")
 * Groups rows by SelectType → Subtype
 */
function buildSheet(sheetTitle, templates, qualityMap, subtypeReviewMap) {
  // Group: { [selectType]: { [subtype]: template[] } }
  const groups = {};
  templates.forEach(t => {
    const st  = (t.SelectType || "Other").replace(/_/g, " ");
    const sub = t.Subtype || "—";
    if (!groups[st])     groups[st] = {};
    if (!groups[st][sub]) groups[st][sub] = [];
    groups[st][sub].push(t);
  });

  const ws = {};
  const merges = [];
  let r = 0; // current row (0-indexed)

  // ── Row 0: Title ──────────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(sheetTitle, STYLE.title);
  merges.push({ s: { r, c: 0 }, e: { r, c: 9 } });
  r++;

  // ── Row 1: empty ─────────────────────────────────────────────────────
  r++;

  // ── Row 2: column group headers ───────────────────────────────────────
  // MAIN TYPE | SUB TYPE | SUBTYPE CHECK | QUANTITY(merged 2) | SHOWCASE(merged 2) | DESIGN STATUS | APP PROBLEM | TEMPLATE PROBLEM
  const h2 = ["MAIN TYPE", "SUB TYPE", "SUBTYPE CHECK", "QUANTITY", "", "SHOWCASE", "", "DESIGN STATUS", "APP PROBLEM", "TEMPLATE PROBLEM"];
  h2.forEach((v, c) => { if (v) ws[XLSX.utils.encode_cell({ r, c })] = cell(v, STYLE.header1); });
  merges.push({ s: { r, c: 3 }, e: { r, c: 4 } }); // QUANTITY spans cols 3-4
  merges.push({ s: { r, c: 5 }, e: { r, c: 6 } }); // SHOWCASE spans cols 5-6
  r++;

  // ── Row 3: sub-headers ────────────────────────────────────────────────
  const h3 = ["", "", "", "DATA", "UPLOAD", "MAIN", "FORM", "", "", ""];
  h3.forEach((v, c) => { ws[XLSX.utils.encode_cell({ r, c })] = cell(v || "", STYLE.header2); });
  // Merge standalone header cells vertically (rows 2-3)
  merges.push({ s: { r: r - 1, c: 0 }, e: { r, c: 0 } }); // MAIN TYPE
  merges.push({ s: { r: r - 1, c: 1 }, e: { r, c: 1 } }); // SUB TYPE
  merges.push({ s: { r: r - 1, c: 2 }, e: { r, c: 2 } }); // SUBTYPE CHECK
  merges.push({ s: { r: r - 1, c: 7 }, e: { r, c: 7 } }); // DESIGN STATUS
  merges.push({ s: { r: r - 1, c: 8 }, e: { r, c: 8 } }); // APP PROBLEM
  merges.push({ s: { r: r - 1, c: 9 }, e: { r, c: 9 } }); // TEMPLATE PROBLEM
  r++;

  // ── Data rows ─────────────────────────────────────────────────────────
  const selectTypes = Object.keys(groups).sort();
  selectTypes.forEach(st => {
    const subtypes = Object.keys(groups[st]).sort();
    let firstST = true;
    subtypes.forEach(sub => {
      const items = groups[st][sub];
      const subtypeChecked = Boolean(subtypeReviewMap[getSubtypeQualityKey(items[0])]);

      // Counts
      const dataQty   = items.length;
      const uploadQty = items.filter(t => t.Active || t.Launched).length;

      // Showcase
      const hasMain = items.some(t => t.Showcase_url?.trim());
      const hasForm = items.some(t => t.ShowCaseForm?.trim());

      // Design status
      const allActive   = items.every(t => t.Active);
      const anyLaunched = items.some(t => t.Launched);
      const designStatus = allActive ? "UPLOAD" : anyLaunched ? "UPLOADED" : "PENDING";

      // Quality notes — collect from qualityMap
      const appProblems = [];
      const tplProblems = [];
      items.forEach(t => {
        const q = qualityMap[t.id];
        if (!q) return;
        Object.values(q.checks || {}).forEach(ch => {
          if (ch.flag === "working" && ch.note?.trim()) appProblems.push(ch.note.trim());
          if (normalizeQualityFlag(ch.flag) === "issue" && ch.flag !== "working" && ch.note?.trim()) {
            tplProblems.push(ch.note.trim());
          }
        });
      });
      const appText = [...new Set(appProblems)].join("\n") || "COMPLETE";
      const tplText = [...new Set(tplProblems)].join("\n") || "ALL DESIGN PERFECT";

      const hasTplIssue = tplProblems.length > 0;
      const hasAppWork  = appProblems.length > 0;

      ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(firstST ? st : "", STYLE.dataLeft);
      ws[XLSX.utils.encode_cell({ r, c: 1 })] = cell(sub === "—" ? "" : sub, STYLE.dataLeft);
      ws[XLSX.utils.encode_cell({ r, c: 2 })] = cell(subtypeChecked ? "CHECKED" : "UNCHECKED", subtypeChecked ? STYLE.data : STYLE.workCell);
      ws[XLSX.utils.encode_cell({ r, c: 3 })] = cell(dataQty,   STYLE.data);
      ws[XLSX.utils.encode_cell({ r, c: 4 })] = cell(uploadQty || "", STYLE.data);
      ws[XLSX.utils.encode_cell({ r, c: 5 })] = cell(hasMain ? "✔️" : "", STYLE.data);
      ws[XLSX.utils.encode_cell({ r, c: 6 })] = cell(hasForm ? "✔️" : "", STYLE.data);
      ws[XLSX.utils.encode_cell({ r, c: 7 })] = cell(designStatus, STYLE.data);
      ws[XLSX.utils.encode_cell({ r, c: 8 })] = cell(appText,  hasAppWork  ? STYLE.workCell : STYLE.data);
      ws[XLSX.utils.encode_cell({ r, c: 9 })] = cell(tplText, hasTplIssue ? STYLE.issueCell : STYLE.data);

      firstST = false;
      r++;
    });
  });

  if (r === 4) {
    // No data rows
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell("No data", STYLE.data);
    for (let c = 1; c < 10; c++) ws[XLSX.utils.encode_cell({ r, c })] = cell("", STYLE.data);
    merges.push({ s: { r, c: 0 }, e: { r, c: 9 } });
    r++;
  }

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 9 } });
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 22 }, // MAIN TYPE
    { wch: 28 }, // SUB TYPE
    { wch: 16 }, // SUBTYPE CHECK
    { wch: 8  }, // DATA
    { wch: 8  }, // UPLOAD
    { wch: 8  }, // MAIN
    { wch: 8  }, // FORM
    { wch: 14 }, // DESIGN STATUS
    { wch: 30 }, // APP PROBLEM
    { wch: 36 }, // TEMPLATE PROBLEM
  ];
  ws["!rows"] = [
    { hpt: 24 }, // title
    { hpt: 6  }, // spacer
    { hpt: 18 }, // header row 1
    { hpt: 16 }, // header row 2
  ];

  return ws;
}

/**
 * Generate and download the full multi-sheet workbook
 */
function generateWorkbook(allTemplates, companies, qualityDocs, filterCompany, subtypeReviewMap) {
  const qualityMap = {};
  qualityDocs.forEach(q => {
    if (!isSubtypeQualityDoc(q)) qualityMap[q.id] = q;
  });

  const companiesMap = {};
  companies.forEach(c => { companiesMap[c.id] = c.name; });

  const wb = XLSX.utils.book_new();

  // Filter if needed
  let templates = allTemplates;
  if (filterCompany) templates = templates.filter(t => t.Company === filterCompany);

  // ── GENERAL sheet ──────────────────────────────────────────────────────
  const generalTemplates = templates.filter(t => t.MainType !== "MLM");
  if (generalTemplates.length > 0) {
    const ws = buildSheet("GENERAL TEMPLATE", generalTemplates, qualityMap, subtypeReviewMap);
    XLSX.utils.book_append_sheet(wb, ws, "GENERAL");
  }

  // ── One sheet per MLM company ──────────────────────────────────────────
  const mlmTemplates = templates.filter(t => t.MainType === "MLM");

  // Group by company
  const byCompany = {};
  mlmTemplates.forEach(t => {
    const cid = t.Company || "UNKNOWN";
    if (!byCompany[cid]) byCompany[cid] = [];
    byCompany[cid].push(t);
  });

  // Sort companies by name
  const sortedCompanyIds = Object.keys(byCompany).sort((a, b) => {
    const na = companiesMap[a] || a;
    const nb = companiesMap[b] || b;
    return na.localeCompare(nb);
  });

  sortedCompanyIds.forEach(cid => {
    const compName  = (companiesMap[cid] || cid).toUpperCase();
    const sheetName = compName.slice(0, 31).replace(/[:\\/?*[\]]/g, "_");
    const ws = buildSheet(`MLM   ${compName}`, byCompany[cid], qualityMap, subtypeReviewMap);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // ── Write ──────────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(wb, `TEMPLATE_WORK_DATA_${date}.xlsx`);
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function TemplateData() {
  const [activeTab, setActiveTab] = useState("template");

  const [allTemplates, setAllTemplates] = useState([]);
  const [qualityDocs,  setQualityDocs]  = useState([]);
  const [companies,    setCompanies]    = useState([]);
  const [loading,      setLoading]      = useState(false);

  const [filterCompany, setFilterCompany] = useState("");
  const [filterType,    setFilterType]    = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tSnap, qSnap, cSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.MLMTEMPLATE)),
        getDocs(collection(db, COLLECTIONS.TEMPLATEQUALITY)),
        getDocs(collection(db, COLLECTIONS.MLMCOMP)),
      ]);
      setAllTemplates(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setQualityDocs(qSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCompanies(cSnap.docs.map(d => ({ id: d.id, name: d.data().name || d.id })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const companiesMap = useMemo(() => {
    const m = {};
    companies.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [companies]);

  const qualityDocMap = useMemo(() => {
    const m = {};
    qualityDocs.forEach(q => {
      if (!isSubtypeQualityDoc(q)) m[q.id] = q;
    });
    return m;
  }, [qualityDocs]);

  /**
   * One status per MainType + Company + SelectType + Subtype.
   * Explicit subtype records win. For old data, an existing selected flag
   * infers Checked until an admin explicitly saves Checked/Unchecked.
   */
  const subtypeReviewMap = useMemo(() => {
    const explicit = {};
    qualityDocs.forEach(q => {
      if (!isSubtypeQualityDoc(q)) return;
      const key = q.subtypeKey || getSubtypeQualityKey({
        MainType: q.mainType,
        Company: q.companyId,
        SelectType: q.selectType,
        Subtype: q.subtype,
      });
      if (typeof q.checked === "boolean") explicit[key] = q.checked;
    });

    const inferred = {};
    allTemplates.forEach(template => {
      const key = getSubtypeQualityKey(template);
      if (Object.prototype.hasOwnProperty.call(explicit, key)) return;
      if (hasSelectedCurrentFlag(template, qualityDocMap[template.id])) inferred[key] = true;
    });

    return { ...inferred, ...explicit };
  }, [allTemplates, qualityDocs, qualityDocMap]);

  const qualityStatusMap = useMemo(() => {
    const m = {};
    allTemplates.forEach(template => {
      m[template.id] = getTemplateQualityCounts(template, qualityDocMap[template.id]);
    });
    return m;
  }, [allTemplates, qualityDocMap]);

  const filteredTemplates = useMemo(() => {
    let list = allTemplates;
    if (filterType)    list = list.filter(t => t.MainType === filterType);
    if (filterCompany) list = list.filter(t => t.Company  === filterCompany);
    return list;
  }, [allTemplates, filterType, filterCompany]);

  // ── Summary table: group by SelectType → Subtype ──────────────────────
  const templateReport = useMemo(() => {
    const grouped = {};
    filteredTemplates.forEach(t => {
      const mainType = t.MainType  || "Unknown";
      const selType  = (t.SelectType || "Unknown").replace(/_/g, " ");
      const subtype  = t.Subtype   || "—";
      const company  = companiesMap[t.Company] || t.Company || "—";
      const qualityKey = getSubtypeQualityKey(t);
      const key = qualityKey;
      if (!grouped[key]) grouped[key] = {
        MainType: mainType, Company: mainType === "MLM" ? company : "—",
        SelectType: selType, Subtype: subtype, QualityKey: qualityKey,
        SubtypeChecked: Boolean(subtypeReviewMap[qualityKey]),
        Total: 0, Active: 0, Launched: 0, Graphics: 0,
        OK: 0, Issues: 0, Unselected: 0,
      };
      const quality = qualityStatusMap[t.id] || getTemplateQualityCounts(t);
      grouped[key].Total++;
      if (t.Active)    grouped[key].Active++;
      if (t.Launched)  grouped[key].Launched++;
      grouped[key].Graphics += quality.graphics;
      grouped[key].OK       += quality.ok;
      grouped[key].Issues   += quality.issues;
      grouped[key].Unselected += quality.unselected;
    });
    return Object.values(grouped).sort((a, b) =>
      a.MainType.localeCompare(b.MainType) ||
      a.Company.localeCompare(b.Company)   ||
      a.SelectType.localeCompare(b.SelectType) ||
      a.Subtype.localeCompare(b.Subtype)
    );
  }, [filteredTemplates, qualityStatusMap, companiesMap, subtypeReviewMap]);

  // ── Per-template quality analytics ────────────────────────────────────
  const templateQualityRows = useMemo(() => {
    return filteredTemplates
      .map(t => {
        const q = qualityStatusMap[t.id] || {};
        return {
          id: t.id,
          Company:    companiesMap[t.Company] || t.Company || "—",
          MainType:   t.MainType   || "—",
          SelectType: (t.SelectType || "—").replace(/_/g, " "),
          Subtype:    t.Subtype    || "—",
          QualityKey: getSubtypeQualityKey(t),
          SubtypeChecked: Boolean(subtypeReviewMap[getSubtypeQualityKey(t)]),
          Serial:     t.serial     ?? "—",
          Graphics:   q.graphics || 0,
          OK:          q.ok || 0,
          Issues:      q.issues || 0,
          Unselected:  q.unselected || 0,
        };
      })
      .sort((a, b) => a.Company.localeCompare(b.Company) || String(a.Serial).localeCompare(String(b.Serial)));
  }, [filteredTemplates, qualityStatusMap, companiesMap, subtypeReviewMap]);

  const checkedSubtypeReport = useMemo(
    () => templateReport
      .filter(row => row.SubtypeChecked)
      .sort((a, b) => (b.Issues - a.Issues) || a.Company.localeCompare(b.Company)),
    [templateReport],
  );

  const uncheckedSubtypeReport = useMemo(
    () => templateReport
      .filter(row => !row.SubtypeChecked)
      .sort((a, b) => (b.Unselected - a.Unselected) || a.Company.localeCompare(b.Company)),
    [templateReport],
  );

  const issueTemplateReport = useMemo(
    () => templateQualityRows
      .filter(row => row.Issues > 0)
      .sort((a, b) => (b.Issues - a.Issues) || a.Company.localeCompare(b.Company)),
    [templateQualityRows],
  );

  // ── Summary stats ─────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totals = {
      total: filteredTemplates.length,
      mlm: 0,
      general: 0,
      active: 0,
      launched: 0,
      graphics: 0,
      checkedSubtypes: checkedSubtypeReport.length,
      uncheckedSubtypes: uncheckedSubtypeReport.length,
      issueTemplates: 0,
      ok: 0,
      issues: 0,
      unselected: 0,
    };

    filteredTemplates.forEach(template => {
      const quality = qualityStatusMap[template.id] || getTemplateQualityCounts(template);
      if (template.MainType === "MLM") totals.mlm += 1;
      else totals.general += 1;
      if (template.Active) totals.active += 1;
      if (template.Launched) totals.launched += 1;
      if (quality.issues > 0) totals.issueTemplates += 1;
      totals.graphics += quality.graphics;
      totals.ok += quality.ok;
      totals.issues += quality.issues;
      totals.unselected += quality.unselected;
    });

    return totals;
  }, [filteredTemplates, qualityStatusMap, checkedSubtypeReport, uncheckedSubtypeReport]);

  // ── Download handlers ─────────────────────────────────────────────────
  const downloadWorkbook = useCallback(() => {
    generateWorkbook(
      filterType ? allTemplates.filter(t => t.MainType === filterType) : allTemplates,
      companies,
      qualityDocs,
      filterCompany,
      subtypeReviewMap,
    );
  }, [allTemplates, companies, qualityDocs, filterCompany, filterType, subtypeReviewMap]);

  // ── Pagination ────────────────────────────────────────────────────────
  const PAGE = 50;
  const [tPage, setTPage] = useState(1);
  const [cPage, setCPage] = useState(1);
  const [uPage, setUPage] = useState(1);
  const [iPage, setIPage] = useState(1);
  const tPages = Math.max(1, Math.ceil(templateReport.length / PAGE));
  const cPages = Math.max(1, Math.ceil(checkedSubtypeReport.length / PAGE));
  const uPages = Math.max(1, Math.ceil(uncheckedSubtypeReport.length / PAGE));
  const iPages = Math.max(1, Math.ceil(issueTemplateReport.length / PAGE));
  const paginatedT = useMemo(() => templateReport.slice((tPage - 1) * PAGE, tPage * PAGE), [templateReport, tPage]);
  const paginatedC = useMemo(() => checkedSubtypeReport.slice((cPage - 1) * PAGE, cPage * PAGE), [checkedSubtypeReport, cPage]);
  const paginatedU = useMemo(() => uncheckedSubtypeReport.slice((uPage - 1) * PAGE, uPage * PAGE), [uncheckedSubtypeReport, uPage]);
  const paginatedI = useMemo(() => issueTemplateReport.slice((iPage - 1) * PAGE, iPage * PAGE), [issueTemplateReport, iPage]);

  useEffect(() => {
    if (tPage > tPages) setTPage(tPages);
  }, [tPage, tPages]);
  useEffect(() => {
    if (cPage > cPages) setCPage(cPages);
  }, [cPage, cPages]);
  useEffect(() => {
    if (uPage > uPages) setUPage(uPages);
  }, [uPage, uPages]);
  useEffect(() => {
    if (iPage > iPages) setIPage(iPages);
  }, [iPage, iPages]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
            Template Data Report
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Download produces one sheet per MLM company + one GENERAL sheet
          </p>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-60">
          <span className={loading ? "animate-spin" : ""}><IconRefresh /></span>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Templates", value: summary.total,    color: "gray"    },
              { label: "MLM",             value: summary.mlm,      color: "violet"  },
              { label: "General",         value: summary.general,  color: "sky"     },
              { label: "Active",          value: summary.active,   color: "emerald" },
              { label: "Launched",        value: summary.launched, color: "violet"  },
              { label: "Graphics Links",  value: summary.graphics, color: "gray"    },
            ].map(({ label, value, color }) => {
              const styles = {
                gray:    "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
                violet:  "bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20 text-violet-700 dark:text-violet-400",
                sky:     "bg-sky-50 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20 text-sky-700 dark:text-sky-400",
                emerald: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
              };
              return (
                <div key={label} className={`flex flex-col items-center justify-center px-4 py-4 rounded-2xl border ${styles[color]}`}>
                  <span className="text-2xl font-bold">{value}</span>
                  <span className="text-xs font-medium mt-0.5 opacity-80">{label}</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            {[
              { label: "Checked Subtypes",  value: summary.checkedSubtypes,  color: "blue"    },
              { label: "Unchecked Subtypes", value: summary.uncheckedSubtypes, color: "orange" },
              { label: "Issue Templates",   value: summary.issueTemplates,   color: summary.issueTemplates > 0 ? "red" : "gray" },
              { label: "OK",                value: summary.ok,               color: "emerald" },
              { label: "Issue",             value: summary.issues,           color: summary.issues > 0 ? "red" : "gray" },
              { label: "Not Selected",      value: summary.unselected,       color: "gray"    },
            ].map(({ label, value, color }) => {
              const styles = {
                gray:    "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
                violet:  "bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20 text-violet-700 dark:text-violet-400",
                emerald: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
                blue:    "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-400",
                red:     "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400",
                amber:   "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400",
                orange:  "bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20 text-orange-700 dark:text-orange-400",
              };
              return (
                <div key={label} className={`flex flex-col items-center justify-center px-4 py-4 rounded-2xl border ${styles[color]}`}>
                  <span className="text-2xl font-bold">{value}</span>
                  <span className="text-xs font-medium mt-0.5 opacity-80">{label}</span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Graphics Links use only OK or Issue. Links without a selected flag stay Not Selected. Checked/Unchecked is tracked once for the complete subtype.
          </p>
        </div>
      )}

      {/* Filters + Download */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setTPage(1); setCPage(1); setUPage(1); setIPage(1); }}
          className="pl-4 pr-9 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 appearance-none cursor-pointer">
          <option value="">All Types</option>
          <option value="MLM">MLM Only</option>
          <option value="General">General Only</option>
        </select>

        <select value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setTPage(1); setCPage(1); setUPage(1); setIPage(1); }}
          className="pl-4 pr-9 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 appearance-none cursor-pointer">
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {(filterType || filterCompany) && (
          <button onClick={() => { setFilterType(""); setFilterCompany(""); setTPage(1); setCPage(1); setUPage(1); setIPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            Clear ×
          </button>
        )}

        {/* Big download button */}
        <button onClick={downloadWorkbook} disabled={loading || allTemplates.length === 0}
          className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-sm shadow-emerald-500/20">
          <IconDownload />
          Download Excel Report
        </button>
      </div>

      {/* Download format hint */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400">Excel format:</span>
        {[
          filterCompany
            ? [{ label: companiesMap[filterCompany] || filterCompany, color: "violet" }]
            : [
                ...(filterType !== "General" ? [{ label: "One sheet / MLM company", color: "violet" }] : []),
                ...(filterType !== "MLM"     ? [{ label: "GENERAL sheet",            color: "sky"    }] : []),
              ]
        ].flat().map((b, i) => (
          <span key={i} className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
            b.color === "violet"
              ? "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20"
              : "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20"
          }`}>{b.label}</span>
        ))}
        <span className="text-xs text-gray-400">· Columns: MAIN TYPE · SUB TYPE · SUBTYPE CHECK · QUANTITY (DATA/UPLOAD) · SHOWCASE (MAIN/FORM) · DESIGN STATUS · APP PROBLEM · TEMPLATE PROBLEM</span>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Sub-tabs */}
          <div className="flex flex-wrap items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit max-w-full">
            {[
              { id: "template", label: `Template Breakdown (${templateReport.length})` },
              { id: "checked",  label: `Checked Subtypes (${checkedSubtypeReport.length})` },
              { id: "unchecked", label: `Unchecked Subtypes (${uncheckedSubtypeReport.length})` },
              { id: "issues",   label: `Issue Templates (${issueTemplateReport.length})` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-violet-600 text-white shadow-sm shadow-violet-500/20"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Template Breakdown ── */}
          {activeTab === "template" && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                      {["Sn", "Type", "Company", "Select Type", "Subtype", "Subtype Check", "Templates", "Graphics Links", "OK", "Issue", "Not Selected"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {paginatedT.length === 0 ? (
                      <tr><td colSpan={11} className="py-16 text-center text-sm text-gray-400">No data found. Adjust filters or refresh.</td></tr>
                    ) : paginatedT.map((row, i) => (
                      <tr key={`${row.MainType}-${row.Company}-${row.SelectType}-${row.Subtype}`}
                        className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-[11px] text-gray-400">{(tPage - 1) * PAGE + i + 1}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            row.MainType === "MLM"
                              ? "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-500/10 dark:text-violet-400"
                              : "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400"
                          }`}>{row.MainType}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{row.Company}</td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300">{row.SelectType}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{row.Subtype}</td>
                        <td className="px-4 py-3"><SubtypeStatusBadge checked={row.SubtypeChecked} /></td>
                        <td className="px-4 py-3"><Pill value={row.Total}    color="gray"   /></td>
                        <td className="px-4 py-3"><Pill value={row.Graphics} color="violet" /></td>
                        <td className="px-4 py-3"><Pill value={row.OK} color="emerald" /></td>
                        <td className="px-4 py-3">
                          {row.Issues > 0
                            ? <Pill value={row.Issues} color="red" />
                            : <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3"><Pill value={row.Unselected} color="gray" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={tPage} total={tPages} onPage={setTPage} />
            </div>
          )}

          {/* ── Checked Subtypes ── */}
          {activeTab === "checked" && (
            <QualityAnalyticsTable
              rows={paginatedC}
              page={cPage}
              totalPages={cPages}
              onPage={setCPage}
              pageSize={PAGE}
              emptyMessage="No checked subtypes found."
              subtypeLevel
            />
          )}

          {/* ── Unchecked Subtypes ── */}
          {activeTab === "unchecked" && (
            <QualityAnalyticsTable
              rows={paginatedU}
              page={uPage}
              totalPages={uPages}
              onPage={setUPage}
              pageSize={PAGE}
              emptyMessage="No unchecked subtypes found."
              subtypeLevel
            />
          )}

          {/* ── Issue Templates ── */}
          {activeTab === "issues" && (
            <QualityAnalyticsTable
              rows={paginatedI}
              page={iPage}
              totalPages={iPages}
              onPage={setIPage}
              pageSize={PAGE}
              emptyMessage="No issue templates found."
            />
          )}
        </>
      )}
    </div>
  );
}

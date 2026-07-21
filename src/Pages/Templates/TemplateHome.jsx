import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../Firebase";
import {
  CirclePlus,
  ArrowRotateRight,
  TriangleThunderbolt,
  Folder,
  Magnifier,
  ChevronDown,
} from "@gravity-ui/icons";
import { MLM_SELECT_TYPES, GENERAL_SELECT_TYPES } from "./Constant";
import { COLLECTIONS } from "../../collections";
import TemplateTable from "./TemplateTable";
import TemplateDetailPopup from "./TemplateDetailPopup";
import QualityCheck from "./QualityCheck";
import { getAdminSession } from "../../Utils/adminSession";
import IssueFollowup from "./IssueFollowup";

// ── Permission helper ─────────────────────────────────────────────────────
function getAdminUser() {
  return getAdminSession() || {};
}
function hasPermission(admin, ...perms) {
  if (!admin || !admin.role) return false;
  if (admin.role === "Master Admin") return true;
  const tabs = Array.isArray(admin.assigntab) ? admin.assigntab : [];
  if (tabs.includes("templates")) return true; // full access
  return perms.some(p => tabs.includes(p));
}

function IconDownload() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function CountCard({ label, count, color }) {
  const styles = {
    violet: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-500/20",
    sky:    "bg-sky-50    dark:bg-sky-500/10    text-sky-700    dark:text-sky-400    border-sky-100    dark:border-sky-500/20",
    gray:   "bg-gray-50   dark:bg-gray-800/60   text-gray-700   dark:text-gray-300   border-gray-200   dark:border-gray-700",
    red:    "bg-red-50    dark:bg-red-500/10    text-red-700    dark:text-red-400    border-red-200    dark:border-red-500/20",
  };
  return (
    <div className={`flex flex-col items-center justify-center px-5 py-4 rounded-2xl border ${styles[color]} flex-shrink-0`}>
      <span className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>{count}</span>
      <span className="text-xs font-medium mt-0.5 opacity-80">{label}</span>
    </div>
  );
}

export default function TemplateHome() {
  const navigate = useNavigate();
  const admin    = getAdminUser();

  const canOperation   = hasPermission(admin, "templates_operation");
  const canQuality     = hasPermission(admin, "templates_quality");

  // ── Template data ────────────────────────────────────────────────────────
  const [allTemplates, setAllTemplates] = useState([]);
  const [fetched,      setFetched]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  // ── Quality / issues data ────────────────────────────────────────────────
  const [qualityDocs,    setQualityDocs]    = useState([]);
  const [qualityLoading, setQualityLoading] = useState(false);

  // ── Active tab (MLM / General) — controls filters ────────────────────────
  const [activeTab, setActiveTab] = useState("MLM");

  // ── Filters: separate per tab ────────────────────────────────────────────
  const [mlmFilterSelectType,     setMlmFilterSelectType]     = useState("");
  const [mlmFilterCompany,        setMlmFilterCompany]        = useState("");
  const [generalFilterSelectType, setGeneralFilterSelectType] = useState("");
  const [search,                  setSearch]                  = useState("");

  // Current tab's filter values
  const filterSelectType = activeTab === "MLM" ? mlmFilterSelectType     : generalFilterSelectType;
  const filterCompany    = activeTab === "MLM" ? mlmFilterCompany        : "";
  const setFilterSelectType = activeTab === "MLM" ? setMlmFilterSelectType : setGeneralFilterSelectType;
  const setFilterCompany    = setMlmFilterCompany;

  // ── Companies ─────────────────────────────────────────────────────────────
  const [companies,        setCompanies]        = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // ── Popup state ───────────────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [qualityTemplate,  setQualityTemplate]  = useState(null);

  // ── Fetch companies ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setCompaniesLoading(true);
    getDocs(collection(db, COLLECTIONS.MLMCOMP))
      .then((snap) => {
        if (!cancelled)
          setCompanies(snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setCompaniesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── companiesMap for child components ─────────────────────────────────────
  const companiesMap = useMemo(() => {
    const m = {};
    companies.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [companies]);

  // ── Fetch quality docs ────────────────────────────────────────────────────
  const fetchQuality = useCallback(async () => {
    setQualityLoading(true);
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.TEMPLATEQUALITY));
      setQualityDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Quality fetch error:", err);
    } finally {
      setQualityLoading(false);
    }
  }, []);

  // ── Fetch templates ───────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.MLMTEMPLATE));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllTemplates(data);
      setFetched(true);
    } catch (err) {
      console.error(err);
      setError("Failed to load templates. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { if (fetched) fetchQuality(); }, [fetched, fetchQuality]);

  const handleQualityClose = useCallback(() => {
    setQualityTemplate(null);
    fetchQuality();
  }, [fetchQuality]);

  // ── Issue count map: templateId → issue count ─────────────────────────────
  const issueCountMap = useMemo(() => {
    const m = {};
    qualityDocs.forEach(qDoc => {
      const checks = qDoc.checks || {};
      const count  = Object.values(checks).filter(v => v.flag === "issue").length;
      if (count > 0) m[qDoc.id] = count;
    });
    return m;
  }, [qualityDocs]);

  // ── Build issue follow-up list ────────────────────────────────────────────
  const issueItems = useMemo(() => {
    if (!allTemplates.length || !qualityDocs.length) return [];
    const templateMap = {};
    allTemplates.forEach((t) => { templateMap[t.id] = t; });
    const items = [];
    qualityDocs.forEach((qDoc) => {
      const template = templateMap[qDoc.id];
      if (!template) return;
      const checks = qDoc.checks || {};
      const issueEntries = Object.entries(checks).filter(([, v]) => v.flag === "issue");
      if (issueEntries.length === 0) return;
      items.push({
        template,
        issueCount: issueEntries.length,
        issueNotes: issueEntries.map(([, v]) => v.note || "").filter(Boolean),
      });
    });
    return items.sort((a, b) => b.issueCount - a.issueCount || (a.template.serial ?? 0) - (b.template.serial ?? 0));
  }, [allTemplates, qualityDocs]);

  const totalIssueCount = useMemo(() => issueItems.reduce((s, i) => s + i.issueCount, 0), [issueItems]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    total:   allTemplates.length,
    mlm:     allTemplates.filter((t) => t.MainType === "MLM").length,
    general: allTemplates.filter((t) => t.MainType === "General").length,
    issues:  totalIssueCount,
  }), [allTemplates, totalIssueCount]);

  // ── SelectType options based on active tab ────────────────────────────────
  const selectTypeOptions = useMemo(() =>
    activeTab === "MLM" ? MLM_SELECT_TYPES : GENERAL_SELECT_TYPES,
  [activeTab]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allTemplates;
    if (filterSelectType) list = list.filter((t) => t.SelectType === filterSelectType);
    if (filterCompany)    list = list.filter((t) => t.Company    === filterCompany);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.SelectType || "").toLowerCase().includes(q) ||
          (t.MainType   || "").toLowerCase().includes(q) ||
          (t.Subtype    || "").toLowerCase().includes(q) ||
          String(t.serial || "").includes(q)
      );
    }
    return list;
  }, [allTemplates, filterSelectType, filterCompany, search]);

  const isFiltered = !!(filterSelectType || filterCompany || search.trim());

  // Templates actually shown in the table for the active tab (matches TemplateTable's split)
  const shownTemplates = useMemo(
    () => filtered.filter((t) => t.MainType === activeTab),
    [filtered, activeTab]
  );

  // ── Export filtered templates (full Firestore doc data + id) as JSON ─────
  const handleExportJSON = useCallback(() => {
    if (shownTemplates.length === 0) return;
    const dataStr = JSON.stringify(shownTemplates, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    const tag  = activeTab === "MLM" ? "mlm" : "general";
    a.href = url;
    a.download = `templates_${tag}_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [shownTemplates, activeTab]);

  const handleSearch           = useCallback((e)   => setSearch(e.target.value), []);
  const handleFilterSelectType = useCallback((val) => { setFilterSelectType(val); }, [setFilterSelectType]);
  const handleFilterCompany    = useCallback((val) => setFilterCompany(val), []);

  // Clear tab-specific filters when switching tabs
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSearch("");
  }, []);

  const handleSelect = useCallback((tpl) => setSelectedTemplate(tpl), []);

  const handleEdit = useCallback(() => {
    if (selectedTemplate) navigate(`/templates/edit/${selectedTemplate.id}`);
  }, [selectedTemplate, navigate]);

  const handleOpenQuality = useCallback(() => {
    setQualityTemplate(selectedTemplate);
    setSelectedTemplate(null);
  }, [selectedTemplate]);

  // ── Fix Issue → navigate to EditTemplate with from=issues flag ────────────
  const handleFixIssue = useCallback((template) => {
    navigate(`/templates/edit/${template.id}?from=issues`);
  }, [navigate]);

  const handleRefresh = useCallback(async () => {
    await fetchTemplates();
    await fetchQuality();
  }, [fetchTemplates, fetchQuality]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
              Templates
            </h1>
            {totalIssueCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                {totalIssueCount} issue{totalIssueCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">Manage MLM & General templates</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ArrowRotateRight className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </button>

          {fetched && (
            <button
              onClick={handleExportJSON}
              disabled={shownTemplates.length === 0}
              title={`Export the ${shownTemplates.length} currently filtered ${activeTab === "MLM" ? "MLM" : "General"} template(s) as JSON`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconDownload />
              Export JSON ({shownTemplates.length})
            </button>
          )}

          {canOperation && (
            <>
              <button
                onClick={() => navigate("/templates/copy-rank-promotion")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-violet-200 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-sm font-semibold hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy to Company
              </button>
              <button
                onClick={() => navigate("/templates/add")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20"
              >
                <CirclePlus className="w-4 h-4" />
                Add Template
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={handleRefresh} className="ml-auto text-xs font-semibold underline underline-offset-2">Retry</button>
        </div>
      )}

      {!loading && !fetched && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mb-4">
            <Folder className="w-8 h-8 text-violet-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">No data loaded yet</h3>
          <p className="text-sm text-gray-400 max-w-xs">
            Click <span className="font-semibold text-violet-500">Refresh</span> to load templates from Firestore.
          </p>
        </div>
      )}

      {fetched && (
        <>
          {/* Issue follow-up panel */}
          <IssueFollowup
            items={issueItems}
            onFix={handleFixIssue}
            loading={qualityLoading}
            companies={companiesMap}
          />

          {/* Count cards */}
          <div className="flex items-center gap-3 flex-wrap">
            <CountCard label="Total"   count={counts.total}   color="gray"   />
            <CountCard label="MLM"     count={counts.mlm}     color="violet" />
            <CountCard label="General" count={counts.general} color="sky"    />
            {counts.issues > 0 && (
              <CountCard label="Issues" count={counts.issues} color="red" />
            )}
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Magnifier className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Search by type, subtype, serial…"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all"
              />
            </div>

            {/* SelectType filter — changes based on active tab */}
            <div className="relative">
              <select
                value={filterSelectType}
                onChange={(e) => handleFilterSelectType(e.target.value)}
                className="pl-4 pr-9 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all appearance-none cursor-pointer"
              >
                <option value="">
                  All {activeTab === "MLM" ? "MLM" : "General"} Types
                </option>
                {selectTypeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            {/* Company filter — MLM tab only */}
            {activeTab === "MLM" && (
              <div className="relative">
                <select
                  value={filterCompany}
                  onChange={(e) => handleFilterCompany(e.target.value)}
                  disabled={companiesLoading}
                  className="pl-4 pr-9 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all appearance-none cursor-pointer disabled:opacity-60"
                >
                  <option value="">{companiesLoading ? "Loading…" : "All Companies"}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            )}

            {/* Active filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {filterSelectType && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 text-xs font-medium border border-sky-100 dark:border-sky-500/20">
                  {selectTypeOptions.find((o) => o.value === filterSelectType)?.name || filterSelectType}
                  <button onClick={() => handleFilterSelectType("")} className="hover:opacity-70 font-bold leading-none">×</button>
                </span>
              )}
              {filterCompany && activeTab === "MLM" && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-100 dark:border-emerald-500/20">
                  {companies.find((c) => c.id === filterCompany)?.name || filterCompany}
                  <button onClick={() => handleFilterCompany("")} className="hover:opacity-70 font-bold leading-none">×</button>
                </span>
              )}
            </div>

            <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0 sm:ml-auto">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
            💡 Click any row to open template options
          </p>
        </>
      )}

      {loading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && fetched && (
        <TemplateTable
          templates={filtered}
          onSelect={handleSelect}
          filtered={isFiltered}
          companiesMap={companiesMap}
          issueCountMap={issueCountMap}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}

      {selectedTemplate && (
        <TemplateDetailPopup
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onEdit={handleEdit}
          onQualityCheck={handleOpenQuality}
          canOperation={canOperation}
          canQuality={canQuality}
        />
      )}

      {qualityTemplate && (
        <QualityCheck
          template={qualityTemplate}
          onClose={handleQualityClose}
        />
      )}
    </div>
  );
}

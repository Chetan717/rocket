import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  collection, getDocs, addDoc, serverTimestamp, query, where,
} from "firebase/firestore";
import { db } from "../../../../Firebase";
import { COLLECTIONS } from "../../../collections";
import {
  ArrowLeft,
  CircleCheck,
  TriangleThunderbolt,
  ChevronDown,
} from "@gravity-ui/icons";

function IconCopy({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
import { selectCls, FieldLabel } from "../GraphicsLinkRow";

// ── constants ─────────────────────────────────────────────────────────────────
const COPY_SELECT_TYPES = [
  { name: "Rank Promotion",    value: "Rank_Promotion"    },
  { name: "Thank You Banner B", value: "ThankYou_Banner_B" },
  { name: "Meeting",           value: "Meeting"           },
  { name: "Training",          value: "Training"          },
];

// ── helpers ───────────────────────────────────────────────────────────────────
const isDemoCompany = (name = "") =>
  name.trim().toLowerCase().includes("demo");

// ── Component ─────────────────────────────────────────────────────────────────
export default function CopyRankPromotion() {
  const navigate = useNavigate();

  // raw data
  const [companies,  setCompanies]  = useState([]);   // all companies
  const [templates,  setTemplates]  = useState([]);   // all MLM templates
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // which SelectType to copy
  const [selectedSelectType, setSelectedSelectType] = useState("Rank_Promotion");

  // selection state
  const [checkedSubtypes, setCheckedSubtypes] = useState(new Set());
  const [targetCompany,   setTargetCompany]   = useState("");

  // copy state
  const [copying,      setCopying]      = useState(false);
  const [copyResult,   setCopyResult]   = useState(null); // { copied, skipped, error }

  // duplicate-subtype confirmation popup
  const [conflictSubtypes, setConflictSubtypes] = useState([]); // subtype names that already exist in target
  const [showConflictPopup, setShowConflictPopup] = useState(false);

  // ── fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [compSnap, tplSnap] = await Promise.all([
          getDocs(collection(db, COLLECTIONS.MLMCOMP)),
          getDocs(collection(db, COLLECTIONS.MLMTEMPLATE)),
        ]);

        if (cancelled) return;

        const allCompanies = compSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));

        const allMlmTemplates = tplSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((t) => t.MainType === "MLM");

        setCompanies(allCompanies);
        setTemplates(allMlmTemplates);
      } catch (err) {
        console.error(err);
        if (!cancelled) setFetchError("Failed to load data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── derived ─────────────────────────────────────────────────────────────────
  const demoCompany = useMemo(
    () => companies.find((c) => isDemoCompany(c.name)) || null,
    [companies],
  );

  const demoTemplates = useMemo(
    () =>
      demoCompany
        ? templates.filter((t) => t.Company === demoCompany.id && t.SelectType === selectedSelectType)
        : [],
    [templates, demoCompany, selectedSelectType],
  );

  // group by Subtype → list of templates
  const subtypeMap = useMemo(() => {
    const map = {}; // subtype → [template, ...]
    demoTemplates.forEach((t) => {
      const key = t.Subtype?.trim() || "(no subtype)";
      (map[key] = map[key] || []).push(t);
    });
    return map;
  }, [demoTemplates]);

  const subtypeKeys = useMemo(
    () => Object.keys(subtypeMap).sort(),
    [subtypeMap],
  );

  const targetCompanies = useMemo(
    () =>
      demoCompany
        ? companies.filter((c) => c.id !== demoCompany.id)
        : companies,
    [companies, demoCompany],
  );

  // ── checkbox handlers ────────────────────────────────────────────────────────
  const toggleSubtype = useCallback((key) => {
    setCheckedSubtypes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setCopyResult(null);
  }, []);

  const toggleAll = useCallback(() => {
    setCheckedSubtypes((prev) =>
      prev.size === subtypeKeys.length ? new Set() : new Set(subtypeKeys),
    );
    setCopyResult(null);
  }, [subtypeKeys]);

  // ── copy ─────────────────────────────────────────────────────────────────────
  // performs the actual write, optionally renaming subtypes that clash with
  // an existing subtype name in the target company (appends " Copy")
  const runCopy = useCallback(async (subtypesToCopy, subtypesToRename = new Set()) => {
    setCopying(true);
    setCopyResult(null);

    let copied = 0;
    let skippedDuplicate = 0;
    const errors = [];

    try {
      // Fresh query at copy-time so we never rely on stale React state
      const freshSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.MLMTEMPLATE),
          where("Company",    "==", targetCompany),
          where("SelectType", "==", selectedSelectType),
        ),
      );
      // Mutable set — updated after each successful insert to catch in-batch dupes too
      const existingKeys = new Set(
        freshSnap.docs.map((d) => {
          const data = d.data();
          return `${(data.Subtype || "").trim()}__${data.serial ?? ""}`;
        }),
      );

      // Collect all templates for the subtypes being copied
      const toBeCopied = [];
      subtypesToCopy.forEach((sub) => {
        (subtypeMap[sub] || []).forEach((t) => toBeCopied.push(t));
      });

      for (const t of toBeCopied) {
        const originalSubtype = (t.Subtype || "").trim();
        // if this subtype clashed with an existing one and admin confirmed
        // duplication, rename the destination subtype to "<name> Copy"
        const finalSubtype = subtypesToRename.has(originalSubtype)
          ? `${originalSubtype} Copy`
          : originalSubtype;

        const dupKey = `${finalSubtype}__${t.serial ?? ""}`;
        if (existingKeys.has(dupKey)) {
          skippedDuplicate++;
          continue;
        }
        try {
          // eslint-disable-next-line no-unused-vars
          const { id: _id, ...rest } = t;
          await addDoc(collection(db, COLLECTIONS.MLMTEMPLATE), {
            ...rest,
            Subtype: finalSubtype,
            Company: targetCompany,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          // Mark as inserted so duplicate within same batch is also caught
          existingKeys.add(dupKey);
          copied++;
        } catch (err) {
          console.error("Copy failed for", t.id, err);
          errors.push(t.id);
        }
      }
    } catch (err) {
      console.error("Pre-copy query failed", err);
      errors.push("pre-query-failed");
    }

    setCopyResult({ copied, skipped: skippedDuplicate, errors });
    setCopying(false);
  }, [targetCompany, subtypeMap, selectedSelectType]);

  // entry point for the Copy button — checks for subtype-name clashes in the
  // target company first, and if found, opens a confirmation popup before
  // writing anything
  const handleCopy = useCallback(async () => {
    if (!targetCompany || checkedSubtypes.size === 0) return;

    setCopying(true);
    setCopyResult(null);

    try {
      const freshSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.MLMTEMPLATE),
          where("Company",    "==", targetCompany),
          where("SelectType", "==", selectedSelectType),
        ),
      );
      const existingSubtypeNames = new Set(
        freshSnap.docs.map((d) => (d.data().Subtype || "").trim()),
      );

      const conflicts = [...checkedSubtypes].filter((sub) =>
        existingSubtypeNames.has(sub),
      );

      if (conflicts.length > 0) {
        setCopying(false);
        setConflictSubtypes(conflicts);
        setShowConflictPopup(true);
        return;
      }
    } catch (err) {
      console.error("Conflict check failed", err);
      setCopying(false);
      setCopyResult({ copied: 0, skipped: 0, errors: ["conflict-check-failed"] });
      return;
    }

    await runCopy(checkedSubtypes);
  }, [targetCompany, checkedSubtypes, selectedSelectType, runCopy]);

  // admin confirmed: duplicate the clashing subtypes as "<name> Copy"
  const confirmDuplicate = useCallback(async () => {
    setShowConflictPopup(false);
    await runCopy(checkedSubtypes, new Set(conflictSubtypes));
  }, [checkedSubtypes, conflictSubtypes, runCopy]);

  // admin declined: skip the clashing subtypes, copy the rest as-is
  const skipConflicting = useCallback(async () => {
    setShowConflictPopup(false);
    const nonConflicting = new Set(checkedSubtypes);
    conflictSubtypes.forEach((s) => nonConflicting.delete(s));
    if (nonConflicting.size === 0) {
      setCopyResult({ copied: 0, skipped: 0, errors: [] });
      return;
    }
    await runCopy(nonConflicting);
  }, [checkedSubtypes, conflictSubtypes, runCopy]);

  const selectedCount = useMemo(
    () =>
      [...checkedSubtypes].reduce(
        (sum, sub) => sum + (subtypeMap[sub]?.length || 0),
        0,
      ),
    [checkedSubtypes, subtypeMap],
  );

  const targetName = useMemo(
    () => companies.find((c) => c.id === targetCompany)?.name || "",
    [companies, targetCompany],
  );

  // ── render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />
          {fetchError}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/templates")}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1
            className="text-xl font-bold text-gray-900 dark:text-white"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Copy Rank Promotion Templates
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Duplicate Demo Company subtypes into another company
          </p>
        </div>
      </div>

      {/* SelectType picker */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Template Type to Copy <span className="text-red-400">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {COPY_SELECT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setSelectedSelectType(t.value);
                setCheckedSubtypes(new Set());
                setTargetCompany("");
                setCopyResult(null);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                selectedSelectType === t.value
                  ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/20"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* DEMO company not found */}
      {!demoCompany && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
          <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />
          No Demo Company found. Make sure a company named "DEMO" (or containing "demo") exists in Companies.
        </div>
      )}

      {demoCompany && (
        <>
          {/* Source info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <IconCopy className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-violet-800 dark:text-violet-300">
                Source: {demoCompany.name}
              </p>
              <p className="text-violet-600/70 dark:text-violet-400/60 text-xs">
                {demoTemplates.length} {COPY_SELECT_TYPES.find((t) => t.value === selectedSelectType)?.name || selectedSelectType} template{demoTemplates.length !== 1 ? "s" : ""} · {subtypeKeys.length} subtype{subtypeKeys.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* No templates in Demo */}
          {demoTemplates.length === 0 && (
            <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 text-center text-sm text-gray-400">
              No {COPY_SELECT_TYPES.find((t) => t.value === selectedSelectType)?.name || selectedSelectType} templates found under {demoCompany.name}.
            </div>
          )}

          {/* Subtype checkboxes */}
          {subtypeKeys.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
              {/* Section header + select all */}
              <div className="flex items-center justify-between">
                <FieldLabel>Select Subtypes to Copy</FieldLabel>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {checkedSubtypes.size === subtypeKeys.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              <div className="space-y-2">
                {subtypeKeys.map((sub) => {
                  const count   = subtypeMap[sub].length;
                  const checked = checkedSubtypes.has(sub);
                  return (
                    <label
                      key={sub}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none transition-all ${
                        checked
                          ? "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      }`}
                    >
                      {/* custom checkbox */}
                      <span
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          checked
                            ? "bg-violet-600 border-violet-600"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {checked && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 12 12"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2 6l3 3 5-5"
                            />
                          </svg>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleSubtype(sub)}
                      />
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                        {sub}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
                        {count} template{count !== 1 ? "s" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* selection summary */}
              {checkedSubtypes.size > 0 && (
                <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                  {checkedSubtypes.size} subtype{checkedSubtypes.size !== 1 ? "s" : ""} selected
                  → {selectedCount} template{selectedCount !== 1 ? "s" : ""} will be copied
                </p>
              )}
            </div>
          )}

          {/* Target company selector */}
          {subtypeKeys.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-3">
              <FieldLabel required>Copy To Company</FieldLabel>
              <div className="relative">
                <select
                  value={targetCompany}
                  onChange={(e) => {
                    setTargetCompany(e.target.value);
                    setCopyResult(null);
                  }}
                  className={selectCls}
                >
                  <option value="">Select target company…</option>
                  {targetCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {targetCompany && (
                <p className="text-xs text-gray-400">
                  Copies will be created under <span className="font-semibold text-violet-500">{targetName}</span>. Duplicates (same subtype + serial) are skipped automatically.
                </p>
              )}
            </div>
          )}

          {/* Duplicate subtype confirmation popup */}
          {showConflictPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <TriangleThunderbolt className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h2
                    className="text-base font-bold text-gray-900 dark:text-white"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    Subtype already exists
                  </h2>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{targetName}</strong> already has {conflictSubtypes.length === 1 ? "a subtype" : "subtypes"} with the same name:
                </p>

                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {conflictSubtypes.map((sub) => (
                    <li
                      key={sub}
                      className="text-sm px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium"
                    >
                      {sub}
                    </li>
                  ))}
                </ul>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Do you want to duplicate {conflictSubtypes.length === 1 ? "it" : "them"} anyway? The copy will be saved as{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    "{conflictSubtypes[0]} Copy"
                  </span>
                  {conflictSubtypes.length > 1 ? ", and so on." : "."}
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={skipConflicting}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Skip {conflictSubtypes.length === 1 ? "it" : "them"}
                  </button>
                  <button
                    type="button"
                    onClick={confirmDuplicate}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20"
                  >
                    Yes, duplicate it
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Result banner */}
          {copyResult && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
              copyResult.errors.length > 0
                ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400"
                : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
            }`}>
              {copyResult.errors.length === 0
                ? <CircleCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <TriangleThunderbolt className="w-4 h-4 flex-shrink-0 mt-0.5" />
              }
              <div className="space-y-1">
                {copyResult.copied > 0 && (
                  <p>
                    ✅ <strong>{copyResult.copied}</strong> template{copyResult.copied !== 1 ? "s" : ""} copied
                    to <strong>{targetName}</strong>.
                  </p>
                )}
                {copyResult.skipped > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    ⚠ {copyResult.skipped} skipped — already exist in {targetName} (same subtype + serial).
                  </p>
                )}
                {copyResult.errors.length > 0 && (
                  <p>
                    ❌ {copyResult.errors.length} failed to copy. Check console for details.
                  </p>
                )}
                {copyResult.copied > 0 && copyResult.errors.length === 0 && (
                  <button
                    onClick={() => navigate("/templates")}
                    className="text-xs font-semibold underline underline-offset-2 mt-1 block"
                  >
                    Go to Templates →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {subtypeKeys.length > 0 && (
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate("/templates")}
                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={
                  copying ||
                  checkedSubtypes.size === 0 ||
                  !targetCompany
                }
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20"
              >
                {copying ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Copying…
                  </>
                ) : (
                  <>
                    <IconCopy className="w-4 h-4" />
                    Copy {selectedCount > 0 ? `${selectedCount} Template${selectedCount !== 1 ? "s" : ""}` : "Selected"}
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../../Firebase";
import { COLLECTIONS } from "../../collections";
import {
  getGraphicsStableKey,
  getSubtypeQualityDocId,
  getSubtypeQualityKey,
  hasSelectedCurrentFlag,
  normalizeQualityFlag,
  reconcileQualityChecks,
} from "./qualityUtils";

const FLAGS = {
  ok:    { label: "OK",    desc: "Perfect — no issue" },
  issue: { label: "Issue", desc: "Has a problem" },
};

const PAGE_SIZE = 10;

const FLAG_STYLES = {
  ok:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  issue: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};
const FLAG_DOT = {
  ok:    "bg-emerald-500",
  issue: "bg-red-500",
};

function FlagBadge({ flag }) {
  if (!flag) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Not Selected
      </span>
    );
  }
  const f = FLAGS[flag];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${FLAG_STYLES[flag]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${FLAG_DOT[flag]}`} />
      {f.label}
    </span>
  );
}

// ── Single row ─────────────────────────────────────────────────────────────
function QualityRow({ idx, stableKey, check, onChange }) {
  const flag = normalizeQualityFlag(check?.flag);
  const note = check?.note || "";

  return (
    <tr className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${flag === "issue" ? "bg-red-50/30 dark:bg-red-500/5" : ""}`}>
      {/* Graphic Link No */}
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold">
          #{idx + 1}
        </span>
      </td>

      {/* Flag selector */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {Object.keys(FLAGS).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => onChange(stableKey, "flag", f)}
              title={FLAGS[f].desc}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                flag === f
                  ? `${FLAG_STYLES[f]} ring-2 ring-offset-1 ${f === "ok" ? "ring-emerald-400" : "ring-red-400"}`
                  : "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {FLAGS[f].label}
            </button>
          ))}
        </div>
      </td>

      {/* Note */}
      <td className="px-4 py-3 min-w-[200px]">
        <textarea
          value={note}
          onChange={(e) => onChange(stableKey, "note", e.target.value)}
          placeholder={flag === "issue" ? "Describe the issue…" : flag === "ok" ? "Add a note (optional)" : "Select OK or Issue"}
          rows={1}
          className={`w-full text-xs px-3 py-2 rounded-xl border resize-none focus:outline-none focus:ring-2 transition-all
            ${flag === "issue"
              ? "border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 focus:ring-red-300/40 text-gray-700 dark:text-gray-300 placeholder-red-300"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-violet-300/40 text-gray-700 dark:text-gray-300 placeholder-gray-400"
            }`}
          style={{ minHeight: "36px", maxHeight: "80px" }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
          }}
        />
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-center whitespace-nowrap">
        <FlagBadge flag={flag} />
      </td>
    </tr>
  );
}

// ── Summary bar ────────────────────────────────────────────────────────────
function SummaryBar({ checks, links }) {
  const counts = useMemo(() => {
    const c = { ok: 0, issue: 0, unselected: 0 };
    links.forEach((link, index) => {
      const stableKey = getGraphicsStableKey(link, index);
      const flag = normalizeQualityFlag(checks[stableKey]?.flag);
      if (flag) c[flag] += 1;
      else c.unselected += 1;
    });
    return c;
  }, [checks, links]);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {Object.keys(FLAGS).map((f) => (
        <div key={f} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${FLAG_STYLES[f]}`}>
          <span className={`w-2 h-2 rounded-full ${FLAG_DOT[f]}`} />
          {FLAGS[f].label}: {counts[f]}
        </div>
      ))}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
        <span className="w-2 h-2 rounded-full bg-gray-400" />
        Not Selected: {counts.unselected}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function QualityCheck({ template, onClose }) {
  const links      = useMemo(() => template?.GraphicsLink || [], [template?.GraphicsLink]);
  const templateId = template?.id;
  const subtypeKey = useMemo(() => getSubtypeQualityKey(template), [template]);
  const subtypeDocId = useMemo(() => getSubtypeQualityDocId(subtypeKey), [subtypeKey]);

  const [checks,  setChecks]  = useState({});
  const [subtypeChecked, setSubtypeChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    setChecks({});
    setSubtypeChecked(false);
    setPage(1);
    setLoading(true);
    Promise.all([
      getDoc(doc(db, COLLECTIONS.TEMPLATEQUALITY, templateId)),
      getDoc(doc(db, COLLECTIONS.TEMPLATEQUALITY, subtypeDocId)),
    ])
      .then(([templateSnap, subtypeSnap]) => {
        if (cancelled) return;
        const rawChecks = templateSnap.exists() ? (templateSnap.data().checks || {}) : {};
        setChecks(reconcileQualityChecks(links, rawChecks));
        const subtypeData = subtypeSnap.exists() ? subtypeSnap.data() : null;
        setSubtypeChecked(
          typeof subtypeData?.checked === "boolean"
            ? subtypeData.checked
            : hasSelectedCurrentFlag(template, { checks: rawChecks }),
        );
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [template, templateId, subtypeDocId, links]);

  const totalPages = Math.max(1, Math.ceil(links.length / PAGE_SIZE));
  const pageLinks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return links.slice(start, start + PAGE_SIZE).map((link, offset) => ({
      link,
      idx: start + offset,
    }));
  }, [links, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleChange = useCallback((stableKey, field, value) => {
    setChecks((prev) => ({
      ...prev,
      [stableKey]: {
        note: "",
        ...(prev[stableKey] || {}),
        [field]: value,
      },
    }));
    if (field === "flag") setSubtypeChecked(true);
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!templateId) return;
    setSaving(true);
    setError(null);
    try {
      const currentChecks = reconcileQualityChecks(links, checks);

      const batch = writeBatch(db);
      batch.set(doc(db, COLLECTIONS.TEMPLATEQUALITY, templateId), {
        templateId,
        recordType: "template",
        checks: currentChecks,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, COLLECTIONS.TEMPLATEQUALITY, subtypeDocId), {
        recordType: "subtype",
        subtypeKey,
        mainType: template?.MainType || "",
        companyId: template?.MainType === "MLM" ? (template?.Company || "") : "",
        selectType: template?.SelectType || "",
        subtype: template?.Subtype || "",
        checked: subtypeChecked,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error(err);
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [templateId, subtypeDocId, subtypeKey, subtypeChecked, template, links, checks, onClose]);

  const title = `#${template?.serial || "—"} · ${template?.MainType || ""} / ${(template?.SelectType || "").replace(/_/g, " ")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl w-full max-w-4xl z-10 my-8 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Quality Check
              </span>
              {template?.MainType && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  template.MainType === "MLM"
                    ? "bg-violet-50 text-violet-700 border-violet-100"
                    : "bg-sky-50 text-sky-700 border-sky-100"
                }`}>
                  {template.MainType}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
              {title}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Review graphics links with OK or Issue, then confirm the subtype
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0 text-xl font-light"
          >
            ×
          </button>
        </div>

        {/* Flag legend */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-600 dark:text-gray-300">Flags:</span>
            {Object.entries(FLAGS).map(([key, { label, desc }]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${FLAG_DOT[key]}`} />
                <strong>{label}</strong> — {desc}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">

          {!loading && (
            <fieldset className={`rounded-2xl border p-4 ${
              subtypeChecked
                ? "border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/10"
                : "border-orange-200 bg-orange-50/60 dark:border-orange-500/30 dark:bg-orange-500/10"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Subtype Check: {template?.Subtype || "—"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Changing any Graphics Link flag automatically selects Checked.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-xs font-semibold ${
                    subtypeChecked
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-700"
                  }`}>
                    <input
                      type="radio"
                      name={`subtype-check-${templateId}`}
                      checked={subtypeChecked}
                      onChange={() => { setSubtypeChecked(true); setSaved(false); }}
                      className="accent-blue-600"
                    />
                    Checked
                  </label>
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-xs font-semibold ${
                    !subtypeChecked
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-700"
                  }`}>
                    <input
                      type="radio"
                      name={`subtype-check-${templateId}`}
                      checked={!subtypeChecked}
                      onChange={() => { setSubtypeChecked(false); setSaved(false); }}
                      className="accent-orange-500"
                    />
                    Unchecked
                  </label>
                </div>
              </div>
            </fieldset>
          )}

          {!loading && links.length > 0 && (
            <SummaryBar checks={checks} links={links} />
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No graphics links in this template</p>
              <p className="text-xs text-gray-400 mt-1">Add graphics links in the template editor first.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                      {["Graphic Link No", "Set Flag", "Issue Note", "Status"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageLinks.map(({ link, idx }) => {
                      const stableKey = getGraphicsStableKey(link, idx);
                      return (
                        <QualityRow
                          key={stableKey}
                          idx={idx}
                          stableKey={stableKey}
                          check={checks[stableKey]}
                          onChange={handleChange}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                  <p className="text-xs text-gray-400">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, links.length)} of {links.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && templateId && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400">
                Click Save to persist the two flags, notes and subtype status.
              </p>
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">✓</span>
                    Saved!
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20"
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {saving ? "Saving…" : "Save Quality Check"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

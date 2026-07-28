import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  collection, doc, getDoc, getDocs, deleteDoc,
  serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../../../../Firebase";
import {
  ArrowLeft, TrashBin, TriangleThunderbolt, CircleCheck, ChevronDown, Eye, Folder,
} from "@gravity-ui/icons";
import ImageUploadInput from "../../../Utils/Imageuploadinput";
import { useAdminDeleteGuard } from "../../../Utils/AdminDeleteGuard";
import { COLLECTIONS } from "../../../collections";
import {
  GraphicsLinksField,
  inputCls,
  selectCls,
  FieldLabel,
} from "../GraphicsLinkRow";
import {
  MAIN_TYPES,
  INITIAL_FORM,
  emptyGraphicsLink,
  getSelectTypes,
  uid,
} from "../Constant";
import {
  getSubtypeQualityDocId,
  getSubtypeQualityKey,
  normalizeQualityChecks,
  normalizeQualityFlag,
  removeQualityCheckForLink,
  reconcileQualityChecks,
} from "../qualityUtils";

// ── Small helper components ────────────────────────────────────────────────
function TextField({ label, value, onChange, placeholder, required, type = "text" }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={inputCls} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, required, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="relative">
        <select value={value} onChange={onChange} required={required} disabled={disabled}
          className={`${selectCls} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
          <option value="">{placeholder || "Select…"}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
}

function ToggleSwitch({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 ${checked ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function ShowHideRadio({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Visibility (Launched)</FieldLabel>
      <div className="flex items-center gap-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
        <label className="flex items-center gap-2 cursor-pointer">
          <span onClick={() => onChange(true)}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${value === true ? "border-violet-600 bg-violet-600" : "border-gray-300 dark:border-gray-600 hover:border-violet-400"}`}>
            {value === true && <span className="w-2 h-2 rounded-full bg-white block" />}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">Show</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <span onClick={() => onChange(false)}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${value === false ? "border-red-500 bg-red-500" : "border-gray-300 dark:border-gray-600 hover:border-red-400"}`}>
            {value === false && <span className="w-2 h-2 rounded-full bg-white block" />}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">Hide</span>
        </label>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${value ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"}`}>
          {value ? "Visible" : "Hidden"}
        </span>
      </div>
    </div>
  );
}

function DeleteModal({ onConfirm, onCancel, loading, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 max-w-sm w-full z-10">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4"><TrashBin className="w-6 h-6 text-red-500" /></div>
        <h3 className="text-center font-bold text-gray-900 dark:text-white text-lg mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Delete Template?</h3>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6"><span className="font-semibold text-gray-700 dark:text-gray-300">"{title}"</span> will be permanently deleted.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quality Check Status Update Modal ─────────────────────────────────────
function QualityStatusModal({ onConfirm, onCancel, issueCount }) {
  const [choice, setChoice] = useState("resolved"); // "resolved" | "remaining"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 max-w-sm w-full z-10">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-center font-bold text-gray-900 dark:text-white text-base mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
          Update Quality Check Status
        </h3>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-5">
          This template had <strong className="text-red-500">{issueCount} flagged issue{issueCount !== 1 ? "s" : ""}</strong>. Please update the quality check status before saving.
        </p>

        <div className="space-y-2 mb-5">
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${choice === "resolved" ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/40" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
            <input type="radio" name="qcstatus" value="resolved" checked={choice === "resolved"} onChange={() => setChoice("resolved")} className="accent-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">✅ Issues Resolved — Mark as OK</p>
              <p className="text-xs text-gray-400">All flagged issues have been fixed in this edit</p>
            </div>
          </label>
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${choice === "remaining" ? "bg-red-50 border-red-300 dark:bg-red-500/10 dark:border-red-500/40" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
            <input type="radio" name="qcstatus" value="remaining" checked={choice === "remaining"} onChange={() => setChoice("remaining")} className="accent-red-500" />
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">🔴 Issues Still Remain</p>
              <p className="text-xs text-gray-400">Issues are not yet fixed — keep them flagged</p>
            </div>
          </label>
        </div>

        {!choice && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center mb-3 font-medium">
            ⚠ You must select a status to save the template
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => choice && onConfirm(choice)}
            disabled={!choice}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}

const normaliseGraphics = (arr) =>
  (arr || []).map((item) => ({ ...emptyGraphicsLink(), ...item, _key: uid() }));

export default function EditTemplate() {
  const { id }             = useParams();
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();
  const fromIssues         = searchParams.get("from") === "issues";

  const [form,          setForm]          = useState(null);
  const [fetchLoading,  setFetchLoading]  = useState(true);
  const [saveLoading,   setSaveLoading]   = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDelete,    setShowDelete]    = useState(false);
  const [error,         setError]         = useState(null);
  const [success,       setSuccess]       = useState(false);

  // ── Quality check data ────────────────────────────────────────────────────
  const [qualityChecks,  setQualityChecks]  = useState({}); // { stableKey: { flag, note } }
  const [qualityLoading, setQualityLoading] = useState(false);
  const [showQCModal,    setShowQCModal]    = useState(false);
  const [pendingFormData,setPendingForm]    = useState(null); // form to save after QC confirm

  // Only current graphics links participate. Deleted-link flags are pruned,
  // while old index:id records are migrated to permanent per-link keys.
  const currentQualityChecks = useMemo(
    () => reconcileQualityChecks(form?.GraphicsLink, qualityChecks),
    [form?.GraphicsLink, qualityChecks],
  );

  // Issue-flagged permanent keys
  const issueKeys = useMemo(() => {
    return Object.entries(currentQualityChecks)
      .filter(([, v]) => normalizeQualityFlag(v.flag) === "issue")
      .map(([k]) => k);
  }, [currentQualityChecks]);

  const issueCount = issueKeys.length;

  // ── Fetch template ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setQualityLoading(true);
    (async () => {
      try {
        const [templateSnap, qualitySnap] = await Promise.all([
          getDoc(doc(db, "mlmtemplate", id)),
          getDoc(doc(db, COLLECTIONS.TEMPLATEQUALITY, id)),
        ]);
        if (!templateSnap.exists()) { setError("Template not found."); return; }
        const d = templateSnap.data();
        const normalizedGraphics = normaliseGraphics(d.GraphicsLink);
        const graphicsLinks = normalizedGraphics.length
          ? normalizedGraphics
          : [emptyGraphicsLink()];
        if (!cancelled) {
          setForm({
            MainType:     d.MainType     || "",
            SelectType:   d.SelectType   || "",
            Subtype:      d.Subtype      || "",
            Company:      d.Company      || "",
            Showcase_url: d.Showcase_url || "",
            ShowCaseForm: d.ShowCaseForm || "",
            Date:         d.Date         || "",
            serial:       d.serial       ?? "",
            Active:       d.Active       ?? false,
            Launched:     d.Launched     ?? true,
            GraphicsLink: graphicsLinks,
          });
          const rawChecks = qualitySnap.exists()
            ? (qualitySnap.data().checks || {})
            : {};
          setQualityChecks(reconcileQualityChecks(graphicsLinks, rawChecks));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load template.");
      } finally {
        if (!cancelled) {
          setFetchLoading(false);
          setQualityLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const setField   = useCallback((key) => (val) => setForm((p) => ({ ...p, [key]: val })), []);
  const handleText = useCallback((key) => (e)   => setForm((p) => ({ ...p, [key]: e.target.value })), []);

  // ── Companies ─────────────────────────────────────────────────────────────
  const [companies,        setCompanies]        = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  useEffect(() => {
    if (form?.MainType !== "MLM") { setCompanies([]); return; }
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
  }, [form?.MainType]);

  const handleMainTypeChange = useCallback((e) => {
    setForm((p) => ({ ...p, MainType: e.target.value, SelectType: "", Date: "", Company: "" }));
  }, []);

  const handleSelectTypeChange = useCallback((e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, SelectType: val, Date: val === "Festival" ? p.Date : "" }));
  }, []);

  const selectTypeOptions = useMemo(() => getSelectTypes(form?.MainType || ""), [form?.MainType]);
  const isFestival = form?.SelectType === "Festival";

  // ── Determine which exact graphic rows have issues ────────────────────────
  const issueKeySet = useMemo(() => new Set(issueKeys), [issueKeys]);

  // Remove the deleted row's quality record while the complete pre-delete
  // graphics list is still available. This prevents legacy index-based flags
  // from being reassigned to the previous or next row in the same render.
  const handleGraphicsItemRemove = useCallback((removedItem, removedIndex) => {
    setQualityChecks((previousChecks) => removeQualityCheckForLink(
      form?.GraphicsLink,
      previousChecks,
      removedItem,
      removedIndex,
    ));
  }, [form?.GraphicsLink]);

  // ── Do the actual save to Firestore ───────────────────────────────────────
  const performSave = useCallback(async (
    formData,
    checksToSave = currentQualityChecks,
    markSubtypeChecked = false,
  ) => {
    setSaveLoading(true);
    setError(null);
    try {
      const cleanGraphics = formData.GraphicsLink.map((item) => {
        const rest = { ...item };
        delete rest._key;
        return {
          ...rest,
          id: Number(rest.id) || 0,
          bannerId: rest.bannerId || "",
          incmNameId: Number(rest.incmNameId) || 0,
        };
      });
      const reconciledChecks = reconcileQualityChecks(
        cleanGraphics,
        checksToSave,
      );
      const batch = writeBatch(db);
      batch.update(doc(db, "mlmtemplate", id), {
        ...formData, serial: Number(formData.serial) || 0, GraphicsLink: cleanGraphics, updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, COLLECTIONS.TEMPLATEQUALITY, id), {
        templateId: id,
        recordType: "template",
        checks: reconciledChecks,
        updatedAt: serverTimestamp(),
      });

      if (markSubtypeChecked) {
        const subtypeKey = getSubtypeQualityKey(formData);
        const subtypeDocId = getSubtypeQualityDocId(subtypeKey);
        batch.set(doc(db, COLLECTIONS.TEMPLATEQUALITY, subtypeDocId), {
          recordType: "subtype",
          subtypeKey,
          mainType: formData?.MainType || "",
          companyId: formData?.MainType === "MLM" ? (formData?.Company || "") : "",
          selectType: formData?.SelectType || "",
          subtype: formData?.Subtype || "",
          checked: true,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setSuccess(true);
      setTimeout(() => navigate("/templates"), 1200);
    } catch (err) {
      console.error(err);
      setError("Failed to update template.");
    } finally {
      setSaveLoading(false);
    }
  }, [id, navigate, currentQualityChecks]);

  // ── handleSubmit: intercept if issues exist ────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form?.MainType || !form?.SelectType) { setError("Main Type and Select Type are required."); return; }

    if (issueCount > 0) {
      // Show modal to ask about quality check status
      setPendingForm(form);
      setShowQCModal(true);
      return;
    }

    await performSave(form, currentQualityChecks);
  }, [form, issueCount, performSave, currentQualityChecks]);

  // ── Called after user confirms QC status ──────────────────────────────────
  const handleQCConfirm = useCallback(async (choice) => {
    setShowQCModal(false);
    const updatedChecks = normalizeQualityChecks(currentQualityChecks);
    if (choice === "resolved") {
      issueKeys.forEach((key) => {
        updatedChecks[key] = { ...updatedChecks[key], flag: "ok" };
      });
    }
    await performSave(pendingFormData, updatedChecks, true);
    setPendingForm(null);
  }, [currentQualityChecks, issueKeys, performSave, pendingFormData]);

  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const handleDelete = useCallback(() => {
    requestDelete(async () => {
      setDeleteLoading(true);
      try {
        await deleteDoc(doc(db, "mlmtemplate", id));
        navigate("/templates");
      } catch (err) {
        console.error(err);
        setError("Delete failed."); setShowDelete(false);
      } finally { setDeleteLoading(false); }
    });
  }, [id, navigate, requestDelete]);

  if (fetchLoading) return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
    </div>
  );

  if (error && !form) return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
        <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />{error}
      </div>
    </div>
  );

  const templateTitle = form ? `#${form.serial || "—"} · ${form.MainType} / ${form.SelectType}` : "Template";

  return (
    <>
      {showDelete && <DeleteModal title={templateTitle} onConfirm={handleDelete} onCancel={() => setShowDelete(false)} loading={deleteLoading} />}
      {showQCModal && (
        <QualityStatusModal
          issueCount={issueCount}
          onConfirm={handleQCConfirm}
          onCancel={() => { setShowQCModal(false); setPendingForm(null); }}
        />
      )}
      {DeleteAuthModal}
      {BlockedToast}

      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/templates")} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Edit Template</h1>
              <p className="text-sm text-gray-400 truncate max-w-xs">{templateTitle}</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowDelete(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-500 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
            <TrashBin className="w-4 h-4" /><span className="hidden sm:inline">Delete Template</span>
          </button>
        </div>

        {/* Issue banner */}
        {fromIssues && issueCount > 0 && !qualityLoading && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-[10px] font-bold">!</span>
            </div>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                {issueCount} Quality Issue{issueCount !== 1 ? "s" : ""} Found
              </p>
              <p className="text-xs text-red-500 dark:text-red-400/80 mt-0.5">
                Graphics rows highlighted in red have flagged issues. Fix them, then save — you will be asked to update the quality status.
              </p>
            </div>
          </div>
        )}

        {success && <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm"><CircleCheck className="w-4 h-4 flex-shrink-0" />Updated! Redirecting…</div>}
        {error   && <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm"><TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />{error}</div>}

        {form && (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Type config */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1"><Folder className="w-4 h-4 text-violet-500" /><h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Type Configuration</h2></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField label="Main Type"   value={form.MainType}   onChange={handleMainTypeChange}   options={MAIN_TYPES}       placeholder="Select main type…" required />
                <SelectField label="Select Type" value={form.SelectType} onChange={handleSelectTypeChange} options={selectTypeOptions} placeholder={form.MainType ? "Select type…" : "Choose Main Type first"} required disabled={!form.MainType} />
              </div>

              <TextField label="Subtype" value={form.Subtype || ""} onChange={handleText("Subtype")} placeholder="e.g. Diwali, Gold Pack, Morning Series…" />

              {form.MainType === "MLM" && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Company</FieldLabel>
                  <div className="relative">
                    <select value={form.Company || ""} onChange={handleText("Company")} disabled={companiesLoading}
                      className={`${selectCls} ${companiesLoading ? "opacity-60 cursor-not-allowed" : ""}`}>
                      <option value="">{companiesLoading ? "Loading companies…" : "Select company…"}</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              )}

              {isFestival && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <FieldLabel required>Date of Festival</FieldLabel>
                  <input type="date" value={form.Date || ""} onChange={handleText("Date")} required className={inputCls} />
                  <p className="text-xs text-amber-600 dark:text-amber-400">Required for Festival type templates</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField label="Serial Number" value={String(form.serial ?? "")} onChange={handleText("serial")} type="number" />
                {!isFestival && <TextField label="Date" value={form.Date} onChange={handleText("Date")} type="date" />}
              </div>
            </div>

            {/* Showcase */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1"><Eye className="w-4 h-4 text-violet-500" /><h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Showcase Images</h2></div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Showcase Image URL</FieldLabel>
                <ImageUploadInput value={form.Showcase_url} onChange={setField("Showcase_url")} storagePath="templates/showcase" placeholder="Paste URL or click ↑ to upload" />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Form Showcase Image URL</FieldLabel>
                <ImageUploadInput value={form.ShowCaseForm || ""} onChange={setField("ShowCaseForm")} storagePath="templates/showcase-form" placeholder="Paste URL or click ↑ to upload form showcase image" />
                <p className="text-xs text-gray-400">Used as the in-app form background / preview image</p>
              </div>
            </div>

            {/* Status */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</h2>
              <ToggleSwitch label="Active" description="Template is visible and active" checked={form.Active} onChange={setField("Active")} />
              <ShowHideRadio value={form.Launched} onChange={setField("Launched")} />
            </div>

            {/* Graphics Links — issue rows highlighted */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
              {issueCount > 0 && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <span>Rows highlighted in red have quality issues. Fix the graphics data, then save to update quality status.</span>
                </div>
              )}
              <GraphicsLinksField
                items={form.GraphicsLink}
                onChange={setField("GraphicsLink")}
                selType={form.SelectType}
                issueKeySet={issueKeySet}
                onItemRemove={handleGraphicsItemRemove}
              />
              <p className="text-xs text-gray-400 mt-3">
                Fields shown / hidden based on <span className="font-medium text-violet-500">{form.SelectType || "Select Type"}</span>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={() => navigate("/templates")} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
              <button type="submit" disabled={saveLoading || success} className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20 flex items-center gap-2">
                {saveLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saveLoading ? "Saving…" : issueCount > 0 ? "Save & Update Status" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

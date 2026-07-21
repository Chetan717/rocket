import { useState, useCallback, useMemo , useEffect } from "react";
import { useNavigate } from "react-router";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../Firebase";
import {
  ArrowLeft, TriangleThunderbolt, CircleCheck, ChevronDown, Eye, Folder,
} from "@gravity-ui/icons";
import ImageUploadInput from "../../../Utils/Imageuploadinput";
import { COLLECTIONS } from "../../../collections";
import {
  GraphicsLinksField,
  inputCls,
  selectCls,
  FieldLabel,
} from "../GraphicsLinkRow";
import {
  MAIN_TYPES,
  POSITION_OPTIONS,
  INITIAL_FORM,
  emptyGraphicsLink,
  getSelectTypes,
} from "../Constant";

const FORM_DEFAULTS = { ...INITIAL_FORM, ShowCaseForm: "", Launched: true, Company: "" };

function TextField({ label, id, value, onChange, placeholder, required, type = "text" }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={inputCls} />
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

export default function AddTemplate() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState(FORM_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);

  const setField   = useCallback((key) => (val) => setForm((p) => ({ ...p, [key]: val })), []);
  const handleText = useCallback((key) => (e)   => setForm((p) => ({ ...p, [key]: e.target.value })), []);

  // ── Companies — fetched only when MLM is selected ─────────────────────────
  const [companies,        setCompanies]        = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  useEffect(() => {
    if (form.MainType !== "MLM") {
      setCompanies([]);
      setForm((p) => ({ ...p, Company: "" })); // clear company if type changes
      return;
    }
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
  }, [form.MainType]);

  const handleMainTypeChange = useCallback((e) => {
    setForm((p) => ({ ...p, MainType: e.target.value, SelectType: "", Date: "", Company: "" }));
  }, []);

  const handleSelectTypeChange = useCallback((e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, SelectType: val, Date: val === "Festival" ? p.Date : "" }));
  }, []);

  const selectTypeOptions = useMemo(() => getSelectTypes(form.MainType), [form.MainType]);
  const isFestival = form.SelectType === "Festival";

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.MainType || !form.SelectType) { setError("Main Type and Select Type are required."); return; }
    if (!form.Showcase_url) { setError("Showcase URL is required."); return; }
    setLoading(true); setError(null);
    try {
      const cleanGraphics = form.GraphicsLink.map(({ _key, ...rest }) => ({
        ...rest, id: Number(rest.id) || 0, bannerId: rest.bannerId || "", incmNameId: Number(rest.incmNameId) || 0,
      }));
      await addDoc(collection(db, COLLECTIONS.MLMTEMPLATE), {
        ...form, serial: Number(form.serial) || 0, GraphicsLink: cleanGraphics,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(() => navigate("/templates"), 1200);
    } catch (err) {
      console.error(err);
      setError("Failed to save template. Please try again.");
    } finally { setLoading(false); }
  }, [form, navigate]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/templates")} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Add Template</h1>
          <p className="text-sm text-gray-400 mt-0.5">Fill in the details to create a new template</p>
        </div>
      </div>

      {success && <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm"><CircleCheck className="w-4 h-4 flex-shrink-0" />Template created! Redirecting…</div>}
      {error   && <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm"><TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Type config */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1"><Folder className="w-4 h-4 text-violet-500" /><h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Type Configuration</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField label="Main Type"   value={form.MainType}   onChange={handleMainTypeChange}      options={MAIN_TYPES}       placeholder="Select main type…" required />
            <SelectField label="Select Type" value={form.SelectType} onChange={handleSelectTypeChange}    options={selectTypeOptions} placeholder={form.MainType ? "Select type…" : "Choose Main Type first"} required disabled={!form.MainType} />
          </div>

          {/* Subtype — free-text, always visible */}
          <TextField
            label="Subtype"
            value={form.Subtype || ""}
            onChange={handleText("Subtype")}
            placeholder="e.g. Diwali, Gold Pack, Morning Series…"
          />

          {/* Company — only when MainType === "MLM" */}
          {form.MainType === "MLM" && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Company</FieldLabel>
              <div className="relative">
                <select
                  value={form.Company || ""}
                  onChange={handleText("Company")}
                  disabled={companiesLoading}
                  className={`${selectCls} ${companiesLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <option value="">
                    {companiesLoading ? "Loading companies…" : "Select company…"}
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {companiesLoading && (
                <p className="text-xs text-violet-500 flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin inline-block" />
                  Fetching companies from Firestore…
                </p>
              )}
            </div>
          )}

          {/* Festival date — conditional */}
          {isFestival && (
            <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <FieldLabel required>Date of Festival</FieldLabel>
              <input type="date" value={form.Date || ""} onChange={handleText("Date")} required className={inputCls} />
              <p className="text-xs text-amber-600 dark:text-amber-400">Required for Festival type templates</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Serial Number" value={form.serial} onChange={handleText("serial")} placeholder="e.g. 1" type="number" />
            {!isFestival && <TextField label="Date" value={form.Date} onChange={handleText("Date")} type="date" />}
          </div>
        </div>

        {/* Showcase */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1"><Eye className="w-4 h-4 text-violet-500" /><h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Showcase Images</h2></div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Showcase Image URL</FieldLabel>
            <ImageUploadInput value={form.Showcase_url} onChange={setField("Showcase_url")} storagePath="templates/showcase" placeholder="Paste URL or click ↑ to upload showcase image" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Form Showcase Image URL</FieldLabel>
            <ImageUploadInput value={form.ShowCaseForm} onChange={setField("ShowCaseForm")} storagePath="templates/showcase-form" placeholder="Paste URL or click ↑ to upload form showcase image" />
            <p className="text-xs text-gray-400">Used as the in-app form background / preview image</p>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</h2>
          <ToggleSwitch label="Active" description="Template is visible and active" checked={form.Active} onChange={setField("Active")} />
          <ShowHideRadio value={form.Launched} onChange={setField("Launched")} />
        </div>

        {/* Graphics Links — passes selType so conditions work */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <GraphicsLinksField
            items={form.GraphicsLink}
            onChange={setField("GraphicsLink")}
            selType={form.SelectType}
          />
          <p className="text-xs text-gray-400 mt-3">
            Fields shown / hidden automatically based on <span className="font-medium text-violet-500">{form.SelectType || "Select Type"}</span>.
            All image fields support upload → auto WebP.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={() => navigate("/templates")} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button type="submit" disabled={loading || success} className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20 flex items-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? "Saving…" : "Save Template"}
          </button>
        </div>
      </form>
    </div>
  );
}
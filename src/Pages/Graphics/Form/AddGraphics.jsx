import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../Firebase";
import {
  ArrowLeft,
  CirclePlus,
  TrashBin,
  TriangleThunderbolt,
  CircleCheck,
  ChevronDown,
} from "@gravity-ui/icons";
import ImageUploadInput from "../../../Utils/Imageuploadinput";
import { COLLECTIONS } from "../../../collections";

// ── Constants ─────────────────────────────────────────────────────────────────
const GRAPHICS_TYPES = [
  "TopUplineFrames",
  "Gems",
  "Footers",
  "AchiverFrame",
  "other",
];

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all";

const selectCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all appearance-none cursor-pointer";

// ── Helpers ───────────────────────────────────────────────────────────────────
let _idCounter = Date.now();
const nextId   = () => ++_idCounter;
const emptyLink = () => ({ id: nextId(), value: "" });

const INITIAL_FORM = {
  GraphicName:   "",
  GraphicsType:  "",
  GraphicsLinks: [emptyLink()],
  Active:        true,
};

// ── Sub-components ────────────────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return (
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function ToggleSwitch({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none ${checked ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

// ── GraphicsLinks field ───────────────────────────────────────────────────────
function GraphicsLinksField({ items, onChange }) {
  const handleValueChange = useCallback(
    (id, url) => onChange(items.map((item) => (item.id === id ? { ...item, value: url } : item))),
    [items, onChange]
  );
  const handleAdd    = useCallback(() => onChange([...items, emptyLink()]), [items, onChange]);
  const handleRemove = useCallback((id) => onChange(items.filter((i) => i.id !== id)), [items, onChange]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <FieldLabel>
          Graphics Links{" "}
          <span className="text-xs text-gray-400 font-normal ml-1">({items.length})</span>
        </FieldLabel>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline"
        >
          <CirclePlus className="w-3.5 h-3.5" />
          Add Link
        </button>
      </div>

      {/* Rows */}
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-start gap-2">
            {/* Index + auto ID badge */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-2.5">
              <span className="min-w-[24px] h-6 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="text-[9px] text-gray-400 font-mono leading-none">
                #{item.id.toString().slice(-4)}
              </span>
            </div>

            {/* Upload input */}
            <div className="flex-1">
              <ImageUploadInput
                value={item.value}
                onChange={(url) => handleValueChange(item.id, url)}
                storagePath="graphics/links"
                placeholder="Paste URL or click ↑ to upload image"
              />
            </div>

            {/* Remove */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="mt-2.5 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
              >
                <TrashBin className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Filled count */}
      {items.some((i) => i.value.trim()) && (
        <p className="text-xs text-gray-400">
          {items.filter((i) => i.value.trim()).length} of {items.length} links filled
        </p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AddGraphics() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);

  const setField   = useCallback((key) => (val) => setForm((p) => ({ ...p, [key]: val })), []);
  const handleText = useCallback((key) => (e)   => setForm((p) => ({ ...p, [key]: e.target.value })), []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.GraphicName.trim()) { setError("Graphic name is required."); return; }
    if (!form.GraphicsType)       { setError("Graphics type is required."); return; }

    const filled = form.GraphicsLinks.filter((l) => l.value.trim());
    if (filled.length === 0)      { setError("At least one graphics link is required."); return; }

    setLoading(true); setError(null);
    try {
      await addDoc(collection(db, COLLECTIONS.MLMGRAPHICS), {
        GraphicName:  form.GraphicName.trim(),
        GraphicsType: form.GraphicsType,
        // Save only filled links, strip local id → use index+1 as final id
        GraphicsLinks: filled.map((l, i) => ({ id: i + 1, value: l.value })),
        Active:    form.Active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(() => navigate("/graphics"), 1200);
    } catch (err) {
      console.error(err);
      setError("Failed to save. Please try again.");
    } finally { setLoading(false); }
  }, [form, navigate]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/graphics")}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
            Add Graphics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Create a new graphics entry</p>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
          <CircleCheck className="w-4 h-4 flex-shrink-0" />
          Graphics created successfully! Redirecting…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Basic info */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Basic Information</h2>

          {/* Graphic Name */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Graphic Name</FieldLabel>
            <input
              type="text"
              value={form.GraphicName}
              onChange={handleText("GraphicName")}
              placeholder="e.g. Gold Frame Pack"
              required
              className={inputCls}
            />
          </div>

          {/* Graphics Type */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel required>Graphics Type</FieldLabel>
            <div className="relative">
              <select
                value={form.GraphicsType}
                onChange={handleText("GraphicsType")}
                required
                className={selectCls}
              >
                <option value="">Select type…</option>
                {GRAPHICS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <ToggleSwitch
            label="Active"
            description="This graphics entry will be visible in the app"
            checked={form.Active}
            onChange={setField("Active")}
          />
        </div>

        {/* Graphics Links */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <GraphicsLinksField
            items={form.GraphicsLinks}
            onChange={setField("GraphicsLinks")}
          />
          <p className="text-xs text-gray-400 mt-3">
            Paste a URL or click <span className="text-violet-500 font-medium">↑ Upload</span> — auto-converts to WebP &amp; saves to Storage.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => navigate("/graphics")}
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || success}
            className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20 flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? "Saving…" : "Save Graphics"}
          </button>
        </div>
      </form>
    </div>
  );
}
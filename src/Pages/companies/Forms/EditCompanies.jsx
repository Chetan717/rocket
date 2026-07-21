import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../Firebase";
import { useAdminDeleteGuard } from "../../../Utils/AdminDeleteGuard";
import {
  CirclePlus,
  TrashBin,
  ArrowLeft,
  Factory,
  TriangleThunderbolt,
  CircleCheck,
  ChevronDown,
  ChevronUp,
  CreditCard,
  PersonWorker,
  GraduationCap,
  Persons,
  Picture,
  Link as LinkIcon,
  ToggleOn,
} from "@gravity-ui/icons";
import ImageUploadInput from "../../../Utils/Imageuploadinput";

const DURATION_OPTIONS = [
  { name: "1 Month",   Day_value: 30      },
  { name: "3 Month",   Day_value: 91      },
  { name: "6 Month",   Day_value: 182     },
  { name: "1 Year",    Day_value: 365     },
  { name: "2 Year",    Day_value: 730     },
  { name: "3 Year",    Day_value: 1095    },
  { name: "Unlimited", Day_value: 1000000 },
];

const PLAN_TYPES = ["Basic", "Pro", "Standard", "Annual Plan", "Unlimited"];

const uid            = () => Math.random().toString(36).slice(2, 9);
const emptyLink      = () => ({ id: uid(), link: "", size: "" });
const emptyTopupLine = () => ({ id: uid(), name: "", link: "" });
const emptyProfile   = () => ({ id: uid(), profilename: "", profileimage: "" });
const emptyImgEntry  = () => ({ id: uid(), url: "" });
const emptyTraining  = () => ({ id: uid(), trainingname: "", images: [emptyImgEntry()] });
const emptyMeeting   = () => ({ id: uid(), meetingname:  "", images: [emptyImgEntry()] });
const emptyPlan      = () => ({
  _key: uid(), PlanName: "", PlanAmount: "", Duration: "", Day_value: "",
  Type: "", downloads: "", image_url: "", Launch: true, Description: "",
});

const normalisePlans = (arr) =>
  (arr || []).map((p) => ({
    _key: uid(), PlanName: p.PlanName || "", PlanAmount: p.PlanAmount ?? "",
    Duration: p.Duration || "", Day_value: p.Day_value ?? "", Type: p.Type || "",
    downloads: p.downloads ?? "", image_url: p.image_url || "",
    Launch: p.Launch ?? true, Description: p.Description || "",
  }));

const normaliseLinks = (arr) =>
  (arr || []).map((item) =>
    item?.link !== undefined ? { id: item.id || uid(), link: item.link, size: item.size || "" } : emptyLink()
  );

// Supports both old {link} format and new {name, link} format
const normaliseTopupLines = (arr) =>
  (arr || []).map((item) =>
    item?.link !== undefined
      ? { id: item.id || uid(), name: item.name || "", link: item.link }
      : emptyTopupLine()
  );

const normaliseProfiles = (arr) =>
  (arr || []).map((item) =>
    item?.profilename !== undefined ? { id: item.id || uid(), profilename: item.profilename, profileimage: item.profileimage || "" } : emptyProfile()
  );

const normaliseTrainings = (arr) =>
  (arr || []).filter(Boolean).map((item) => ({
    id: uid(),
    trainingname: item?.trainingname || "",
    images: Array.isArray(item?.trainingimages) && item.trainingimages.length
      ? item.trainingimages.filter(Boolean).map((url) => ({ id: uid(), url: typeof url === "string" ? url : "" }))
      : [emptyImgEntry()],
  }));

const normaliseMeetings = (arr) =>
  (arr || []).filter(Boolean).map((item) => ({
    id: uid(),
    meetingname: item?.meetingname || "",
    images: Array.isArray(item?.meetingimages) && item.meetingimages.length
      ? item.meetingimages.filter(Boolean).map((url) => ({ id: uid(), url: typeof url === "string" ? url : "" }))
      : [emptyImgEntry()],
  }));

const inputCls  = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all";
const selectCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all appearance-none cursor-pointer";

function FieldLabel({ children, required }) {
  return (
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function InputField({ label, id, value, onChange, placeholder, required }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input id={id} type="text" value={value} onChange={onChange} placeholder={placeholder} required={required} className={inputCls} />
    </div>
  );
}

// ── Collapsible section card (groups a chunk of the form) ─────────────────────
function SectionCard({ icon, title, subtitle, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>
        {badge != null && badge !== "" && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20 flex-shrink-0">
            {badge}
          </span>
        )}
        <span className="text-gray-400 flex-shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </div>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-800 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 ${checked ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function LinkArrayField({ label, items, onChange, storagePath }) {
  const handleFieldChange = useCallback((id, field, value) => onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item))), [items, onChange]);
  const handleAdd    = useCallback(() => onChange([...items, emptyLink()]), [items, onChange]);
  const handleRemove = useCallback((id) => onChange(items.filter((item) => item.id !== id)), [items, onChange]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <button type="button" onClick={handleAdd} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline">
          <CirclePlus className="w-3.5 h-3.5" />Add {label}
        </button>
      </div>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="mt-2.5 min-w-[22px] h-6 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
            <div className="flex-1 flex flex-col gap-2">
              <ImageUploadInput value={item.link} onChange={(url) => handleFieldChange(item.id, "link", url)} storagePath={storagePath} placeholder="Paste URL or click ↑ to upload image" />
              <div className="relative">
                <select
                  value={item.size || ""}
                  onChange={(e) => handleFieldChange(item.id, "size", e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select size…</option>
                  <option value="rectangle">Rectangle</option>
                  <option value="square">Square</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            {items.length > 1 && (
              <button type="button" onClick={() => handleRemove(item.id)} className="mt-2.5 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                <TrashBin className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Topup Line Field (name + link per entry) ──────────────────────────────────
function TopupLineField({ items, onChange }) {
  const handleChange = useCallback(
    (id, field, val) => onChange(items.map((item) => (item.id === id ? { ...item, [field]: val } : item))),
    [items, onChange]
  );
  const handleAdd    = useCallback(() => onChange([...items, emptyTopupLine()]), [items, onChange]);
  const handleRemove = useCallback((id) => onChange(items.filter((item) => item.id !== id)), [items, onChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Topup Line</label>
        <button type="button" onClick={handleAdd} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline">
          <CirclePlus className="w-3.5 h-3.5" />Add Topup Line
        </button>
      </div>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="mt-2.5 min-w-[22px] h-6 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
            <div className="flex-1 flex flex-col gap-2">
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleChange(item.id, "name", e.target.value)}
                placeholder="Topup line name…"
                className={inputCls}
              />
              <ImageUploadInput
                value={item.link}
                onChange={(url) => handleChange(item.id, "link", url)}
                storagePath="companies/topuplines"
                placeholder="Paste URL or click ↑ to upload image"
              />
            </div>
            {items.length > 1 && (
              <button type="button" onClick={() => handleRemove(item.id)} className="mt-2.5 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                <TrashBin className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function JobProfilesField({ items, onChange }) {
  const handleFieldChange = useCallback((id, field, value) => onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item))), [items, onChange]);
  const handleAdd    = useCallback(() => onChange([...items, emptyProfile()]), [items, onChange]);
  const handleRemove = useCallback((id) => onChange(items.filter((item) => item.id !== id)), [items, onChange]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Job Profiles</label>
        <button type="button" onClick={handleAdd} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline">
          <CirclePlus className="w-3.5 h-3.5" />Add Profile
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="mt-2.5 min-w-[22px] h-6 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
            <div className="flex-1 flex flex-col gap-2">
              <input type="text" value={item.profilename} onChange={(e) => handleFieldChange(item.id, "profilename", e.target.value)} placeholder="e.g. Sales Executive, Team Leader…"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all" />
              <ImageUploadInput
                value={item.profileimage || ""}
                onChange={(url) => handleFieldChange(item.id, "profileimage", url)}
                storagePath="companies/profiles"
                placeholder="Upload job profile image (auto-converts to WebP)…"
              />
            </div>
            {items.length > 1 && (
              <button type="button" onClick={() => handleRemove(item.id)} className="mt-2.5 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                <TrashBin className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {items.some((i) => i.profilename.trim()) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {items.filter((i) => i.profilename.trim()).map((i) => (
            <span key={i.id} className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-500/20">{i.profilename}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Multi-image sub-field (shared by Training & Meeting) ──────────────────────
function MultiImageSubField({ images, onChange, storagePath }) {
  const handleAdd    = useCallback(() => onChange([...images, emptyImgEntry()]), [images, onChange]);
  const handleRemove = useCallback((id) => onChange(images.filter((i) => i.id !== id)), [images, onChange]);
  const handleChange = useCallback((id, url) => onChange(images.map((i) => (i.id === id ? { ...i, url } : i))), [images, onChange]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Images</label>
        <button type="button" onClick={handleAdd} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline">
          <CirclePlus className="w-3 h-3" />Add Image
        </button>
      </div>
      <div className="space-y-2">
        {images.map((img, idx) => (
          <div key={img.id} className="flex items-start gap-2">
            <span className="mt-2.5 min-w-[18px] h-5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
            <div className="flex-1">
              <ImageUploadInput
                value={img.url}
                onChange={(url) => handleChange(img.id, url)}
                storagePath={storagePath}
                placeholder="Upload image (auto-converts to WebP)…"
              />
            </div>
            {images.length > 1 && (
              <button type="button" onClick={() => handleRemove(img.id)} className="mt-2.5 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                <TrashBin className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Training field ────────────────────────────────────────────────────────────
function TrainingField({ items, onChange }) {
  const handleFieldChange = useCallback((id, field, val) => onChange(items.map((t) => (t.id === id ? { ...t, [field]: val } : t))), [items, onChange]);
  const handleAdd    = useCallback(() => onChange([...items, emptyTraining()]), [items, onChange]);
  const handleRemove = useCallback((id) => onChange(items.filter((t) => t.id !== id)), [items, onChange]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Training</label>
        <button type="button" onClick={handleAdd} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline">
          <CirclePlus className="w-3.5 h-3.5" />Add Training
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60">
              <span className="min-w-[22px] h-6 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
              <input
                type="text"
                value={item.trainingname}
                onChange={(e) => handleFieldChange(item.id, "trainingname", e.target.value)}
                placeholder="Training name…"
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
              {items.length > 1 && (
                <button type="button" onClick={() => handleRemove(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                  <TrashBin className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="p-3">
              <MultiImageSubField
                images={item.images}
                onChange={(imgs) => handleFieldChange(item.id, "images", imgs)}
                storagePath="companies/training"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Meeting field ─────────────────────────────────────────────────────────────
function MeetingField({ items, onChange }) {
  const handleFieldChange = useCallback((id, field, val) => onChange(items.map((m) => (m.id === id ? { ...m, [field]: val } : m))), [items, onChange]);
  const handleAdd    = useCallback(() => onChange([...items, emptyMeeting()]), [items, onChange]);
  const handleRemove = useCallback((id) => onChange(items.filter((m) => m.id !== id)), [items, onChange]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Meetings</label>
        <button type="button" onClick={handleAdd} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline">
          <CirclePlus className="w-3.5 h-3.5" />Add Meeting
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60">
              <span className="min-w-[22px] h-6 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
              <input
                type="text"
                value={item.meetingname}
                onChange={(e) => handleFieldChange(item.id, "meetingname", e.target.value)}
                placeholder="Meeting name…"
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
              {items.length > 1 && (
                <button type="button" onClick={() => handleRemove(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                  <TrashBin className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="p-3">
              <MultiImageSubField
                images={item.images}
                onChange={(imgs) => handleFieldChange(item.id, "images", imgs)}
                storagePath="companies/meetings"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanRow({ plan, idx, total, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const update = useCallback((field, val) => onChange(plan._key, field, val), [plan._key, onChange]);
  const handleDurationChange = useCallback((e) => {
    const selected = DURATION_OPTIONS.find((d) => d.name === e.target.value);
    onChange(plan._key, "Duration",  selected?.name      || "");
    onChange(plan._key, "Day_value", selected?.Day_value ?? "");
  }, [plan._key, onChange]);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 cursor-pointer select-none" onClick={() => setOpen((p) => !p)}>
        <span className="min-w-[22px] h-6 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {plan.PlanName || `Plan ${idx + 1}`}
          {plan.PlanAmount && <span className="text-gray-400 ml-2 font-normal">₹{plan.PlanAmount}</span>}
        </span>
        {plan.Type && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20 flex-shrink-0">{plan.Type}</span>}
        {plan.Duration && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20 flex-shrink-0">{plan.Duration}</span>}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${plan.Launch ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"}`}>{plan.Launch ? "Time" : "No-Time"}</span>
        {total > 1 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(plan._key); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
            <TrashBin className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="text-gray-400 flex-shrink-0">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </div>
      {open && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5"><FieldLabel required>Plan Name</FieldLabel><input type="text" value={plan.PlanName} onChange={(e) => update("PlanName", e.target.value)} placeholder="e.g. Gold Plan…" className={inputCls} /></div>
            <div className="flex flex-col gap-1.5"><FieldLabel required>Plan Amount (₹)</FieldLabel><input type="number" value={plan.PlanAmount} onChange={(e) => update("PlanAmount", e.target.value)} placeholder="e.g. 999" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Duration</FieldLabel>
              <div className="relative">
                <select value={plan.Duration} onChange={handleDurationChange} className={selectCls}>
                  <option value="">Select duration…</option>
                  {DURATION_OPTIONS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {plan.Day_value !== "" && <p className="text-[11px] text-gray-400 flex items-center gap-1"><span className="text-violet-500 font-medium">{plan.Day_value}</span> days stored in DB</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Type</FieldLabel>
              <div className="relative">
                <select value={plan.Type} onChange={(e) => update("Type", e.target.value)} className={selectCls}>
                  <option value="">Select type…</option>
                  {PLAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5"><FieldLabel>Downloads</FieldLabel><input type="number" value={plan.downloads} onChange={(e) => update("downloads", e.target.value)} placeholder="e.g. 100" className={inputCls} /></div>
          <div className="flex flex-col gap-1.5"><FieldLabel>Plan Image</FieldLabel><ImageUploadInput value={plan.image_url} onChange={(url) => update("image_url", url)} storagePath="companies/plans" placeholder="Paste URL or click ↑ to upload" /></div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Launch</FieldLabel>
            <div className="flex items-center gap-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
              <label className="flex items-center gap-2 cursor-pointer">
                <span onClick={() => update("Launch", true)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${plan.Launch === true ? "border-violet-600 bg-violet-600" : "border-gray-300 dark:border-gray-600 hover:border-violet-400"}`}>
                  {plan.Launch === true && <span className="w-2 h-2 rounded-full bg-white block" />}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">Time</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span onClick={() => update("Launch", false)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${plan.Launch === false ? "border-red-500 bg-red-500" : "border-gray-300 dark:border-gray-600 hover:border-red-400"}`}>
                  {plan.Launch === false && <span className="w-2 h-2 rounded-full bg-white block" />}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">NO-Time</span>
              </label>
              <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${plan.Launch ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{plan.Launch ? "Active Time" : "No Time Limit"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5"><FieldLabel>Description</FieldLabel><textarea rows={3} value={plan.Description} onChange={(e) => update("Description", e.target.value)} placeholder="Describe what this plan includes…" className={`${inputCls} resize-none`} /></div>
        </div>
      )}
    </div>
  );
}

function PlansField({ items, onChange }) {
  const handleFieldChange = useCallback((key, field, val) => { onChange(items.map((p) => (p._key === key ? { ...p, [field]: val } : p))); }, [items, onChange]);
  const handleAdd    = useCallback(() => onChange([...items, emptyPlan()]), [items, onChange]);
  const handleRemove = useCallback((key) => onChange(items.filter((p) => p._key !== key)), [items, onChange]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-violet-500" /><h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Plans <span className="text-xs text-gray-400 font-normal ml-1">({items.length})</span></h2></div>
        <button type="button" onClick={handleAdd} className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline"><CirclePlus className="w-3.5 h-3.5" />Add Plan</button>
      </div>
      <div className="space-y-2">{items.map((plan, idx) => <PlanRow key={plan._key} plan={plan} idx={idx} total={items.length} onChange={handleFieldChange} onRemove={handleRemove} />)}</div>
    </div>
  );
}

function DeleteModal({ companyName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 max-w-sm w-full z-10">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4"><TrashBin className="w-6 h-6 text-red-500" /></div>
        <h3 className="text-center font-bold text-gray-900 dark:text-white text-lg mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Delete Company?</h3>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6"><span className="font-semibold text-gray-700 dark:text-gray-300">"{companyName}"</span> will be permanently deleted.</p>
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

export default function EditCompanies() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [form,          setForm]          = useState(null);
  const [fetchLoading,  setFetchLoading]  = useState(true);
  const [saveLoading,   setSaveLoading]   = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDelete,    setShowDelete]    = useState(false);
  const [error,         setError]         = useState(null);
  const [success,       setSuccess]       = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setFetchLoading(true); setError(null);
      try {
        const snap = await getDoc(doc(db, "mlmcomp", id));
        if (!snap.exists()) { setError("Company not found."); return; }
        const d = snap.data();
        if (!cancelled) {
          setForm({
            name: d.name || "", address: d.address || "", owner: d.owner || "", designation: d.designation || "",
            logos:      normaliseLinks(d.logos).length          ? normaliseLinks(d.logos)          : [emptyLink()],
            topuplines: normaliseTopupLines(d.topuplines).length ? normaliseTopupLines(d.topuplines) : [emptyTopupLine()],
            Plans:      normalisePlans(d.Plans).length          ? normalisePlans(d.Plans)          : [emptyPlan()],
            profile:    normaliseProfiles(d.profile).length     ? normaliseProfiles(d.profile)     : [emptyProfile()],
            active: d.active ?? false, launched: d.launched ?? false,
            trainings: normaliseTrainings(d.trainings).length ? normaliseTrainings(d.trainings) : [emptyTraining()],
            meetings:  normaliseMeetings(d.meetings).length  ? normaliseMeetings(d.meetings)  : [emptyMeeting()],
          });
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load company. Please go back and try again.");
      } finally { if (!cancelled) setFetchLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const setField   = useCallback((key) => (value) => setForm((prev) => ({ ...prev, [key]: value })), []);
  const handleText = useCallback((key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })), []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form?.name?.trim()) { setError("Company name is required."); return; }
    setSaveLoading(true); setError(null);
    try {
      const cleanPlans = form.Plans.map(({ _key, ...rest }) => ({
        ...rest, PlanAmount: Number(rest.PlanAmount) || 0, downloads: Number(rest.downloads) || 0, Day_value: Number(rest.Day_value) || 0,
      }));
      await updateDoc(doc(db, "mlmcomp", id), {
        ...form,
        name: form.name.trim(), address: form.address.trim(), owner: form.owner.trim(), designation: form.designation.trim(),
        logos:      form.logos.filter((l) => l.link.trim()).map(({ link, size }) => ({ link, size: size || "" })),
        topuplines: form.topuplines.filter((t) => t.name.trim() || t.link.trim()).map((t) => ({ name: t.name.trim(), link: t.link.trim() })),
        Plans:      cleanPlans,
        profile:    form.profile.filter((p) => p.profilename.trim()).map(({ id: _id, ...p }) => ({ profilename: p.profilename.trim(), profileimage: p.profileimage || "" })),
        trainings:  form.trainings.filter((t) => t.trainingname.trim() || t.images.some((i) => i.url.trim())).map(({ id: _id, ...t }) => ({ trainingname: t.trainingname.trim(), trainingimages: t.images.filter((i) => i.url.trim()).map((i) => i.url) })),
        meetings:   form.meetings.filter((m) => m.meetingname.trim() || m.images.some((i) => i.url.trim())).map(({ id: _id, ...m }) => ({ meetingname: m.meetingname.trim(), meetingimages: m.images.filter((i) => i.url.trim()).map((i) => i.url) })),
        updatedAt:  serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(() => navigate("/companies"), 1200);
    } catch (err) { console.error(err); setError("Failed to update company. Please try again."); }
    finally { setSaveLoading(false); }
  }, [form, id, navigate]);

  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const handleDelete = useCallback(() => {
    requestDelete(async () => {
      setDeleteLoading(true);
      try { await deleteDoc(doc(db, "mlmcomp", id)); navigate("/companies"); }
      catch (err) { console.error(err); setError("Delete failed."); setShowDelete(false); }
      finally { setDeleteLoading(false); }
    });
  }, [id, navigate, requestDelete]);

  if (fetchLoading) return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
    </div>
  );

  if (error && !form) return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
        <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />{error}
      </div>
    </div>
  );

  return (
    <>
      {showDelete && <DeleteModal companyName={form?.name || "this company"} onConfirm={handleDelete} onCancel={() => setShowDelete(false)} loading={deleteLoading} />}
      {DeleteAuthModal}
      {BlockedToast}
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/companies")} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>Edit Company</h1>
              <p className="text-sm text-gray-400 dark:text-gray-500 truncate max-w-xs">{form?.name || ""}</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowDelete(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-500 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
            <TrashBin className="w-4 h-4" /><span className="hidden sm:inline">Delete Company</span>
          </button>
        </div>

        {success && <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm"><CircleCheck className="w-4 h-4 flex-shrink-0" />Company updated successfully! Redirecting…</div>}
        {error && <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm"><TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />{error}</div>}

        {form && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <SectionCard icon={<Factory className="w-4 h-4" />} title="Basic Information" subtitle="Name, address & owner details" defaultOpen>
              <InputField label="Company Name" id="name" value={form.name} onChange={handleText("name")} placeholder="e.g. Vestige Marketing" required />
              <InputField label="Address" id="address" value={form.address} onChange={handleText("address")} placeholder="e.g. 123 Main Street, Mumbai" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Owner" id="owner" value={form.owner} onChange={handleText("owner")} placeholder="Owner full name" />
                <InputField label="Designation" id="designation" value={form.designation} onChange={handleText("designation")} placeholder="e.g. CEO / Founder" />
              </div>
            </SectionCard>
            <SectionCard icon={<PersonWorker className="w-4 h-4" />} title="Job Profiles" subtitle="Roles & designations offered" badge={form.profile.filter((p) => p.profilename.trim()).length || undefined}>
              <JobProfilesField items={form.profile} onChange={setField("profile")} />
              <p className="text-xs text-gray-400 pt-2">Add all job roles / designations available in this company.</p>
            </SectionCard>
            <SectionCard icon={<GraduationCap className="w-4 h-4" />} title="Training" subtitle="Training sessions & images" badge={form.trainings.length || undefined}>
              <TrainingField items={form.trainings} onChange={setField("trainings")} />
              <p className="text-xs text-gray-400 pt-2">Add training sessions with their promotional images.</p>
            </SectionCard>
            <SectionCard icon={<Persons className="w-4 h-4" />} title="Meetings" subtitle="Meeting sessions & images" badge={form.meetings.length || undefined}>
              <MeetingField items={form.meetings} onChange={setField("meetings")} />
              <p className="text-xs text-gray-400 pt-2">Add meeting sessions with their promotional images.</p>
            </SectionCard>
            <SectionCard icon={<CreditCard className="w-4 h-4" />} title="Plans" subtitle="Subscription plans for customers" badge={form.Plans.length || undefined}>
              <PlansField items={form.Plans} onChange={setField("Plans")} />
              <p className="text-xs text-gray-400 mt-3">Subscription plans for customers. Duration <span className="text-violet-500 font-medium">Day_value</span> is auto-saved to Firestore.</p>
            </SectionCard>
            <SectionCard icon={<Picture className="w-4 h-4" />} title="Logos" subtitle="Brand logo images" badge={form.logos.filter((l) => l.link.trim()).length || undefined}>
              <LinkArrayField label="Logo" items={form.logos} onChange={setField("logos")} storagePath="companies/logos" />
              <p className="text-xs text-gray-400 pt-1">Paste public image URLs. A preview appears instantly beside each input.</p>
            </SectionCard>
            <SectionCard icon={<LinkIcon className="w-4 h-4" />} title="Topup Lines" subtitle="Referral / topup image links" badge={form.topuplines.filter((t) => t.name.trim() || t.link.trim()).length || undefined}>
              <TopupLineField items={form.topuplines} onChange={setField("topuplines")} />
              <p className="text-xs text-gray-400 pt-1">Add topup / referral image links for this company. Each entry saves a name and link.</p>
            </SectionCard>
            <SectionCard icon={<ToggleOn className="w-4 h-4" />} title="Status" subtitle="Visibility & launch state">
              <ToggleSwitch label="Active"   description="Company is currently active and visible"     checked={form.active}   onChange={setField("active")} />
              <ToggleSwitch label="Launched" description="Company has officially launched its program" checked={form.launched} onChange={setField("launched")} />
            </SectionCard>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={() => navigate("/companies")} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
              <button type="submit" disabled={saveLoading || success} className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20 flex items-center gap-2">
                {saveLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saveLoading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
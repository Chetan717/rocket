import { useState, useCallback } from "react";
import {
  TrashBin,
  ChevronDown,
  ChevronUp,
  CirclePlus,
} from "@gravity-ui/icons";
import ImageUploadInput from "../../Utils/Imageuploadinput";
import VideoUploadInput from "../../Utils/VideoUploadInput";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";
import {
  POSITION_OPTIONS,
  emptyGraphicsLink,
  getFilterOptions,
} from "./Constant";

// ── Style constants ───────────────────────────────────────────────────────────
export const selectCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all appearance-none cursor-pointer";
export const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all";

export function FieldLabel({ children, required }) {
  return (
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {children} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

// ── Condition helpers — mirrors old GraphicsLinkSingle logic exactly ──────────
// selType === 'Achievements' || 'Achievements-B'  →  show nameImageUrl
const isAchievement = (t) =>
  t === "Achievements" || t === "Achievements_B" ;
const isIncome = (t) => t === "Income";

// show "Upload Rank Name Image" only for Rank Promotion
const isRankPromotion = (t) => t === "Rank_Promotion";

// hide bannerId for these types
const HIDE_BANNER = [
  "Festival",
  "Today_Trending",
  "ThankYou_Banner_B",
  "ThankYou_Banner",
  "Meeting",
];
const showBannerId = (t) => !HIDE_BANNER.includes(t);

// hide position for Festival + Achievements
const showPosition = (t) => ![""].includes(t);

// Filter options change for Meeting
const isMeeting = (t) => t === "Meeting";

// ── Small preview tile ────────────────────────────────────────────────────────
function PreviewTile({ src, label }) {
  const [ok, setOk] = useState(false);
  if (!src?.trim()) return null;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
        <img
          key={src}
          src={src}
          alt={label}
          onLoad={() => setOk(true)}
          onError={() => setOk(false)}
          className={`w-full h-full object-contain transition-opacity duration-200 ${ok ? "opacity-100" : "opacity-0"}`}
        />
        {!ok && (
          <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin" />
        )}
      </div>
      <p className="text-[10px] text-gray-400 text-center leading-tight max-w-[64px] truncate">
        {label}
      </p>
    </div>
  );
}

// ── Single row (accordion) ────────────────────────────────────────────────────
export function GraphicsLinkRow({
  item,
  idx,
  total,
  onChange,
  onRemove,
  selType,
  hasIssue,
}) {
  const [open, setOpen] = useState(idx === 0);
  const [pass, setPass] = useState(""); // password per-row, local state only
  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const update = useCallback(
    (field, val) => onChange(item._key, field, val),
    [item._key, onChange],
  );

  // ── Derived from selType ──────────────────────────────────────────────────
  const canShowNameImage = isAchievement(selType) || isIncome(selType);
  const canShowRankNameImage = isRankPromotion(selType);
  const canShowBannerId = showBannerId(selType);
  const canShowPosition = showPosition(selType);
  const filterOptions = getFilterOptions(selType);

  const nameImageLabel = isAchievement(selType)
    ? "Badge / Graphics For Achievement"
    : isIncome(selType)
      ? "Proof Frame for Income"
      : `${selType || "Type"} Graphic`;
  const bannerLabel = isAchievement(selType)
    ? "Add Frame For Middle Image"
    : isIncome(selType)
      ? "Add Badge Photo for Income"
      : "Add Badge For Image";
  const bannerPreviewLabel = isAchievement(selType)
    ? "Frame For Image"
    : isIncome(selType)
      ? "Badge Photo for Income"
      : "Badge For Image";

  return (
    <div className={`rounded-xl overflow-hidden ${hasIssue ? "border-2 border-red-400 dark:border-red-500" : "border border-gray-200 dark:border-gray-700"}`}>
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${hasIssue ? "bg-red-50 dark:bg-red-500/10" : "bg-gray-50 dark:bg-gray-800/60"}`}
        onClick={() => setOpen((p) => !p)}
      >
        <span className={`min-w-[22px] h-6 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${hasIssue ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" : "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400"}`}>
          {idx + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {`Graphics Link ${idx + 1}`}
        </span>
        {hasIssue && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Graphics Problem
          </span>
        )}
        {canShowPosition && item.position && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              item.position === "left"
                ? "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
            }`}
          >
            {item.position}
          </span>
        )}
        {item.Filter !== undefined && item.Filter !== "" && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {filterOptions.find((opt) => opt.value === item.Filter)?.name ||
              item.Filter}
          </span>
        )}

        <span className="text-gray-400 flex-shrink-0">
          {open ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </div>

      {/* Body */}
      {open && (
        <div className="p-4">
          <div className="flex gap-4">
            {/* ── Left: form fields ── */}
            <div className="flex-1 space-y-4 min-w-0">
              {/* Auto-generated ID — read-only display */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ID
                </span>
                <span className="text-sm font-mono font-semibold text-violet-600 dark:text-violet-400">
                  #{String(item.id)}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
                  (auto-generated)
                </span>
              </div>

              {/* Income Name ID — still editable */}
              {/* <div className="flex flex-col gap-1.5">
                <FieldLabel>Income Name ID</FieldLabel>
                <input type="number" value={String(item.incmNameId || "")} onChange={(e) => update("incmNameId", e.target.value)} className={inputCls} placeholder="e.g. 3" />
              </div> */}

              {/* Suggestion Image — always shown */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Suggestion Image URL</FieldLabel>
                <ImageUploadInput
                  value={item.suggestionImage || ""}
                  onChange={(v) => update("suggestionImage", v)}
                  storagePath="templates/suggestion"
                  placeholder="Paste URL or click ↑ to upload"
                />
              </div>

              {/* Background Image (url) — always shown */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel required>Background Image URL</FieldLabel>
                <ImageUploadInput
                  value={item.url || ""}
                  onChange={(v) => update("url", v)}
                  storagePath="templates/graphics"
                  placeholder="Paste URL or click ↑ to upload"
                />
                {item.suggestionImage?.trim() && (
                  <button
                    type="button"
                    onClick={() => update("url", item.suggestionImage)}
                    className="self-start px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-600 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-200 text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
                  >
                    Use suggestion image as background
                  </button>
                )}
                {item.suggestionImage?.trim() && !item.url?.trim() && (
                  <p className="text-xs text-gray-400">
                    Tip: Click above to reuse the suggestion image for the
                    background instead of uploading it again.
                  </p>
                )}
              </div>

              {/* Background Video URL — always shown, max 18s */}
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-sky-50/50 dark:bg-sky-500/5 border border-sky-100 dark:border-sky-500/20">
                <FieldLabel>Background Video URL</FieldLabel>
                <VideoUploadInput
                  value={item.backgroundVideoUrl || ""}
                  onChange={(v) => update("backgroundVideoUrl", v)}
                  storagePath="templates/graphics-videos"
                  placeholder="Paste video URL or click ↑ to upload (max 18s)"
                />
              </div>

              {/* nameImageUrl — ONLY Achievements / Achievements_B */}
              {canShowNameImage && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-violet-50/50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/20">
                  <FieldLabel>{nameImageLabel}</FieldLabel>
                  <ImageUploadInput
                    value={item.nameImageUrl || ""}
                    onChange={(v) => update("nameImageUrl", v)}
                    storagePath="templates/name-images"
                    placeholder="Paste URL or click ↑ to upload"
                  />
                </div>
              )}

              {/* rankNameImageUrl — ONLY Rank Promotion */}
              {canShowRankNameImage && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20">
                  <FieldLabel>Upload Rank Name Image</FieldLabel>
                  <ImageUploadInput
                    value={item.rankNameImageUrl || ""}
                    onChange={(v) => update("rankNameImageUrl", v)}
                    storagePath="templates/rank-name-images"
                    placeholder="Paste URL or click ↑ to upload rank name image"
                  />
                </div>
              )}

              {/* bannerId — hidden for Festival, Today_Trending, ThankYou_Banner_B, Meeting */}
              {canShowBannerId && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>{bannerLabel}</FieldLabel>
                  <ImageUploadInput
                    value={String(item.bannerId || "")}
                    onChange={(v) => update("bannerId", v)}
                    storagePath="templates/badges"
                    placeholder="Paste URL or click ↑ to upload"
                  />
                </div>
              )}

              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Date</FieldLabel>
                <input
                  type="date"
                  value={item.Date || ""}
                  onChange={(e) => update("Date", e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Position — hidden for Festival + Achievements */}
              {canShowPosition && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Image Placement</FieldLabel>
                  <div className="relative">
                    <select
                      value={item.position || "left"}
                      onChange={(e) => update("position", e.target.value)}
                      className={selectCls}
                    >
                      {POSITION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              )}

              {/* Filter — always shown, options change based on type */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>
                  Filter{" "}
                  {isMeeting(selType) && (
                    <span className="text-[11px] text-gray-400 font-normal">
                      (Host visibility)
                    </span>
                  )}
                  {selType === "Welcome_Closing" && (
                    <span className="text-[11px] text-gray-400 font-normal">
                      (Select campaign)
                    </span>
                  )}
                </FieldLabel>
                <div className="relative">
                  <select
                    value={item.Filter ?? "true"}
                    onChange={(e) => update("Filter", e.target.value)}
                    className={selectCls}
                  >
                    {filterOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Status / active */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Status</FieldLabel>
                <div className="relative">
                  <select
                    value={item.active ?? "true"}
                    onChange={(e) => update("active", e.target.value)}
                    className={selectCls}
                  >
                    <option value="true">Show</option>
                    <option value="false">Hide</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* ── Password-gated delete (pass === '5688') ── */}
              {/* {total > 1 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  {pass === "5688" ? ( */}
              <button
                type="button"
                onClick={() => requestDelete(() => onRemove(item._key))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                <TrashBin className="w-4 h-4" />
                Confirm Delete This Entry
              </button>
              {DeleteAuthModal}
              {BlockedToast}
              {/* ) : (
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel>Enter Password to Delete</FieldLabel>
                      <input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        placeholder="Enter password…"
                        className={inputCls}
                      />
                      {pass.length > 0 && pass !== "5688" && (
                        <p className="text-[11px] text-red-400">Incorrect password</p>
                      )}
                    </div>
                  )}
                </div>
              )} */}
            </div>

            {/* ── Right: image previews (mirrors right panel from old code) ── */}
            {/* <div className="flex-shrink-0 w-24 hidden sm:flex flex-col gap-3 pt-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Previews</p>
              <PreviewTile src={item.suggestionImage} label="Suggestion" />
              <PreviewTile src={item.url}             label="Background" />
              {canShowNameImage && <PreviewTile src={item.nameImageUrl}  label="Badge/Graphic" />}
              {canShowBannerId  && <PreviewTile src={String(item.bannerId || "")} label={bannerPreviewLabel} />}
            </div> */}
          </div>
        </div>
      )}
    </div>
  );
}

// ── GraphicsLinksField wrapper ────────────────────────────────────────────────
export function GraphicsLinksField({ items, onChange, selType, issueIndexSet }) {
  const handleFieldChange = useCallback(
    (key, field, val) =>
      onChange(
        items.map((item) =>
          item._key === key ? { ...item, [field]: val } : item,
        ),
      ),
    [items, onChange],
  );

  const handleAdd = useCallback(() => {
    onChange([
      ...items,
      {
        ...emptyGraphicsLink(),
        // Default position: Achievements → right (from old handleAdd)
        position: selType === "Achievements" ? "right" : "left",
      },
    ]);
  }, [items, onChange, selType]);

  const handleRemove = useCallback(
    (key) => onChange(items.filter((i) => i._key !== key)),
    [items, onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Graphics Links{" "}
          <span className="text-xs text-gray-400 ml-1">({items.length})</span>
        </label>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline"
        >
          <CirclePlus className="w-3.5 h-3.5" />
          Add Graphics Link
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <GraphicsLinkRow
            key={item._key}
            item={item}
            idx={idx}
            total={items.length}
            onChange={handleFieldChange}
            onRemove={handleRemove}
            selType={selType}
            hasIssue={issueIndexSet?.has(idx)}
          />
        ))}
      </div>
    </div>
  );
}

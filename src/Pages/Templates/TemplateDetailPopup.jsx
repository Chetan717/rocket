import { memo } from "react";
import { PencilToLine, ChevronRight } from "@gravity-ui/icons";

function IconQuality() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function typeBadge(mainType) {
  return mainType === "MLM"
    ? "bg-violet-50 text-violet-700 border border-violet-100"
    : "bg-sky-50 text-sky-700 border border-sky-100";
}

const TemplateDetailPopup = memo(function TemplateDetailPopup({
  template,
  onClose,
  onEdit,
  onQualityCheck,
  canOperation = true,
  canQuality   = true,
}) {
  if (!template) return null;

  const { serial, MainType, SelectType, Subtype, Date: tDate, GraphicsLink, Active, Launched } = template;
  const graphicsCount = (GraphicsLink || []).length;
  const title = `#${serial || "—"} · ${MainType || ""} / ${(SelectType || "").replace(/_/g, " ")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl w-full max-w-md z-10 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {MainType && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${typeBadge(MainType)}`}>
                    {MainType}
                  </span>
                )}
                {SelectType && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                    {SelectType.replace(/_/g, " ")}
                  </span>
                )}
                {Subtype && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                    {Subtype}
                  </span>
                )}
              </div>
              <p className="text-base font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                {title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            >
              ×
            </button>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            {tDate && <span>📅 {tDate}</span>}
            <span>🖼 {graphicsCount} graphic{graphicsCount !== 1 ? "s" : ""}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
              Active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${Active ? "bg-emerald-500" : "bg-gray-400"}`} />
              {Active ? "Active" : "Inactive"}
            </span>
            {Launched && (
              <span className="px-2 py-0.5 rounded-full font-semibold bg-violet-50 text-violet-600">
                Launched
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Select an action
          </p>

          {/* Template Operation — shown only if user has operation permission */}
          {canOperation && (
            <button
              onClick={onEdit}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-200 dark:group-hover:bg-violet-500/20 transition-colors">
                <PencilToLine className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Template Operation</p>
                <p className="text-xs text-gray-400 mt-0.5">Edit, update or delete this template</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-violet-500 transition-colors flex-shrink-0" />
            </button>
          )}

          {/* Quality Check — shown only if user has quality permission */}
          {canQuality && (
            <button
              onClick={onQualityCheck}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/20 transition-colors">
                <IconQuality />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Template Quality Check</p>
                <p className="text-xs text-gray-400 mt-0.5">Review graphics links — flag issues, track fixes</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
            </button>
          )}

          {!canOperation && !canQuality && (
            <p className="text-center text-sm text-gray-400 py-4">
              You do not have permission to perform any actions on this template.
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

export default TemplateDetailPopup;

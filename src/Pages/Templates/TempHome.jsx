import { memo, useMemo } from "react";
import { PencilToLine, TrashBin, Eye, Ellipsis } from "@gravity-ui/icons";

// ── Single template card ──────────────────────────────────────────────────────
const TemplateCard = memo(function TemplateCard({ tpl, onEdit, onDelete, isDeleting }) {
  const {
    id, serial, MainType, SelectType, Subtype, Active, Launched,
    Date: tplDate, GraphicsLink, Showcase_url,
  } = tpl;

  const graphicsCount = useMemo(() => (GraphicsLink || []).length, [GraphicsLink]);

  const mainTypeBadge = MainType === "MLM"
    ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20"
    : "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20";

  return (
    <div className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">

      {/* Showcase thumbnail */}
      <div className="relative h-28 bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden">
        {Showcase_url ? (
          <img
            src={Showcase_url}
            alt="showcase"
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Eye className="w-8 h-8 text-gray-300 dark:text-gray-600" />
          </div>
        )}

        {/* Serial badge */}
        {serial !== undefined && serial !== "" && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold">
            #{serial}
          </span>
        )}

        {/* Status dots */}
        <div className="absolute top-2 right-2 flex gap-1">
          <span className={`w-2 h-2 rounded-full ${Active ? "bg-emerald-400" : "bg-gray-400"}`} title={Active ? "Active" : "Inactive"} />
          {Launched && <span className="w-2 h-2 rounded-full bg-violet-400" title="Launched" />}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Type badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${mainTypeBadge}`}>
            {MainType}
          </span>
          {SelectType && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              {SelectType.replace(/_/g, " ")}
            </span>
          )}
          {Subtype && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20">
              {Subtype}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {tplDate && <span>{tplDate}</span>}
          {tplDate && graphicsCount > 0 && <span>·</span>}
          {graphicsCount > 0 && <span>{graphicsCount} graphic{graphicsCount !== 1 ? "s" : ""}</span>}
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            Active
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${Active ? "bg-emerald-500" : "bg-gray-400"}`} />
            {Active ? "Active" : "Inactive"}
          </span>
          {Launched && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
              Launched
            </span>
          )}
        </div>
      </div>

      {/* Actions footer */}
      <div className="flex items-center justify-end gap-1 px-4 pb-3 border-t border-gray-50 dark:border-gray-800 pt-3">
        <button
          onClick={() => onEdit(id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
        >
          <PencilToLine className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={() => onDelete(id)}
          disabled={isDeleting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {isDeleting
            ? <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin inline-block" />
            : <TrashBin className="w-3.5 h-3.5" />
          }
          Delete
        </button>
      </div>
    </div>
  );
});

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filtered }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center col-span-full">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Ellipsis className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-600 dark:text-gray-400 mb-1">
        {filtered ? "No templates match this filter" : "No templates found"}
      </h3>
      <p className="text-sm text-gray-400 dark:text-gray-500">
        {filtered ? "Try selecting a different type filter." : "Click Add Template to create your first one."}
      </p>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = useMemo(() => {
    const range = [];
    const delta = 2;
    for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
      range.push(i);
    }
    return range;
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Prev
      </button>

      {pages[0] > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="w-8 h-8 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">1</button>
          {pages[0] > 2 && <span className="text-gray-400 text-sm px-1">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
            p === currentPage
              ? "bg-violet-600 text-white shadow-sm shadow-violet-500/30"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="text-gray-400 text-sm px-1">…</span>}
          <button onClick={() => onPageChange(totalPages)} className="w-8 h-8 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{totalPages}</button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}

// ── List wrapper ──────────────────────────────────────────────────────────────
export default function Home({ templates, onEdit, onDelete, deletingId, filtered }) {
  if (templates.length === 0) {
    return (
      <div className="grid grid-cols-1">
        <EmptyState filtered={filtered} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {templates.map((tpl) => (
        <TemplateCard
          key={tpl.id}
          tpl={tpl}
          onEdit={onEdit}
          onDelete={onDelete}
          isDeleting={deletingId === tpl.id}
        />
      ))}
    </div>
  );
}
import { useState, useCallback, useMemo,useEffect } from "react";
import { useNavigate } from "react-router";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../../Firebase"
import { COLLECTIONS } from "../../collections";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";
import {
  CirclePlus,
  ArrowRotateRight,
  TriangleThunderbolt,
  PencilToLine,
  TrashBin,
  Magnifier,
  ChevronDown,
  Eye,
} from "@gravity-ui/icons";

import MusicTab from "./MusicTab";

function MusicNoteIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9Z" />
    </svg>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GRAPHICS_TYPES = [
  "TopUplineFrames",
  "Gems",
  "Footers",
  "AchiverFrame",
  "other",
];

const PAGE_SIZE = 12;

// Type badge colours
const TYPE_COLORS = {
  TopUplineFrames: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border-violet-100 dark:border-violet-500/20",
  Gems:           "bg-sky-50    text-sky-700    dark:bg-sky-500/10    dark:text-sky-400    border-sky-100    dark:border-sky-500/20",
  Footers:        "bg-amber-50  text-amber-700  dark:bg-amber-500/10  dark:text-amber-400  border-amber-100  dark:border-amber-500/20",
  AchiverFrame:   "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20",
  other:          "bg-gray-100  text-gray-600   dark:bg-gray-800      dark:text-gray-400   border-gray-200   dark:border-gray-700",
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="flex gap-2">
          <div className="h-7 w-14 rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-7 w-16 rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

// ── Single image preview tile ─────────────────────────────────────────────────
function ImgTile({ src }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="relative h-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center">
      {src ? (
        <>
          <img
            key={src}
            src={src}
            alt=""
            onLoad={() => setOk(true)}
            onError={() => setOk(false)}
            className={`w-full h-full object-contain transition-opacity duration-200 ${ok ? "opacity-100" : "opacity-0"}`}
          />
          {!ok && <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin absolute" />}
        </>
      ) : (
        <Eye className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      )}
    </div>
  );
}

// ── Single graphics card ──────────────────────────────────────────────────────
function GraphicsCard({ item, onEdit, onDelete, isDeleting }) {
  const { id, GraphicName, GraphicsType, GraphicsLinks, Active } = item;
  const links = GraphicsLinks || [];
  const preview = links.slice(0, 4);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">

      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <h3
          className="font-semibold text-gray-900 dark:text-white text-sm truncate"
          style={{ fontFamily: "'Syne', sans-serif" }}
          title={GraphicName}
        >
          {GraphicName || "—"}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Type badge */}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_COLORS[GraphicsType] || TYPE_COLORS.other}`}>
            {GraphicsType || "—"}
          </span>
          {/* Active dot */}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${Active ? "bg-emerald-400" : "bg-gray-300 dark:bg-gray-600"}`} title={Active ? "Active" : "Inactive"} />
        </div>
      </div>

      {/* Image grid — up to 4 previews */}
      {preview.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5">
          {preview.map((l, i) => (
            <ImgTile key={i} src={l.value} />
          ))}
          {/* Overflow badge */}
          {links.length > 4 && (
            <div className="h-14 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-violet-600 dark:text-violet-400">+{links.length - 4}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-14 rounded-lg bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
          <p className="text-xs text-gray-400">No images</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50 dark:border-gray-800">
        <span className="text-xs text-gray-400">
          {links.length} link{links.length !== 1 ? "s" : ""}
          {" · "}
          <span className={Active ? "text-emerald-500" : "text-gray-400"}>
            {Active ? "Active" : "Inactive"}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
          >
            <PencilToLine className="w-3.5 h-3.5" />Edit
          </button>
          <button
            onClick={() => onDelete(id)}
            disabled={isDeleting}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {isDeleting
              ? <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin inline-block" />
              : <TrashBin className="w-3.5 h-3.5" />
            }
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ current, total, onChange }) {
  if (total <= 1) return null;
  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    pages.push(i);
  }
  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      <button onClick={() => onChange(current - 1)} disabled={current === 1}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        Prev
      </button>
      {pages[0] > 1 && (
        <>
          <button onClick={() => onChange(1)} className="w-8 h-8 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">1</button>
          {pages[0] > 2 && <span className="text-gray-400 text-sm px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${p === current ? "bg-violet-600 text-white shadow-sm shadow-violet-500/30" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < total && (
        <>
          {pages[pages.length - 1] < total - 1 && <span className="text-gray-400 text-sm px-1">…</span>}
          <button onClick={() => onChange(total)} className="w-8 h-8 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{total}</button>
        </>
      )}
      <button onClick={() => onChange(current + 1)} disabled={current === total}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        Next
      </button>
    </div>
  );
}

// ── Count stat ────────────────────────────────────────────────────────────────
function StatChip({ label, count, color }) {
  const c = {
    violet: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-500/20",
    sky:    "bg-sky-50    dark:bg-sky-500/10    text-sky-700    dark:text-sky-400    border-sky-100    dark:border-sky-500/20",
    gray:   "bg-gray-50   dark:bg-gray-800      text-gray-600   dark:text-gray-400   border-gray-200   dark:border-gray-700",
  };
  return (
    <div className={`px-4 py-3 rounded-2xl border flex flex-col items-center gap-0.5 ${c[color] || c.gray}`}>
      <span className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>{count}</span>
      <span className="text-[11px] font-medium opacity-80">{label}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GraphiHome() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("graphics"); // "graphics" | "music"

  const [allItems,   setAllItems]   = useState([]);
  const [fetched,    setFetched]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Filters
  const [filterType,  setFilterType]  = useState("");
  const [search,      setSearch]      = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchGraphics = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.MLMGRAPHICS));
      setAllItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFetched(true);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setError("Failed to load graphics. Please try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
        fetchGraphics()
      }, [fetchGraphics]);

  // ── Counts per type ───────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const total  = allItems.length;
    const active = allItems.filter((i) => i.Active).length;
    const byType = {};
    GRAPHICS_TYPES.forEach((t) => { byType[t] = allItems.filter((i) => i.GraphicsType === t).length; });
    return { total, active, byType };
  }, [allItems]);

  // ── Filtered + paginated ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allItems;
    if (filterType) list = list.filter((i) => i.GraphicsType === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          (i.GraphicName  || "").toLowerCase().includes(q) ||
          (i.GraphicsType || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allItems, filterType, search]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered]);
  const paginated  = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const handleFilterType = useCallback((val) => { setFilterType(val); setCurrentPage(1); }, []);
  const handleSearch     = useCallback((e)   => { setSearch(e.target.value); setCurrentPage(1); }, []);

  // ── Delete ────────────────────────────────────────────────────────────────
  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const handleDelete = useCallback((id) => {
    if (!window.confirm("Delete this graphics entry? This cannot be undone.")) return;
    requestDelete(async () => {
      setDeletingId(id);
      try {
        await deleteDoc(doc(db, "mlmgraphics", id));
        setAllItems((prev) => prev.filter((i) => i.id !== id));
      } catch (err) {
        console.error(err);
        alert("Delete failed. Please try again.");
      } finally { setDeletingId(null); }
    });
  }, [requestDelete]);

  const handleEdit = useCallback((id) => navigate(`/graphics/edit/${id}`), [navigate]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
            Graphics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage graphic assets — frames, gems, footers &amp; more</p>
        </div>
        {activeTab === "graphics" && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={fetchGraphics}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ArrowRotateRight className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              onClick={() => navigate("/graphics/add")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20"
            >
              <CirclePlus className="w-4 h-4" />
              Add Graphics
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("graphics")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === "graphics"
              ? "bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          <Eye className="w-4 h-4" />
          Add Graphics
        </button>
        <button
          onClick={() => setActiveTab("music")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === "music"
              ? "bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          <MusicNoteIcon className="w-4 h-4" />
          Add Music
        </button>
      </div>

      {/* ── Music Tab ── */}
      {activeTab === "music" && <MusicTab />}

      {/* ── Graphics Tab content ── */}
      {activeTab === "graphics" && (
        <>
          {/* ── Error ── */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />
              {error}
              <button onClick={fetchGraphics} className="ml-auto text-xs font-semibold underline underline-offset-2">Retry</button>
            </div>
          )}

          {/* ── Not fetched yet ── */}
          {!loading && !fetched && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mb-4">
                <Eye className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">No data loaded yet</h3>
              <p className="text-sm text-gray-400 max-w-xs">
                Click <span className="font-semibold text-violet-500">Fetch Graphics</span> to load from Firestore.
              </p>
            </div>
          )}

          {/* ── After fetch ── */}
          {fetched && (
            <>
              {/* Count chips */}
              <div className="flex flex-wrap gap-3">
                <StatChip label="Total"  count={counts.total}  color="gray"   />
                <StatChip label="Active" count={counts.active} color="violet" />
                {GRAPHICS_TYPES.map((t) => (
                  counts.byType[t] > 0 && (
                    <StatChip key={t} label={t} count={counts.byType[t]} color="sky" />
                  )
                ))}
              </div>

              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Magnifier className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={handleSearch}
                    placeholder="Search by name or type…"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all"
                  />
                </div>

                {/* Type filter */}
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => handleFilterType(e.target.value)}
                    className="pl-4 pr-9 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">All Types</option>
                    {GRAPHICS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>

                {/* Result count */}
                <span className="text-sm text-gray-400 flex-shrink-0">
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                  {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
                </span>
              </div>
            </>
          )}

          {/* ── Loading skeletons ── */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(PAGE_SIZE)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* ── Empty filtered ── */}
          {!loading && fetched && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-base font-semibold text-gray-500 dark:text-gray-400 mb-1">No graphics found</p>
              <p className="text-sm text-gray-400">
                {filterType || search ? "Try clearing filters." : "Click Add Graphics to create your first entry."}
              </p>
            </div>
          )}

          {/* ── Grid ── */}
          {!loading && fetched && paginated.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginated.map((item) => (
                  <GraphicsCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isDeleting={deletingId === item.id}
                  />
                ))}
              </div>

              <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />
            </>
          )}
        </>
      )}
      {DeleteAuthModal}
      {BlockedToast}
    </div>
  );
}
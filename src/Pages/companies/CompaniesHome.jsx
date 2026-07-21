import { useState, useCallback,useEffect } from "react";
import { useNavigate } from "react-router";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import ListOfCompanie from "./ListOfCompanie";
// import {
//   Plus,
//   ArrowRotateRight,
//   Buildings,
//   TriangleExclamationFill,
// } from "@gravity-ui/icons";
import { db } from "../../../Firebase";
import { COLLECTIONS } from "../../collections";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";

export default function CompaniesHome() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [fetched, setFetched] = useState(false); // has user fetched yet?
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // ── Fetch (only when user clicks) ───────────────────────────────────────
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.MLMCOMP));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCompanies(data);
      setFetched(true);
    } catch (err) {
      console.error(err);
      setError("Failed to load companies. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const handleDelete = useCallback((id) => {
    if (!window.confirm("Delete this company? This cannot be undone.")) return;
    requestDelete(async () => {
      setDeletingId(id);
      try {
        await deleteDoc(doc(db, "mlmcomp", id));
        setCompanies((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        console.error(err);
        alert("Delete failed. Please try again.");
      } finally {
        setDeletingId(null);
      }
    });
  }, [requestDelete]);

  // ── Edit navigate ────────────────────────────────────────────────────────
  const handleEdit = useCallback(
    (id) => navigate(`/companies/edit/${id}`),
    [navigate],
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900 dark:text-white"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Companies
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            Manage your MLM company listings
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Add button */}
          <button
            onClick={() => navigate("/companies/add")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20"
          >
            {/* <Plus className="w-4 h-4" /> */}
            Add Company
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {/* <TriangleExclamationFill className="w-4 h-4 flex-shrink-0" /> */}
          {error}
        </div>
      )}

      {/* ── Empty / not-fetched state ── */}
      {!loading && !fetched && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mb-4">
            {/* <Buildings className="w-8 h-8 text-violet-400" /> */}
          </div>
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            No data loaded yet
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
            Click{" "}
            <span className="font-semibold text-violet-500">
              Fetch Companies
            </span>{" "}
            to load your data from Firestore.
          </p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── List ── */}
      {!loading && fetched && (
        <ListOfCompanie
          companies={companies}
          onEdit={handleEdit}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}
      {DeleteAuthModal}
      {BlockedToast}
    </div>
  );
}

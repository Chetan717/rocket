import { useState, useCallback, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../Firebase";
import { COLLECTIONS } from "../../collections";
import VideoUploadInput from "../../Utils/VideoUploadInput";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";
import {
  CirclePlus,
  TrashBin,
  PencilToLine,
  TriangleThunderbolt,
  CircleCheck,
  ArrowRotateRight,
} from "@gravity-ui/icons";

function MusicNoteIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9Z" />
    </svg>
  );
}

function CloseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all";

function FieldLabel({ children, required }) {
  return (
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none flex-shrink-0 ${
        checked ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

const EMPTY_FORM = { Name_Music: "", Url: "", Active: true };

function MusicModal({ initial, onSave, onClose, saving, error }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const isEdit = !!initial?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 max-w-md w-full z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h3
            className="font-bold text-gray-900 dark:text-white text-lg"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {isEdit ? "Edit Music" : "Add Music"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
            <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <FieldLabel required>Music Name</FieldLabel>
          <input
            type="text"
            value={form.Name_Music}
            onChange={(e) => setForm((p) => ({ ...p, Name_Music: e.target.value }))}
            placeholder="e.g. Background Beat"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel required>Audio File (max 18s)</FieldLabel>
          <VideoUploadInput
            value={form.Url}
            onChange={(url) => setForm((p) => ({ ...p, Url: url }))}
            storagePath="music/audio"
            placeholder="Paste audio URL or click ↑ to upload"
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Active</p>
            <p className="text-xs text-gray-400 mt-0.5">Make this audio available in the app</p>
          </div>
          <ToggleSwitch
            checked={form.Active}
            onChange={(val) => setForm((p) => ({ ...p, Active: val }))}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Music"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ name, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 max-w-sm w-full z-10">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <TrashBin className="w-6 h-6 text-red-500" />
        </div>
        <h3
          className="text-center font-bold text-gray-900 dark:text-white text-lg mb-1"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          Delete Music?
        </h3>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            "{name}"
          </span>{" "}
          will be permanently deleted.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {loading ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MusicCard({ item, onEdit, onDelete, isDeleting }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <MusicNoteIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <h3
            className="font-semibold text-gray-900 dark:text-white text-sm truncate"
            style={{ fontFamily: "'Syne', sans-serif" }}
            title={item.Name_Music}
          >
            {item.Name_Music || "—"}
          </h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
            item.Active
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {item.Active ? "Active" : "Inactive"}
        </span>
      </div>

      {item.Url && (
        <audio
          src={item.Url}
          controls
          className="w-full h-8"
          style={{ height: "32px" }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}

      <div className="flex items-center justify-end gap-1 pt-1 border-t border-gray-50 dark:border-gray-800">
        <button
          onClick={() => onEdit(item)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
        >
          <PencilToLine className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={() => onDelete(item)}
          disabled={isDeleting}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {isDeleting ? (
            <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin inline-block" />
          ) : (
            <TrashBin className="w-3.5 h-3.5" />
          )}
          Delete
        </button>
      </div>
    </div>
  );
}

export default function MusicTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [successMsg, setSuccessMsg] = useState(null);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const fetchMusic = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.MUSIC));
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFetched(true);
    } catch (err) {
      console.error(err);
      setFetchError("Failed to load music. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMusic();
  }, [fetchMusic]);

  const handleOpenAdd = () => {
    setEditItem(null);
    setSaveError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditItem(item);
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async (form) => {
    if (!form.Name_Music.trim()) {
      setSaveError("Music name is required.");
      return;
    }
    if (!form.Url.trim()) {
      setSaveError("Audio URL is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      if (editItem?.id) {
        await updateDoc(doc(db, COLLECTIONS.MUSIC, editItem.id), {
          Name_Music: form.Name_Music.trim(),
          Url: form.Url.trim(),
          Active: form.Active,
          updatedAt: serverTimestamp(),
        });
        setItems((prev) =>
          prev.map((i) =>
            i.id === editItem.id
              ? { ...i, Name_Music: form.Name_Music.trim(), Url: form.Url.trim(), Active: form.Active }
              : i
          )
        );
        showSuccess("Music updated successfully.");
      } else {
        const docRef = await addDoc(collection(db, COLLECTIONS.MUSIC), {
          Name_Music: form.Name_Music.trim(),
          Url: form.Url.trim(),
          Active: form.Active,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setItems((prev) => [
          ...prev,
          { id: docRef.id, Name_Music: form.Name_Music.trim(), Url: form.Url.trim(), Active: form.Active },
        ]);
        showSuccess("Music added successfully.");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    requestDelete(async () => {
      setDeletingId(target.id);
      try {
        await deleteDoc(doc(db, COLLECTIONS.MUSIC, target.id));
        setItems((prev) => prev.filter((i) => i.id !== target.id));
        showSuccess("Music deleted.");
      } catch (err) {
        console.error(err);
      } finally {
        setDeletingId(null);
        setDeleteTarget(null);
      }
    });
  };

  return (
    <>
      {modalOpen && (
        <MusicModal
          initial={editItem}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          saving={saving}
          error={saveError}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.Name_Music}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={!!deletingId}
        />
      )}
      {DeleteAuthModal}
      {BlockedToast}

      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-400">
              Manage background audio tracks (max 18s each)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchMusic}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-60"
            >
              <ArrowRotateRight className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-500/20"
            >
              <CirclePlus className="w-4 h-4" />
              Add Music
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
            <CircleCheck className="w-4 h-4 flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {fetchError && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
            <TriangleThunderbolt className="w-4 h-4 flex-shrink-0" />
            {fetchError}
            <button
              onClick={fetchMusic}
              className="ml-auto text-xs font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && fetched && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mb-4">
              <MusicNoteIcon className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
              No music yet
            </h3>
            <p className="text-sm text-gray-400">
              Click{" "}
              <span className="font-semibold text-violet-500">Add Music</span>{" "}
              to upload your first audio track.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((item) => (
              <MusicCard
                key={item.id}
                item={item}
                onEdit={handleOpenEdit}
                onDelete={setDeleteTarget}
                isDeleting={deletingId === item.id}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

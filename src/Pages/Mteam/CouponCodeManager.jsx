"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../Firebase";
import { COLLECTIONS } from "../../collections";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";

const ROWS_PER_PAGE = 8;

const EMPTY_FORM = {
  code:                        "",
  referCode:                   "",
  assigned_user:               null,
  user_discount:               "",
  marketing_member_percentage: "",
  active:                      "true",
};

function validate(form) {
  const e = {};
  if (!/^[A-Za-z0-9]{6}$/.test(form.code))
    e.code = "Must be exactly 6 alphanumeric characters";
  if (form.referCode !== "" && !/^[A-Za-z0-9]{6}$/.test(form.referCode))
    e.referCode = "Must be exactly 6 alphanumeric characters (or leave blank)";
  if (!form.assigned_user)
    e.assigned_user = "Please select a member";
  const disc = Number(form.user_discount);
  if (form.user_discount === "" || isNaN(disc) || disc < 0 || disc > 100)
    e.user_discount = "Enter a number 0–100";
  const mkt = Number(form.marketing_member_percentage);
  if (form.marketing_member_percentage === "" || isNaN(mkt) || mkt < 0 || mkt > 100)
    e.marketing_member_percentage = "Enter a number 0–100";
  return e;
}

const PlusIcon    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
const EditIcon    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z"/></svg>;
const TrashIcon   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16"/></svg>;
const SaveIcon    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
const CancelIcon  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
const TicketIcon  = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>;
const ChevronIcon = () => <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>;
const SpinnerIcon = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>
);

function TextInput({ value, onChange, placeholder, maxLength, type = "text", min, max, error, className = "" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        className={`px-3 py-1.5 text-sm rounded-lg border transition focus:outline-none focus:ring-2 ${
          error
            ? "border-red-400 bg-red-50 focus:ring-red-300 dark:bg-red-900/20 dark:border-red-500"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-indigo-300"
        } text-gray-800 dark:text-gray-100 placeholder-gray-400 ${className}`}
      />
      {error && <p className="text-xs text-red-500 px-0.5">{error}</p>}
    </div>
  );
}

function MemberSelect({ mteam, value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-col gap-0.5" ref={ref}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center justify-between w-52 px-3 py-1.5 text-sm rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
            error
              ? "border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-500"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          }`}
        >
          {value ? (
            <span className="flex flex-col items-start leading-tight">
              <span className="font-medium text-gray-800 dark:text-gray-100">{value.name}</span>
              <span className="text-xs text-gray-400">{value.mobile}</span>
            </span>
          ) : (
            <span className="text-gray-400">Select member</span>
          )}
          <ChevronIcon />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-52 overflow-y-auto">
            {mteam.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400 italic">No members found</p>
            )}
            {mteam.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange({ id: m.id, name: m.name, mobile: m.mobile }); setOpen(false); }}
                className={`w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition flex flex-col ${
                  value?.id === m.id ? "bg-indigo-50 dark:bg-indigo-900/40" : ""
                }`}
              >
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{m.name}</span>
                <span className="text-xs text-gray-400">{m.mobile}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 px-0.5">{error}</p>}
    </div>
  );
}

function StatusToggle({ value, onChange }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 w-fit text-xs font-semibold">
      <button
        type="button"
        onClick={() => onChange("true")}
        className={`px-3 py-1.5 transition ${
          value === "true"
            ? "bg-green-500 text-white"
            : "bg-white dark:bg-gray-800 text-gray-500 hover:bg-green-50"
        }`}
      >
        ● Active
      </button>
      <button
        type="button"
        onClick={() => onChange("false")}
        className={`px-3 py-1.5 transition border-l border-gray-200 dark:border-gray-700 ${
          value === "false"
            ? "bg-red-500 text-white"
            : "bg-white dark:bg-gray-800 text-gray-500 hover:bg-red-50"
        }`}
      >
        ● Inactive
      </button>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      active
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-red-500"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-500"><TrashIcon /></div>
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ form, errors, mteam, saving, setField, onSave, onCancel }) {
  return (
    <tr className="bg-indigo-50/60 dark:bg-indigo-900/10">
      <td className="px-4 py-3">
        <TextInput
          value={form.code}
          onChange={(e) => setField("code", e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          error={errors.code}
          className="w-28 font-mono tracking-widest font-bold"
        />
      </td>

      <td className="px-4 py-3">
        <TextInput
          value={form.referCode}
          onChange={(e) => setField("referCode", e.target.value.toUpperCase())}
          placeholder="REF001"
          maxLength={6}
          error={errors.referCode}
          className="w-28 font-mono tracking-widest font-bold"
        />
      </td>

      <td className="px-4 py-3">
        <MemberSelect
          mteam={mteam}
          value={form.assigned_user}
          onChange={(v) => setField("assigned_user", v)}
          error={errors.assigned_user}
        />
      </td>

      <td className="px-4 py-3">
        <div className="flex items-start gap-1">
          <TextInput
            type="number"
            value={form.user_discount}
            onChange={(e) => setField("user_discount", e.target.value)}
            placeholder="0"
            min={0}
            max={100}
            error={errors.user_discount}
            className="w-20"
          />
          <span className="text-sm text-gray-400 mt-1.5">%</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-start gap-1">
          <TextInput
            type="number"
            value={form.marketing_member_percentage}
            onChange={(e) => setField("marketing_member_percentage", e.target.value)}
            placeholder="0"
            min={0}
            max={100}
            error={errors.marketing_member_percentage}
            className="w-20"
          />
          <span className="text-sm text-gray-400 mt-1.5">%</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <StatusToggle value={form.active} onChange={(v) => setField("active", v)} />
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? <SpinnerIcon /> : <SaveIcon />}
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-600 dark:text-gray-300 text-sm font-medium transition disabled:opacity-50"
          >
            <CancelIcon />
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CouponCodeManager() {
  const [coupons,    setCoupons]    = useState([]);
  const [mteam,      setMteam]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmFor, setConfirmFor] = useState(null);

  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setFormState] = useState(EMPTY_FORM);
  const [errors,    setErrors]    = useState({});
  const [page,      setPage]      = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [couponSnap, mteamSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.COUPONCODE), orderBy("created_at", "desc"))),
        getDocs(collection(db, COLLECTIONS.MTEAM)),
      ]);
      setCoupons(couponSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMteam(mteamSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(coupons.length / ROWS_PER_PAGE));
  const paginated  = coupons.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const resetForm = useCallback(() => {
    setFormState(EMPTY_FORM);
    setErrors({});
    setAddingNew(false);
    setEditingId(null);
  }, []);

  const setField = useCallback((key, val) => {
    setFormState((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }, []);

  const startAdd = () => { resetForm(); setAddingNew(true); setPage(1); };

  const startEdit = (coupon) => {
    setAddingNew(false);
    setEditingId(coupon.id);
    setFormState({
      code:                        coupon.code ?? "",
      referCode:                   coupon.referCode ?? "",
      assigned_user:               coupon.assigned_user ?? null,
      user_discount:               String(coupon.user_discount ?? ""),
      marketing_member_percentage: String(coupon.marketing_member_percentage ?? ""),
      active:                      coupon.active === true ? "true" : "false",
    });
    setErrors({});
  };

  const handleSave = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        code:                        form.code.toUpperCase(),
        referCode:                   form.referCode.toUpperCase(),
        assigned_user:               form.assigned_user,
        user_discount:               Number(form.user_discount),
        marketing_member_percentage: Number(form.marketing_member_percentage),
        active:                      form.active === "true",
      };

      if (addingNew) {
        payload.created_at = serverTimestamp();
        const ref = await addDoc(collection(db, COLLECTIONS.COUPONCODE), payload);
        if (form.assigned_user?.id) {
          await updateDoc(doc(db, COLLECTIONS.MTEAM, form.assigned_user.id), {
            assign_coupon_id: ref.id,
            referCode: form.referCode.toUpperCase(),
          });
        }
      } else {
        await updateDoc(doc(db, COLLECTIONS.COUPONCODE, editingId), { ...payload, updated_at: serverTimestamp() });
        const oldCoupon = coupons.find((c) => c.id === editingId);
        const oldUid    = oldCoupon?.assigned_user?.id;
        const newUid    = form.assigned_user?.id;
        if (oldUid && oldUid !== newUid) {
          await updateDoc(doc(db, COLLECTIONS.MTEAM, oldUid), { assign_coupon_id: "", referCode: "" });
        }
        if (newUid) {
          await updateDoc(doc(db, COLLECTIONS.MTEAM, newUid), {
            assign_coupon_id: editingId,
            referCode: form.referCode.toUpperCase(),
          });
        }
      }

      await fetchData();
      resetForm();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const handleDelete = (coupon) => {
    setConfirmFor(null);
    requestDelete(async () => {
      setDeletingId(coupon.id);
      try {
        if (coupon.assigned_user?.id) {
          await updateDoc(doc(db, COLLECTIONS.MTEAM, coupon.assigned_user.id), { assign_coupon_id: "", referCode: "" });
        }
        await deleteDoc(doc(db, COLLECTIONS.COUPONCODE, coupon.id));
        await fetchData();
        setPage((p) => Math.min(p, Math.max(1, Math.ceil((coupons.length - 1) / ROWS_PER_PAGE))));
      } catch (err) {
        console.error("Delete error:", err);
      } finally {
        setDeletingId(null);
      }
    });
  };

  const pageNumbers = () => {
    const pages = [];
    const left  = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    pages.push(1);
    if (left > 2) pages.push("...");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  return (
    <div className="p-4 h-screen md:p-6">
      {confirmFor && (
        <ConfirmDialog
          message={`Delete coupon "${confirmFor.code}"? This cannot be undone.`}
          onConfirm={() => handleDelete(confirmFor)}
          onCancel={() => setConfirmFor(null)}
        />
      )}
      {DeleteAuthModal}
      {BlockedToast}

      <div className="bg-white h-full  dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <TicketIcon />
            </div>
            <div>
              <p className="text-base font-bold text-gray-800 dark:text-gray-100">Coupon Codes</p>
              <p className="text-xs text-gray-400">{coupons.length} coupon{coupons.length !== 1 ? "s" : ""} total</p>
            </div>
          </div>

          <button
            type="button"
            onClick={startAdd}
            disabled={addingNew || !!editingId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon />
            Add Coupon
          </button>
        </div>

        <div className="overflow-x-auto ">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                {["Coupon Code", "Refer Code", "Assigned Member", "User Discount", "Marketing %", "Status", "Actions"].map((col) => (
                  <th key={col} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">

              {addingNew && (
                <FormRow
                  key="__new__"
                  form={form}
                  errors={errors}
                  mteam={mteam}
                  saving={saving}
                  setField={setField}
                  onSave={handleSave}
                  onCancel={resetForm}
                />
              )}

              {loading && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <SpinnerIcon />
                      <span className="text-sm">Loading coupons…</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && !addingNew && coupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <TicketIcon />
                      <p className="text-sm font-medium">No coupon codes yet</p>
                      <p className="text-xs">Click "Add Coupon" to create the first one.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && paginated.map((coupon) =>
                editingId === coupon.id
                  ? (
                    <FormRow
                      key={coupon.id}
                      form={form}
                      errors={errors}
                      mteam={mteam}
                      saving={saving}
                      setField={setField}
                      onSave={handleSave}
                      onCancel={resetForm}
                    />
                  )
                  : (
                    <tr key={coupon.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold tracking-widest text-indigo-600 dark:text-indigo-400 text-sm bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg">
                          {coupon.code}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {coupon.referCode ? (
                          <span className="font-mono font-bold tracking-widest text-teal-600 dark:text-teal-400 text-sm bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1 rounded-lg">
                            {coupon.referCode}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs italic">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {coupon.assigned_user ? (
                          <div className="flex flex-col leading-snug">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{coupon.assigned_user.name}</span>
                            <span className="text-xs text-gray-400">{coupon.assigned_user.mobile}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs italic">Unassigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-200 dark:border-amber-700/30">
                          {coupon.user_discount ?? 0}%
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs font-semibold border border-purple-200 dark:border-purple-700/30">
                          {coupon.marketing_member_percentage ?? 0}%
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge active={coupon.active} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Edit coupon"
                            onClick={() => startEdit(coupon)}
                            disabled={!!editingId || addingNew}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            title="Delete coupon"
                            onClick={() => setConfirmFor(coupon)}
                            disabled={!!editingId || addingNew || deletingId === coupon.id}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {deletingId === coupon.id ? <SpinnerIcon /> : <TrashIcon />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
              )}
            </tbody>
          </table>
        </div>

        {!loading && coupons.length > ROWS_PER_PAGE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400">
              {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, coupons.length)} of {coupons.length}
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => { setPage((p) => Math.max(1, p - 1)); resetForm(); }}
                disabled={page === 1}
                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Prev
              </button>

              {pageNumbers().map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => { setPage(p); resetForm(); }}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                      page === p
                        ? "bg-indigo-600 border-indigo-600 text-white font-semibold"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); resetForm(); }}
                disabled={page === totalPages}
                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

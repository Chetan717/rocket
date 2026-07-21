import { useState, useEffect, useCallback, useMemo } from "react";

import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../../../Firebase";
import { COLLECTIONS } from "../../collections";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";

import {
  Button, Input, Switch, Chip,
  Tooltip, Spinner, Card, Table, Select,
} from "@heroui/react";

const COLLECTION   = COLLECTIONS.MTEAM;
const PAGE_OPTIONS = [5, 10, 20, 50];

const DEFAULT_FORM = {
  name: "", mobile: "", password: "",
  assign_coupon_id: "0", active: true,
};

// ── Validation ─────────────────────────────────────────────
const validate = (form) => {
  const e = {};
  if (!form.name.trim())               e.name             = "Required";
  if (!/^\d{10}$/.test(form.mobile))   e.mobile           = "10 digits";
  if (form.password.length < 6)        e.password         = "Min 6 chars";
  if (!form.assign_coupon_id.trim())   e.assign_coupon_id = "Required";
  return e;
};

// ── Icons ──────────────────────────────────────────────────
const IconAdd = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.5 19.213l-4.5 1.318 1.318-4.5L16.862 3.487z" />
  </svg>
);
const IconDelete = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107
         1.022.166m-1.022-.166L18.16 19.673A2.25 2.25 0 0115.916 21H8.084
         a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0
         00-3.478-.397m-12.56 0c.342.052.682.107 1.022.166m0 0a48.11 48.11
         0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964
         51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" />
  </svg>
);
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);
const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94
         3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112
         21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12
         0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995
         5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0
         003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0
         11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0
         014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
);
const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
  </svg>
);
const IconChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);
const IconChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// ── Shared inline-error cell ────────────────────────────────
function InlineCell({ error, children }) {
  return (
    <Table.Cell>
      <div className="flex flex-col gap-0.5">
        {children}
        {error && <p className="text-[10px] text-danger leading-tight px-0.5">{error}</p>}
      </div>
    </Table.Cell>
  );
}

// ── Inline input row (shared by Add & Edit) ─────────────────
function InputRow({ initial, accentClass, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = useCallback((field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => { const c = { ...p }; delete c[field]; return c; });
  }, []);

  const handleSave = useCallback(async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }, [form, onSave]);

  return (
    <Table.Row className={accentClass}>
      <InlineCell error={errors.name}>
        <Input size="sm" placeholder="Full Name" value={form.name}
          onChange={(e) => set("name", e.target.value)} className="min-w-[120px]" />
      </InlineCell>

      <InlineCell error={errors.mobile}>
        <Input size="sm" placeholder="Mobile" type="tel" maxLength={10}
          value={form.mobile}
          onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
          className="min-w-[110px]" />
      </InlineCell>

      <InlineCell error={errors.password}>
        <Input size="sm" placeholder="Password" type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          className="min-w-[110px]" />
      </InlineCell>

      <InlineCell error={errors.assign_coupon_id}>
        {/* <Input size="sm"  placeholder="Coupon ID"
          value={form.assign_coupon_id}
          // isDisabled={true}
          onChange={(e) => set("assign_coupon_id", e.target.value.toUpperCase())}
          className="min-w-[100px] font-mono" /> */}
      </InlineCell>

      <Table.Cell>
        <Switch isSelected={form.active} size="sm"
          onChange={(e) => set("active", e.target.checked)} />
      </Table.Cell>

      <Table.Cell>
        <div className="flex items-center gap-1">
          <Tooltip>
            <Tooltip.Trigger>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Save"
                className="text-success" onPress={handleSave} isPending={saving}>
                <IconCheck />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content><Tooltip.Arrow />Save</Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Tooltip.Trigger>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Cancel"
                className="text-muted" onPress={onCancel} isDisabled={saving}>
                <IconX />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content><Tooltip.Arrow />Cancel</Tooltip.Content>
          </Tooltip>
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

// ── Read-only row ───────────────────────────────────────────
const ReadOnlyRow = ({ user, onEdit, onDelete }) => (
  <Table.Row>
    <Table.Cell>
      <span className="font-semibold text-sm text-foreground">{user.name}</span>
    </Table.Cell>
    <Table.Cell>
      <span className="text-sm text-muted">{user.mobile}</span>
    </Table.Cell>
    <Table.Cell>
      <span className="text-sm text-muted tracking-widest">••••••</span>
    </Table.Cell>
    <Table.Cell>
      <Chip variant="warning" size="sm" className="font-mono font-semibold">
        {user.assign_coupon_id}
      </Chip>
    </Table.Cell>
    <Table.Cell>
      <Chip variant={user.active ? "success" : "danger"} size="sm">
        {user.active ? "Active" : "Inactive"}
      </Chip>
    </Table.Cell>
    <Table.Cell>
      <div className="flex items-center gap-1">
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Edit"
              className="text-accent" onPress={() => onEdit(user)}>
              <IconEdit />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content><Tooltip.Arrow />Edit</Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Delete"
              className="text-danger" onPress={() => onDelete(user)}>
              <IconDelete />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content><Tooltip.Arrow />Delete</Tooltip.Content>
        </Tooltip>
      </div>
    </Table.Cell>
  </Table.Row>
);

// ── Pagination bar ──────────────────────────────────────────
function Pagination({ page, totalPages, pageSize, onPage, onPageSize }) {
  // Show at most 5 page buttons with ellipsis
  const pages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
    if (page >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "…", page - 1, page, page + 1, "…", totalPages];
  }, [page, totalPages]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
      {/* Page-size selector */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Rows per page:</span>
        <div className="flex gap-1">
          {PAGE_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => onPageSize(n)}
              className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors
                ${pageSize === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-divider text-muted hover:border-primary/50 hover:text-foreground"
                }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        <Button isIconOnly size="sm" variant="ghost" aria-label="Previous page"
          onPress={() => onPage(page - 1)} isDisabled={page === 1}>
          <IconChevronLeft />
        </Button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted text-sm select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`w-8 h-8 rounded text-sm font-semibold transition-colors
                ${p === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-default/40 hover:text-foreground"
                }`}
            >
              {p}
            </button>
          )
        )}

        <Button isIconOnly size="sm" variant="ghost" aria-label="Next page"
          onPress={() => onPage(page + 1)} isDisabled={page === totalPages || totalPages === 0}>
          <IconChevronRight />
        </Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  MarketingTeam
// ════════════════════════════════════════════════════════════
export default function MarketingTeam() {
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAddRow, setShowAddRow] = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(10);

  // ── Initial fetch (runs once) ─────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Search filter → memoized ──────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.name?.toLowerCase().includes(q) ||
      u.mobile?.includes(q) ||
      u.assign_coupon_id?.toLowerCase().includes(q)
    );
  }, [users, search]);

  // ── Pagination → memoized ─────────────────────────────────
  const totalPages  = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const currentPage = useMemo(() => Math.min(page, totalPages), [page, totalPages]);
  const pageSlice   = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleSearch = useCallback((val) => { setSearch(val); setPage(1); }, []);
  const handlePageSize = useCallback((n) => { setPageSize(n); setPage(1); }, []);

  // ── Optimistic ADD ────────────────────────────────────────
  const handleAdd = useCallback(async (form) => {
    // Optimistic: prepend a temp record immediately
    const tempId = `__temp_${Date.now()}`;
    const tempRecord = { id: tempId, ...form, createdAt: null, updatedAt: null };
    setUsers((prev) => [tempRecord, ...prev]);
    setShowAddRow(false);
    try {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      // Swap temp with real id
      setUsers((prev) => prev.map((u) => u.id === tempId ? { ...u, id: ref.id } : u));
    } catch (err) {
      // Rollback on failure
      console.error("Add error:", err);
      setUsers((prev) => prev.filter((u) => u.id !== tempId));
    }
  }, []);

  // ── Optimistic EDIT ───────────────────────────────────────
  const handleInlineSave = useCallback(async (userId, form) => {
    const previous = users.find((u) => u.id === userId);
    // Optimistic: update local state immediately
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...form } : u));
    setEditingId(null);
    try {
      await updateDoc(doc(db, COLLECTION, userId), { ...form, updatedAt: serverTimestamp() });
    } catch (err) {
      // Rollback on failure
      console.error("Save error:", err);
      if (previous) setUsers((prev) => prev.map((u) => u.id === userId ? previous : u));
    }
  }, [users]);

  // ── Optimistic DELETE ─────────────────────────────────────
  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();

  const handleDelete = useCallback((user) => {
    const confirmed = window.confirm(`Delete "${user.name}"? This action cannot be undone.`);
    if (!confirmed) return;
    requestDelete(async () => {
      // Optimistic: remove from local state immediately
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      // If deleting adjusted us past last page, step back
      setPage((p) => {
        const newTotal = Math.max(1, Math.ceil((filtered.length - 1) / pageSize));
        return Math.min(p, newTotal);
      });
      try {
        await deleteDoc(doc(db, COLLECTION, user.id));
      } catch (err) {
        // Rollback on failure
        console.error("Delete error:", err);
        setUsers((prev) => [user, ...prev]);
      }
    });
  }, [filtered.length, pageSize, requestDelete]);

  const openEdit = useCallback((u) => { setEditingId(u.id); setShowAddRow(false); }, []);
  const openAdd  = useCallback(() => { setShowAddRow(true); setEditingId(null); }, []);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* ── Header card ──────────────────────────────────── */}
      <Card className="mb-6">
        <Card.Header className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/10 text-accent"><IconUsers /></div>
            <div>
              <Card.Title className="text-xl font-bold tracking-tight">Marketing Team</Card.Title>
              <Card.Description className="text-xs">Manage team members, coupons &amp; access</Card.Description>
            </div>
          </div>
          <Button variant="primary" size="sm" className="gap-1 font-semibold"
            onPress={openAdd} isDisabled={showAddRow}>
            <IconAdd /> Add Member
          </Button>
        </Card.Header>

        {/* Stats + search bar */}
        <Card.Content className="px-6 py-3 border-t border-divider flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">{users.length}</span> members
            {search && (
              <> &nbsp;·&nbsp; <span className="text-accent font-semibold">{filtered.length}</span> matched</>
            )}
          </p>
          <div className="relative w-56">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
              <IconSearch />
            </span>
            <Input
              size="sm"
              placeholder="Search name, mobile, coupon…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 w-full"
            />
          </div>
        </Card.Content>
      </Card>

      {/* ── Loading ───────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center items-center py-20"><Spinner size="md" /></div>
      )}

      {/* ── Table ─────────────────────────────────────────── */}
      {!loading && (
        <>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Marketing Team Members">
                <Table.Header>
                  <Table.Column isRowHeader>Name</Table.Column>
                  <Table.Column>Mobile</Table.Column>
                  <Table.Column>Password</Table.Column>
                  <Table.Column>Coupon ID</Table.Column>
                  <Table.Column>Status</Table.Column>
                  <Table.Column>Actions</Table.Column>
                </Table.Header>

                <Table.Body>
                  {/* Add row pinned at top */}
                  {showAddRow && (
                    <InputRow
                      initial={DEFAULT_FORM}
                      accentClass="bg-primary/5 border-l-2 border-l-primary"
                      onSave={handleAdd}
                      onCancel={() => setShowAddRow(false)}
                    />
                  )}

                  {/* Current page rows */}
                  {pageSlice.map((user) =>
                    editingId === user.id ? (
                      <InputRow
                        key={user.id}
                        initial={{
                          name: user.name || "",
                          mobile: user.mobile || "",
                          password: user.password || "",
                          assign_coupon_id: user.assign_coupon_id || "",
                          active: user.active ?? true,
                        }}
                        accentClass="bg-accent/5 border-l-2 border-l-accent"
                        onSave={(form) => handleInlineSave(user.id, form)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <ReadOnlyRow
                        key={user.id}
                        user={user}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    )
                  )}

                  {/* Empty states */}
                  {!showAddRow && filtered.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={6}>
                        <div className="text-center py-10 text-muted text-sm">
                          {search
                            ? <>No results for <strong>"{search}"</strong>. Try a different search.</>
                            : <>No members yet. Click <strong>Add Member</strong> to get started.</>
                          }
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          {/* ── Pagination ─────────────────────────────────── */}
          {filtered.length > 0 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={handlePageSize}
            />
          )}

          {/* Row range label */}
          {filtered.length > 0 && (
            <p className="text-xs text-muted text-right mt-1.5 pr-1">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">{filtered.length}</span>
            </p>
          )}
        </>
      )}
      {DeleteAuthModal}
      {BlockedToast}
    </div>
  );
}
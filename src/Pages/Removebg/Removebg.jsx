import React, { useState, useEffect, useCallback } from 'react'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../Firebase'
import { COLLECTIONS } from "../../collections";
import { useAdminDeleteGuard } from "../../Utils/AdminDeleteGuard";

const PAGE_SIZE = 6

// ── icons (inline SVG to avoid extra deps) ──────────────────────────────────
const Icon = {
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Key: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="5" /><line x1="21" y1="2" x2="13.65" y2="9.35" /><line x1="21" y1="2" x2="19" y2="4" /><line x1="18.35" y1="5.65" x2="16" y2="8" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Save: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  ),
}

// ── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={styles.skeletonCard}>
      <div style={{ ...styles.skeletonLine, width: '40%', height: 12 }} />
      <div style={{ ...styles.skeletonLine, width: '80%', height: 20, marginTop: 10 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <div style={{ ...styles.skeletonLine, width: 60, height: 26, borderRadius: 6 }} />
        <div style={{ ...styles.skeletonLine, width: 60, height: 26, borderRadius: 6 }} />
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{ ...styles.toast, background: type === 'error' ? '#ff4d4f' : '#00c48c' }}>
      {type === 'success' ? <Icon.Check /> : <Icon.X />}
      <span style={{ marginLeft: 8 }}>{message}</span>
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>{title}</span>
          <button style={styles.iconBtn} onClick={onClose}><Icon.X /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Key Card ─────────────────────────────────────────────────────────────────
function KeyCard({ item, onEdit, onDelete, onToggle }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const maskedKey = item.key
    ? item.key.slice(0, 6) + '••••••••••••' + item.key.slice(-4)
    : '—'

  async function handleCopy() {
    await navigator.clipboard.writeText(item.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete(item.id)
    setDeleting(false)
  }

  async function handleToggle() {
    setToggling(true)
    await onToggle(item.id, item.active)
    setToggling(false)
  }

  return (
    <div style={{ ...styles.card, borderLeft: `3px solid ${item.active ? '#00c48c' : '#555'}` }}>
      {/* Header row */}
      <div style={styles.cardHeader}>
        <div style={styles.cardMeta}>
          <Icon.Key />
          <span style={styles.cardId}>#{item.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div style={{ ...styles.badge, background: item.active ? 'rgba(0,196,140,.15)' : 'rgba(255,255,255,.07)', color: item.active ? '#00c48c' : '#888', border: `1px solid ${item.active ? '#00c48c44' : '#44444488'}` }}>
          {item.active ? 'Active' : 'Inactive'}
        </div>
      </div>

      {/* Key display */}
      <div style={styles.keyRow}>
        <code style={styles.keyCode}>
          {revealed ? item.key : maskedKey}
        </code>
        <div style={styles.keyActions}>
          <button style={styles.iconBtn} title={revealed ? 'Hide' : 'Reveal'} onClick={() => setRevealed(r => !r)}>
            {revealed ? <Icon.EyeOff /> : <Icon.Eye />}
          </button>
          <button style={styles.iconBtn} title="Copy" onClick={handleCopy}>
            {copied ? <Icon.Check /> : <Icon.Copy />}
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div style={styles.cardFooter}>
        <button
          style={{ ...styles.pillBtn, background: item.active ? 'rgba(255,255,255,.07)' : 'rgba(0,196,140,.15)', color: item.active ? '#aaa' : '#00c48c', border: `1px solid ${item.active ? '#33333388' : '#00c48c44'}`, opacity: toggling ? .6 : 1 }}
          onClick={handleToggle}
          disabled={toggling}
        >
          {toggling ? '...' : item.active ? 'Deactivate' : 'Activate'}
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...styles.pillBtn, color: '#b0c4ff', border: '1px solid #2a3a6088' }} onClick={() => onEdit(item)}>
            <Icon.Edit /> Edit
          </button>
          <button
            style={{ ...styles.pillBtn, color: '#ff6b6b', border: '1px solid #6b2a2a88', opacity: deleting ? .6 : 1 }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '...' : <><Icon.Trash /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function Removebg() {
  const { requestDelete, DeleteAuthModal, BlockedToast } = useAdminDeleteGuard();
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null)

  const [formKey, setFormKey] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [formLoading, setFormLoading] = useState(false)

  const [toast, setToast] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // ── realtime listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.REMOVEBG), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setKeys(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => {
      setLoading(false)
      showToast('Failed to load keys', 'error')
    })
    return unsub
  }, [])

  // ── toast helper ──────────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    setToast({ message, type, id: Date.now() })
  }

  // ── open modal helpers ────────────────────────────────────────────────────
  function openAdd() {
    setFormKey('')
    setFormActive(true)
    setEditTarget(null)
    setModal('add')
  }

  function openEdit(item) {
    setFormKey(item.key)
    setFormActive(item.active)
    setEditTarget(item)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditTarget(null)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!formKey.trim()) return
    setFormLoading(true)
    try {
      await addDoc(collection(db, COLLECTIONS.REMOVEBG), {
        key: formKey.trim(),
        active: formActive,
        createdAt: serverTimestamp(),
      })
      showToast('Key added successfully')
      closeModal()
    } catch {
      showToast('Failed to add key', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleUpdate() {
    if (!formKey.trim() || !editTarget) return
    setFormLoading(true)
    try {
      await updateDoc(doc(db, 'removebg', editTarget.id), {
        key: formKey.trim(),
        active: formActive,
      })
      showToast('Key updated successfully')
      closeModal()
    } catch {
      showToast('Failed to update key', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  function handleDelete(id) {
    return new Promise((resolve) => {
      requestDelete(
        async () => {
          try {
            await deleteDoc(doc(db, 'removebg', id))
            showToast('Key deleted')
            // Adjust page if last item on page deleted
            const remaining = keys.length - 1
            const maxPage = Math.max(1, Math.ceil(remaining / PAGE_SIZE))
            if (page > maxPage) setPage(maxPage)
          } catch {
            showToast('Failed to delete key', 'error')
          } finally {
            resolve()
          }
        },
        () => resolve(),
      )
    })
  }

  async function handleToggle(id, current) {
    try {
      await updateDoc(doc(db, 'removebg', id), { active: !current })
      showToast(`Key ${!current ? 'activated' : 'deactivated'}`)
    } catch {
      showToast('Failed to toggle key', 'error')
    }
  }

  // ── pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(keys.length / PAGE_SIZE))
  const paginated = keys.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeCount = keys.filter(k => k.active).length

  return (
    <div style={styles.root}>
      {/* Toast */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <span style={styles.titleAccent}>Remove</span>BG Keys
          </h1>
          <p style={styles.subtitle}>
            {loading ? 'Loading…' : `${keys.length} key${keys.length !== 1 ? 's' : ''} · ${activeCount} active`}
          </p>
        </div>
        <button style={styles.addBtn} onClick={openAdd}>
          <Icon.Plus /> Add Key
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={styles.grid}>
          {[...Array(PAGE_SIZE)].map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : keys.length === 0 ? (
        <div style={styles.empty}>
          <Icon.Key />
          <p style={{ marginTop: 12, color: '#666' }}>No API keys yet. Add your first one.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {paginated.map(item => (
            <KeyCard
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={{ ...styles.pageBtn, opacity: page === 1 ? .35 : 1 }}
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <Icon.ChevronLeft />
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              style={{ ...styles.pageBtn, ...(page === i + 1 ? styles.pageBtnActive : {}) }}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            style={{ ...styles.pageBtn, opacity: page === totalPages ? .35 : 1 }}
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <Icon.ChevronRight />
          </button>
          <span style={styles.pageInfo}>Page {page} / {totalPages}</span>
        </div>
      )}

      {DeleteAuthModal}
      {BlockedToast}

      {/* Add / Edit Modal */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Add New API Key' : 'Edit API Key'}
          onClose={closeModal}
        >
          <div style={styles.form}>
            <label style={styles.label}>API Key</label>
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. sk-xxxxxxxxxxxxxxxx"
              value={formKey}
              onChange={e => setFormKey(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && (modal === 'add' ? handleAdd() : handleUpdate())}
            />

            <label style={styles.label}>Status</label>
            <div style={styles.toggleRow}>
              <button
                style={{ ...styles.toggleOption, ...(formActive ? styles.toggleActive : {}) }}
                onClick={() => setFormActive(true)}
              >
                Active
              </button>
              <button
                style={{ ...styles.toggleOption, ...(!formActive ? styles.toggleInactive : {}) }}
                onClick={() => setFormActive(false)}
              >
                Inactive
              </button>
            </div>

            <div style={styles.formFooter}>
              <button style={styles.cancelBtn} onClick={closeModal} disabled={formLoading}>
                Cancel
              </button>
              <button
                style={{ ...styles.saveBtn, opacity: (!formKey.trim() || formLoading) ? .5 : 1 }}
                onClick={modal === 'add' ? handleAdd : handleUpdate}
                disabled={!formKey.trim() || formLoading}
              >
                {formLoading ? 'Saving…' : <><Icon.Save /> {modal === 'add' ? 'Add Key' : 'Save Changes'}</>}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    background: '#ffffff',
    color: '#e8e8e8',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: '32px 24px',
    maxWidth: 960,
    margin: '0 auto',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.5px',
  },
  titleAccent: {
    color: '#00c48c',
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#666',
    fontSize: 13,
  },    
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#00c48c',
    color: '#000',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity .15s',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fcfcfc',
    borderRadius: 14,
    padding: '18px 20px',
    border: '1px solid #000000',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    transition: 'border-color .2s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#888',
    fontSize: 12,
  },
  cardId: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 10px',
    borderRadius: 999,
    letterSpacing: '.3px',
    textTransform: 'uppercase',
  },
  keyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#000000',
    borderRadius: 8,
    padding: '8px 12px',
    border: '1px solid #222',
  },
  keyCode: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#b0c4ff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: '.5px',
  },
  keyActions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 6,
    transition: 'color .15s',
  },
  pillBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 11px',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    background: 'none',
    transition: 'opacity .15s',
  },
  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonCard: {
    background: '#171717',
    borderRadius: 14,
    padding: '18px 20px',
    border: '1px solid #222',
    animation: 'pulse 1.5s infinite ease-in-out',
  },
  skeletonLine: {
    background: '#222',
    borderRadius: 6,
    height: 12,
  },
  // ── Empty ─────────────────────────────────────────────────────────────────
  empty: {
    textAlign: 'center',
    padding: '80px 20px',
    color: '#555',
  },
  // ── Pagination ────────────────────────────────────────────────────────────
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
    justifyContent: 'center',
  },
  pageBtn: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#aaa',
    borderRadius: 8,
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all .15s',
  },
  pageBtnActive: {
    background: '#00c48c',
    color: '#000',
    border: '1px solid #00c48c',
    fontWeight: 700,
  },
  pageInfo: {
    marginLeft: 8,
    fontSize: 12,
    color: '#555',
  },
  // ── Modal ─────────────────────────────────────────────────────────────────
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    margin: '0 16px',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid #222',
  },
  modalTitle: {
    fontWeight: 600,
    fontSize: 15,
  },
  // ── Form ─────────────────────────────────────────────────────────────────
  form: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#777',
    textTransform: 'uppercase',
    letterSpacing: '.5px',
    marginBottom: -6,
  },
  input: {
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 9,
    color: '#e8e8e8',
    padding: '11px 14px',
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    letterSpacing: '.5px',
  },
  toggleRow: {
    display: 'flex',
    gap: 8,
  },
  toggleOption: {
    flex: 1,
    padding: '9px',
    borderRadius: 8,
    border: '1px solid #2a2a2a',
    background: '#111',
    color: '#666',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all .15s',
  },
  toggleActive: {
    border: '1px solid #00c48c44',
    background: 'rgba(0,196,140,.12)',
    color: '#00c48c',
  },
  toggleInactive: {
    border: '1px solid #55555544',
    background: 'rgba(100,100,100,.12)',
    color: '#aaa',
  },
  formFooter: {
    display: 'flex',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: 9,
    border: '1px solid #2a2a2a',
    background: 'none',
    color: '#888',
    fontSize: 14,
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '10px',
    borderRadius: 9,
    border: 'none',
    background: '#00c48c',
    color: '#000',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: 'fixed',
    bottom: 28,
    right: 28,
    display: 'flex',
    alignItems: 'center',
    padding: '11px 18px',
    borderRadius: 10,
    color: '#fff',
    fontWeight: 500,
    fontSize: 14,
    zIndex: 200,
    boxShadow: '0 8px 30px rgba(0,0,0,.4)',
    animation: 'slideUp .25s ease',
  },
}
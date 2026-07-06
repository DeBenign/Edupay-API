// src/pages/parent/Children.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { parentAPI } from '../../api'
import { EmptyState, Spinner, Modal, Alert, Field } from '../../components/ui'
import { StatusBadge, Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { formatCurrency } from '../../utils/formatters'
import { BookOpen, Plus, Link, Unlink, ArrowRight, Copy, Check } from 'lucide-react'

export default function ParentChildren() {
  const navigate = useNavigate()
  const { toasts, toast, remove } = useToast()
  const [children,   setChildren]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showLink,   setShowLink]   = useState(false)
  const [linking,    setLinking]    = useState(false)
  const [unlinking,  setUnlinking]  = useState(null)
  const [linkErr,    setLinkErr]    = useState('')
  const [linkForm,   setLinkForm]   = useState({ studentId: '', schoolId: '' })
  const [copied,     setCopied]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await parentAPI.children()
      setChildren(res.data.data.children)
    } catch { toast('Failed to load children', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleLink = async (e) => {
    e.preventDefault(); setLinking(true); setLinkErr('')
    try {
      const res = await parentAPI.linkChild(linkForm)
      toast(res.data.message || 'Child linked successfully!')
      setShowLink(false); setLinkForm({ studentId: '', schoolId: '' }); load()
    } catch (er) {
      setLinkErr(er.response?.data?.message || 'Failed to link child')
    } finally { setLinking(false) }
  }

  const handleUnlink = async (studentId, name) => {
    if (!window.confirm(`Unlink ${name} from your account?`)) return
    setUnlinking(studentId)
    try {
      await parentAPI.unlinkChild(studentId)
      toast(`${name} unlinked from your account`)
      load()
    } catch {
      toast('Failed to unlink child', 'error')
    } finally { setUnlinking(null) }
  }

  const copy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id); setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />

      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">My Children</h1>
          <p className="page-sub">Manage your linked children and their accounts</p>
        </div>
        <button onClick={() => setShowLink(true)} className="btn-primary">
          <Link size={15} /> Link a Child
        </button>
      </div>

      {children.length === 0
        ? <div className="card">
            <EmptyState icon={BookOpen} title="No children linked"
              description="Link your child using the school-issued student ID to view their fees and account details."
              action={
                <button onClick={() => setShowLink(true)} className="btn-primary mt-3">
                  <Plus size={14} /> Link a Child
                </button>
              } />
          </div>
        : <div className="space-y-4">
            {children.map(child => (
              <div key={child._id} className="card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0
                      ${child.gender === 'male' ? 'bg-blue-50' : 'bg-pink-50'}`}>
                      {child.gender === 'male' ? '👦' : '👧'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{child.fullName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{child.class} · {child.studentId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlink(child._id, child.fullName)}
                    disabled={unlinking === child._id}
                    className="btn-ghost text-xs text-red-500 hover:bg-red-50 gap-1.5">
                    <Unlink size={13} />
                    {unlinking === child._id ? 'Unlinking...' : 'Unlink'}
                  </button>
                </div>

                {/* Account number */}
                {child.virtualAccount?.accountNumber && (
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">
                      Payment Account
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-gray-900 text-base">
                          {child.virtualAccount.accountNumber}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          · {child.virtualAccount.bankName}
                        </span>
                      </div>
                      <button onClick={() => copy(child.virtualAccount.accountNumber, child._id)}
                        className={`btn-ghost text-xs gap-1.5 ${copied === child._id ? 'text-green-600' : 'text-blue-600'}`}>
                        {copied === child._id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick links */}
                <div className="px-5 py-3 flex gap-4">
                  <button onClick={() => navigate(`/parent/children/${child._id}/balance`)}
                    className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
                    View Balance <ArrowRight size={12} />
                  </button>
                  <button onClick={() => navigate(`/parent/children/${child._id}/payments`)}
                    className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
                    Payment History <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
      }

      {/* Link Child Modal */}
      <Modal open={showLink} onClose={() => { setShowLink(false); setLinkErr('') }} title="Link a Child" size="sm">
        {linkErr && <div className="mb-4"><Alert type="error" message={linkErr} /></div>}
        <form onSubmit={handleLink} className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            💡 Ask your school admin for your child's school-issued Student ID (e.g. GF/2024/001) and the School ID.
          </div>
          <Field label="School-Issued Student ID" required>
            <input className="input" placeholder="GF/2024/001" required
              value={linkForm.studentId} onChange={e => setLinkForm(p => ({...p, studentId: e.target.value}))} />
          </Field>
          <Field label="School ID" required>
            <input className="input" placeholder="Paste the MongoDB school ID from admin" required
              value={linkForm.schoolId} onChange={e => setLinkForm(p => ({...p, schoolId: e.target.value}))} />
          </Field>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowLink(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={linking}>
              {linking ? <Spinner size="sm" /> : 'Link Child'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
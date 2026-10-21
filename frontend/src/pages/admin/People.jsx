import { useState, useEffect, useCallback } from 'react'
import { peopleAPI } from '../../api'
import { Table, Pagination, EmptyState, Modal, Toast } from '../../components/ui'
import { useToast } from '../../hooks/useToast'
import { formatDate } from '../../utils/formatters'
import { Users, Search } from 'lucide-react'

export default function AdminPeople() {
  const { toasts, toast, remove } = useToast()
  const [tab, setTab] = useState('bursars')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [temp, setTemp] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await peopleAPI.list(tab, { page, limit: 15, search })
      setRows(res.data.data.users); setPagination(res.data.pagination)
    } catch (err) { toast(err.response?.data?.message || 'Failed to load', 'error') }
    finally { setLoading(false) }
  }, [tab, page, search])

  useEffect(() => { load() }, [load])

  const switchTab = (t) => { setTab(t); setPage(1); setSearch(''); setRows([]) }

  const toggle = async (u) => {
    if (u.isActive && !window.confirm(`Deactivate ${u.fullName}? They will no longer be able to log in.`)) return
    try {
      const res = await peopleAPI.setActive(u._id, !u.isActive)
      toast(res.data?.message || 'Updated'); load()
    } catch (err) { toast(err.response?.data?.message || 'Action failed', 'error') }
  }

  const reset = async (u) => {
    if (!window.confirm(`Reset password for ${u.fullName}?`)) return
    try {
      const res = await peopleAPI.resetPassword(u._id)
      setTemp({ name: u.fullName, password: res.data.data.tempPassword })
    } catch (err) { toast(err.response?.data?.message || 'Reset failed', 'error') }
  }

  const isParents = tab === 'parents'
  const headers = ['Name', 'Contact', ...(isParents ? ['Children'] : []), 'Status', 'Joined', 'Actions']

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast toasts={toasts} remove={remove} />
      <div className="page-header mb-0">
        <h1 className="page-title">School People</h1>
        <p className="page-sub">Bursars and parents registered at your school</p>
      </div>

      <div className="flex gap-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {['bursars', 'parents'].map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className={`px-4 py-2 capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>{t}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search name, email or phone…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table loading={loading} headers={headers}>
          {rows.length === 0 && !loading
            ? <tr><td colSpan={headers.length} className="py-12">
                <EmptyState icon={Users} title={`No ${tab} found`} description="They appear here once registered." />
              </td></tr>
            : rows.map(u => (
              <tr key={u._id}>
                <td className="font-semibold text-gray-900">{u.fullName}</td>
                <td>
                  <p className="text-xs text-gray-600">{u.phone || '—'}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                {isParents && (
                  <td className="text-xs text-gray-600">
                    {u.children?.length ? u.children.map(c => `${c.fullName} (${c.class})`).join(', ') : '—'}
                  </td>
                )}
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                <td className="space-x-3 whitespace-nowrap">
                  <button onClick={() => toggle(u)} className="text-xs text-blue-600 hover:underline">
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                  {!isParents && <button onClick={() => reset(u)} className="text-xs text-gray-500 hover:underline">Reset password</button>}
                </td>
              </tr>
            ))}
        </Table>
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      <Modal open={!!temp} onClose={() => setTemp(null)} title="Temporary password" size="sm">
        {temp && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Share this with {temp.name} now. It is shown once and they must change it at next login.</p>
            <p className="font-mono font-bold text-lg bg-gray-50 rounded-lg p-3 text-center select-all">{temp.password}</p>
            <div className="flex justify-end"><button className="btn-primary" onClick={() => setTemp(null)}>Done</button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
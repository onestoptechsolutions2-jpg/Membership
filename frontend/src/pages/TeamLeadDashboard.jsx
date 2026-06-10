import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { Users, LogOut, Plus, Pencil, Trash2, QrCode, X, Upload, Ban, ArrowRightLeft, UserCheck, FileDown, TrendingUp } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import TourGuide from '../components/TourGuide.jsx'
import HelpPanel from '../components/HelpPanel.jsx'
import OnboardingChecklist from '../components/OnboardingChecklist.jsx'

// ── Sub-components ──────────────────────────────────────────────────────────

function SubBadge({ status }) {
  const cfg = {
    active: 'bg-green-100 text-green-700',
    grace_period: 'bg-yellow-100 text-yellow-700',
    suspended: 'bg-red-100 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg[status] || cfg.suspended}`}>{status}</span>
}

function MemberCard({ member, onEdit, onDeactivate, onViewQR, onSuspend, onUnsuspend, onUploadPhoto }) {
  const isSuspended = !!member.suspendedAt
  return (
    <div className={`p-4 bg-white rounded-xl shadow-sm border-l-4 ${isSuspended ? 'border-red-400' : 'border-transparent'}`}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
          {member.photoUrl
            ? <img src={member.photoUrl} alt={member.fullName} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">{member.fullName[0]}</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{member.fullName}</p>
          <p className="text-sm text-gray-500">{member.phone || member.email || 'No contact'}</p>
          {isSuspended && <p className="text-xs text-red-600 mt-0.5">Suspended: {member.suspensionReason || 'no reason'}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onViewQR(member)} className="p-2 rounded-lg hover:bg-gray-100" title="View QR"><QrCode size={16} /></button>
          <button onClick={() => onEdit(member)} className="p-2 rounded-lg hover:bg-gray-100" title="Edit"><Pencil size={16} /></button>
          <label className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer" title="Upload photo">
            <Upload size={16} />
            <input type="file" accept="image/*" className="hidden" onChange={e => onUploadPhoto(member.id, e.target.files[0])} />
          </label>
          {isSuspended
            ? <button onClick={() => onUnsuspend(member)} className="p-2 rounded-lg hover:bg-green-100 text-green-600" title="Unsuspend"><Ban size={16} /></button>
            : <button onClick={() => onSuspend(member)} className="p-2 rounded-lg hover:bg-red-100 text-red-500" title="Suspend"><Ban size={16} /></button>
          }
          <button onClick={() => onDeactivate(member)} className="p-2 rounded-lg hover:bg-red-100 text-red-500" title="Deactivate"><Trash2 size={16} /></button>
        </div>
      </div>
    </div>
  )
}

function QRModal({ member, profileUrl, qrDataUrl, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{member.fullName}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="flex justify-center">
          {qrDataUrl
            ? <img src={qrDataUrl} alt="QR" className="w-48 h-48" />
            : <QRCodeSVG value={profileUrl || member.qrCode} size={192} />
          }
        </div>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(profileUrl); alert('Link copied!') }}
            className="flex-1 border border-gray-300 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">Copy Link</button>
          <button onClick={() => window.print()}
            className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700">Print</button>
        </div>
      </div>
    </div>
  )
}

function SuspendModal({ member, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
        <h3 className="font-bold text-lg text-red-700">Suspend {member.fullName}?</h3>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Reason for suspension (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
        <div className="flex gap-3">
          <button onClick={() => onConfirm(reason)}
            className="flex-1 bg-red-600 text-white py-2 rounded-xl font-medium hover:bg-red-700">Suspend</button>
          <button onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-xl hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function TeamLeadDashboard() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState(null)
  const [members, setMembers] = useState([])
  const [team, setTeam] = useState(null)
  const [qrModal, setQrModal] = useState(null) // { member, qrDataUrl, profileUrl }
  const [editMember, setEditMember] = useState(null)
  const [suspendModal, setSuspendModal] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newMember, setNewMember] = useState({ fullName: '', phone: '', email: '' })
  const [adding, setAdding] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [importing, setImporting] = useState(false)

  async function load() {
    const [s, m] = await Promise.all([api.get('/dashboard/stats'), api.get('/members')])
    setStats(s.data)
    setTeam(s.data.team)
    setMembers(m.data)
  }

  useEffect(() => { load() }, [])

  async function openQR(member) {
    try {
      const { data } = await api.get(`/members/${member.id}/qr`)
      setQrModal({ member, ...data })
    } catch { setQrModal({ member, profileUrl: member.qrCode }) }
  }

  async function addMember(e) {
    e.preventDefault(); setAdding(true)
    try {
      await api.post('/members', newMember)
      setNewMember({ fullName: '', phone: '', email: '' }); setShowAdd(false); load()
    } finally { setAdding(false) }
  }

  async function deactivate(member) {
    if (!confirm(`Deactivate ${member.fullName}?`)) return
    await api.delete(`/members/${member.id}`); load()
  }

  async function uploadPhoto(memberId, file) {
    if (!file) return
    const fd = new FormData(); fd.append('photo', file)
    await api.post(`/members/${memberId}/photo`, fd); load()
  }

  async function suspend(member, reason) {
    await api.patch(`/members/${member.id}/suspend`, { reason }); setSuspendModal(null); load()
  }

  async function unsuspend(member) {
    if (!confirm(`Unsuspend ${member.fullName}?`)) return
    await api.patch(`/members/${member.id}/unsuspend`); load()
  }

  async function bulkImport() {
    if (!bulkFile) return
    setImporting(true)
    try {
      const fd = new FormData(); fd.append('file', bulkFile)
      const { data } = await api.post('/members/import', fd)
      alert(`Imported ${data.created} members`)
      setBulkFile(null); load()
    } catch (err) {
      alert(err.response?.data?.error || 'Import failed')
    } finally { setImporting(false) }
  }

  const activeMembers = members.filter(m => m.active && m.registrationStatus === 'approved' && !m.suspendedAt)
  const suspendedMembers = members.filter(m => m.suspendedAt)
  const pendingMembers = members.filter(m => m.registrationStatus === 'pending')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{team?.name || 'Team Dashboard'}</h1>
          {team && <SubBadge status={team.subscriptionStatus} />}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/lead/registrations" data-tour="approvals-link" className="text-sm text-orange-600 font-medium flex items-center gap-1">
            <UserCheck size={15} /> Approvals {stats?.pendingRegistrations > 0 && <span className="bg-orange-500 text-white text-xs rounded-full px-1.5">{stats.pendingRegistrations}</span>}
          </Link>
          <Link to="/lead/report" className="text-sm text-green-600 font-medium flex items-center gap-1"><FileDown size={15} /> Reports</Link>
          <TourGuide role="team_lead" storageKey="tour_done_lead" />
          <HelpPanel role="team_lead" />
          <span className="text-gray-500 text-sm">{user?.name}</span>
          <button onClick={logout} className="text-gray-400 hover:text-gray-700"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Onboarding checklist */}
        <OnboardingChecklist role="team_lead" stats={stats} members={members} />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-tour="lead-stats">
          {[
            { label: 'Active Members', value: activeMembers.length, color: 'green' },
            { label: "Today's Check-ins", value: stats?.todayCheckIns, color: 'blue' },
            { label: 'Suspended', value: suspendedMembers.length, color: 'red' },
            { label: 'Pending', value: pendingMembers.length, color: 'orange' },
          ].map(({ label, value, color }) => {
            const bg = { blue: 'bg-blue-600', green: 'bg-green-600', red: 'bg-red-500', orange: 'bg-orange-500' }[color]
            return (
              <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-3xl font-bold mt-1 ${bg.replace('bg-', 'text-')}`}>{value ?? '…'}</p>
              </div>
            )
          })}
        </div>

        {/* Trend chart */}
        {stats?.attendanceTrend?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5" data-tour="lead-chart">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={18} /> Attendance — Last 30 Days</h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={stats.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={d => new Date(d).toLocaleDateString('en-KE')} />
                <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={false} name="Check-ins" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bulk import */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5" data-tour="bulk-import">
          <h2 className="font-semibold text-gray-800 mb-3">Bulk Import Members</h2>
          <p className="text-sm text-gray-500 mb-3">CSV format: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">fullName,phone,email</code> (header row required)</p>
          <div className="flex gap-3 items-center">
            <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 text-center cursor-pointer hover:border-blue-400 text-sm text-gray-500">
              {bulkFile ? bulkFile.name : 'Choose CSV file'}
              <input type="file" accept=".csv" className="hidden" onChange={e => setBulkFile(e.target.files[0])} />
            </label>
            <button onClick={bulkImport} disabled={!bulkFile || importing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-50">
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>

        {/* Members list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" data-tour="member-list">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Members ({members.length})</h2>
            <button onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
              <Plus size={14} /> Add Member
            </button>
          </div>

          {showAdd && (
            <form onSubmit={addMember} className="p-5 border-b border-gray-100 bg-blue-50 grid grid-cols-3 gap-3">
              {[
                { ph: 'Full name *', key: 'fullName', required: true },
                { ph: 'Phone', key: 'phone' },
                { ph: 'Email', key: 'email' },
              ].map(({ ph, key, required }) => (
                <input key={key} type="text" placeholder={ph} required={required} value={newMember[key]}
                  onChange={e => setNewMember(m => ({ ...m, [key]: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              ))}
              <button type="submit" disabled={adding}
                className="col-span-3 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {adding ? 'Adding…' : 'Add Member'}
              </button>
            </form>
          )}

          <div className="divide-y divide-gray-50">
            {members.filter(m => m.active).map(m => (
              <div key={m.id} className="px-5 py-2">
                <MemberCard
                  member={m}
                  onViewQR={openQR}
                  onEdit={setEditMember}
                  onDeactivate={deactivate}
                  onSuspend={setSuspendModal}
                  onUnsuspend={unsuspend}
                  onUploadPhoto={uploadPhoto}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {qrModal && <QRModal {...qrModal} onClose={() => setQrModal(null)} />}
      {suspendModal && <SuspendModal member={suspendModal} onConfirm={reason => suspend(suspendModal, reason)} onClose={() => setSuspendModal(null)} />}
    </div>
  )
}

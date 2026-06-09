import { useState, useEffect, useRef } from 'react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { Users, LogOut, Plus, Pencil, Trash2, QrCode, X, Upload, CheckCircle2, XCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

function MemberCard({ member, onEdit, onDeactivate, onViewQR }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm">
      <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
        {member.photoUrl
          ? <img src={member.photoUrl} alt={member.fullName} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">
              {member.fullName[0]}
            </div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{member.fullName}</p>
        <p className="text-sm text-gray-500">{member.phone || 'No phone'}</p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onViewQR(member)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="View QR">
          <QrCode size={17} />
        </button>
        <button onClick={() => onEdit(member)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" title="Edit">
          <Pencil size={17} />
        </button>
        <button onClick={() => onDeactivate(member)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Deactivate">
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  )
}

function QRModal({ member, profileUrl, onClose }) {
  const [sharing, setSharing] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(profileUrl)
    setSharing(true)
    setTimeout(() => setSharing(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">{member.fullName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {member.photoUrl && (
          <img src={member.photoUrl} alt={member.fullName} className="w-20 h-20 rounded-full object-cover mx-auto mb-3" />
        )}

        <div className="inline-block p-3 bg-white border-2 border-gray-100 rounded-xl mb-3">
          <QRCodeSVG value={profileUrl} size={200} />
        </div>

        <p className="text-sm text-gray-500 mb-1">{member.team?.name}</p>
        <p className="text-xs text-gray-400 break-all mb-4">{profileUrl}</p>

        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {sharing ? '✓ Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  )
}

function MemberForm({ initial, teamId, onSaved, onCancel }) {
  const [form, setForm] = useState({ fullName: initial?.fullName || '', phone: initial?.phone || '' })
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let member
      if (initial) {
        const { data } = await api.patch(`/members/${initial.id}`, form)
        member = data
      } else {
        const { data } = await api.post('/members', { ...form, teamId })
        member = data
      }

      if (photo) {
        const fd = new FormData()
        fd.append('photo', photo)
        await api.post(`/members/${member.id}/photo`, fd)
      }

      onSaved()
    } catch (err) {
      alert(err.response?.data?.error || 'Error saving member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h3 className="font-semibold">{initial ? 'Edit Member' : 'Add Member'}</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
        <input
          type="text"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="07xx xxx xxx"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400"
        >
          <Upload size={20} className="mx-auto text-gray-400 mb-1" />
          <p className="text-sm text-gray-500">{photo ? photo.name : 'Click to upload photo'}</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function TeamLeadDashboard() {
  const { user, logout } = useAuth()
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [qrModal, setQrModal] = useState(null) // { member, profileUrl }

  async function load() {
    const { data: teams } = await api.get('/teams')
    if (teams[0]) {
      setTeam(teams[0])
      const { data } = await api.get(`/members?teamId=${teams[0].id}`)
      setMembers(data)
    }
  }

  useEffect(() => { load() }, [])

  async function deactivate(member) {
    if (!confirm(`Deactivate ${member.fullName}?`)) return
    await api.delete(`/members/${member.id}`)
    load()
  }

  async function viewQR(member) {
    const { data } = await api.get(`/members/${member.id}/qr`)
    setQrModal({ member: { ...member, team }, profileUrl: data.profileUrl })
  }

  const subOk = team?.subscriptionStatus === 'active'
  const expiry = team ? new Date(team.subscriptionExpiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <span className="font-bold">{team?.name || 'My Team'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.name}</span>
            <button onClick={logout} className="text-gray-400 hover:text-gray-600"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Subscription status */}
        {team && (
          <div className={`rounded-xl p-4 flex items-center gap-3 ${subOk ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {subOk ? <CheckCircle2 size={20} className="text-green-600" /> : <XCircle size={20} className="text-red-600" />}
            <div>
              <p className={`font-medium ${subOk ? 'text-green-800' : 'text-red-800'}`}>
                Subscription {subOk ? 'Active' : team.subscriptionStatus.replace('_', ' ')}
              </p>
              <p className="text-sm text-gray-600">
                {subOk ? `Expires ${expiry}` : `Expired — contact admin`}
              </p>
            </div>
          </div>
        )}

        {/* Add member */}
        {showForm || editing ? (
          <MemberForm
            initial={editing}
            teamId={team?.id}
            onSaved={() => { setShowForm(false); setEditing(null); load() }}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-3 hover:bg-blue-50 font-medium"
          >
            <Plus size={18} /> Add Member
          </button>
        )}

        {/* Members list */}
        <div className="space-y-2">
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onEdit={(m) => { setEditing(m); setShowForm(false) }}
              onDeactivate={deactivate}
              onViewQR={viewQR}
            />
          ))}
          {!members.length && !showForm && (
            <p className="text-center text-gray-400 py-10">No members yet. Add your first player above.</p>
          )}
        </div>
      </main>

      {qrModal && (
        <QRModal
          member={qrModal.member}
          profileUrl={qrModal.profileUrl}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  )
}

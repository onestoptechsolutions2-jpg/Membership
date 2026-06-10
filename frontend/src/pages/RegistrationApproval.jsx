import { useState, useEffect } from 'react'
import api from '../lib/api.js'
import { CheckCircle2, XCircle, User, Phone, Mail, Clock } from 'lucide-react'

export default function RegistrationApproval() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/register/pending')
      setPending(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function approve(id) {
    setActing(id)
    try {
      await api.post(`/register/${id}/approve`)
      setPending(p => p.filter(m => m.id !== id))
    } finally { setActing(null) }
  }

  async function reject(id) {
    if (!confirm('Reject this registration?')) return
    setActing(id)
    try {
      await api.post(`/register/${id}/reject`)
      setPending(p => p.filter(m => m.id !== id))
    } finally { setActing(null) }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Registrations</h1>
        <p className="text-gray-500 text-sm mt-1">{pending.length} awaiting approval</p>
      </div>

      {pending.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-12 text-center text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-green-300" />
          <p>No pending registrations</p>
        </div>
      ) : (
        pending.map(m => (
          <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex gap-4 items-start">
            {m.photoUrl
              ? <img src={m.photoUrl} alt={m.fullName} className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 flex-shrink-0" />
              : <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400 flex-shrink-0">{m.fullName[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-lg">{m.fullName}</p>
              <p className="text-blue-600 text-sm font-medium">{m.team?.name}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                {m.phone && <span className="flex items-center gap-1"><Phone size={13} />{m.phone}</span>}
                {m.email && <span className="flex items-center gap-1"><Mail size={13} />{m.email}</span>}
                <span className="flex items-center gap-1"><Clock size={13} />{new Date(m.createdAt).toLocaleDateString('en-KE')}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => approve(m.id)} disabled={acting === m.id}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <CheckCircle2 size={15} /> Approve
              </button>
              <button
                onClick={() => reject(m.id)} disabled={acting === m.id}
                className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <XCircle size={15} /> Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

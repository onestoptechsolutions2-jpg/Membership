import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function PublicRegister() {
  const [params] = useSearchParams()
  const teamId = params.get('team')

  const [teams, setTeams] = useState([])
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', teamId: teamId || '' })
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch teams for the dropdown (public endpoint via profile route hack, or just show field)
    // We'll just show a text field for teamId if no team param
  }, [])

  function handlePhoto(e) {
    const f = e.target.files[0]
    if (!f) return
    setPhoto(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.fullName || !form.teamId) { setError('Full name and team ID are required'); return }
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('fullName', form.fullName)
      fd.append('teamId', form.teamId)
      if (form.phone) fd.append('phone', form.phone)
      if (form.email) fd.append('email', form.email)
      if (photo) fd.append('photo', photo)

      await axios.post('/api/register', fd)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-gray-800">Registration Submitted!</h2>
        <p className="text-gray-500">Your details have been sent to the team lead for approval. You'll receive an SMS once approved.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Member Registration</h1>
          <p className="text-gray-500 text-sm mt-1">Fill in your details to join a team</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center">
              {preview
                ? <img src={preview} alt="preview" className="w-full h-full object-cover" />
                : <span className="text-gray-400 text-3xl">📷</span>
              }
            </div>
            <label className="text-sm text-blue-600 cursor-pointer font-medium">
              Upload Photo
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text" required
              value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+254 7XX XXX XXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
            <input
              type="email"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
            />
          </div>

          {!teamId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team ID *</label>
              <input
                type="text" required
                value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Paste your team ID"
              />
              <p className="text-xs text-gray-400 mt-1">Ask your team lead for the team ID</p>
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>
      </div>
    </div>
  )
}

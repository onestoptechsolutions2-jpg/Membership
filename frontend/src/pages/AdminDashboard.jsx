import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { Users, Shield, CreditCard, LogOut, ChevronRight, Plus, CheckCircle, XCircle, Clock } from 'lucide-react'

function StatCard({ label, value, color }) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${color}`}>
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-3xl font-bold mt-1">{value ?? '—'}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    active: 'bg-green-100 text-green-700',
    grace_period: 'bg-yellow-100 text-yellow-700',
    suspended: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace('_', ' ')}
    </span>
  )
}

function Overview() {
  const [stats, setStats] = useState({})
  const [teams, setTeams] = useState([])

  useEffect(() => {
    api.get('/teams/_/stats').then((r) => setStats(r.data))
    api.get('/teams').then((r) => setTeams(r.data))
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Teams" value={stats.totalTeams} color="border-blue-500" />
        <StatCard label="Active" value={stats.active} color="border-green-500" />
        <StatCard label="Suspended" value={stats.suspended} color="border-red-500" />
        <StatCard label="Today's Check-ins" value={stats.todayCheckIns} color="border-purple-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-900">Teams</h2>
          <Link to="/admin/teams/new" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
            <Plus size={16} /> New Team
          </Link>
        </div>
        <div className="divide-y">
          {teams.map((t) => (
            <Link key={t.id} to={`/admin/teams/${t.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-gray-500">{t.playDay} · {t._count.members} active members</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={t.subscriptionStatus} />
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </Link>
          ))}
          {!teams.length && <p className="px-5 py-8 text-center text-gray-400">No teams yet</p>}
        </div>
      </div>
    </div>
  )
}

function NewTeam() {
  const [form, setForm] = useState({ name: '', playDay: 'Monday', sessionEndTime: '22:00', monthlyFee: 2000, teamLeadEmail: '' })
  const [users, setUsers] = useState([])
  const [msg, setMsg] = useState('')
  const navigate = useNavigate()

  useEffect(() => { api.get('/auth/me') }, [])

  async function submit(e) {
    e.preventDefault()
    try {
      // find team lead by email if provided
      let teamLeadId = null
      if (form.teamLeadEmail) {
        // We'll let admin create and assign later for simplicity
      }
      await api.post('/teams', { ...form, monthlyFee: Number(form.monthlyFee), teamLeadId })
      navigate('/admin')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error creating team')
    }
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-semibold mb-6">New Team</h2>
      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {[
          { label: 'Team Name', key: 'name', type: 'text' },
          { label: 'Monthly Fee (KES)', key: 'monthlyFee', type: 'number' },
          { label: 'Session End Time', key: 'sessionEndTime', type: 'time' },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Play Day</label>
          <select
            value={form.playDay}
            onChange={(e) => setForm({ ...form, playDay: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {days.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        {msg && <p className="text-red-500 text-sm">{msg}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700">
          Create Team
        </button>
      </form>
    </div>
  )
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-blue-600" />
            <span className="font-bold text-gray-900">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.name}</span>
            <button onClick={logout} className="text-gray-400 hover:text-gray-600">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {[
            { to: '/admin', label: 'Overview', icon: Users },
            { to: '/admin/teams/new', label: 'New Team', icon: Plus },
            { to: '/gate', label: 'Gate', icon: CheckCircle },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-1.5 px-3 py-3 text-sm text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600">
              <Icon size={15} /> {label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="teams/new" element={<NewTeam />} />
        </Routes>
      </main>
    </div>
  )
}

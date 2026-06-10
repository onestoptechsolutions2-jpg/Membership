import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { Users, Building2, AlertTriangle, TrendingUp, PlusCircle, UserCheck, Shield, FileDown, LogOut } from 'lucide-react'
import TourGuide from '../components/TourGuide.jsx'
import HelpPanel from '../components/HelpPanel.jsx'
import OnboardingChecklist from '../components/OnboardingChecklist.jsx'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState(null)
  const [teams, setTeams] = useState([])
  const [newTeam, setNewTeam] = useState({ name: '', playDay: 'Monday', sessionEndTime: '22:00', monthlyFee: 2000, teamLeadId: '' })
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const [s, t] = await Promise.all([api.get('/dashboard/stats'), api.get('/teams')])
    setStats(s.data)
    setTeams(t.data)
  }

  useEffect(() => { load() }, [])

  async function createTeam(e) {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/teams', { ...newTeam, monthlyFee: parseInt(newTeam.monthlyFee) })
      setShowForm(false)
      setNewTeam({ name: '', playDay: 'Monday', sessionEndTime: '22:00', monthlyFee: 2000, teamLeadId: '' })
      load()
    } finally { setCreating(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="flex items-center gap-3">
          <TourGuide role="admin" storageKey="tour_done_admin" />
          <HelpPanel role="admin" />
          <span className="text-gray-500 text-sm">{user?.name}</span>
          <button onClick={logout} className="text-gray-400 hover:text-gray-700"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Onboarding checklist */}
        <OnboardingChecklist role="admin" stats={stats} teams={teams} />

        {/* Action bar */}
        <div className="flex flex-wrap gap-3" data-tour="action-bar">
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
            <PlusCircle size={16} /> New Team
          </button>
          <Link to="/admin/registrations"
            className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-700 px-4 py-2 rounded-xl text-sm font-medium border border-orange-200">
            <UserCheck size={16} /> Approvals {stats?.pendingRegistrations > 0 && <span className="bg-orange-500 text-white text-xs rounded-full px-1.5">{stats.pendingRegistrations}</span>}
          </Link>
          <Link to="/admin/report"
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-medium border border-green-200">
            <FileDown size={16} /> Reports
          </Link>
          <Link to="/admin/audit"
            className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200">
            <Shield size={16} /> Audit Log
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-tour="stats">
          {[
            { icon: Building2, label: 'Total Teams', value: stats?.totalTeams, color: 'blue' },
            { icon: Users, label: 'Active Members', value: stats?.activeMembers, color: 'green' },
            { icon: TrendingUp, label: "Today's Check-ins", value: stats?.todayCheckIns, color: 'blue' },
            { icon: AlertTriangle, label: 'Suspended Teams', value: stats?.suspendedTeams, color: 'red' },
          ].map(({ icon: Icon, label, value, color }) => {
            const bg = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600' }[color]
            return (
              <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                <div className={`${bg} p-3 rounded-xl`}><Icon size={22} /></div>
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900">{value ?? '…'}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Attendance trend chart */}
        {stats?.attendanceTrend?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5" data-tour="trend-chart">
            <h2 className="font-semibold text-gray-800 mb-4">Attendance — Last 30 Days</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={d => new Date(d).toLocaleDateString('en-KE')} />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} name="Check-ins" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Expiring soon */}
        {stats?.expiringSoon?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5" data-tour="expiring">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-500" /> Subscriptions Expiring Soon
            </h2>
            <div className="divide-y divide-gray-50">
              {stats.expiringSoon.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-800">{t.name}</span>
                  <span className="text-sm text-orange-600 font-medium">
                    {new Date(t.subscriptionExpiresAt).toLocaleDateString('en-KE')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New team form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Create New Team</h2>
            <form onSubmit={createTeam} className="grid grid-cols-2 gap-4">
              {[
                { label: 'Team Name', key: 'name', type: 'text', required: true },
                { label: 'Play Day', key: 'playDay', type: 'text' },
                { label: 'Session End Time', key: 'sessionEndTime', type: 'time' },
                { label: 'Monthly Fee (KES)', key: 'monthlyFee', type: 'number' },
                { label: 'Team Lead ID (optional)', key: 'teamLeadId', type: 'text' },
              ].map(({ label, key, type, required }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} required={required} value={newTeam[key]}
                    onChange={e => setNewTeam(t => ({ ...t, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div className="col-span-2 flex gap-3">
                <button type="submit" disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create Team'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-6 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Teams table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" data-tour="teams-table">
          <div className="p-5 border-b border-gray-100"><h2 className="font-semibold text-gray-800">All Teams</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Team', 'Lead', 'Members', 'Status', 'Expires'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teams.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.teamLead?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{t._count?.members ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        t.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700'
                        : t.subscriptionStatus === 'grace_period' ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'}`}>
                        {t.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.subscriptionExpiresAt).toLocaleDateString('en-KE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

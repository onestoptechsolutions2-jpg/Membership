import { useState } from 'react'
import api from '../lib/api.js'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'

export default function AttendanceReport() {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [from, setFrom] = useState(thirtyAgo)
  const [to, setTo] = useState(today)
  const [teamId, setTeamId] = useState('')
  const [loading, setLoading] = useState(false)

  async function download(format) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, format })
      if (teamId) params.set('teamId', teamId)

      const res = await api.get(`/attendance/report?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance-report.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Report generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance Report</h1>
        <p className="text-gray-500 text-sm mt-1">Export attendance data for any date range</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Team ID (optional)</label>
          <input type="text" value={teamId} onChange={e => setTeamId(e.target.value)}
            placeholder="Leave blank for all teams you manage"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => download('csv')} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50">
            <FileSpreadsheet size={18} />
            {loading ? 'Generating…' : 'Export CSV'}
          </button>
          <button onClick={() => download('pdf')} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50">
            <FileText size={18} />
            {loading ? 'Generating…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
        <strong>Tip:</strong> The CSV opens in Excel. The PDF is formatted for printing.
        Both include member name, team, check-in time, and check-out time.
      </div>
    </div>
  )
}

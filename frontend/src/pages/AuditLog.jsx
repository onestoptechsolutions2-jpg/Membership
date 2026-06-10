import { useState, useEffect } from 'react'
import api from '../lib/api.js'
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react'

const ACTION_COLORS = {
  OVERRIDE_CHECKIN: 'bg-orange-100 text-orange-700',
  APPROVE_REGISTRATION: 'bg-green-100 text-green-700',
  SUSPEND_MEMBER: 'bg-red-100 text-red-700',
  TRANSFER_MEMBER: 'bg-blue-100 text-blue-700',
  DEFAULT: 'bg-gray-100 text-gray-700',
}

function actionColor(action) {
  return ACTION_COLORS[action] || ACTION_COLORS.DEFAULT
}

export default function AuditLog() {
  const [data, setData] = useState({ logs: [], total: 0, page: 1, pages: 1 })
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 50 })
      if (filter) params.set('action', filter)
      const { data: d } = await api.get(`/audit-logs?${params}`)
      setData(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page, filter])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shield size={22} /> Audit Log</h1>
          <p className="text-gray-500 text-sm mt-1">{data.total} total events</p>
        </div>
        <input type="text" value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
          placeholder="Filter by action…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : data.logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No audit events found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Time', 'Actor', 'Action', 'Target', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{log.actor.name}</p>
                    <p className="text-gray-400 text-xs">{log.actor.role}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{log.targetType}</span>
                    <span className="text-gray-400 text-xs ml-1">{log.targetId.slice(0, 8)}…</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {log.meta ? JSON.stringify(log.meta) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-600">Page {page} of {data.pages}</span>
          <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * OnboardingChecklist — first-time setup tracker.
 *
 * Fetches live data to auto-check items. Dismisses permanently once all done
 * or the user manually closes it. Re-opens if new incomplete items appear.
 *
 * Usage:
 *   <OnboardingChecklist role="admin" stats={stats} teams={teams} members={members} />
 */

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react'

// ── Checklist definitions per role ───────────────────────────────────────────

function buildAdminChecklist(stats, teams) {
  return [
    {
      id: 'create_team',
      label: 'Create your first team',
      hint: 'Click "New Team" in the action bar.',
      done: (teams?.length || 0) > 0,
    },
    {
      id: 'add_member',
      label: 'Add at least one member',
      hint: 'Open a team and add a member, or use bulk CSV import.',
      done: (stats?.totalMembers || 0) > 0,
    },
    {
      id: 'approve_registration',
      label: 'Review the registration approval queue',
      hint: 'Click "Approvals" — approve or reject pending self-registrations.',
      done: (stats?.pendingRegistrations || 0) === 0 && (stats?.totalMembers || 0) > 0,
    },
    {
      id: 'run_report',
      label: 'Download an attendance report',
      hint: 'Go to Reports, pick a date range, and download CSV or PDF.',
      done: !!localStorage.getItem('onboard_ran_report'),
      action: () => localStorage.setItem('onboard_ran_report', '1'),
    },
    {
      id: 'check_audit',
      label: 'View the audit log',
      hint: 'Click "Audit Log" in the action bar to see all recorded actions.',
      done: !!localStorage.getItem('onboard_saw_audit'),
    },
  ]
}

function buildLeadChecklist(stats, members) {
  return [
    {
      id: 'add_member',
      label: 'Add your first member',
      hint: 'Click "Add Member" or use the bulk CSV import.',
      done: (members?.length || 0) > 0,
    },
    {
      id: 'upload_photo',
      label: 'Upload a member photo',
      hint: 'Click the upload icon on any member row.',
      done: members?.some(m => m.photoUrl) || false,
    },
    {
      id: 'print_qr',
      label: 'Print a member QR code',
      hint: 'Click the QR icon on a member row, then press Print.',
      done: !!localStorage.getItem('onboard_printed_qr'),
    },
    {
      id: 'check_approvals',
      label: 'Review pending registrations',
      hint: 'Click "Approvals" link in the header.',
      done: (stats?.pendingRegistrations || 0) === 0 && (members?.length || 0) > 0,
    },
    {
      id: 'run_report',
      label: 'Download an attendance report',
      hint: 'Go to Reports and download a CSV or PDF.',
      done: !!localStorage.getItem('onboard_ran_report'),
    },
  ]
}

function buildKeeperChecklist() {
  return [
    {
      id: 'allow_camera',
      label: 'Allow camera access',
      hint: 'Tap "Camera Scan" and accept the browser camera permission prompt.',
      done: !!localStorage.getItem('onboard_camera_ok'),
    },
    {
      id: 'first_scan',
      label: 'Complete first successful scan',
      hint: 'Scan a member QR code and see the green check-in screen.',
      done: !!localStorage.getItem('onboard_first_scan'),
    },
    {
      id: 'test_offline',
      label: 'Note the offline indicator',
      hint: 'The Wifi icon in the header shows green (online) or yellow (offline).',
      done: !!localStorage.getItem('onboard_saw_offline'),
    },
  ]
}

// ── Single checklist item ─────────────────────────────────────────────────────

function CheckItem({ item }) {
  return (
    <div className={`flex items-start gap-3 py-2 ${item.done ? 'opacity-60' : ''}`}>
      {item.done
        ? <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
        : <Circle size={18} className="text-gray-300 flex-shrink-0 mt-0.5" />
      }
      <div>
        <p className={`text-sm font-medium ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {item.label}
        </p>
        {!item.done && <p className="text-xs text-gray-500 mt-0.5">{item.hint}</p>}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const DISMISS_KEY_PREFIX = 'onboard_dismissed_'

export default function OnboardingChecklist({ role, stats, teams, members }) {
  const dismissKey = `${DISMISS_KEY_PREFIX}${role}`
  const [collapsed, setCollapsed] = useState(false)
  const [visible, setVisible] = useState(false)

  const items =
    role === 'admin' ? buildAdminChecklist(stats, teams) :
    role === 'team_lead' ? buildLeadChecklist(stats, members) :
    buildKeeperChecklist()

  const doneCount = items.filter(i => i.done).length
  const allDone = doneCount === items.length

  useEffect(() => {
    // Show unless permanently dismissed
    if (!localStorage.getItem(dismissKey)) setVisible(true)
    // Auto-dismiss when fully complete
    if (allDone && visible) {
      const t = setTimeout(() => {
        localStorage.setItem(dismissKey, '1')
        setVisible(false)
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [allDone, dismissKey, visible])

  function dismiss() {
    localStorage.setItem(dismissKey, '1')
    setVisible(false)
  }

  if (!visible) return null

  const pct = Math.round((doneCount / items.length) * 100)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-blue-500" />
          <span className="font-semibold text-gray-800 text-sm">
            {allDone ? '🎉 Setup complete!' : `Setup checklist — ${doneCount}/${items.length} done`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress ring / bar */}
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{pct}%</span>
          {collapsed ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronUp size={15} className="text-gray-400" />}
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            className="text-gray-300 hover:text-gray-500 ml-1"
            title="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="px-5 pb-4 divide-y divide-gray-50 border-t border-gray-50">
          {items.map(item => <CheckItem key={item.id} item={item} />)}
          {allDone && (
            <p className="text-sm text-green-600 font-medium text-center pt-3">
              All setup tasks complete — you're good to go! ✅
            </p>
          )}
        </div>
      )}
    </div>
  )
}

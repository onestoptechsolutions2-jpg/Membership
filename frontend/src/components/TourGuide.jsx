/**
 * TourGuide — role-aware step-by-step tooltip walkthrough.
 *
 * Usage:
 *   <TourGuide role="admin" storageKey="tour_admin" />
 *
 * Steps are defined per role below. Each step has:
 *   target   – CSS selector for the element to highlight (null = center modal)
 *   title    – short heading
 *   body     – explanation text
 *   position – preferred tooltip side: 'bottom' | 'top' | 'left' | 'right'
 */

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'

// ── Tour step definitions ────────────────────────────────────────────────────

const TOURS = {
  admin: [
    {
      target: null,
      title: 'Welcome, Admin 👋',
      body: 'This quick tour covers your dashboard. You can replay it any time by clicking the ? button in the top-right corner.',
      position: 'center',
    },
    {
      target: '[data-tour="action-bar"]',
      title: 'Action Bar',
      body: 'Create teams, review member registration requests, download attendance reports, and view the full audit log from here.',
      position: 'bottom',
    },
    {
      target: '[data-tour="stats"]',
      title: 'Stats Cards',
      body: 'Live counts of teams, active members, today\'s check-ins, and suspended teams. Refreshes every time you open the page.',
      position: 'bottom',
    },
    {
      target: '[data-tour="trend-chart"]',
      title: 'Attendance Trend',
      body: 'Daily check-in counts for the last 30 days across all teams. Spot low-attendance days at a glance.',
      position: 'bottom',
    },
    {
      target: '[data-tour="expiring"]',
      title: 'Expiring Subscriptions',
      body: 'Teams whose subscription expires within 14 days appear here. Renew them via the Teams table before they hit grace period.',
      position: 'top',
    },
    {
      target: '[data-tour="teams-table"]',
      title: 'Teams Table',
      body: 'All teams with lead, member count, subscription status, and expiry date. Click a row to manage that team.',
      position: 'top',
    },
    {
      target: null,
      title: 'You\'re all set! ✅',
      body: 'Use the ? button any time to replay this tour, or open the Help panel for detailed docs on any feature.',
      position: 'center',
    },
  ],

  team_lead: [
    {
      target: null,
      title: 'Welcome, Team Lead 👋',
      body: 'This tour walks you through managing your team. Tap ? to replay it anytime.',
      position: 'center',
    },
    {
      target: '[data-tour="lead-stats"]',
      title: 'Your Team Stats',
      body: 'Active members, today\'s check-ins, suspended count, and pending self-registrations — all scoped to your team.',
      position: 'bottom',
    },
    {
      target: '[data-tour="lead-chart"]',
      title: 'Attendance Trend',
      body: '30-day attendance history for your team. Use this to identify members who haven\'t shown up recently.',
      position: 'bottom',
    },
    {
      target: '[data-tour="bulk-import"]',
      title: 'Bulk Import',
      body: 'Upload a CSV with columns fullName, phone, email to add many members at once. Download the template from the help panel.',
      position: 'top',
    },
    {
      target: '[data-tour="member-list"]',
      title: 'Member List',
      body: 'View, edit, suspend, or remove members. Use the QR icon to print a member\'s check-in QR code. Suspended members show a red left border.',
      position: 'top',
    },
    {
      target: '[data-tour="approvals-link"]',
      title: 'Approval Queue',
      body: 'Members who self-registered through the public form need your approval before they can check in. The badge shows the pending count.',
      position: 'bottom',
    },
    {
      target: null,
      title: 'You\'re all set! ✅',
      body: 'Open the Help panel for the CSV template and step-by-step guides.',
      position: 'center',
    },
  ],

  keeper: [
    {
      target: null,
      title: 'Gate Tablet Guide 👋',
      body: 'This device controls who enters the session. The tour takes about 30 seconds.',
      position: 'center',
    },
    {
      target: '[data-tour="mode-toggle"]',
      title: 'Scan Mode',
      body: '"Camera Scan" uses the tablet camera to read QR codes automatically. Switch to "Search / Type" if the camera isn\'t available.',
      position: 'bottom',
    },
    {
      target: '[data-tour="offline-badge"]',
      title: 'Online / Offline Indicator',
      body: 'Green = connected. Yellow = offline. When offline, the gate uses the locally cached member list and queues check-ins — they sync automatically when connection is restored.',
      position: 'bottom',
    },
    {
      target: '[data-tour="today-count"]',
      title: 'Today\'s Count',
      body: 'Running total of check-ins for today\'s session. Updates every 30 seconds.',
      position: 'top',
    },
    {
      target: null,
      title: 'Ready to scan! ✅',
      body: 'Point the camera at a member\'s QR code. Green screen = allowed. Red screen = blocked (with an override option if you have authority).',
      position: 'center',
    },
  ],
}

// ── Tooltip positioning ──────────────────────────────────────────────────────

function getTooltipStyle(targetEl, position) {
  if (!targetEl || position === 'center') return null

  const rect = targetEl.getBoundingClientRect()
  const TIP = 12    // arrow size
  const GAP = 8     // space between element and tooltip

  switch (position) {
    case 'bottom':
      return { top: rect.bottom + GAP + TIP, left: rect.left + rect.width / 2 }
    case 'top':
      return { top: rect.top - GAP - TIP, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' }
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - GAP - TIP, transform: 'translate(-100%, -50%)' }
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + GAP + TIP, transform: 'translateY(-50%)' }
    default:
      return { top: rect.bottom + GAP + TIP, left: rect.left + rect.width / 2 }
  }
}

// ── Highlight overlay ────────────────────────────────────────────────────────

function Spotlight({ targetEl }) {
  if (!targetEl) return null
  const r = targetEl.getBoundingClientRect()
  const pad = 6
  return (
    <div
      className="fixed pointer-events-none z-[9998] rounded-xl ring-2 ring-blue-400 ring-offset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
      style={{
        top: r.top - pad,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
        transition: 'all 0.25s ease',
      }}
    />
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TourGuide({ role, storageKey }) {
  const steps = TOURS[role] || TOURS.admin
  const key = storageKey || `tour_done_${role}`

  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [targetEl, setTargetEl] = useState(null)
  const [tipStyle, setTipStyle] = useState(null)
  const tooltipRef = useRef(null)

  // Auto-show on first visit
  useEffect(() => {
    if (!localStorage.getItem(key)) {
      // Small delay so the page renders first
      const t = setTimeout(() => setActive(true), 800)
      return () => clearTimeout(t)
    }
  }, [key])

  useLayoutEffect(() => {
    if (!active) return
    const step = steps[stepIdx]
    if (!step || step.position === 'center' || !step.target) {
      setTargetEl(null)
      setTipStyle(null)
      return
    }
    const el = document.querySelector(step.target)
    setTargetEl(el || null)

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => {
        const style = getTooltipStyle(el, step.position)
        setTipStyle(style)
      }, 300)
    }
  }, [active, stepIdx, steps])

  function next() {
    if (stepIdx < steps.length - 1) setStepIdx(s => s + 1)
    else finish()
  }

  function prev() {
    if (stepIdx > 0) setStepIdx(s => s - 1)
  }

  function finish() {
    localStorage.setItem(key, '1')
    setActive(false)
    setStepIdx(0)
    setTargetEl(null)
  }

  const step = steps[stepIdx]
  const isCenter = !step?.target || step?.position === 'center'
  const progress = ((stepIdx + 1) / steps.length) * 100

  return (
    <>
      {/* ? trigger button */}
      <button
        onClick={() => { setStepIdx(0); setActive(true) }}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition"
        title="Open guided tour"
        data-tour="help-btn"
      >
        <HelpCircle size={17} />
      </button>

      {active && (
        <>
          {/* Dim backdrop for center steps */}
          {isCenter && (
            <div className="fixed inset-0 bg-black/50 z-[9997]" onClick={finish} />
          )}

          {/* Spotlight for targeted steps */}
          {!isCenter && <Spotlight targetEl={targetEl} />}

          {/* Tooltip card */}
          <div
            ref={tooltipRef}
            className={`fixed z-[9999] w-72 bg-white rounded-2xl shadow-2xl p-5 ${
              isCenter
                ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                : ''
            }`}
            style={!isCenter && tipStyle ? {
              top: tipStyle.top,
              left: tipStyle.left,
              transform: tipStyle.transform || 'translateX(-50%)',
            } : undefined}
          >
            {/* Progress bar */}
            <div className="w-full h-1 bg-gray-100 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step counter & close */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-medium">{stepIdx + 1} / {steps.length}</span>
              <button onClick={finish} className="text-gray-300 hover:text-gray-500">
                <X size={16} />
              </button>
            </div>

            <h3 className="font-bold text-gray-900 text-base mb-1">{step.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={prev}
                disabled={stepIdx === 0}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 disabled:opacity-0"
              >
                <ChevronLeft size={16} /> Back
              </button>

              <button
                onClick={next}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-xl"
              >
                {stepIdx < steps.length - 1 ? <>Next <ChevronRight size={16} /></> : 'Done ✓'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

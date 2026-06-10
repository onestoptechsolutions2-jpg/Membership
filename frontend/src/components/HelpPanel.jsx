/**
 * HelpPanel — slide-in documentation sidebar.
 *
 * Usage:
 *   <HelpPanel role="admin" />
 *
 * Renders a floating ? book icon. Clicking it slides in the panel.
 * Content is filtered by role.
 */

import { useState } from 'react'
import { BookOpen, X, ChevronDown, ChevronRight, Download } from 'lucide-react'

// ── Help content by role / section ───────────────────────────────────────────

const SECTIONS = {
  admin: [
    {
      title: 'Getting Started',
      items: [
        {
          q: 'How do I create a team?',
          a: 'Click "New Team" in the action bar. Fill in the team name, monthly fee, and optionally assign a team lead by their user ID. You can also add session schedules (day + end time) from the team settings later.',
        },
        {
          q: 'How do I assign a Team Lead?',
          a: 'Create the Team Lead user via the Users management page (or ask them to self-register and approve them). Then edit the team and paste the user\'s ID into "Team Lead ID".',
        },
        {
          q: 'How do I invite the gate keeper?',
          a: 'Create a user with role "keeper". They log in at /gate. The gate tablet works with any device that has a camera.',
        },
      ],
    },
    {
      title: 'Members & Registrations',
      items: [
        {
          q: 'What is the public registration link?',
          a: 'Share /register with prospective members. They fill in their name, phone, email, and upload a photo. The request appears in Approvals queue for you or the team lead to approve.',
        },
        {
          q: 'How do I approve a pending registration?',
          a: 'Go to Approvals (action bar or /admin/registrations). Click Approve to activate the member and send them an SMS with their profile/QR link. Click Reject to decline.',
        },
        {
          q: 'How do I suspend a member?',
          a: 'Open the member\'s row in the TeamLead dashboard, click the Ban icon, and enter an optional reason. Suspended members are blocked at the gate.',
        },
        {
          q: 'How do I transfer a member to another team?',
          a: 'Admin only: open the member, click Transfer, and select the destination team.',
        },
        {
          q: 'CSV bulk import format',
          a: 'First row must be the header: fullName,phone,email\nOne member per row. Phone and email are optional. Example:\nJohn Doe,0712345678,john@example.com\nJane Smith,,jane@example.com',
        },
      ],
    },
    {
      title: 'Reports & Audit',
      items: [
        {
          q: 'How do I download an attendance report?',
          a: 'Go to Reports (/admin/report). Choose a date range and optionally filter by team. Click "Download CSV" for spreadsheet use or "Download PDF" for printing.',
        },
        {
          q: 'What does the Audit Log show?',
          a: 'Every sensitive action — member suspension, transfer, override check-in, approval/rejection — is recorded with the actor\'s name, timestamp, and metadata. Filter by action type and paginate through history.',
        },
      ],
    },
    {
      title: 'Subscriptions & Billing',
      items: [
        {
          q: 'What happens when a subscription expires?',
          a: 'After expiry the team enters a grace period (default 7 days). During grace period check-ins still work but the team is flagged. After grace period, check-ins are blocked until payment is received.',
        },
        {
          q: 'How do I record a payment?',
          a: 'Use the Payments section (or trigger STK Push from the member\'s profile). The system extends the subscription on confirmed payment and generates a PDF receipt.',
        },
      ],
    },
  ],

  team_lead: [
    {
      title: 'Managing Your Team',
      items: [
        {
          q: 'How do I add a member manually?',
          a: 'Click "Add Member" in the Members section. Enter the full name (required), phone, and email. A QR code is generated automatically.',
        },
        {
          q: 'How do I print a member\'s QR card?',
          a: 'Click the QR icon on any member row. The QR modal has a "Print" button — this prints just the QR and name, suitable for laminating.',
        },
        {
          q: 'How do I upload a member photo?',
          a: 'Click the upload icon (↑) on any member row and choose an image. Photos appear on the gate check-in screen for visual verification.',
        },
      ],
    },
    {
      title: 'Bulk Import CSV Template',
      items: [
        {
          q: 'CSV format',
          a: 'Required header row: fullName,phone,email\n\nExample rows:\nAlice Wanjiku,0711222333,alice@mail.com\nBob Kamau,0722333444,\nCarol Njeri,,carol@mail.com\n\nSave as .csv and upload via "Bulk Import" on your dashboard.',
        },
      ],
    },
    {
      title: 'Attendance & Reports',
      items: [
        {
          q: 'How do I see who attended today?',
          a: 'The "Today\'s Check-ins" stat on your dashboard shows the count. For a detailed list, go to Reports and set today as both start and end date.',
        },
        {
          q: 'Can I manually check out a member?',
          a: 'Yes — open the attendance record from the Reports page and click "Checkout". Useful if a member forgot to check out or the session ended early.',
        },
      ],
    },
  ],

  keeper: [
    {
      title: 'Using the Gate',
      items: [
        {
          q: 'How do I check in a member?',
          a: 'Select "Camera Scan" mode (default). Hold the camera over the member\'s QR code. The screen turns green (allowed) or red (blocked) automatically.',
        },
        {
          q: 'What does a red screen mean?',
          a: 'The member is blocked. Common reasons: subscription expired, member suspended, or already checked in. The reason is shown on screen. You can use "Override & Allow Entry" if you have admin or team lead authority.',
        },
        {
          q: 'What if the camera doesn\'t work?',
          a: 'Switch to "Search / Type" tab and type the member\'s name or paste their QR code value, then press "Check In".',
        },
        {
          q: 'What happens when the internet drops?',
          a: 'The gate switches to offline mode automatically. It uses a cached list of today\'s valid members. Check-ins are queued locally and synced to the server when the connection is restored. The yellow "Offline" badge appears in the header.',
        },
      ],
    },
  ],
}

// ── Accordion item ────────────────────────────────────────────────────────────

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-2 py-3 text-left text-sm font-medium text-gray-800 hover:text-blue-600"
      >
        <span>{q}</span>
        {open ? <ChevronDown size={15} className="flex-shrink-0 mt-0.5" /> : <ChevronRight size={15} className="flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <p className="pb-3 text-sm text-gray-600 leading-relaxed whitespace-pre-line pl-1">
          {a}
        </p>
      )}
    </div>
  )
}

// ── CSV template download helper ──────────────────────────────────────────────

function downloadCsvTemplate() {
  const content = 'fullName,phone,email\nJohn Doe,0712345678,john@example.com\nJane Smith,,jane@example.com'
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'members_import_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HelpPanel({ role }) {
  const [open, setOpen] = useState(false)
  const sections = SECTIONS[role] || SECTIONS.admin

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
        title="Open help docs"
      >
        <BookOpen size={17} />
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-[9990]" onClick={() => setOpen(false)} />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-[9991] flex flex-col transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-500" />
            <span className="font-bold text-gray-900">Help & Docs</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-5 py-2 bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wide">
          {role === 'admin' ? 'Administrator' : role === 'team_lead' ? 'Team Lead' : 'Gate Keeper'} Guide
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {sections.map(section => (
            <div key={section.title}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 mt-2">
                {section.title}
              </h3>
              <div className="bg-gray-50 rounded-xl px-3">
                {section.items.map(item => (
                  <AccordionItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer — CSV download shortcut */}
        {(role === 'admin' || role === 'team_lead') && (
          <div className="px-5 py-4 border-t border-gray-100">
            <button
              onClick={downloadCsvTemplate}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2 rounded-xl"
            >
              <Download size={15} /> Download CSV Import Template
            </button>
          </div>
        )}
      </div>
    </>
  )
}

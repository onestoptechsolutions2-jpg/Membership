import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole } from '../middleware/auth.js'
import PDFDocument from 'pdfkit'

const router = Router()
const prisma = new PrismaClient()

// ── Validation helper ──────────────────────────────────────────────────────────
async function validateMember(qrCode) {
  const member = await prisma.member.findUnique({
    where: { qrCode },
    include: {
      team: { select: { id: true, name: true, subscriptionStatus: true, subscriptionExpiresAt: true } },
    },
  })

  if (!member) return { ok: false, code: 'NOT_FOUND', message: 'Member not found' }
  if (!member.active || member.registrationStatus !== 'approved')
    return { ok: false, code: 'INACTIVE', message: 'Member is not active', member }
  if (member.suspendedAt)
    return { ok: false, code: 'SUSPENDED', message: `Member suspended: ${member.suspensionReason || 'no reason given'}`, member }

  const now = new Date()
  const subActive =
    member.team.subscriptionStatus === 'active' &&
    new Date(member.team.subscriptionExpiresAt) > now

  if (!subActive)
    return { ok: false, code: 'SUB_EXPIRED', message: 'Team subscription expired or suspended', member }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const existing = await prisma.attendance.findFirst({
    where: { memberId: member.id, checkedInAt: { gte: today }, checkedOutAt: null },
  })
  if (existing)
    return { ok: false, code: 'ALREADY_IN', message: 'Already checked in', member, attendanceId: existing.id }

  return { ok: true, member }
}

// POST /api/attendance/validate
router.post('/validate', authenticate, requireRole('keeper', 'admin', 'team_lead'), async (req, res) => {
  const { qrCode } = req.body
  if (!qrCode) return res.status(400).json({ error: 'qrCode required' })
  res.json(await validateMember(qrCode))
})

// POST /api/attendance/checkin
router.post('/checkin', authenticate, requireRole('keeper', 'admin', 'team_lead'), async (req, res) => {
  const { qrCode, override } = req.body
  const validation = await validateMember(qrCode)

  if (!validation.ok && !override) return res.status(422).json(validation)

  if (override && validation.code !== 'ALREADY_IN') {
    const isAdmin = req.user.role === 'admin'
    const isLead = req.user.role === 'team_lead' && validation.member?.team &&
      (await prisma.team.findFirst({ where: { id: validation.member.team.id, teamLeadId: req.user.id } }))
    if (!isAdmin && !isLead) return res.status(403).json({ error: 'Override not permitted for your role' })
  }

  const member = validation.member ||
    (await prisma.member.findUnique({ where: { qrCode }, include: { team: true } }))

  const record = await prisma.attendance.create({
    data: {
      memberId: member.id,
      keeperId: req.user.id,
      overrideApprovedBy: override ? req.user.id : null,
      note: override ? req.body.note || 'Manual override' : null,
    },
    include: { member: { include: { team: true } } },
  })

  if (override) {
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id, action: 'OVERRIDE_CHECKIN', targetType: 'attendance', targetId: record.id,
        meta: { reason: req.body.note || 'Manual override', code: validation.code },
      },
    })
  }

  res.status(201).json({ ok: true, attendance: record })
})

// POST /api/attendance/:id/checkout  — manual checkout
router.post('/:id/checkout', authenticate, requireRole('keeper', 'admin', 'team_lead'), async (req, res) => {
  try {
    const record = await prisma.attendance.update({
      where: { id: req.params.id },
      data: { checkedOutAt: new Date() },
      include: { member: { select: { fullName: true } } },
    })
    res.json({ ok: true, attendance: record })
  } catch {
    res.status(404).json({ error: 'Attendance record not found' })
  }
})

// GET /api/attendance
router.get('/', authenticate, async (req, res) => {
  const { date, memberId, teamId } = req.query
  let where = {}

  if (date) {
    const d = new Date(date); const next = new Date(d); next.setDate(next.getDate() + 1)
    where.checkedInAt = { gte: d, lt: next }
  }
  if (memberId) where.memberId = memberId

  if (req.user.role === 'keeper') {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    where.checkedInAt = { gte: today }
    where.keeperId = req.user.id
  }

  if (req.user.role === 'team_lead') {
    const team = await prisma.team.findFirst({ where: { teamLeadId: req.user.id } })
    if (team) {
      const ids = (await prisma.member.findMany({ where: { teamId: team.id }, select: { id: true } })).map(m => m.id)
      where.memberId = { in: ids }
    }
  }

  if (teamId && req.user.role === 'admin') {
    const ids = (await prisma.member.findMany({ where: { teamId }, select: { id: true } })).map(m => m.id)
    where.memberId = { in: ids }
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      member: { select: { id: true, fullName: true, photoUrl: true, team: { select: { name: true } } } },
      keeper: { select: { name: true } },
    },
    orderBy: { checkedInAt: 'desc' },
    take: 500,
  })
  res.json(records)
})

// GET /api/attendance/report?teamId=&from=&to=&format=csv|pdf
router.get('/report', authenticate, requireRole('admin', 'team_lead'), async (req, res) => {
  const { teamId, from, to, format = 'csv' } = req.query

  const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d })()
  const toDate = to ? new Date(to) : new Date()
  toDate.setHours(23, 59, 59)

  let memberFilter = {}
  if (teamId) {
    const ids = (await prisma.member.findMany({ where: { teamId }, select: { id: true } })).map(m => m.id)
    memberFilter = { in: ids }
  } else if (req.user.role === 'team_lead') {
    const team = await prisma.team.findFirst({ where: { teamLeadId: req.user.id } })
    if (team) {
      const ids = (await prisma.member.findMany({ where: { teamId: team.id }, select: { id: true } })).map(m => m.id)
      memberFilter = { in: ids }
    }
  }

  const records = await prisma.attendance.findMany({
    where: {
      checkedInAt: { gte: fromDate, lte: toDate },
      ...(Object.keys(memberFilter).length ? { memberId: memberFilter } : {}),
    },
    include: {
      member: { select: { fullName: true, phone: true, team: { select: { name: true } } } },
      keeper: { select: { name: true } },
    },
    orderBy: { checkedInAt: 'asc' },
  })

  if (format === 'csv') {
    const header = 'Date,Time,Member,Team,Checked In By,Checked Out\n'
    const rows = records.map(r => {
      const d = new Date(r.checkedInAt)
      return [
        d.toLocaleDateString('en-KE'),
        d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        `"${r.member.fullName}"`,
        `"${r.member.team.name}"`,
        `"${r.keeper.name}"`,
        r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : 'Active',
      ].join(',')
    }).join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report.csv"`)
    return res.send(header + rows)
  }

  // PDF
  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"')
  doc.pipe(res)

  doc.fontSize(18).font('Helvetica-Bold').text('Attendance Report', { align: 'center' })
  doc.fontSize(10).font('Helvetica').text(
    `Period: ${fromDate.toLocaleDateString('en-KE')} – ${toDate.toLocaleDateString('en-KE')}  |  Total: ${records.length} check-ins`,
    { align: 'center' }
  )
  doc.moveDown()

  // Table headers
  const cols = [40, 120, 200, 320, 420, 500]
  const headers = ['Date', 'Time', 'Member', 'Team', 'Checked In By', 'Out']
  doc.font('Helvetica-Bold').fontSize(9)
  headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { width: cols[i + 1] ? cols[i + 1] - cols[i] : 80, lineBreak: false }))
  doc.moveDown(0.3)
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
  doc.moveDown(0.3)

  doc.font('Helvetica').fontSize(8)
  for (const r of records) {
    const d = new Date(r.checkedInAt)
    const row = [
      d.toLocaleDateString('en-KE'),
      d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
      r.member.fullName,
      r.member.team.name,
      r.keeper.name,
      r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '-',
    ]
    const y = doc.y
    row.forEach((cell, i) => {
      doc.text(String(cell), cols[i], y, { width: cols[i + 1] ? cols[i + 1] - cols[i] - 4 : 80, lineBreak: false })
    })
    doc.moveDown(0.5)
    if (doc.y > 750) { doc.addPage(); doc.font('Helvetica').fontSize(8) }
  }

  doc.end()
})

export default router

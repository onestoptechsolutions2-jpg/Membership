import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

// ── Validation helper ──────────────────────────────────────────────────────────
async function validateMember(qrCode) {
  const member = await prisma.member.findUnique({
    where: { qrCode },
    include: {
      team: {
        select: {
          id: true, name: true, subscriptionStatus: true, subscriptionExpiresAt: true,
        },
      },
    },
  })

  if (!member) return { ok: false, code: 'NOT_FOUND', message: 'Member not found' }
  if (!member.active) return { ok: false, code: 'INACTIVE', message: 'Member is deactivated', member }

  const now = new Date()
  const subActive =
    member.team.subscriptionStatus === 'active' &&
    new Date(member.team.subscriptionExpiresAt) > now

  if (!subActive) {
    return {
      ok: false,
      code: 'SUB_EXPIRED',
      message: `Team subscription expired or suspended`,
      member,
    }
  }

  // Already checked in today?
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const existing = await prisma.attendance.findFirst({
    where: { memberId: member.id, checkedInAt: { gte: today }, checkedOutAt: null },
  })
  if (existing) {
    return { ok: false, code: 'ALREADY_IN', message: 'Already checked in', member, attendanceId: existing.id }
  }

  return { ok: true, member }
}

// POST /api/attendance/validate  (gate — check before committing)
router.post('/validate', authenticate, requireRole('keeper', 'admin', 'team_lead'), async (req, res) => {
  const { qrCode } = req.body
  if (!qrCode) return res.status(400).json({ error: 'qrCode required' })
  const result = await validateMember(qrCode)
  res.json(result)
})

// POST /api/attendance/checkin  (gate — record check-in)
router.post('/checkin', authenticate, requireRole('keeper', 'admin', 'team_lead'), async (req, res) => {
  const { qrCode, override } = req.body
  const validation = await validateMember(qrCode)

  if (!validation.ok && !override) {
    return res.status(422).json(validation)
  }

  // If override is requested, verify actor has permission (admin or team_lead of that team)
  if (override && validation.code !== 'ALREADY_IN') {
    const isAdmin = req.user.role === 'admin'
    const isLead =
      req.user.role === 'team_lead' &&
      validation.member?.team &&
      (await prisma.team.findFirst({ where: { id: validation.member.team.id, teamLeadId: req.user.id } }))

    if (!isAdmin && !isLead) {
      return res.status(403).json({ error: 'Override not permitted for your role' })
    }
  }

  const member = validation.member || (await prisma.member.findUnique({ where: { qrCode }, include: { team: true } }))

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
        actorId: req.user.id,
        action: 'OVERRIDE_CHECKIN',
        targetType: 'attendance',
        targetId: record.id,
        meta: { reason: req.body.note || 'Manual override', code: validation.code },
      },
    })
  }

  res.status(201).json({ ok: true, attendance: record })
})

// GET /api/attendance  (admin = all, team_lead = own team, keeper = today)
router.get('/', authenticate, async (req, res) => {
  const { date, memberId, teamId } = req.query

  let where = {}

  if (date) {
    const d = new Date(date)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    where.checkedInAt = { gte: d, lt: next }
  }

  if (memberId) where.memberId = memberId

  if (req.user.role === 'keeper') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    where.checkedInAt = { gte: today }
    where.keeperId = req.user.id
  }

  if (req.user.role === 'team_lead') {
    const team = await prisma.team.findFirst({ where: { teamLeadId: req.user.id } })
    if (team) {
      const teamMembers = await prisma.member.findMany({ where: { teamId: team.id }, select: { id: true } })
      where.memberId = { in: teamMembers.map((m) => m.id) }
    }
  }

  if (teamId && req.user.role === 'admin') {
    const teamMembers = await prisma.member.findMany({ where: { teamId }, select: { id: true } })
    where.memberId = { in: teamMembers.map((m) => m.id) }
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      member: { select: { id: true, fullName: true, photoUrl: true, team: { select: { name: true } } } },
      keeper: { select: { name: true } },
    },
    orderBy: { checkedInAt: 'desc' },
    take: 200,
  })

  res.json(records)
})

export default router

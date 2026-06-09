import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

// GET /api/teams  (admin sees all, team_lead sees own)
router.get('/', authenticate, async (req, res) => {
  const where = req.user.role === 'admin' ? {} : { teamLeadId: req.user.id }
  const teams = await prisma.team.findMany({
    where,
    include: {
      teamLead: { select: { id: true, name: true, email: true } },
      _count: { select: { members: { where: { active: true } } } },
    },
    orderBy: { name: 'asc' },
  })
  res.json(teams)
})

// GET /api/teams/:id
router.get('/:id', authenticate, async (req, res) => {
  const team = await prisma.team.findUnique({
    where: { id: req.params.id },
    include: {
      teamLead: { select: { id: true, name: true, email: true } },
      members: { where: { active: true }, orderBy: { fullName: 'asc' } },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (!team) return res.status(404).json({ error: 'Team not found' })
  // team_lead can only see own team
  if (req.user.role === 'team_lead' && team.teamLeadId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json(team)
})

// POST /api/teams  (admin)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name, playDay, sessionEndTime, monthlyFee, teamLeadId } = req.body
  const expires = new Date()
  expires.setMonth(expires.getMonth() + 1)

  const team = await prisma.team.create({
    data: {
      name,
      playDay,
      sessionEndTime: sessionEndTime || '22:00',
      monthlyFee,
      teamLeadId: teamLeadId || null,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: expires,
    },
  })
  res.status(201).json(team)
})

// PATCH /api/teams/:id  (admin or own team_lead)
router.patch('/:id', authenticate, async (req, res) => {
  const team = await prisma.team.findUnique({ where: { id: req.params.id } })
  if (!team) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && team.teamLeadId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const allowed = req.user.role === 'admin'
    ? req.body
    : { name: req.body.name, playDay: req.body.playDay, sessionEndTime: req.body.sessionEndTime }

  const updated = await prisma.team.update({ where: { id: req.params.id }, data: allowed })
  res.json(updated)
})

// Admin stats summary
router.get('/_/stats', authenticate, requireRole('admin'), async (req, res) => {
  const [totalTeams, active, suspended, todayCheckIns] = await Promise.all([
    prisma.team.count(),
    prisma.team.count({ where: { subscriptionStatus: 'active' } }),
    prisma.team.count({ where: { subscriptionStatus: 'suspended' } }),
    prisma.attendance.count({
      where: { checkedInAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ])
  res.json({ totalTeams, active, suspended, todayCheckIns })
})

export default router

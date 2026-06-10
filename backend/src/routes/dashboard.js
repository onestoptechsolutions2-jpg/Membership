import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

// GET /api/dashboard/stats — rich stats for charts
router.get('/stats', authenticate, requireRole('admin', 'team_lead'), async (req, res) => {
  const now = new Date()

  if (req.user.role === 'admin') {
    const [totalTeams, activeTeams, suspendedTeams, totalMembers, activeMembers] = await Promise.all([
      prisma.team.count(),
      prisma.team.count({ where: { subscriptionStatus: 'active' } }),
      prisma.team.count({ where: { subscriptionStatus: 'suspended' } }),
      prisma.member.count(),
      prisma.member.count({ where: { active: true, registrationStatus: 'approved' } }),
    ])

    // Attendance last 30 days — daily counts
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const attendanceRaw = await prisma.attendance.findMany({
      where: { checkedInAt: { gte: thirtyDaysAgo } },
      select: { checkedInAt: true },
    })
    const dailyCounts = {}
    for (const r of attendanceRaw) {
      const key = r.checkedInAt.toISOString().slice(0, 10)
      dailyCounts[key] = (dailyCounts[key] || 0) + 1
    }
    const attendanceTrend = Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // Subscriptions expiring in next 7 days
    const in7Days = new Date(now); in7Days.setDate(in7Days.getDate() + 7)
    const expiringSoon = await prisma.team.findMany({
      where: { subscriptionExpiresAt: { gte: now, lte: in7Days } },
      select: { id: true, name: true, subscriptionExpiresAt: true, subscriptionStatus: true },
    })

    // Pending registrations
    const pendingRegistrations = await prisma.member.count({ where: { registrationStatus: 'pending' } })

    // Today's check-ins
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayCheckIns = await prisma.attendance.count({ where: { checkedInAt: { gte: today } } })

    return res.json({
      totalTeams, activeTeams, suspendedTeams, totalMembers, activeMembers,
      attendanceTrend, expiringSoon, pendingRegistrations, todayCheckIns,
    })
  }

  // Team lead: stats for their own team
  const team = await prisma.team.findFirst({
    where: { teamLeadId: req.user.id },
    include: { schedules: true },
  })
  if (!team) return res.json({})

  const members = await prisma.member.findMany({ where: { teamId: team.id } })
  const memberIds = members.map(m => m.id)

  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const attendanceRaw = await prisma.attendance.findMany({
    where: { memberId: { in: memberIds }, checkedInAt: { gte: thirtyDaysAgo } },
    select: { checkedInAt: true, memberId: true },
  })

  const dailyCounts = {}
  for (const r of attendanceRaw) {
    const key = r.checkedInAt.toISOString().slice(0, 10)
    dailyCounts[key] = (dailyCounts[key] || 0) + 1
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayCheckIns = await prisma.attendance.count({
    where: { memberId: { in: memberIds }, checkedInAt: { gte: today } },
  })

  const pendingRegistrations = await prisma.member.count({
    where: { teamId: team.id, registrationStatus: 'pending' },
  })

  res.json({
    team,
    totalMembers: members.length,
    activeMembers: members.filter(m => m.active && m.registrationStatus === 'approved').length,
    suspendedMembers: members.filter(m => m.suspendedAt).length,
    pendingRegistrations,
    todayCheckIns,
    attendanceTrend: Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
  })
})

export default router

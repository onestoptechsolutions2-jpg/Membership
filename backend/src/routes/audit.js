import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

// GET /api/audit-logs?page=1&limit=50&action=&targetType=
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 50
  const { action, targetType } = req.query

  const where = {}
  if (action) where.action = { contains: action, mode: 'insensitive' }
  if (targetType) where.targetType = targetType

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  res.json({ logs, total, page, pages: Math.ceil(total / limit) })
})

export default router

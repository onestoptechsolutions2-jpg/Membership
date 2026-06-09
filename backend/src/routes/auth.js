import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, team: true },
  })
  res.json(user)
})

// POST /api/auth/users  (admin only — create keeper/team_lead accounts)
router.post('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
  const { email, password, name, role } = req.body
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, passwordHash: hash, name, role },
    select: { id: true, name: true, email: true, role: true },
  })
  res.status(201).json(user)
})

export default router

import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { authenticate } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Photo upload storage
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/photos'),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
})
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } })

// Resolve which team a team_lead manages
async function resolveTeamId(req) {
  if (req.user.role === 'admin') return req.query.teamId || null
  const team = await prisma.team.findFirst({ where: { teamLeadId: req.user.id } })
  return team?.id || null
}

// GET /api/members
router.get('/', authenticate, async (req, res) => {
  const teamId = await resolveTeamId(req)
  const where = teamId ? { teamId } : {}
  const members = await prisma.member.findMany({
    where,
    include: { team: { select: { name: true, subscriptionStatus: true, subscriptionExpiresAt: true } } },
    orderBy: { fullName: 'asc' },
  })
  res.json(members)
})

// GET /api/members/:id
router.get('/:id', authenticate, async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { id: req.params.id },
    include: { team: true },
  })
  if (!member) return res.status(404).json({ error: 'Not found' })
  res.json(member)
})

// POST /api/members  (admin or team_lead for their team)
router.post('/', authenticate, async (req, res) => {
  const { fullName, phone, teamId: bodyTeamId } = req.body

  let teamId = bodyTeamId
  if (req.user.role === 'team_lead') {
    const team = await prisma.team.findFirst({ where: { teamLeadId: req.user.id } })
    if (!team) return res.status(400).json({ error: 'No team assigned' })
    teamId = team.id
  }

  const qrToken = uuidv4()
  const member = await prisma.member.create({
    data: { teamId, fullName, phone, qrCode: qrToken, active: true },
    include: { team: { select: { name: true } } },
  })
  res.status(201).json(member)
})

// PATCH /api/members/:id
router.patch('/:id', authenticate, async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && member.team.teamLeadId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { fullName, phone, active } = req.body
  const updated = await prisma.member.update({
    where: { id: req.params.id },
    data: { fullName, phone, active },
  })
  res.json(updated)
})

// DELETE /api/members/:id  (soft delete — sets active=false)
router.delete('/:id', authenticate, async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && member.team.teamLeadId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  await prisma.member.update({ where: { id: req.params.id }, data: { active: false } })
  res.json({ ok: true })
})

// POST /api/members/:id/photo  (upload photo)
router.post('/:id/photo', authenticate, upload.single('photo'), async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && member.team.teamLeadId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const photoUrl = `/uploads/photos/${req.file.filename}`
  const updated = await prisma.member.update({ where: { id: req.params.id }, data: { photoUrl } })
  res.json(updated)
})

// GET /api/members/:id/qr  — returns QR as data URL
router.get('/:id/qr', authenticate, async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  const profileUrl = `${process.env.APP_URL}/profile/${member.qrCode}`
  const qrDataUrl = await QRCode.toDataURL(profileUrl, { width: 400, margin: 2 })
  res.json({ qrDataUrl, profileUrl })
})

export default router

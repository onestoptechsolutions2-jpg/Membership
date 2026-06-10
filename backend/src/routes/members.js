import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/photos'),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

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
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  res.json(member)
})

// POST /api/members
router.post('/', authenticate, async (req, res) => {
  const { fullName, phone, email, teamId: bodyTeamId } = req.body
  let teamId = bodyTeamId
  if (req.user.role === 'team_lead') {
    const team = await prisma.team.findFirst({ where: { teamLeadId: req.user.id } })
    if (!team) return res.status(400).json({ error: 'No team assigned' })
    teamId = team.id
  }
  const member = await prisma.member.create({
    data: { teamId, fullName, phone, email, qrCode: uuidv4(), active: true, registrationStatus: 'approved' },
    include: { team: { select: { name: true } } },
  })
  res.status(201).json(member)
})

// PATCH /api/members/:id
router.patch('/:id', authenticate, async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && member.team.teamLeadId !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' })
  const { fullName, phone, email, active } = req.body
  const updated = await prisma.member.update({
    where: { id: req.params.id },
    data: { fullName, phone, email, active },
  })
  res.json(updated)
})

// DELETE /api/members/:id
router.delete('/:id', authenticate, async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && member.team.teamLeadId !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' })
  await prisma.member.update({ where: { id: req.params.id }, data: { active: false } })
  res.json({ ok: true })
})

// POST /api/members/:id/photo
router.post('/:id/photo', authenticate, upload.single('photo'), async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && member.team.teamLeadId !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' })
  const photoUrl = `/uploads/photos/${req.file.filename}`
  const updated = await prisma.member.update({ where: { id: req.params.id }, data: { photoUrl } })
  res.json(updated)
})

// GET /api/members/:id/qr
router.get('/:id/qr', authenticate, async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  const profileUrl = `${process.env.APP_URL}/profile/${member.qrCode}`
  const qrDataUrl = await QRCode.toDataURL(profileUrl, { width: 400, margin: 2 })
  res.json({ qrDataUrl, profileUrl })
})

// PATCH /api/members/:id/suspend
router.patch('/:id/suspend', authenticate, requireRole('admin', 'team_lead'), async (req, res) => {
  const { reason } = req.body
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && member.team.teamLeadId !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' })
  const updated = await prisma.member.update({
    where: { id: req.params.id },
    data: { suspendedAt: new Date(), suspensionReason: reason || null },
  })
  await prisma.auditLog.create({
    data: { actorId: req.user.id, action: 'SUSPEND_MEMBER', targetType: 'member', targetId: member.id, meta: { reason } },
  })
  res.json({ ok: true, member: updated })
})

// PATCH /api/members/:id/unsuspend
router.patch('/:id/unsuspend', authenticate, requireRole('admin', 'team_lead'), async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { team: true } })
  if (!member) return res.status(404).json({ error: 'Not found' })
  if (req.user.role === 'team_lead' && member.team.teamLeadId !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' })
  const updated = await prisma.member.update({
    where: { id: req.params.id },
    data: { suspendedAt: null, suspensionReason: null },
  })
  res.json({ ok: true, member: updated })
})

// PATCH /api/members/:id/transfer
router.patch('/:id/transfer', authenticate, requireRole('admin'), async (req, res) => {
  const { toTeamId } = req.body
  if (!toTeamId) return res.status(400).json({ error: 'toTeamId required' })
  const team = await prisma.team.findUnique({ where: { id: toTeamId } })
  if (!team) return res.status(404).json({ error: 'Target team not found' })
  const member = await prisma.member.findUnique({ where: { id: req.params.id } })
  if (!member) return res.status(404).json({ error: 'Member not found' })
  const updated = await prisma.member.update({
    where: { id: req.params.id },
    data: { teamId: toTeamId },
    include: { team: { select: { name: true } } },
  })
  await prisma.auditLog.create({
    data: {
      actorId: req.user.id, action: 'TRANSFER_MEMBER', targetType: 'member', targetId: member.id,
      meta: { fromTeamId: member.teamId, toTeamId },
    },
  })
  res.json({ ok: true, member: updated })
})

// POST /api/members/import — bulk CSV import
router.post('/import', authenticate, requireRole('admin', 'team_lead'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' })
  try {
    const text = fs.readFileSync(req.file.path, 'utf8')
    const lines = text.trim().split('\n').slice(1) // skip header
    let teamId = req.body.teamId
    if (req.user.role === 'team_lead') {
      const team = await prisma.team.findFirst({ where: { teamLeadId: req.user.id } })
      teamId = team?.id
    }
    if (!teamId) return res.status(400).json({ error: 'teamId required' })

    const created = []
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
      const [fullName, phone, email] = parts
      if (!fullName) continue
      const m = await prisma.member.create({
        data: { teamId, fullName, phone: phone || null, email: email || null, qrCode: uuidv4(), active: true, registrationStatus: 'approved' },
      })
      created.push(m)
    }
    res.json({ ok: true, created: created.length, members: created })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Import failed: ' + err.message })
  }
})

export default router

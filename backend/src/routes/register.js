// Public self-registration + team-lead approval
import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, requireRole } from '../middleware/auth.js'
import { sendSms } from '../services/sms.js'

const router = Router()
const prisma = new PrismaClient()

const storage = multer.diskStorage({
  destination: 'uploads/photos/',
  filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

// POST /api/register — public: submit registration
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { teamId, fullName, phone, email } = req.body
    if (!teamId || !fullName) return res.status(400).json({ error: 'teamId and fullName required' })

    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) return res.status(404).json({ error: 'Team not found' })

    const member = await prisma.member.create({
      data: {
        teamId,
        fullName,
        phone: phone || null,
        email: email || null,
        qrCode: uuidv4(),
        registrationStatus: 'pending',
        active: false,
        photoUrl: req.file ? `/uploads/photos/${req.file.filename}` : null,
      },
    })

    // Notify team lead via SMS if phone on file
    const lead = team.teamLeadId
      ? await prisma.user.findUnique({ where: { id: team.teamLeadId } })
      : null

    res.status(201).json({
      ok: true,
      message: 'Registration submitted. Await team lead approval.',
      memberId: member.id,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/register/pending — team lead sees pending registrations
router.get('/pending', authenticate, requireRole('admin', 'team_lead'), async (req, res) => {
  try {
    const where = req.user.role === 'team_lead'
      ? { registrationStatus: 'pending', team: { teamLeadId: req.user.id } }
      : { registrationStatus: 'pending' }

    const members = await prisma.member.findMany({
      where,
      include: { team: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(members)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/register/:id/approve
router.post('/:id/approve', authenticate, requireRole('admin', 'team_lead'), async (req, res) => {
  try {
    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { registrationStatus: 'approved', active: true },
      include: { team: { select: { name: true } } },
    })

    // Send SMS with profile link
    if (member.phone) {
      const appUrl = process.env.APP_URL || 'http://localhost'
      await sendSms(
        member.phone,
        `Welcome to ${member.team.name}! Your membership is approved. View your QR card: ${appUrl}/profile/${member.qrCode}`
      ).catch(() => {})
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'APPROVE_REGISTRATION',
        targetType: 'member',
        targetId: member.id,
      },
    })

    res.json({ ok: true, member })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/register/:id/reject
router.post('/:id/reject', authenticate, requireRole('admin', 'team_lead'), async (req, res) => {
  try {
    const member = await prisma.member.update({
      where: { id: req.params.id },
      data: { registrationStatus: 'rejected', active: false },
    })
    res.json({ ok: true, member })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router

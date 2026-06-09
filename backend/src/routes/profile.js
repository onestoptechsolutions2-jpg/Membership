import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import QRCode from 'qrcode'

const router = Router()
const prisma = new PrismaClient()

// GET /api/profile/:qrCode  — public, no auth
// Used by the member profile shareable link
router.get('/:qrCode', async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { qrCode: req.params.qrCode },
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      active: true,
      qrCode: true,
      team: {
        select: {
          name: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
        },
      },
    },
  })

  if (!member) return res.status(404).json({ error: 'Not found' })

  const profileUrl = `${process.env.APP_URL}/profile/${member.qrCode}`
  const qrDataUrl = await QRCode.toDataURL(profileUrl, { width: 400, margin: 2 })

  res.json({ ...member, qrDataUrl, profileUrl })
})

export default router

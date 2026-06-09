import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole } from '../middleware/auth.js'
import { triggerSTKPush, verifyWebhookSignature } from '../services/intasend.js'

const router = Router()
const prisma = new PrismaClient()

// POST /api/payments/stk  — trigger STK push for a team (admin)
router.post('/stk', authenticate, requireRole('admin'), async (req, res) => {
  const { teamId, phone } = req.body
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } } })
  if (!team) return res.status(404).json({ error: 'Team not found' })

  const sub = team.subscriptions[0]
  if (!sub) return res.status(400).json({ error: 'No subscription found for team' })

  const payment = await prisma.payment.create({
    data: { subscriptionId: sub.id, amount: team.monthlyFee, status: 'pending' },
  })

  try {
    const result = await triggerSTKPush({
      phone: phone || team.phone,
      amount: team.monthlyFee,
      accountRef: team.name,
      description: `Membership - ${team.name}`,
      paymentId: payment.id,
    })
    await prisma.payment.update({ where: { id: payment.id }, data: { intasendRef: result.invoice?.invoice_id } })
    res.json({ ok: true, payment, intasend: result })
  } catch (err) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } })
    res.status(500).json({ error: err.message })
  }
})

// POST /api/payments/webhook  — IntaSend webhook (no auth — verified by signature)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['x-intasend-signature']
  if (!verifyWebhookSignature(req.body, sig)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const { invoice_id, state, account_ref } = req.body

  if (state === 'COMPLETE') {
    const payment = await prisma.payment.findFirst({ where: { intasendRef: invoice_id } })
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'success', paidAt: new Date() },
      })

      // Extend subscription
      const sub = await prisma.subscription.findUnique({ where: { id: payment.subscriptionId } })
      const newExpiry = new Date(sub.renewalDate)
      newExpiry.setMonth(newExpiry.getMonth() + 1)

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { renewalDate: newExpiry },
      })

      await prisma.team.update({
        where: { id: sub.teamId },
        data: { subscriptionStatus: 'active', subscriptionExpiresAt: newExpiry },
      })
    }
  }

  res.json({ ok: true })
})

// GET /api/payments  (admin)
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: { subscription: { include: { team: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json(payments)
})

export default router

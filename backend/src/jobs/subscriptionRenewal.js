import { PrismaClient } from '@prisma/client'
import { triggerSTKPush } from '../services/intasend.js'

const prisma = new PrismaClient()

export async function runSubscriptionRenewals() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dueSubs = await prisma.subscription.findMany({
    where: {
      autoRenew: true,
      renewalDate: { gte: today, lt: tomorrow },
      team: { subscriptionStatus: { in: ['active', 'grace_period'] } },
    },
    include: { team: true },
  })

  console.log(`[renewal] ${dueSubs.length} subscriptions due today`)

  for (const sub of dueSubs) {
    const payment = await prisma.payment.create({
      data: { subscriptionId: sub.id, amount: sub.amount, status: 'pending' },
    })

    try {
      // Note: requires a phone number on the team or subscription
      const phone = sub.team.phone || null
      if (!phone) {
        console.warn(`[renewal] No phone for team ${sub.team.name} — skipping STK push`)
        continue
      }

      const result = await triggerSTKPush({
        phone,
        amount: sub.amount,
        accountRef: sub.team.name,
        description: `Monthly renewal - ${sub.team.name}`,
        paymentId: payment.id,
      })

      await prisma.payment.update({
        where: { id: payment.id },
        data: { intasendRef: result.invoice?.invoice_id },
      })

      console.log(`[renewal] STK push sent for ${sub.team.name}`)
    } catch (err) {
      console.error(`[renewal] STK push failed for ${sub.team.name}:`, err.message)
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } })

      // Start grace period after failed attempt
      await prisma.team.update({
        where: { id: sub.teamId },
        data: { subscriptionStatus: 'grace_period' },
      })
    }
  }

  // Suspend teams that have been in grace period for more than 3 days
  const graceCutoff = new Date()
  graceCutoff.setDate(graceCutoff.getDate() - 3)

  await prisma.team.updateMany({
    where: {
      subscriptionStatus: 'grace_period',
      subscriptionExpiresAt: { lt: graceCutoff },
    },
    data: { subscriptionStatus: 'suspended' },
  })
}

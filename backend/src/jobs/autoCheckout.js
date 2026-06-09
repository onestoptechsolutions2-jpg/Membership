import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function autoCheckout() {
  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // Find teams whose session just ended at this minute
  const teams = await prisma.team.findMany({
    where: { sessionEndTime: hhmm },
    select: { id: true, sessionEndTime: true },
  })

  if (!teams.length) return

  for (const team of teams) {
    const members = await prisma.member.findMany({
      where: { teamId: team.id },
      select: { id: true },
    })
    const memberIds = members.map((m) => m.id)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find all still-checked-in attendance for this team today
    const open = await prisma.attendance.findMany({
      where: {
        memberId: { in: memberIds },
        checkedInAt: { gte: today },
        checkedOutAt: null,
      },
    })

    if (open.length) {
      await prisma.attendance.updateMany({
        where: { id: { in: open.map((a) => a.id) } },
        data: { checkedOutAt: now, note: 'Auto checkout — session ended' },
      })
      console.log(`[auto-checkout] ${open.length} records closed for team ${team.id} at ${hhmm}`)
    }
  }
}

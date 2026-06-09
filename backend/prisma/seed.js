import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@membership.app' },
    update: {},
    create: {
      email: 'admin@membership.app',
      passwordHash: hash,
      name: 'Administrator',
      role: 'admin',
    },
  })

  console.log('✓ Admin created:', admin.email)

  // Demo team lead
  const leadHash = await bcrypt.hash('lead123', 10)
  const lead = await prisma.user.upsert({
    where: { email: 'lead@membership.app' },
    update: {},
    create: {
      email: 'lead@membership.app',
      passwordHash: leadHash,
      name: 'John Kamau',
      role: 'team_lead',
    },
  })

  // Demo keeper
  const keeperHash = await bcrypt.hash('keeper123', 10)
  const keeper = await prisma.user.upsert({
    where: { email: 'keeper@membership.app' },
    update: {},
    create: {
      email: 'keeper@membership.app',
      passwordHash: keeperHash,
      name: 'Gate Keeper',
      role: 'keeper',
    },
  })

  // Demo team
  const expires = new Date()
  expires.setMonth(expires.getMonth() + 1)

  const team = await prisma.team.upsert({
    where: { teamLeadId: lead.id },
    update: {},
    create: {
      name: 'Warriors FC',
      playDay: 'Tuesday',
      sessionEndTime: '22:00',
      monthlyFee: 2000,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: expires,
      teamLeadId: lead.id,
    },
  })

  // Demo members
  const memberNames = ['James Mwangi', 'Peter Otieno', 'David Njoroge', 'Samuel Weru']
  for (const name of memberNames) {
    await prisma.member.upsert({
      where: { qrCode: `demo-${name.replace(/\s+/g, '-').toLowerCase()}` },
      update: {},
      create: {
        teamId: team.id,
        fullName: name,
        qrCode: uuidv4(),
        active: true,
      },
    })
  }

  console.log('✓ Demo data seeded')
  console.log('  Admin:  admin@membership.app / admin123')
  console.log('  Lead:   lead@membership.app  / lead123')
  console.log('  Keeper: keeper@membership.app / keeper123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

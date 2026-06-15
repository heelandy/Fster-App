import { PrismaClient, type PlanTier } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLAN_SEED: {
  tier: PlanTier;
  name: string;
  description: string;
  priceCentsMonthly: number;
  priceCentsAnnual: number;
  monthlyEnv: string;
  annualEnv: string;
}[] = [
  { tier: 'FREE', name: 'Free', description: 'One household, one child, limited checklists & appointments.', priceCentsMonthly: 0, priceCentsAnnual: 0, monthlyEnv: '', annualEnv: '' },
  { tier: 'FAMILY', name: 'Family', description: 'Multiple children, care logs, medications, expenses, basic documents.', priceCentsMonthly: 999, priceCentsAnnual: 9990, monthlyEnv: 'STRIPE_PRICE_FAMILY_MONTHLY', annualEnv: 'STRIPE_PRICE_FAMILY_ANNUAL' },
  { tier: 'PRO', name: 'Pro Foster Parent', description: 'Unlimited children, full documents, licensing tracker, exports, co-parent & babysitter access.', priceCentsMonthly: 1999, priceCentsAnnual: 19990, monthlyEnv: 'STRIPE_PRICE_PRO_MONTHLY', annualEnv: 'STRIPE_PRICE_PRO_ANNUAL' },
  { tier: 'AGENCY', name: 'Agency / Multi-Home', description: 'Multiple homes, agency dashboard, household permissions, compliance overview.', priceCentsMonthly: 4999, priceCentsAnnual: 49990, monthlyEnv: 'STRIPE_PRICE_AGENCY_MONTHLY', annualEnv: 'STRIPE_PRICE_AGENCY_ANNUAL' },
];

async function main() {
  // 1) Plan catalogue
  for (const p of PLAN_SEED) {
    await prisma.plan.upsert({
      where: { tier: p.tier },
      update: {
        name: p.name,
        description: p.description,
        priceCentsMonthly: p.priceCentsMonthly,
        priceCentsAnnual: p.priceCentsAnnual,
        stripePriceMonthly: process.env[p.monthlyEnv] || null,
        stripePriceAnnual: process.env[p.annualEnv] || null,
      },
      create: {
        tier: p.tier,
        name: p.name,
        description: p.description,
        priceCentsMonthly: p.priceCentsMonthly,
        priceCentsAnnual: p.priceCentsAnnual,
        stripePriceMonthly: process.env[p.monthlyEnv] || null,
        stripePriceAnnual: process.env[p.annualEnv] || null,
      },
    });
  }
  console.log('✓ Plans seeded');

  // 2) Admin account (also given a household so the admin can use the full app;
  //    the admin console itself does not require a household).
  const adminEmail = 'admin@example.com';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { globalRole: 'ADMIN' },
    create: {
      email: adminEmail,
      name: 'System Admin',
      passwordHash: await bcrypt.hash('Admin12345', 12),
      globalRole: 'ADMIN',
    },
  });
  const adminHasHousehold = await prisma.householdMember.findFirst({ where: { userId: admin.id } });
  if (!adminHasHousehold) {
    const adminHome = await prisma.household.create({ data: { name: 'Admin Home', ownerId: admin.id } });
    await prisma.householdMember.create({
      data: { householdId: adminHome.id, userId: admin.id, role: 'FOSTER_PARENT', acceptedAt: new Date() },
    });
    await prisma.subscription.create({ data: { householdId: adminHome.id, tier: 'FREE', status: 'ACTIVE' } });
  }
  console.log(`✓ Admin seeded (${adminEmail} / Admin12345)`);

  // 3) Demo foster parent + household + sample data
  const parentEmail = 'parent@example.com';
  const existing = await prisma.user.findUnique({ where: { email: parentEmail } });
  if (!existing) {
    const parent = await prisma.user.create({
      data: {
        email: parentEmail,
        name: 'Demo Foster Parent',
        passwordHash: await bcrypt.hash('Parent12345', 12),
      },
    });
    const household = await prisma.household.create({ data: { name: 'The Demo Home', ownerId: parent.id } });
    await prisma.householdMember.create({
      data: { householdId: household.id, userId: parent.id, role: 'FOSTER_PARENT', acceptedAt: new Date() },
    });
    await prisma.subscription.create({ data: { householdId: household.id, tier: 'PRO', status: 'ACTIVE' } });

    const child = await prisma.childProfile.create({
      data: {
        householdId: household.id,
        firstName: 'Alex',
        preferredName: 'Al',
        placementStatus: 'ACTIVE',
        caseNumber: 'CASE-1024',
        caseworkerName: 'J. Rivera',
        school: 'Lincoln Elementary',
        allergies: 'Peanuts',
      },
    });
    await prisma.appointment.create({
      data: {
        householdId: household.id,
        childId: child.id,
        title: 'Pediatric check-up',
        type: 'DOCTOR',
        startsAt: new Date(Date.now() + 3 * 86_400_000),
      },
    });
    await prisma.contact.create({
      data: { householdId: household.id, name: 'J. Rivera', role: 'CASEWORKER', phone: '555-0100', isLegal: true },
    });
    await prisma.checklist.create({
      data: {
        householdId: household.id,
        name: 'New placement intake',
        type: 'INTAKE',
        items: { create: [{ title: 'Collect placement paperwork', order: 0 }, { title: 'Set up bedroom', order: 1 }] },
      },
    });
    console.log(`✓ Demo foster parent seeded (${parentEmail} / Parent12345)`);
  } else {
    console.log('• Demo foster parent already exists, skipping');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

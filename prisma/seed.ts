import { PrismaClient, Prisma, type PlanTier } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Restore a demo account to a known-good, loginable state. Re-seeding must be able
 * to recover an account that got locked, 2FA-enrolled, soft-deleted or had its
 * password changed during testing — otherwise a wedged demo login can't be fixed.
 */
async function resetDemoAuth(email: string, password: string) {
  await prisma.user.update({
    where: { email },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      isActive: true,
      isBanned: false,
      deletedAt: null,
      failedLogins: 0,
      lockedUntil: null,
      tokenVersion: { increment: 1 }, // invalidate any lingering sessions
      twoFactorEnabledAt: null,
      twoFactorSecret: null,
      twoFactorBackupCodes: Prisma.DbNull,
      emailVerifiedAt: new Date(),
    },
  });
}

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
    update: { globalRole: 'ADMIN', adminRole: 'SUPER_ADMIN' },
    create: {
      email: adminEmail,
      name: 'System Admin',
      passwordHash: await bcrypt.hash('Admin12345', 12),
      globalRole: 'ADMIN',
      adminRole: 'SUPER_ADMIN',
      emailVerifiedAt: new Date(),
    },
  });
  // Always restore a clean, loginable state (password, unlock, clear 2FA) so a
  // re-seed reliably recovers the admin even after testing.
  await resetDemoAuth(adminEmail, 'Admin12345');
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
        emailVerifiedAt: new Date(),
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
    await resetDemoAuth(parentEmail, 'Parent12345');
    console.log('• Demo foster parent exists — auth reset (Parent12345)');
  }

  // 4) Demo AGENCY account: one owner managing multiple foster homes, so the
  //    Agency dashboard + multi-home switcher can be exercised end-to-end.
  const agencyEmail = 'agency@example.com';
  const agencyExists = await prisma.user.findUnique({ where: { email: agencyEmail } });
  if (!agencyExists) {
    const agency = await prisma.user.create({
      data: {
        email: agencyEmail,
        name: 'Demo Agency',
        passwordHash: await bcrypt.hash('Agency12345', 12),
        emailVerifiedAt: new Date(),
      },
    });

    // Home 1 — holds the paid AGENCY subscription, which (via the owner) governs
    // every home this agency owns.
    const north = await prisma.household.create({ data: { name: 'Northside Foster Home', ownerId: agency.id } });
    await prisma.householdMember.create({ data: { householdId: north.id, userId: agency.id, role: 'FOSTER_PARENT', acceptedAt: new Date() } });
    await prisma.subscription.create({ data: { householdId: north.id, tier: 'AGENCY', status: 'ACTIVE' } });
    await prisma.childProfile.create({ data: { householdId: north.id, firstName: 'Maria', placementStatus: 'ACTIVE' } });
    await prisma.appointment.create({ data: { householdId: north.id, title: 'Court hearing', type: 'COURT', startsAt: new Date(Date.now() + 2 * 86_400_000) } });
    await prisma.licensingRequirement.create({ data: { householdId: north.id, name: 'CPR/First Aid renewal', status: 'DUE_SOON', dueDate: new Date(Date.now() + 5 * 86_400_000) } });

    // Home 2 — its own FREE subscription; inherits AGENCY features via the owner.
    const west = await prisma.household.create({ data: { name: 'Westside Foster Home', ownerId: agency.id } });
    await prisma.householdMember.create({ data: { householdId: west.id, userId: agency.id, role: 'FOSTER_PARENT', acceptedAt: new Date() } });
    await prisma.subscription.create({ data: { householdId: west.id, tier: 'FREE', status: 'ACTIVE' } });
    await prisma.childProfile.create({ data: { householdId: west.id, firstName: 'Jordan', placementStatus: 'ACTIVE' } });
    await prisma.appointment.create({ data: { householdId: west.id, title: 'Home inspection', type: 'HOME_INSPECTION', startsAt: new Date(Date.now() - 1 * 86_400_000) } });
    await prisma.licensingRequirement.create({ data: { householdId: west.id, name: 'Fire inspection', status: 'EXPIRED', dueDate: new Date(Date.now() - 10 * 86_400_000) } });

    console.log(`✓ Demo agency seeded (${agencyEmail} / Agency12345) — 2 homes`);
  } else {
    await resetDemoAuth(agencyEmail, 'Agency12345');
    console.log('• Demo agency exists — auth reset (Agency12345)');
  }

  // 5) Multi-agency platform: an agency TENANT ("Demo Foster Agency") overseeing
  //    the agency demo account's homes, with a case worker.
  const agencyOwner = await prisma.user.findUnique({ where: { email: agencyEmail }, select: { id: true } });
  if (agencyOwner) {
    const cw = await prisma.user.upsert({
      where: { email: 'caseworker@example.com' },
      update: {},
      create: { email: 'caseworker@example.com', name: 'Demo Case Worker', passwordHash: await bcrypt.hash('Worker12345', 12), emailVerifiedAt: new Date() },
    });
    await resetDemoAuth('caseworker@example.com', 'Worker12345');

    let org = await prisma.agency.findFirst({ where: { name: 'Demo Foster Agency' } });
    if (!org) org = await prisma.agency.create({ data: { name: 'Demo Foster Agency' } });
    await prisma.agencyMember.upsert({
      where: { agencyId_userId: { agencyId: org.id, userId: agencyOwner.id } },
      update: { role: 'AGENCY_ADMIN' },
      create: { agencyId: org.id, userId: agencyOwner.id, role: 'AGENCY_ADMIN' },
    });
    await prisma.agencyMember.upsert({
      where: { agencyId_userId: { agencyId: org.id, userId: cw.id } },
      update: { role: 'CASE_WORKER' },
      create: { agencyId: org.id, userId: cw.id, role: 'CASE_WORKER' },
    });
    // Link the agency demo account's homes to the org for oversight.
    await prisma.household.updateMany({ where: { ownerId: agencyOwner.id }, data: { agencyId: org.id } });
    console.log('✓ Agency tenant seeded: Demo Foster Agency (admin agency@example.com; caseworker@example.com / Worker12345)');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

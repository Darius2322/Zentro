/**
 * Seed data — for local development / demo ONLY.
 * Every seeded name is clearly marked "(Demo)" per spec #93 so nobody
 * mistakes it for real production data.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("DemoAdminPass123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@zentro.demo" },
    update: {},
    create: {
      email: "admin@zentro.demo",
      passwordHash: adminPasswordHash,
      fullName: "Platform Admin (Demo)",
      role: "PLATFORM_ADMIN",
    },
  });

  const ownerPasswordHash = await bcrypt.hash("DemoPassword123!", 12);

  const owner = await prisma.user.upsert({
    where: { email: "owner@glowbeauty.demo" },
    update: {},
    create: {
      email: "owner@glowbeauty.demo",
      passwordHash: ownerPasswordHash,
      fullName: "Grace Wanjiru (Demo Owner)",
      role: "BUSINESS_OWNER",
    },
  });

  const business = await prisma.business.upsert({
    where: { slug: "glow-beauty-demo" },
    update: {},
    create: {
      slug: "glow-beauty-demo",
      name: "Glow Beauty Studio (Demo)",
      status: "ACTIVE",
      ownerUserId: owner.id,
      timezone: "Africa/Nairobi",
      phone: "+254700000000",
      address: "Nairobi, Kenya",
      reviewedAt: new Date(),
      hours: {
        create: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          isClosed: false,
          startTime: "09:00",
          endTime: "17:00",
        })),
      },
    },
    include: { hours: true },
  });

  // Sunday(0)/Saturday(6) closed if not already present
  await prisma.businessHours.createMany({
    data: [0, 6].map((weekday) => ({ businessId: business.id, weekday, isClosed: true })),
    skipDuplicates: true,
  });

  const resourceType = await prisma.resourceType.upsert({
    where: { businessId_name: { businessId: business.id, name: "Manicure Table" } },
    update: {},
    create: { businessId: business.id, name: "Manicure Table" },
  });
  await prisma.resource.upsert({
    where: { businessId_name: { businessId: business.id, name: "Manicure Table 1 (Demo)" } },
    update: {},
    create: { businessId: business.id, resourceTypeId: resourceType.id, name: "Manicure Table 1 (Demo)" },
  });

  const staff = await prisma.staff.upsert({
    where: { businessId_email: { businessId: business.id, email: "mary@glowbeauty.demo" } },
    update: {},
    create: {
      businessId: business.id,
      fullName: "Mary Achieng (Demo Staff)",
      email: "mary@glowbeauty.demo",
      title: "Senior Nail Technician",
      workingHours: {
        create: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startTime: "09:00",
          endTime: "17:00",
        })),
      },
      breaks: {
        create: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startTime: "13:00",
          endTime: "14:00",
          label: "Lunch",
        })),
      },
    },
  });

  const service = await prisma.service.upsert({
    where: { id: "demo-gel-manicure" },
    update: {},
    create: {
      id: "demo-gel-manicure",
      businessId: business.id,
      name: "Gel Manicure (Demo)",
      description: "Long-lasting gel polish manicure.",
      priceCents: 150000, // KSh 1,500.00
      durationMinutes: 90,
      bufferMinutes: 10,
    },
  });

  await prisma.staffService.upsert({
    where: { staffId_serviceId: { staffId: staff.id, serviceId: service.id } },
    update: {},
    create: { staffId: staff.id, serviceId: service.id },
  });

  await prisma.serviceResource.upsert({
    where: { serviceId_resourceTypeId: { serviceId: service.id, resourceTypeId: resourceType.id } },
    update: {},
    create: { serviceId: service.id, resourceTypeId: resourceType.id, quantity: 1 },
  });

  console.log("Seed complete. Demo business slug: glow-beauty-demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

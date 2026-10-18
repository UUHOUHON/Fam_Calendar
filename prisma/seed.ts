import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

function at(date: string, time: string, tz: string) {
  return fromZonedTime(`${date}T${time}:00`, tz);
}

async function main() {
  await prisma.emailLog.deleteMany();
  await prisma.activityInvite.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.familyInvite.deleteMany();
  await prisma.member.deleteMany();
  await prisma.family.deleteMany();

  const family = await prisma.family.create({
    data: { name: "The Family Calendar" },
  });

  const passwordHash = await bcrypt.hash("family123", 10);

  const mia = await prisma.member.create({
    data: {
      name: "Mia",
      email: "mia@fam.local",
      passwordHash,
      color: "#0F766E",
      timezone: "Asia/Singapore",
      role: "ADMIN",
      status: "ACTIVE",
      familyId: family.id,
    },
  });

  const alex = await prisma.member.create({
    data: {
      name: "Alex",
      email: "alex@fam.local",
      passwordHash,
      color: "#B45309",
      timezone: "America/New_York",
      role: "MEMBER",
      status: "ACTIVE",
      familyId: family.id,
    },
  });

  const jordan = await prisma.member.create({
    data: {
      name: "Jordan",
      email: "jordan@fam.local",
      passwordHash,
      color: "#1D4ED8",
      timezone: "Europe/London",
      role: "MEMBER",
      status: "ACTIVE",
      familyId: family.id,
    },
  });

  const base = new Date();
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(Math.min(base.getUTCDate(), 25)).padStart(2, "0");
  const day = `${y}-${m}-${d}`;
  const next = `${y}-${m}-${String(Math.min(Number(d) + 1, 28)).padStart(2, "0")}`;

  await prisma.activity.create({
    data: {
      title: "Morning run",
      description: "Park loop",
      startAt: at(day, "07:00", mia.timezone),
      endAt: at(day, "08:00", mia.timezone),
      memberId: mia.id,
    },
  });

  await prisma.activity.create({
    data: {
      title: "Grocery run",
      description: "",
      startAt: at(day, "18:00", alex.timezone),
      endAt: at(day, "19:00", alex.timezone),
      memberId: alex.id,
    },
  });

  // Confirmed shared plan (already accepted)
  await prisma.activity.create({
    data: {
      title: "Family video call",
      description: "Catch up with everyone",
      startAt: at(day, "21:00", alex.timezone),
      endAt: at(day, "22:00", alex.timezone),
      memberId: alex.id,
      invites: {
        create: [
          {
            memberId: mia.id,
            token: "demo-accepted-mia",
            status: "ACCEPTED",
            respondedAt: new Date(),
          },
          {
            memberId: jordan.id,
            token: "demo-accepted-jordan",
            status: "ACCEPTED",
            respondedAt: new Date(),
          },
        ],
      },
    },
  });

  // Pending shared plan — only host (Mia) sees it until accepted
  await prisma.activity.create({
    data: {
      title: "Museum visit",
      description: "Weekend plan — awaiting replies",
      startAt: at(next, "11:00", mia.timezone),
      endAt: at(next, "14:00", mia.timezone),
      memberId: mia.id,
      invites: {
        create: [
          {
            memberId: jordan.id,
            token: "demo-pending-jordan",
            status: "PENDING",
          },
        ],
      },
    },
  });

  console.log("Seeded family calendar.");
  console.log("Admin login: mia@fam.local / family123");
  console.log("Members: alex@fam.local, jordan@fam.local / family123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.family.updateMany({
    data: { name: "The Family Calendar" },
  });
  console.log("Updated families:", result.count);
}

main()
  .finally(() => prisma.$disconnect());

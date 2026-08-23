import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@steelnova.com.br";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "troque-esta-senha";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin ja existe, pulando seed.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name: "João Murilo",
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Admin criado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

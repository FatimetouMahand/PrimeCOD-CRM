import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash("Admin@123", 10);

  const admin = await prisma.user.upsert({
    where: { phone: "+22200000000" },
    update: {},
    create: {
      name:     "Admin",
      phone:    "+22200000000",
      password: hashed,
      role:     "Admin",
    },
  });

  console.log("✅ Compte Admin créé :");
  console.log("   Téléphone :", admin.phone);
  console.log("   Mot de passe : Admin@123");
  console.log("   Rôle :", admin.role);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

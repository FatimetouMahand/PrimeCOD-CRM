/**
 * Seed de la base de données — même approche que l'ancienne app.
 * Crée l'admin principal (PrimeCOD) s'il n'existe pas encore.
 * L'ADMIN n'est JAMAIS créé via le formulaire — uniquement ici.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding PrimeCOD CRM...");

  // ── 1. Admin principal ─────────────────────────────────────────────────────
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  if (!existingAdmin) {
    console.log("👤 Création de l'admin principal...");
    const hashedPassword = await bcrypt.hash("primecod123", 10);

    await prisma.user.create({
      data: {
        name:     "Admin Sou9nkc",
        phone:    "00000000",
        password: hashedPassword,
        role:     "ADMIN",
        status:   "ACTIVE",
        iconColor: "#1e40af",
        roleColor: "#dbeafe",
        // Toutes les permissions
        canViewOrders:    true,
        canEditOrders:    true,
        canViewUsers:     true,
        canEditUsers:     true,
        canViewProducts:  true,
        canEditProducts:  true,
        canViewStatuses:  true,
        canEditStatuses:  true,
        canViewReporting: true,
        canViewDashboard: true,
      },
    });
    console.log("✅ Admin créé — Phone: 00000000 | Password: primecod123");
  } else {
    console.log("ℹ️  Admin déjà existant — pas de création.");
  }

  // ── 2. Statuts par défaut ──────────────────────────────────────────────────
  const statusCount = await prisma.status.count();

  if (statusCount === 0) {
    console.log("🏷️  Création des statuts par défaut...");
    await prisma.status.createMany({
      data: [
        { name: "En attente",    color: "#f59e0b", isFinal: false, isActive: true },
        { name: "Confirmée",     color: "#22c55e", isFinal: true,  isActive: true },
        { name: "Rejetée",       color: "#ef4444", isFinal: true,  isActive: true },
        { name: "Ne répond pas", color: "#6b7280", isFinal: false, isActive: true, alertAfterHours: 24 },
        { name: "Annulée",       color: "#dc2626", isFinal: true,  isActive: true },
        { name: "En livraison",  color: "#3b82f6", isFinal: false, isActive: true },
      ],
    });
    console.log("✅ Statuts créés");
  }

  // ── 3. Paramètres système ──────────────────────────────────────────────────
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });

  if (!settings) {
    console.log("⚙️  Création des paramètres système...");
    await prisma.systemSettings.create({
      data: {
        id: "default",
        assignmentBatchSize: 1,
        maxRecallAttempts:   3,
        workStart: "10:00",
        workEnd:   "22:00",
        workDays:  [0, 1, 2, 3, 4, 5, 6],
        breakStart: "13:30",
        breakEnd:   "14:30",
      },
    });
    console.log("✅ Paramètres système créés");
  }

  console.log("🎉 Seed terminé.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * ONE-TIME PRODUCTION SETUP ENDPOINT
 * -----------------------------------
 * Syncs the production DB schema with the new Prisma schema.
 * Run ONCE after first deploy: GET /api/admin/setup?key=primecod-setup-2026
 *
 * What it does:
 *  1. Adds all new columns to existing tables (safe — IF NOT EXISTS)
 *  2. Creates new enum types (Role, UserStatus)
 *  3. Migrates old data (role "Agent" → "AGENT", suspended → status)
 *  4. Creates SystemSettings table
 *  5. Re-seeds admin account (phone: 00000000 / password: primecod123)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { encrypt } from "@/lib/crypto";

const SETUP_KEY = "primecod-setup-2026";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (key !== SETUP_KEY) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 403 });
  }

  const log: string[] = [];

  try {
    // ── STEP 1: Create enum types ─────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'AGENT', 'AGENT_TEST');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    log.push("✅ Enum Role créé (ou déjà existant)");

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    log.push("✅ Enum UserStatus créé (ou déjà existant)");

    // ── STEP 2: Add missing columns to User ───────────────────────────────────
    const userColumns = [
      `ADD COLUMN IF NOT EXISTS "encryptedPassword" TEXT`,
      `ADD COLUMN IF NOT EXISTS "iconColor" TEXT NOT NULL DEFAULT '#2563eb'`,
      `ADD COLUMN IF NOT EXISTS "roleColor" TEXT NOT NULL DEFAULT '#f3f4f6'`,
      `ADD COLUMN IF NOT EXISTS "paymentRemainingDays" INTEGER NOT NULL DEFAULT 0`,
      `ADD COLUMN IF NOT EXISTS "paymentDefaultDays" INTEGER NOT NULL DEFAULT 0`,
      `ADD COLUMN IF NOT EXISTS "paymentStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      `ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3)`,
      `ADD COLUMN IF NOT EXISTS "lastLogoutAt" TIMESTAMP(3)`,
      `ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3)`,
      `ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3)`,
      `ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT`,
      `ADD COLUMN IF NOT EXISTS "canViewOrders" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canEditOrders" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canViewUsers" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canEditUsers" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canViewProducts" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canEditProducts" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canViewStatuses" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canEditStatuses" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canViewReporting" BOOLEAN NOT NULL DEFAULT false`,
      `ADD COLUMN IF NOT EXISTS "canViewDashboard" BOOLEAN NOT NULL DEFAULT false`,
    ];

    for (const col of userColumns) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ${col};`);
    }
    log.push("✅ Nouvelles colonnes User ajoutées");

    // updatedAt for User
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);
    log.push("✅ User.updatedAt ajouté");

    // ── STEP 3: Add "status" column (text first, then convert to enum) ────────
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE';
    `);

    // Copy from suspended → status (if suspended column exists)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'suspended'
        ) THEN
          UPDATE "User" SET "status" = CASE WHEN "suspended" = true THEN 'INACTIVE' ELSE 'ACTIVE' END;
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`UPDATE "User" SET "status" = 'ACTIVE' WHERE "status" IS NULL;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "status" SET NOT NULL;`);
    log.push("✅ User.status ajouté et migré depuis suspended");

    // ── STEP 4: Normalize role values (TEXT → uppercase for enum) ────────────
    await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = 'ADMIN'      WHERE "role" IN ('Admin','admin');`);
    await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = 'SUPERVISOR' WHERE "role" IN ('Supervisor','supervisor');`);
    await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = 'AGENT'      WHERE "role" IN ('Agent','agent');`);
    await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = 'AGENT_TEST' WHERE "role" IN ('Agent_Test','agent_test','AgentTest','AGENT_TEST');`);
    log.push("✅ Valeurs de rôles normalisées");

    // Convert role TEXT → Role enum
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'role' AND udt_name = 'Role'
        ) THEN
          ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";
        END IF;
      END $$;
    `);
    log.push("✅ User.role converti en enum Role");

    // Convert status TEXT → UserStatus enum
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'status' AND udt_name = 'UserStatus'
        ) THEN
          ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus" USING "status"::"UserStatus";
        END IF;
      END $$;
    `);
    log.push("✅ User.status converti en enum UserStatus");

    // ── STEP 5: Default permissions for existing users ────────────────────────
    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET
        "canViewOrders" = true,
        "canEditOrders" = true,
        "canViewDashboard" = true
      WHERE "role" IN ('AGENT', 'AGENT_TEST');
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET
        "canViewOrders" = true,
        "canViewProducts" = true,
        "canViewStatuses" = true,
        "canViewReporting" = true,
        "canViewDashboard" = true
      WHERE "role" = 'SUPERVISOR';
    `);
    log.push("✅ Permissions par défaut appliquées aux agents/superviseurs");

    // ── STEP 6: Add missing columns to Order ─────────────────────────────────
    const orderColumns = [
      `ADD COLUMN IF NOT EXISTS "orderNumber" INTEGER`,
      `ADD COLUMN IF NOT EXISTS "recallAt" TIMESTAMP(3)`,
      `ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3)`,
      `ADD COLUMN IF NOT EXISTS "firstProcessedAt" TIMESTAMP(3)`,
      `ADD COLUMN IF NOT EXISTS "processingTimeMin" INTEGER`,
      `ADD COLUMN IF NOT EXISTS "absoluteDelayMin" INTEGER`,
    ];

    for (const col of orderColumns) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ${col};`);
    }

    // Make statusId nullable
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Order" ALTER COLUMN "statusId" DROP NOT NULL;
    `);

    // Unique index for orderNumber
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Order_orderNumber_key"
      ON "Order"("orderNumber") WHERE "orderNumber" IS NOT NULL;
    `);
    log.push("✅ Nouvelles colonnes Order ajoutées");

    // ── STEP 7: Add missing columns to Product ────────────────────────────────
    const productColumns = [
      `ADD COLUMN IF NOT EXISTS "shopifyId" TEXT`,
      `ADD COLUMN IF NOT EXISTS "assignedAgentIds" TEXT[] NOT NULL DEFAULT '{}'`,
      `ADD COLUMN IF NOT EXISTS "hiddenForAgentIds" TEXT[] NOT NULL DEFAULT '{}'`,
      `ADD COLUMN IF NOT EXISTS "vendor" TEXT`,
      `ADD COLUMN IF NOT EXISTS "productType" TEXT`,
      `ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    ];

    for (const col of productColumns) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ${col};`);
    }

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Product_shopifyId_key"
      ON "Product"("shopifyId") WHERE "shopifyId" IS NOT NULL;
    `);
    log.push("✅ Nouvelles colonnes Product ajoutées");

    // ── STEP 8: Add isArchived to Status ──────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Status" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
    `);
    log.push("✅ Status.isArchived ajouté");

    // ── STEP 9: Create SystemSettings table ───────────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemSettings" (
        "id" TEXT NOT NULL DEFAULT 'default',
        "assignmentBatchSize" INTEGER NOT NULL DEFAULT 1,
        "maxRecallAttempts" INTEGER NOT NULL DEFAULT 3,
        "workStart" TEXT NOT NULL DEFAULT '10:00',
        "workEnd" TEXT NOT NULL DEFAULT '22:00',
        "workDays" INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6,0}',
        "breakStart" TEXT DEFAULT '13:30',
        "breakEnd" TEXT DEFAULT '14:30',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSettings" ("id", "updatedAt")
      VALUES ('default', NOW())
      ON CONFLICT ("id") DO NOTHING;
    `);
    log.push("✅ Table SystemSettings créée");

    // ── STEP 10: Ensure default Statuses exist ─────────────────────────────────
    const defaultStatuses = [
      { name: "En attente",        color: "#f59e0b", isFinal: false },
      { name: "Confirmée",         color: "#22c55e", isFinal: true  },
      { name: "Rejetée",           color: "#ef4444", isFinal: true  },
      { name: "Ne répond pas",     color: "#8b5cf6", isFinal: false },
      { name: "Annulée",           color: "#6b7280", isFinal: true  },
      { name: "En livraison",      color: "#3b82f6", isFinal: false },
    ];

    for (const s of defaultStatuses) {
      await prisma.status.upsert({
        where:  { id: `default-${s.name.replace(/\s+/g, "-").toLowerCase()}` },
        update: {},
        create: {
          id:       `default-${s.name.replace(/\s+/g, "-").toLowerCase()}`,
          name:     s.name,
          color:    s.color,
          isFinal:  s.isFinal,
          isActive: true,
        },
      });
    }
    log.push("✅ Statuts par défaut vérifiés");

    // ── STEP 11: Ensure Admin account exists ──────────────────────────────────
    const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!adminExists) {
      const hashed    = await hashPassword("primecod123");
      const encrypted = encrypt("primecod123");
      await prisma.user.create({
        data: {
          name:              "Admin PrimeCOD",
          phone:             "00000000",
          password:          hashed,
          encryptedPassword: encrypted,
          role:              "ADMIN",
          status:            "ACTIVE",
          iconColor:         "#0d3938",
          canViewOrders:    true, canEditOrders:    true,
          canViewUsers:     true, canEditUsers:     true,
          canViewProducts:  true, canEditProducts:  true,
          canViewStatuses:  true, canEditStatuses:  true,
          canViewReporting: true, canViewDashboard: true,
        },
      });
      log.push("✅ Compte Admin créé (00000000 / primecod123)");
    } else {
      log.push(`ℹ️ Admin déjà existant : ${adminExists.phone}`);
    }

    // ── STEP 12b: Create test Supervisor account (if not exists) ──────────────
    const supExists = await prisma.user.findUnique({ where: { phone: "11111111" } });
    if (!supExists) {
      const hashed    = await hashPassword("superviseur123");
      const encrypted = encrypt("superviseur123");
      await prisma.user.create({
        data: {
          name:              "Superviseur Test",
          phone:             "11111111",
          password:          hashed,
          encryptedPassword: encrypted,
          role:              "SUPERVISOR",
          status:            "ACTIVE",
          iconColor:         "#1d4ed8",
          canViewOrders:    true,  canEditOrders:    false,
          canViewUsers:     false, canEditUsers:     false,
          canViewProducts:  true,  canEditProducts:  false,
          canViewStatuses:  true,  canEditStatuses:  false,
          canViewReporting: true,  canViewDashboard: true,
        },
      });
      log.push("✅ Compte Superviseur créé (11111111 / superviseur123)");
    } else {
      log.push(`ℹ️ Superviseur déjà existant : ${supExists.phone}`);
    }

    // ── STEP 12c: Create test Agent account (if not exists) ───────────────────
    const agentExists = await prisma.user.findUnique({ where: { phone: "22222222" } });
    if (!agentExists) {
      const hashed    = await hashPassword("agent123");
      const encrypted = encrypt("agent123");
      await prisma.user.create({
        data: {
          name:              "Agent Test",
          phone:             "22222222",
          password:          hashed,
          encryptedPassword: encrypted,
          role:              "AGENT",
          status:            "ACTIVE",
          iconColor:         "#16a34a",
          canViewOrders:    true,  canEditOrders:    true,
          canViewUsers:     false, canEditUsers:     false,
          canViewProducts:  false, canEditProducts:  false,
          canViewStatuses:  false, canEditStatuses:  false,
          canViewReporting: false, canViewDashboard: true,
        },
      });
      log.push("✅ Compte Agent créé (22222222 / agent123)");
    } else {
      log.push(`ℹ️ Agent déjà existant : ${agentExists.phone}`);
    }

    // ── STEP 12: Fix User.name if it's NOT NULL but some rows are empty ──────
    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET "name" = 'Agent' WHERE "name" IS NULL OR "name" = '';
    `);
    log.push("✅ Noms manquants corrigés");

    return NextResponse.json({
      success: true,
      message: "✅ Base de données synchronisée avec succès !",
      steps: log,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[setup]", msg);
    return NextResponse.json({
      success: false,
      error: msg,
      steps: log,
    }, { status: 500 });
  }
}

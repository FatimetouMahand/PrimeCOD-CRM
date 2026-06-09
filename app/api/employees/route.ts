import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { encrypt } from "@/lib/crypto";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getCaller() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return null;
    return verifyToken(token) as { id: string; role: string };
  } catch { return null; }
}

// ─── GET /api/employees ───────────────────────────────────────────────────────
// Returns all users EXCEPT the main ADMIN (never shown in the list).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all"; // all | active | suspended

  try {
    const employees = await prisma.user.findMany({
      where: {
        role:   { not: "ADMIN" }, // Admin principal never shown
        ...(filter === "active"    ? { status: "ACTIVE"   } : {}),
        ...(filter === "suspended" ? { status: "INACTIVE" } : {}),
      },
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
    });

    const ONLINE_MS = 5 * 60 * 1000; // 5 minutes
    const now = new Date();

    return NextResponse.json({
      employees: employees.map((u) => {
        const lastSeen   = u.lastSeenAt?.getTime()   ?? 0;
        const lastLogout = u.lastLogoutAt?.getTime() ?? 0;
        const isOnline   = (now.getTime() - lastSeen) < ONLINE_MS && lastSeen > lastLogout;

        const startDate  = u.paymentStartDate ?? u.createdAt;
        const diffDays   = Math.floor((now.getTime() - startDate.getTime()) / 86_400_000);
        const remaining  = Math.max(0, u.paymentRemainingDays - diffDays);

        return {
          id:            u.id,
          name:          u.name ?? "Sans nom",
          phone:         u.phone,
          role:          u.role,
          status:        isOnline ? "ONLINE" : "OFFLINE",
          isActive:      u.status === "ACTIVE",
          iconColor:     u.iconColor,
          roleColor:     u.roleColor,
          paymentRemainingDays: remaining,
          paymentDefaultDays:   u.paymentDefaultDays,
          telegramChatId: u.telegramChatId,
          // Permissions
          canViewOrders:    u.canViewOrders,
          canEditOrders:    u.canEditOrders,
          canViewUsers:     u.canViewUsers,
          canEditUsers:     u.canEditUsers,
          canViewProducts:  u.canViewProducts,
          canEditProducts:  u.canEditProducts,
          canViewStatuses:  u.canViewStatuses,
          canEditStatuses:  u.canEditStatuses,
          canViewReporting: u.canViewReporting,
          canViewDashboard: u.canViewDashboard,
          startDate:  u.startDate?.toISOString() ?? null,
          lastLogin:  u.lastLoginAt?.toISOString() ?? null,
          orderCount: u._count.orders,
          createdAt:  u.createdAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ employees: [] });
  }
}

// ─── POST /api/employees — Créer un employé (Admin seulement) ─────────────────
// ADMIN role cannot be selected — only SUPERVISOR, AGENT, AGENT_TEST allowed.
export async function POST(request: Request) {
  const caller = await getCaller();
  if (caller?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin uniquement" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      name, phone, role, password,
      iconColor, roleColor,
      paymentRemainingDays, paymentDefaultDays,
      telegramChatId, startDate,
      canViewOrders, canEditOrders,
      canViewUsers,  canEditUsers,
      canViewProducts, canEditProducts,
      canViewStatuses, canEditStatuses,
      canViewReporting, canViewDashboard,
    } = body;

    if (!phone || !role || !password) {
      return NextResponse.json({ error: "Téléphone, rôle et mot de passe requis" }, { status: 400 });
    }

    // Prevent creating another ADMIN via the form
    if (role === "ADMIN") {
      return NextResponse.json({ error: "Impossible de créer un autre Admin via ce formulaire" }, { status: 400 });
    }

    const hashed   = await hashPassword(password);
    const encrypted = encrypt(password); // For admin display

    const employee = await prisma.user.create({
      data: {
        name,
        phone,
        role,
        password: hashed,
        encryptedPassword: encrypted,
        iconColor:  iconColor  ?? "#2563eb",
        roleColor:  roleColor  ?? "#f3f4f6",
        paymentRemainingDays: paymentRemainingDays ?? 0,
        paymentDefaultDays:   paymentDefaultDays   ?? 0,
        paymentStartDate: new Date(),
        startDate:   startDate ? new Date(startDate) : null,
        telegramChatId: telegramChatId || null,
        // Permissions
        canViewOrders:    canViewOrders    ?? false,
        canEditOrders:    canEditOrders    ?? false,
        canViewUsers:     canViewUsers     ?? false,
        canEditUsers:     canEditUsers     ?? false,
        canViewProducts:  canViewProducts  ?? false,
        canEditProducts:  canEditProducts  ?? false,
        canViewStatuses:  canViewStatuses  ?? false,
        canEditStatuses:  canEditStatuses  ?? false,
        canViewReporting: canViewReporting ?? false,
        canViewDashboard: canViewDashboard ?? false,
      },
      include: { _count: { select: { orders: true } } },
    });

    // Transform to match GET format expected by the front-end
    const now2 = new Date();
    const payStart = employee.paymentStartDate ?? employee.createdAt;
    const diffDays  = Math.floor((now2.getTime() - payStart.getTime()) / 86_400_000);
    const remaining = Math.max(0, employee.paymentRemainingDays - diffDays);

    return NextResponse.json({
      employee: {
        id:           employee.id,
        name:         employee.name ?? "Sans nom",
        phone:        employee.phone,
        role:         employee.role,
        status:       "OFFLINE",  // Just created, not yet online
        isActive:     employee.status === "ACTIVE",
        iconColor:    employee.iconColor,
        roleColor:    employee.roleColor,
        paymentRemainingDays: remaining,
        paymentDefaultDays:   employee.paymentDefaultDays,
        startDate:  employee.startDate?.toISOString() ?? null,
        lastLogin:  null,
        telegramChatId:  employee.telegramChatId,
        canViewOrders:   employee.canViewOrders,
        canEditOrders:   employee.canEditOrders,
        canViewUsers:    employee.canViewUsers,
        canEditUsers:    employee.canEditUsers,
        canViewProducts: employee.canViewProducts,
        canEditProducts: employee.canEditProducts,
        canViewStatuses: employee.canViewStatuses,
        canEditStatuses: employee.canEditStatuses,
        canViewReporting: employee.canViewReporting,
        canViewDashboard: employee.canViewDashboard,
        orderCount: employee._count.orders,
        createdAt:  employee.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Ce numéro de téléphone existe déjà" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "Création échouée" }, { status: 500 });
  }
}

// ─── DELETE /api/employees — Suppression groupée (Admin seulement) ────────────
export async function DELETE(request: Request) {
  const caller = await getCaller();
  if (caller?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin uniquement" }, { status: 403 });
  }

  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Aucun ID fourni" }, { status: 400 });
    }
    const { count } = await prisma.user.deleteMany({
      where: {
        id:   { in: ids },
        role: { not: "ADMIN" }, // Sécurité : ne jamais supprimer le main admin
      },
    });
    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Suppression échouée" }, { status: 500 });
  }
}

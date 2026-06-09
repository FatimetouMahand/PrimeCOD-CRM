import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { encrypt } from "@/lib/crypto";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

async function getCaller() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return null;
    return verifyToken(token) as { id: string; role: string };
  } catch { return null; }
}

// ─── PATCH /api/employees/[id] ────────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (caller?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin uniquement" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body   = await request.json();

    const data: Record<string, unknown> = {};

    if ("name"      in body) data.name      = body.name;
    if ("role"      in body) {
      if (body.role === "ADMIN") {
        return NextResponse.json({ error: "Impossible d'assigner le rôle ADMIN" }, { status: 400 });
      }
      data.role = body.role;
    }

    // status (ACTIVE/INACTIVE = suspend/unsuspend)
    if ("status"    in body) data.status    = body.status;
    if ("suspended" in body) data.status    = body.suspended ? "INACTIVE" : "ACTIVE"; // compat

    if ("iconColor"  in body) data.iconColor  = body.iconColor;
    if ("roleColor"  in body) data.roleColor  = body.roleColor;

    if ("paymentRemainingDays" in body) {
      data.paymentRemainingDays = body.paymentRemainingDays;
      data.paymentStartDate     = new Date(); // Reset countdown
    }
    if ("paymentDefaultDays" in body) data.paymentDefaultDays = body.paymentDefaultDays;

    if ("telegramChatId" in body) data.telegramChatId = body.telegramChatId || null;
    if ("startDate" in body) data.startDate = body.startDate ? new Date(body.startDate) : null;

    // Permissions
    const permKeys = [
      "canViewOrders","canEditOrders","canViewUsers","canEditUsers",
      "canViewProducts","canEditProducts","canViewStatuses","canEditStatuses",
      "canViewReporting","canViewDashboard",
    ];
    permKeys.forEach((k) => { if (k in body) data[k] = body[k]; });

    // Password change (also updates encrypted version for admin display)
    if ("password" in body && body.password && body.password.trim() !== "") {
      data.password          = await hashPassword(body.password);
      data.encryptedPassword = encrypt(body.password);
    }

    // Remote disconnect: force isOnline=false
    if (body.forceLogout === true) {
      data.isOnline    = false;
      data.lastLogoutAt = new Date();
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { _count: { select: { orders: true } } },
    });

    return NextResponse.json({ employee: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Mise à jour échouée" }, { status: 500 });
  }
}

// ─── DELETE /api/employees/[id] ───────────────────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (caller?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin uniquement" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Never delete the main ADMIN
    const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (user?.role === "ADMIN") {
      return NextResponse.json({ error: "Impossible de supprimer l'admin principal" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Suppression échouée" }, { status: 500 });
  }
}

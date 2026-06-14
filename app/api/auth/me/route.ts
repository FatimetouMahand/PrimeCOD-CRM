import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return NextResponse.json({ user: null }, { status: 401 });

    const payload = verifyToken(token) as { id: string; iat?: number };
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true, name: true, phone: true, role: true,
        status: true, isOnline: true, iconColor: true,
        lastLogoutAt: true,
        canViewOrders: true, canEditOrders: true,
        canViewUsers: true, canEditUsers: true,
        canViewProducts: true, canEditProducts: true,
        canViewStatuses: true, canEditStatuses: true,
        canViewReporting: true, canViewDashboard: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Déconnexion à distance (page Employés → bouton "Déconnecter à
    // distance") : si l'admin a forcé une déconnexion APRÈS l'émission de
    // ce jeton, on invalide la session même si le cookie est encore valide.
    if (payload.iat && user.lastLogoutAt && user.lastLogoutAt.getTime() > payload.iat * 1000) {
      const res = NextResponse.json({ user: null }, { status: 401 });
      res.cookies.set("crm_token", "", { maxAge: 0, path: "/" });
      return res;
    }

    // Renommage ponctuel : l'admin créé sous l'ancien nom devient "Admin Sou9nkc"
    if (user.role === "ADMIN" && user.name === "Admin PrimeCOD") {
      await prisma.user.update({ where: { id: user.id }, data: { name: "Admin Sou9nkc" } }).catch(() => {});
      user.name = "Admin Sou9nkc";
    }

    // Heartbeat
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), isOnline: true },
    }).catch(() => {});

    return NextResponse.json({
      user: {
        id: user.id, name: user.name, phone: user.phone, role: user.role,
        status: user.status, isOnline: user.isOnline, iconColor: user.iconColor,
        canViewOrders: user.canViewOrders, canEditOrders: user.canEditOrders,
        canViewUsers: user.canViewUsers, canEditUsers: user.canEditUsers,
        canViewProducts: user.canViewProducts, canEditProducts: user.canEditProducts,
        canViewStatuses: user.canViewStatuses, canEditStatuses: user.canEditStatuses,
        canViewReporting: user.canViewReporting, canViewDashboard: user.canViewDashboard,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}

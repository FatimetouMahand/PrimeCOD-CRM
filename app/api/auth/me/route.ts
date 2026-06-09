import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return NextResponse.json({ user: null }, { status: 401 });

    const payload = verifyToken(token) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true, name: true, phone: true, role: true,
        status: true, isOnline: true, iconColor: true,
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

    // Heartbeat
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), isOnline: true },
    }).catch(() => {});

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

// Called every 60s from the client while the dashboard is open.
// Uses the auth cookie — no userId needed in the body.
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return NextResponse.json({ ok: false });

    const payload = verifyToken(token) as { id: string; iat?: number };

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { lastLogoutAt: true },
    });

    // Déconnexion à distance (page Employés → "Déconnecter à distance") :
    // l'admin a forcé une déconnexion APRÈS l'émission de ce jeton.
    if (payload.iat && user?.lastLogoutAt && user.lastLogoutAt.getTime() > payload.iat * 1000) {
      const res = NextResponse.json({ ok: false, forceLogout: true });
      res.cookies.set("crm_token", "", { maxAge: 0, path: "/" });
      return res;
    }

    await prisma.user.update({
      where: { id: payload.id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

// Expires ghost sessions (users who haven't pinged in 2 min).
export async function DELETE() {
  try {
    const threshold = new Date(Date.now() - 2 * 60 * 1000);
    const { count } = await prisma.user.updateMany({
      where: { isOnline: true, lastSeenAt: { lt: threshold } },
      data: { isOnline: false },
    });
    return NextResponse.json({ ok: true, expired: count });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { comparePasswords } from "@/lib/auth/hash";
import { generateToken } from "@/lib/auth/jwt";

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ error: "Téléphone et mot de passe requis" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return NextResponse.json({ error: "Aucun compte trouvé avec ce numéro" }, { status: 401 });
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Votre compte est bloqué. Veuillez contacter l'administrateur." },
        { status: 403 }
      );
    }

    const valid = await comparePasswords(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    // Token includes permissions for fast access checks
    const token = generateToken({
      id:    user.id,
      name:  user.name,
      phone: user.phone,
      role:  user.role,
      // Permissions
      canViewOrders:    user.canViewOrders,
      canEditOrders:    user.canEditOrders,
      canViewUsers:     user.canViewUsers,
      canEditUsers:     user.canEditUsers,
      canViewProducts:  user.canViewProducts,
      canEditProducts:  user.canEditProducts,
      canViewStatuses:  user.canViewStatuses,
      canEditStatuses:  user.canEditStatuses,
      canViewReporting: user.canViewReporting,
      canViewDashboard: user.canViewDashboard,
      iconColor:        user.iconColor,
    });

    // Update last login & mark online
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt:  new Date(),
        lastLogoutAt: null,
        isOnline:     true,
        lastSeenAt:   new Date(),
      },
    });

    const res = NextResponse.json({
      user: {
        id:    user.id,
        name:  user.name,
        phone: user.phone,
        role:  user.role,
        iconColor: user.iconColor,
      },
    });

    res.cookies.set("crm_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path:     "/",
      maxAge:   60 * 60 * 24 * 30, // 30 jours
      secure:   process.env.NODE_ENV === "production",
    });

    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

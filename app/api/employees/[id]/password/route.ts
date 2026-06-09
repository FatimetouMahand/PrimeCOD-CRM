/**
 * GET /api/employees/[id]/password
 * Returns the decrypted password for an employee (admin only).
 * Used by the admin to view an agent's password.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCaller();
  if (caller?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin uniquement" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where:  { id },
      select: { encryptedPassword: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
    }

    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "Impossible de voir le mot de passe de l'admin" }, { status: 403 });
    }

    if (!user.encryptedPassword) {
      return NextResponse.json({ password: null, message: "Mot de passe non chiffré (créé avant la mise à jour)" });
    }

    const password = decrypt(user.encryptedPassword);
    return NextResponse.json({ password });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur lors du déchiffrement" }, { status: 500 });
  }
}

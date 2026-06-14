import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Auto-migration : ajoute la colonne repeatCount si elle n'existe pas encore
// (le build de prod ne lance pas `prisma migrate`). Idempotent, sans risque.
async function ensureRepeatCountColumn() {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Status" ADD COLUMN IF NOT EXISTS "repeatCount" INTEGER'
    );
  } catch {
    // Colonne déjà présente ou base indisponible — on ignore
  }
}

export async function GET() {
  try {
    await ensureRepeatCountColumn();
    // Les statuts supprimés (isArchived) n'apparaissent plus dans les choix
    // (filtres, changement de statut…) mais restent en base : les anciennes
    // commandes qui pointent encore dessus conservent leur étiquette.
    const statuses = await prisma.status.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ statuses });
  } catch {
    return NextResponse.json({ statuses: [] });
  }
}

export async function POST(request: Request) {
  try {
    await ensureRepeatCountColumn();
    const { name, color, alertAfterHours, isFinal, repeatCount } = await request.json();
    if (!name || !color) {
      return NextResponse.json({ error: "Nom et couleur requis" }, { status: 400 });
    }
    const status = await prisma.status.create({
      data: {
        name,
        color,
        isFinal: Boolean(isFinal),
        alertAfterHours: alertAfterHours ? Number(alertAfterHours) : null,
        repeatCount: repeatCount ? Number(repeatCount) : null,
      },
    });
    return NextResponse.json({ status }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

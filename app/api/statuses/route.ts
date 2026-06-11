import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
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
    const { name, color, alertAfterHours, isFinal } = await request.json();
    if (!name || !color) {
      return NextResponse.json({ error: "Nom et couleur requis" }, { status: 400 });
    }
    const status = await prisma.status.create({
      data: {
        name,
        color,
        isFinal: Boolean(isFinal),
        alertAfterHours: alertAfterHours ? Number(alertAfterHours) : null,
      },
    });
    return NextResponse.json({ status }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

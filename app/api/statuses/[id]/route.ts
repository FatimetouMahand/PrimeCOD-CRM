import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const status = await prisma.status.update({
      where: { id },
      data: {
        ...(body.name            !== undefined && { name:           body.name }),
        ...(body.color           !== undefined && { color:          body.color }),
        ...(body.isActive        !== undefined && { isActive:       body.isActive }),
        ...(body.isFinal         !== undefined && { isFinal:        Boolean(body.isFinal) }),
        ...(body.alertAfterHours !== undefined && {
          alertAfterHours: body.alertAfterHours ? Number(body.alertAfterHours) : null,
        }),
      },
    });
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Suppression logique (isArchived) : le statut disparaît des choix futurs
    // (formulaire d'ajout/édition, filtres, changement de statut...) mais les
    // commandes existantes qui le référencent encore conservent leur étiquette.
    // On désactive aussi isActive pour que ce statut ne soit plus jamais
    // sélectionné comme statut par défaut des nouvelles commandes
    // (cf. ensureStatuses() dans les webhooks Shopify).
    const status = await prisma.status.update({
      where: { id },
      data: { isArchived: true, isActive: false },
    });
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

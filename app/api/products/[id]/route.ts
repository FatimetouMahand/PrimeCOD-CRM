import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, price, distributionType, agentIds, hiddenAgentIds } = await request.json();

    // Update product fields. assignedAgentIds / hiddenForAgentIds sont les
    // champs réellement utilisés par la distribution des commandes
    // (app/api/orders/distribute + webhook Shopify) — on les écrit
    // directement au lieu de la table de jointure ProductAgent (ignorée
    // par la distribution).
    await prisma.product.update({
      where: { id },
      data: {
        ...(name  !== undefined ? { name  } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(distributionType !== undefined ? { distributionType } : {}),
        ...(agentIds       !== undefined ? { assignedAgentIds:  { set: agentIds } } : {}),
        ...(hiddenAgentIds !== undefined ? { hiddenForAgentIds: { set: hiddenAgentIds } } : {}),
      },
    });

    const updated = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

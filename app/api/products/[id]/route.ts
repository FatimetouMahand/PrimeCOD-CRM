import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, price, distributionType, agentIds } = await request.json();

    // Update product fields
    await prisma.product.update({
      where: { id },
      data: {
        ...(name  !== undefined ? { name  } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(distributionType !== undefined ? { distributionType } : {}),
      },
    });

    // Sync agent assignments if provided
    if (agentIds !== undefined) {
      await prisma.productAgent.deleteMany({ where: { productId: id } });
      if (agentIds.length > 0) {
        await prisma.productAgent.createMany({
          data: agentIds.map((agentId: string) => ({ productId: id, agentId })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
        agents: { include: { agent: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

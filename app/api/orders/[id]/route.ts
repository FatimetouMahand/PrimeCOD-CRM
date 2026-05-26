import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: { agentId?: string | null; statusId?: string } = {};
    if ("agentId"  in body) data.agentId  = body.agentId  || null;
    if ("statusId" in body) data.statusId = body.statusId;

    const updated = await prisma.order.update({
      where: { id },
      data,
      include: { agent: true, status: true, product: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

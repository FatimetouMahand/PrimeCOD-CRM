import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function generateCode(name: string): string {
  const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X").padEnd(3, "X");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        _count: { select: { orders: true } },
        agents: { include: { agent: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ products });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ products: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { name, price, distributionType, agentIds } = await request.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    // Auto-generate unique code
    let code = generateCode(name);
    let attempts = 0;
    while (await prisma.product.findUnique({ where: { code } }) && attempts < 10) {
      code = generateCode(name);
      attempts++;
    }

    const product = await prisma.product.create({
      data: {
        name,
        code,
        price: price ?? 0,
        distributionType: distributionType ?? "random",
        agents: agentIds?.length
          ? { create: agentIds.map((id: string) => ({ agentId: id })) }
          : undefined,
      },
      include: {
        _count: { select: { orders: true } },
        agents: { include: { agent: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs" }, { status: 400 });
    }
    const { count } = await prisma.product.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

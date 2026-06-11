import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

async function getCallerRole(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return null;
    const p = verifyToken(token) as { role: string };
    return p.role;
  } catch { return null; }
}

function generateCode(name: string): string {
  const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X").padEnd(3, "X");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

export async function GET() {
  try {
    // Migration ponctuelle : avant correctif, les affectations "Distribution
    // spécifique" étaient enregistrées uniquement dans la table de jointure
    // ProductAgent — un champ jamais lu par la distribution réelle des
    // commandes (app/api/orders/distribute + webhook Shopify, qui se basent
    // sur assignedAgentIds). On recopie ces anciennes affectations pour
    // qu'elles redeviennent actives, sans perdre la configuration existante.
    try {
      const legacy = await prisma.product.findMany({
        where: { distributionType: "specific", assignedAgentIds: { isEmpty: true } },
        include: { agents: { select: { agentId: true } } },
      });
      for (const p of legacy) {
        if (p.agents.length > 0) {
          await prisma.product.update({
            where: { id: p.id },
            data: { assignedAgentIds: { set: p.agents.map((a) => a.agentId) } },
          });
        }
      }
    } catch (migErr) {
      console.error("Product agent migration failed:", migErr);
    }

    const products = await prisma.product.findMany({
      include: { _count: { select: { orders: true } } },
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
    const { name, price, distributionType, agentIds, hiddenAgentIds } = await request.json();
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
        // Champs réellement utilisés par la distribution des commandes
        // (app/api/orders/distribute + webhook Shopify)
        assignedAgentIds: agentIds ?? [],
        hiddenForAgentIds: hiddenAgentIds ?? [],
      },
      include: { _count: { select: { orders: true } } },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

// Modification groupée (Actions groupées) — applique des changements à
// plusieurs produits sélectionnés en une seule requête.
export async function PATCH(request: Request) {
  try {
    const { ids, price, distributionType, agentIds, hiddenAgentIds } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (price !== undefined)            data.price = price;
    if (distributionType !== undefined) data.distributionType = distributionType;
    if (agentIds !== undefined)         data.assignedAgentIds = { set: agentIds };
    if (hiddenAgentIds !== undefined)   data.hiddenForAgentIds = { set: hiddenAgentIds };

    if (Object.keys(data).length > 0) {
      await prisma.product.updateMany({ where: { id: { in: ids } }, data });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { orders: true } } },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Bulk update failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const role = await getCallerRole();
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — Admin only" }, { status: 403 });
  }
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs" }, { status: 400 });
    }
    // Check if any product has linked orders
    const withOrders = await prisma.product.findMany({
      where: { id: { in: ids }, orders: { some: {} } },
      select: { name: true },
    });
    if (withOrders.length > 0) {
      return NextResponse.json({
        error: `Cannot delete: ${withOrders.map(p => p.name).join(", ")} still have orders linked`,
      }, { status: 409 });
    }
    const { count } = await prisma.product.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

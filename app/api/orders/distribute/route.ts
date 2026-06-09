import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { notifyAgentNewOrder } from "@/lib/telegram";

const ONLINE_MS = 2 * 60 * 1000;

async function selectAgent(productId: string): Promise<string | null> {
  const threshold = new Date(Date.now() - ONLINE_MS);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { agents: { include: { agent: true } } },
  });
  if (!product) return null;

  const { assignedAgentIds, hiddenForAgentIds } = product;

  // Fetch all eligible agents
  const allAgents = await prisma.user.findMany({
    where: {
      role:      { in: ["AGENT", "AGENT_TEST"] },
      status:    "ACTIVE",
      isOnline:  true,
      lastSeenAt: { gte: threshold },
    },
    select: { id: true, name: true },
  });

  const activeRequired = assignedAgentIds.filter(id => allAgents.some(a => a.id === id));

  let eligibleAgents = activeRequired.length > 0
    ? allAgents.filter(a => activeRequired.includes(a.id) && !hiddenForAgentIds.includes(a.id))
    : allAgents.filter(a => !hiddenForAgentIds.includes(a.id));

  if (eligibleAgents.length === 0) return null;

  const counts = await Promise.all(
    eligibleAgents.map(async (a) => ({
      id:    a.id,
      name:  a.name ?? "Agent",
      count: await prisma.order.count({ where: { agentId: a.id, status: { isFinal: false } } }),
    }))
  );

  counts.sort((a, b) => a.count - b.count);
  return counts[0].id;
}

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const agentId = await selectAgent(order.productId);
    if (!agentId) {
      return NextResponse.json({ message: "Aucun agent disponible", agentId: null });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data:  { agentId, assignedAt: new Date() },
      include: { agent: true },
    });

    // Telegram notification
    if (updated.agent?.telegramChatId) {
      await notifyAgentNewOrder(
        updated.agent.name ?? "Agent",
        updated.agent.telegramChatId,
        order.orderNumber ?? 0,
        order.product.name
      );
    }

    return NextResponse.json({ success: true, agentId, agent: updated.agent });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Distribution échouée" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") ?? "";
    const agentId = await selectAgent(productId);
    return NextResponse.json({ agentId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ agentId: null });
  }
}

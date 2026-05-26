import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const ONLINE_MS = 2 * 60 * 1000; // 2 minutes

// Select best agent for a product using load balancing.
// "Best" = online, non-suspended, fewest unconfirmed orders.
async function selectAgent(productId: string): Promise<string | null> {
  const threshold = new Date(Date.now() - ONLINE_MS);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      agents: { include: { agent: true } },
    },
  });
  if (!product) return null;

  let eligibleAgents: { id: string; name: string }[] = [];

  if (product.distributionType === "specific" && product.agents.length > 0) {
    // Only agents assigned to this product
    eligibleAgents = product.agents
      .filter(
        (pa) =>
          !pa.agent.suspended &&
          pa.agent.isOnline &&
          pa.agent.lastSeenAt &&
          pa.agent.lastSeenAt >= threshold
      )
      .map((pa) => ({ id: pa.agent.id, name: pa.agent.name }));
  } else {
    // All online non-suspended agents (random distribution)
    eligibleAgents = await prisma.user.findMany({
      where: {
        role: "Agent",
        suspended: false,
        isOnline: true,
        lastSeenAt: { gte: threshold },
      },
      select: { id: true, name: true },
    });
  }

  if (eligibleAgents.length === 0) return null;

  // Count active (non-final) orders per eligible agent
  const counts = await Promise.all(
    eligibleAgents.map(async (a) => ({
      id: a.id,
      count: await prisma.order.count({
        where: {
          agentId: a.id,
          status: { isFinal: false },
        },
      }),
    }))
  );

  // Pick agent with minimum unconfirmed count
  counts.sort((a, b) => a.count - b.count);
  return counts[0].id;
}

// POST /api/orders/distribute
// Body: { orderId }
// Assigns the order to the best available agent
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const agentId = await selectAgent(order.productId);

    if (!agentId) {
      return NextResponse.json({
        message: "No online agents available — order queued",
        agentId: null,
      });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { agentId },
      include: { agent: true },
    });

    return NextResponse.json({ success: true, agentId, agent: updated.agent });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Distribution failed" }, { status: 500 });
  }
}

// GET /api/orders/distribute?productId=xxx
// Returns the best agent for a product (preview without assigning)
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

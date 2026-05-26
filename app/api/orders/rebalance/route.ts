import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const ONLINE_MS = 2 * 60 * 1000;

// POST /api/orders/rebalance
// Called every 5 minutes by the dashboard layout.
// 1. Marks offline any user who hasn't pinged in 2 min.
// 2. Takes unconfirmed orders from offline agents → reassigns.
// 3. Balances load among online agents (if one finishes, spread from overloaded).
export async function POST() {
  try {
    const threshold = new Date(Date.now() - ONLINE_MS);

    // Step 1 — expire ghost sessions
    await prisma.user.updateMany({
      where: { isOnline: true, lastSeenAt: { lt: threshold } },
      data: { isOnline: false },
    });

    // Step 2 — get online agents
    const onlineAgents = await prisma.user.findMany({
      where: {
        role: "Agent",
        suspended: false,
        isOnline: true,
        lastSeenAt: { gte: threshold },
      },
      select: { id: true },
    });

    if (onlineAgents.length === 0) {
      return NextResponse.json({ message: "No online agents", reassigned: 0 });
    }

    const onlineIds = onlineAgents.map((a) => a.id);

    // Step 3 — pull orphan orders (from offline agents, non-terminal status)
    const orphans = await prisma.order.findMany({
      where: {
        agentId: { notIn: onlineIds },
        NOT: { agentId: null },
        status: { isFinal: false },   // ← ne pas redistribuer les commandes terminées
      },
      select: { id: true },
    });

    // Step 4 — count active (non-terminal) orders per online agent
    const agentLoad = await Promise.all(
      onlineAgents.map(async (a) => ({
        id: a.id,
        count: await prisma.order.count({
          where: {
            agentId: a.id,
            status: { isFinal: false }, // ← seulement les commandes actives
          },
        }),
      }))
    );

    const totalOrders =
      agentLoad.reduce((s, a) => s + a.count, 0) + orphans.length;
    const target = Math.ceil(totalOrders / onlineAgents.length);

    // Step 5 — collect orders to redistribute
    const toRedistribute: string[] = orphans.map((o) => o.id);

    for (const agent of agentLoad) {
      if (agent.count > target) {
        const excess = agent.count - target;
        const excessOrders = await prisma.order.findMany({
          where: {
            agentId: agent.id,
            status: { isFinal: false },
          },
          take: excess,
          orderBy: { createdAt: "asc" }, // oldest first
          select: { id: true },
        });
        toRedistribute.push(...excessOrders.map((o) => o.id));
        agent.count -= excess;
      }
    }

    if (toRedistribute.length === 0) {
      return NextResponse.json({ message: "Already balanced", reassigned: 0 });
    }

    // Step 6 — fill up agents below target
    agentLoad.sort((a, b) => a.count - b.count);
    let idx = 0;
    let reassigned = 0;

    for (const agent of agentLoad) {
      while (agent.count < target && idx < toRedistribute.length) {
        await prisma.order.update({
          where: { id: toRedistribute[idx] },
          data: { agentId: agent.id },
        });
        agent.count++;
        idx++;
        reassigned++;
      }
      if (idx >= toRedistribute.length) break;
    }

    return NextResponse.json({ success: true, reassigned, target });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Rebalance failed" }, { status: 500 });
  }
}

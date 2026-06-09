import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const ONLINE_MS = 2 * 60 * 1000;

export async function POST() {
  try {
    const threshold = new Date(Date.now() - ONLINE_MS);

    // Step 1 — expire ghost sessions
    await prisma.user.updateMany({
      where: { isOnline: true, lastSeenAt: { lt: threshold } },
      data:  { isOnline: false },
    });

    // Step 2 — get online agents
    const onlineAgents = await prisma.user.findMany({
      where: {
        role:      { in: ["AGENT", "AGENT_TEST"] },
        status:    "ACTIVE",
        isOnline:  true,
        lastSeenAt: { gte: threshold },
      },
      select: { id: true },
    });

    if (onlineAgents.length === 0) {
      return NextResponse.json({ message: "No online agents", reassigned: 0 });
    }

    const onlineIds = onlineAgents.map((a) => a.id);

    // Step 3 — orphan orders (from offline agents, non-terminal status)
    const orphans = await prisma.order.findMany({
      where: {
        agentId: { notIn: onlineIds },
        NOT:     { agentId: null },
        status:  { isFinal: false },
      },
      select: { id: true },
    });

    // Step 4 — count active orders per online agent
    const agentLoad = await Promise.all(
      onlineAgents.map(async (a) => ({
        id:    a.id,
        count: await prisma.order.count({ where: { agentId: a.id, status: { isFinal: false } } }),
      }))
    );

    const totalOrders  = agentLoad.reduce((s, a) => s + a.count, 0) + orphans.length;
    const target       = Math.ceil(totalOrders / onlineAgents.length);

    const toRedistribute: string[] = orphans.map((o) => o.id);

    for (const agent of agentLoad) {
      if (agent.count > target) {
        const excess = agent.count - target;
        const excessOrders = await prisma.order.findMany({
          where:   { agentId: agent.id, status: { isFinal: false } },
          take:    excess,
          orderBy: { createdAt: "asc" },
          select:  { id: true },
        });
        toRedistribute.push(...excessOrders.map((o) => o.id));
        agent.count -= excess;
      }
    }

    if (toRedistribute.length === 0) {
      return NextResponse.json({ message: "Already balanced", reassigned: 0 });
    }

    agentLoad.sort((a, b) => a.count - b.count);
    let idx = 0;
    let reassigned = 0;

    for (const agent of agentLoad) {
      while (agent.count < target && idx < toRedistribute.length) {
        await prisma.order.update({
          where: { id: toRedistribute[idx] },
          data:  { agentId: agent.id },
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

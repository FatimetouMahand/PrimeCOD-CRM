import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter  = searchParams.get("filter")  || "Today";
    const product = searchParams.get("product");

    // Check caller role — Agent sees only their own stats
    let callerRole = "ADMIN";
    let callerId   = "";
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("crm_token")?.value;
      if (token) {
        const payload = verifyToken(token) as { id: string; role: string };
        callerRole = payload.role;
        callerId   = payload.id;
      }
    } catch { /* keep defaults */ }

    const now = new Date();
    let startDate: Date | undefined;

    if (filter === "Today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filter === "This Week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === "This Month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const whereClause = {
      ...(product && product !== "All Products"
        ? { product: { name: product } }
        : {}),
      ...(startDate ? { createdAt: { gte: startDate } } : {}),
      // Agent sees only their own orders
      ...((callerRole === "AGENT" || callerRole === "AGENT_TEST") ? { agentId: callerId } : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: { product: true, status: true, agent: true },
      orderBy: { createdAt: "desc" },
    });

    // Yesterday for growth comparison
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        ...(product && product !== "All Products"
          ? { product: { name: product } }
          : {}),
        createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
      },
    });

    const totalOrders = orders.length;
    const revenue = orders.reduce((acc, o) => acc + o.revenue, 0);
    const yesterdayRevenue = yesterdayOrders.reduce((acc, o) => acc + o.revenue, 0);

    const revenueGrowth =
      yesterdayRevenue === 0
        ? revenue > 0 ? 100 : 0
        : Number((((revenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1));

    const ordersGrowth =
      yesterdayOrders.length === 0
        ? totalOrders > 0 ? 100 : 0
        : Number((((totalOrders - yesterdayOrders.length) / yesterdayOrders.length) * 100).toFixed(1));

    // Confirmed = statuts marqués comme finaux (isFinal: true)
    // Pending = statuts non-finaux (en attente, rappel, ne répond pas…)
    const confirmed = orders.filter((o) => o.status?.isFinal === true).length;
    const pending = orders.filter((o) => o.status?.isFinal === false).length;
    const confirmationRate =
      totalOrders > 0
        ? Number(((confirmed / totalOrders) * 100).toFixed(1))
        : 0;

    // Status stats
    const groupedStatuses: Record<string, number> = {};
    orders.forEach((o) => {
      const name = o.status?.name || "Unknown";
      groupedStatuses[name] = (groupedStatuses[name] || 0) + 1;
    });
    const statusStats = Object.entries(groupedStatuses).map(([name, value]) => ({ name, value }));

    // Top products
    const productCounts: Record<string, number> = {};
    orders.forEach((o) => {
      const name = o.product?.name || "Unknown";
      productCounts[name] = (productCounts[name] || 0) + 1;
    });
    const topProducts = Object.entries(productCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top agents
    const agentCounts: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.agent) {
        const agentName = o.agent.name ?? "Agent";
        agentCounts[agentName] = (agentCounts[agentName] || 0) + 1;
      }
    });
    const topAgents = Object.entries(agentCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Revenue chart — last 7 days
    const revenueChart: { day: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59);
      const dayRevenue = orders
        .filter((o) => {
          const od = new Date(o.createdAt);
          return od >= d && od <= dEnd;
        })
        .reduce((acc, o) => acc + o.revenue, 0);

      revenueChart.push({
        day: d.toLocaleDateString("en", { weekday: "short" }),
        revenue: dayRevenue,
      });
    }

    return NextResponse.json({
      totalOrders,
      revenue,
      confirmationRate,
      pendingOrders: pending,
      statusStats,
      revenueGrowth,
      ordersGrowth,
      topProducts,
      topAgents,
      revenueChart,
      recentOrders: orders.slice(0, 20).map((o) => ({
        id: o.id,
        customer: o.customer,
        city: o.city,
        status: o.status?.name,
        amount: o.revenue,
        product: o.product?.name,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      totalOrders: 0,
      revenue: 0,
      confirmationRate: 0,
      pendingOrders: 0,
      revenueGrowth: 0,
      ordersGrowth: 0,
      statusStats: [],
      topProducts: [],
      topAgents: [],
      revenueChart: [],
      recentOrders: [],
    });
  }
}

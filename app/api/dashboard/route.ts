import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter      = searchParams.get("filter")  || "Today";
    const product     = searchParams.get("product");                    // ancien filtre (1 seul produit) — conservé pour compatibilité
    const productIds  = (searchParams.get("productIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);                                                  // nouveau : sélection multi-produits
    const dateFrom    = searchParams.get("dateFrom") || "";              // "Custom Range"
    const dateTo      = searchParams.get("dateTo")   || "";

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
    let endDate: Date | undefined;

    if (filter === "Today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filter === "This Week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === "This Month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === "Custom Range" && dateFrom) {
      startDate = new Date(dateFrom);
      startDate.setHours(0, 0, 0, 0);
      if (dateTo) {
        endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    // Filtre produit(s) — multi-sélection (productIds) prioritaire sur l'ancien filtre simple
    const productFilter =
      productIds.length > 0
        ? { productId: { in: productIds } }
        : product && product !== "All Products"
          ? { product: { name: product } }
          : {};

    // Agent : ne voit que ses propres commandes
    const agentFilter =
      callerRole === "AGENT" || callerRole === "AGENT_TEST" ? { agentId: callerId } : {};

    const whereClause = {
      ...productFilter,
      ...agentFilter,
      ...(startDate
        ? { createdAt: { gte: startDate, ...(endDate ? { lte: endDate } : {}) } }
        : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: { product: true, status: true, agent: true },
      orderBy: { createdAt: "desc" },
    });

    // ── Période précédente (pour les indicateurs de croissance "+X% / -X% vs hier") ──
    let prevOrders: {
      revenue: number;
      processingTimeMin: number | null;
      status: { isFinal: boolean } | null;
    }[] = [];
    if (startDate) {
      let prevStart: Date;
      let prevEnd: Date;
      if (endDate) {
        // Plage personnalisée → on compare avec une plage de même durée juste avant
        const span = endDate.getTime() - startDate.getTime();
        prevEnd   = new Date(startDate.getTime() - 1);
        prevStart = new Date(startDate.getTime() - span - 1);
      } else {
        // Today / This Week / This Month → comparaison avec la veille (1 jour complet)
        prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        prevEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      }
      prevOrders = await prisma.order.findMany({
        where: { ...productFilter, ...agentFilter, createdAt: { gte: prevStart, lte: prevEnd } },
        select: { revenue: true, processingTimeMin: true, status: { select: { isFinal: true } } },
      });
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    const growth = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : Number((((curr - prev) / prev) * 100).toFixed(1));

    const totalOrders = orders.length;
    const revenue = orders.reduce((acc, o) => acc + o.revenue, 0);

    // Confirmed = statuts marqués comme finaux (Confirmée, Rejetée…)
    // Pending = statuts non-finaux (En attente, Ne répond pas…)
    const confirmedOrders = orders.filter((o) => o.status?.isFinal === true);
    const pendingOrders   = orders.filter((o) => o.status?.isFinal === false);
    const confirmed = confirmedOrders.length;
    const pending   = pendingOrders.length;
    const processedRevenue = confirmedOrders.reduce((acc, o) => acc + o.revenue, 0);

    const confirmationRate =
      totalOrders > 0 ? Number(((confirmed / totalOrders) * 100).toFixed(1)) : 0;

    const processingTimes = orders
      .map((o) => o.processingTimeMin)
      .filter((v): v is number => v != null);
    const avgProcessingTimeMin =
      processingTimes.length > 0
        ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
        : null;

    // ── Croissance vs période précédente ──────────────────────────────────
    let revenueGrowth = 0;
    let ordersGrowth  = 0;
    let confirmationRateGrowth: number | null = null;
    let pendingGrowth: number | null = null;
    let processedGrowth: number | null = null;
    let processedRevenueGrowth: number | null = null;
    let avgProcessingGrowth: number | null = null;

    if (startDate) {
      const prevTotal   = prevOrders.length;
      const prevRevenue = prevOrders.reduce((acc, o) => acc + o.revenue, 0);
      const prevConfirmedOrders = prevOrders.filter((o) => o.status?.isFinal === true);
      const prevPendingOrders   = prevOrders.filter((o) => o.status?.isFinal === false);
      const prevConfirmed = prevConfirmedOrders.length;
      const prevPending   = prevPendingOrders.length;
      const prevProcessedRevenue = prevConfirmedOrders.reduce((acc, o) => acc + o.revenue, 0);
      const prevConfirmationRate = prevTotal > 0 ? (prevConfirmed / prevTotal) * 100 : 0;
      const prevProcessingTimes = prevOrders
        .map((o) => o.processingTimeMin)
        .filter((v): v is number => v != null);
      const prevAvgProcessing =
        prevProcessingTimes.length > 0
          ? prevProcessingTimes.reduce((a, b) => a + b, 0) / prevProcessingTimes.length
          : null;

      revenueGrowth = growth(revenue, prevRevenue);
      ordersGrowth  = growth(totalOrders, prevTotal);
      confirmationRateGrowth = Number((confirmationRate - prevConfirmationRate).toFixed(1));
      pendingGrowth   = growth(pending, prevPending);
      processedGrowth = growth(confirmed, prevConfirmed);
      processedRevenueGrowth = growth(processedRevenue, prevProcessedRevenue);
      avgProcessingGrowth =
        avgProcessingTimeMin != null && prevAvgProcessing != null
          ? growth(avgProcessingTimeMin, Math.round(prevAvgProcessing))
          : null;
    }

    // ── "À rappeler" — global, indépendant du filtre de date (CLAUDE.md) ────
    const toRecall = await prisma.order.count({
      where: { ...productFilter, ...agentFilter, recallAt: { lt: now } },
    });

    // ── Détail par statut : nom, nombre, pourcentage, revenu, couleur ───────
    const statusGroups: Record<string, { value: number; revenue: number; color?: string }> = {};
    orders.forEach((o) => {
      const name = o.status?.name || "Sans statut";
      if (!statusGroups[name]) statusGroups[name] = { value: 0, revenue: 0, color: o.status?.color };
      statusGroups[name].value   += 1;
      statusGroups[name].revenue += o.revenue;
    });
    const statusStats = Object.entries(statusGroups).map(([name, s]) => ({
      name,
      value: s.value,
      percentage: totalOrders > 0 ? Number(((s.value / totalOrders) * 100).toFixed(1)) : 0,
      revenue: s.revenue,
      color: s.color,
    }));

    // ── Meilleurs produits : commandes, pièces vendues, taux de confirmation ──
    const productGroups: Record<string, { total: number; unitsSold: number; confirmed: number }> = {};
    orders.forEach((o) => {
      const name = o.product?.name || "Unknown";
      if (!productGroups[name]) productGroups[name] = { total: 0, unitsSold: 0, confirmed: 0 };
      productGroups[name].total     += 1;
      productGroups[name].unitsSold += o.quantity;
      if (o.status?.isFinal) productGroups[name].confirmed += 1;
    });
    const topProducts = Object.entries(productGroups)
      .map(([name, p]) => ({
        name,
        total: p.total,
        unitsSold: p.unitsSold,
        confirmationRate: p.total > 0 ? Number(((p.confirmed / p.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // ── Meilleurs agents : leads reçus, confirmés, taux, temps moyen ─────────
    const agentGroups: Record<string, { total: number; confirmed: number; procTimes: number[] }> = {};
    orders.forEach((o) => {
      if (!o.agent) return;
      const name = o.agent.name ?? "Agent";
      if (!agentGroups[name]) agentGroups[name] = { total: 0, confirmed: 0, procTimes: [] };
      agentGroups[name].total += 1;
      if (o.status?.isFinal) agentGroups[name].confirmed += 1;
      if (o.processingTimeMin != null) agentGroups[name].procTimes.push(o.processingTimeMin);
    });
    const topAgents = Object.entries(agentGroups)
      .map(([name, a]) => ({
        name,
        total: a.total,
        confirmed: a.confirmed,
        confirmationRate: a.total > 0 ? Number(((a.confirmed / a.total) * 100).toFixed(1)) : 0,
        avgProcessingTimeMin:
          a.procTimes.length > 0
            ? Math.round(a.procTimes.reduce((x, y) => x + y, 0) / a.procTimes.length)
            : null,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // ── Taux de confirmation selon le temps de traitement (1er appel) ────────
    // "quel est le taux de confirmation pour les clients appelés après 5 minutes vs 30 minutes"
    const delayBuckets = [
      { label: "< 5 min",   max: 5 },
      { label: "5-30 min",  max: 30 },
      { label: "30-60 min", max: 60 },
      { label: "> 1h",      max: Infinity },
    ];
    const confirmationByDelay = delayBuckets.map((b, i) => {
      const min = i === 0 ? -1 : delayBuckets[i - 1].max;
      const inBucket = orders.filter(
        (o) => o.processingTimeMin != null && o.processingTimeMin > min && o.processingTimeMin <= b.max
      );
      const confirmedInBucket = inBucket.filter((o) => o.status?.isFinal === true).length;
      return {
        label: b.label,
        total: inBucket.length,
        confirmationRate:
          inBucket.length > 0 ? Number(((confirmedInBucket / inBucket.length) * 100).toFixed(1)) : 0,
      };
    });

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
      processedOrders: confirmed,
      processedRevenue,
      avgProcessingTimeMin,
      toRecall,
      statusStats,
      revenueGrowth,
      ordersGrowth,
      confirmationRateGrowth,
      pendingGrowth,
      processedGrowth,
      processedRevenueGrowth,
      avgProcessingGrowth,
      topProducts,
      topAgents,
      revenueChart,
      confirmationByDelay,
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
      processedOrders: 0,
      processedRevenue: 0,
      avgProcessingTimeMin: null,
      toRecall: 0,
      revenueGrowth: 0,
      ordersGrowth: 0,
      confirmationRateGrowth: null,
      pendingGrowth: null,
      processedGrowth: null,
      processedRevenueGrowth: null,
      avgProcessingGrowth: null,
      statusStats: [],
      topProducts: [],
      topAgents: [],
      revenueChart: [],
      confirmationByDelay: [],
      recentOrders: [],
    });
  }
}

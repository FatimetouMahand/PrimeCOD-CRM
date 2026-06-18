import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

const LIMIT = 50;

// Get caller identity from cookie
async function getCaller() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return null;
    const payload = verifyToken(token) as { id: string; role: string };
    return payload;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor    = searchParams.get("cursor");
  const search    = searchParams.get("search")    || "";
  const statusId  = searchParams.get("statusId")  || "";
  const productId = searchParams.get("productId") || "";
  const agentId   = searchParams.get("agentId")   || ""; // "" = tous · "none" = sans agent · id = agent précis
  const dateFrom  = searchParams.get("dateFrom")  || ""; // YYYY-MM-DD
  const dateTo    = searchParams.get("dateTo")    || ""; // YYYY-MM-DD

  const caller = await getCaller();

  // Build date range filter
  let createdAtFilter: Record<string, Date> | undefined;
  if (dateFrom || dateTo) {
    createdAtFilter = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      d.setHours(0, 0, 0, 0);
      createdAtFilter.gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      createdAtFilter.lte = d;
    }
  }

  // statusId : "none" → commandes sans statut (non traitées)
  const statusFilter = statusId === "none" ? { statusId: null } : statusId ? { statusId } : {};
  // agentId : "none" → commandes sans agent (visibles seulement par l'admin)
  const agentFilter  = agentId === "none" ? { agentId: null } : agentId ? { agentId } : {};

  const where: Record<string, unknown> = {
    ...(search ? {
      OR: [
        { customer: { contains: search, mode: "insensitive" as const } },
        { phone:    { contains: search } },
      ],
    } : {}),
    ...statusFilter,
    ...agentFilter,
    ...(productId        ? { productId }                       : {}),
    ...(createdAtFilter  ? { createdAt: createdAtFilter }      : {}),
  };

  // Role-based filtering
  if (caller?.role === "AGENT" || caller?.role === "AGENT_TEST") {
    // Agent sees only their own orders
    where.agentId = caller.id;
    // Agent does NOT see orders with incomplete phone numbers (< 8 chars)
    where.NOT = { phone: { equals: "" } };
  }

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        take: LIMIT + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where,
        include: { product: true, status: true, agent: true },
        orderBy: { createdAt: "desc" },
      }),
      !cursor ? prisma.order.count({ where }) : Promise.resolve(null),
    ]);

    const hasMore   = orders.length > LIMIT;
    const data      = hasMore ? orders.slice(0, -1) : orders;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    let stats = null;
    if (!cursor && total !== null) {
      // "À rappeler" = commandes dont le rappel programmé est dépassé,
      // sans tenir compte du filtre de date (besoin global, comme l'ancien système)
      const whereNoDate: Record<string, unknown> = { ...where };
      delete whereNoDate.createdAt;

      // Identifier les statuts « Confirmée » (par le nom, insensible à la casse).
      const confirmedStatuses = await prisma.status.findMany({
        where: { name: { contains: "confirm", mode: "insensitive" } },
        select: { id: true },
      });
      const confirmedIds = confirmedStatuses.map(s => s.id);
      const confirmedWhere = { ...where, statusId: { in: confirmedIds.length ? confirmedIds : ["__none__"] } };

      // confirmed  = commandes au statut « Confirmée »
      // processed  = commandes TRAITÉES (un statut posé) → base du taux de confirmation
      // pending    = commandes non traitées (aucun statut)
      // revenue    = total des commandes CONFIRMÉES uniquement
      const [confirmed, processed, pending, rev, procAgg, toRecall] = await Promise.all([
        prisma.order.count({ where: confirmedWhere }),
        prisma.order.count({ where: { ...where, NOT: [{ statusId: null }] } }),
        prisma.order.count({ where: { ...where, statusId: null } }),
        prisma.order.aggregate({ where: confirmedWhere, _sum: { revenue: true } }),
        prisma.order.aggregate({ where: { ...where, processingTimeMin: { not: null } }, _avg: { processingTimeMin: true } }),
        prisma.order.count({ where: { ...whereNoDate, recallAt: { lt: new Date() } } }),
      ]);

      const revenue = rev._sum.revenue ?? 0;
      // Taux de confirmation = confirmées / traitées (ex. 5 confirmées sur 50 traitées = 10%)
      const confirmationRate = processed > 0 ? Number(((confirmed / processed) * 100).toFixed(1)) : 0;
      const avgProcessingTimeMin = procAgg._avg.processingTimeMin != null
        ? Math.round(procAgg._avg.processingTimeMin)
        : null;

      stats = {
        total, confirmed, pending, revenue,
        confirmationRate, avgProcessingTimeMin, toRecall,
        totalGrowth: null as number | null,
        revenueGrowth: null as number | null,
        confirmedGrowth: null as number | null,
        pendingGrowth: null as number | null,
        confirmationRateGrowth: null as number | null,
        avgProcessingGrowth: null as number | null,
      };

      // ── Croissance vs période précédente (même intervalle, décalé de -1 jour) ──
      // Permet d'afficher les indicateurs +X% / -X% par rapport à hier (CLAUDE.md)
      if (createdAtFilter?.gte && createdAtFilter?.lte) {
        const dayMs = 24 * 60 * 60 * 1000;
        const prevWhere: Record<string, unknown> = {
          ...where,
          createdAt: {
            gte: new Date(createdAtFilter.gte.getTime() - dayMs),
            lte: new Date(createdAtFilter.lte.getTime() - dayMs),
          },
        };

        const prevConfirmedWhere = { ...prevWhere, statusId: { in: confirmedIds.length ? confirmedIds : ["__none__"] } };
        const [prevTotal, prevConfirmed, prevProcessed, prevPending, prevRev, prevProcAgg] = await Promise.all([
          prisma.order.count({ where: prevWhere }),
          prisma.order.count({ where: prevConfirmedWhere }),
          prisma.order.count({ where: { ...prevWhere, NOT: [{ statusId: null }] } }),
          prisma.order.count({ where: { ...prevWhere, statusId: null } }),
          prisma.order.aggregate({ where: prevConfirmedWhere, _sum: { revenue: true } }),
          prisma.order.aggregate({ where: { ...prevWhere, processingTimeMin: { not: null } }, _avg: { processingTimeMin: true } }),
        ]);

        const prevRevenue = prevRev._sum.revenue ?? 0;
        const prevConfirmationRate = prevProcessed > 0 ? (prevConfirmed / prevProcessed) * 100 : 0;
        const prevAvgProcessing = prevProcAgg._avg.processingTimeMin ?? null;

        const growth = (curr: number, prev: number) =>
          prev === 0 ? (curr > 0 ? 100 : 0) : Number((((curr - prev) / prev) * 100).toFixed(1));

        stats.totalGrowth     = growth(total, prevTotal);
        stats.revenueGrowth   = growth(revenue, prevRevenue);
        stats.confirmedGrowth = growth(confirmed, prevConfirmed);
        stats.pendingGrowth   = growth(pending, prevPending);
        stats.confirmationRateGrowth = Number((confirmationRate - prevConfirmationRate).toFixed(1));
        stats.avgProcessingGrowth = (avgProcessingTimeMin != null && prevAvgProcessing != null)
          ? growth(avgProcessingTimeMin, prevAvgProcessing)
          : null;
      }
    }

    return NextResponse.json({ orders: data, nextCursor, stats });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ orders: [], nextCursor: null, stats: null });
  }
}

export async function DELETE(request: Request) {
  try {
    const caller = await getCaller();
    // Only Admin can delete orders
    if (caller?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs" }, { status: 400 });
    }
    const { count } = await prisma.order.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

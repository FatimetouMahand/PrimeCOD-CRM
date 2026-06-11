import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

const LIMIT = 30;

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

  const where: Record<string, unknown> = {
    ...(search ? {
      OR: [
        { customer: { contains: search, mode: "insensitive" as const } },
        { phone:    { contains: search } },
      ],
    } : {}),
    ...(statusId         ? { statusId }                        : {}),
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
      // Confirmed = statuts marqués comme finaux (Confirmée, Confirmed…)
      // Pending = statuts non-finaux (En attente, Pending, Ne répond pas…)
      const [confirmed, pending, rev] = await Promise.all([
        prisma.order.count({ where: { ...where, status: { isFinal: true } } }),
        prisma.order.count({ where: { ...where, status: { isFinal: false } } }),
        prisma.order.aggregate({ where, _sum: { revenue: true } }),
      ]);
      stats = { total, confirmed, pending, revenue: rev._sum.revenue ?? 0 };
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

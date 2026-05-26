import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const [orders, users, products, statuses, dbSizeResult] = await Promise.all([
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.count(),
      prisma.status.count(),
      prisma.$queryRaw<{ size: string }[]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS size
      `,
    ]);

    return NextResponse.json({
      dbSize: dbSizeResult[0]?.size ?? "N/A",
      orders,
      users,
      products,
      statuses,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: { product: true, status: true },
    });

    const headers = ["Customer", "Product", "City", "Status", "Revenue (MRU)"];
    const rows = orders.map((o) =>
      [o.customer, o.product.name, o.city, o.status.name, o.revenue].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="orders.csv"',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

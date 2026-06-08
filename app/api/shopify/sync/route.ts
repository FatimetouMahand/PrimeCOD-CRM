import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

// ─── Same method as old app: REST API with X-Shopify-Access-Token ─────────────
// GET /api/shopify/sync?type=orders|products

async function getCallerRole(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return null;
    const p = verifyToken(token) as { role: string };
    return p.role;
  } catch { return null; }
}

async function ensureStatuses() {
  const count = await prisma.status.count();
  if (count === 0) {
    await prisma.status.createMany({
      data: [
        { name: "En attente",    color: "#f59e0b", isFinal: false, isActive: true },
        { name: "Confirmée",     color: "#22c55e", isFinal: true,  isActive: true },
        { name: "Rejetée",       color: "#ef4444", isFinal: true,  isActive: true },
        { name: "Ne répond pas", color: "#6b7280", isFinal: false, isActive: true, alertAfterHours: 24 },
        { name: "Annulée",       color: "#dc2626", isFinal: true,  isActive: true },
      ],
    });
  }
  return prisma.status.findFirst({ where: { isFinal: false, isActive: true }, orderBy: { createdAt: "asc" } });
}

async function generateCode(name: string): Promise<string> {
  const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X").padEnd(3, "X");
  for (let i = 0; i < 10; i++) {
    const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!await prisma.product.findUnique({ where: { code } })) return code;
  }
  return `${prefix}-${Date.now()}`;
}

export async function GET(request: Request) {
  // Admin only
  const role = await getCallerRole();
  if (role !== "Admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Prefer the store connected via Shopify OAuth (Settings → Shopify),
  // fall back to env vars (old-app method) for backward compatibility.
  const connectedStore = await prisma.shopifyStore.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const accessToken = connectedStore?.accessToken ?? process.env.SHOPIFY_ACCESS_TOKEN;
  const storeUrl    = connectedStore?.domain      ?? process.env.SHOPIFY_STORE_URL;

  if (!accessToken || !storeUrl) {
    return NextResponse.json({
      error: "Aucune boutique Shopify connectée. Va dans Réglages → Shopify pour te connecter.",
    }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "orders"; // "orders" | "products"

  try {
    if (type === "products") {
      // ── Sync products from Shopify ──────────────────────────────────────
      const res = await fetch(
        `https://${storeUrl}/admin/api/2024-10/products.json?limit=250`,
        { headers: { "X-Shopify-Access-Token": accessToken } }
      );
      if (!res.ok) return NextResponse.json({ error: "Shopify API error" }, { status: 502 });

      const { products: shopifyProducts } = await res.json();
      let created = 0;

      for (const sp of shopifyProducts) {
        const existing = await prisma.product.findFirst({
          where: { name: { equals: sp.title, mode: "insensitive" } },
        });
        if (!existing) {
          const code = await generateCode(sp.title);
          const price = parseFloat(sp.variants?.[0]?.price ?? "0");
          await prisma.product.create({ data: { name: sp.title, code, price } });
          created++;
        }
      }
      return NextResponse.json({ ok: true, type: "products", synced: shopifyProducts.length, created });
    }

    // ── Sync orders from Shopify ──────────────────────────────────────────
    const res = await fetch(
      `https://${storeUrl}/admin/api/2024-10/orders.json?status=any&limit=250`,
      { headers: { "X-Shopify-Access-Token": accessToken } }
    );
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Shopify API ${res.status}: ${body}` }, { status: 502 });
    }

    const { orders: shopifyOrders } = await res.json();
    const status = await ensureStatuses();
    if (!status) return NextResponse.json({ error: "No status configured" }, { status: 500 });

    let created = 0;
    let skipped = 0;

    for (const so of shopifyOrders) {
      // Extract customer info
      const billing  = so.billing_address  ?? {};
      const shipping = so.shipping_address ?? {};
      const cust     = so.customer         ?? {};

      const customer =
        `${billing.first_name ?? cust.first_name ?? ""} ${billing.last_name ?? cust.last_name ?? ""}`.trim()
        || "Client inconnu";

      const phone = billing.phone || cust.phone || so.phone || "";
      const city  = billing.city  || shipping.city || "";

      const lineItem = so.line_items?.[0];
      if (!lineItem) { skipped++; continue; }

      const productName = lineItem.title ?? "Produit inconnu";
      const price       = parseFloat(so.total_price ?? lineItem.price ?? "0");
      const quantity    = lineItem.quantity ?? 1;

      // Check if already exists (by customer + product + date within 1h)
      const orderDate = new Date(so.created_at);
      const existing  = await prisma.order.findFirst({
        where: {
          customer,
          phone,
          product: { name: { equals: productName, mode: "insensitive" } },
          createdAt: {
            gte: new Date(orderDate.getTime() - 60 * 60 * 1000),
            lte: new Date(orderDate.getTime() + 60 * 60 * 1000),
          },
        },
      });
      if (existing) { skipped++; continue; }

      // Find or create product
      let product = await prisma.product.findFirst({
        where: { name: { equals: productName, mode: "insensitive" } },
      });
      if (!product) {
        const code = await generateCode(productName);
        product = await prisma.product.create({ data: { name: productName, code, price } });
      }

      // Create order
      await prisma.order.create({
        data: {
          customer, phone, city, price, quantity,
          revenue: price * quantity,
          statusId:  status.id,
          productId: product.id,
          createdAt: orderDate,
        },
      });
      created++;
    }

    return NextResponse.json({
      ok: true,
      type: "orders",
      total: shopifyOrders.length,
      created,
      skipped,
    });

  } catch (e) {
    console.error("Sync error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

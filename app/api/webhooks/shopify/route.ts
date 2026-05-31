import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import crypto from "crypto";

const ONLINE_MS = 2 * 60 * 1000;

// Auto-generate a unique product code like "NOM-4821"
async function generateCode(name: string): Promise<string> {
  const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X").padEnd(3, "X");
  for (let i = 0; i < 10; i++) {
    const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await prisma.product.findUnique({ where: { code } });
    if (!exists) return code;
  }
  return `${prefix}-${Date.now()}`;
}

// Select best online agent for a product (load balancing)
async function selectAgent(productId: string): Promise<string | null> {
  const threshold = new Date(Date.now() - ONLINE_MS);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { agents: { include: { agent: true } } },
  });
  if (!product) return null;

  let eligibleIds: string[];

  if (product.distributionType === "specific" && product.agents.length > 0) {
    eligibleIds = product.agents
      .filter(
        (pa) =>
          !pa.agent.suspended &&
          pa.agent.isOnline &&
          pa.agent.lastSeenAt &&
          pa.agent.lastSeenAt >= threshold
      )
      .map((pa) => pa.agent.id);
  } else {
    const agents = await prisma.user.findMany({
      where: { role: "Agent", suspended: false, isOnline: true, lastSeenAt: { gte: threshold } },
      select: { id: true },
    });
    eligibleIds = agents.map((a) => a.id);
  }

  if (eligibleIds.length === 0) return null;

  const counts = await Promise.all(
    eligibleIds.map(async (id) => ({
      id,
      count: await prisma.order.count({
        where: { agentId: id, status: { isFinal: false } }, // commandes actives uniquement
      }),
    }))
  );

  counts.sort((a, b) => a.count - b.count);
  return counts[0].id;
}

// POST /api/webhooks/shopify
// Receives Shopify order/create events, verifies HMAC, creates order + distributes.
export async function POST(request: Request) {
  try {
    const rawBody   = await request.text();
    const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";
    const hmacHeader = request.headers.get("x-shopify-hmac-sha256") ?? "";

    // Look up the store
    const store = await prisma.shopifyStore.findUnique({ where: { domain: shopDomain } });
    if (!store || !store.isActive) {
      return NextResponse.json({ error: "Unknown store" }, { status: 401 });
    }

    // Verify HMAC-SHA256 signature
    const digest = crypto
      .createHmac("sha256", store.webhookSecret)
      .update(rawBody, "utf8")
      .digest("base64");
    if (digest !== hmacHeader) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // ── Extract customer info ──────────────────────────────────────────────
    const billing  = payload.billing_address  ?? {};
    const shipping = payload.shipping_address ?? {};
    const cust     = payload.customer         ?? {};

    const customer =
      `${billing.first_name ?? cust.first_name ?? ""} ${billing.last_name ?? cust.last_name ?? ""}`.trim() ||
      "Client inconnu";

    const phone = billing.phone || cust.phone || payload.phone || "";
    const city  = billing.city  || shipping.city || "";

    // ── First line item only ──────────────────────────────────────────────
    const lineItem = payload.line_items?.[0];
    if (!lineItem) return NextResponse.json({ ok: true, skipped: "no_line_items" });

    const productName = lineItem.title ?? "Produit inconnu";
    const price       = parseFloat(payload.total_price ?? lineItem.price ?? "0");
    const quantity    = lineItem.quantity ?? 1;

    // ── Find or create product ────────────────────────────────────────────
    let product = await prisma.product.findFirst({
      where: { name: { equals: productName, mode: "insensitive" } },
    });
    if (!product) {
      const code = await generateCode(productName);
      product = await prisma.product.create({
        data: { name: productName, code, price },
      });
    }

    // ── Find initial status (non-final = pending/en attente) ─────────────
    // Priority 1: isFinal:false active → Priority 2: any active → Priority 3: auto-create
    let status = await prisma.status.findFirst({
      where: { isFinal: false, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!status) {
      status = await prisma.status.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }
    // Auto-create default statuses if DB is empty (fresh deployment)
    if (!status) {
      await prisma.status.createMany({
        data: [
          { name: "En attente",  color: "#f59e0b", isFinal: false, isActive: true },
          { name: "Confirmée",   color: "#22c55e", isFinal: true,  isActive: true },
          { name: "Rejetée",     color: "#ef4444", isFinal: true,  isActive: true },
          { name: "Ne répond pas", color: "#6b7280", isFinal: false, isActive: true, alertAfterHours: 24 },
        ],
        skipDuplicates: true,
      });
      status = await prisma.status.findFirst({
        where: { isFinal: false, isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }
    if (!status) {
      return NextResponse.json({ error: "Status creation failed" }, { status: 500 });
    }

    // ── Create order ──────────────────────────────────────────────────────
    const newOrder = await prisma.order.create({
      data: {
        customer,
        phone,
        city,
        price,
        quantity,
        revenue: price * quantity,
        statusId: status.id,
        productId: product.id,
      },
    });

    // ── Distribute to best available agent ────────────────────────────────
    const agentId = await selectAgent(product.id);
    if (agentId) {
      await prisma.order.update({
        where: { id: newOrder.id },
        data: { agentId },
      });
    }

    return NextResponse.json({ ok: true, orderId: newOrder.id, agentId: agentId ?? null });
  } catch (e) {
    console.error("Shopify webhook error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

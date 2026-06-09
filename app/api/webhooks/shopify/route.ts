import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import crypto from "crypto";
import { notifyAgentNewOrder } from "@/lib/telegram";
import { calculateWorkMinutes } from "@/lib/work-time";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateCode(name: string): Promise<string> {
  const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X").padEnd(3, "X");
  for (let i = 0; i < 10; i++) {
    const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!await prisma.product.findUnique({ where: { code } })) return code;
  }
  return `${prefix}-${Date.now()}`;
}

async function getSystemSettings() {
  let settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: "default", assignmentBatchSize: 1, updatedAt: new Date() },
    });
  }
  return settings;
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

// ─── Agent selection — same logic as old app ──────────────────────────────────
async function selectAgent(product: { assignedAgentIds: string[]; hiddenForAgentIds: string[] }, batchSize: number): Promise<string | null> {
  const agents = await prisma.user.findMany({
    where: {
      role:             { in: ["AGENT", "AGENT_TEST"] },
      status:           "ACTIVE",
      canViewOrders:    true,
    },
    orderBy: { id: "asc" },
  });

  if (agents.length === 0) return null;

  const { assignedAgentIds, hiddenForAgentIds } = product;

  // Determine candidates
  const activeRequired = assignedAgentIds.filter(id => agents.some(a => a.id === id));
  let candidates = activeRequired.length > 0
    ? agents.filter(a => activeRequired.includes(a.id) && !hiddenForAgentIds.includes(a.id))
    : agents.filter(a => !hiddenForAgentIds.includes(a.id));

  if (candidates.length === 0) return null;

  // Load untreated counts
  const counts = await prisma.order.groupBy({
    by:    ["agentId"],
    _count: { id: true },
    where: {
      agentId:  { not: null },
      statusId: null, // Non traités
    },
  });

  const untreated = new Map<string, number>();
  agents.forEach(a => untreated.set(a.id, 0));
  counts.forEach(c => { if (c.agentId) untreated.set(c.agentId, c._count.id); });

  // Filter by capacity, fallback to all if everyone saturated
  let eligible = candidates.filter(a => (untreated.get(a.id) ?? 0) < batchSize);
  if (eligible.length === 0) eligible = candidates;

  // Sort by least untreated → tie-break random
  eligible.sort((a, b) => {
    const diff = (untreated.get(a.id) ?? 0) - (untreated.get(b.id) ?? 0);
    return diff !== 0 ? diff : Math.random() - 0.5;
  });

  return eligible[0].id;
}

// ─── POST /api/webhooks/shopify ───────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const rawBody    = await request.text();
    const hmacHeader = request.headers.get("x-shopify-hmac-sha256") ?? "";
    const shopDomain = request.headers.get("x-shopify-shop-domain")  ?? "";

    // ── HMAC verification ────────────────────────────────────────────────────
    let webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
    if (!webhookSecret) {
      const store = await prisma.shopifyStore.findUnique({ where: { domain: shopDomain } });
      if (!store?.isActive) {
        return NextResponse.json({ error: "Boutique non configurée" }, { status: 401 });
      }
      webhookSecret = store.webhookSecret;
    }

    const digest = crypto.createHmac("sha256", webhookSecret).update(rawBody, "utf8").digest("base64");
    if (digest !== hmacHeader) {
      return NextResponse.json({ error: "Signature HMAC invalide" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // ── Extract customer info ─────────────────────────────────────────────────
    const billing  = payload.billing_address  ?? {};
    const shipping = payload.shipping_address ?? {};
    const cust     = payload.customer         ?? {};

    const customer =
      `${billing.first_name ?? cust.first_name ?? ""} ${billing.last_name ?? cust.last_name ?? ""}`.trim()
      || "Client inconnu";

    const phone = billing.phone || cust.phone || payload.phone || "";
    const city  = billing.city  || shipping.city || "";

    // ── Phone validation: minimum 8 digits (same as old app) ─────────────────
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 8) {
      console.log(`🚫 [Webhook] Commande #${payload.order_number} ignorée : téléphone invalide (${phone})`);
      return NextResponse.json({ ok: true, skipped: "invalid_phone" });
    }

    // ── Line item ────────────────────────────────────────────────────────────
    const lineItem = payload.line_items?.[0];
    if (!lineItem) return NextResponse.json({ ok: true, skipped: "no_line_items" });

    const productName = lineItem.title ?? "Produit inconnu";
    const price       = parseFloat(payload.total_price ?? lineItem.price ?? "0");
    const quantity    = lineItem.quantity ?? 1;
    const shopifyProductId = lineItem.product_id?.toString() ?? null;

    // ── Deduplication: same phone + product + within 1 hour ──────────────────
    const orderDate = new Date(payload.created_at);
    const duplicate = await prisma.order.findFirst({
      where: {
        phone,
        product: { name: { equals: productName, mode: "insensitive" } },
        createdAt: {
          gte: new Date(orderDate.getTime() - 3_600_000),
          lte: new Date(orderDate.getTime() + 3_600_000),
        },
      },
    });
    if (duplicate) {
      console.log(`🚫 [Webhook] Doublon détecté pour #${payload.order_number}`);
      return NextResponse.json({ ok: true, skipped: "duplicate" });
    }

    // ── Find or create product ────────────────────────────────────────────────
    let product = shopifyProductId
      ? await prisma.product.findUnique({ where: { shopifyId: shopifyProductId } })
      : null;

    if (!product) {
      product = await prisma.product.findFirst({
        where: { name: { equals: productName, mode: "insensitive" } },
      });
    }

    if (!product) {
      const code = await generateCode(productName);
      product = await prisma.product.create({
        data: {
          name:      productName,
          code,
          shopifyId: shopifyProductId,
          price,
        },
      });
    }

    // ── Get or create default status ──────────────────────────────────────────
    const status = await ensureStatuses();
    if (!status) return NextResponse.json({ error: "Aucun statut disponible" }, { status: 500 });

    // ── Create order ──────────────────────────────────────────────────────────
    const settings = await getSystemSettings();

    const newOrder = await prisma.order.create({
      data: {
        orderNumber: typeof payload.order_number === "number" ? payload.order_number : null,
        customer,
        phone,
        city,
        price,
        quantity,
        revenue:   price * quantity,
        statusId:  null, // "Non traité" = pas de statut
        productId: product.id,
        createdAt: orderDate,
        assignedAt: null,
      },
    });

    // ── Assign best available agent ───────────────────────────────────────────
    const agentId = await selectAgent(product, settings.assignmentBatchSize);

    if (agentId) {
      const now = new Date();
      await prisma.order.update({
        where: { id: newOrder.id },
        data:  { agentId, assignedAt: now },
      });

      // Telegram notification
      const agent = await prisma.user.findUnique({
        where:  { id: agentId },
        select: { name: true, telegramChatId: true },
      });

      if (agent?.telegramChatId) {
        await notifyAgentNewOrder(
          agent.name ?? "Agent",
          agent.telegramChatId,
          payload.order_number ?? 0,
          productName
        );
      }

      console.log(`✅ [Webhook] Commande #${payload.order_number ?? newOrder.id} → ${agent?.name ?? agentId}`);
    } else {
      console.warn(`⚠️ [Webhook] Aucun agent disponible pour la commande #${payload.order_number}`);
    }

    return NextResponse.json({ ok: true, orderId: newOrder.id, agentId: agentId ?? null });

  } catch (e) {
    console.error("❌ [Webhook] Erreur:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

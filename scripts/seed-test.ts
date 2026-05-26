import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Initialisation des données de test...\n");

  // ── 1. Statuts ─────────────────────────────────────────────────────────────
  const statusData = [
    { name: "En attente",     color: "#f59e0b", alertAfterHours: 24 },
    { name: "Confirmée",      color: "#22c55e", alertAfterHours: null },
    { name: "Rejetée",        color: "#ef4444", alertAfterHours: null },
    { name: "Ne répond pas",  color: "#f97316", alertAfterHours: 2  },
    { name: "Rappel",         color: "#3b82f6", alertAfterHours: 4  },
    { name: "Annulée",        color: "#6b7280", alertAfterHours: null },
  ];

  for (const s of statusData) {
    await prisma.status.upsert({
      where: { id: s.name }, // won't match — will always create
      update: {},
      create: s,
    }).catch(async () => {
      // If already exists by name, skip
      const existing = await prisma.status.findFirst({ where: { name: s.name } });
      if (!existing) await prisma.status.create({ data: s });
    });
  }
  const statuses = await prisma.status.findMany();
  console.log(`✅ ${statuses.length} statuts créés`);

  // ── 2. Produits ────────────────────────────────────────────────────────────
  const productData = [
    { name: "Crème Visage Premium",   code: "CRE-1001", price: 850,  distributionType: "random" },
    { name: "Sérum Cheveux Argan",    code: "SER-1002", price: 1200, distributionType: "random" },
    { name: "Huile Corps Naturelle",  code: "HUI-1003", price: 650,  distributionType: "random" },
  ];

  for (const p of productData) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }
  console.log(`✅ ${productData.length} produits créés`);

  // ── 3. Agents ──────────────────────────────────────────────────────────────
  const agentsData = [
    { name: "Ahmed Ould Salem",  phone: "+22241000001", password: "Agent@123" },
    { name: "Fatima Mint Ahmed", phone: "+22241000002", password: "Agent@456" },
  ];

  const agents = [];
  for (const a of agentsData) {
    const hashed = await bcrypt.hash(a.password, 10);
    const agent = await prisma.user.upsert({
      where: { phone: a.phone },
      update: {},
      create: { name: a.name, phone: a.phone, password: hashed, role: "Agent" },
    });
    agents.push({ ...agent, plainPassword: a.password });
  }
  console.log(`✅ ${agents.length} agents créés`);

  // ── 4. Commandes de test ───────────────────────────────────────────────────
  const pending = await prisma.status.findFirst({ where: { name: "En attente" } });
  const confirmed = await prisma.status.findFirst({ where: { name: "Confirmée" } });
  const noAnswer = await prisma.status.findFirst({ where: { name: "Ne répond pas" } });
  const products = await prisma.product.findMany();

  if (pending && confirmed && noAnswer && products.length > 0) {
    const ordersData = [
      // Agent 1 — Ahmed
      { customer: "Mohamed Lemine",  phone: "+22236111222", city: "Nouakchott", price: 850,  quantity: 1, statusId: pending.id,    productId: products[0].id, agentId: agents[0].id },
      { customer: "Aminata Sy",      phone: "+22236333444", city: "Nouadhibou",  price: 1200, quantity: 2, statusId: confirmed.id,  productId: products[1].id, agentId: agents[0].id },
      { customer: "Brahim Ould Ali", phone: "+22236555666", city: "Rosso",       price: 850,  quantity: 1, statusId: noAnswer.id,   productId: products[0].id, agentId: agents[0].id },
      { customer: "Mariam Diallo",   phone: "+22236777888", city: "Kiffa",       price: 650,  quantity: 3, statusId: pending.id,    productId: products[2].id, agentId: agents[0].id },

      // Agent 2 — Fatima
      { customer: "Ahmed Vall",      phone: "+22237111222", city: "Nouakchott", price: 1200, quantity: 1, statusId: confirmed.id,  productId: products[1].id, agentId: agents[1].id },
      { customer: "Hawa Ba",         phone: "+22237333444", city: "Zouerate",   price: 850,  quantity: 2, statusId: pending.id,    productId: products[0].id, agentId: agents[1].id },
      { customer: "Moussa Camara",   phone: "+22237555666", city: "Atar",       price: 650,  quantity: 1, statusId: noAnswer.id,   productId: products[2].id, agentId: agents[1].id },

      // Sans agent (en attente de distribution)
      { customer: "Ismail Ould Bah", phone: "+22238111222", city: "Nouakchott", price: 850,  quantity: 1, statusId: pending.id, productId: products[0].id, agentId: null },
      { customer: "Khadija Mint",    phone: "+22238333444", city: "Nouadhibou", price: 1200, quantity: 1, statusId: pending.id, productId: products[1].id, agentId: null },

      // Numéro incomplet (visible Admin seulement)
      { customer: "Client Inconnu",  phone: "123",          city: "?",          price: 850,  quantity: 1, statusId: pending.id, productId: products[0].id, agentId: null },
    ];

    let created = 0;
    for (const o of ordersData) {
      const exists = await prisma.order.findFirst({ where: { customer: o.customer, phone: o.phone } });
      if (!exists) {
        await prisma.order.create({ data: { ...o, revenue: o.price * o.quantity } });
        created++;
      }
    }
    console.log(`✅ ${created} commandes de test créées`);
  }

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Données de test prêtes !\n");
  console.log("👤 COMPTE ADMIN");
  console.log("   Téléphone  : +22200000000");
  console.log("   Mot de passe: Admin@123\n");

  for (const a of agents) {
    console.log(`👤 AGENT — ${a.name}`);
    console.log(`   Téléphone  : ${a.phone}`);
    console.log(`   Mot de passe: ${a.plainPassword}\n`);
  }
  console.log("=".repeat(50));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

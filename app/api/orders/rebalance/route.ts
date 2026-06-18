import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const ONLINE_MS = 2 * 60 * 1000;

type ProductConstraint = { assignedAgentIds: string[]; hiddenForAgentIds: string[] };

export async function POST() {
  try {
    const threshold = new Date(Date.now() - ONLINE_MS);

    // Step 1 — expirer les sessions fantômes (pas de battement depuis 2 min)
    await prisma.user.updateMany({
      where: { isOnline: true, lastSeenAt: { lt: threshold } },
      data:  { isOnline: false },
    });

    // Step 2 — agents EN LIGNE (actifs + connectés récemment)
    const onlineAgents = await prisma.user.findMany({
      where: {
        role:       { in: ["AGENT", "AGENT_TEST"] },
        status:     "ACTIVE",
        isOnline:   true,
        lastSeenAt: { gte: threshold },
      },
      select: { id: true },
    });

    if (onlineAgents.length === 0) {
      return NextResponse.json({ message: "No online agents", reassigned: 0 });
    }

    const onlineIds = new Set(onlineAgents.map(a => a.id));

    // Charge courante = commandes NON TRAITÉES (statusId null) par agent en ligne.
    // Même définition que le webhook (« agent le plus libre = le moins de
    // commandes pas traitées ») → pas de va-et-vient entre attribution et rééquilibrage.
    const load = new Map<string, number>();
    for (const a of onlineAgents) {
      load.set(a.id, await prisma.order.count({ where: { agentId: a.id, statusId: null } }));
    }

    // Agents éligibles pour un produit (parmi les agents en ligne) :
    //  - produit spécifique → uniquement ses agents (en ligne, non cachés)
    //  - sinon → tous les agents en ligne, sauf ceux cachés pour ce produit
    const eligibleFor = (p: ProductConstraint): string[] => {
      const hidden = new Set(p.hiddenForAgentIds ?? []);
      const specific = (p.assignedAgentIds ?? []).filter(id => onlineIds.has(id) && !hidden.has(id));
      if (specific.length > 0) return specific;
      return [...onlineIds].filter(id => !hidden.has(id));
    };

    let reassigned = 0;

    // Step 3 — Orphelins : commandes NON TRAITÉES dont l'agent est hors-ligne
    //          ou non assignées → (ré)attribuer au plus libre AGENT ÉLIGIBLE.
    //          (on ne touche jamais une commande déjà traitée : statusId non nul)
    const orphans = await prisma.order.findMany({
      where: {
        statusId: null,
        OR: [{ agentId: null }, { agentId: { notIn: [...onlineIds] } }],
      },
      select: { id: true, product: { select: { assignedAgentIds: true, hiddenForAgentIds: true } } },
      orderBy: { createdAt: "asc" },
    });

    for (const o of orphans) {
      const elig = eligibleFor(o.product);
      if (elig.length === 0) continue; // aucun agent en ligne éligible → on laisse
      elig.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
      const target = elig[0];
      await prisma.order.update({ where: { id: o.id }, data: { agentId: target } });
      load.set(target, (load.get(target) ?? 0) + 1);
      reassigned++;
    }

    // Step 4 — Rééquilibrage : décharger les agents surchargés vers les plus
    //          libres, en respectant les contraintes du produit. C'est ce qui
    //          fait « passer » une commande de A à B quand B devient plus libre.
    const total  = [...load.values()].reduce((s, n) => s + n, 0);
    const target = Math.ceil(total / onlineAgents.length);

    for (const [agentId, count] of [...load.entries()]) {
      if (count <= target) continue;
      const excess = count - target;
      const movable = await prisma.order.findMany({
        where:   { agentId, statusId: null },
        select:  { id: true, product: { select: { assignedAgentIds: true, hiddenForAgentIds: true } } },
        orderBy: { createdAt: "asc" },
        take:    excess,
      });
      for (const o of movable) {
        const elig = eligibleFor(o.product).filter(id => id !== agentId && (load.get(id) ?? 0) < target);
        if (elig.length === 0) continue; // personne de plus libre et éligible → on garde
        elig.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
        const t = elig[0];
        await prisma.order.update({ where: { id: o.id }, data: { agentId: t } });
        load.set(agentId, (load.get(agentId) ?? 0) - 1);
        load.set(t, (load.get(t) ?? 0) + 1);
        reassigned++;
      }
    }

    return NextResponse.json({ success: true, reassigned, target });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Rebalance failed" }, { status: 500 });
  }
}

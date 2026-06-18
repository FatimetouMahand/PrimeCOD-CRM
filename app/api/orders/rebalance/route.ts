import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type ProductConstraint = { assignedAgentIds: string[]; hiddenForAgentIds: string[] };

// Rééquilibrage périodique (toutes les 5 min). Même règle que l'attribution
// initiale (webhook selectAgent) : on considère TOUS les agents ACTIFS
// (compte non suspendu) autorisés à voir les commandes — pas seulement ceux
// connectés, et on les compare TOUS. « Agent le plus libre » = celui qui a le
// moins de commandes NON TRAITÉES (statusId null). On ne déplace jamais une
// commande déjà traitée. Quand un agent A se libère après 5 min, les commandes
// en trop passent de l'agent surchargé vers lui.
export async function POST() {
  try {
    // Tous les agents ACTIFS autorisés à voir les commandes (pas seulement en ligne).
    const activeAgents = await prisma.user.findMany({
      where: {
        role:          { in: ["AGENT", "AGENT_TEST"] },
        status:        "ACTIVE",
        canViewOrders: true,
      },
      select: { id: true },
    });

    if (activeAgents.length === 0) {
      return NextResponse.json({ message: "Aucun agent actif", reassigned: 0 });
    }

    const activeIds = new Set(activeAgents.map(a => a.id));

    // Charge courante = commandes NON TRAITÉES (statusId null) par agent actif.
    // Même définition que le webhook → pas de va-et-vient avec l'attribution.
    const load = new Map<string, number>();
    for (const a of activeAgents) {
      load.set(a.id, await prisma.order.count({ where: { agentId: a.id, statusId: null } }));
    }

    // Agents éligibles pour un produit (parmi les agents actifs) :
    //  - produit spécifique → uniquement ses agents (actifs, non cachés)
    //  - sinon → tous les agents actifs, sauf ceux cachés pour ce produit
    const eligibleFor = (p: ProductConstraint): string[] => {
      const hidden = new Set(p.hiddenForAgentIds ?? []);
      const specific = (p.assignedAgentIds ?? []).filter(id => activeIds.has(id) && !hidden.has(id));
      if (specific.length > 0) return specific;
      return [...activeIds].filter(id => !hidden.has(id));
    };

    let reassigned = 0;

    // Step 1 — Orphelins : commandes NON TRAITÉES sans agent ou dont l'agent
    //          n'est plus actif (suspendu/supprimé) → (ré)attribuer au plus
    //          libre AGENT ÉLIGIBLE. On ne touche jamais aux commandes déjà
    //          traitées (statusId non nul).
    const orphans = await prisma.order.findMany({
      where: {
        statusId: null,
        OR: [{ agentId: null }, { agentId: { notIn: [...activeIds] } }],
      },
      select: { id: true, product: { select: { assignedAgentIds: true, hiddenForAgentIds: true } } },
      orderBy: { createdAt: "asc" },
    });

    for (const o of orphans) {
      const elig = eligibleFor(o.product);
      if (elig.length === 0) continue; // aucun agent éligible → on laisse
      elig.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
      const target = elig[0];
      await prisma.order.update({ where: { id: o.id }, data: { agentId: target } });
      load.set(target, (load.get(target) ?? 0) + 1);
      reassigned++;
    }

    // Step 2 — Rééquilibrage : décharger les agents surchargés vers les plus
    //          libres, en respectant les contraintes du produit. C'est ce qui
    //          fait « passer » une commande de A à B quand B devient plus libre.
    const total  = [...load.values()].reduce((s, n) => s + n, 0);
    const target = Math.ceil(total / activeAgents.length);

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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";
import { calculateWorkMinutes } from "@/lib/work-time";

async function getCaller() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;
    if (!token) return null;
    return verifyToken(token) as { id: string; role: string };
  } catch {
    return null;
  }
}

async function getSystemSettings() {
  let settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: { id: "default", updatedAt: new Date() } });
  }
  return settings;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const data: {
      agentId?: string | null;
      statusId?: string | null;
      notes?: string | null;
      attempts?: number;
      recallAt?: Date | null;
      assignedAt?: Date | null;
      firstProcessedAt?: Date;
      processingTimeMin?: number;
      absoluteDelayMin?: number;
    } = {};

    // ── Changement de statut : Admin, Superviseur OU l'agent assigné ──────────
    //   (l'agent traite ses propres commandes : c'est lui qui pose le statut)
    if ("statusId" in body) {
      const isAssignedAgent = order.agentId === caller.id;
      if (caller.role !== "ADMIN" && caller.role !== "SUPERVISOR" && !isAssignedAgent) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const newStatusId: string | null = body.statusId || null;
      data.statusId = newStatusId;

      const now = new Date();
      const settings = await getSystemSettings();

      // Première mise à jour de statut → enregistrer le temps de traitement.
      // Base = date d'attribution à l'agent (sinon création de la commande).
      if (newStatusId && !order.firstProcessedAt) {
        const base = order.assignedAt ?? order.createdAt;
        data.firstProcessedAt  = now;
        data.processingTimeMin = calculateWorkMinutes(base, now, settings);
        data.absoluteDelayMin  = Math.round((now.getTime() - base.getTime()) / 60000);
      }

      // Rappel automatique — sauf si un rappel manuel est fourni dans la requête.
      if (!("recallAt" in body)) {
        if (newStatusId) {
          const status = await prisma.status.findUnique({
            where: { id: newStatusId },
            select: { alertAfterHours: true },
          });
          if (status?.alertAfterHours != null) {
            // Statut « à rappeler » (ex. Ne répond pas) : planifier le rappel
            // dans X heures et incrémenter le compteur de tentatives, jusqu'au max.
            const maxAttempts = settings.maxRecallAttempts ?? 3;
            const current = order.attempts ?? 0;
            if (current < maxAttempts) {
              data.attempts = current + 1;
              if (current + 1 >= maxAttempts) {
                data.recallAt = null; // plus de rappel après le maximum de tentatives
              } else {
                const r = new Date(now);
                r.setHours(r.getHours() + status.alertAfterHours);
                data.recallAt = r;
              }
            }
          } else {
            // Statut sans alerte → effacer tout rappel en attente
            data.recallAt = null;
          }
        } else {
          // Retour à « non traité » → effacer le rappel
          data.recallAt = null;
        }
      }
    }

    // ── Réattribution d'agent : Admin ou Superviseur ──────────────────────────
    if ("agentId" in body) {
      if (caller.role !== "ADMIN" && caller.role !== "SUPERVISOR") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      data.agentId   = body.agentId || null;
      data.assignedAt = body.agentId ? new Date() : null;
    }

    // ── Notes / Tentatives d'appel / Rappel : Admin, Superviseur ou agent assigné ──
    if ("notes" in body || "attempts" in body || "recallAt" in body) {
      const privileged = caller.role === "ADMIN" || caller.role === "SUPERVISOR";
      if (!privileged && order.agentId !== caller.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if ("notes" in body) {
        data.notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;
      }
      if ("attempts" in body) {
        const n = Number(body.attempts);
        data.attempts = Number.isFinite(n) ? Math.max(0, Math.round(n)) : order.attempts;
      }
      if ("recallAt" in body) {
        data.recallAt = body.recallAt ? new Date(body.recallAt) : null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id },
      data,
      include: { agent: true, status: true, product: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

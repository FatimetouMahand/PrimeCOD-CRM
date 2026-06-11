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
      firstProcessedAt?: Date;
      processingTimeMin?: number;
      absoluteDelayMin?: number;
    } = {};

    // ── Status change: Admin or Supervisor only ──────────────────────────────
    if ("statusId" in body) {
      if (caller.role !== "ADMIN" && caller.role !== "SUPERVISOR") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      data.statusId = body.statusId || null;

      // First status change → record processing time (temps de traitement)
      if (!order.firstProcessedAt) {
        const now = new Date();
        const settings = await getSystemSettings();
        data.firstProcessedAt   = now;
        data.processingTimeMin  = calculateWorkMinutes(order.createdAt, now, settings);
        data.absoluteDelayMin   = Math.round((now.getTime() - order.createdAt.getTime()) / 60000);
      }
    }

    // ── Agent reassignment: Admin only ────────────────────────────────────────
    if ("agentId" in body) {
      if (caller.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      data.agentId = body.agentId || null;
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

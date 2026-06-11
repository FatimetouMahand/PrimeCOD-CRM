import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const [rows, system] = await Promise.all([
      prisma.settings.findMany(),
      prisma.systemSettings.findUnique({ where: { id: "default" } }),
    ]);
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    // Le seuil de distribution affiché dans l'onglet "Général" est en réalité
    // assignmentBatchSize, utilisé par la sélection d'agent des webhooks Shopify.
    if (system) settings.distributionThreshold = String(system.assignmentBatchSize);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, string>;
    const { distributionThreshold, ...rest } = body;
    const updates = Object.entries(rest);

    await prisma.$transaction([
      ...updates.map(([key, value]) =>
        prisma.settings.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      ),
      ...(distributionThreshold !== undefined
        ? [(() => {
            const parsed = parseInt(distributionThreshold, 10);
            const assignmentBatchSize = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
            return prisma.systemSettings.upsert({
              where: { id: "default" },
              update: { assignmentBatchSize },
              create: { id: "default", assignmentBatchSize },
            });
          })()]
        : []),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

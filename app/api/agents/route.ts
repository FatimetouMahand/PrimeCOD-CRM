import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const agents = await prisma.user.findMany({
      where: { role: { in: ["AGENT", "AGENT_TEST"] }, status: "ACTIVE" },
      select: { id: true, name: true, iconColor: true, role: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      agents: agents.map(a => ({ ...a, name: a.name ?? "Sans nom" })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ agents: [] });
  }
}

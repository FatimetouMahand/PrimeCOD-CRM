import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const agents = await prisma.user.findMany({
      where: { role: "Agent", suspended: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ agents });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ agents: [] });
  }
}

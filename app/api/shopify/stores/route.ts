import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const stores = await prisma.shopifyStore.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(stores);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, domain, accessToken, webhookSecret } = await request.json();
    if (!name || !domain || !accessToken || !webhookSecret) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }
    const store = await prisma.shopifyStore.create({
      data: { name, domain, accessToken, webhookSecret },
    });
    return NextResponse.json(store, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Ce domaine existe déjà" }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

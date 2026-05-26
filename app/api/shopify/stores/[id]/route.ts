import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const store = await prisma.shopifyStore.update({
      where: { id },
      data: {
        ...(body.name        !== undefined && { name:          body.name }),
        ...(body.accessToken !== undefined && { accessToken:   body.accessToken }),
        ...(body.webhookSecret !== undefined && { webhookSecret: body.webhookSecret }),
        ...(body.isActive    !== undefined && { isActive:      body.isActive }),
      },
    });
    return NextResponse.json(store);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.shopifyStore.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const status = await prisma.status.update({
      where: { id },
      data: {
        ...(body.name            !== undefined && { name:           body.name }),
        ...(body.color           !== undefined && { color:          body.color }),
        ...(body.isActive        !== undefined && { isActive:       body.isActive }),
        ...(body.isFinal         !== undefined && { isFinal:        Boolean(body.isFinal) }),
        ...(body.alertAfterHours !== undefined && {
          alertAfterHours: body.alertAfterHours ? Number(body.alertAfterHours) : null,
        }),
      },
    });
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Soft delete — deactivate so old orders keep the label
    const status = await prisma.status.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

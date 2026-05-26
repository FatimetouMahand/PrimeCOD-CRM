import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/hash";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: {
      name?: string;
      role?: string;
      password?: string;
      suspended?: boolean;
    } = {};

    if ("name"      in body) data.name      = body.name;
    if ("role"      in body) data.role      = body.role;
    if ("suspended" in body) data.suspended = body.suspended;
    if ("password"  in body) data.password  = await hashPassword(body.password);

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { _count: { select: { orders: true } } },
    });
    return NextResponse.json({ employee: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

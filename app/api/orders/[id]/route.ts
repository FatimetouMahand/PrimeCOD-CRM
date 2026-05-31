import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

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

    const data: { agentId?: string | null; statusId?: string } = {};

    // Status change: Admin or Supervisor only
    if ("statusId" in body) {
      if (caller.role !== "Admin" && caller.role !== "Supervisor") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      data.statusId = body.statusId;
    }

    // Agent reassignment: Admin only
    if ("agentId" in body) {
      if (caller.role !== "Admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      data.agentId = body.agentId || null;
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

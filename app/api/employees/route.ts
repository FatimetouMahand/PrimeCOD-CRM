import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/hash";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all";

  try {
    const employees = await prisma.user.findMany({
      where: {
        ...(filter === "active"    ? { suspended: false } : {}),
        ...(filter === "suspended" ? { suspended: true  } : {}),
      },
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ employees });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ employees: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { name, phone, role, password } = await request.json();

    if (!name || !phone || !role || !password) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    const hashed = await hashPassword(password);
    const employee = await prisma.user.create({
      data: { name, phone, role, password: hashed },
      include: { _count: { select: { orders: true } } },
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Phone number already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs" }, { status: 400 });
    }
    const { count } = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

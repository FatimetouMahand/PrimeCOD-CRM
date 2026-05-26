import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { comparePasswords } from "@/lib/auth/hash";
import { generateToken } from "@/lib/auth/jwt";

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ error: "Phone and password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
    }

    if (user.suspended) {
      return NextResponse.json({ error: "Account suspended — contact admin" }, { status: 403 });
    }

    const valid = await comparePasswords(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
    }

    const token = generateToken({ id: user.id, name: user.name, phone: user.phone, role: user.role });

    // Mark user as online
    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    });

    res.cookies.set("crm_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days — stays until explicit logout
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

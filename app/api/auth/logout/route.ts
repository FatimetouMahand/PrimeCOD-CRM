import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_token")?.value;

    if (token) {
      try {
        const payload = verifyToken(token) as { id: string };
        await prisma.user.update({
          where: { id: payload.id },
          data: { isOnline: false },
        });
      } catch {
        // Token invalid — still clear cookie
      }
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("crm_token", "", { maxAge: 0, path: "/" });
    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

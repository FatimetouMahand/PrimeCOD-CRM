import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";

// ─── Step 2: Shopify redirects back here with a one-time `code` ──────────────
// We verify the request, exchange the code for a permanent Admin API access
// token, and save it as a connected store (same shape as the manual form in
// Settings → Shopify, so the existing sync/import buttons work immediately).

function verifyHmac(searchParams: URLSearchParams, secret: string): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");

  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(hmac, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const shop  = (searchParams.get("shop") || "").trim().toLowerCase();
  const code  = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("shopify_oauth_state="))
    ?.split("=")[1];

  const clientId     = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET manquants" }, { status: 500 });
  }
  if (!shop || !code || !state) {
    return NextResponse.json({ error: "Paramètres manquants dans le callback Shopify" }, { status: 400 });
  }
  if (state !== cookieState) {
    return NextResponse.json({ error: "État OAuth invalide (CSRF). Réessaie la connexion." }, { status: 401 });
  }
  if (!verifyHmac(searchParams, clientSecret)) {
    return NextResponse.json({ error: "Signature HMAC invalide" }, { status: 401 });
  }

  // ── Exchange the one-time code for a permanent access token ───────────────
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return NextResponse.json({ error: `Échange du token a échoué : ${body}` }, { status: 502 });
  }

  const { access_token: accessToken } = await tokenRes.json() as { access_token: string; scope: string };

  // ── Save / update the connected store (visible in Settings → Shopify) ─────
  await prisma.shopifyStore.upsert({
    where:  { domain: shop },
    update: { accessToken, webhookSecret: clientSecret, isActive: true },
    create: { name: shop.replace(".myshopify.com", ""), domain: shop, accessToken, webhookSecret: clientSecret },
  });

  const redirect = new URL("/settings", origin);
  redirect.searchParams.set("tab", "shopify");
  redirect.searchParams.set("shopify_connected", shop);

  const res = NextResponse.redirect(redirect.toString());
  res.cookies.delete("shopify_oauth_state");
  return res;
}

import { NextResponse } from "next/server";
import crypto from "crypto";

// ─── Step 1: Start the Shopify OAuth flow ────────────────────────────────────
// GET /api/shopify/auth?shop=mon-store.myshopify.com
// Redirects the merchant to Shopify to approve access, then Shopify calls
// back our /api/shopify/auth/callback route with a one-time code.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const shop = (searchParams.get("shop") || "").trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    return NextResponse.json(
      { error: "Paramètre 'shop' invalide. Exemple : mon-store.myshopify.com" },
      { status: 400 }
    );
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const scopes   = process.env.SHOPIFY_SCOPES ?? "read_orders,write_orders,read_products,write_products,read_customers";
  if (!clientId) {
    return NextResponse.json({ error: "SHOPIFY_CLIENT_ID manquant dans les variables d'environnement" }, { status: 500 });
  }

  const redirectUri = `${origin}/api/shopify/auth/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}

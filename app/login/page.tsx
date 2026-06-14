"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Truck, BadgeCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res  = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();

    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(data.error || "Identifiants invalides");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "#fbf9f8",
      flexDirection: "row",
      flexWrap: "wrap",
    }}>

      {/* ═══════ LEFT: Login form (55%) ═══════ */}
      <section className="login-left" style={{
        flex: "1 1 55%",
        minWidth: 320,
        display: "flex",
        flexDirection: "column",
        padding: "32px 20px",
        background: "#fbf9f8",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 48,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#0d3938",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 16, fontWeight: 900,
          }}>S</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#002322", letterSpacing: -0.3 }}>
            Sou9nkc
          </span>
        </div>

        {/* Form container — centered */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: 420,
          width: "100%",
          margin: "0 auto",
        }}>
          <div style={{ marginBottom: 36 }}>
            <h1 style={{
              fontSize: 36, fontWeight: 700, color: "#002322",
              marginBottom: 10, letterSpacing: -0.5, lineHeight: 1.15,
            }}>
              Bienvenue
            </h1>
            <p style={{ fontSize: 15, color: "#404848", lineHeight: 1.6 }}>
              Veuillez vous connecter pour gérer vos opérations logistiques.
            </p>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Phone */}
            <div>
              <label style={LABEL}>Numéro de téléphone</label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", top: 0, bottom: 0, left: 0,
                  width: 90, paddingLeft: 18,
                  display: "flex", alignItems: "center", gap: 6,
                  borderRight: "1px solid #e4e2e2",
                  fontSize: 13, fontWeight: 700, color: "#1b1c1c",
                }}>
                  +222
                  <span style={{ fontSize: 14 }}>🇲🇷</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="41 00 00 00"
                  required
                  style={{
                    ...INPUT,
                    paddingLeft: 100,
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>Mot de passe</label>
                <a href="#" style={{
                  fontSize: 13, fontWeight: 600, color: "#3c665c",
                  textDecoration: "none",
                }}>Oublié ?</a>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...INPUT, paddingRight: 50 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#404848", padding: 4,
                  }}
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: "#ffdad6", color: "#93000a",
                padding: "12px 16px", borderRadius: 999,
                fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 12,
                border: "none",
                background: "#0d3938",
                color: "white",
                padding: "18px 24px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#002322"; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#0d3938"; }}
            >
              {loading ? "Connexion…" : "Se connecter"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p style={{
            textAlign: "center", fontSize: 13, color: "#404848",
            marginTop: 32,
          }}>
            Votre téléphone est votre identifiant de connexion
          </p>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <p style={{ fontSize: 11, color: "#9d9b9a" }}>
            © 2026 Sou9nkc Mauritanie. Tous droits réservés.
          </p>
        </div>
      </section>

      {/* ═══════ RIGHT: Hero (45%) ═══════ */}
      <section className="login-right" style={{
        flex: "1 1 45%",
        minWidth: 320,
        minHeight: 400,
        position: "relative",
        background: "linear-gradient(135deg, #0d3938 0%, #002322 50%, #3c665c 100%)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}>
        {/* Abstract decorative circles */}
        <div style={{
          position: "absolute", top: "-10%", right: "-10%",
          width: 320, height: 320, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "radial-gradient(circle, rgba(190,236,223,0.08) 0%, transparent 70%)",
          filter: "blur(2px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-15%", left: "-15%",
          width: 420, height: 420, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(190,236,223,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />

        {/* Hero content */}
        <div style={{
          position: "relative",
          maxWidth: 440,
          textAlign: "center",
          color: "white",
        }}>
          {/* Floating data card */}
          <div style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 16,
            padding: 20,
            marginBottom: 36,
            display: "flex",
            alignItems: "center",
            gap: 14,
            textAlign: "left",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#beecdf",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#0d3938", fontSize: 18,
            }}>
              📈
            </div>
            <div>
              <p style={{
                fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase", letterSpacing: 2, marginBottom: 4,
              }}>
                Taux de livraison
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "white" }}>
                +14.2% ce mois
              </p>
            </div>
          </div>

          {/* Tagline */}
          <h2 style={{
            fontSize: 36, fontWeight: 700, lineHeight: 1.15,
            letterSpacing: -0.5, marginBottom: 18,
          }}>
            Gérez vos commandes COD avec sérénité
          </h2>
          <p style={{
            fontSize: 15, lineHeight: 1.6,
            color: "rgba(255,255,255,0.7)",
            marginBottom: 36,
          }}>
            La plateforme tout-en-un pour simplifier la logistique et le paiement à la livraison en Mauritanie.
          </p>

          {/* Trust badges */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: 28,
            opacity: 0.5,
          }}>
            <ShieldCheck size={28} color="white" />
            <BadgeCheck size={28} color="white" />
            <Truck size={28} color="white" />
          </div>
        </div>
      </section>

      {/* Mobile: stack vertically + reduce hero height */}
      <style jsx>{`
        @media (max-width: 768px) {
          :global(.login-right) {
            order: -1;
            min-height: 280px !important;
            padding: 28px !important;
          }
          :global(.login-right h2) {
            font-size: 24px !important;
          }
          :global(.login-left) {
            padding: 28px 20px !important;
          }
        }
      `}</style>
    </div>
  );
}

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#404848",
  marginBottom: 8,
  marginLeft: 6,
};

const INPUT: React.CSSProperties = {
  width: "100%",
  height: 56,
  border: "1px solid #e4e2e2",
  borderRadius: 999,
  padding: "0 22px",
  fontSize: 15,
  outline: "none",
  background: "white",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.2s",
};

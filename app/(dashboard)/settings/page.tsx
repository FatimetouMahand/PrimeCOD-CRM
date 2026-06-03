"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, RefreshCw, Store, Settings2,
  Database, Check, Eye, EyeOff, Copy, Download, Package,
} from "lucide-react";

interface ShopifyStore {
  id: string; name: string; domain: string;
  accessToken: string; webhookSecret: string;
  isActive: boolean; createdAt: string;
}

interface SysStats {
  dbSize: string; orders: number; users: number;
  products: number; statuses: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Card({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "white", borderRadius: 16, padding: "20px 22px",
      border: "1px solid #edf0f5", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: subtitle ? 2 : 14 }}>
        {title}
      </div>
      {subtitle && <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 14px" }}>{subtitle}</p>}
      {children}
    </div>
  );
}

const IS: React.CSSProperties = {
  width: "100%", height: 38, border: "1.5px solid #e5e7eb",
  borderRadius: 9, padding: "0 12px", fontSize: 13,
  outline: "none", background: "#f9fafb", boxSizing: "border-box",
};
const LS: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5,
};

// ─── General Tab ─────────────────────────────────────────────────────────────
function GeneralTab() {
  const [language,  setLanguage]  = useState("fr");
  const [threshold, setThreshold] = useState("0");
  const [currency,  setCurrency]  = useState("MRU");
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then((d: Record<string, string>) => {
        if (d.language)             setLanguage(d.language);
        if (d.distributionThreshold) setThreshold(d.distributionThreshold);
        if (d.currency)             setCurrency(d.currency);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, distributionThreshold: threshold, currency }),
    }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card title="Langue du système">
        <div style={{ display: "flex", gap: 10 }}>
          {[{ v: "fr", label: "Français" }, { v: "ar", label: "العربية" }].map(l => (
            <button key={l.v} onClick={() => setLanguage(l.v)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, fontWeight: 700,
              fontSize: 13, cursor: "pointer",
              border: language === l.v ? "2px solid #0d3938" : "1.5px solid #e5e7eb",
              background: language === l.v ? "#eef2ff" : "white",
              color: language === l.v ? "#4f46e5" : "#374151",
            }}>
              {l.label}
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Seuil de distribution"
        subtitle="Nombre max de commandes non-confirmées par agent avant blocage — 0 = sans limite"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="number" value={threshold} min={0}
            onChange={e => setThreshold(e.target.value)}
            style={{ ...IS, width: 100 }}
          />
          <span style={{ fontSize: 12, color: "#6b7280" }}>commandes max</span>
        </div>
      </Card>

      <Card title="Devise">
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { v: "MRU", label: "MRU — Ouguiya" },
            { v: "USD", label: "USD — Dollar" },
            { v: "EUR", label: "EUR — Euro" },
          ].map(c => (
            <button key={c.v} onClick={() => setCurrency(c.v)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, fontWeight: 700,
              fontSize: 12, cursor: "pointer",
              border: currency === c.v ? "2px solid #0d3938" : "1.5px solid #e5e7eb",
              background: currency === c.v ? "#eef2ff" : "white",
              color: currency === c.v ? "#4f46e5" : "#374151",
            }}>
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      <button onClick={save} disabled={saving} style={{
        padding: "11px 28px", borderRadius: 10, border: "none",
        background: saved ? "#16a34a" : "#111827",
        color: "white", fontWeight: 700, fontSize: 13,
        cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.75 : 1,
        display: "flex", alignItems: "center", gap: 8,
        transition: "background 0.3s", width: "fit-content",
      }}>
        {saved ? <><Check size={14} /> Enregistré</> : saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}

// ─── Shopify Tab ──────────────────────────────────────────────────────────────
function ShopifyTab() {
  const [stores,      setStores]      = useState<ShopifyStore[]>([]);
  const [showForm,    setShowForm]    = useState(false);
  const [syncing,     setSyncing]     = useState<"orders"|"products"|null>(null);
  const [syncResult,  setSyncResult]  = useState<string>("");
  const [name,        setName]        = useState("");
  const [domain,      setDomain]      = useState("");
  const [token,       setToken]       = useState("");
  const [secret,      setSecret]      = useState("");
  const [formError,   setFormError]   = useState("");
  const [showToken,   setShowToken]   = useState<Record<string, boolean>>({});
  const [adding,      setAdding]      = useState(false);
  const [copiedUrl,   setCopiedUrl]   = useState(false);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/shopify`
    : "/api/webhooks/shopify";

  const load = useCallback(() => {
    fetch("/api/shopify/stores")
      .then(r => r.ok ? r.json() : [])
      .then(setStores)
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const addStore = async () => {
    setFormError("");
    if (!name || !domain || !token || !secret) {
      setFormError("Tous les champs sont requis"); return;
    }
    setAdding(true);
    const res = await fetch("/api/shopify/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, domain, accessToken: token, webhookSecret: secret }),
    });
    setAdding(false);
    if (res.ok) {
      setShowForm(false);
      setName(""); setDomain(""); setToken(""); setSecret("");
      load();
    } else {
      const d = await res.json();
      setFormError(d.error || "Erreur serveur");
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/shopify/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette boutique ?")) return;
    await fetch(`/api/shopify/stores/${id}`, { method: "DELETE" });
    load();
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  };

  const syncNow = async (type: "orders" | "products") => {
    setSyncing(type);
    setSyncResult("");
    try {
      const res  = await fetch(`/api/shopify/sync?type=${type}`);
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`❌ ${data.error}`);
      } else if (type === "orders") {
        setSyncResult(`✅ ${data.created} nouvelles commandes importées (${data.skipped} ignorées)`);
      } else {
        setSyncResult(`✅ ${data.created} nouveaux produits importés`);
      }
    } catch {
      setSyncResult("❌ Erreur réseau");
    } finally {
      setSyncing(null);
      setTimeout(() => setSyncResult(""), 6000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Flow banner */}
      <div style={{
        background: "#f0fdf4", border: "1px solid #bbf7d0",
        borderRadius: 12, padding: "13px 16px",
        fontSize: 12, color: "#166534", lineHeight: 1.7,
      }}>
        <strong>Flux d&apos;intégration :</strong><br />
        Client → Shopify Store → EasySell (COD Form) → Shopify Orders
        → <strong>Notre Webhook</strong> → Dashboard CRM
      </div>

      {/* Manual Sync — same as old app */}
      <Card
        title="Synchronisation manuelle"
        subtitle="Importer les commandes et produits existants depuis Shopify (nécessite SHOPIFY_ACCESS_TOKEN dans les variables d'environnement)"
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => syncNow("orders")}
            disabled={syncing !== null}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 9, border: "none",
              background: syncing === "orders" ? "#9ca3af" : "#0d3938",
              color: "white", fontWeight: 700, fontSize: 12,
              cursor: syncing !== null ? "not-allowed" : "pointer",
            }}
          >
            <Download size={13} style={{ animation: syncing === "orders" ? "spin 1s linear infinite" : "none" }} />
            {syncing === "orders" ? "Import en cours…" : "Importer les commandes"}
          </button>

          <button
            onClick={() => syncNow("products")}
            disabled={syncing !== null}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 9,
              border: "1.5px solid #e5e7eb", background: "white",
              color: "#374151", fontWeight: 700, fontSize: 12,
              cursor: syncing !== null ? "not-allowed" : "pointer",
            }}
          >
            <Package size={13} style={{ animation: syncing === "products" ? "spin 1s linear infinite" : "none" }} />
            {syncing === "products" ? "Import en cours…" : "Importer les produits"}
          </button>
        </div>

        {syncResult && (
          <div style={{
            marginTop: 10, padding: "9px 14px", borderRadius: 9,
            background: syncResult.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
            color:      syncResult.startsWith("✅") ? "#166534" : "#dc2626",
            fontSize: 12, fontWeight: 600,
          }}>
            {syncResult}
          </div>
        )}
      </Card>

      {/* Webhook URL */}
      <Card title="URL du Webhook">
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
          Ajoutez cette URL dans <strong>Admin Shopify → Paramètres → Notifications → Webhooks</strong>
          &nbsp;(événement : <em>Order creation</em>, format : JSON)
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <code style={{
            flex: 1, fontSize: 11, background: "#f3f4f6",
            padding: "9px 12px", borderRadius: 8, color: "#374151",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {webhookUrl}
          </code>
          <button onClick={copyUrl} title="Copier" style={{
            padding: "8px 12px", borderRadius: 8,
            border: "1.5px solid #e5e7eb", background: copiedUrl ? "#dcfce7" : "white",
            cursor: "pointer", color: copiedUrl ? "#16a34a" : "#6b7280",
            transition: "all 0.2s",
          }}>
            {copiedUrl ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </Card>

      {/* Stores */}
      <Card title={`Boutiques connectées${stores.length > 0 ? ` (${stores.length})` : ""}`}>
        {stores.length === 0 && !showForm && (
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 12px" }}>
            Aucune boutique connectée.
          </p>
        )}

        {stores.map(s => (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 14px", borderRadius: 10,
            background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 8,
          }}>
            <Store size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{s.domain}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <code style={{ fontSize: 10, color: "#9ca3af" }}>
                {showToken[s.id]
                  ? s.accessToken
                  : "••••" + s.accessToken.slice(-4)}
              </code>
              <button
                onClick={() => setShowToken(p => ({ ...p, [s.id]: !p[s.id] }))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2 }}
              >
                {showToken[s.id] ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </div>

            <button onClick={() => toggle(s.id, s.isActive)} style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              border: "none", cursor: "pointer",
              background: s.isActive ? "#dcfce7" : "#fee2e2",
              color: s.isActive ? "#16a34a" : "#dc2626",
            }}>
              {s.isActive ? "Actif" : "Inactif"}
            </button>

            <button onClick={() => del(s.id)} style={{
              background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4,
            }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {showForm ? (
          <div style={{
            background: "#f9fafb", border: "1.5px dashed #d1d5db",
            borderRadius: 12, padding: 16, marginTop: stores.length > 0 ? 8 : 0,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={LS}>Nom de la boutique</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Mon Store" style={IS} />
              </div>
              <div>
                <label style={LS}>Domaine Shopify</label>
                <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="mon-store.myshopify.com" style={IS} />
              </div>
              <div>
                <label style={LS}>Access Token</label>
                <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="shpat_..." style={IS} />
              </div>
              <div>
                <label style={LS}>Webhook Secret</label>
                <input value={secret} onChange={e => setSecret(e.target.value)} type="password" placeholder="shp_..." style={IS} />
              </div>
            </div>
            {formError && (
              <p style={{ fontSize: 11, color: "#dc2626", margin: "0 0 10px" }}>{formError}</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addStore} disabled={adding} style={{
                padding: "8px 18px", borderRadius: 9, border: "none",
                background: "#0d3938", color: "white", fontWeight: 700,
                fontSize: 12, cursor: adding ? "not-allowed" : "pointer",
                opacity: adding ? 0.7 : 1,
              }}>
                {adding ? "Connexion…" : "Connecter"}
              </button>
              <button onClick={() => { setShowForm(false); setFormError(""); }} style={{
                padding: "8px 18px", borderRadius: 9,
                border: "1.5px solid #e5e7eb", background: "white",
                color: "#374151", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9,
            border: "1.5px dashed #d1d5db", background: "transparent",
            color: "#6b7280", fontWeight: 600, fontSize: 12, cursor: "pointer",
            marginTop: stores.length > 0 ? 4 : 0,
          }}>
            <Plus size={13} /> Ajouter une boutique
          </button>
        )}
      </Card>
    </div>
  );
}

// ─── System Tab ───────────────────────────────────────────────────────────────
function SystemTab() {
  const [stats,   setStats]   = useState<SysStats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/system/stats")
      .then(r => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={load} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 9,
          border: "1.5px solid #e5e7eb", background: "white",
          color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Actualiser
        </button>
      </div>

      {stats ? (
        <>
          <Card title="Taille de la base de données">
            <div style={{ fontSize: 38, fontWeight: 900, color: "#111827", letterSpacing: -1 }}>
              {stats.dbSize}
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
              PostgreSQL — taille totale
            </p>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
            {([
              { label: "Commandes",  value: stats.orders,   color: "#0d3938" },
              { label: "Employés",   value: stats.users,    color: "#0ea5e9" },
              { label: "Produits",   value: stats.products, color: "#f59e0b" },
              { label: "Statuts",    value: stats.statuses, color: "#10b981" },
            ] as const).map(item => (
              <div key={item.label} style={{
                background: "white", borderRadius: 14, padding: "18px 20px",
                border: "1px solid #edf0f5", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: item.color }}>
                  {item.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : !loading ? (
        <Card title="Statistiques système">
          <p style={{ fontSize: 12, color: "#9ca3af" }}>
            Cliquez sur Actualiser pour charger les statistiques.
          </p>
        </Card>
      ) : null}

      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: 12 }}>
          Chargement…
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "general" as const, label: "Général",  Icon: Settings2 },
  { id: "shopify" as const, label: "Shopify",  Icon: Store },
  { id: "system"  as const, label: "Système",  Icon: Database },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<"general" | "shopify" | "system">("general");

  return (
    <div style={{ padding: "24px 28px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Paramètres</h1>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>
          Configuration du système PrimeCOD
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 22,
        background: "#f3f4f6", borderRadius: 12, padding: 4,
        width: "fit-content",
      }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 16px", borderRadius: 9, border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: tab === id ? "white" : "transparent",
            color: tab === id ? "#111827" : "#6b7280",
            boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s",
          }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "general" && <GeneralTab />}
      {tab === "shopify" && <ShopifyTab />}
      {tab === "system"  && <SystemTab />}
    </div>
  );
}

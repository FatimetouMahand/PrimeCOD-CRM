"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, Bell, BellOff, Power, ListChecks, CheckCircle2, Flag } from "lucide-react";

interface Status {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  isFinal: boolean;
  alertAfterHours: number | null;
  createdAt: string;
}

const PRESET_COLORS = [
  "#22c55e", "#16a34a",
  "#3b82f6", "#1d4ed8",
  "#f59e0b", "#d97706",
  "#ef4444", "#dc2626",
  "#3c665c", "#0d3938",
  "#06b6d4", "#0891b2",
  "#ec4899", "#db2777",
  "#6b7280", "#374151",
];

export default function StatusesPage() {
  const [statuses, setStatuses]   = useState<Status[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editId,   setEditId]     = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Form fields
  const [name,    setName]    = useState("");
  const [color,   setColor]   = useState("#0d3938");
  const [hours,   setHours]   = useState("");
  const [isFinal, setIsFinal] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/statuses")
      .then(r => r.ok ? r.json() : { statuses: [] })
      .then(d => setStatuses(d.statuses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setName(""); setColor("#0d3938"); setHours(""); setIsFinal(false); setErr("");
    setShowForm(false); setEditId(null);
  };

  const openAdd = () => {
    resetForm(); setShowForm(true);
  };

  const openEdit = (s: Status) => {
    setName(s.name);
    setColor(s.color);
    setHours(s.alertAfterHours ? String(s.alertAfterHours) : "");
    setIsFinal(s.isFinal);
    setErr("");
    setEditId(s.id);
    setShowForm(true);
  };

  const submit = async () => {
    setErr("");
    if (!name.trim()) { setErr("Le nom est requis"); return; }
    setSaving(true);
    const body = { name: name.trim(), color, isFinal, alertAfterHours: hours ? Number(hours) : null };
    const url    = editId ? `/api/statuses/${editId}` : "/api/statuses";
    const method = editId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) { resetForm(); load(); }
    else { const d = await res.json(); setErr(d.error || "Erreur"); }
  };

  const toggleActive = async (s: Status) => {
    await fetch(`/api/statuses/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    load();
  };

  const confirmDelete = (id: string) => setConfirmId(id);

  const doDelete = async () => {
    if (!confirmId) return;
    await fetch(`/api/statuses/${confirmId}`, { method: "DELETE" });
    setConfirmId(null);
    load();
  };

  const active   = statuses.filter(s => s.isActive);
  const inactive = statuses.filter(s => !s.isActive);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 800, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>
            Gestion des Statuts
          </h1>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>
            {active.length} statut{active.length !== 1 ? "s" : ""} actif{active.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10, border: "none",
            background: "#0d3938", color: "white",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}
        >
          <Plus size={14} /> Ajouter un statut
        </button>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total statuts",  value: statuses.length,                                      icon: <ListChecks  size={14}/>, bg: "#beecdf" },
          { label: "Actifs",         value: active.length,                                        icon: <CheckCircle2 size={14}/>, bg: "#dcfce7" },
          { label: "Avec alerte",    value: statuses.filter(s => s.alertAfterHours).length,       icon: <Bell        size={14}/>, bg: "#fef3c7" },
          { label: "Statuts finaux", value: statuses.filter(s => s.isFinal).length,                icon: <Flag        size={14}/>, bg: "#dbeafe" },
        ].map(s => (
          <div key={s.label} className="glass-card">
            <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>{s.label}</p>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>{s.value}</h2>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div style={{
          background: "white", borderRadius: 16, padding: "20px 22px",
          border: "1px solid #edf0f5", boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <strong style={{ fontSize: 14, color: "#111827" }}>
              {editId ? "Modifier le statut" : "Nouveau statut"}
            </strong>
            <button onClick={resetForm} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              <X size={16} />
            </button>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Nom du statut</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Confirmée, En attente, Ne répond pas…"
              style={IS}
              onKeyDown={e => e.key === "Enter" && submit()}
            />
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: 14 }}>
            <label style={LS}>Couleur</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", border: "none",
                    background: c, cursor: "pointer",
                    outline: color === c ? `3px solid ${c}` : "none",
                    outlineOffset: 2,
                    transform: color === c ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.1s",
                  }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e5e7eb", cursor: "pointer", padding: 2 }}
                title="Couleur personnalisée"
              />
              {/* Preview badge */}
              <span style={{
                marginLeft: 8, padding: "3px 12px", borderRadius: 999,
                background: color + "22", color, fontSize: 11, fontWeight: 700,
              }}>
                {name || "Aperçu"}
              </span>
            </div>
          </div>

          {/* Alert hours */}
          <div style={{ marginBottom: 18 }}>
            <label style={LS}>
              <Bell size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
              Alerte de suivi (heures) — optionnel
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="number"
                min={1}
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="Ex: 24"
                style={{ ...IS, width: 100 }}
              />
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                {hours ? `Rappel après ${hours}h sans action` : "Pas d'alerte automatique"}
              </span>
            </div>
          </div>

          {/* isFinal toggle */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div
                onClick={() => setIsFinal(v => !v)}
                style={{
                  width: 38, height: 22, borderRadius: 11, cursor: "pointer",
                  background: isFinal ? "#0d3938" : "#e5e7eb",
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: isFinal ? 19 : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "white",
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  Statut final (commande terminée)
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>
                  {isFinal
                    ? "✅ Les commandes avec ce statut ne seront plus redistribuées"
                    : "Les commandes resteront dans la file de distribution"}
                </div>
              </div>
            </label>
          </div>

          {err && <p style={{ fontSize: 11, color: "#dc2626", marginBottom: 12 }}>{err}</p>}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submit}
              disabled={saving}
              style={{
                padding: "9px 22px", borderRadius: 10, border: "none",
                background: "#0d3938", color: "white", fontWeight: 700,
                fontSize: 12, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Check size={13} /> {saving ? "Enregistrement…" : editId ? "Mettre à jour" : "Créer"}
            </button>
            <button
              onClick={resetForm}
              style={{
                padding: "9px 18px", borderRadius: 10,
                border: "1.5px solid #e5e7eb", background: "white",
                color: "#374151", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Active statuses */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", fontSize: 12 }}>
          Chargement…
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Actifs ({active.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {active.map(s => <StatusRow key={s.id} s={s} onEdit={openEdit} onToggle={toggleActive} onDelete={confirmDelete} />)}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Désactivés ({inactive.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.65 }}>
                {inactive.map(s => <StatusRow key={s.id} s={s} onEdit={openEdit} onToggle={toggleActive} onDelete={confirmDelete} />)}
              </div>
            </div>
          )}

          {statuses.length === 0 && (
            <div style={{
              background: "white", borderRadius: 16, padding: "48px 24px",
              border: "1px solid #edf0f5", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                Aucun statut créé
              </p>
              <p style={{ fontSize: 11, color: "#9ca3af" }}>
                Créez vos premiers statuts (Confirmée, En attente, Rejetée…)
              </p>
            </div>
          )}
        </>
      )}

      {/* Confirm delete modal */}
      {confirmId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "white", borderRadius: 18, padding: 28, width: 320, textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "#fee2e2",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
              Supprimer ce statut ?
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 22, lineHeight: 1.6 }}>
              Il n&apos;apparaîtra plus dans le formulaire ni dans les filtres, mais les anciennes commandes <strong>garderont leur étiquette</strong>.
              <br /><br />
              Pour le réactiver/désactiver temporairement sans le supprimer, utilisez plutôt le bouton <Power size={11} style={{ display: "inline", verticalAlign: "middle" }} /> sur la ligne du statut.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => setConfirmId(null)}
                style={{ padding: "9px 22px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Annuler
              </button>
              <button
                onClick={doDelete}
                style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: "#ef4444", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status row ───────────────────────────────────────────────────────────────
function StatusRow({
  s, onEdit, onToggle, onDelete,
}: {
  s: Status;
  onEdit: (s: Status) => void;
  onToggle: (s: Status) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "white", borderRadius: 12, padding: "13px 16px",
      border: "1px solid #edf0f5", boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
    }}>
      {/* Color dot */}
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, flexShrink: 0 }} />

      {/* Badge preview */}
      <span style={{
        padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: s.color + "22", color: s.color, whiteSpace: "nowrap",
      }}>
        {s.name}
      </span>

      {/* Alert info */}
      {s.alertAfterHours ? (
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>
          <Bell size={10} /> Alerte {s.alertAfterHours}h
        </span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#d1d5db" }}>
          <BellOff size={10} /> Pas d&apos;alerte
        </span>
      )}

      {/* isFinal badge */}
      {s.isFinal && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
          background: "#beecdf", color: "#0d3938",
        }}>
          ✓ FINAL
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* isActive badge */}
      <span style={{
        fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase",
        background: s.isActive ? "#dcfce7" : "#f3f4f6",
        color: s.isActive ? "#16a34a" : "#9ca3af",
      }}>
        {s.isActive ? "Actif" : "Inactif"}
      </span>

      {/* Actions */}
      <button
        onClick={() => onEdit(s)}
        title="Modifier"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4 }}
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={() => onToggle(s)}
        title={s.isActive ? "Désactiver" : "Réactiver"}
        style={{ background: "none", border: "none", cursor: "pointer", color: s.isActive ? "#f59e0b" : "#22c55e", padding: 4 }}
      >
        <Power size={13} />
      </button>
      <button
        onClick={() => onDelete(s.id)}
        title="Supprimer définitivement"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}
      >
        <Trash2 size={13} />
      </button>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PackagePlus, Trash2, Edit2, Pencil, Search,
  Package, ShoppingCart, Users, Shuffle, X, ChevronDown,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Agent   { id: string; name: string; }
interface Product {
  id: string; name: string; code: string; price: number;
  distributionType: string; createdAt: string;
  _count: { orders: number };
  assignedAgentIds: string[];
  hiddenForAgentIds: string[];
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [agents,     setAgents]     = useState<Agent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [showAdd,    setShowAdd]    = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set()); // cartes dépliées (mobile)

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // ── Fetch ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, ag] = await Promise.all([
        fetch("/api/products").then(r => r.json()),
        fetch("/api/agents").then(r => r.json()),
      ]);
      setProducts(pr.products ?? []);
      setAgents(ag.agents ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Selection ─────────────────────────────────────────────────────────
  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = (list: Product[]) =>
    setSelected(prev => prev.size === list.length ? new Set() : new Set(list.map(p => p.id)));

  // ── Bulk delete ───────────────────────────────────────────────────────
  const [deleteError, setDeleteError] = useState("");

  const handleDelete = async () => {
    setDeleteError("");
    const res = await fetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDeleteError(data.error || "Échec de la suppression");
      return;
    }
    setProducts(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
    setConfirmDel(false);
  };

  const displayed = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  const totalOrders = products.reduce((s, p) => s + p._count.orders, 0);
  const specific    = products.filter(p => p.distributionType === "specific").length;

  // IDs d'agents → agents (nom) pour l'affichage des badges
  const agentsByIds = (ids: string[]) => agents.filter(a => ids.includes(a.id));

  const assignedBadges = (p: Product) =>
    p.distributionType === "specific" && p.assignedAgentIds.length > 0 ? (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {agentsByIds(p.assignedAgentIds).slice(0, 3).map(a => (
          <span key={a.id} style={{ background: "#beecdf", color: "#0d3938", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600 }}>{a.name}</span>
        ))}
        {p.assignedAgentIds.length > 3 && <span style={{ fontSize: 10, color: "#9ca3af" }}>+{p.assignedAgentIds.length - 3}</span>}
      </div>
    ) : <span style={{ color: "#9ca3af", fontSize: 10 }}>Tous les agents</span>;

  const hiddenBadges = (p: Product) =>
    p.hiddenForAgentIds.length > 0 ? (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {agentsByIds(p.hiddenForAgentIds).slice(0, 3).map(a => (
          <span key={a.id} style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600 }}>{a.name}</span>
        ))}
        {p.hiddenForAgentIds.length > 3 && <span style={{ fontSize: 10, color: "#9ca3af" }}>+{p.hiddenForAgentIds.length - 3}</span>}
      </div>
    ) : <span style={{ color: "#9ca3af", fontSize: 10 }}>—</span>;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "3px" }}>Produits</h1>
          <p style={{ color: "#6b7280", fontSize: "11px" }}>{products.length} produit{products.length > 1 ? "s" : ""} enregistré{products.length > 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "#0d3938", color: "white", padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          <PackagePlus size={14} /> Ajouter un produit
        </button>
      </div>

      {/* QUICK STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Total produits",          value: products.length,            icon: <Package      size={13}/>, bg: "#beecdf" },
          { label: "Commandes totales",       value: totalOrders,                icon: <ShoppingCart size={13}/>, bg: "#dcfce7" },
          { label: "Distribution spécifique", value: specific,                   icon: <Users        size={13}/>, bg: "#dbeafe" },
          { label: "Distribution libre",      value: products.length - specific, icon: <Shuffle      size={13}/>, bg: "#fef3c7" },
        ].map(s => (
          <div key={s.label} className="glass-card">
            <div style={{ padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 9, color: "#6b7280", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700 }}>{s.label}</p>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{s.value}</h2>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="glass-card" style={{ marginBottom: "10px" }}>
        <div style={{ padding: "10px 14px", display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher nom ou code…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: 12, height: 34, border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 11, outline: "none", background: "#f9fafb" }} />
          </div>
          {selected.size > 0 && (
            <>
              <button onClick={() => setShowBulkEdit(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, height: 34, border: "1px solid #0d3938", background: "#beecdf", color: "#0d3938", padding: "0 14px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Pencil size={13} /> Modifier ({selected.size})
              </button>
              <button onClick={() => setConfirmDel(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, height: 34, border: "none", background: "#ef4444", color: "white", padding: "0 14px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Trash2 size={13} /> Supprimer ({selected.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* LISTE DES PRODUITS — tableau (PC) + cartes (téléphone) */}
      {loading ? (
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Chargement…</div>
      ) : displayed.length === 0 ? (
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Aucun produit — cliquez sur « Ajouter un produit »</div>
      ) : (
        <>
          {/* ── GRAND ÉCRAN : tableau ── */}
          <div className="responsive-table-desktop glass-card">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f3f4f6", textAlign: "left" }}>
                    <th style={{ ...thP, width: 34 }}>
                      <input type="checkbox" checked={selected.size === displayed.length && displayed.length > 0} onChange={() => toggleAll(displayed)} style={{ cursor: "pointer" }} />
                    </th>
                    {["Code", "Nom", "Prix", "Distribution", "Agents assignés", "Masqué pour", "Commandes", "Actions"].map(h => (
                      <th key={h} style={thP}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(p => (
                    <tr key={p.id}
                      style={{ borderBottom: "1px solid #f9fafb", background: selected.has(p.id) ? "#f0f7f4" : "transparent" }}
                      onMouseEnter={e => { if (!selected.has(p.id)) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected.has(p.id) ? "#f0f7f4" : "transparent"; }}>

                      <td style={tdP}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} style={{ cursor: "pointer" }} /></td>

                      <td style={tdP}>
                        <code style={{ background: "#f3f4f6", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, color: "#0d3938" }}>{p.code}</code>
                      </td>

                      <td style={{ ...tdP, fontWeight: 700 }}>{p.name}</td>

                      <td style={{ ...tdP, color: "#16a34a", fontWeight: 600 }}>
                        {p.price > 0 ? `${p.price.toLocaleString()} MRU` : "—"}
                      </td>

                      <td style={tdP}><DistribBadge type={p.distributionType} /></td>

                      <td style={tdP}>{assignedBadges(p)}</td>

                      <td style={tdP}>{hiddenBadges(p)}</td>

                      <td style={{ ...tdP, fontWeight: 700 }}>{p._count.orders}</td>

                      <td style={tdP}>
                        <button onClick={() => setEditTarget(p)}
                          style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 7, background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Edit2 size={12} color="#6b7280" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── TÉLÉPHONE : cartes pliables ── */}
          <div className="responsive-cards-mobile">
            {displayed.map(p => {
              const isOpen = expanded.has(p.id);
              return (
                <div key={p.id} className="glass-card" style={{ overflow: "hidden", background: selected.has(p.id) ? "#f0f7f4" : undefined }}>
                  {/* En-tête */}
                  <div onClick={() => toggleExpand(p.id)} style={{ padding: "11px 13px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={selected.has(p.id)} onClick={e => e.stopPropagation()} onChange={() => toggleOne(p.id)} style={{ cursor: "pointer", flexShrink: 0, width: 16, height: 16 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <code style={{ fontSize: 10, color: "#6b7280" }}>{p.code}</code>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <DistribBadge type={p.distributionType} />
                      <button onClick={() => toggleExpand(p.id)} aria-label={isOpen ? "Réduire" : "Détails"}
                        style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, border: "1px solid #e5e7eb", background: isOpen ? "#0d3938" : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>
                        <ChevronDown size={14} color={isOpen ? "white" : "#9ca3af"} />
                      </button>
                    </div>
                  </div>

                  {/* Détails */}
                  {isOpen && (
                    <div style={{ padding: "0 13px 13px", borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                        <CardFieldP label="Prix">{p.price > 0 ? `${p.price.toLocaleString()} MRU` : "—"}</CardFieldP>
                        <CardFieldP label="Commandes">{p._count.orders}</CardFieldP>
                        <div style={{ gridColumn: "1 / -1" }}><CardFieldP label="Agents assignés">{assignedBadges(p)}</CardFieldP></div>
                        <div style={{ gridColumn: "1 / -1" }}><CardFieldP label="Masqué pour">{hiddenBadges(p)}</CardFieldP></div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <button onClick={() => setEditTarget(p)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 30, border: "1px solid #e5e7eb", background: "white", color: "#374151", padding: "0 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          <Edit2 size={12} /> Modifier
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showAdd    && <ProductModal agents={agents} onClose={() => setShowAdd(false)} onSaved={p => { setProducts(prev => [p, ...prev]); setShowAdd(false); }} />}
      {editTarget && <ProductModal product={editTarget} agents={agents} onClose={() => setEditTarget(null)} onSaved={u => { setProducts(prev => prev.map(p => p.id === u.id ? u : p)); setEditTarget(null); }} />}

      {showBulkEdit && (
        <BulkEditModal
          ids={[...selected]}
          agents={agents}
          onClose={() => setShowBulkEdit(false)}
          onSaved={updated => {
            setProducts(prev => prev.map(p => updated.find(u => u.id === p.id) ?? p));
            setSelected(new Set());
            setShowBulkEdit(false);
          }}
        />
      )}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ padding: 24, width: 300, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Trash2 size={20} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Supprimer les produits ?</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
              Supprimer <strong>{selected.size}</strong> produit{selected.size > 1 ? "s" : ""} définitivement ? Action irréversible.
            </p>
            {deleteError && (
              <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 12, background: "#fee2e2", padding: "8px 12px", borderRadius: 8 }}>
                ⚠ {deleteError}
              </p>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => { setConfirmDel(false); setDeleteError(""); }} style={{ border: "1px solid #e5e7eb", background: "white", padding: "9px 20px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleDelete} style={{ border: "none", background: "#ef4444", color: "white", padding: "9px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══ AGENT MULTI-SELECT (réutilisé : agents assignés / agents exclus) ══════════
function AgentMultiSelect({ label, agents, selected, onToggle, placeholder = "Select agents…", tone = "teal" }: {
  label?: string; agents: Agent[]; selected: Set<string>; onToggle: (id: string) => void;
  placeholder?: string; tone?: "teal" | "red";
}) {
  const [open, setOpen] = useState(false);
  const badgeBg    = tone === "red" ? "#fee2e2" : "#beecdf";
  const badgeColor = tone === "red" ? "#b91c1c" : "#0d3938";

  return (
    <div>
      {label && <label style={L}>{label}</label>}
      <div style={{ position: "relative" }}>
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ ...I, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: "white" }}>
          <span style={{ color: selected.size ? "#111827" : "#9ca3af" }}>
            {selected.size ? `${selected.size} agent(s) sélectionné(s)` : placeholder}
          </span>
          <ChevronDown size={13} />
        </button>
        {open && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid #e5e7eb", borderRadius: 9, padding: 6, boxShadow: "0 8px 20px rgba(0,0,0,0.08)", maxHeight: 170, overflowY: "auto" }}>
            {agents.length === 0
              ? <p style={{ fontSize: 11, color: "#9ca3af", padding: 8 }}>Aucun agent disponible</p>
              : agents.map(a => (
                <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, cursor: "pointer", background: selected.has(a.id) ? badgeBg : "transparent" }}>
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => onToggle(a.id)} style={{ cursor: "pointer" }} />
                  <span style={{ fontSize: 11, fontWeight: selected.has(a.id) ? 700 : 400 }}>{a.name}</span>
                </label>
              ))
            }
          </div>
        )}
      </div>
      {selected.size > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
          {agents.filter(a => selected.has(a.id)).map(a => (
            <span key={a.id} style={{ background: badgeBg, color: badgeColor, padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              {a.name}
              <button type="button" onClick={() => onToggle(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: badgeColor, padding: 0, display: "flex" }}><X size={9}/></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ══ PRODUCT MODAL ══════════════════════════════════════════════════════════
function ProductModal({ product, agents, onClose, onSaved }: {
  product?: Product; agents: Agent[]; onClose: () => void; onSaved: (p: Product) => void;
}) {
  const [name,    setName]    = useState(product?.name  ?? "");
  const [price,   setPrice]   = useState(product?.price ?? 0);
  const [distrib, setDistrib] = useState(product?.distributionType ?? "random");
  const [selAgents, setSelAgents] = useState<Set<string>>(new Set(product?.assignedAgentIds ?? []));
  const [selHidden, setSelHidden] = useState<Set<string>>(new Set(product?.hiddenForAgentIds ?? []));
  const [error,   setError]   = useState("");
  const [saving,  setSaving]  = useState(false);

  const toggleAgent  = (id: string) =>
    setSelAgents(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleHidden = (id: string) =>
    setSelHidden(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom du produit est requis"); return; }
    setSaving(true); setError("");
    const body = {
      name: name.trim(), price: Number(price), distributionType: distrib,
      agentIds: distrib === "specific" ? [...selAgents] : [],
      hiddenAgentIds: [...selHidden],
    };
    const url    = product ? `/api/products/${product.id}` : "/api/products";
    const method = product ? "PATCH" : "POST";
    const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Error"); return; }
    onSaved(data.product);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="glass-card" style={{ padding: 24, width: 360, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <strong style={{ fontSize: 14 }}>{product ? "Modifier le produit" : "Ajouter un produit"}</strong>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={16} /></button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div>
            <label style={L}>Nom <span style={{ color: "#ef4444" }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex. Crème Éclaircissante" style={I} />
            {!product && <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Le code sera généré automatiquement (ex. CRE-4821)</p>}
          </div>

          {product && (
            <div>
              <label style={L}>Code (auto)</label>
              <code style={{ display: "block", background: "#f3f4f6", padding: "7px 10px", borderRadius: 8, fontSize: 11, color: "#0d3938" }}>{product.code}</code>
            </div>
          )}

          <div>
            <label style={L}>Prix (MRU)</label>
            <input type="number" min="0" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="0" style={I} />
          </div>

          <div>
            <label style={L}>Distribution</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { val: "random",   label: "🔀 Libre",      desc: "Agent en ligne le moins chargé" },
                { val: "specific", label: "👥 Spécifique", desc: "Uniquement les agents sélectionnés" },
              ].map(opt => (
                <button key={opt.val} type="button" onClick={() => setDistrib(opt.val)} title={opt.desc}
                  style={{
                    flex: 1, padding: "8px 10px", border: "2px solid", borderRadius: 9,
                    borderColor: distrib === opt.val ? "#0d3938" : "#e5e7eb",
                    background:  distrib === opt.val ? "#beecdf" : "white",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    color: distrib === opt.val ? "#4f46e5" : "#374151",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {distrib === "specific" && (
            <AgentMultiSelect
              label="Agents assignés"
              agents={agents}
              selected={selAgents}
              onToggle={toggleAgent}
              placeholder="Sélectionner des agents…"
            />
          )}

          <AgentMultiSelect
            label="Masqué pour (agents exclus)"
            agents={agents}
            selected={selHidden}
            onToggle={toggleHidden}
            placeholder="Aucun agent exclu"
            tone="red"
          />

          {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
          <button type="submit" disabled={saving} style={S}>{saving ? "Enregistrement…" : product ? "Enregistrer" : "Ajouter le produit"}</button>
        </form>
      </div>
    </div>
  );
}

// ══ BULK EDIT MODAL (Actions groupées) ════════════════════════════════════
function BulkEditModal({ ids, agents, onClose, onSaved }: {
  ids: string[]; agents: Agent[]; onClose: () => void; onSaved: (products: Product[]) => void;
}) {
  const [editPrice,   setEditPrice]   = useState(false);
  const [price,       setPrice]       = useState(0);
  const [editDistrib, setEditDistrib] = useState(false);
  const [distrib,     setDistrib]     = useState("random");
  const [editAgents,  setEditAgents]  = useState(false);
  const [selAgents,   setSelAgents]   = useState<Set<string>>(new Set());
  const [editHidden,  setEditHidden]  = useState(false);
  const [selHidden,   setSelHidden]   = useState<Set<string>>(new Set());
  const [error,  setError]  = useState("");
  const [saving, setSaving] = useState(false);

  const toggleAgent  = (id: string) =>
    setSelAgents(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleHidden = (id: string) =>
    setSelHidden(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPrice && !editDistrib && !editAgents && !editHidden) {
      setError("Cochez au moins un champ à modifier");
      return;
    }
    setSaving(true); setError("");
    const body: Record<string, unknown> = { ids };
    if (editPrice)   body.price = Number(price);
    if (editDistrib) body.distributionType = distrib;
    if (editAgents)  body.agentIds = [...selAgents];
    if (editHidden)  body.hiddenAgentIds = [...selHidden];

    const res  = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Error"); return; }
    onSaved(data.products ?? []);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="glass-card" style={{ padding: 24, width: 380, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <strong style={{ fontSize: 14 }}>Modifier en groupe</strong>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 14 }}>
          S&apos;applique à <strong>{ids.length}</strong> produit{ids.length > 1 ? "s" : ""} sélectionné{ids.length > 1 ? "s" : ""}. Seuls les champs cochés seront modifiés.
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 9, padding: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: editPrice ? 8 : 0 }}>
              <input type="checkbox" checked={editPrice} onChange={e => setEditPrice(e.target.checked)} />
              Prix (MRU)
            </label>
            {editPrice && (
              <input type="number" min="0" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="0" style={I} />
            )}
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 9, padding: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: editDistrib ? 8 : 0 }}>
              <input type="checkbox" checked={editDistrib} onChange={e => setEditDistrib(e.target.checked)} />
              Type de distribution
            </label>
            {editDistrib && (
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { val: "random",   label: "🔀 Libre" },
                  { val: "specific", label: "👥 Spécifique" },
                ].map(opt => (
                  <button key={opt.val} type="button" onClick={() => setDistrib(opt.val)}
                    style={{
                      flex: 1, padding: "8px 10px", border: "2px solid", borderRadius: 9,
                      borderColor: distrib === opt.val ? "#0d3938" : "#e5e7eb",
                      background:  distrib === opt.val ? "#beecdf" : "white",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      color: distrib === opt.val ? "#4f46e5" : "#374151",
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 9, padding: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: editAgents ? 8 : 0 }}>
              <input type="checkbox" checked={editAgents} onChange={e => setEditAgents(e.target.checked)} />
              Agents assignés
            </label>
            {editAgents && (
              <AgentMultiSelect agents={agents} selected={selAgents} onToggle={toggleAgent} placeholder="Sélectionner des agents…" />
            )}
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 9, padding: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: editHidden ? 8 : 0 }}>
              <input type="checkbox" checked={editHidden} onChange={e => setEditHidden(e.target.checked)} />
              Masqué pour (agents exclus)
            </label>
            {editHidden && (
              <AgentMultiSelect agents={agents} selected={selHidden} onToggle={toggleHidden} placeholder="Aucun agent exclu" tone="red" />
            )}
          </div>

          {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
          <button type="submit" disabled={saving} style={S}>{saving ? "Enregistrement…" : `Appliquer à ${ids.length} produit${ids.length > 1 ? "s" : ""}`}</button>
        </form>
      </div>
    </div>
  );
}

// Badge de distribution (Spécifique / Libre)
function DistribBadge({ type }: { type: string }) {
  const specific = type === "specific";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: "999px", fontSize: 10, fontWeight: 700,
      background: specific ? "#dbeafe" : "#f3f4f6",
      color:      specific ? "#1d4ed8" : "#374151",
      whiteSpace: "nowrap",
    }}>
      {specific ? <><Users size={9}/> Spécifique</> : <><Shuffle size={9}/> Libre</>}
    </span>
  );
}

// Champ "label + valeur" pour les cartes mobiles
function CardFieldP({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{children}</div>
    </div>
  );
}

const L: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5 };
const I: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 9, padding: "0 12px", fontSize: 12, outline: "none", background: "#f9fafb", boxSizing: "border-box" };
const S: React.CSSProperties = { border: "none", background: "#0d3938", color: "white", padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" };
const thP: React.CSSProperties = { padding: "8px 12px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.02em" };
const tdP: React.CSSProperties = { padding: "7px 12px", whiteSpace: "nowrap" };

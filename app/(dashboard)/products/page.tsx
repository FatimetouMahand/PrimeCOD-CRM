"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PackagePlus, Trash2, Edit2, Search,
  Package, ShoppingCart, Users, Shuffle, X, ChevronDown,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Agent   { id: string; name: string; }
interface Product {
  id: string; name: string; code: string; price: number;
  distributionType: string; createdAt: string;
  _count: { orders: number };
  agents: { agent: Agent }[];
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
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (list: Product[]) =>
    setSelected(prev => prev.size === list.length ? new Set() : new Set(list.map(p => p.id)));

  // ── Bulk delete ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    await fetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
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

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "3px" }}>Products</h1>
          <p style={{ color: "#6b7280", fontSize: "11px" }}>{products.length} products registered</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "#0d3938", color: "white", padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          <PackagePlus size={14} /> Add Product
        </button>
      </div>

      {/* QUICK STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px", marginBottom: "14px" }}>
        {[
          { label: "Total Products",  value: products.length,          icon: <Package      size={14}/>, bg: "#beecdf" },
          { label: "Total Orders",    value: totalOrders,              icon: <ShoppingCart size={14}/>, bg: "#dcfce7" },
          { label: "Specific Dist.",  value: specific,                 icon: <Users        size={14}/>, bg: "#dbeafe" },
          { label: "Random Dist.",    value: products.length - specific, icon: <Shuffle    size={14}/>, bg: "#fef3c7" },
        ].map(s => (
          <div key={s.label} className="glass-card">
            <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "10px", color: "#6b7280", marginBottom: "3px" }}>{s.label}</p>
                <h2 style={{ fontSize: "18px", fontWeight: 800 }}>{s.value}</h2>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="glass-card" style={{ marginBottom: "10px" }}>
        <div style={{ padding: "10px 14px", display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or code…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: 12, height: 34, border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 11, outline: "none", background: "#f9fafb" }} />
          </div>
          {selected.size > 0 && (
            <button onClick={() => setConfirmDel(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, height: 34, border: "none", background: "#ef4444", color: "white", padding: "0 14px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <Trash2 size={13} /> Delete ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="glass-card">
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Loading…</div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>No products yet — click "Add Product"</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6", textAlign: "left" }}>
                  <th style={{ padding: "11px 14px", width: 36 }}>
                    <input type="checkbox" checked={selected.size === displayed.length && displayed.length > 0} onChange={() => toggleAll(displayed)} style={{ cursor: "pointer" }} />
                  </th>
                  {["Code", "Name", "Price", "Distribution", "Assigned Agents", "Orders", "Actions"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(p => (
                  <tr key={p.id}
                    style={{ borderBottom: "1px solid #f9fafb", background: selected.has(p.id) ? "#f0f7f4" : "transparent" }}
                    onMouseEnter={e => { if (!selected.has(p.id)) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected.has(p.id) ? "#f0f7f4" : "transparent"; }}>

                    <td style={{ padding: "10px 14px" }}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} style={{ cursor: "pointer" }} /></td>

                    <td style={{ padding: "10px 14px" }}>
                      <code style={{ background: "#f3f4f6", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700, color: "#0d3938" }}>{p.code}</code>
                    </td>

                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{p.name}</td>

                    <td style={{ padding: "10px 14px", color: "#16a34a", fontWeight: 600 }}>
                      {p.price > 0 ? `${p.price.toLocaleString()} MRU` : "—"}
                    </td>

                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 9px", borderRadius: "999px", fontSize: 10, fontWeight: 700,
                        background: p.distributionType === "specific" ? "#dbeafe" : "#f3f4f6",
                        color:      p.distributionType === "specific" ? "#1d4ed8" : "#374151",
                      }}>
                        {p.distributionType === "specific"
                          ? <><Users size={9}/> Specific</>
                          : <><Shuffle size={9}/> Random</>}
                      </span>
                    </td>

                    <td style={{ padding: "10px 14px" }}>
                      {p.distributionType === "specific" && p.agents.length > 0 ? (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {p.agents.slice(0, 3).map(a => (
                            <span key={a.agent.id} style={{ background: "#beecdf", color: "#0d3938", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600 }}>
                              {a.agent.name}
                            </span>
                          ))}
                          {p.agents.length > 3 && <span style={{ fontSize: 10, color: "#9ca3af" }}>+{p.agents.length - 3}</span>}
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 10 }}>All agents</span>
                      )}
                    </td>

                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{p._count.orders}</td>

                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => setEditTarget(p)}
                        style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 7, background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Edit2 size={12} color="#6b7280" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAdd    && <ProductModal agents={agents} onClose={() => setShowAdd(false)} onSaved={p => { setProducts(prev => [p, ...prev]); setShowAdd(false); }} />}
      {editTarget && <ProductModal product={editTarget} agents={agents} onClose={() => setEditTarget(null)} onSaved={u => { setProducts(prev => prev.map(p => p.id === u.id ? u : p)); setEditTarget(null); }} />}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ padding: 24, width: 300, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Trash2 size={20} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Delete Products?</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
              Delete <strong>{selected.size}</strong> product{selected.size > 1 ? "s" : ""}? Orders linked to them will lose their product reference.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setConfirmDel(false)} style={{ border: "1px solid #e5e7eb", background: "white", padding: "9px 20px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} style={{ border: "none", background: "#ef4444", color: "white", padding: "9px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
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
  const [selAgents, setSelAgents] = useState<Set<string>>(new Set(product?.agents.map(a => a.agent.id) ?? []));
  const [error,   setError]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const toggleAgent = (id: string) =>
    setSelAgents(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Product name is required"); return; }
    setSaving(true); setError("");
    const body = { name: name.trim(), price: Number(price), distributionType: distrib, agentIds: distrib === "specific" ? [...selAgents] : [] };
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
      <div className="glass-card" style={{ padding: 24, width: 360 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <strong style={{ fontSize: 14 }}>{product ? "Edit Product" : "Add Product"}</strong>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={16} /></button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div>
            <label style={L}>Name <span style={{ color: "#ef4444" }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Crème Éclaircissante" style={I} />
            {!product && <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Code will be auto-generated (e.g. CRE-4821)</p>}
          </div>

          {product && (
            <div>
              <label style={L}>Code (auto)</label>
              <code style={{ display: "block", background: "#f3f4f6", padding: "7px 10px", borderRadius: 8, fontSize: 11, color: "#0d3938" }}>{product.code}</code>
            </div>
          )}

          <div>
            <label style={L}>Price (MRU)</label>
            <input type="number" min="0" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="0" style={I} />
          </div>

          <div>
            <label style={L}>Distribution</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { val: "random",   label: "🔀 Random",   desc: "Least loaded online agent" },
                { val: "specific", label: "👥 Specific",  desc: "Only selected agents" },
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
            <div>
              <label style={L}>Assigned Agents</label>
              <div style={{ position: "relative" }}>
                <button type="button" onClick={() => setAgentOpen(v => !v)}
                  style={{ ...I, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: "white" }}>
                  <span style={{ color: selAgents.size ? "#111827" : "#9ca3af" }}>
                    {selAgents.size ? `${selAgents.size} agent(s) selected` : "Select agents…"}
                  </span>
                  <ChevronDown size={13} />
                </button>
                {agentOpen && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid #e5e7eb", borderRadius: 9, padding: 6, boxShadow: "0 8px 20px rgba(0,0,0,0.08)", maxHeight: 170, overflowY: "auto" }}>
                    {agents.length === 0
                      ? <p style={{ fontSize: 11, color: "#9ca3af", padding: 8 }}>No agents available</p>
                      : agents.map(a => (
                        <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, cursor: "pointer", background: selAgents.has(a.id) ? "#beecdf" : "transparent" }}>
                          <input type="checkbox" checked={selAgents.has(a.id)} onChange={() => toggleAgent(a.id)} style={{ cursor: "pointer" }} />
                          <span style={{ fontSize: 11, fontWeight: selAgents.has(a.id) ? 700 : 400 }}>{a.name}</span>
                        </label>
                      ))
                    }
                  </div>
                )}
              </div>
              {selAgents.size > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {agents.filter(a => selAgents.has(a.id)).map(a => (
                    <span key={a.id} style={{ background: "#beecdf", color: "#0d3938", padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      {a.name}
                      <button type="button" onClick={() => toggleAgent(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#0d3938", padding: 0, display: "flex" }}><X size={9}/></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
          <button type="submit" disabled={saving} style={S}>{saving ? "Saving…" : product ? "Save Changes" : "Add Product"}</button>
        </form>
      </div>
    </div>
  );
}

const L: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5 };
const I: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 9, padding: "0 12px", fontSize: 12, outline: "none", background: "#f9fafb", boxSizing: "border-box" };
const S: React.CSSProperties = { border: "none", background: "#0d3938", color: "white", padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" };

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, Trash2, UserCheck, Bell, BarChart2,
  SlidersHorizontal, ChevronDown, X, Calendar,
  ShoppingCart, CheckCircle2, Clock3, DollarSign,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";

// ── Types ──────────────────────────────────────────────────────────────────
interface Agent   { id: string; name: string; }
interface Status  { id: string; name: string; color: string; alertAfterHours?: number | null; isFinal?: boolean; }
interface Product { id: string; name: string; }
interface Order {
  id: string; customer: string; phone: string; city: string;
  price: number; quantity: number; revenue: number; createdAt: string;
  status: Status; product: Product; agent: Agent | null;
}
interface Stats { total: number; revenue: number; confirmed: number; pending: number; }

// ── Column definitions ─────────────────────────────────────────────────────
const COLS = [
  { key: "num",      label: "#",        hideable: false },
  { key: "date",     label: "Date",     hideable: true  },
  { key: "customer", label: "Customer", hideable: false },
  { key: "phone",    label: "Phone",    hideable: true  },
  { key: "city",     label: "City",     hideable: true  },
  { key: "product",  label: "Product",  hideable: true  },
  { key: "price",    label: "Price",    hideable: true  },
  { key: "qty",      label: "Qty",      hideable: true  },
  { key: "revenue",  label: "Revenue",  hideable: true  },
  { key: "agent",    label: "Agent",    hideable: true  },
  { key: "status",   label: "Status",   hideable: false },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [statuses,  setStatuses]  = useState<Status[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [agents,    setAgents]    = useState<Agent[]>([]);

  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterDate,    setFilterDate]    = useState(() => {
    // Default: today
    return new Date().toISOString().slice(0, 10);
  });

  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [showStats,    setShowStats]    = useState(true);
  const [showRemind,   setShowRemind]   = useState(false);
  const [showColMenu,  setShowColMenu]  = useState(false);
  const [visibleCols,  setVisibleCols]  = useState<Set<string>>(new Set(COLS.map(c => c.key)));

  const [confirmDel,   setConfirmDel]   = useState(false);
  const [reassignId,   setReassignId]   = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<string | null>(null);

  const sentinel  = useRef<HTMLDivElement>(null);
  const searchTmr = useRef<ReturnType<typeof setTimeout> | null>(null);

  const user    = useUser();
  const isAgent = user?.role === "Agent";

  // ── Fetch orders ──────────────────────────────────────────────────────
  const load = useCallback(async (opts: {
    cursor?: string; search?: string; statusId?: string; productId?: string; date?: string; append?: boolean;
  } = {}) => {
    const { cursor, search: q = "", statusId = "", productId = "", date = "", append = false } = opts;
    const p = new URLSearchParams();
    if (cursor)    p.set("cursor",    cursor);
    if (q)         p.set("search",    q);
    if (statusId)  p.set("statusId",  statusId);
    if (productId) p.set("productId", productId);
    if (date)      { p.set("dateFrom", date); p.set("dateTo", date); }

    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res  = await fetch(`/api/orders?${p}`);
      const data = await res.json();
      setOrders(prev => append ? [...prev, ...data.orders] : data.orders);
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
      if (data.stats) setStats(data.stats);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    load({ date: filterDate });
    Promise.all([
      fetch("/api/statuses").then(r => r.json()),
      fetch("/api/products").then(r => r.json()),
      fetch("/api/agents").then(r => r.json()),
    ]).then(([s, p, a]) => {
      setStatuses(s.statuses ?? []);
      setProducts(p.products ?? []);
      setAgents(a.agents ?? []);
    }).catch(() => {});
  }, [load]);

  // ── Infinite scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (!sentinel.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore && !loadingMore) {
        load({ cursor: nextCursor ?? undefined, search, statusId: filterStatus, productId: filterProduct, date: filterDate, append: true });
      }
    }, { threshold: 0.1 });
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, nextCursor, search, filterStatus, filterProduct, filterDate, load]);

  // ── Search (debounced 400ms) ──────────────────────────────────────────
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTmr.current) clearTimeout(searchTmr.current);
    searchTmr.current = setTimeout(() => {
      load({ search: val, statusId: filterStatus, productId: filterProduct, date: filterDate });
    }, 400);
  };

  // ── Filter change ─────────────────────────────────────────────────────
  const handleFilter = (key: "status" | "product", val: string) => {
    const s = key === "status"  ? val : filterStatus;
    const p = key === "product" ? val : filterProduct;
    key === "status" ? setFilterStatus(val) : setFilterProduct(val);
    load({ search, statusId: s, productId: p, date: filterDate });
  };

  // ── Date filter ───────────────────────────────────────────────────────
  const handleDate = (val: string) => {
    setFilterDate(val);
    load({ search, statusId: filterStatus, productId: filterProduct, date: val });
  };

  const clearDate = () => {
    setFilterDate("");
    load({ search, statusId: filterStatus, productId: filterProduct, date: "" });
  };

  // ── Refresh ───────────────────────────────────────────────────────────
  const refresh = () => {
    setSelected(new Set());
    load({ search, statusId: filterStatus, productId: filterProduct, date: filterDate });
  };

  // ── Selection ─────────────────────────────────────────────────────────
  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(prev => prev.size === orders.length ? new Set() : new Set(orders.map(o => o.id)));

  // ── Bulk delete ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    const ids = [...selected];
    await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setOrders(prev => prev.filter(o => !selected.has(o.id)));
    setStats(prev => prev ? { ...prev, total: prev.total - ids.length } : null);
    setSelected(new Set());
    setConfirmDel(false);
  };

  // ── Change status ─────────────────────────────────────────────────────
  const handleStatusChange = async (orderId: string, statusId: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: updated.status } : o));
    }
    setStatusTarget(null);
  };

  // ── Reassign agent ────────────────────────────────────────────────────
  const handleReassign = async (orderId: string, agentId: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, agent: updated.agent } : o));
    }
    setReassignId(null);
  };

  // ── Reminders: commandes non-finales avec alerte dépassée ─────────────
  const reminders = orders.filter(o => {
    if (o.status?.isFinal) return false;             // commande terminée → pas de rappel
    const hours = o.status?.alertAfterHours;
    if (!hours) return false;                         // pas d'alerte définie sur ce statut
    const elapsed = (Date.now() - new Date(o.createdAt).getTime()) / 3_600_000;
    return elapsed > hours;
  });

  // ── Visible columns ───────────────────────────────────────────────────
  const visible = COLS.filter(c => visibleCols.has(c.key));

  // ── Cell render ───────────────────────────────────────────────────────
  const cell = (k: string, o: Order, i: number) => {
    switch (k) {
      case "num":      return <span style={{ color: "#9ca3af", fontWeight: 600 }}>#{i + 1}</span>;
      case "date":     return <span style={{ color: "#6b7280" }}>{fmtDate(o.createdAt)}</span>;
      case "customer": return <strong style={{ fontWeight: 700 }}>{o.customer}</strong>;
      case "phone":    return <span style={{ color: "#6b7280", fontFamily: "monospace" }}>{o.phone}</span>;
      case "city":     return o.city;
      case "product":  return o.product?.name ?? "—";
      case "price":    return `${o.price.toLocaleString()} MRU`;
      case "qty":      return <span style={{ fontWeight: 600 }}>{o.quantity}</span>;
      case "revenue":  return <strong style={{ color: "#16a34a" }}>{o.revenue.toLocaleString()} MRU</strong>;
      case "agent":
        if (isAgent) {
          return <span style={{ fontSize: 11, color: "#6b7280" }}>{o.agent?.name ?? "—"}</span>;
        }
        return (
          <button
            onClick={() => setReassignId(o.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              background: "none", border: "1px solid #e5e7eb", borderRadius: "8px",
              padding: "3px 9px", fontSize: "10px", cursor: "pointer",
              color: o.agent ? "#111827" : "#9ca3af", fontWeight: 600,
            }}
          >
            {o.agent?.name ?? "Unassigned"} <ChevronDown size={10} />
          </button>
        );
      case "status": {
        const raw = o.status.color || "#6b7280";
        const isHex = raw.startsWith("#");
        const bg   = isHex ? raw + "22" : "#f3f4f6";
        const fg   = isHex ? raw        : "#374151";
        return (
          <button
            onClick={() => setStatusTarget(o.id)}
            title="Click to change status"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: bg, color: fg,
              padding: "3px 9px", borderRadius: "999px",
              fontSize: "10px", fontWeight: 700, whiteSpace: "nowrap",
              border: "none", cursor: "pointer",
            }}
          >
            {o.status.name} <ChevronDown size={9} />
          </button>
        );
      }
      default: return "—";
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "3px" }}>Orders</h1>
          <p style={{ color: "#6b7280", fontSize: "11px" }}>
            {stats ? `${stats.total.toLocaleString()} commandes` : "Toutes les commandes"}
            {filterDate && ` — ${new Date(filterDate).toLocaleDateString("fr", { day: "2-digit", month: "long", year: "numeric" })}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setShowRemind(v => !v)}
            style={{
              position: "relative", display: "flex", alignItems: "center", gap: "6px",
              border: "1px solid #e5e7eb", background: showRemind ? "#fffbeb" : "white",
              padding: "8px 12px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Bell size={13} /> Reminders
            {reminders.length > 0 && (
              <span style={{
                position: "absolute", top: -6, right: -6,
                background: "#ef4444", color: "white",
                fontSize: "9px", fontWeight: 700, borderRadius: "999px",
                padding: "1px 5px", minWidth: "16px", textAlign: "center",
              }}>
                {reminders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowStats(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              border: "1px solid #e5e7eb",
              background: showStats ? "#0d3938" : "white",
              color:      showStats ? "white"    : "#111827",
              padding: "8px 12px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
            }}
          >
            <BarChart2 size={13} /> Stats
          </button>
        </div>
      </div>

      {/* ── QUICK STATS ── */}
      {showStats && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px", marginBottom: "14px" }}>
          {[
            { label: "Total Orders", value: stats.total,                          icon: <ShoppingCart size={14}/>, bg: "#beecdf" },
            { label: "Confirmed",    value: stats.confirmed,                       icon: <CheckCircle2 size={14}/>, bg: "#dcfce7" },
            { label: "Pending",      value: stats.pending,                         icon: <Clock3       size={14}/>, bg: "#fef3c7" },
            { label: "Revenue",      value: `${stats.revenue.toLocaleString()} MRU`, icon: <DollarSign  size={14}/>, bg: "#dbeafe" },
          ].map(s => (
            <div key={s.label} className="glass-card">
              <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "10px", color: "#6b7280", marginBottom: "3px" }}>{s.label}</p>
                  <h2 style={{ fontSize: "17px", fontWeight: 800 }}>{s.value}</h2>
                </div>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: s.bg, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {s.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REMINDERS PANEL ── */}
      {showRemind && (
        <div className="glass-card" style={{ marginBottom: "12px", borderLeft: "3px solid #f59e0b" }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Bell size={12} color="#f59e0b" />
                {reminders.length} orders need follow-up (pending &gt; 24h)
              </strong>
              <button onClick={() => setShowRemind(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={14} />
              </button>
            </div>
            {reminders.length === 0 ? (
              <p style={{ fontSize: "11px", color: "#9ca3af" }}>All good — no overdue pending orders.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {reminders.slice(0, 6).map(o => (
                  <div key={o.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 12px", background: "#fffbeb", borderRadius: "9px", fontSize: "11px",
                  }}>
                    <strong>{o.customer}</strong>
                    <span style={{ color: "#6b7280" }}>{o.phone}</span>
                    <span style={{ color: "#92400e", fontWeight: 600 }}>{o.product.name}</span>
                    <span style={{ color: "#9ca3af" }}>{fmtDate(o.createdAt)}</span>
                  </div>
                ))}
                {reminders.length > 6 && (
                  <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: 2 }}>+{reminders.length - 6} more…</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DATE FILTER BAR ── */}
      <div className="glass-card" style={{ marginBottom: "8px" }}>
        <div style={{ padding: "10px 14px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <Calendar size={14} color="#6b7280" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>Date :</span>

          {/* Quick buttons */}
          {[
            { label: "Aujourd'hui", days: 0 },
            { label: "Hier",        days: -1 },
            { label: "7 jours",     days: -6 },
          ].map(({ label, days }) => {
            const d = new Date();
            d.setDate(d.getDate() + days);
            const val = d.toISOString().slice(0, 10);
            const active = filterDate === val && days !== -6;
            return (
              <button
                key={label}
                onClick={() => handleDate(val)}
                style={{
                  height: 30, padding: "0 12px", borderRadius: 8, border: "1.5px solid",
                  borderColor: active ? "#0d3938" : "#e5e7eb",
                  background: active ? "#beecdf" : "white",
                  color: active ? "#0d3938" : "#374151",
                  fontSize: 11, fontWeight: active ? 700 : 500, cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}

          {/* Custom date input */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="date"
              value={filterDate}
              onChange={e => handleDate(e.target.value)}
              style={{
                height: 30, border: "1.5px solid #e5e7eb", borderRadius: 8,
                padding: "0 8px", fontSize: 11, outline: "none",
                background: "white", cursor: "pointer", color: "#374151",
              }}
            />
            {filterDate && (
              <button
                onClick={clearDate}
                title="Voir toutes les dates"
                style={{
                  height: 30, padding: "0 10px", borderRadius: 8,
                  border: "1.5px solid #e5e7eb", background: "white",
                  fontSize: 10, fontWeight: 600, color: "#6b7280", cursor: "pointer",
                }}
              >
                Toutes les dates
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTERS BAR ── */}
      <div className="glass-card" style={{ marginBottom: "10px" }}>
        <div style={{ padding: "10px 14px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>

          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Rechercher client, téléphone…"
              style={{
                width: "100%", paddingLeft: 30, paddingRight: 12, height: 34,
                border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 11,
                outline: "none", background: "#f9fafb",
              }}
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => handleFilter("status", e.target.value)}
            style={{ height: 34, border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 11, padding: "0 10px", outline: "none", background: "white", cursor: "pointer" }}
          >
            <option value="">Tous les statuts</option>
            {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* Product filter */}
          <select
            value={filterProduct}
            onChange={e => handleFilter("product", e.target.value)}
            style={{ height: 34, border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 11, padding: "0 10px", outline: "none", background: "white", cursor: "pointer" }}
          >
            <option value="">Tous les produits</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Column settings */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowColMenu(v => !v)}
              style={{
                height: 34, display: "flex", alignItems: "center", gap: 5,
                border: "1px solid #e5e7eb", background: "white",
                padding: "0 12px", borderRadius: 9, fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              <SlidersHorizontal size={13} /> Columns
            </button>
            {showColMenu && (
              <div style={{
                position: "absolute", top: 38, right: 0, zIndex: 200,
                background: "white", border: "1px solid #e5e7eb", borderRadius: 12,
                padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", width: 160,
              }}>
                <p style={{ fontSize: "10px", color: "#9ca3af", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>
                  Show / Hide
                </p>
                {COLS.filter(c => c.hideable).map(col => (
                  <label key={col.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => setVisibleCols(prev => {
                        const n = new Set(prev);
                        n.has(col.key) ? n.delete(col.key) : n.add(col.key);
                        return n;
                      })}
                      style={{ cursor: "pointer" }}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Bulk delete — Admin only */}
          {!isAgent && selected.size > 0 && (
            <button
              onClick={() => setConfirmDel(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                height: 34, border: "none", background: "#ef4444", color: "white",
                padding: "0 14px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              <Trash2 size={13} /> Delete ({selected.size})
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={refresh}
            title="Refresh"
            style={{
              height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid #e5e7eb", background: "white", borderRadius: 9, cursor: "pointer",
            }}
          >
            <UserCheck size={13} color="#6b7280" />
          </button>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="glass-card">
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Loading orders…</div>
          ) : orders.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>No orders found</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6", textAlign: "left" }}>
                  {!isAgent && (
                    <th style={{ padding: "11px 14px", width: 36 }}>
                      <input
                        type="checkbox"
                        checked={selected.size > 0 && selected.size === orders.length}
                        onChange={toggleAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                  )}
                  {visible.map(col => (
                    <th key={col.key} style={{ padding: "11px 14px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom: "1px solid #f9fafb",
                      background: selected.has(order.id) ? "#f0f7f4" : "transparent",
                      cursor: "default",
                    }}
                    onMouseEnter={e => {
                      if (!selected.has(order.id))
                        (e.currentTarget as HTMLElement).style.background = "#f9fafb";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background =
                        selected.has(order.id) ? "#f0f7f4" : "transparent";
                    }}
                  >
                    {!isAgent && (
                      <td style={{ padding: "9px 14px" }}>
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggleOne(order.id)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                    )}
                    {visible.map(col => (
                      <td key={col.key} style={{ padding: "9px 14px", whiteSpace: "nowrap" }}>
                        {cell(col.key, order, i)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinel} style={{ padding: "12px", textAlign: "center" }}>
            {loadingMore && <span style={{ fontSize: 11, color: "#9ca3af" }}>Loading more…</span>}
            {!hasMore && !loading && orders.length > 0 && (
              <span style={{ fontSize: 10, color: "#d1d5db" }}>
                All {orders.length} orders loaded
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── CONFIRM DELETE MODAL ── */}
      {confirmDel && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div className="glass-card" style={{ padding: 24, width: 300, textAlign: "center" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: "#fee2e2",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
            }}>
              <Trash2 size={20} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Delete Orders?</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
              You are about to permanently delete <strong>{selected.size}</strong> order{selected.size > 1 ? "s" : ""}.
              This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => setConfirmDel(false)}
                style={{ border: "1px solid #e5e7eb", background: "white", padding: "9px 20px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{ border: "none", background: "#ef4444", color: "white", padding: "9px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE STATUS MODAL ── */}
      {statusTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div className="glass-card" style={{ padding: 20, width: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong style={{ fontSize: 13 }}>Change Status</strong>
              <button onClick={() => setStatusTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {statuses.map(s => {
                const isHex = s.color?.startsWith("#");
                const bg = isHex ? s.color + "22" : "#f3f4f6";
                const fg = isHex ? s.color        : "#374151";
                return (
                  <button
                    key={s.id}
                    onClick={() => handleStatusChange(statusTarget, s.id)}
                    style={{
                      padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 9,
                      fontSize: 11, cursor: "pointer", background: "white", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: bg, border: `2px solid ${fg}`, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: fg }}>{s.name}</span>
                  </button>
                );
              })}
              {statuses.length === 0 && (
                <p style={{ fontSize: 11, color: "#9ca3af" }}>No statuses configured yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REASSIGN AGENT MODAL ── */}
      {reassignId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div className="glass-card" style={{ padding: 20, width: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <UserCheck size={14} /> Reassign Agent
              </strong>
              <button onClick={() => setReassignId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <button
                onClick={() => handleReassign(reassignId, "")}
                style={{
                  padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 9,
                  fontSize: 11, cursor: "pointer", background: "white", textAlign: "left", color: "#9ca3af",
                }}
              >
                Unassigned
              </button>
              {agents.length === 0 && (
                <p style={{ fontSize: 11, color: "#9ca3af", padding: "4px 0" }}>No agents available</p>
              )}
              {agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => handleReassign(reassignId, a.id)}
                  style={{
                    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 9,
                    fontSize: 11, cursor: "pointer", background: "white", textAlign: "left", fontWeight: 600,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0f7f4")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, Trash2, UserCheck, Bell, BarChart2,
  SlidersHorizontal, ChevronDown, X, Calendar,
  ShoppingCart, CheckCircle2, Clock3, DollarSign, PhoneCall,
  ArrowUp, ArrowDown, Pencil,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";

// ── Types ──────────────────────────────────────────────────────────────────
interface Agent   { id: string; name: string; iconColor?: string; }
interface Status  { id: string; name: string; color: string; alertAfterHours?: number | null; isFinal?: boolean; }
interface Product { id: string; name: string; }
interface Order {
  id: string; orderNumber: number | null; customer: string; phone: string; city: string;
  price: number; quantity: number; revenue: number; createdAt: string;
  notes: string | null; attempts: number; recallAt: string | null; processingTimeMin: number | null;
  absoluteDelayMin: number | null;
  status: Status; product: Product; agent: Agent | null;
}
interface Stats {
  total: number; revenue: number; confirmed: number; pending: number;
  toRecall: number; confirmationRate: number; avgProcessingTimeMin: number | null;
  totalGrowth: number | null; revenueGrowth: number | null;
  confirmedGrowth: number | null; pendingGrowth: number | null;
  confirmationRateGrowth: number | null; avgProcessingGrowth: number | null;
}

// ── Column definitions ─────────────────────────────────────────────────────
const COLS = [
  { key: "num",        label: "#",            hideable: false },
  { key: "date",       label: "Date",         hideable: true  },
  { key: "customer",   label: "Customer",     hideable: false },
  { key: "phone",      label: "Phone",        hideable: true  },
  { key: "city",       label: "City",         hideable: true  },
  { key: "product",    label: "Product",      hideable: true  },
  { key: "price",      label: "Price",        hideable: true  },
  { key: "qty",        label: "Qty",          hideable: true  },
  { key: "revenue",    label: "Revenue",      hideable: true  },
  { key: "agent",      label: "Agent",        hideable: true  },
  { key: "attempts",   label: "Tentatives",   hideable: true  },
  { key: "processing", label: "Traitement",   hideable: true  },
  { key: "recall",     label: "Rappel",       hideable: true  },
  { key: "notes",      label: "Notes",        hideable: true  },
  { key: "status",     label: "Status",       hideable: false },
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr", { day: "2-digit", month: "2-digit", year: "2-digit" })
    + " " + d.toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
}

// Temps de traitement (minutes) → "8 min" / "2h15"
function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// Délai de suivi relatif à maintenant → "Après 1j 16h" / "En retard de 3h"
function fmtRecall(recallAt: string | null | undefined): { text: string; overdue: boolean } {
  if (!recallAt) return { text: "—", overdue: false };
  const diffMin = Math.round((new Date(recallAt).getTime() - Date.now()) / 60000);
  const overdue = diffMin < 0;
  const abs   = Math.abs(diffMin);
  const days  = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  parts.push(`${hours}h`);
  const dur = parts.join(" ");
  return overdue ? { text: `En retard de ${dur}`, overdue: true } : { text: `Après ${dur}`, overdue: false };
}

// ISO string → valeur utilisable par <input type="datetime-local">
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Date longue en français → "11 juin 2026"
function fmtLongDate(date: string) {
  return new Date(date).toLocaleDateString("fr", { day: "2-digit", month: "long", year: "numeric" });
}

// Indicateur de croissance vs hier (CLAUDE.md : "+2%, -1%…")
function GrowthBadge({ value, points = false }: { value?: number | null; points?: boolean }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: "10px", fontWeight: 700,
      color: up ? "#16a34a" : "#dc2626",
    }}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {up ? "+" : ""}{value}{points ? " pts" : "%"}
    </span>
  );
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
  const [filterDateTo,  setFilterDateTo]  = useState(""); // fin de plage (optionnel)

  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set()); // cartes dépliées (mobile)
  const [cardFilter,   setCardFilter]   = useState<"all" | "recall" | null>(null); // carte de stat cliquée (filtre rapide)
  const [bulkEdit,     setBulkEdit]     = useState(false); // modale "Modifier en groupe"
  const [showStats,    setShowStats]    = useState(true);
  const [showRemind,   setShowRemind]   = useState(false);
  const [showColMenu,  setShowColMenu]  = useState(false);
  const [visibleCols,  setVisibleCols]  = useState<Set<string>>(new Set(COLS.map(c => c.key)));

  const [confirmDel,   setConfirmDel]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<Order | null>(null);

  const sentinel  = useRef<HTMLDivElement>(null);
  const searchTmr = useRef<ReturnType<typeof setTimeout> | null>(null);

  const user    = useUser();
  const isAgent = user?.role === "AGENT" || user?.role === "AGENT_TEST";

  // ── Fetch orders ──────────────────────────────────────────────────────
  // `silent` : recharge en arrière-plan sans afficher le "Chargement…"
  // (utilisé par l'auto-actualisation non intrusive).
  const load = useCallback(async (opts: {
    cursor?: string; search?: string; statusId?: string; productId?: string; date?: string; dateTo?: string; append?: boolean; silent?: boolean;
  } = {}) => {
    const { cursor, search: q = "", statusId = "", productId = "", date = "", dateTo = "", append = false, silent = false } = opts;
    const p = new URLSearchParams();
    if (cursor)    p.set("cursor",    cursor);
    if (q)         p.set("search",    q);
    if (statusId)  p.set("statusId",  statusId);
    if (productId) p.set("productId", productId);
    if (date)      { p.set("dateFrom", date); p.set("dateTo", dateTo || date); }

    if (!silent) { append ? setLoadingMore(true) : setLoading(true); }
    try {
      const res  = await fetch(`/api/orders?${p}`);
      const data = await res.json();
      setOrders(prev => append ? [...prev, ...data.orders] : data.orders);
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
      if (data.stats) setStats(data.stats);
    } finally {
      if (!silent) { append ? setLoadingMore(false) : setLoading(false); }
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
        load({ cursor: nextCursor ?? undefined, search, statusId: filterStatus, productId: filterProduct, date: filterDate, dateTo: filterDateTo, append: true });
      }
    }, { threshold: 0.1 });
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, nextCursor, search, filterStatus, filterProduct, filterDate, filterDateTo, load]);

  // ── Auto-actualisation NON intrusive (récupère les nouvelles commandes
  //    Shopify toutes les 60s) ───────────────────────────────────────────
  // Contrairement à l'ancien app, on ne ramène JAMAIS l'admin en arrière de
  // force : on ne recharge en silence que s'il est en haut de la liste et ne
  // cherche/filtre rien. S'il consulte d'anciennes commandes ou fait une
  // recherche, on ne touche à rien (il reprendra au prochain retour en haut).
  useEffect(() => {
    const id = setInterval(() => {
      const atTop    = typeof window !== "undefined" && window.scrollY < 150;
      const browsing = !!search || !!filterStatus || !!filterProduct;
      const loadingNow = loading || loadingMore;
      if (atTop && !browsing && !loadingNow) {
        load({ statusId: filterStatus, productId: filterProduct, date: filterDate, dateTo: filterDateTo, silent: true });
      }
    }, 60000);
    return () => clearInterval(id);
  }, [load, search, filterStatus, filterProduct, filterDate, filterDateTo, loading, loadingMore]);

  // ── Search (debounced 400ms) ──────────────────────────────────────────
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTmr.current) clearTimeout(searchTmr.current);
    searchTmr.current = setTimeout(() => {
      load({ search: val, statusId: filterStatus, productId: filterProduct, date: filterDate, dateTo: filterDateTo });
    }, 400);
  };

  // ── Filter change ─────────────────────────────────────────────────────
  const handleFilter = (key: "status" | "product", val: string) => {
    const s = key === "status"  ? val : filterStatus;
    const p = key === "product" ? val : filterProduct;
    key === "status" ? setFilterStatus(val) : setFilterProduct(val);
    load({ search, statusId: s, productId: p, date: filterDate, dateTo: filterDateTo });
  };

  // ── Date filter (jour unique — réinitialise la plage) ─────────────────
  const handleDate = (val: string) => {
    setFilterDate(val);
    setFilterDateTo("");
    load({ search, statusId: filterStatus, productId: filterProduct, date: val, dateTo: "" });
  };

  // ── Plage de dates (période) ───────────────────────────────────────────
  const handleDateRange = (from: string, to: string) => {
    setFilterDate(from);
    setFilterDateTo(to);
    load({ search, statusId: filterStatus, productId: filterProduct, date: from, dateTo: to });
  };

  const handleDateTo = (val: string) => {
    setFilterDateTo(val);
    load({ search, statusId: filterStatus, productId: filterProduct, date: filterDate, dateTo: val });
  };

  const clearDate = () => {
    setFilterDate("");
    setFilterDateTo("");
    load({ search, statusId: filterStatus, productId: filterProduct, date: "", dateTo: "" });
  };

  // ── Refresh ───────────────────────────────────────────────────────────
  const refresh = () => {
    setSelected(new Set());
    load({ search, statusId: filterStatus, productId: filterProduct, date: filterDate, dateTo: filterDateTo });
  };

  // ── Selection ─────────────────────────────────────────────────────────
  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(prev => prev.size === orders.length ? new Set() : new Set(orders.map(o => o.id)));

  // ── Carte mobile dépliée / repliée ────────────────────────────────────
  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
      // Le changement de statut peut recalculer le temps de traitement / le rappel
      setOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        status:            updated.status            ?? o.status,
        processingTimeMin: updated.processingTimeMin ?? o.processingTimeMin,
        absoluteDelayMin:  updated.absoluteDelayMin  ?? o.absoluteDelayMin,
        recallAt:          updated.recallAt          ?? o.recallAt,
      } : o));
    }
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
  };

  // ── Sauvegarde notes / tentatives / rappel (modale d'édition) ─────────
  const handleEditSave = async (id: string, patch: { notes?: string | null; attempts?: number; recallAt?: string | null }) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === id ? {
        ...o,
        notes: updated.notes,
        attempts: updated.attempts,
        recallAt: updated.recallAt,
      } : o));
    }
    setEditTarget(null);
  };

  // ── Incrémenter rapidement le nombre de tentatives d'appel ────────────
  const incrementAttempts = async (o: Order) => {
    const next = (o.attempts ?? 0) + 1;
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, attempts: next } : x));
    const res = await fetch(`/api/orders/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempts: next }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, attempts: updated.attempts } : x));
    }
  };

  // ── Reminders: rappel programmé dépassé OU alerte de statut dépassée ──
  const reminders = orders.filter(o => {
    // 1. Rappel programmé (recallAt) déjà dépassé → "À rappeler"
    if (o.recallAt && new Date(o.recallAt).getTime() < Date.now()) return true;
    // 2. Alerte de suivi du statut (alertAfterHours) dépassée
    if (o.status?.isFinal) return false;             // commande terminée → pas de rappel
    const hours = o.status?.alertAfterHours;
    if (!hours) return false;                         // pas d'alerte définie sur ce statut
    const elapsed = (Date.now() - new Date(o.createdAt).getTime()) / 3_600_000;
    return elapsed > hours;
  });

  // Compteur global "à rappeler" (toutes pages confondues, via l'API)
  const recallCount = stats?.toRecall ?? reminders.length;

  // ── Filtre rapide par carte de stat (cliquer "À rappeler" → liste filtrée) ──
  // + tri : les commandes à rappeler (recall dépassé) remontent en haut (comme l'ancien app)
  const displayedOrders = (cardFilter === "recall" ? reminders : orders)
    .slice()
    .sort((a, b) => {
      const now = Date.now();
      const aDue = a.recallAt && new Date(a.recallAt).getTime() < now ? 0 : 1;
      const bDue = b.recallAt && new Date(b.recallAt).getTime() < now ? 0 : 1;
      return aDue - bDue;
    });

  // ── Modification groupée : applique statut et/ou agent aux commandes cochées ──
  const handleBulkEdit = async (patch: { statusId?: string; agentId?: string }) => {
    const ids = [...selected];
    await Promise.all(ids.map(id =>
      fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
    ));
    // Recharge la liste pour refléter les changements
    setSelected(new Set());
    setBulkEdit(false);
    load({ search, statusId: filterStatus, productId: filterProduct, date: filterDate, dateTo: filterDateTo });
  };

  // ── Visible columns ───────────────────────────────────────────────────
  const visible = COLS.filter(c => visibleCols.has(c.key));

  // ── Cell render ───────────────────────────────────────────────────────
  const cell = (k: string, o: Order, i: number) => {
    switch (k) {
      case "num":      return <span style={{ color: "#9ca3af", fontWeight: 600 }}>#{o.orderNumber ?? i + 1}</span>;
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
          return <span style={{ fontSize: 10, color: "#6b7280" }}>{o.agent?.name ?? "—"}</span>;
        }
        // Menu déroulant inline (comme l'ancien app) : réassigne l'agent directement.
        return (
          <select
            value={o.agent?.id ?? ""}
            onChange={e => handleReassign(o.id, e.target.value)}
            onClick={e => e.stopPropagation()}
            title="Réassigner l'agent"
            style={{
              border: "1px solid #e5e7eb", borderRadius: 8, background: "white",
              padding: "3px 6px", fontSize: 10, fontWeight: 600, cursor: "pointer",
              maxWidth: 118, outline: "none", color: o.agent ? "#111827" : "#9ca3af",
            }}
          >
            <option value="">— Non assigné —</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        );
      case "attempts":
        return (
          <button
            onClick={() => incrementAttempts(o)}
            title="Cliquer pour ajouter une tentative d'appel"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "none", border: "1px solid #e5e7eb", borderRadius: "8px",
              padding: "3px 9px", fontSize: "10px", cursor: "pointer",
              color: "#374151", fontWeight: 700,
            }}
          >
            <PhoneCall size={10} /> {o.attempts ?? 0}
          </button>
        );
      case "processing": {
        const { processingTimeMin, absoluteDelayMin } = o;
        if (processingTimeMin == null && absoluteDelayMin == null) {
          return <span style={{ color: "#d1d5db", fontStyle: "italic", fontSize: 11 }}>—</span>;
        }
        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#1F30AD", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>
              {fmtMinutes(processingTimeMin)}
            </span>
            {absoluteDelayMin != null && absoluteDelayMin !== processingTimeMin && (
              <span style={{ color: "#9ca3af", fontSize: 10, whiteSpace: "nowrap" }}>
                Total : {fmtMinutes(absoluteDelayMin)}
              </span>
            )}
          </div>
        );
      }
      case "recall": {
        const r = fmtRecall(o.recallAt);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
            {r.overdue && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                background: "#fee2e2", color: "#dc2626",
                padding: "1px 6px", borderRadius: "999px",
                fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em",
              }}>
                <Bell size={9} /> À rappeler
              </span>
            )}
            <span style={{ color: r.overdue ? "#dc2626" : "#6b7280", fontSize: "11px", fontWeight: r.overdue ? 700 : 400 }}>
              {r.text}
            </span>
          </div>
        );
      }
      case "notes":
        return (
          <button
            onClick={() => setEditTarget(o)}
            title="Cliquer pour modifier les notes"
            style={{
              display: "block", maxWidth: "160px", textAlign: "left",
              background: "none", border: "none", cursor: "pointer",
              color: o.notes ? "#374151" : "#9ca3af", fontSize: "11px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {o.notes || "Ajouter une note…"}
          </button>
        );
      case "status": {
        const raw = o.status?.color || "#6b7280";
        const isHex = raw.startsWith("#");
        const bg   = isHex ? raw + "22" : "#f3f4f6";
        const fg   = isHex ? raw        : "#374151";
        // Menu déroulant inline (comme l'ancien app) : change le statut directement.
        return (
          <select
            value={o.status?.id ?? ""}
            onChange={e => handleStatusChange(o.id, e.target.value)}
            onClick={e => e.stopPropagation()}
            title="Changer le statut"
            style={{
              background: bg, color: fg, border: "none", borderRadius: 999,
              padding: "3px 7px", fontSize: 10, fontWeight: 700, cursor: "pointer",
              maxWidth: 128, outline: "none",
            }}
          >
            {!o.status && <option value="">—</option>}
            {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        );
      }
      default: return "—";
    }
  };

  // ── Raccourcis de date (Aujourd'hui / Hier / 7 jours) ─────────────────
  const todayStr     = new Date().toISOString().slice(0, 10);
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const sevenAgoStr  = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "3px" }}>Orders</h1>
          <p style={{ color: "#6b7280", fontSize: "11px" }}>
            {stats ? `${stats.total.toLocaleString()} commandes` : "Toutes les commandes"}
            {filterDate && (
              filterDateTo && filterDateTo !== filterDate
                ? ` — ${fmtLongDate(filterDate)} → ${fmtLongDate(filterDateTo)}`
                : ` — ${fmtLongDate(filterDate)}`
            )}
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
            <Bell size={13} /> Rappels
            {recallCount > 0 && (
              <span style={{
                position: "absolute", top: -6, right: -6,
                background: "#ef4444", color: "white",
                fontSize: "9px", fontWeight: 700, borderRadius: "999px",
                padding: "1px 5px", minWidth: "16px", textAlign: "center",
              }}>
                {recallCount}
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

      {/* ── QUICK STATS (cartes blanches épurées ; "À rappeler" et "Total" cliquables pour filtrer) ── */}
      {showStats && stats && (
        <div className="kpi-band" style={{ marginBottom: 12 }}>
          {([
            { key: "recall" as const, label: "À rappeler",                value: stats.toRecall,                          growth: null as number | null,         points: false, icon: <Bell size={15}/>,        clickable: true,  alert: true  },
            { key: "all"    as const, label: "Total commandes",           value: stats.total,                             growth: stats.totalGrowth,             points: false, icon: <ShoppingCart size={15}/>, clickable: true,  alert: false },
            { key: null,              label: "Revenu total",              value: `${stats.revenue.toLocaleString()} MRU`, growth: stats.revenueGrowth,           points: false, icon: <DollarSign size={15}/>,  clickable: false, alert: false },
            { key: null,              label: "Taux de confirmation",      value: `${stats.confirmationRate}%`,            growth: stats.confirmationRateGrowth,  points: true,  icon: <CheckCircle2 size={15}/>, clickable: false, alert: false },
            { key: null,              label: "Temps moyen de traitement", value: fmtMinutes(stats.avgProcessingTimeMin),  growth: stats.avgProcessingGrowth,     points: false, icon: <Clock3 size={15}/>,      clickable: false, alert: false },
          ]).map((c, idx) => {
            const active = c.clickable && cardFilter === c.key;
            return (
              <button
                key={idx}
                onClick={() => c.clickable && setCardFilter(f => f === c.key ? null : c.key)}
                disabled={!c.clickable}
                style={{
                  textAlign: "left", cursor: c.clickable ? "pointer" : "default",
                  background: "white", borderRadius: 12,
                  border: active ? "1px solid #0d3938" : "1px solid #edf0f5",
                  boxShadow: active ? "0 0 0 1px #0d3938" : "none",
                  padding: "11px 13px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <p style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>{c.label}</p>
                  <span style={{ color: c.alert ? "#ef4444" : "#cbd5e1", display: "flex", flexShrink: 0 }}>{c.icon}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 19, fontWeight: 800, color: c.alert ? "#b91c1c" : "#111827", lineHeight: 1 }}>{c.value}</h2>
                  <GrowthBadge value={c.growth} points={c.points} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── REMINDERS PANEL ── */}
      {showRemind && (
        <div className="glass-card" style={{ marginBottom: "12px", borderLeft: "3px solid #f59e0b" }}>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Bell size={12} color="#f59e0b" />
                {recallCount} commande{recallCount > 1 ? "s" : ""} à rappeler
              </strong>
              <button onClick={() => setShowRemind(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={14} />
              </button>
            </div>
            {reminders.length === 0 ? (
              <p style={{ fontSize: "11px", color: "#9ca3af" }}>Aucune commande à rappeler pour le moment.</p>
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
                  <p style={{ fontSize: "10px", color: "#9ca3af", marginTop: 2 }}>+{reminders.length - 6} de plus…</p>
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
            { label: "Aujourd'hui", active: filterDate === todayStr && !filterDateTo,                 onClick: () => handleDate(todayStr) },
            { label: "Hier",        active: filterDate === yesterdayStr && !filterDateTo,             onClick: () => handleDate(yesterdayStr) },
            { label: "7 jours",     active: filterDate === sevenAgoStr && filterDateTo === todayStr,  onClick: () => handleDateRange(sevenAgoStr, todayStr) },
          ].map(({ label, active, onClick }) => (
            <button
              key={label}
              onClick={onClick}
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
          ))}

          {/* Plage de dates personnalisée (du / au) */}
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
            <span style={{ fontSize: 11, color: "#9ca3af" }}>→</span>
            <input
              type="date"
              value={filterDateTo}
              min={filterDate || undefined}
              onChange={e => handleDateTo(e.target.value)}
              disabled={!filterDate}
              title="Fin de la période (optionnel)"
              style={{
                height: 30, border: "1.5px solid #e5e7eb", borderRadius: 8,
                padding: "0 8px", fontSize: 11, outline: "none",
                background: filterDate ? "white" : "#f3f4f6",
                cursor: filterDate ? "pointer" : "not-allowed", color: "#374151",
              }}
            />
            {(filterDate || filterDateTo) && (
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

          {/* Bulk edit — modifier statut/agent de plusieurs commandes */}
          {!isAgent && selected.size > 0 && (
            <button
              onClick={() => setBulkEdit(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                height: 34, border: "1px solid #0d3938", background: "#beecdf", color: "#0d3938",
                padding: "0 14px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              <Pencil size={13} /> Modifier ({selected.size})
            </button>
          )}

          {/* Bulk delete */}
          {!isAgent && selected.size > 0 && (
            <button
              onClick={() => setConfirmDel(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                height: 34, border: "none", background: "#ef4444", color: "white",
                padding: "0 14px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              <Trash2 size={13} /> Supprimer ({selected.size})
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

      {/* ── LISTE DES COMMANDES ── */}
      {loading ? (
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Chargement des commandes…</div>
      ) : orders.length === 0 ? (
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Aucune commande</div>
      ) : (
        <>
          {/* ── GRAND ÉCRAN : tableau classique ── */}
          <div className="responsive-table-desktop glass-card">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f3f4f6", textAlign: "left" }}>
                    {!isAgent && (
                      <th style={{ padding: "8px 12px", width: 34 }}>
                        <input
                          type="checkbox"
                          checked={selected.size > 0 && selected.size === orders.length}
                          onChange={toggleAll}
                          style={{ cursor: "pointer" }}
                        />
                      </th>
                    )}
                    {visible.map(col => (
                      <th key={col.key} style={{ padding: "8px 12px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedOrders.map((order, i) => {
                    const overdue = !!(order.recallAt && new Date(order.recallAt).getTime() < Date.now());
                    return (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: "1px solid #f9fafb",
                        borderLeft: overdue ? "3px solid #ef4444" : "3px solid transparent",
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
                        <td style={{ padding: "7px 12px" }}>
                          <input
                            type="checkbox"
                            checked={selected.has(order.id)}
                            onChange={() => toggleOne(order.id)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                      )}
                      {visible.map(col => (
                        <td key={col.key} style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>
                          {cell(col.key, order, i)}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── TÉLÉPHONE : cartes pliables (même organisation des champs) ── */}
          <div className="responsive-cards-mobile">
            {displayedOrders.map((order, i) => {
              const isOpen   = expanded.has(order.id);
              const rec      = fmtRecall(order.recallAt);
              const isSel    = selected.has(order.id);
              // Champs secondaires = colonnes visibles hors entête de carte (#, produit, statut)
              const secondaryCols = visible.filter(c => !["num", "product", "status"].includes(c.key));
              return (
                <div
                  key={order.id}
                  className="glass-card"
                  style={{
                    overflow: "hidden",
                    border: rec.overdue ? "1.5px solid #ef4444" : undefined,
                    background: isSel ? "#f0f7f4" : undefined,
                  }}
                >
                  {/* En-tête (toujours visible) */}
                  <div
                    onClick={() => toggleExpand(order.id)}
                    style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  >
                    {!isAgent && (
                      <input
                        type="checkbox"
                        checked={isSel}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleOne(order.id)}
                        style={{ cursor: "pointer", flexShrink: 0, width: 16, height: 16 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        #{order.orderNumber ?? i + 1} · {order.customer}
                      </div>
                      {visibleCols.has("product") && (
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {order.product?.name ?? "—"}
                        </div>
                      )}
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}
                      onClick={e => e.stopPropagation()}
                    >
                      {rec.overdue && (
                        <span style={{ background: "#ef4444", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse 1.5s ease-in-out infinite" }}>
                          <Bell size={11} color="white" />
                        </span>
                      )}
                      {cell("status", order, i)}
                      <button
                        onClick={() => toggleExpand(order.id)}
                        aria-label={isOpen ? "Réduire" : "Détails"}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          border: "1px solid #e5e7eb",
                          background: isOpen ? "#0d3938" : "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                          transform: isOpen ? "rotate(180deg)" : "none",
                          transition: "transform .2s ease",
                        }}
                      >
                        <ChevronDown size={14} color={isOpen ? "white" : "#9ca3af"} />
                      </button>
                    </div>
                  </div>

                  {/* Détails (dépliés) */}
                  {isOpen && (
                    <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                        {secondaryCols.map(col => (
                          <div
                            key={col.key}
                            style={{
                              display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
                              gridColumn: col.key === "notes" ? "1 / -1" : undefined,
                            }}
                          >
                            <span style={{ fontSize: 9, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                              {col.label}
                            </span>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                              {cell(col.key, order, i)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Sentinelle scroll infini (commune aux deux affichages) */}
      <div ref={sentinel} style={{ padding: "12px", textAlign: "center" }}>
        {loadingMore && <span style={{ fontSize: 11, color: "#9ca3af" }}>Chargement…</span>}
        {!hasMore && !loading && orders.length > 0 && (
          <span style={{ fontSize: 10, color: "#d1d5db" }}>
            {orders.length} commande{orders.length > 1 ? "s" : ""} chargée{orders.length > 1 ? "s" : ""}
          </span>
        )}
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

      {/* ── EDIT NOTES / TENTATIVES / RAPPEL MODAL ── */}
      {editTarget && (
        <EditOrderModal
          order={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
        />
      )}

      {/* ── BULK EDIT MODAL (Modifier en groupe) ── */}
      {bulkEdit && (
        <BulkEditModal
          count={selected.size}
          statuses={statuses}
          agents={agents}
          isAgent={isAgent}
          onClose={() => setBulkEdit(false)}
          onSave={handleBulkEdit}
        />
      )}
    </div>
  );
}

// ── Modale "Modifier en groupe" : statut et/ou agent pour les commandes cochées ──
function BulkEditModal({
  count, statuses, agents, isAgent, onClose, onSave,
}: {
  count: number;
  statuses: Status[];
  agents: Agent[];
  isAgent: boolean;
  onClose: () => void;
  onSave: (patch: { statusId?: string; agentId?: string }) => void;
}) {
  const [statusId, setStatusId] = useState("");
  const [agentId,  setAgentId]  = useState("");
  const [saving,   setSaving]   = useState(false);

  const apply = async () => {
    const patch: { statusId?: string; agentId?: string } = {};
    if (statusId) patch.statusId = statusId;
    if (agentId)  patch.agentId  = agentId;
    if (Object.keys(patch).length === 0) { onClose(); return; }
    setSaving(true);
    await onSave(patch);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div className="glass-card" style={{ padding: 20, width: 320 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Pencil size={14} /> Modifier {count} commande{count > 1 ? "s" : ""}
          </strong>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
            <X size={14} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>
          Laisse un champ vide pour ne pas y toucher.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
              Nouveau statut
            </label>
            <select
              value={statusId}
              onChange={e => setStatusId(e.target.value)}
              style={{ width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, padding: "0 10px", background: "white", cursor: "pointer" }}
            >
              <option value="">— Ne pas changer —</option>
              {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {!isAgent && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
                Réassigner à l&apos;agent
              </label>
              <select
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
                style={{ width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, padding: "0 10px", background: "white", cursor: "pointer" }}
              >
                <option value="">— Ne pas changer —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <button
            onClick={apply}
            disabled={saving}
            style={{
              padding: "9px 12px", borderRadius: 9, border: "none",
              background: "#0d3938", color: "white", fontSize: 12, fontWeight: 700,
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Application…" : "Appliquer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modale d'édition : Notes, Tentatives d'appel, Délai de rappel ──────────
function EditOrderModal({
  order, onClose, onSave,
}: {
  order: Order;
  onClose: () => void;
  onSave: (id: string, patch: { notes?: string | null; attempts?: number; recallAt?: string | null }) => void;
}) {
  const [notes,    setNotes]    = useState(order.notes ?? "");
  const [attempts, setAttempts] = useState(order.attempts ?? 0);
  const [recallAt, setRecallAt] = useState(order.recallAt ? toLocalInput(order.recallAt) : "");

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div className="glass-card" style={{ padding: 20, width: 320 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <PhoneCall size={14} /> Suivi de la commande
          </strong>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
              Tentatives d&apos;appel
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setAttempts(a => Math.max(0, a - 1))}
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontWeight: 700 }}
              >
                −
              </button>
              <span style={{ fontWeight: 700, fontSize: 13, minWidth: 24, textAlign: "center" }}>{attempts}</span>
              <button
                onClick={() => setAttempts(a => a + 1)}
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontWeight: 700 }}
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
              Rappel programmé (délai de suivi)
            </label>
            <input
              type="datetime-local"
              value={recallAt}
              onChange={e => setRecallAt(e.target.value)}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }}
            />
            {recallAt && (
              <button
                onClick={() => setRecallAt("")}
                style={{ marginTop: 4, background: "none", border: "none", color: "#dc2626", fontSize: 10, cursor: "pointer", padding: 0 }}
              >
                Effacer le rappel
              </button>
            )}
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
              Notes / Commentaires
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Ajouter une note sur cette commande…"
              style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <button
            onClick={() => onSave(order.id, {
              notes: notes.trim() === "" ? null : notes,
              attempts,
              recallAt: recallAt === "" ? null : new Date(recallAt).toISOString(),
            })}
            style={{
              padding: "9px 12px", borderRadius: 9, border: "none",
              background: "#16a34a", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

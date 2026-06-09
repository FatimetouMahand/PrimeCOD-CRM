"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  UserPlus, Trash2, Edit2, Search, Users, CheckCircle2, UserX,
  ShieldCheck, X, Eye, EyeOff, Key, Pause, Play, Send, LogOut,
  ShieldAlert, Calendar, Clock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  name: string;
  phone: string;
  role: "SUPERVISOR" | "AGENT" | "AGENT_TEST";
  status: "ONLINE" | "OFFLINE";
  isActive: boolean;
  iconColor: string;
  roleColor: string;
  paymentRemainingDays: number;
  paymentDefaultDays: number;
  startDate: string | null;
  lastLogin: string | null;
  telegramChatId?: string;
  canViewOrders: boolean;  canEditOrders: boolean;
  canViewUsers: boolean;   canEditUsers: boolean;
  canViewProducts: boolean; canEditProducts: boolean;
  canViewStatuses: boolean; canEditStatuses: boolean;
  canViewReporting: boolean; canViewDashboard: boolean;
  orderCount: number;
  createdAt: string;
}

const CREATABLE_ROLES = ["SUPERVISOR", "AGENT", "AGENT_TEST"] as const;

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: "Superviseur", AGENT: "Agent", AGENT_TEST: "Agent Test",
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  SUPERVISOR: { bg: "#dbeafe", color: "#1d4ed8" },
  AGENT:      { bg: "#dcfce7", color: "#16a34a" },
  AGENT_TEST: { bg: "#fef3c7", color: "#d97706" },
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_COLORS[role] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "3px 9px", borderRadius: "999px", fontSize: "10px", fontWeight: 700 }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

// ── Permissions ───────────────────────────────────────────────────────────────
const ALL_PERMISSIONS = [
  { key: "canViewDashboard",  label: "Voir Dashboard" },
  { key: "canViewOrders",     label: "Voir Commandes" },
  { key: "canEditOrders",     label: "Modifier Commandes" },
  { key: "canViewProducts",   label: "Voir Produits" },
  { key: "canEditProducts",   label: "Modifier Produits" },
  { key: "canViewStatuses",   label: "Voir Statuts" },
  { key: "canEditStatuses",   label: "Modifier Statuts" },
  { key: "canViewReporting",  label: "Voir Reporting" },
  { key: "canViewUsers",      label: "Voir Employés" },
  { key: "canEditUsers",      label: "Modifier Employés" },
] as const;
type PermKey = typeof ALL_PERMISSIONS[number]["key"];

function defaultPerms(role: string): Record<PermKey, boolean> {
  if (role === "SUPERVISOR") return {
    canViewDashboard: true, canViewOrders: true, canEditOrders: false,
    canViewProducts: true,  canEditProducts: false,
    canViewStatuses: true,  canEditStatuses: false,
    canViewReporting: true, canViewUsers: false, canEditUsers: false,
  };
  return {
    canViewDashboard: true, canViewOrders: true, canEditOrders: true,
    canViewProducts: false, canEditProducts: false,
    canViewStatuses: false, canEditStatuses: false,
    canViewReporting: false, canViewUsers: false, canEditUsers: false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<"all" | "active" | "suspended">("all");
  const [selected,  setSelected]  = useState<Set<string>>(new Set());

  const [showAdd,    setShowAdd]    = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [pwdTarget,  setPwdTarget]  = useState<Employee | null>(null);
  const [viewPwdTarget, setViewPwdTarget] = useState<Employee | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async (f = filter) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/employees?filter=${f}`);
      const data = await res.json();
      setEmployees(data.employees ?? []);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const changeFilter = (f: "all" | "active" | "suspended") => {
    setFilter(f); setSelected(new Set()); load(f);
  };

  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (list: Employee[]) =>
    setSelected(prev => prev.size === list.length ? new Set() : new Set(list.map(e => e.id)));

  const displayed = employees.filter(e =>
    (e.name ?? "").toLowerCase().includes(search.toLowerCase()) || e.phone.includes(search)
  );

  const total = employees.length, online = employees.filter(e => e.status === "ONLINE").length;
  const suspended = employees.filter(e => !e.isActive).length;
  const agents = employees.filter(e => e.role === "AGENT" || e.role === "AGENT_TEST").length;

  const handleDelete = async () => {
    await fetch("/api/employees", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    setEmployees(prev => prev.filter(e => !selected.has(e.id)));
    setSelected(new Set()); setConfirmDel(false);
  };

  const toggleSuspend = async (emp: Employee) => {
    const newStatus = emp.isActive ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const { employee } = await res.json();
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, isActive: employee.status === "ACTIVE" } : e));
    }
  };

  const forceLogout = async (emp: Employee) => {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceLogout: true }),
    });
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: "OFFLINE" } : e));
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>Employés</h1>
          <p style={{ color: "#6b7280", fontSize: 11 }}>{total} membres</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={greenBtn}>
          <UserPlus size={14} /> Ajouter un employé
        </button>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Total",     value: total,     icon: <Users        size={14}/>, bg: "#beecdf" },
          { label: "En ligne",  value: online,    icon: <CheckCircle2 size={14}/>, bg: "#dcfce7" },
          { label: "Suspendus", value: suspended, icon: <UserX        size={14}/>, bg: "#fee2e2" },
          { label: "Agents",    value: agents,    icon: <ShieldCheck  size={14}/>, bg: "#dbeafe" },
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

      {/* FILTER BAR */}
      <div className="glass-card" style={{ marginBottom: 10 }}>
        <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 9, padding: 3 }}>
            {(["all", "active", "suspended"] as const).map(f => (
              <button key={f} onClick={() => changeFilter(f)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: filter === f ? "white" : "transparent", fontWeight: filter === f ? 700 : 500, fontSize: 11, cursor: "pointer", color: "#111827", boxShadow: filter === f ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>
                {f === "all" ? "Tous" : f === "active" ? "Actifs" : "Suspendus"}
              </button>
            ))}
          </div>
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, téléphone…" style={{ width: "100%", paddingLeft: 30, paddingRight: 12, height: 34, border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 11, outline: "none", background: "#f9fafb", boxSizing: "border-box" }} />
          </div>
          {selected.size > 0 && (
            <button onClick={() => setConfirmDel(true)} style={{ display: "flex", alignItems: "center", gap: 5, height: 34, border: "none", background: "#ef4444", color: "white", padding: "0 14px", borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <Trash2 size={13} /> Supprimer ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="glass-card">
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Chargement…</div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Aucun employé trouvé</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6", textAlign: "left" }}>
                  <th style={th}><input type="checkbox" checked={selected.size === displayed.length && displayed.length > 0} onChange={() => toggleAll(displayed)} style={{ cursor: "pointer" }} /></th>
                  {["Employé", "Téléphone", "Rôle", "Connexion", "Compte", "Début", "Dernière conn.", "Commandes", "Paiement", "Telegram", "Actions"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: "1px solid #f9fafb", background: selected.has(emp.id) ? "#f0f7f4" : "transparent", opacity: emp.isActive ? 1 : 0.65 }}
                    onMouseEnter={e => { if (!selected.has(emp.id)) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected.has(emp.id) ? "#f0f7f4" : "transparent"; }}>

                    <td style={td}><input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleOne(emp.id)} style={{ cursor: "pointer" }} /></td>

                    {/* Name */}
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ position: "relative" }}>
                          <Avatar name={emp.name} color={emp.iconColor} />
                          <span style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: "50%", background: emp.status === "ONLINE" ? "#22c55e" : "#d1d5db", border: "2px solid white" }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{emp.name}</div>
                          {!emp.isActive && <div style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>SUSPENDU</div>}
                        </div>
                      </div>
                    </td>

                    <td style={{ ...td, fontFamily: "monospace", color: "#6b7280" }}>{emp.phone}</td>
                    <td style={td}><RoleBadge role={emp.role} /></td>

                    {/* Online */}
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: "999px", fontSize: 10, fontWeight: 700, background: emp.status === "ONLINE" ? "#dcfce7" : "#f3f4f6", color: emp.status === "ONLINE" ? "#16a34a" : "#6b7280" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: emp.status === "ONLINE" ? "#22c55e" : "#9ca3af", display: "inline-block" }} />
                        {emp.status === "ONLINE" ? "En ligne" : "Hors ligne"}
                      </span>
                    </td>

                    {/* Account */}
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: "999px", fontSize: 10, fontWeight: 700, background: emp.isActive ? "#beecdf" : "#fee2e2", color: emp.isActive ? "#0d3938" : "#dc2626" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        {emp.isActive ? "Actif" : "Suspendu"}
                      </span>
                    </td>

                    {/* Start date */}
                    <td style={{ ...td, color: "#6b7280" }}>
                      {emp.startDate
                        ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10} />{fmtDate(emp.startDate)}</span>
                        : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>

                    {/* Last login */}
                    <td style={{ ...td, color: "#6b7280" }}>
                      {emp.lastLogin
                        ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} />{fmtDateTime(emp.lastLogin)}</span>
                        : <span style={{ color: "#d1d5db" }}>Jamais</span>}
                    </td>

                    <td style={{ ...td, fontWeight: 700 }}>{emp.orderCount}</td>

                    {/* Payment */}
                    <td style={td}>
                      {emp.paymentDefaultDays > 0
                        ? <span style={{ fontSize: 10, color: emp.paymentRemainingDays <= 3 ? "#ef4444" : "#16a34a", fontWeight: 700 }}>{emp.paymentRemainingDays}j / {emp.paymentDefaultDays}j</span>
                        : <span style={{ color: "#d1d5db", fontSize: 10 }}>—</span>}
                    </td>

                    {/* Telegram */}
                    <td style={td}>
                      {emp.telegramChatId
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#e0f2fe", color: "#0369a1", padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}><Send size={9} />Lié</span>
                        : <span style={{ color: "#d1d5db", fontSize: 10 }}>—</span>}
                    </td>

                    {/* Actions */}
                    <td style={td}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <ActionBtn icon={<Edit2 size={12} color="#6b7280" />}   title="Modifier"              onClick={() => setEditTarget(emp)} />
                        <ActionBtn icon={<Key   size={12} color="#6b7280" />}   title="Changer mot de passe"  onClick={() => setPwdTarget(emp)} />
                        <ActionBtn icon={<Eye   size={12} color="#2563eb" />}   title="Voir mot de passe"     onClick={() => setViewPwdTarget(emp)} bg="#dbeafe" />
                        <ActionBtn
                          icon={emp.isActive ? <Pause size={11} color="#d97706" /> : <Play size={11} color="#16a34a" />}
                          title={emp.isActive ? "Suspendre" : "Réactiver"}
                          onClick={() => toggleSuspend(emp)}
                          bg={emp.isActive ? "#fef3c7" : "#dcfce7"}
                        />
                        {emp.status === "ONLINE" && (
                          <ActionBtn icon={<LogOut size={11} color="#ef4444" />} title="Déconnecter à distance" onClick={() => forceLogout(emp)} bg="#fee2e2" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODALS */}
      {showAdd          && <AddModal    onClose={() => setShowAdd(false)}    onCreated={emp => { setEmployees(prev => [emp, ...prev]); setShowAdd(false); }} />}
      {editTarget       && <EditModal   emp={editTarget}                     onClose={() => setEditTarget(null)} onUpdated={u => { setEmployees(prev => prev.map(e => e.id === u.id ? u : e)); setEditTarget(null); }} />}
      {pwdTarget        && <PwdModal    emp={pwdTarget}                      onClose={() => setPwdTarget(null)} />}
      {viewPwdTarget    && <ViewPwdModal emp={viewPwdTarget}                 onClose={() => setViewPwdTarget(null)} />}
      {confirmDel && (
        <div style={overlayStyle}>
          <div className="glass-card" style={{ padding: 24, width: 300, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Trash2 size={20} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Supprimer les employés ?</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Supprimer <strong>{selected.size}</strong> employé{selected.size > 1 ? "s" : ""} définitivement ?</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setConfirmDel(false)} style={cancelBtnStyle}>Annuler</button>
              <button onClick={handleDelete} style={{ ...cancelBtnStyle, background: "#ef4444", color: "white", border: "none" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══ ADD MODAL ═════════════════════════════════════════════════════════════════
function AddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (e: Employee) => void }) {
  const [form, setForm] = useState({
    name: "", phone: "", role: "AGENT", password: "",
    iconColor: "#2563eb", roleColor: "#f3f4f6",
    telegramChatId: "", startDate: "",
    paymentDefaultDays: 0, paymentRemainingDays: 0,
  });
  const [perms, setPerms] = useState<Record<PermKey, boolean>>(() => defaultPerms("AGENT"));
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));
  const changeRole = (role: string) => { set("role", role); setPerms(defaultPerms(role)); };
  const togglePerm = (key: PermKey) => setPerms(prev => ({ ...prev, [key]: !prev[key] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone || !form.password) { setError("Téléphone et mot de passe requis"); return; }
    if (form.password.length < 6) { setError("Mot de passe : 6 caractères minimum"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/employees", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ...perms }),
    });
    const data = await res.json(); setSaving(false);
    if (!res.ok) { setError(data.error || "Erreur"); return; }
    onCreated(data.employee);
  };

  return (
    <ModalWrapper title="Ajouter un employé" onClose={onClose} wide>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Nom complet" placeholder="Ahmed Mohamed" value={form.name} onChange={v => set("name", v)} />
          <Field label="Téléphone (login)" placeholder="+222 XX XX XX XX" value={form.phone} onChange={v => set("phone", v)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Rôle</label>
            <select value={form.role} onChange={e => changeRole(e.target.value)} style={inputStyle}>
              {CREATABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <Field label="Telegram Chat ID" placeholder="ex: 123456789" value={form.telegramChatId} onChange={v => set("telegramChatId", v)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Date de début de travail</label>
            <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} style={inputStyle} />
          </div>
          <div style={{ position: "relative" }}>
            <label style={labelStyle}>Mot de passe</label>
            <input type={showPwd ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min. 6 caractères" style={{ ...inputStyle, paddingRight: 38 }} />
            <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: "absolute", right: 10, top: 26, background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <ColorField label="Couleur avatar" value={form.iconColor} onChange={v => set("iconColor", v)} />
          <ColorField label="Couleur rôle"   value={form.roleColor} onChange={v => set("roleColor", v)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <NumField label="Cycle de paie (jours)" value={form.paymentDefaultDays} onChange={v => set("paymentDefaultDays", v)} />
          <NumField label="Jours restants"         value={form.paymentRemainingDays} onChange={v => set("paymentRemainingDays", v)} />
        </div>

        {/* Permissions */}
        <PermsSection perms={perms} role={form.role} onToggle={togglePerm} />

        {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
        <button type="submit" disabled={saving} style={submitStyle}>{saving ? "Enregistrement…" : "Ajouter l'employé"}</button>
      </form>
    </ModalWrapper>
  );
}

// ══ EDIT MODAL ════════════════════════════════════════════════════════════════
function EditModal({ emp, onClose, onUpdated }: { emp: Employee; onClose: () => void; onUpdated: (e: Employee) => void }) {
  const [form, setForm] = useState({
    name: emp.name, role: emp.role,
    iconColor: emp.iconColor, roleColor: emp.roleColor,
    telegramChatId: emp.telegramChatId ?? "",
    startDate: emp.startDate ? emp.startDate.split("T")[0] : "",
    paymentDefaultDays: emp.paymentDefaultDays,
    paymentRemainingDays: emp.paymentRemainingDays,
  });
  const [perms, setPerms] = useState<Record<PermKey, boolean>>({
    canViewDashboard: emp.canViewDashboard, canViewOrders: emp.canViewOrders, canEditOrders: emp.canEditOrders,
    canViewProducts: emp.canViewProducts,   canEditProducts: emp.canEditProducts,
    canViewStatuses: emp.canViewStatuses,   canEditStatuses: emp.canEditStatuses,
    canViewReporting: emp.canViewReporting, canViewUsers: emp.canViewUsers, canEditUsers: emp.canEditUsers,
  });
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));
  const togglePerm = (key: PermKey) => setPerms(prev => ({ ...prev, [key]: !prev[key] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ...perms }),
    });
    const data = await res.json(); setSaving(false);
    if (!res.ok) { setError(data.error || "Erreur"); return; }
    const startDateISO = form.startDate ? new Date(form.startDate).toISOString() : null;
    onUpdated({ ...emp, ...form, ...perms, startDate: startDateISO, isActive: emp.isActive });
  };

  return (
    <ModalWrapper title={`Modifier — ${emp.name}`} onClose={onClose} wide>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Nom complet" value={form.name} onChange={v => set("name", v)} />
          <div>
            <label style={labelStyle}>Rôle</label>
            <select value={form.role} onChange={e => set("role", e.target.value)} style={inputStyle}>
              {CREATABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Telegram Chat ID" placeholder="ex: 123456789" value={form.telegramChatId} onChange={v => set("telegramChatId", v)} />
          <div>
            <label style={labelStyle}>Date de début de travail</label>
            <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <ColorField label="Couleur avatar" value={form.iconColor} onChange={v => set("iconColor", v)} />
          <ColorField label="Couleur rôle"   value={form.roleColor} onChange={v => set("roleColor", v)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <NumField label="Cycle de paie (jours)" value={form.paymentDefaultDays} onChange={v => set("paymentDefaultDays", v)} />
          <NumField label="Jours restants"         value={form.paymentRemainingDays} onChange={v => set("paymentRemainingDays", v)} />
        </div>
        <PermsSection perms={perms} role={form.role} onToggle={togglePerm} />
        {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
        <button type="submit" disabled={saving} style={submitStyle}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </form>
    </ModalWrapper>
  );
}

// ══ CHANGE PASSWORD MODAL ═════════════════════════════════════════════════════
function PwdModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [pwd, setPwd] = useState(""); const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { setError("Min. 6 caractères"); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    setSaving(false);
    if (!res.ok) { setError("Erreur lors de la mise à jour"); return; }
    setDone(true);
  };

  return (
    <ModalWrapper title={`Mot de passe — ${emp.name}`} onClose={onClose}>
      {done ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <CheckCircle2 size={36} color="#16a34a" style={{ margin: "0 auto 10px", display: "block" }} />
          <p style={{ fontSize: 13, fontWeight: 700 }}>Mot de passe mis à jour !</p>
          <button onClick={onClose} style={{ ...submitStyle, marginTop: 16 }}>Fermer</button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <label style={labelStyle}>Nouveau mot de passe</label>
            <input type={showPwd ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Min. 6 caractères" style={{ ...inputStyle, paddingRight: 38 }} />
            <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: "absolute", right: 10, top: 26, background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
          <button type="submit" disabled={saving} style={submitStyle}>{saving ? "Mise à jour…" : "Mettre à jour"}</button>
        </form>
      )}
    </ModalWrapper>
  );
}

// ══ VIEW PASSWORD MODAL ═══════════════════════════════════════════════════════
function ViewPwdModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch(`/api/employees/${emp.id}/password`)
      .then(r => r.json())
      .then(d => { setPassword(d.password ?? null); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [emp.id]);

  return (
    <ModalWrapper title={`Mot de passe — ${emp.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <Avatar name={emp.name} color={emp.iconColor} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
            <div style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>{emp.phone}</div>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Chargement…</p>
        ) : password === null ? (
          <p style={{ textAlign: "center", color: "#f59e0b", fontSize: 12, padding: "10px", background: "#fef3c7", borderRadius: 8 }}>
            Mot de passe non disponible (compte créé avant la mise à jour).
          </p>
        ) : (
          <div>
            <label style={labelStyle}>Mot de passe</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 36, padding: "0 12px", border: "1px solid #e5e7eb", borderRadius: 9, background: "#f9fafb", display: "flex", alignItems: "center", fontFamily: "monospace", fontSize: 13, letterSpacing: show ? 0 : 4 }}>
                {show ? password : "•".repeat(password.length)}
              </div>
              <button onClick={() => setShow(v => !v)} style={{ width: 36, height: 36, border: "1px solid #e5e7eb", borderRadius: 9, background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        )}
        <button onClick={onClose} style={submitStyle}>Fermer</button>
      </div>
    </ModalWrapper>
  );
}

// ══ Permissions section ════════════════════════════════════════════════════════
function PermsSection({ perms, role, onToggle }: { perms: Record<PermKey, boolean>; role: string; onToggle: (k: PermKey) => void }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <ShieldAlert size={14} color="#2563eb" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>Permissions — {ROLE_LABELS[role] ?? role}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {ALL_PERMISSIONS.map(p => (
          <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, cursor: "pointer", padding: "5px 8px", borderRadius: 7, background: perms[p.key] ? "#dbeafe" : "#f9fafb", border: `1px solid ${perms[p.key] ? "#93c5fd" : "#e5e7eb"}` }}>
            <input type="checkbox" checked={perms[p.key]} onChange={() => onToggle(p.key)} style={{ cursor: "pointer" }} />
            {p.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ══ Shared components ══════════════════════════════════════════════════════════
function ActionBtn({ icon, title, onClick, bg = "white" }: { icon: React.ReactNode; title: string; onClick: () => void; bg?: string }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 7, background: bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {icon}
    </button>
  );
}

function ModalWrapper({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={overlayStyle}>
      <div className="glass-card" style={{ padding: 24, width: wide ? 560 : 380, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 36, height: 36, padding: 2, border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer" }} />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="#2563eb" style={{ ...inputStyle, flex: 1 }} />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" min={0} value={value} onChange={e => onChange(Number(e.target.value))} style={inputStyle} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const labelStyle:   React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5 };
const inputStyle:   React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 9, padding: "0 12px", fontSize: 12, outline: "none", background: "#f9fafb", boxSizing: "border-box" };
const submitStyle:  React.CSSProperties = { border: "none", background: "#0d3938", color: "white", padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" };
const cancelBtnStyle: React.CSSProperties = { border: "1px solid #e5e7eb", background: "white", padding: "9px 20px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" };
const greenBtn:    React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, border: "none", background: "#0d3938", color: "white", padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" };
const th: React.CSSProperties = { padding: "11px 14px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 14px" };

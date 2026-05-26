"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserPlus, Trash2, Edit2, Search,
  Users, CheckCircle2, UserX, ShieldCheck,
  X, Eye, EyeOff, Key, Pause, Play,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  name: string;
  phone: string;
  role: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  suspended: boolean;
  createdAt: string;
  _count: { orders: number };
}

const ROLES = ["Admin", "Agent"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Admin:      { bg: "#beecdf", color: "#0d3938" },
    Supervisor: { bg: "#dbeafe", color: "#1d4ed8" },
    Agent:      { bg: "#dcfce7", color: "#16a34a" },
  };
  const s = map[role] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "3px 9px", borderRadius: "999px",
      fontSize: "10px", fontWeight: 700,
    }}>
      {role}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<"all" | "active" | "suspended">("all");
  const [selected,  setSelected]  = useState<Set<string>>(new Set());

  // modals
  const [showAdd,     setShowAdd]     = useState(false);
  const [editTarget,  setEditTarget]  = useState<Employee | null>(null);
  const [pwdTarget,   setPwdTarget]   = useState<Employee | null>(null);
  const [confirmDel,  setConfirmDel]  = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const load = useCallback(async (f = filter) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/employees?filter=${f}`);
      const data = await res.json();
      setEmployees(data.employees ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // ── Filter tab change ─────────────────────────────────────────────────
  const changeFilter = (f: "all" | "active" | "suspended") => {
    setFilter(f);
    setSelected(new Set());
    load(f);
  };

  // ── Selection ─────────────────────────────────────────────────────────
  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (list: Employee[]) =>
    setSelected(prev => prev.size === list.length ? new Set() : new Set(list.map(e => e.id)));

  // ── Search filter (client-side) ───────────────────────────────────────
  const displayed = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.phone.includes(search)
  );

  // ── Stats ─────────────────────────────────────────────────────────────
  const total     = employees.length;
  const ONLINE_MS = 2 * 60 * 1000;
  const isReallyOnline = (e: Employee) =>
    e.isOnline && e.lastSeenAt && Date.now() - new Date(e.lastSeenAt).getTime() < ONLINE_MS;

  const active    = employees.filter(e => !e.suspended).length;
  const online    = employees.filter(e => isReallyOnline(e)).length;
  const suspended = employees.filter(e =>  e.suspended).length;
  const agents    = employees.filter(e => e.role === "Agent").length;

  // ── Bulk delete ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    await fetch("/api/employees", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    setEmployees(prev => prev.filter(e => !selected.has(e.id)));
    setSelected(new Set());
    setConfirmDel(false);
  };

  // ── Suspend / Unsuspend ───────────────────────────────────────────────
  const toggleSuspend = async (emp: Employee) => {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !emp.suspended }),
    });
    if (res.ok) {
      const { employee } = await res.json();
      setEmployees(prev => prev.map(e => e.id === emp.id ? employee : e));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "3px" }}>Employees</h1>
          <p style={{ color: "#6b7280", fontSize: "11px" }}>{total} team members</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            border: "none", background: "#0d3938", color: "white",
            padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          <UserPlus size={14} /> Add Employee
        </button>
      </div>

      {/* ── QUICK STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px", marginBottom: "14px" }}>
        {[
          { label: "Total",     value: total,     icon: <Users        size={14}/>, bg: "#beecdf" },
          { label: "En ligne",  value: online,   icon: <CheckCircle2 size={14}/>, bg: "#dcfce7" },
          { label: "Suspended", value: suspended, icon: <UserX        size={14}/>, bg: "#fee2e2" },
          { label: "Agents",    value: agents,    icon: <ShieldCheck  size={14}/>, bg: "#dbeafe" },
        ].map(s => (
          <div key={s.label} className="glass-card">
            <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "10px", color: "#6b7280", marginBottom: "3px" }}>{s.label}</p>
                <h2 style={{ fontSize: "18px", fontWeight: 800 }}>{s.value}</h2>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTERS + SEARCH ── */}
      <div className="glass-card" style={{ marginBottom: "10px" }}>
        <div style={{ padding: "10px 14px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 9, padding: 3 }}>
            {(["all", "active", "suspended"] as const).map(f => (
              <button
                key={f}
                onClick={() => changeFilter(f)}
                style={{
                  padding: "5px 12px", borderRadius: 7, border: "none",
                  background: filter === f ? "white" : "transparent",
                  fontWeight: filter === f ? 700 : 500,
                  fontSize: 11, cursor: "pointer", color: "#111827",
                  boxShadow: filter === f ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone…"
              style={{
                width: "100%", paddingLeft: 30, paddingRight: 12, height: 34,
                border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 11,
                outline: "none", background: "#f9fafb",
              }}
            />
          </div>

          {/* Bulk delete */}
          {selected.size > 0 && (
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
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="glass-card">
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Loading…</div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>No employees found</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6", textAlign: "left" }}>
                  <th style={{ padding: "11px 14px", width: 36 }}>
                    <input type="checkbox" checked={selected.size === displayed.length && displayed.length > 0} onChange={() => toggleAll(displayed)} style={{ cursor: "pointer" }} />
                  </th>
                  {["Nom", "Téléphone", "Rôle", "Connexion", "Compte", "Commandes", "Intégré le", "Actions"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(emp => (
                  <tr
                    key={emp.id}
                    style={{
                      borderBottom: "1px solid #f9fafb",
                      background: selected.has(emp.id) ? "#f0f7f4" : "transparent",
                      opacity: emp.suspended ? 0.65 : 1,
                    }}
                    onMouseEnter={e => { if (!selected.has(emp.id)) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected.has(emp.id) ? "#f0f7f4" : "transparent"; }}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleOne(emp.id)} style={{ cursor: "pointer" }} />
                    </td>

                    {/* Name */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%",
                            background: "linear-gradient(135deg,#3c665c,#0d3938)",
                            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800,
                          }}>
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          {/* Real online dot — vert si heartbeat actif dans 2 min */}
                          <span style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 9, height: 9, borderRadius: "50%",
                            background: isReallyOnline(emp) ? "#22c55e" : "#d1d5db",
                            border: "2px solid white",
                          }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{emp.name}</div>
                          {emp.suspended && (
                            <div style={{ fontSize: "9px", color: "#ef4444", fontWeight: 600 }}>SUSPENDU</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Téléphone */}
                    <td style={{ padding: "10px 14px", color: "#6b7280", fontFamily: "monospace" }}>{emp.phone}</td>

                    {/* Rôle */}
                    <td style={{ padding: "10px 14px" }}><RoleBadge role={emp.role} /></td>

                    {/* Connexion — basé sur heartbeat réel */}
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: 700,
                        background: isReallyOnline(emp) ? "#dcfce7" : "#f3f4f6",
                        color:      isReallyOnline(emp) ? "#16a34a" : "#6b7280",
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: isReallyOnline(emp) ? "#22c55e" : "#9ca3af",
                          display: "inline-block",
                          animation: isReallyOnline(emp) ? "pulse 1.5s infinite" : "none",
                        }} />
                        {isReallyOnline(emp) ? "En ligne" : "Hors ligne"}
                      </span>
                    </td>

                    {/* Compte — statut du compte (actif / suspendu) */}
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 9px", borderRadius: "999px", fontSize: "10px", fontWeight: 700,
                        background: emp.suspended ? "#fee2e2" : "#beecdf",
                        color:      emp.suspended ? "#dc2626"  : "#0d3938",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        {emp.suspended ? "Suspendu" : "Actif"}
                      </span>
                    </td>

                    {/* Orders */}
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{emp._count.orders}</td>

                    {/* Joined */}
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{fmtDate(emp.createdAt)}</td>

                    {/* Actions */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {/* Edit info */}
                        <button
                          onClick={() => setEditTarget(emp)}
                          title="Edit"
                          style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 7, background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Edit2 size={12} color="#6b7280" />
                        </button>
                        {/* Change password */}
                        <button
                          onClick={() => setPwdTarget(emp)}
                          title="Change password"
                          style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 7, background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Key size={12} color="#6b7280" />
                        </button>
                        {/* Suspend / Unsuspend */}
                        <button
                          onClick={() => toggleSuspend(emp)}
                          title={emp.suspended ? "Unsuspend" : "Suspend"}
                          style={{
                            width: 28, height: 28, borderRadius: 7, cursor: "pointer",
                            border: "1px solid #e5e7eb",
                            background: emp.suspended ? "#dcfce7" : "#fef3c7",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {emp.suspended ? <Play size={11} color="#16a34a" /> : <Pause size={11} color="#d97706" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══ ADD EMPLOYEE MODAL ══ */}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onCreated={emp => {
        setEmployees(prev => [emp, ...prev]);
        setShowAdd(false);
      }} />}

      {/* ══ EDIT EMPLOYEE MODAL ══ */}
      {editTarget && <EditModal emp={editTarget} onClose={() => setEditTarget(null)} onUpdated={updated => {
        setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
        setEditTarget(null);
      }} />}

      {/* ══ CHANGE PASSWORD MODAL ══ */}
      {pwdTarget && <PwdModal emp={pwdTarget} onClose={() => setPwdTarget(null)} />}

      {/* ══ CONFIRM DELETE MODAL ══ */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ padding: 24, width: 300, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Trash2 size={20} color="#ef4444" />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Delete Employees?</h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
              Permanently delete <strong>{selected.size}</strong> employee{selected.size > 1 ? "s" : ""}? This cannot be undone.
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

// ══ ADD EMPLOYEE MODAL ════════════════════════════════════════════════════
function AddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (e: Employee) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", role: "Agent", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError]     = useState("");
  const [saving, setSaving]   = useState(false);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.password) { setError("All fields are required"); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Error"); return; }
    onCreated(data.employee);
  };

  return (
    <ModalWrapper title="Add Employee" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Full Name" placeholder="Ahmed Mohamed" value={form.name} onChange={v => set("name", v)} />
        <Field label="Phone (login ID)" placeholder="+222 XX XX XX XX" value={form.phone} onChange={v => set("phone", v)} />
        <div>
          <label style={labelStyle}>Role</label>
          <select value={form.role} onChange={e => set("role", e.target.value)} style={inputStyle}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ position: "relative" }}>
          <label style={labelStyle}>Password</label>
          <input
            type={showPwd ? "text" : "password"}
            value={form.password}
            onChange={e => set("password", e.target.value)}
            placeholder="Min. 6 characters"
            style={{ ...inputStyle, paddingRight: 36 }}
          />
          <button type="button" onClick={() => setShowPwd(v => !v)}
            style={{ position: "absolute", right: 10, top: 28, background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
            {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
        <button type="submit" disabled={saving} style={submitStyle}>{saving ? "Saving…" : "Add Employee"}</button>
      </form>
    </ModalWrapper>
  );
}

// ══ EDIT EMPLOYEE MODAL ═══════════════════════════════════════════════════
function EditModal({ emp, onClose, onUpdated }: { emp: Employee; onClose: () => void; onUpdated: (e: Employee) => void }) {
  const [name,  setName]  = useState(emp.name);
  const [role,  setRole]  = useState(emp.role);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Error"); return; }
    onUpdated(data.employee);
  };

  return (
    <ModalWrapper title="Edit Employee" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Full Name" value={name} onChange={setName} />
        <div>
          <label style={labelStyle}>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
        <button type="submit" disabled={saving} style={submitStyle}>{saving ? "Saving…" : "Save Changes"}</button>
      </form>
    </ModalWrapper>
  );
}

// ══ CHANGE PASSWORD MODAL ═════════════════════════════════════════════════
function PwdModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [pwd,    setPwd]    = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error,  setError]  = useState("");
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { setError("Min. 6 characters"); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    setSaving(false);
    if (!res.ok) { setError("Error updating password"); return; }
    setDone(true);
  };

  return (
    <ModalWrapper title={`Password — ${emp.name}`} onClose={onClose}>
      {done ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <CheckCircle2 size={36} color="#16a34a" style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 13, fontWeight: 700 }}>Password updated!</p>
          <button onClick={onClose} style={{ ...submitStyle, marginTop: 16 }}>Close</button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <label style={labelStyle}>New Password</label>
            <input
              type={showPwd ? "text" : "password"}
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="Min. 6 characters"
              style={{ ...inputStyle, paddingRight: 36 }}
            />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              style={{ position: "absolute", right: 10, top: 28, background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {error && <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>}
          <button type="submit" disabled={saving} style={{ ...submitStyle, background: "#0d3938" }}>
            {saving ? "Updating…" : "Update Password"}
          </button>
        </form>
      )}
    </ModalWrapper>
  );
}

// ── Shared modal wrapper ───────────────────────────────────────────────────
function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="glass-card" style={{ padding: 24, width: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Shared field ───────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 9, padding: "0 12px", fontSize: 12, outline: "none", background: "#f9fafb", boxSizing: "border-box" };
const submitStyle: React.CSSProperties = { border: "none", background: "#0d3938", color: "white", padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" };

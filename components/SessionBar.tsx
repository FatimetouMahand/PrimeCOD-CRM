"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

export function SessionBar() {
  const router = useRouter();
  const user   = useUser();

  useEffect(() => {
    const ping = () => {
      fetch("/api/heartbeat", { method: "POST" })
        .then(r => r.json())
        .then(d => {
          // Déconnexion à distance : un admin a forcé la déconnexion de ce compte.
          if (d?.forceLogout) router.replace("/login");
        })
        .catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (!user) return null;

  const roleColors: Record<string, { bg: string; color: string }> = {
    ADMIN:      { bg: "#beecdf", color: "#0d3938" },
    SUPERVISOR: { bg: "#dbeafe", color: "#1d4ed8" },
    AGENT:      { bg: "#dcfce7", color: "#16a34a" },
    AGENT_TEST: { bg: "#fef3c7", color: "#d97706" },
  };
  const rc = roleColors[user.role] ?? { bg: "#f3f4f6", color: "#374151" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg, #3c665c, #0d3938)",
          color: "white", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700,
        }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span style={{
          position: "absolute", bottom: 0, right: 0,
          width: 9, height: 9, borderRadius: "50%",
          background: "#22c55e", border: "2px solid white",
        }} />
      </div>

      {/* Name + role — hidden on mobile to save space */}
      <div className="hide-mobile">
        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{user.name}</div>
        <span style={{
          fontSize: 9, fontWeight: 700, borderRadius: 5,
          padding: "1px 6px", background: rc.bg, color: rc.color,
          display: "inline-block", marginTop: 2,
        }}>
          {user.role}
        </span>
      </div>

      <button
        onClick={logout}
        title="Déconnexion"
        aria-label="Déconnexion"
        style={{
          width: 36, height: 36, borderRadius: 8, border: "1px solid #e5e7eb",
          background: "white", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <LogOut size={14} color="#6b7280" />
      </button>
    </div>
  );
}

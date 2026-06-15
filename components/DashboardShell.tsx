"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Users, Package,
  Settings, Tag, Menu, X,
} from "lucide-react";
import { SessionBar } from "./SessionBar";
import { RebalanceWatcher } from "./RebalanceWatcher";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

// Nav items per role
const NAV_ADMIN = [
  { href: "/dashboard",  label: "Dashboard",   Icon: LayoutDashboard },
  { href: "/orders",     label: "Commandes",   Icon: ShoppingCart },
  { href: "/employees",  label: "Employés",    Icon: Users },
  { href: "/products",   label: "Produits",    Icon: Package },
  { href: "/statuses",   label: "Statuts",     Icon: Tag },
  { href: "/settings",   label: "Paramètres",  Icon: Settings },
];

const NAV_SUPERVISOR = [
  { href: "/dashboard", label: "Dashboard",  Icon: LayoutDashboard },
  { href: "/orders",    label: "Commandes",  Icon: ShoppingCart },
  { href: "/products",  label: "Produits",   Icon: Package },
  { href: "/statuses",  label: "Statuts",    Icon: Tag },
];

const NAV_AGENT = [
  { href: "/dashboard", label: "Mon Dashboard", Icon: LayoutDashboard },
  { href: "/orders",    label: "Mes Commandes",  Icon: ShoppingCart },
];

// Pages allowed per role (new enum names)
const ALLOWED: Record<string, string[]> = {
  ADMIN:      ["/dashboard", "/orders", "/employees", "/products", "/statuses", "/settings"],
  SUPERVISOR: ["/dashboard", "/orders", "/products", "/statuses"],
  AGENT:      ["/dashboard", "/orders"],
  AGENT_TEST: ["/dashboard", "/orders"],
};

// Mobile breakpoint
const MOBILE_BREAKPOINT = 1024;

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen]       = useState(true);
  const [isMobile, setMobile] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const user     = useUser();

  // Detect mobile + handle resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setMobile(mobile);
      // On mobile: sidebar starts closed. On desktop: stays open.
      if (mobile) setOpen(false);
      else        setOpen(true);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-close sidebar on mobile when navigating to a new page
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [pathname, isMobile]);

  // Redirect if user tries to access a page they're not allowed to
  useEffect(() => {
    if (!user) return;
    const allowed = ALLOWED[user.role] ?? ALLOWED.AGENT;
    const ok = allowed.some(p => pathname === p || pathname.startsWith(p + "/"));
    if (!ok) router.replace("/dashboard");
  }, [user, pathname, router]);

  const navItems =
    user?.role === "ADMIN"      ? NAV_ADMIN :
    user?.role === "SUPERVISOR" ? NAV_SUPERVISOR :
    NAV_AGENT;

  // Sidebar width logic:
  // - Mobile: always 240px when open (overlay), 0 when closed
  // - Desktop: 220px when open, 0 when closed
  const sidebarWidth = open ? (isMobile ? 240 : 220) : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbf9f8" }}>

      {/* ── Backdrop (only visible on mobile when sidebar open) ── */}
      {isMobile && open && (
        <div
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        overflow: "hidden",
        background: "white",
        borderRight: open ? "1px solid #e5e7eb" : "none",
        position: "fixed",
        top: 0, left: 0, bottom: 0,
        transition: "width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        boxShadow: isMobile && open ? "4px 0 24px rgba(0,0,0,0.08)" : "none",
      }}>
        <div style={{ padding: "22px 18px", flex: 1, overflow: "auto" }}>
          {/* Logo + close button on mobile */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 32,
          }}>
            <div style={{
              fontSize: 20, fontWeight: 900, color: "#111827",
              whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: "linear-gradient(135deg,#3c665c,#0d3938)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 14, fontWeight: 900,
              }}>S</span>
              <span>Sou9nkc</span>
            </div>
            {isMobile && (
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: "none", background: "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#6b7280",
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Role badge */}
          {user && (
            <div style={{
              fontSize: 10, fontWeight: 700, marginBottom: 20,
              color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5,
              whiteSpace: "nowrap",
            }}>
              {user.role === "ADMIN" ? "⚙ Administration" : user.role === "SUPERVISOR" ? "👁 Superviseur" : "📋 Agent"}
            </div>
          )}

          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {navItems.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 12px", borderRadius: 11,
                  textDecoration: "none", whiteSpace: "nowrap",
                  fontWeight: 600, fontSize: 13,
                  background: active ? "#e8f5f0" : "transparent",
                  color: active ? "#0d3938" : "#4b5563",
                  transition: "background 0.15s, color 0.15s",
                  minHeight: 40,
                }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{
        flex: 1,
        // On mobile: never push (sidebar is overlay). On desktop: push by sidebar width.
        marginLeft: isMobile ? 0 : sidebarWidth,
        transition: "margin-left 0.22s cubic-bezier(.4,0,.2,1)",
        minWidth: 0,
        width: "100%",
      }}>
        {/* Navbar */}
        <nav style={{
          height: 60, background: "white", borderBottom: "1px solid #e5e7eb",
          padding: "0 14px", display: "flex", alignItems: "center",
          justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50,
          gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <button
              onClick={() => setOpen(v => !v)}
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: "1.5px solid #e5e7eb", background: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#6b7280", flexShrink: 0,
              }}
              title={open ? "Masquer le menu" : "Afficher le menu"}
              aria-label="Toggle menu"
            >
              {open && !isMobile ? <X size={16} /> : <Menu size={16} />}
            </button>
            <input
              type="text"
              placeholder="Rechercher…"
              className="search-mobile-compact"
              style={{
                width: 220, height: 36, border: "1.5px solid #e5e7eb",
                background: "#f9fafb", borderRadius: 10,
                padding: "0 14px", fontSize: 13, outline: "none",
                maxWidth: "100%",
              }}
            />
          </div>
          <SessionBar />
        </nav>

        {/* Page content */}
        <div
          className="page-content-mobile"
          style={{ padding: "22px 24px" }}
        >
          {children}
        </div>
      </div>

      <RebalanceWatcher />
    </div>
  );
}

// Wrap with UserProvider so all children share the same user fetch
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <CurrencyProvider>
        <Shell>{children}</Shell>
      </CurrencyProvider>
    </UserProvider>
  );
}

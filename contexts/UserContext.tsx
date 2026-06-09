"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface CurrentUser {
  id:        string;
  name:      string;
  phone:     string;
  role:      string;
  iconColor: string;
}

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user,  setUser]  = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => {
        if (r.status === 401) {
          // Not authenticated → go to login
          router.replace("/login");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(d => {
        if (d?.user) setUser(d.user);
        setReady(true);
      })
      .catch(() => {
        router.replace("/login");
        setReady(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Don't render children until we know auth status
  if (!ready) return null;

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

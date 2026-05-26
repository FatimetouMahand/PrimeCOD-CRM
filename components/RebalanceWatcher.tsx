"use client";

import { useEffect } from "react";

// Runs silently in the background every 5 minutes.
// Calls /api/orders/rebalance which:
//   1. Marks agents offline if they haven't pinged in 2 min
//   2. Redistributes orphan orders from offline agents
//   3. Balances load so no agent is overloaded while another is idle
export function RebalanceWatcher() {
  useEffect(() => {
    const run = () =>
      fetch("/api/orders/rebalance", { method: "POST" }).catch(() => {});

    run(); // once on mount
    const id = setInterval(run, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(id);
  }, []);

  return null;
}

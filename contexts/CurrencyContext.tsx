"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Devise choisie dans Paramètres → Général (MRU par défaut).
// Affichage uniquement : on change le code affiché à côté des montants,
// sans conversion de taux (l'activité est en MRU).
const CurrencyContext = createContext<string>("MRU");

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState("MRU");

  useEffect(() => {
    fetch("/api/settings")
      .then(r => (r.ok ? r.json() : {}))
      .then((d: Record<string, string>) => {
        if (d.currency) setCurrency(d.currency);
      })
      .catch(() => {});
  }, []);

  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

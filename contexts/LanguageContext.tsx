"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translate, type Lang } from "@/i18n/translations";

interface LangCtx {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
}

const LanguageContext = createContext<LangCtx>({ lang: "fr", dir: "ltr", t: (k) => k });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("fr");

  // Lit la langue choisie dans Paramètres → Général
  useEffect(() => {
    fetch("/api/settings")
      .then(r => (r.ok ? r.json() : {}))
      .then((d: Record<string, string>) => {
        if (d.language === "ar" || d.language === "fr") setLang(d.language);
      })
      .catch(() => {});
  }, []);

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  // Applique la direction (RTL pour l'arabe) au document
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
  }, [lang, dir]);

  const t = (key: string) => translate(key, lang);

  return (
    <LanguageContext.Provider value={{ lang, dir, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

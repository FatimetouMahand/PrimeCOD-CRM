"use client";

import { createContext, useContext, useEffect } from "react";
import { translate, type Lang } from "@/i18n/translations";

interface LangCtx {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
}

const LanguageContext = createContext<LangCtx>({ lang: "fr", dir: "ltr", t: (k) => k });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // App en français uniquement pour l'instant (le choix arabe a été retiré).
  // L'infrastructure i18n reste en place : t() renvoie le français, et on
  // pourra réactiver l'arabe plus tard sans tout réécrire.
  const lang: Lang = "fr";
  const dir: "ltr" | "rtl" = "ltr";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = "fr";
      document.documentElement.dir = "ltr";
    }
  }, []);

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

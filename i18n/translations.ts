// Dictionnaire de traduction FR / AR.
// Le hook t(key) renvoie la traduction selon la langue choisie, et retombe
// sur le français si une clé n'est pas encore traduite (rien ne casse).

export type Lang = "fr" | "ar";

export const translations: Record<string, { fr: string; ar: string }> = {
  // ── Navigation / shell ──────────────────────────────────────────────
  "nav.dashboard":     { fr: "Dashboard",     ar: "لوحة القيادة" },
  "nav.myDashboard":   { fr: "Mon Dashboard", ar: "لوحتي" },
  "nav.orders":        { fr: "Commandes",     ar: "الطلبات" },
  "nav.myOrders":      { fr: "Mes Commandes", ar: "طلباتي" },
  "nav.employees":     { fr: "Employés",      ar: "الموظفون" },
  "nav.products":      { fr: "Produits",      ar: "المنتجات" },
  "nav.statuses":      { fr: "Statuts",       ar: "الحالات" },
  "nav.settings":      { fr: "Paramètres",    ar: "الإعدادات" },

  "role.admin":        { fr: "⚙ Administration", ar: "⚙ الإدارة" },
  "role.supervisor":   { fr: "👁 Superviseur",   ar: "👁 المشرف" },
  "role.agent":        { fr: "📋 Agent",         ar: "📋 موظف" },

  "common.search":     { fr: "Rechercher…",   ar: "بحث…" },
  "common.logout":     { fr: "Déconnexion",   ar: "تسجيل الخروج" },

  // ── Actions communes ────────────────────────────────────────────────
  "action.save":       { fr: "Enregistrer",   ar: "حفظ" },
  "action.cancel":     { fr: "Annuler",       ar: "إلغاء" },
  "action.add":        { fr: "Ajouter",       ar: "إضافة" },
  "action.edit":       { fr: "Modifier",      ar: "تعديل" },
  "action.delete":     { fr: "Supprimer",     ar: "حذف" },
};

export function translate(key: string, lang: Lang): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.fr;
}

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

  // ── États / communs ─────────────────────────────────────────────────
  "common.loading":    { fr: "Chargement…",   ar: "جاري التحميل…" },
  "common.noData":     { fr: "Aucune donnée", ar: "لا توجد بيانات" },
  "common.noOrder":    { fr: "Aucune commande", ar: "لا توجد طلبات" },
  "common.noProduct":  { fr: "Aucun produit", ar: "لا يوجد منتج" },
  "common.noAgent":    { fr: "Aucun agent",   ar: "لا يوجد موظف" },

  "unit.orders":       { fr: "commandes", ar: "طلب" },
  "unit.sold":         { fr: "pcs vendues", ar: "قطعة مباعة" },
  "unit.conf":         { fr: "conf.", ar: "تأكيد" },
  "unit.leads":        { fr: "leads", ar: "عميل" },

  // ── Colonnes ────────────────────────────────────────────────────────
  "col.client":        { fr: "Client",  ar: "العميل" },
  "col.product":       { fr: "Produit", ar: "المنتج" },
  "col.city":          { fr: "Ville",   ar: "المدينة" },
  "col.status":        { fr: "Statut",  ar: "الحالة" },
  "col.amount":        { fr: "Montant", ar: "المبلغ" },

  // ── Filtres de date ─────────────────────────────────────────────────
  "filter.today":      { fr: "Aujourd'hui",   ar: "اليوم" },
  "filter.week":       { fr: "Cette semaine", ar: "هذا الأسبوع" },
  "filter.month":      { fr: "Ce mois",       ar: "هذا الشهر" },
  "filter.custom":     { fr: "Personnalisé",  ar: "مخصص" },

  // ── Tableau de bord ─────────────────────────────────────────────────
  "dash.title":        { fr: "Tableau de bord",   ar: "لوحة القيادة" },
  "dash.myTitle":      { fr: "Mon tableau de bord", ar: "لوحتي" },
  "dash.subtitle":     { fr: "Vue d'ensemble des performances", ar: "نظرة عامة على الأداء" },
  "dash.mySubtitle":   { fr: "Mes performances personnelles",   ar: "أدائي الشخصي" },
  "dash.exportPdf":    { fr: "Exporter PDF",   ar: "تصدير PDF" },
  "dash.exportExcel":  { fr: "Exporter Excel", ar: "تصدير Excel" },
  "dash.allProducts":  { fr: "Tous les produits", ar: "كل المنتجات" },
  "dash.productsSuffix": { fr: "produits sélectionnés", ar: "منتجات محددة" },
  "dash.recentOrders": { fr: "Commandes récentes", ar: "أحدث الطلبات" },

  "kpi.totalOrders":   { fr: "Total commandes", ar: "إجمالي الطلبات" },
  "kpi.revenue":       { fr: "Revenu", ar: "الإيرادات" },
  "kpi.confirmRate":   { fr: "Taux de confirmation", ar: "نسبة التأكيد" },
  "kpi.processed":     { fr: "Commandes traitées", ar: "الطلبات المعالجة" },
  "kpi.pending":       { fr: "En attente", ar: "قيد الانتظار" },
  "kpi.toRecall":      { fr: "À rappeler", ar: "للمعاودة" },
  "kpi.avgTime":       { fr: "Temps moyen de traitement", ar: "متوسط وقت المعالجة" },

  "chart.revenue":     { fr: "Analyse des revenus", ar: "تحليل الإيرادات" },
  "chart.salesReport": { fr: "Rapport des ventes",  ar: "تقرير المبيعات" },
  "chart.ordersStatus":{ fr: "Statut des commandes", ar: "حالة الطلبات" },
  "chart.topProducts": { fr: "Meilleurs produits", ar: "أفضل المنتجات" },
  "chart.topAgents":   { fr: "Meilleurs agents",   ar: "أفضل الموظفين" },
  "chart.confByDelay": { fr: "Taux de confirmation selon le temps de traitement", ar: "نسبة التأكيد حسب وقت المعالجة" },
  "chart.confByDelaySub": { fr: "Taux de confirmation des commandes selon le délai écoulé avant le 1er traitement (appel)", ar: "نسبة تأكيد الطلبات حسب المدة قبل أول معالجة (اتصال)" },
};

export function translate(key: string, lang: Lang): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.fr;
}

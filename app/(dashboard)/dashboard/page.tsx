"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";

import {
  ShoppingCart,
  DollarSign,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Users,
  Package,
  Bell,
  Percent,
  Timer,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

interface Order {
  id: string;
  customer: string;
  city: string;
  status: string;
  amount: number;
  product: string;
}

interface DashboardData {
  totalOrders: number;
  revenue: number;
  confirmationRate: number;
  pendingOrders: number;
  processedOrders: number;
  processedRevenue: number;
  avgProcessingTimeMin: number | null;
  toRecall: number;
  revenueGrowth: number;
  ordersGrowth: number;
  confirmationRateGrowth: number | null;
  pendingGrowth: number | null;
  processedGrowth: number | null;
  processedRevenueGrowth: number | null;
  avgProcessingGrowth: number | null;

  statusStats: {
    name: string;
    value: number;
    percentage: number;
    revenue: number;
    color?: string;
  }[];

  revenueChart: {
    day: string;
    revenue: number;
  }[];

  topProducts: {
    name: string;
    total: number;
    unitsSold: number;
    confirmationRate: number;
  }[];

  topAgents: {
    name: string;
    total: number;
    confirmed: number;
    confirmationRate: number;
    avgProcessingTimeMin: number | null;
  }[];

  confirmationByDelay: {
    label: string;
    total: number;
    confirmationRate: number;
  }[];

  recentOrders: Order[];
}

interface ProductOption {
  id: string;
  name: string;
}

interface StatCard {
  title: string;
  value: string | number;
  growth?: number | null;
  points?: boolean;
  sub?: string;
  icon: React.ReactNode;
  bg: string;
}

const COLORS = [
  "#0d3938",  // dark teal (primary)
  "#3c665c",  // forest green
  "#beecdf",  // mint pastel
  "#a3d0c3",  // soft sage
  "#f59e0b",  // amber (warning)
  "#ef4444",  // rose (danger)
];

// Indicateur de croissance "+X% / -X%" (ou "+X pts" pour les taux) vs hier
function GrowthBadge({
  value,
  points = false,
}: {
  value?: number | null;
  points?: boolean;
}) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        fontSize: "10px",
        fontWeight: 700,
        marginTop: "4px",
        color: positive ? "#16a34a" : "#dc2626",
      }}
    >
      {positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {positive ? "+" : ""}
      {value}
      {points ? " pts" : "%"}
    </span>
  );
}

// Formatte des minutes en "Xh Ymin" (ou "Y min" si < 1h)
function fmtMinutes(min: number | null) {
  if (min === null || min === undefined) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function DashboardPage() {
  const user = useUser();
  const isAgent = user?.role === "AGENT" || user?.role === "AGENT_TEST";

  const [data, setData] =
    useState<DashboardData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [selectedFilter, setSelectedFilter] =
    useState("Today");

  // Sélection multi-produits (CLAUDE.md : "sélectionner plusieurs produits simultanément")
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showProductMenu, setShowProductMenu] = useState(false);

  // Plage de dates personnalisée pour le filtre "Custom Range"
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Charge la liste des produits pour le filtre multi-sélection
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products");
        const result = await res.json();
        setProducts(
          (result.products || []).map(
            (p: { id: string; name: string }) => ({ id: p.id, name: p.name })
          )
        );
      } catch (error) {
        console.log(error);
      }
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    // En "Custom Range", on attend qu'une date de début soit choisie
    if (selectedFilter === "Custom Range" && !customFrom) return;

    async function fetchDashboard() {
      try {
        const params = new URLSearchParams({ filter: selectedFilter });

        if (selectedProductIds.length > 0) {
          params.set("productIds", selectedProductIds.join(","));
        }

        if (selectedFilter === "Custom Range" && customFrom) {
          params.set("dateFrom", customFrom);
          params.set("dateTo", customTo || customFrom);
        }

        const res = await fetch(
          `/api/dashboard?${params.toString()}`
        );

        const result =
          await res.json();

        setData(result);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
 }, [selectedFilter, selectedProductIds, customFrom, customTo]);

  if (loading) {
    return (
      <div style={{ padding: "20px", fontSize: "12px", color: "#9ca3af" }}>
        Chargement…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "20px", fontSize: "12px", color: "#9ca3af" }}>
        Aucune donnée
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "18px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "800",
              marginBottom: "3px",
            }}
          >
            {isAgent ? "Mon tableau de bord" : "Tableau de bord"}
          </h1>

          <p
            style={{
              color: "#6b7280",
              fontSize: "11px",
            }}
          >
            {isAgent ? "Mes performances personnelles" : "Vue d'ensemble des performances"}
          </p>
        </div>

        

        <div
  style={{
    display: "flex",
    gap: "10px",
  }}
>
  <button
    onClick={() =>
      window.print()
    }
    style={{
      border: "none",
      background: "#0d3938",
      color: "white",
      padding: "9px 10px",
      borderRadius: "10px",
      fontSize: "11px",
      fontWeight: "700",
      cursor: "pointer",
    }}
  >
    Exporter PDF
  </button>

  <button
    onClick={() =>
      window.open("/api/export")
    }
    style={{
      border: "none",
      background: "#22c55e",
      color: "white",
      padding: "9px 11px",
      borderRadius: "10px",
      fontSize: "11px",
      fontWeight: "700",
      cursor: "pointer",
    }}
  >
    Exporter Excel
  </button>
</div>

 </div>     
      

      {/* FILTERS */}

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "18px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {([
          ["Today", "Aujourd'hui"],
          ["This Week", "Cette semaine"],
          ["This Month", "Ce mois"],
          ["Custom Range", "Personnalisé"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSelectedFilter(value)}
            style={{
              border: "1px solid #e5e7eb",
              background: selectedFilter === value ? "#0d3938" : "white",
              color: selectedFilter === value ? "white" : "#111827",
              padding: "7px 12px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}

        {/* Plage de dates personnalisée (filtre "Custom Range") */}
        {selectedFilter === "Custom Range" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "white",
                padding: "8px 12px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: "600",
                outline: "none",
                cursor: "pointer",
                colorScheme: "light",
              }}
            />
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "white",
                padding: "8px 12px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: "600",
                outline: "none",
                cursor: "pointer",
                colorScheme: "light",
              }}
            />
          </>
        )}

        {/* Sélection multi-produits */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowProductMenu((v) => !v)}
            style={{
              border: "1px solid #e5e7eb",
              background: "white",
              padding: "8px 12px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: "600",
              outline: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {selectedProductIds.length === 0
              ? "Tous les produits"
              : selectedProductIds.length === 1
                ? products.find((p) => p.id === selectedProductIds[0])?.name ?? "1 produit"
                : `${selectedProductIds.length} produits sélectionnés`}
            <ChevronDown size={12} />
          </button>

          {showProductMenu && (
            <>
              <div
                onClick={() => setShowProductMenu(false)}
                style={{ position: "fixed", inset: 0, zIndex: 10 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 20,
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  padding: "8px",
                  minWidth: "210px",
                  maxHeight: "240px",
                  overflowY: "auto",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "11px",
                    padding: "6px 4px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedProductIds.length === 0}
                    onChange={() => setSelectedProductIds([])}
                  />
                  Tous les produits
                </label>

                <div style={{ borderTop: "1px solid #f3f4f6", margin: "4px 0" }} />

                {products.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "11px",
                      padding: "6px 4px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() =>
                        setSelectedProductIds((prev) =>
                          prev.includes(p.id)
                            ? prev.filter((id) => id !== p.id)
                            : [...prev, p.id]
                        )
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* STATS */}

      <div
        className="kpi-band"
        style={{ marginBottom: "14px" }}
      >
        {(
          [
            {
              title: "Total commandes",
              value: data.totalOrders,
              growth: data.ordersGrowth,
              icon: <ShoppingCart size={15} />,
              bg: "#beecdf",
            },
            {
              title: "Revenu",
              value: `${data.revenue.toLocaleString("fr-FR")} MRU`,
              growth: data.revenueGrowth,
              icon: <DollarSign size={15} />,
              bg: "#dcfce7",
            },
            {
              title: "Taux de confirmation",
              value: `${data.confirmationRate}%`,
              growth: data.confirmationRateGrowth,
              points: true,
              icon: <Percent size={15} />,
              bg: "#fef3c7",
            },
            {
              title: "Commandes traitées",
              value: data.processedOrders,
              growth: data.processedGrowth,
              sub: `${data.processedRevenue.toLocaleString("fr-FR")} MRU`,
              icon: <CheckCircle2 size={15} />,
              bg: "#dbeafe",
            },
            {
              title: "En attente",
              value: data.pendingOrders,
              growth: data.pendingGrowth,
              sub: `${(data.revenue - data.processedRevenue).toLocaleString("fr-FR")} MRU`,
              icon: <Clock3 size={15} />,
              bg: "#ffedd5",
            },
            {
              title: "À rappeler",
              value: data.toRecall,
              icon: <Bell size={15} />,
              bg: "#fee2e2",
            },
            {
              title: "Temps moyen de traitement",
              value: fmtMinutes(data.avgProcessingTimeMin),
              growth: data.avgProcessingGrowth,
              icon: <Timer size={15} />,
              bg: "#ede9fe",
            },
          ] as StatCard[]
        ).map((item) => (
          <div
            key={item.title}
            style={{
              background: "white",
              borderRadius: 12,
              border: "1px solid #edf0f5",
              padding: "11px 13px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <p style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
                {item.title}
              </p>
              <span style={{ color: "#cbd5e1", display: "flex", flexShrink: 0 }}>{item.icon}</span>
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{item.value}</h2>
            {item.sub && (
              <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>{item.sub}</p>
            )}
            <GrowthBadge value={item.growth} points={item.points} />
          </div>
        ))}
      </div>

      {/* CHARTS */}

      <div
        className="stack-mobile"
        style={{
          display: "grid",
          gridTemplateColumns:
            "2fr 1fr",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        {/* REVENUE */}

        <div className="glass-card">
          <div
            style={{
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                marginBottom:
                  "14px",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize:
                      "13px",
                    fontWeight:
                      "700",
                  }}
                >
                  Analyse des revenus
                </h2>

                <p
                  style={{
                    fontSize:
                      "10px",
                    color:
                      "#9ca3af",
                  }}
                >
                  Rapport des ventes
                </p>
              </div>

              <TrendingUp
                size={16}
              />
            </div>

            {data.revenueChart
              ?.length === 0 ? (
              <div
                style={{
                  height: "220px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  color:
                    "#9ca3af",
                  fontSize:
                    "11px",
                }}
              >
                Aucune donnée
              </div>
            ) : (
              <div
                style={{
                  width: "100%",
                  height:
                    "220px",
                }}
              >
                <ResponsiveContainer>
                  <AreaChart
                    data={
                      data.revenueChart
                    }
                  >
                    <XAxis
                      dataKey="day"
                      fontSize={
                        10
                      }
                    />

                    <Tooltip />

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3c665c"
                      fill="#3c665c"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* STATUS */}

        <div className="glass-card">
          <div
            style={{
              padding: "14px",
            }}
          >
            <h2
              style={{
                fontSize: "13px",
                fontWeight: "700",
                marginBottom:
                  "14px",
              }}
            >
              Statut des commandes
            </h2>

            {data.statusStats
              ?.length === 0 ? (
              <div
                style={{
                  height: "220px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  color:
                    "#9ca3af",
                  fontSize:
                    "11px",
                }}
              >
                Aucune donnée
              </div>
            ) : (
              <>
                <div
                  style={{
                    width:
                      "100%",
                    height:
                      "180px",
                  }}
                >
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={
                          data.statusStats
                        }
                        dataKey="value"
                        nameKey="name"
                        outerRadius={
                          70
                        }
                      >
                        {data.statusStats.map(
                          (
                            entry,
                            index
                          ) => (
                            <Cell
                              key={
                                index
                              }
                              fill={
                                entry.color ||
                                COLORS[
                                  index %
                                    COLORS.length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {data.statusStats.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={
                        item.name
                      }
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        marginBottom:
                          "9px",
                        fontSize:
                          "11px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "7px",
                        }}
                      >
                        <div
                          style={{
                            width:
                              "8px",
                            height:
                              "8px",
                            borderRadius:
                              "50%",
                            background:
                              item.color ||
                              COLORS[
                                index %
                                  COLORS.length
                              ],
                          }}
                        />

                        {item.name}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div>
                          <strong>{item.value}</strong>{" "}
                          commande{item.value > 1 ? "s" : ""}{" "}
                          <span style={{ color: "#9ca3af" }}>
                            ({item.percentage}%)
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "9px",
                            color: "#9ca3af",
                          }}
                        >
                          {item.revenue.toLocaleString("fr-FR")} MRU
                        </div>
                      </div>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* TOP */}

      <div
        className="stack-mobile"
        style={{
          display: "grid",
          gridTemplateColumns: isAgent ? "1fr" : "1fr 1fr",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        {/* PRODUCTS */}

        <div className="glass-card">
          <div
            style={{
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: "7px",
                marginBottom:
                  "14px",
              }}
            >
              <Package
                size={14}
              />

              <h2
                style={{
                  fontSize:
                    "13px",
                  fontWeight:
                    "700",
                }}
              >
                Meilleurs produits
              </h2>
            </div>

            {data.topProducts
              ?.length === 0 ? (
              <p
                style={{
                  color:
                    "#9ca3af",
                  fontSize:
                    "11px",
                }}
              >
                Aucun produit
              </p>
            ) : (
              <>
                <div
                  style={{
                    width: "100%",
                    height:
                      "200px",
                  }}
                >
                  <ResponsiveContainer>
                    <BarChart
                      data={
                        data.topProducts
                      }
                    >
                      <XAxis
                        dataKey="name"
                        fontSize={
                          10
                        }
                      />

                      <Tooltip />

                      <Bar
                        dataKey="total"
                        fill="#3c665c"
                        radius={[
                          6,
                          6,
                          0,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pièces vendues + taux de confirmation par produit */}
                <div style={{ marginTop: "10px" }}>
                  {data.topProducts.map((p) => (
                    <div
                      key={p.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "10px",
                        padding: "5px 0",
                        borderBottom: "1px solid #f9fafb",
                      }}
                    >
                      <span>{p.name}</span>
                      <span style={{ color: "#6b7280" }}>
                        {p.unitsSold} pcs vendues ·{" "}
                        <strong
                          style={{
                            color:
                              p.confirmationRate >= 50
                                ? "#16a34a"
                                : "#dc2626",
                          }}
                        >
                          {p.confirmationRate}% conf.
                        </strong>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* AGENTS — masqué pour l'agent (pas de comparaison entre agents) */}

        {!isAgent && (
        <div className="glass-card">
          <div
            style={{
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: "7px",
                marginBottom:
                  "14px",
              }}
            >
              <Users size={14} />

              <h2
                style={{
                  fontSize:
                    "13px",
                  fontWeight:
                    "700",
                }}
              >
                Meilleurs agents
              </h2>
            </div>

            {data.topAgents
              ?.length === 0 ? (
              <p
                style={{
                  color:
                    "#9ca3af",
                  fontSize:
                    "11px",
                }}
              >
                Aucun agent
              </p>
            ) : (
              data.topAgents?.map(
                (
                  agent,
                  index
                ) => (
                  <div
                    key={
                      agent.name
                    }
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      padding:
                        "10px 0",
                      borderBottom:
                        "1px solid #f3f4f6",
                      fontSize:
                        "11px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width:
                            "24px",
                          height:
                            "24px",
                          borderRadius:
                            "50%",
                          background:
                            "#f3f4f6",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          fontSize:
                            "10px",
                          fontWeight:
                            "700",
                        }}
                      >
                        {index + 1}
                      </div>

                      {agent.name}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div>
                        <strong>{agent.total}</strong> leads
                      </div>
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#9ca3af",
                          marginTop: "2px",
                        }}
                      >
                        {agent.confirmationRate}% conf. ·{" "}
                        {fmtMinutes(agent.avgProcessingTimeMin)}
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>
        )}
      </div>

      {/* CONFIRMATION VS DELAY */}

      <div className="glass-card" style={{ marginBottom: "18px" }}>
        <div style={{ padding: "14px" }}>
          <div style={{ marginBottom: "14px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: "700" }}>
              Taux de confirmation selon le temps de traitement
            </h2>
            <p style={{ fontSize: "10px", color: "#9ca3af" }}>
              Taux de confirmation des commandes selon le délai écoulé avant le 1er traitement (appel)
            </p>
          </div>

          {!data.confirmationByDelay ||
          data.confirmationByDelay.every((b) => b.total === 0) ? (
            <div
              style={{
                height: "180px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
                fontSize: "11px",
              }}
            >
              No data yet
            </div>
          ) : (
            <div style={{ width: "100%", height: "180px" }}>
              <ResponsiveContainer>
                <BarChart data={data.confirmationByDelay}>
                  <XAxis dataKey="label" fontSize={10} />
                  <Tooltip formatter={(value) => [`${value}%`, "Taux de confirmation"]} />
                  <Bar
                    dataKey="confirmationRate"
                    fill="#0d3938"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* COMMANDES RÉCENTES — tableau (PC) + liste (téléphone) */}

      <div className="glass-card">
        <div style={{ padding: "14px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "12px" }}>
            Commandes récentes
          </h2>

          {data.recentOrders?.length === 0 ? (
            <p style={{ fontSize: 11, color: "#9ca3af", padding: "8px 0" }}>Aucune commande</p>
          ) : (
            <>
              {/* PC : tableau */}
              <div className="responsive-table-desktop" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ paddingBottom: "10px" }}>Client</th>
                      <th style={{ paddingBottom: "10px" }}>Produit</th>
                      <th style={{ paddingBottom: "10px" }}>Ville</th>
                      <th style={{ paddingBottom: "10px" }}>Statut</th>
                      <th style={{ paddingBottom: "10px" }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr key={order.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "11px 0" }}>{order.customer}</td>
                        <td>{order.product}</td>
                        <td>{order.city}</td>
                        <td>
                          <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "700", background: "#f3f4f6", color: "#374151" }}>
                            {order.status}
                          </span>
                        </td>
                        <td>{order.amount} MRU</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Téléphone : liste compacte */}
              <div className="responsive-cards-mobile" style={{ gap: 0 }}>
                {data.recentOrders.map((order) => (
                  <div key={order.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{order.customer}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{order.product} · {order.city}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{order.amount} MRU</div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#6b7280" }}>{order.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";

import {
  ShoppingCart,
  DollarSign,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Users,
  Package,
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
  revenueGrowth: number;
  ordersGrowth: number;

  statusStats: {
    name: string;
    value: number;
  }[];

  revenueChart: {
    day: string;
    revenue: number;
  }[];

  topProducts: {
    name: string;
    total: number;
  }[];

  topAgents: {
    name: string;
    total: number;
  }[];

  recentOrders: Order[];
}

const COLORS = [
  "#0d3938",  // dark teal (primary)
  "#3c665c",  // forest green
  "#beecdf",  // mint pastel
  "#a3d0c3",  // soft sage
  "#f59e0b",  // amber (warning)
  "#ef4444",  // rose (danger)
];

export default function DashboardPage() {
  const [data, setData] =
    useState<DashboardData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [selectedFilter, setSelectedFilter] =
    useState("Today");

  const [selectedProduct, setSelectedProduct] =
    useState("All Products");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(
          `/api/dashboard?filter=${selectedFilter}&product=${selectedProduct}`
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
 }, [selectedFilter, selectedProduct]);

  if (loading) {
    return (
      <div
        style={{
          padding: "20px",
          fontSize: "12px",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          padding: "20px",
          fontSize: "12px",
        }}
      >
        No database data
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
            Dashboard
          </h1>

          <p
            style={{
              color: "#6b7280",
              fontSize: "11px",
            }}
          >
            Shopify CRM Analytics
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
    Export PDF
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
    Export Excel
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
        {[
          "Today",
          "This Week",
          "This Month",
          "Custom Range",
        ].map((item) => (
          <button
            key={item}
            onClick={() =>
              setSelectedFilter(
                item
              )
            }
            style={{
              border:
                "1px solid #e5e7eb",

              background:
                selectedFilter ===
                item
                  ? "#0d3938" : "white",

              color:
                selectedFilter ===
                item
                  ? "white"
                  : "#111827",

              padding: "8px 12px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {item}
          </button>
        ))}

        <select
          value={selectedProduct}
          onChange={(e) =>
            setSelectedProduct(
              e.target.value
            )
          }
          style={{
            border:
              "1px solid #e5e7eb",
            background: "white",
            padding: "8px 12px",
            borderRadius: "10px",
            fontSize: "11px",
            fontWeight: "600",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option>
            All Products
          </option>

          {data.topProducts?.map(
            (product) => (
              <option
                key={product.name}
              >
                {product.name}
              </option>
            )
          )}
        </select>
      </div>

      {/* STATS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(170px,1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        {[
          {
            title: "Total Orders",
            value:
              data.totalOrders,
            growth:
              data.ordersGrowth,
            icon: (
              <ShoppingCart
                size={15}
              />
            ),
            bg: "#beecdf",
          },

          {
            title: "Revenue",
            value: `${data.revenue} MRU`,
            growth:
               data.revenueGrowth,
            icon: (
              <DollarSign
                size={15}
              />
            ),
            bg: "#dcfce7",
          },

          {
            title:
              "Confirmation",
            value: `${data.confirmationRate}%`,
            icon: (
              <CheckCircle2
                size={15}
              />
            ),
            bg: "#dcfce7",
          },

          {
            title: "Pending",
            value:
              data.pendingOrders,
            icon: (
              <Clock3
                size={15}
              />
            ),
            bg: "#fef3c7",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="glass-card"
          >
            <div
              style={{
                padding: "13px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize:
                        "10px",
                      color:
                        "#6b7280",
                      marginBottom:
                        "4px",
                    }}
                  >
                    {item.title}
                  </p>

                  <h2
                    style={{
                      fontSize:
                        "19px",
                      fontWeight:
                        "800",
                    }}
                  >
                    {item.value}
                  </h2>

                  {item.growth !==
undefined && (
  <p
    style={{
      fontSize: "10px",
      marginTop: "4px",
      color:
        item.growth >= 0
          ? "#16a34a"
          : "#dc2626",
      fontWeight: "700",
    }}
  >
    {item.growth >= 0
      ? "+"
      : ""}
    {item.growth}% vs
    yesterday
  </p>
)}
                </div>

                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius:
                      "11px",
                    background:
                      item.bg,
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                  }}
                >
                  {item.icon}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "2fr 1fr",
          gap: "12px",
          marginBottom: "18px",
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
                  Revenue Analytics
                </h2>

                <p
                  style={{
                    fontSize:
                      "10px",
                    color:
                      "#9ca3af",
                  }}
                >
                  Sales report
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
                No revenue data
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
              Orders Status
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
                No data yet
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
                        marginBottom:
                          "7px",
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
                              COLORS[
                                index %
                                  COLORS.length
                              ],
                          }}
                        />

                        {item.name}
                      </div>

                      <strong>
                        {
                          item.value
                        }
                      </strong>
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
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: "12px",
          marginBottom: "18px",
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
                Top Products
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
                No products yet
              </p>
            ) : (
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
            )}
          </div>
        </div>

        {/* AGENTS */}

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
                Top Agents
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
                No agents yet
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

                    <strong>
                      {
                        agent.total
                      }
                    </strong>
                  </div>
                )
              )
            )}
          </div>
        </div>
      </div>

      {/* ORDERS */}

      <div className="glass-card">
        <div
          style={{
            padding: "14px",
            overflowX: "auto",
          }}
        >
          <h2
            style={{
              fontSize: "13px",
              fontWeight: "700",
              marginBottom: "12px",
            }}
          >
            Recent Orders
          </h2>

          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              fontSize: "11px",
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom:
                    "1px solid #e5e7eb",
                }}
              >
                <th
                  style={{
                    paddingBottom:
                      "10px",
                  }}
                >
                  Customer
                </th>

                <th
                  style={{
                    paddingBottom:
                      "10px",
                  }}
                >
                  Product
                </th>

                <th
                  style={{
                    paddingBottom:
                      "10px",
                  }}
                >
                  City
                </th>

                <th
                  style={{
                    paddingBottom:
                      "10px",
                  }}
                >
                  Status
                </th>

                <th
                  style={{
                    paddingBottom:
                      "10px",
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {data.recentOrders
                ?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding:
                        "14px 0",
                      color: "#9ca3af",
                    }}
                  >
                    No orders found
                  </td>
                </tr>
              ) : (
                data.recentOrders.map(
                  (order) => (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom:
                          "1px solid #f3f4f6",
                      }}
                    >
                      <td
                        style={{
                          padding:
                            "11px 0",
                        }}
                      >
                        {
                          order.customer
                        }
                      </td>

                      <td>
                        {
                          order.product
                        }
                      </td>

                      <td>
                        {order.city}
                      </td>

                      <td>
                        <span
                          style={{
                            padding:
                              "4px 10px",
                            borderRadius:
                              "999px",
                            fontSize:
                              "10px",
                            fontWeight:
                              "700",

                            background:
                              order.status ===
                              "Confirmed"
                                ? "#dcfce7"
                                : order.status ===
                                  "Pending"
                                ? "#fef3c7"
                                : "#fee2e2",

                            color:
                              order.status ===
                              "Confirmed"
                                ? "#166534"
                                : order.status ===
                                  "Pending"
                                ? "#92400e"
                                : "#991b1b",
                          }}
                        >
                          {
                            order.status
                          }
                        </span>
                      </td>

                      <td>
                        {
                          order.amount
                        }{" "}
                        MRU
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
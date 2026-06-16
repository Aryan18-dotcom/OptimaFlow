"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { redirect } from "next/navigation";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 25 } }
};

export default function Home() {
  const [metrics, setMetrics] = useState({
    assignmentsDistribution: "0 / 0",
    unassignedCountText: "0 Vehicles unassigned",
    fleetsOnRoad: 0,
    fleetsUnavailable: 0,
    totalTripsToday: 0
  });
  const [logsTable, setLogsTable] = useState<any[]>([]);
  const [organizationTitle, setOrganizationTitle] = useState("Logistics Command Center");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCenterMetrics() {
      try {
        const response = await fetch("/api/dashboard");
        const json = await response.json();

        if (json.success) {
          setMetrics(json.metrics);
          setLogsTable(json.activeLogsTable || []);

          if (json.settings?.companyName) {
            setOrganizationTitle(json.settings.companyName);
          }
        }
      } catch (error) {
        console.error("Failed downloading command analytics framework:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCenterMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-neutral-100">
        <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="w-full min-h-screen bg-neutral-100 rounded-2xl text-slate-900 antialiased font-sans selection:bg-sky-500/20">
      <div className="max-w-400 mx-auto p-4 md:p-8 space-y-8">

        {/* --- DASHBOARD HEADER --- */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{organizationTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time enterprise metrics aggregated from local database engines.</p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-600 bg-white border border-neutral-200 px-3 py-1.5 rounded-full shadow-sm cursor-default select-none">
              Live System Active
            </span>
          </div>
        </motion.div>

        {/* --- KPI METRIC CARDS --- */}
        <motion.section variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
          <MetricCard title="Today's Fleet Assignments" value={metrics.assignmentsDistribution} subtext={metrics.unassignedCountText} status="info" />
          <MetricCard title="Fleets on Road" value={String(metrics.fleetsOnRoad)} subtext="En route to destinations" status="success" />
          <MetricCard title="Fleet Unavailable" value={String(metrics.fleetsUnavailable)} subtext="In maintenance bay yard" status="danger" />
          <MetricCard title="Today's Total Trips" value={String(metrics.totalTripsToday)} subtext="Trips dispatched today" status="warning" />
        </motion.section>

        {/* --- MAIN OPERATIONAL WORKSPACE --- */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Active Logs Table */}
          <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="xl:col-span-2 bg-white rounded-xl border border-neutral-200 shadow-md p-4 lg:p-6 max-h-120 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Recent Route Operations Feed</h2>
                <p className="text-xs text-slate-400">Showing logs for today and yesterday</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-slate-400 text-[9px] lg:text-xs font-semibold uppercase tracking-wider bg-neutral-50/70">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Vehicle / Driver</th>
                    <th className="py-3 px-4">Route Leg Chain</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <motion.tbody variants={containerVariants} initial="hidden" animate="show" className="divide-y divide-neutral-100 text-slate-700">
                  {logsTable.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 lg:py-8 text-center text-slate-400 font-medium">
                        No logistical transactions recorded.
                      </td>
                    </tr>
                  ) : (
                    logsTable.map((row) => {
                      // Helper to convert "2026-06-15" to "15-Jun"
                      const formatDate = (dateStr: string) => {
                        if (!dateStr) return "";
                        const date = new Date(dateStr + "T00:00:00");
                        return date.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short'
                        });
                      };

                      return (
                        <TableRow
                          key={row.id}
                          dateStr={formatDate(row.dateString)}
                          asset={row.assetPlate}
                          driver={row.operatorPilot}
                          legs={row.legs || []}
                        />
                      );
                    })
                  )}
                </motion.tbody>
              </table>
            </div>
          </motion.div>

          {/* Utilities Management Panel */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-xl border border-neutral-200 shadow-md p-6 flex flex-col justify-between h-fit">
            <div className="space-y-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Billing & ERP Utilities</h2>
                <p className="text-xs text-slate-400">Automate manifest distribution chains instantly</p>
              </div>

              <div className="space-y-2">
                <button onClick={() => redirect("/generations")} className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-3 px-4 rounded-xl flex items-center justify-between group cursor-pointer transition-colors shadow-sm">
                  <span>Generate New Invoice</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
                <button onClick={() => redirect('/timeline')} className="w-full bg-white hover:bg-neutral-50 text-slate-700 border border-neutral-200 text-sm font-medium py-3 px-4 rounded-xl flex items-center justify-between cursor-pointer transition-colors">
                  <span>Compile Freight Manifest</span>
                  <span>→</span>
                </button>
                <button onClick={() => window.print()} className="w-full bg-white hover:bg-neutral-50 text-slate-700 border border-neutral-200 text-sm font-medium py-3 px-4 rounded-xl flex items-center justify-between cursor-pointer transition-colors">
                  <span>Print Dashboard Viewport</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-200 text-center">
              <p className="text-xs text-slate-400 font-medium">
                Local Data Engine Mode: <code className="bg-neutral-100 font-bold text-rose-600 px-1.5 py-0.5 rounded border border-neutral-200/60">JSON_FS_SHARDED</code>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

const MetricCard = ({ title, value, subtext, status }: { title: string, value: string, subtext: string, status: "success" | "warning" | "danger" | "info" }) => {
  const borderColors = {
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-rose-500",
    info: "border-l-sky-500",
  };
  return (
    <motion.div variants={itemVariants as any} whileHover={{ y: -2 }} className={`bg-white rounded-xl border border-neutral-200 border-l-4 ${borderColors[status]} p-5 shadow-sm cursor-default select-none`}>
      <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">{title}</span>
      <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
      <p className="text-[10px] lg:text-xs text-slate-500 mt-1.5">{subtext}</p>
    </motion.div>
  );
};

const TableRow = ({ dateStr, asset, driver, legs }: { dateStr: string; asset: string; driver: string; legs: any[] }) => {
  return (
    <motion.tr variants={itemVariants as any} className="hover:bg-neutral-50/40 transition-colors group">
      <td className="py-2 px-3 lg:p-4 font-semibold text-slate-500 text-xs whitespace-nowrap">{dateStr}</td>
      <td className="p-2 lg:p-4">
        <div className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors text-[10px] whitespace-nowrap lg:text-xs">Veh - {asset}</div>
        <div className="text-[8.5px] whitespace-nowrap lg:text-xs font-medium text-slate-400 mt-0.5">Driver: <span className="text-slate-600 font-semibold">({driver})</span></div>
      </td>

      <td className="p-1 lg:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {legs.map((leg, i) => (
            <React.Fragment key={i}>
              {/* This mimics the exact bubble style from your Notary page */}
              <div className="flex items-center space-x-1 bg-white border border-neutral-200 rounded-lg px-2 py-1 lg:px-3 lg:py-1.5 shadow-sm">
                <span className="font-semibold text-slate-800 text-[10px] lg:text-sm">{leg.location}</span>

                {/* Status Badges */}
                {leg.type && leg.type !== "None" && (
                  <span className={`text-[8px] lg:text-xs font-bold px-1.5 py-0.5 rounded ${leg.type === "LD" ? "bg-sky-100 text-sky-700" :
                    leg.type === "Parking" ? "bg-purple-100 text-purple-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                    {leg.type === "Parking" ? "PRK" : leg.type}
                  </span>
                )}

                {/* Custom Tags like [Vatva] */}
                {leg.customTag && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">
                    {leg.customTag}
                  </span>
                )}
              </div>

              {/* The Arrow Connector */}
              {i < legs.length - 1 && (
                <span className="text-neutral-400 font-bold mx-0.5 lg:mx-1">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </td>

      <td className="py-4 px-4 text-right">
        <button onClick={() => window.location.href = "/notary"} className="text-[10px] lg:text-xs font-bold text-slate-500 hover:text-sky-600 bg-neutral-100 border border-neutral-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
          Manage
        </button>
      </td>
    </motion.tr>
  );
};
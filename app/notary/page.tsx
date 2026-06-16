"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

// --- Types ---
interface RouteLeg {
  location: string;
  type: "LD" | "MT" | "Parking" | "None";
  customTag?: string;
}

interface Trip {
  id: string;
  date: string; // YYYY-MM-DD
  vehicleNumber: string;
  driverName: string;
  legs: RouteLeg[];
}

interface ResourceDriver { id: string; driverName: string; phone: string; status: string; }
interface ResourceTruck { id: string; plateNumber: string; model: string; ownerName: string; status: string; }
interface ResourceAssignment { vehicleNumber: string; driverName: string; }

// --- Universal Date Converter ---
const dateConverter = (date: string) => {
  if (!date) return "";
  const monthMap = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // If it's already YYYY-MM-DD, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  // If "15-Jun-2026"
  const [d, m, y] = date.split('-');
  return `${y}-${String(monthMap.indexOf(m) + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
};

function parseRouteSequenceToLegs(sequenceStr: string): RouteLeg[] {
  if (!sequenceStr) return [{ location: "", type: "None" }];
  return sequenceStr.split("-").map(legText => {
    let type: "LD" | "MT" | "Parking" | "None" = "None";
    let customTag: string | undefined;
    let location = legText;

    const tagMatch = location.match(/\[([^\]]+)\]/);
    if (tagMatch) { customTag = tagMatch[1]; location = location.replace(/\[[^\]]+\]/, ""); }

    const typeMatch = location.match(/\(([^)]+)\)/);
    if (typeMatch) {
      const parsedType = typeMatch[1];
      if (["LD", "MT", "Parking"].includes(parsedType)) type = parsedType as any;
      location = location.replace(/\([^)]+\)/, "");
    }
    return { location: location.trim(), type, customTag };
  });
}

export default function DailyNotary() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFleetPairs, setActiveFleetPairs] = useState<ResourceAssignment[]>([]);
  const [selectedPairIndex, setSelectedPairIndex] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "today">("today");

  const todayStr = new Date().toISOString().split('T')[0];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tripDate, setTripDate] = useState(todayStr);
  const [legs, setLegs] = useState<RouteLeg[]>([{ location: "", type: "LD" }]);

  useEffect(() => {
    async function loadData() {
      try {
        const [tripsRes, resRes] = await Promise.all([fetch("/api/sheets"), fetch("/api/resources")]);
        const tripsJson = await tripsRes.json();
        const resJson = await resRes.json();

        if (tripsJson.success) {
          setTrips(tripsJson.data.map((item: any) => ({
            id: item.id,
            date: dateConverter(item.date),
            vehicleNumber: item.vehicleNumber,
            driverName: item.driverName,
            legs: parseRouteSequenceToLegs(item.routeSequence)
          })));
        }

        if (resJson.success) {
          const fetchedDrivers = resJson.drivers.map((d: any) => ({ ...d.details, name: d.name }));
          const fetchedTrucks = resJson.trucks.map((t: any) => ({ ...t.details, plateNumber: t.name }));
          const fetchedAssignments = resJson.assignments.map((a: any) => a.details);

          setActiveFleetPairs(fetchedTrucks
            .map((truck: ResourceTruck) => {
              const assign = fetchedAssignments.find((a: any) => a.truckId === truck.id);
              const driver = assign ? fetchedDrivers.find((d: any) => d.id === assign.driverId) : null;
              return { vehicleNumber: truck.plateNumber, driverName: driver?.name || "None" };
            })
            .filter((p: ResourceDriver) => p.driverName !== "None"));
        }
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }
    loadData();
  }, []);

  // --- Helper Functions for Multi-Leg Inputs ---
  const handleAddLegField = () => {
    setLegs([...legs, { location: "", type: "None" }]);
  };

  const handleRemoveLegField = (index: number) => {
    if (legs.length === 1) return;
    setLegs(legs.filter((_, i) => i !== index));
  };

  const handleLegChange = (index: number, fields: Partial<RouteLeg>) => {
    const updatedLegs = [...legs];
    updatedLegs[index] = { ...updatedLegs[index], ...fields };
    setLegs(updatedLegs);
  };

  // --- Form CRUD Triggers ---
  const openCreateModal = () => {
    setEditingTripId(null);
    setSelectedPairIndex("");
    setTripDate(todayStr);
    setLegs([{ location: "", type: "None" }]);
    setIsModalOpen(true);
  };

  const openEditModal = (trip: Trip) => {
    setEditingTripId(trip.id);
    setTripDate(trip.date);
    setLegs(trip.legs);
    const idx = activeFleetPairs.findIndex(p => p.vehicleNumber === trip.vehicleNumber);
    setSelectedPairIndex(idx !== -1 ? idx.toString() : "");
    setIsModalOpen(true);
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const activePair = activeFleetPairs[parseInt(selectedPairIndex, 10)];

    const tripPayload = {
      id: editingTripId || `TRIP-${activePair.vehicleNumber}-${Date.now()}`,
      date: tripDate,
      vehicleNumber: activePair.vehicleNumber,
      driverName: activePair.driverName,
      routeSequence: legs.map(l => `${l.location}${l.type !== "None" ? `(${l.type})` : ""}${l.customTag ? `[${l.customTag}]` : ""}`).join("-")
    };

    try {
      await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: tripPayload }) });
      toast.success("Saved!");
      window.location.reload();
    } catch { toast.error("Failed"); } finally { setIsSubmitting(false); }
  };

  const handleDeleteTrip = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this notary route log?")) return;

    try {
      const response = await fetch(`/api/sheets?id=${id}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message);

      // Remove from active state view array if server successfully deleted it
      setTrips(trips.filter((t) => t.id !== id));

    } catch (error: any) {
      toast.error(`⚠️ Deletion Failed: ${error.message || "Could not remove entry from storage."}`);
    }
  };

  const filteredTrips = trips.filter(t =>
    (t.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) || t.driverName.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (filterDate ? t.date === filterDate : true) &&
    (viewMode === "today" ? t.date === todayStr : true)
  );

  return (
    <main className="w-full min-h-screen bg-neutral-100 text-slate-900 antialiased p-3 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        {/* --- HEADER BLOCK --- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Daily Route Notary Logs</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Track multi-stop transit assignments, parking entries, and payload statuses.</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={openCreateModal}
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-sm cursor-pointer transition-colors self-start sm:self-auto"
          >
            + Create New Route Log
          </motion.button>
        </div>

        {/* --- FILTER CONTROL MODULE --- */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setViewMode("all"); setFilterDate(""); }}
              className={`text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border transition-all cursor-pointer ${viewMode === "all" && !filterDate ? "bg-slate-900 text-white border-slate-900" : "bg-neutral-50 border-neutral-200 text-slate-600"}`}
            >
              All Records
            </button>
            <button
              onClick={() => { setViewMode("today"); setFilterDate(""); }}
              className={`text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border transition-all cursor-pointer ${viewMode === "today" ? "bg-slate-900 text-white border-slate-900" : "bg-neutral-50 border-neutral-200 text-slate-600"}`}
            >
              Today's Trips
            </button>
            <div className="h-6 w-px bg-neutral-200 mx-1 hidden sm:block" />
            <div className="flex items-center gap-2 lg:gap-0">
              <label className="text-[10px] lg:hidden uppercase font-bold text-slate-400">Filter Date:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => { setFilterDate(e.target.value); setViewMode("all"); }}
                className="text-xs font-medium border border-neutral-200 bg-neutral-50 p-1.5 sm:p-2 rounded-lg focus:outline-none focus:border-sky-500 text-slate-600"
              />
            </div>
          </div>

          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search Vehicle, Driver, or Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 text-xs p-2 sm:p-2.5 rounded-lg focus:outline-none focus:border-sky-500 text-slate-700"
            />
          </div>
        </div>

        {/* --- TRIP LIST DATA BOARD - Mobile Card Layout & Desktop Table --- */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-md overflow-hidden">
          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-slate-400 text-xs font-bold uppercase bg-neutral-50/80 tracking-wide">
                  <th className="py-3.5 px-6 w-32">Date</th>
                  <th className="py-3.5 px-6 w-56">Vehicle & Operator</th>
                  <th className="py-3.5 px-6">Notary Route Sequence</th>
                  <th className="py-3.5 px-6 text-right w-44">Management Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm">
                <AnimatePresence mode="popLayout">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Syncing Ledger Pipeline...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTrips.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-12 text-center text-slate-400 font-medium">
                        No notary trip records found matching your specified filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTrips.map((trip) => (
                      <motion.tr
                        key={trip.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-neutral-50/60 transition-colors group"
                      >
                        <td className="py-4 px-6 font-semibold text-slate-600 whitespace-nowrap">
                          {new Date(trip.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </td>

                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors">Veh - {trip.vehicleNumber}</div>
                          <div className="text-xs font-medium text-slate-400 mt-0.5">Driver: <span className="text-slate-600 font-semibold">({trip.driverName})</span></div>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex flex-wrap items-center gap-2">
                            {trip.legs.map((leg, i) => (
                              <React.Fragment key={i}>
                                <div className="flex items-center space-x-1.5 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                                  <span className="font-semibold text-slate-800 text-xs sm:text-sm">{leg.location}</span>
                                  {leg.type !== "None" && leg.type !== "Parking" && (
                                    <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded ${leg.type === "LD" ? "bg-sky-100 text-sky-800 border border-sky-200" : "bg-amber-100 text-amber-800 border border-amber-200"}`}>
                                      {leg.type}
                                    </span>
                                  )}
                                  {leg.type === "Parking" && (
                                    <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                      PRK
                                    </span>
                                  )}
                                  {leg.customTag && (
                                    <span className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">
                                      {leg.customTag}
                                    </span>
                                  )}
                                </div>
                                {i < trip.legs.length - 1 && (
                                  <span className="text-neutral-300 font-bold text-base select-none">➔</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button
                            onClick={() => openEditModal(trip)}
                            className="text-xs font-semibold text-sky-600 hover:bg-sky-50 border border-transparent hover:border-sky-200 px-2.5 py-1.5 rounded-md transition-all cursor-pointer mr-1.5"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTrip(trip.id)}
                            className="text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 px-2.5 py-1.5 rounded-md transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Visible only on mobile/tablet */}
          <div className="block md:hidden divide-y divide-neutral-100">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <div className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Syncing Ledger Pipeline...</p>
                  </div>
                </div>
              ) : filteredTrips.length === 0 ? (
                <div className="px-2 py-12 text-center text-slate-400 font-medium text-sm">
                  No notary trip records found matching your specified filters.
                </div>
              ) : (
                filteredTrips.map((trip) => (
                  <motion.div
                    key={trip.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 space-y-3 hover:bg-neutral-50/60 transition-colors"
                  >
                    {/* Header: Date and Actions */}
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-600 whitespace-nowrap text-md">
                        {new Date(trip.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(trip)}
                          className="text-xs font-semibold text-sky-600 hover:bg-sky-50 px-2.5 py-1.5 rounded-md transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTrip(trip.id)}
                          className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-md transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Vehicle & Driver Info */}
                    <div>
                      <div className="font-bold text-slate-900 text-base">Veh - {trip.vehicleNumber}</div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5">
                        Driver: <span className="text-slate-700 font-semibold">{trip.driverName}</span>
                      </div>
                    </div>

                    {/* Route Legs */}
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-wider">Route Sequence</div>
                      <div className="flex flex-wrap items-center gap-2">
                        {trip.legs.map((leg, i) => (
                          <React.Fragment key={i}>
                            <div className="flex items-center space-x-1.5 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 shadow-sm">
                              <span className="font-semibold text-slate-800 text-xs">{leg.location}</span>
                              {leg.type !== "None" && leg.type !== "Parking" && (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${leg.type === "LD" ? "bg-sky-100 text-sky-800 border border-sky-200" : "bg-amber-100 text-amber-800 border border-amber-200"}`}>
                                  {leg.type}
                                </span>
                              )}
                              {leg.type === "Parking" && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                  PRK
                                </span>
                              )}
                              {leg.customTag && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">
                                  {leg.customTag}
                                </span>
                              )}
                            </div>
                            {i < trip.legs.length - 1 && (
                              <span className="text-neutral-300 font-bold text-sm select-none">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* --- MODAL DIALOG - Responsive Modal --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-xl rounded-xl border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] mx-3 sm:mx-4"
            >
              <div className="p-4 sm:p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                <h3 className="font-bold text-base sm:text-lg text-slate-900">
                  {editingTripId ? "Modify Notary Entry" : "Log New Logistics Route"}
                </h3>
                <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-base sm:text-sm cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleSaveTrip} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Date Logged</label>
                    <input
                      type="date"
                      required
                      value={tripDate}
                      disabled={isSubmitting}
                      onChange={e => setTripDate(e.target.value)}
                      className="w-full mt-1 bg-neutral-50 border border-neutral-200 text-sm p-2 sm:p-2.5 rounded-lg focus:outline-none focus:border-sky-500 disabled:opacity-60"
                    />
                  </div>

                  {/* UNIFIED ACTIVE TRUCK AND DRIVER PAIR DROPDOWN */}
                  <div>
                    <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Fleet Asset Selection</label>
                    <select
                      required
                      disabled={isSubmitting}
                      value={selectedPairIndex}
                      onChange={e => setSelectedPairIndex(e.target.value)}
                      className="w-full mt-1 bg-neutral-50 border border-neutral-200 text-sm p-2 sm:p-2.5 rounded-lg focus:outline-none focus:border-sky-500 disabled:opacity-60 text-slate-800"
                    >
                      <option value="">-- Choose Active Pairing --</option>
                      {activeFleetPairs.map((pair, idx) => (
                        <option key={idx} value={idx}>
                          {pair.vehicleNumber} (Pilot: {pair.driverName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* --- ROUTE CHAIN CONSTRUCTOR --- */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Route Execution Leg Chain</label>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleAddLegField}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      + Add Target Location
                    </button>
                  </div>

                  <div className="space-y-2 max-h-55 overflow-y-auto pr-1">
                    {legs.map((leg, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2 bg-neutral-50/50 p-2 rounded-lg border border-neutral-200/60">
                        <span className="text-xs font-bold font-mono text-neutral-400 px-1 w-5">{index + 1}</span>

                        <input
                          type="text"
                          required
                          disabled={isSubmitting}
                          placeholder="Location"
                          value={leg.location}
                          onChange={e => handleLegChange(index, { location: e.target.value })}
                          className="flex-1 bg-white border border-neutral-200 text-xs p-2 rounded-lg focus:outline-none focus:border-sky-500 disabled:opacity-60"
                        />

                        <select
                          value={leg.type}
                          disabled={isSubmitting}
                          onChange={e => handleLegChange(index, { type: e.target.value as any })}
                          className="flex-1 bg-white border border-neutral-200 text-xs p-2 rounded-lg focus:outline-none focus:border-sky-500 w-24 sm:w-28 text-slate-600 disabled:opacity-60 ml-7 lg:ml-0"
                        >
                          <option value="None">Plain Drop</option>
                          <option value="LD">Loaded (LD)</option>
                          <option value="MT">Empty (MT)</option>
                          <option value="Parking">Parking</option>
                        </select>

                        <input
                          type="text"
                          disabled={isSubmitting}
                          placeholder="Tag"
                          value={leg.customTag || ""}
                          onChange={e => handleLegChange(index, { customTag: e.target.value || undefined })}
                          className="w-25 lg:flex-1 bg-white border border-neutral-200 text-xs p-2 rounded-lg focus:outline-none focus:border-sky-500 disabled:opacity-60"
                        />

                        <button
                          type="button"
                          disabled={legs.length === 1 || isSubmitting}
                          onClick={() => handleRemoveLegField(index)}
                          className="text-xs font-medium text-rose-500 hover:bg-rose-50 border border-neutral-200/40 p-2 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsModalOpen(false)}
                    className="text-xs font-bold text-slate-500 bg-neutral-100 border border-neutral-200 px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-lg shadow-sm cursor-pointer flex items-center justify-center min-w-25 disabled:bg-slate-700"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : editingTripId ? (
                      "Commit Changes"
                    ) : (
                      "Save Entry"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
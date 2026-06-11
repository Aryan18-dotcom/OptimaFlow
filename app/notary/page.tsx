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

// Resource mapping types to match the configurations database structure
interface ResourceDriver { id: string; name: string; phone: string; status: string; }
interface ResourceTruck { id: string; plateNumber: string; model: string; ownerName: string; status: string; }
interface ResourceAssignment { truckId: string; driverId: string; assignedAt: string; }

// Utility function to reconstruct dynamic spreadsheet text strings back into standard leg objects
function parseRouteSequenceToLegs(sequenceStr: string): RouteLeg[] {
  if (!sequenceStr) return [{ location: "", type: "None" }];

  const legsRaw = sequenceStr.split("-");
  return legsRaw.map(legText => {
    let type: "LD" | "MT" | "Parking" | "None" = "None";
    let customTag: string | undefined = undefined;
    let location = legText;

    // Extract custom tag: [Dev]
    const tagMatch = location.match(/\[([^\]]+)\]/);
    if (tagMatch) {
      customTag = tagMatch[1];
      location = location.replace(/\[[^\]]+\]/, "");
    }

    // Extract status tags: (LD), (MT), (Parking)
    const typeMatch = location.match(/\(([^)]+)\)/);
    if (typeMatch) {
      const parsedType = typeMatch[1];
      if (parsedType === "LD" || parsedType === "MT" || parsedType === "Parking") {
        type = parsedType;
      }
      location = location.replace(/\([^)]+\)/, "");
    }

    return {
      location: location.trim(),
      type,
      customTag
    };
  });
}

export default function DailyNotary() {
  // --- Live Data States ---
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Configuration Pairings States ---
  const [activeFleetPairs, setActiveFleetPairs] = useState<{ vehicleNumber: string; driverName: string }[]>([]);
  const [selectedPairIndex, setSelectedPairIndex] = useState<string>("");

  // --- Filtering & Search States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "today">("today");

  const todayLocal = new Date();
  const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;

  // --- Form States ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tripDate, setTripDate] = useState(todayStr);
  const [legs, setLegs] = useState<RouteLeg[]>([{ location: "", type: "LD" }]);

  // --- Sync effect lifecycle on mount ---
  useEffect(() => {
    async function loadDataPipeline() {
      try {
        // 1. Fetch live logged trips ledger
        const tripsResponse = await fetch("/api/sheets");
        const tripsJson = await tripsResponse.json();

        if (tripsJson.success && tripsJson.data) {
          const formattedTrips: Trip[] = tripsJson.data.map((item: any) => ({
            id: item.id,
            date: item.date,
            vehicleNumber: item.vehicleNumber,
            driverName: item.driverName,
            legs: parseRouteSequenceToLegs(item.routeSequence)
          }));

          formattedTrips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTrips(formattedTrips);
        }

        // 2. Fetch configurations layout pairs
        const resourcesResponse = await fetch("/api/resources");
        const resJson = await resourcesResponse.json();

        if (resJson.success) {
          const fetchedDrivers: ResourceDriver[] = resJson.drivers || [];
          const fetchedTrucks: ResourceTruck[] = resJson.trucks || [];
          const fetchedAssignments: ResourceAssignment[] = resJson.assignments || [];

          // Map relationships and filter out trucks that don't have an assigned pilot
          const compiledPairs = fetchedTrucks
            .map(truck => {
              const assignment = fetchedAssignments.find(a => a.truckId === truck.id);
              const matchingDriver = assignment ? fetchedDrivers.find(d => d.id === assignment.driverId) : null;

              return {
                vehicleNumber: truck.plateNumber,
                driverName: matchingDriver ? matchingDriver.name : "None"
              };
            })
            // CRITICAL STATUS FILTER: Only show active paired units with a configured driver
            .filter(pair => pair.driverName !== "None");

          setActiveFleetPairs(compiledPairs);
        }

      } catch (err) {
        console.error("Failed loading local application logs database:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDataPipeline();
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

    // Auto-select dropdown match if vehicle assignment configuration state exists
    const matchingPairIndex = activeFleetPairs.findIndex(
      p => p.vehicleNumber.toLowerCase() === trip.vehicleNumber.toLowerCase()
    );
    setSelectedPairIndex(matchingPairIndex !== -1 ? matchingPairIndex.toString() : "");
    setIsModalOpen(true);
  };

  // --- Handle API Save Pipeline ---
  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPairIndex === "" || legs.some(l => !l.location.trim())) {
      toast.warning("Please choose a fleet asset selection pair before submitting.");
      return;
    }

    setIsSubmitting(true);

    const activePair = activeFleetPairs[parseInt(selectedPairIndex, 10)];

    const routeSequence = legs
      .map(l => {
        let tag = l.type !== "None" ? `(${l.type})` : "";
        if (l.customTag) tag += `[${l.customTag}]`;
        return `${l.location}${tag}`;
      })
      .join("-");

    const tripPayload = {
      id: editingTripId || `TRIP-${activePair.vehicleNumber}-${Date.now()}`,
      date: tripDate,
      vehicleNumber: activePair.vehicleNumber,
      driverName: activePair.driverName,
      routeSequence: routeSequence
    };

    try {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "notary",
          data: tripPayload
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message);

      if (editingTripId) {
        setTrips(trips.map(t => t.id === editingTripId ? {
          ...t,
          date: tripDate,
          vehicleNumber: activePair.vehicleNumber,
          driverName: activePair.driverName,
          legs
        } : t));
      } else {
        const newLocalTrip: Trip = {
          id: tripPayload.id,
          date: tripDate,
          vehicleNumber: activePair.vehicleNumber,
          driverName: activePair.driverName,
          legs
        };
        setTrips([newLocalTrip, ...trips]);
      }

      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(`⚠️ Sheet Sync Failed: ${error.message || "Could not sync entry state."}`);
    } finally {
      setIsSubmitting(false);
    }
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


  // --- Query Filtering Logic ---
  const filteredTrips = trips.filter(trip => {
    const matchesSearch =
      trip.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.legs.some(l => l.location.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDate = filterDate ? trip.date === filterDate : true;
    const matchesView = viewMode === "today" ? trip.date === todayStr : true;

    return matchesSearch && matchesDate && matchesView;
  });

  return (
    <main className="w-full min-h-screen bg-neutral-100 text-slate-900 antialiased p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* --- HEADER BLOCK --- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Route Notary Logs</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track multi-stop transit assignments, parking entries, and payload statuses.</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={openCreateModal}
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm cursor-pointer transition-colors self-start sm:self-auto"
          >
            + Create New Route Log
          </motion.button>
        </div>

        {/* --- FILTER CONTROL MODULE --- */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setViewMode("all"); setFilterDate(""); }}
              className={`text-xs font-bold px-4 py-2 rounded-lg border transition-all cursor-pointer ${viewMode === "all" && !filterDate ? "bg-slate-900 text-white border-slate-900" : "bg-neutral-50 border-neutral-200 text-slate-600"}`}
            >
              All Records
            </button>
            <button
              onClick={() => setViewMode("today")}
              className={`text-xs font-bold px-4 py-2 rounded-lg border transition-all cursor-pointer ${viewMode === "today" ? "bg-slate-900 text-white border-slate-900" : "bg-neutral-50 border-neutral-200 text-slate-600"}`}
            >
              Today's Trips
            </button>
            <div className="h-6 w-[1px] bg-neutral-200 mx-1 hidden sm:block" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setViewMode("all"); }}
              className="text-xs font-medium border border-neutral-200 bg-neutral-50 p-2 rounded-lg focus:outline-none focus:border-sky-500 text-slate-600"
            />
          </div>

          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search Vehicle, Driver, or Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 text-xs p-2.5 rounded-lg focus:outline-none focus:border-sky-500 text-slate-700"
            />
          </div>
        </div>

        {/* --- TRIP LIST DATA BOARD --- */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
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
                      <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
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
                                  <span className="font-semibold text-slate-800">{leg.location}</span>
                                  {leg.type !== "None" && leg.type !== "Parking" && (
                                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${leg.type === "LD" ? "bg-sky-100 text-sky-800 border border-sky-200" : "bg-amber-100 text-amber-800 border border-amber-200"}`}>
                                      {leg.type}
                                    </span>
                                  )}
                                  {leg.type === "Parking" && (
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                      PRK
                                    </span>
                                  )}
                                  {leg.customTag && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">
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
        </div>

      </div>

      {/* --- MODAL DIALOG --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-xl rounded-xl border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                <h3 className="font-bold text-lg text-slate-900">
                  {editingTripId ? "Modify Notary Entry" : "Log New Logistics Route"}
                </h3>
                <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleSaveTrip} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-400">Date Logged</label>
                    <input
                      type="date"
                      required
                      value={tripDate}
                      disabled={isSubmitting}
                      onChange={e => setTripDate(e.target.value)}
                      className="w-full mt-1 bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg focus:outline-none focus:border-sky-500 disabled:opacity-60"
                    />
                  </div>

                  {/* UNIFIED ACTIVE TRUCK AND DRIVER PAIR DROPDOWN */}
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-400">Fleet Asset Selection</label>
                    <select
                      required
                      disabled={isSubmitting}
                      value={selectedPairIndex}
                      onChange={e => setSelectedPairIndex(e.target.value)}
                      className="w-full mt-1 bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg focus:outline-none focus:border-sky-500 disabled:opacity-60 text-slate-800"
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
                    <label className="text-xs font-bold uppercase text-slate-400">Route Execution Leg Chain</label>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleAddLegField}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      + Add Target Location
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {legs.map((leg, index) => (
                      <div key={index} className="flex items-center gap-2 bg-neutral-50/50 p-2 rounded-lg border border-neutral-200/60">
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
                          className="bg-white border border-neutral-200 text-xs p-2 rounded-lg focus:outline-none focus:border-sky-500 w-28 text-slate-600 disabled:opacity-60"
                        >
                          <option value="None">Plain Drop</option>
                          <option value="LD">Loaded (LD)</option>
                          <option value="MT">Empty (MT)</option>
                          <option value="Parking">Parking</option>
                        </select>

                        <input
                          type="text"
                          disabled={isSubmitting}
                          placeholder="Tag (e.g., Dev)"
                          value={leg.customTag || ""}
                          onChange={e => handleLegChange(index, { customTag: e.target.value || undefined })}
                          className="w-20 bg-white border border-neutral-200 text-xs p-2 rounded-lg focus:outline-none focus:border-sky-500 disabled:opacity-60"
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

                <div className="pt-4 border-t border-neutral-100 flex justify-end gap-2">
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
                    className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-lg shadow-sm cursor-pointer flex items-center justify-center min-w-[100px] disabled:bg-slate-700"
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
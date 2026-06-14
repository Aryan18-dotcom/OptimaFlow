"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

type DriverStatus = "home" | "hospital" | "active" | "leaved" | "inActive";
type TruckStatus = "active" | "inActive" | "under maintenance" | "accidental";

interface Driver { id: string; name: string; phone: string; status: DriverStatus; }
interface Truck { id: string; plateNumber: string; model: string; ownerName: string; status: TruckStatus; }
interface Assignment { truckId: string; driverId: string; assignedAt: string; }

export default function ConfigManage() {
  const [activeTab, setActiveTab] = useState<"drivers" | "trucks" | "assign">("drivers");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Clean form input states without license dependencies
  const [driverForm, setDriverForm] = useState({ name: "", phone: "", status: "home" as DriverStatus });
  const [truckForm, setTruckForm] = useState({ plateNumber: "", model: "", ownerName: "", status: "active" as TruckStatus, directDriverId: "" });
  const [assignment, setAssignment] = useState({ truckId: "", driverId: "" });

  useEffect(() => {
    async function loadResources() {
      try {
        const response = await fetch("/api/resources");
        const json = await response.json();
        if (json.success) {
          setDrivers(json.drivers || []);
          setTrucks(json.trucks || []);
          setAssignments(json.assignments || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadResources();
  }, []);

  const dispatchAction = async (action: string, payload: any) => {
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      toast.error(`⚠️ Operation Refused: ${result.message}`);
      return false;
    }
    return true;
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverForm.name || !driverForm.phone.trim()) return;

    // Generate an absolute unique ID string using a combination of the timestamp and the last 4 digits of the phone number
    const phoneSuffix = driverForm.phone.trim().slice(-4).replace(/\D/g, "") || "0000";
    const driverUniqueId = `DRV-${Date.now().toString().slice(-4)}-${phoneSuffix}`;

    const newDriver: Driver = {
      id: driverUniqueId,
      name: driverForm.name.trim(),
      phone: driverForm.phone.trim(),
      status: driverForm.status
    };

    if (await dispatchAction("addDriver", newDriver)) {
      setDrivers([...drivers, newDriver]);
      setDriverForm({ name: "", phone: "", status: "home" });
    }
  };

  const handleUpdateDriverStatus = async (id: string, status: DriverStatus) => {
    if (await dispatchAction("updateDriverStatus", { id, status })) {
      setDrivers(drivers.map(d => d.id === id ? { ...d, status } : d));
    }
  };

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckForm.plateNumber || !truckForm.ownerName) return;
    const truckId = `TRK-${Date.now().toString().slice(-4)}`;

    const newTruck: Truck = {
      id: truckId,
      plateNumber: truckForm.plateNumber.toUpperCase().trim(),
      model: truckForm.model.trim() || "Standard Carrier",
      ownerName: truckForm.ownerName.trim(),
      status: truckForm.status
    };

    if (await dispatchAction("addTruck", { ...newTruck, directDriverId: truckForm.directDriverId })) {
      setTrucks([...trucks, newTruck]);
      if (truckForm.directDriverId) {
        setAssignments([...assignments.filter(a => a.driverId !== truckForm.directDriverId), { truckId, driverId: truckForm.directDriverId, assignedAt: new Date().toISOString() }]);
      }
      setTruckForm({ plateNumber: "", model: "", ownerName: "", status: "active", directDriverId: "" });
    }
  };

  const handleUpdateTruckStatus = async (id: string, status: TruckStatus) => {
    if (await dispatchAction("updateTruckStatus", { id, status })) {
      setTrucks(trucks.map(t => t.id === id ? { ...t, status } : t));
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment.truckId) return;

    if (await dispatchAction("assign", assignment)) {
      const filtered = assignments.filter(a => a.truckId !== assignment.truckId);
      if (assignment.driverId) {
        setAssignments([...filtered, { truckId: assignment.truckId, driverId: assignment.driverId, assignedAt: new Date().toISOString() }]);
      } else {
        setAssignments(filtered);
      }
      setAssignment({ truckId: "", driverId: "" });
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (await dispatchAction("deleteDriver", { id })) {
      setDrivers(drivers.filter(d => d.id !== id));
      setAssignments(assignments.filter(a => a.driverId !== id));
    }
  };

  const handleDeleteTruck = async (id: string) => {
    if (await dispatchAction("deleteTruck", { id })) {
      setTrucks(trucks.filter(t => t.id !== id));
      setAssignments(assignments.filter(a => a.truckId !== id));
    }
  };

  const busyDriverIds = assignments.map(a => a.driverId);
  const busyTruckIds = assignments.map(a => a.truckId);

  if (isLoading) return <div className="w-full h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <main className="w-full min-h-screen bg-neutral-100 text-slate-900 antialiased p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Fleet Resource Logistics Hub</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage corporate vehicles, ownership assignments, and medical or operational operator status registers.</p>
        </div>

        {/* Navigation Tabs - Responsive */}
        <div className="flex flex-wrap bg-neutral-200/60 p-1 rounded-xl gap-1 border border-neutral-200">
          {(["drivers", "trucks", "assign"] as const).map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className="flex-1 sm:flex-initial text-xs sm:text-sm font-semibold px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg capitalize transition-all relative cursor-pointer whitespace-nowrap"
            >
              <span className="relative z-10 text-slate-700">
                {tab === "assign" ? "Duty Control Tower" : tab}
              </span>
              {activeTab === tab && <motion.div layoutId="activeTabGlow" className="absolute inset-0 bg-white rounded-lg shadow-sm border border-neutral-200/40" />}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 shadow-md p-4 sm:p-6 min-h-100">
          <AnimatePresence mode="wait">

            {/* TAB: DRIVERS - Fully Responsive */}
            {activeTab === "drivers" && (
              <motion.div key="drivers-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                
                {/* Form Section */}
                <div className="lg:w-1/3 space-y-4">
                  <h3 className="font-bold text-base sm:text-lg text-slate-800">Register New Operator</h3>
                  <form onSubmit={handleAddDriver} className="space-y-3">
                    <input 
                      type="text" 
                      required 
                      placeholder="Driver Name" 
                      value={driverForm.name} 
                      onChange={e => setDriverForm({ ...driverForm, name: e.target.value })} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none focus:border-sky-500"
                    />
                    <input 
                      type="text" 
                      required 
                      placeholder="Contact Phone Number" 
                      value={driverForm.phone} 
                      onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none focus:border-sky-500"
                    />
                    <select 
                      value={driverForm.status} 
                      onChange={e => setDriverForm({ ...driverForm, status: e.target.value as DriverStatus })} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none text-slate-600 focus:border-sky-500"
                    >
                      <option value="home">🏠 Home (Off-Duty)</option>
                      <option value="hospital">🏥 Hospital / Medical Break</option>
                      <option value="active">⚡ Active (On Road)</option>
                      <option value="inActive">💤 In-Active State</option>
                      <option value="leaved">❌ Leaved (Left Corporate Job)</option>
                    </select>
                    <button className="w-full bg-sky-600 text-white font-medium text-sm py-2.5 rounded-lg cursor-pointer hover:bg-sky-700 transition-colors">
                      Add Operator
                    </button>
                  </form>
                </div>

                {/* Table Section - Responsive */}
                <div className="lg:flex-1">
                  <h3 className="font-bold text-base sm:text-lg text-slate-800 mb-4">Active Operations Roster</h3>
                  
                  {/* Mobile Card View */}
                  <div className="block lg:hidden space-y-3 max-h-125 overflow-y-auto">
                    {drivers.map(driver => (
                      <div key={driver.id} className="border border-neutral-200 rounded-lg p-4 space-y-3 bg-white">
                        <div>
                          <div className="font-bold text-slate-950 text-sm">{driver.name}</div>
                          <div className="text-[10px] font-mono font-bold text-slate-400 tracking-wider mt-0.5 uppercase">{driver.id}</div>
                        </div>
                        <div className="text-xs font-semibold text-slate-600">📞 {driver.phone}</div>
                        <div className="flex items-center justify-between gap-2">
                          <select 
                            value={driver.status} 
                            onChange={e => handleUpdateDriverStatus(driver.id, e.target.value as DriverStatus)} 
                            className="flex-1 text-xs font-semibold p-1.5 rounded-md bg-neutral-100 border border-neutral-200 outline-none text-slate-700"
                          >
                            <option value="home">🏠 Home</option>
                            <option value="hospital">🏥 Hospital</option>
                            <option value="active">⚡ Active</option>
                            <option value="inActive">💤 In-Active</option>
                            <option value="leaved">❌ Leaved</option>
                          </select>
                          <button 
                            onClick={() => handleDeleteDriver(driver.id)} 
                            className="text-xs text-rose-600 font-medium px-2.5 py-1.5 rounded-md hover:bg-rose-50 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {drivers.length === 0 && (
                      <div className="text-center text-slate-400 text-xs py-8">No drivers registered</div>
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 text-slate-400 text-xs font-semibold uppercase bg-neutral-50/70">
                          <th className="py-2.5 px-4">Operator Info</th>
                          <th className="py-2.5 px-4">Contact Phone</th>
                          <th className="py-2.5 px-4">Duty Status Ledger</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-sm">
                        {drivers.map(driver => (
                          <tr key={driver.id} className="hover:bg-neutral-50/50 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-800">
                              <div className="font-bold text-slate-950">{driver.name}</div>
                              <div className="text-[10px] font-mono font-bold text-slate-400 tracking-wider mt-0.5 uppercase">{driver.id}</div>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-600">📞 {driver.phone}</td>
                            <td className="py-3 px-4">
                              <select 
                                value={driver.status} 
                                onChange={e => handleUpdateDriverStatus(driver.id, e.target.value as DriverStatus)} 
                                className="text-xs font-semibold p-1.5 rounded-md bg-neutral-100 border border-neutral-200 outline-none text-slate-700"
                              >
                                <option value="home">🏠 Home</option>
                                <option value="hospital">🏥 Hospital</option>
                                <option value="active">⚡ Active</option>
                                <option value="inActive">💤 In-Active</option>
                                <option value="leaved">❌ Leaved Job</option>
                              </select>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button onClick={() => handleDeleteDriver(driver.id)} className="text-xs text-rose-600 font-medium px-2.5 py-1.5 rounded-md hover:bg-rose-50 cursor-pointer">
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: TRUCKS - Fully Responsive */}
            {activeTab === "trucks" && (
              <motion.div key="trucks-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                
                {/* Form Section */}
                <div className="lg:w-1/3 space-y-4">
                  <h3 className="font-bold text-base sm:text-lg text-slate-800">Register Fleet Asset</h3>
                  <form onSubmit={handleAddTruck} className="space-y-3">
                    <input 
                      type="text" 
                      required 
                      placeholder="Truck Plate Number" 
                      value={truckForm.plateNumber} 
                      onChange={e => setTruckForm({ ...truckForm, plateNumber: e.target.value })} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none font-mono uppercase focus:border-sky-500"
                    />
                    <input 
                      type="text" 
                      required 
                      placeholder="Purchased Under Name / Owner" 
                      value={truckForm.ownerName} 
                      onChange={e => setTruckForm({ ...truckForm, ownerName: e.target.value })} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none focus:border-sky-500"
                    />
                    <input 
                      type="text" 
                      placeholder="Chassis / Model Series" 
                      value={truckForm.model} 
                      onChange={e => setTruckForm({ ...truckForm, model: e.target.value })} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none focus:border-sky-500"
                    />

                    <select 
                      value={truckForm.status} 
                      onChange={e => setTruckForm({ ...truckForm, status: e.target.value as TruckStatus })} 
                      className="w-full bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none text-slate-600 focus:border-sky-500"
                    >
                      <option value="active">🟢 Active (On Road Ready)</option>
                      <option value="inActive">⚪ In-Active (Yard Hold)</option>
                      <option value="under maintenance">🔧 Under Maintenance / Workshop</option>
                      <option value="accidental">⚠️ Accidental Damage Yard</option>
                    </select>

                    <div className="border-t border-dashed border-neutral-200 pt-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Direct Pilot Assignment (Optional)</label>
                      <select 
                        value={truckForm.directDriverId} 
                        onChange={e => setTruckForm({ ...truckForm, directDriverId: e.target.value })} 
                        className="w-full mt-1 bg-sky-50/50 border border-sky-100 text-xs p-2.5 rounded-lg outline-none text-slate-700 focus:border-sky-500"
                      >
                        <option value="">-- No Operator (Leave Empty) --</option>
                        {drivers.filter(d => !busyDriverIds.includes(d.id) && d.status !== "leaved").map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                        ))}
                      </select>
                    </div>

                    <button className="w-full bg-sky-600 text-white font-medium text-sm py-2.5 rounded-lg cursor-pointer hover:bg-sky-700 transition-colors">
                      Register Asset
                    </button>
                  </form>
                </div>

                {/* Table Section - Responsive */}
                <div className="lg:flex-1">
                  <h3 className="font-bold text-base sm:text-lg text-slate-800 mb-4">Freight Asset Ledger</h3>
                  
                  {/* Mobile Card View */}
                  <div className="block lg:hidden space-y-3 max-h-125 overflow-y-auto">
                    {trucks.map(truck => (
                      <div key={truck.id} className="border border-neutral-200 rounded-lg p-4 space-y-3 bg-white">
                        <div>
                          <div className="font-mono font-bold text-base text-slate-900">{truck.plateNumber}</div>
                          <div className="text-xs text-slate-400 font-medium mt-0.5">{truck.model} ({truck.id})</div>
                        </div>
                        <div className="text-sm font-medium text-slate-700">Owner: {truck.ownerName}</div>
                        <div className="flex items-center justify-between gap-2">
                          <select 
                            value={truck.status} 
                            onChange={e => handleUpdateTruckStatus(truck.id, e.target.value as TruckStatus)} 
                            className="flex-1 text-xs font-bold p-1.5 rounded-md bg-neutral-100 border border-neutral-200 outline-none"
                          >
                            <option value="active">🟢 Active</option>
                            <option value="inActive">⚪ In-Active</option>
                            <option value="under maintenance">🔧 Workshop</option>
                            <option value="accidental">⚠️ Accidental</option>
                          </select>
                          <button 
                            onClick={() => handleDeleteTruck(truck.id)} 
                            className="text-xs text-rose-600 font-medium px-2.5 py-1.5 rounded-md hover:bg-rose-50 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {trucks.length === 0 && (
                      <div className="text-center text-slate-400 text-xs py-8">No trucks registered</div>
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 text-slate-400 text-xs font-semibold uppercase bg-neutral-50/70">
                          <th className="py-2.5 px-4">Chassis Plate</th>
                          <th className="py-2.5 px-4">Registered Owner</th>
                          <th className="py-2.5 px-4">Asset Status</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-sm">
                        {trucks.map(truck => (
                          <tr key={truck.id} className="hover:bg-neutral-50/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-base text-slate-900">{truck.plateNumber}</div>
                              <div className="text-xs text-slate-400 font-medium">{truck.model} ({truck.id})</div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">{truck.ownerName}</td>
                            <td className="py-3 px-4">
                              <select 
                                value={truck.status} 
                                onChange={e => handleUpdateTruckStatus(truck.id, e.target.value as TruckStatus)} 
                                className="text-xs font-bold p-1.5 rounded-md bg-neutral-100 border border-neutral-200 outline-none"
                              >
                                <option value="active">🟢 Active</option>
                                <option value="inActive">⚪ In-Active</option>
                                <option value="under maintenance">🔧 Workshop</option>
                                <option value="accidental">⚠️ Accidental</option>
                              </select>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button onClick={() => handleDeleteTruck(truck.id)} className="text-xs text-rose-600 font-medium px-2.5 py-1.5 rounded-md hover:bg-rose-50 cursor-pointer">
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: DUTY CONTROL TOWER - Fully Responsive */}
            {activeTab === "assign" && (
              <motion.div key="assign-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col lg:flex-row gap-6 lg:gap-8">

                {/* Core Linker Control - Form Section */}
                <div className="lg:w-1/3 space-y-4">
                  <h3 className="font-bold text-base sm:text-lg text-slate-800">Map Operator to Asset</h3>
                  <form onSubmit={handleAssign} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-slate-400">Select Target Truck</label>
                      <select
                        required
                        value={assignment.truckId}
                        onChange={e => setAssignment({ ...assignment, truckId: e.target.value })}
                        className="w-full mt-1 bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none focus:border-sky-500"
                      >
                        <option value="">-- Choose Plate --</option>
                        {trucks.map(t => {
                          const isAssigned = busyTruckIds.includes(t.id);
                          return (
                            <option key={t.id} value={t.id} disabled={isAssigned}>
                              {t.plateNumber} [Owner: {t.ownerName}] {isAssigned ? "[Busy]" : "[Free]"}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-slate-400">Assign Driver Duty</label>
                      <select
                        value={assignment.driverId}
                        onChange={e => setAssignment({ ...assignment, driverId: e.target.value })}
                        className="w-full mt-1 bg-neutral-50 border border-neutral-200 text-sm p-2.5 rounded-lg outline-none focus:border-sky-500"
                      >
                        <option value="">-- Unassigned / Standing Yard --</option>
                        {drivers.filter(d => d.status !== "leaved").map(d => {
                          const isBusy = busyDriverIds.includes(d.id);
                          return (
                            <option key={d.id} value={d.id} disabled={isBusy}>
                              {d.name} ({d.status}) {isBusy ? "[Busy]" : "[Free]"}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <button className="w-full bg-slate-900 text-white font-medium text-sm py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-slate-800">
                      Commit Assignment Lock
                    </button>
                  </form>
                </div>

                {/* Operations Status Board Mapping Display - Responsive Cards */}
                <div className="lg:flex-1">
                  <h3 className="font-bold text-base sm:text-lg text-slate-800 mb-4">Current Active Fleet Pairings</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-125 overflow-y-auto">
                    {trucks.length === 0 ? (
                      <div className="col-span-2 text-center text-slate-400 text-xs py-8">No trucks available</div>
                    ) : (
                      trucks.map(truck => {
                        const pair = assignments.find(a => a.truckId === truck.id);
                        const activeDriver = pair ? drivers.find(d => d.id === pair.driverId) : null;
                        return (
                          <div key={truck.id} className="border border-neutral-200 p-3 sm:p-4 rounded-xl bg-neutral-50/50 flex flex-col justify-between space-y-3 shadow-xs hover:shadow-md transition-shadow">
                            <div>
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="font-mono text-[9px] sm:text-[10px] font-bold text-slate-400 bg-neutral-200/60 px-1.5 py-0.5 rounded">
                                  {truck.id}
                                </span>
                                <span className={`text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded ${truck.status === "active" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : truck.status === "under maintenance" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-neutral-200 text-neutral-700"}`}>
                                  {truck.status}
                                </span>
                              </div>
                              <h4 className="font-mono text-base sm:text-lg font-bold text-slate-900 mt-1">{truck.plateNumber}</h4>
                              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
                                Owner: {truck.ownerName} | Model: {truck.model}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-neutral-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">Assigned Pilot:</span>
                              {activeDriver ? (
                                <div className="text-left sm:text-right w-full sm:w-auto">
                                  <span className="text-[10px] sm:text-xs font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-md inline-block">
                                    {activeDriver.name}
                                  </span>
                                  <div className="text-[8px] sm:text-[9px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
                                    Status: {activeDriver.status}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] sm:text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-md w-full sm:w-auto text-center">
                                  Yard Standing
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
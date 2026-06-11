"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
// --- CLEANUP: Import only toast, container is now global in layout ---
import { toast } from "react-toastify";

interface UnbilledTrip { 
  id: string; 
  date: string; 
  vehicleNumber: string; 
  routeSequence: string; 
  destination: string; 
  driverName: string; 
}

interface Bill {
  id: string;
  tripId: string;
  date: string;
  vehicleNumber: string;
  routeSequence: string;
  destination: string;
  lrNumber: string;
  details: string;
  partyName: string;
  baseFreight: number;
  tollCharges: number; 
  loadingCharges: number; 
  totalAmount: number;
  status: "Pending Invoice" | "Invoiced";
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  clientName: string;
  billsBundled: string[];
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
}

interface SystemSettings {
  companyName: string;
  companyLogoText: string;
  logoImage: string | null;
  billUI: {
    themeColor: string;
    fontStyle: "sans" | "serif" | "mono";
    showGst: boolean;
    showSignature: boolean;
    termsText: string;
    companyAddress: string;
    footerNotes: string;
  };
}

interface GridRowInput {
  trip: UnbilledTrip;
  lrNumber: string;
  weight: string;
  rate: string;
  diten: string;
  advance: string;
}

export default function GenerationsHub() {
  const [activeTabState, setActiveTab] = useState<"trips" | "bills" | "invoices">("trips");
  
  // Application Data arrays
  const [unbilledTrips, setUnbilledTrips] = useState<UnbilledTrip[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic branding configurations
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    companyName: "ROADWAYS LOGISTICS",
    companyLogoText: "CR",
    logoImage: null,
    billUI: {
      themeColor: "#0284c7",
      fontStyle: "sans",
      showGst: true,
      showSignature: true,
      termsText: "1. All disputes are subject to local jurisdiction laws.\n2. Payments must accompany standard freight receipt signatures.",
      companyAddress: "Corporate Fleet Office, Sarkhej-Gandhinagar Highway, Ahmedabad, Gujarat",
      footerNotes: "Thank you for trusting us with your supply chain cargo!"
    }
  });

  // Wizard Step 1 states
  const [batchPartyName, setBatchPartyName] = useState("");
  const [searchTruck, setSearchTruck] = useState("");
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  
  // Wizard Step 2 states
  const [isGridMode, setIsGridMode] = useState(false);
  const [gridRows, setGridRows] = useState<GridRowInput[]>([]);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  // Selection Invoicing Parameters
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [activePrintInvoice, setActivePrintInvoice] = useState<Invoice | null>(null);

  // --- Map showToast wrapper to the global container instance ---
  const showToast = (text: string, type: "success" | "error" | "warning" = "success") => {
    toast[type](text);
  };

  const syncDataState = async () => {
    try {
      const dashboardRes = await fetch("/api/dashboard");
      const dashboardJson = await dashboardRes.json();
      if (dashboardJson.success && dashboardJson.settings) {
        setSystemSettings(dashboardJson.settings);
      }

      const billsRes = await fetch("/api/bills");
      const billsJson = await billsRes.json();
      if (billsJson.success) {
        setBills(billsJson.bills || []);
        setUnbilledTrips(billsJson.unbilledTrips || []);
      }
      const invRes = await fetch("/api/invoices");
      const invJson = await invRes.json();
      if (invJson.success) setInvoices(invJson.invoices || []);
    } catch (err) {
      console.error("Data pipeline load fault:", err);
      showToast("Failed to pull analytical parameters stack from directory streams.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { syncDataState(); }, []);

  const handleToggleTripCheckbox = (id: string) => {
    setSelectedTripIds(prev => prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]);
  };

  const handleProceedToGrid = () => {
    if (!batchPartyName.trim()) {
      showToast("Please specify the Target Company Name before initializing the grid.", "warning");
      return;
    }
    if (selectedTripIds.length === 0) {
      showToast("Please check at least one unbilled trip log to initialize a manifest array.", "warning");
      return;
    }

    const compiledRows: GridRowInput[] = unbilledTrips
      .filter(t => selectedTripIds.includes(t.id))
      .map(t => ({
        trip: t,
        lrNumber: "",
        weight: "",
        rate: "",
        diten: "",
        advance: ""
      }));

    setEditingBillId(null); 
    setGridRows(compiledRows);
    setIsGridMode(true);
    showToast(`Spreadsheet populated with ${compiledRows.length} checked row containers.`, "success");
  };

  const handleGridRowChange = (index: number, fields: Partial<GridRowInput>) => {
    const updated = [...gridRows];
    updated[index] = { ...updated[index], ...fields };
    setGridRows(updated);
  };

  const calculateRowBalance = (row: GridRowInput) => {
    const weight = parseFloat(row.weight) || 0;
    const rate = parseFloat(row.rate) || 0;
    const diten = parseFloat(row.diten) || 0;
    const advance = parseFloat(row.advance) || 0;
    return (weight * rate) + diten - advance;
  };

  const getGridGrandTotal = () => {
    return gridRows.reduce((sum, r) => sum + calculateRowBalance(r), 0);
  };

  const handleSaveBatchLedgerGrid = async () => {
    if (gridRows.some(r => !r.lrNumber.trim())) {
      showToast("LR Slip Number inputs are mandatory for every checked row in the spreadsheet.", "warning");
      return;
    }

    setIsLoading(true);
    try {
      for (const row of gridRows) {
        const weight = parseFloat(row.weight) || 0;
        const rate = parseFloat(row.rate) || 0;
        const freight = weight * rate;
        const diten = parseFloat(row.diten) || 0;
        const advance = parseFloat(row.advance) || 0;
        const total = freight + diten - advance;

        const activeBillId = editingBillId || `BILL-LR-${Math.floor(1000 + Math.random() * 9000)}`;
        const activeAction = editingBillId ? "update" : "create";

        const payload = {
          id: activeBillId,
          tripId: row.trip.id,
          date: row.trip.date,
          vehicleNumber: row.trip.vehicleNumber,
          routeSequence: row.trip.routeSequence,
          destination: row.trip.destination,
          lrNumber: row.lrNumber.trim(),
          details: `Wt: ${weight} MT | Rate: ₹${rate}`,
          partyName: batchPartyName.trim(),
          baseFreight: freight,
          tollCharges: diten,       
          loadingCharges: advance,  
          totalAmount: total,
          status: editingBillId ? (bills.find(b => b.id === editingBillId)?.status || "Pending Invoice") : "Pending Invoice"
        };

        await fetch("/api/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: activeAction, payload })
        });
      }

      showToast(editingBillId ? "Ledger entries updated successfully." : "Batch logs successfully saved.", "success");
      setBatchPartyName("");
      setSelectedTripIds([]);
      setIsGridMode(false);
      setEditingBillId(null);
      setGridRows([]);
      await syncDataState();
      activeTab("bills");
    } catch (err) {
      console.error(err);
      showToast("Data commit pipeline crash execution.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBillSelect = (id: string) => {
    setSelectedBillIds(prev => prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]);
  };

  const processInvoiceCompilation = async () => {
    if (selectedBillIds.length === 0 || !selectedParty) return;
    const matchedBills = bills.filter(b => selectedBillIds.includes(b.id));
    
    const incompleteBills = matchedBills.filter(b => b.totalAmount === 0);
    if (incompleteBills.length > 0) {
      const incompleteLrNumbers = incompleteBills.map(b => b.lrNumber).join(", ");
      showToast(`Invoice compilation blocked! Unpriced rows found on: [ ${incompleteLrNumbers} ]`, "warning");
      return;
    }

    const subtotal = matchedBills.reduce((acc, b) => acc + b.totalAmount, 0);
    const gstAmount = systemSettings.billUI.showGst ? Math.round(subtotal * 0.18) : 0;
    const grandTotal = subtotal + gstAmount;

    const newInvoice: Invoice = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      invoiceNumber: `${systemSettings.companyLogoText || "CHHEDA"}-TS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString().split("T")[0],
      clientName: selectedParty,
      billsBundled: selectedBillIds,
      subtotal,
      gstAmount,
      grandTotal
    };

    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newInvoice)
    });

    if (response.ok) {
      showToast(`Tax Invoice successfully processed and linked.`, "success");
      setSelectedBillIds([]);
      setSelectedParty("");
      await syncDataState();
      activeTab("invoices");
    } else {
      showToast("Server storage reject mapping pipeline.", "error");
    }
  };

  const handleTriggerEdit = (bill: Bill) => {
    setEditingBillId(bill.id); 
    setBatchPartyName(bill.partyName);
    setSelectedTripIds([bill.tripId]);
    
    const mockTrip: UnbilledTrip = {
      id: bill.tripId,
      date: bill.date,
      vehicleNumber: bill.vehicleNumber,
      routeSequence: bill.routeSequence,
      destination: bill.destination,
      driverName: ""
    };

    const matchWt = bill.details.match(/Wt:\s*([\d.]+)/);
    const matchRt = bill.details.match(/Rate:\s*₹([\d.]+)/);
    const weightVal = matchWt ? matchWt[1] : "";
    const rateVal = matchRt ? matchRt[1] : "";

    setGridRows([{
      trip: mockTrip,
      lrNumber: bill.lrNumber,
      weight: weightVal,
      rate: rateVal,
      diten: String(bill.tollCharges),
      advance: String(bill.loadingCharges)
    }]);

    setIsGridMode(true);
    activeTab("trips");
    showToast("Bill loaded onto active entries desk.", "warning");
  };

  const handleDeleteBill = async (id: string) => {
    if (!confirm("Permanently erase this bill entry?")) return;
    const response = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", payload: { id } })
    });
    if (response.ok) {
      showToast("Bill cleared out from local data segments.", "success");
      await syncDataState();
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice? This unlocks all bundled bills.")) return;
    try {
      const response = await fetch(`/api/invoices?id=${invoiceId}`, { method: "DELETE" });
      if (response.ok) {
        showToast("Invoice erased. Tied manifestations returned to pending state.", "success");
        await syncDataState(); 
      }
    } catch (err) {
      console.error(err);
      showToast("Fault detected clearing invoice logs.", "error");
    }
  };

  const unbilledParties = Array.from(new Set(bills.filter(b => b.status === "Pending Invoice").map(b => b.partyName)));
  const filteredUnbilledQueue = unbilledTrips.filter(t => searchTruck ? t.vehicleNumber.toLowerCase().includes(searchTruck.toLowerCase()) : true);

  function activeTab(tab: "trips" | "bills" | "invoices") { setActiveTab(tab); }

  if (isLoading) return <div className="w-full h-screen flex items-center justify-center bg-neutral-100"><div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <main className="w-full min-h-screen bg-neutral-100 text-slate-900 antialiased p-4 md:p-8 print:bg-white print:p-0">
      
      <div className="max-w-7xl mx-auto space-y-6 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Financial Ledger Generation Engine</h1>
          <p className="text-sm text-slate-500 mt-1">Convert daily sheet route executions into calculated operational bills and grouped tax invoices.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-neutral-200/60 p-1 rounded-xl w-full md:w-max gap-1 border border-neutral-200">
          {(["trips", "bills", "invoices"] as const).map(tab => (
            <button key={tab} disabled={isGridMode} onClick={() => activeTab(tab)} className="flex-1 md:flex-initial text-xs font-bold px-5 py-2.5 rounded-lg capitalize transition-all relative cursor-pointer disabled:opacity-50">
              <span className="relative z-10">{tab === "trips" ? `1. Billing Engine (${unbilledTrips.length})` : tab === "bills" ? `2. Pending Bills (${bills.filter(b => b.status === "Pending Invoice").length})` : `3. Final Tax Invoices (${invoices.length})`}</span>
              {activeTabState === tab && <motion.div layoutId="tabIndicatorGlow" className="absolute inset-0 bg-white rounded-lg shadow-sm border border-neutral-200/40" />}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 shadow-md p-6 min-h-[460px]">
          <AnimatePresence mode="wait">

            {/* TAB 1: OPERATIONAL QUEUE WIZARD */}
            {activeTabState === "trips" && (
              <motion.div key="trips-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                
                {!isGridMode ? (
                  /* STEP 1: PARTY SETUP AND CHECKBOX SELECTION */
                  <div className="space-y-6">
                    <div className="border-b border-neutral-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800">Batch Manifest Selection Hub</h3>
                        <p className="text-xs text-slate-400">Specify company name, check matching trip rows, then proceed to the rapid entries spreadsheet.</p>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-sky-50 border border-sky-100 p-2.5 rounded-xl w-full md:w-max">
                        <label className="text-xs font-black uppercase text-sky-800 whitespace-nowrap">Party Name <span className="text-rose-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g., Adani Logistics Group" 
                          value={batchPartyName} 
                          onChange={e => setBatchPartyName(e.target.value)} 
                          className="bg-white border text-xs font-bold p-2 rounded-lg outline-none focus:border-sky-500 w-64 text-slate-800" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-4">
                        <input type="text" placeholder="🔍 Filter unbilled logs by vehicle plate number (e.g., 5399)..." value={searchTruck} onChange={e => setSearchTruck(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 text-sm p-3 rounded-lg outline-none focus:border-sky-500" />
                        
                        <div className="overflow-x-auto max-h-[350px] border rounded-xl bg-white shadow-xs">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b text-slate-400 text-xs font-bold bg-neutral-50/80 uppercase"><th className="py-2.5 px-4 w-12">Select</th><th className="py-2.5 px-4">Date</th><th className="py-2.5 px-4">Truck Number</th><th className="py-2.5 px-4">Calculated Target Run</th></tr>
                            </thead>
                            <tbody className="divide-y text-xs font-medium text-slate-700">
                              {filteredUnbilledQueue.map(trip => (
                                <tr 
                                  key={`${trip.id}-${trip.date}`} 
                                  onClick={() => handleToggleTripCheckbox(trip.id)}
                                  className={`hover:bg-neutral-50/80 transition-colors cursor-pointer ${selectedTripIds.includes(trip.id) ? "bg-sky-50/40" : ""}`}
                                >
                                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                      type="checkbox" 
                                      checked={selectedTripIds.includes(trip.id)} 
                                      onChange={() => handleToggleTripCheckbox(trip.id)} 
                                      className="h-4 w-4 text-sky-600 rounded cursor-pointer" 
                                    />
                                  </td>
                                  <td className="py-3 px-4 text-slate-400">{trip.date}</td>
                                  <td className="py-3 px-4 font-bold text-slate-900">{trip.vehicleNumber}</td>
                                  <td className="py-3 px-4 font-semibold">{trip.routeSequence} <span className="text-slate-400 font-normal">({trip.driverName})</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-neutral-50 p-5 rounded-xl border border-neutral-200 h-max flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Batch Processing Registry</h4>
                          <div className="text-xs bg-white p-3 border rounded-lg space-y-1.5 text-slate-600 font-medium shadow-xs">
                            <div> Carver Target: <strong>Target Client:</strong> {batchPartyName || <span className="text-rose-500 italic">Missing Party*</span>}</div>
                            <div><strong>Trips Checked:</strong> <span className="text-sky-700 font-bold">{selectedTripIds.length} Rows</span></div>
                          </div>
                        </div>

                        <button 
                          type="button" 
                          onClick={handleProceedToGrid}
                          style={{ backgroundColor: systemSettings.billUI.themeColor }}
                          className="w-full text-white font-bold py-3 rounded-xl shadow-md transition-all text-xs hover:brightness-105 cursor-pointer"
                        >
                          Proceed to Multi-Trip Entry →
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STEP 2: EDTIABLE MULTI-TRIP SPREADSHEET LEDGER GRID */
                  <div className="space-y-6">
                    <div className="border-b border-neutral-100 pb-3 flex justify-between items-center bg-neutral-50/60 p-4 rounded-xl border">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{editingBillId ? "Modifying Registered Bill Row" : "Freight Allocation Ledger"}</span>
                        <h2 className="text-xl font-black text-slate-900 mt-0.5">{batchPartyName}</h2>
                      </div>
                      <button type="button" onClick={() => { setIsGridMode(false); setEditingBillId(null); }} className="text-xs font-bold text-slate-500 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors">← Cancel</button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-xs bg-white">
                      <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                          <tr style={{ backgroundColor: `${systemSettings.billUI.themeColor}08` }} className="border-b text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <th className="py-3 px-3 w-40">LR Num <span className="text-rose-500">*</span></th>
                            <th className="py-3 px-3 w-28">Date</th>
                            <th className="py-3 px-3 w-32">Truck Num</th>
                            <th className="py-3 px-3">Destination</th>
                            <th className="py-3 px-3 w-24">Weight (MT)</th>
                            <th className="py-3 px-3 w-28">Rate (₹)</th>
                            <th className="py-3 px-3 w-24">Diten (₹)</th>
                            <th className="py-3 px-3 w-24">Advance (₹)</th>
                            <th className="py-3 px-3 text-right w-36">Net Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs font-semibold text-slate-800">
                          {gridRows.map((row, index) => {
                            const balance = calculateRowBalance(row);
                            return (
                              <tr key={row.trip.id} className="hover:bg-neutral-50/40">
                                <td className="py-2.5 px-3">
                                  <input 
                                    type="text" 
                                    required 
                                    placeholder="Slip Num" 
                                    value={row.lrNumber} 
                                    onChange={e => handleGridRowChange(index, { lrNumber: e.target.value })} 
                                    className="w-full bg-neutral-50 border p-2 rounded-lg font-mono font-bold outline-none focus:bg-white focus:border-sky-500 text-slate-900 border-neutral-300 shadow-inner" 
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 font-medium">{row.trip.date}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{row.trip.vehicleNumber}</td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{row.trip.destination}</td>
                                <td className="py-2.5 px-3">
                                  <input type="number" step="any" placeholder="0.00" value={row.weight} onChange={e => handleGridRowChange(index, { weight: e.target.value })} className="w-full border p-2 rounded-lg outline-none text-slate-900 font-mono text-center" />
                                </td>
                                <td className="py-2.5 px-3">
                                  <input type="number" placeholder="Rate" value={row.rate} onChange={e => handleGridRowChange(index, { rate: e.target.value })} className="w-full border p-2 rounded-lg outline-none text-slate-900 font-mono text-right" />
                                </td>
                                <td className="py-2.5 px-3">
                                  <input type="number" placeholder="0" value={row.diten} onChange={e => handleGridRowChange(index, { diten: e.target.value })} className="w-full border p-2 rounded-lg outline-none text-slate-900 font-mono text-right" />
                                </td>
                                <td className="py-2.5 px-3">
                                  <input type="number" placeholder="0" value={row.advance} onChange={e => handleGridRowChange(index, { advance: e.target.value })} className="w-full border p-2 rounded-lg outline-none text-slate-900 font-mono text-right" />
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950">
                                  ₹ {balance.toLocaleString("en-IN")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 p-5 bg-neutral-900 text-white rounded-xl shadow-lg border border-neutral-800">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 block uppercase tracking-wider">Group Balance Allocation Sum</span>
                        <div className="text-2xl font-black text-white font-mono mt-0.5">₹ {getGridGrandTotal().toLocaleString("en-IN")}</div>
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={handleSaveBatchLedgerGrid}
                        className="bg-sky-500 hover:bg-sky-600 text-white font-black px-6 py-3.5 rounded-xl shadow-md transition-colors text-xs uppercase tracking-wide cursor-pointer"
                      >
                        {editingBillId ? "✓ Save Modification Changes" : "✓ Commit Array Batch to persistent logs"}
                      </button>
                    </div>

                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 2: COMPILED PENDING BILLS MANIFESTS */}
            {activeTabState === "bills" && (
              <motion.div key="bills-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="border-b border-neutral-100 pb-3">
                  <h3 className="font-bold text-lg text-slate-800">Pending Accounts Statement</h3>
                  <p className="text-xs text-slate-400">Select a target client company profile to review matching records and batch a multi-trip GST Tax Invoice spreadsheet.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex gap-2 items-center bg-neutral-50 p-3 rounded-xl border w-max">
                      <label className="text-xs font-bold uppercase text-slate-500 whitespace-nowrap">Group Matrix By Company:</label>
                      <select value={selectedParty} onChange={e => { setSelectedParty(e.target.value); setSelectedBillIds([]); }} className="bg-white border border-neutral-200 p-2 rounded-lg text-xs font-bold text-slate-700 outline-none">
                        <option value="">-- View All Pending Accounts --</option>
                        {unbilledParties.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-200 text-slate-400 text-xs font-bold uppercase bg-neutral-50/80"><th className="py-2.5 px-4 w-12">Select</th><th className="py-2.5 px-4">LR Slip</th><th className="py-2.5 px-4">Vehicle Details</th><th className="py-2.5 px-4">Current Total (₹)</th><th className="py-2.5 px-4">Status</th><th className="py-2.5 px-4 text-right">Operations</th></tr>
                        </thead>
                        <tbody className="divide-y text-xs font-medium text-slate-700">
                          {bills.filter(b => selectedParty ? b.partyName === selectedParty : true).map(bill => (
                            <tr key={bill.id} className="hover:bg-neutral-50/40">
                              <td className="py-3.5 px-4">
                                <input type="checkbox" checked={selectedBillIds.includes(bill.id)} disabled={bill.status === "Invoiced"} onChange={() => handleToggleBillSelect(bill.id)} className="h-4 w-4 text-sky-600 rounded cursor-pointer disabled:opacity-20" />
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{bill.lrNumber}</td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900">{bill.vehicleNumber} <span className="text-slate-400 font-normal">[{bill.partyName}]</span></div>
                                <div className="text-[11px] text-slate-400 truncate max-w-xs">{bill.routeSequence}</div>
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-950">
                                {bill.totalAmount === 0 ? <span className="text-rose-600 font-semibold italic">₹ 0 (Open Rate)</span> : `₹ ${bill.totalAmount.toLocaleString("en-IN")}`}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${bill.status === "Pending Invoice" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800"}`}>{bill.status}</span>
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-2">
                                <button type="button" disabled={bill.status === "Invoiced"} onClick={() => handleTriggerEdit(bill)} className="text-sky-600 disabled:opacity-30 font-bold hover:underline cursor-pointer">Modify</button>
                                <button type="button" disabled={bill.status === "Invoiced"} onClick={() => handleDeleteBill(bill.id)} className="text-rose-600 disabled:opacity-30 font-bold hover:underline cursor-pointer">Erase</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Invoice Compilation Deck Panel */}
                  <div className="bg-neutral-50/80 border border-neutral-200 p-5 rounded-xl h-max space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice Batching Deck</h4>
                    {selectedBillIds.length > 0 ? (
                      <div className="space-y-4 text-xs font-medium">
                        <div className="bg-white p-3 border rounded-xl space-y-1.5 text-slate-500 shadow-xs">
                          <div><strong>Selected Carrier Runs:</strong> {selectedBillIds.length} Bills Bundled</div>
                          <div><strong>Billed Client:</strong> <span className="text-slate-900 font-bold">{selectedParty}</span></div>
                          <div className="pt-2 border-t font-bold text-slate-900 flex justify-between text-sm">
                            <span>Subtotal Base Net:</span>
                            <span>₹ {bills.filter(b => selectedBillIds.includes(b.id)).reduce((a, b) => a + b.totalAmount, 0).toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={processInvoiceCompilation}
                          className="w-full text-white font-bold py-3 rounded-xl cursor-pointer shadow-md transition-colors text-xs hover:brightness-105"
                          style={{ backgroundColor: systemSettings.billUI.themeColor }}
                        >
                          Compile Final GST Invoice ({systemSettings.billUI.showGst ? "18%" : "0%"})
                        </button>
                      </div>
                    ) : <p className="text-center text-slate-400 italic py-6">Check one or more pending bills belonging to an individual cargo account to compile a corporate invoice summary sheet.</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: TAX INVOICES ARCHIVE */}
            {activeTabState === "invoices" && (
              <motion.div key="invoices-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="border-b border-neutral-100 pb-3">
                  <h3 className="font-bold text-lg text-slate-800">Issued Corporate Tax Invoices</h3>
                  <p className="text-xs text-slate-400">Print or view historical compliance structures. Pairs multiple freight runs under unified invoices.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {invoices.length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center col-span-2 py-12 bg-neutral-50 rounded-xl border">No invoices generated inside local repositories yet.</div>
                  ) : invoices.map(inv => (
                    <div key={inv.id} className="border border-neutral-200 p-5 rounded-xl bg-neutral-50/30 flex flex-col justify-between space-y-4 shadow-sm hover:border-neutral-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-[10px] font-bold bg-neutral-200 px-2 py-0.5 rounded text-slate-600">{inv.invoiceNumber}</span>
                          <h4 className="font-bold text-base text-slate-900 mt-2">{inv.clientName}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Tied manifests collection: {inv.billsBundled.length} items • Issued: {inv.date}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button 
                            type="button" 
                            onClick={() => setActivePrintInvoice(inv)} 
                            style={{ backgroundColor: systemSettings.billUI.themeColor }}
                            className="text-xs font-bold text-white px-3 py-2 rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-all text-center"
                          >
                            Launch Print View
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteInvoice(inv.id)} 
                            className="text-[11px] font-bold text-rose-600 hover:underline text-right bg-transparent border-none outline-none cursor-pointer"
                          >
                            Erase Invoice
                          </button>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-neutral-200/60 font-mono font-bold text-slate-800 flex justify-between text-xs items-center">
                        <span>Invoice Grand Total (Inc. GST):</span>
                        <span style={{ color: systemSettings.billUI.themeColor, backgroundColor: `${systemSettings.billUI.themeColor}10`, borderColor: `${systemSettings.billUI.themeColor}20` }} className="text-sm border font-bold px-2.5 py-1 rounded-md">₹ {inv.grandTotal.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* --- PRINT PREVIEW ENGINE HOOKS --- */}
      {activePrintInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex justify-center p-0 md:p-6 backdrop-blur-xs print:fixed print:inset-0 print:bg-white print:p-0 print:z-max print:overflow-hidden">
          <div 
            style={{
              fontFamily: 
                systemSettings.billUI.fontStyle === "serif" ? "Georgia, serif" : 
                systemSettings.billUI.fontStyle === "mono" ? "Courier New, monospace" : "inherit"
            }}
            className="bg-white w-full max-w-4xl h-max p-8 rounded-none md:rounded-xl shadow-2xl space-y-6 text-xs text-slate-800 border print:shadow-none print:border-none print:w-full print:h-full print:p-4"
          >
            
            <div className="flex justify-between items-center border-b pb-4 print:hidden">
              <div className="font-bold text-sm text-slate-700">Tax Invoice Print Engine Canvas</div>
              <div className="space-x-2">
                <button type="button" onClick={() => window.print()} className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">Print / Download as PDF</button>
                <button type="button" onClick={() => setActivePrintInvoice(null)} className="bg-neutral-100 border text-slate-600 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">Close Preview</button>
              </div>
            </div>

            <div className="flex justify-between items-start border-b border-neutral-200 pb-5">
              <div className="flex items-center gap-3">
                {systemSettings.logoImage ? (
                  <div className="h-12 w-12 rounded-xl bg-white border border-neutral-200 overflow-hidden flex items-center justify-center p-0.5 shadow-xs">
                    <img src={systemSettings.logoImage} alt="Brand Logo" className="h-full w-full object-contain" />
                  </div>
                ) : systemSettings.companyLogoText ? (
                  <div 
                    style={{ backgroundColor: systemSettings.billUI.themeColor }}
                    className="h-12 w-12 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-inner transition-colors duration-200"
                  >
                    {systemSettings.companyLogoText}
                  </div>
                ) : null}
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">{systemSettings.companyName}</h2>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm font-medium leading-normal">{systemSettings.billUI.companyAddress}</p>
                </div>
              </div>
              <div className="text-right">
                <h3 style={{ color: systemSettings.billUI.themeColor }} className="text-lg font-black uppercase tracking-wide">Tax Invoice</h3>
                <p className="font-mono text-slate-500 font-bold mt-1 text-[11px]">{activePrintInvoice.invoiceNumber}</p>
                <p className="text-slate-400 text-[10px] mt-0.5">Date Issued: {activePrintInvoice.date}</p>
              </div>
            </div>

            <div className="bg-neutral-50 border p-4 rounded-xl text-[11px] grid grid-cols-2 gap-4 print:bg-transparent">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Billed Client Party:</span>
                <div className="font-black text-slate-900 mt-1 text-sm">{activePrintInvoice.clientName}</div>
                <div className="text-slate-500 font-medium mt-0.5">Corporate Supply Chain Account</div>
              </div>
              <div className="text-right flex flex-col justify-end text-slate-500 font-medium">
                <div><strong>Compliance Status:</strong> {systemSettings.billUI.showGst ? "18% Logistics GST Registered" : "Zero Rated/Exempted Logistics"}</div>
                <div><strong>Payment Terms:</strong> Freight Manifest Signature Due</div>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: `${systemSettings.billUI.themeColor}10` }} className="border-b-2 border-neutral-200 text-slate-500 font-bold text-[10px] uppercase print:bg-neutral-50">
                  <th className="py-2.5 px-3">LR Slip</th>
                  <th className="py-2.5 px-3">Asset Registration</th>
                  <th className="py-2.5 px-3">Description / Route Leg Run</th>
                  <th className="py-2.5 px-3 text-right">Net Freight</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium text-xs">
                {bills.filter(b => activePrintInvoice.billsBundled.includes(b.id)).map(b => (
                  <tr key={b.id} className="text-slate-700">
                    <td className="py-3 px-3 font-mono font-bold text-slate-500">{b.lrNumber}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{b.vehicleNumber}</td>
                    <td className="py-3 px-3 text-slate-500">{b.routeSequence} <span className="text-[10px] italic">({b.details || "General Freight"})</span></td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {b.totalAmount === 0 ? "₹ 0 (Open Rate)" : `₹ ${b.totalAmount.toLocaleString("en-IN")}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="w-72 ml-auto space-y-2 pt-3 border-t-2 border-neutral-200">
              <div className="flex justify-between font-medium text-slate-500">
                <span>Gross Manifests Subtotal:</span>
                <span className="font-mono">₹ {activePrintInvoice.subtotal.toLocaleString("en-IN")}</span>
              </div>
              {systemSettings.billUI.showGst && (
                <div className="flex justify-between font-medium text-slate-400 text-[11px]">
                  <span>Transport GST Sacc (18%):</span>
                  <span className="font-mono">₹ {activePrintInvoice.gstAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div style={{ color: systemSettings.billUI.themeColor }} className="flex justify-between font-black text-sm pt-2 border-t border-dashed">
                <span>Grand Account Total:</span>
                <span className="font-mono">₹ {activePrintInvoice.grandTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-neutral-100 text-[10px] text-slate-400">
              <div className="leading-relaxed whitespace-pre-line text-slate-500">
                <span className="font-bold text-slate-600 uppercase block tracking-wider mb-1">Contract Declarations:</span>
                {systemSettings.billUI.termsText}
              </div>
              
              {systemSettings.billUI.showSignature && (
                <div className="flex flex-col justify-end items-end pr-4">
                  <div className="w-36 border-b text-center border-slate-300 pb-1 text-slate-300 italic font-serif text-xs">
                    {systemSettings.companyName.split(" ")[0]} Seal
                  </div>
                  <div className="font-bold uppercase tracking-wide mt-1 text-[9px]">Authorized Signatory</div>
                </div>
              )}
            </div>

            {systemSettings.billUI.footerNotes && (
              <div className="w-full text-center text-slate-400 text-[10px] pt-4 border-t border-neutral-100 italic">
                {systemSettings.billUI.footerNotes}
              </div>
            )}

          </div>
        </div>
      )}
    </main>
  );
}
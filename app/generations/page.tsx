"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import DownloadToPDF from "../components/DownloadToPDF";

interface UnbilledTrip {
  id: string;
  trip_date_display: string;
  vehicle_number: string;
  route_sequence: string;
  destination: string;
  driver_name: string;
}

interface Bill {
  id: string;
  tripId: string;
  date: string;
  vehicle_number: string;
  route_sequence: string;
  destination: string;
  lr_number: string;
  party_name: string;
  weight: string | number;
  rate: string | number;
  freight: number;
  diten: number;
  advance: number;
  total_extra_charge: number;
  total_amount: number;
  status: "Pending Invoice" | "Invoiced";
  details?: string;
  toll_charges?: number;
  loading_charges?: number;
}

interface Invoice {
  _id: string;
  invoice_number: string;
  date: string;
  client_name: string;
  bills_bundled: string[];
  subtotal: number;
  grand_total: number;
  gst_amount: number;
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
  bank_display_details: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
    branchName: string;
  }
}

interface GridRowInput {
  trip: UnbilledTrip;
  lr_number: string;
  weight: string;
  rate: string;
  freight: string;
  diten: string;
  advance: string;
  destination: string;
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
    },
    bank_display_details: {
      bankName: "Dummy Bank",
      accountHolder: "Dummy Holder",
      accountNumber: "000000000",
      ifscCode: "IFC00000000",
      branchName: "Area of bank"
    }
  });

  // Wizard Step 1 states
  const [batchPartyName, setBatchPartyName] = useState("");
  const [searchTruck, setSearchTruck] = useState("");
  const [searchTruckByDate, setSearchTruckByDate] = useState("");
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);

  // Wizard Step 2 states
  const [isGridMode, setIsGridMode] = useState(false);
  const [gridRows, setGridRows] = useState<GridRowInput[]>([]);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  // Selection Invoicing Parameters
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedInvoiceParty, setSelectedInvoiceParty] = useState(""); // Dedicated Archive Filter Dropdown state
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
        lr_number: "",
        weight: "",
        rate: "",
        freight: "",
        diten: "",
        advance: "",
        destination: t.route_sequence
      }));

    setEditingBillId(null);
    setGridRows(compiledRows);
    setIsGridMode(true);
    showToast(`Spreadsheet populated with ${compiledRows.length} checked row containers.`, "success");
  };

  const handleGridRowChange = (index: number, fields: Partial<GridRowInput>) => {
    const updated = [...gridRows];
    const currentRow = { ...updated[index], ...fields };

    if (fields.weight !== undefined || fields.rate !== undefined) {
      const weight = parseFloat(currentRow.weight) || 0;
      const rate = parseFloat(currentRow.rate) || 0;
      currentRow.freight = Math.round(weight * rate).toString();
    }

    updated[index] = currentRow;
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
    if (gridRows.some(r => !r.lr_number.trim())) {
      showToast("LR Slip Number inputs are mandatory for every checked row in the spreadsheet.", "warning");
      return;
    }

    setIsLoading(true);
    try {
      for (const row of gridRows) {
        const activeBillId = editingBillId || `BILL-LR-${Math.floor(1000 + Math.random() * 9000)}`;
        const activeAction = editingBillId ? "update" : "create";

        const payload = {
          id: activeBillId,
          trip_id: row.trip.id,
          date: row.trip.trip_date_display,
          vehicle_number: row.trip.vehicle_number,
          route_sequence: row.destination,
          destination: (
            row.destination.includes("-")
              ? row.destination.split("-")[1].trim()
              : row.destination.split(" - ")[1]?.trim() || row.destination
          ),
          lr_number: row.lr_number.trim(),
          party_name: batchPartyName.trim(),
          weight: row.weight,
          rate: row.rate,
          freight: Math.round((parseFloat(row.weight) || 0) * (parseFloat(row.rate) || 0)),
          diten: parseFloat(row.diten) || 0,
          advance: parseFloat(row.advance) || 0,
          total_extra_charge: Math.round(parseFloat(row.freight) || 0 + parseFloat(row.diten) || 0 + parseFloat(row.diten) || 0),
          total_amount: calculateRowBalance(row),
          status: editingBillId
            ? (bills.find(b => b.id === editingBillId)?.status || "Pending Invoice")
            : "Pending Invoice"
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

    const incompleteBills = matchedBills.filter(b => b.total_amount === 0);
    if (incompleteBills.length > 0) {
      const incompleteLr_numbers = incompleteBills.map(b => b.lr_number).join(", ");
      showToast(`Invoice compilation blocked! Unpriced rows found on: [ ${incompleteLr_numbers} ]`, "warning");
      return;
    }

    const subtotal = matchedBills.reduce((acc, b) => acc + b.total_amount, 0);
    const gst_amount = systemSettings.billUI.showGst ? Math.round(subtotal * 0.18) : 0;
    const grand_total = subtotal + gst_amount;

    const newInvoice: Invoice = {
      _id: `INV-${Date.now().toString().slice(-4)}`,
      invoice_number: `${systemSettings.companyLogoText || "CHHEDA"}-TS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString().split("T")[0],
      client_name: selectedParty,
      bills_bundled: selectedBillIds,
      subtotal,
      gst_amount,
      grand_total
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
    setBatchPartyName(bill.party_name);
    setSelectedTripIds([bill.tripId]);

    const mockTrip: UnbilledTrip = {
      id: bill.tripId,
      trip_date_display: bill.date,
      vehicle_number: bill.vehicle_number,
      route_sequence: bill.route_sequence,
      destination: bill.destination,
      driver_name: "" 
    };

    setGridRows([{
      trip: mockTrip,
      lr_number: bill.lr_number,
      weight: String(bill.weight),
      rate: String(bill.rate),
      freight: String(bill.freight),
      diten: String(bill.diten),
      advance: String(bill.advance),
      destination: bill.destination
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

  const unbilledParties = Array.from(new Set(bills.filter(b => b.status === "Pending Invoice").map(b => b.party_name)));
  
  // Extract all distinct corporate clients available across historical invoice structures
  const invoicedParties = Array.from(new Set(invoices.map(inv => inv.client_name)));

  const filteredUnbilledQueue = unbilledTrips.filter(t => {
    const truckQuery = searchTruck.toLowerCase();
    const dateQuery = searchTruckByDate;

    const matchesTruck = searchTruck ? t.vehicle_number.toLowerCase().includes(truckQuery) : true;
    const matchesDate = searchTruckByDate ? t.trip_date_display === dateQuery : true;

    return matchesTruck && matchesDate;
  });

  // Filtered array subset for Tab 3 archive canvas mappings
  const filteredInvoicesList = invoices.filter(inv => selectedInvoiceParty ? inv.client_name === selectedInvoiceParty : true);

  function activeTab(tab: "trips" | "bills" | "invoices") { setActiveTab(tab); }

  if (isLoading) return <div className="w-full h-screen flex items-center justify-center bg-neutral-100"><div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <main className="w-full min-h-screen bg-neutral-100 text-slate-900 antialiased p-3 sm:p-4 md:p-6 lg:p-8 print:bg-white print:p-0">

      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Financial Ledger Generation Engine</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Convert daily sheet route executions into calculated operational bills and grouped tax invoices.</p>
        </div>

        {/* Tab Controls - Responsive */}
        <div className="flex flex-wrap bg-neutral-200/60 p-1 rounded-xl gap-1 border border-neutral-200">
          {(["trips", "bills", "invoices"] as const).map(tab => (
            <button
              key={tab}
              disabled={isGridMode}
              onClick={() => activeTab(tab)}
              className="flex-1 sm:flex-initial text-[11px] sm:text-xs font-bold px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg capitalize transition-all relative cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <span className="relative z-10">
                {tab === "trips" ? `1. Billing Engine (${unbilledTrips.length})` :
                  tab === "bills" ? `2. Pending Bills (${bills.filter(b => b.status === "Pending Invoice").length})` :
                    `3. Final Tax Invoices (${invoices.length})`}
              </span>
              {activeTabState === tab && <motion.div layoutId="tabIndicatorGlow" className="absolute inset-0 bg-white rounded-lg shadow-sm border border-neutral-200/40" />}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 shadow-md p-4 sm:p-6 min-h-115">
          <AnimatePresence mode="wait">

            {/* TAB 1: OPERATIONAL QUEUE WIZARD */}
            {activeTabState === "trips" && (
              <motion.div key="trips-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 sm:space-y-6">

                {!isGridMode ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="border-b border-neutral-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                      <div>
                        <h3 className="font-bold text-base sm:text-lg text-slate-800">Batch Manifest Selection Hub</h3>
                        <p className="text-[10px] sm:text-xs text-slate-400">Specify company name, check matching trip rows, then proceed to the rapid entries spreadsheet.</p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-sky-50 border border-sky-100 p-2.5 rounded-xl w-full md:w-max">
                        <label className="text-[10px] sm:text-xs font-black uppercase text-sky-800 whitespace-nowrap">Party Name <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g., Adani Logistics Group"
                          value={batchPartyName}
                          onChange={e => setBatchPartyName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleProceedToGrid(); }}
                          className="bg-white border text-xs font-bold p-2 rounded-lg outline-none focus:border-sky-500 w-full sm:w-64 text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                      <div className="lg:flex-2 space-y-3 sm:space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="text"
                            placeholder="🔍 Plate number (e.g., 5399)..."
                            value={searchTruck}
                            onChange={(e) => setSearchTruck(e.target.value)}
                            className="flex-1 bg-neutral-50 border border-neutral-200 text-xs sm:text-sm p-2.5 sm:p-3 rounded-lg outline-none focus:border-sky-500"
                          />
                          <input
                            type="date"
                            value={searchTruckByDate}
                            onChange={(e) => setSearchTruckByDate(e.target.value)}
                            className="w-full sm:w-48 bg-neutral-50 border border-neutral-200 text-xs sm:text-sm p-2.5 sm:p-3 rounded-lg outline-none focus:border-sky-500 text-slate-600"
                          />
                        </div>

                        {/* Mobile Card View for Trips */}
                        <div className="block md:hidden space-y-3 max-h-100 overflow-y-auto">
                          {filteredUnbilledQueue.map(trip => (
                            <div
                              key={`${trip.id}-${trip.trip_date_display}`}
                              onClick={() => handleToggleTripCheckbox(trip.id)}
                              className={`p-3 border rounded-lg transition-colors cursor-pointer ${selectedTripIds.includes(trip.id) ? "bg-sky-50/40 border-sky-200" : "bg-white border-neutral-200"}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTripIds.includes(trip.id)}
                                  onChange={() => handleToggleTripCheckbox(trip.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4 text-sky-600 rounded cursor-pointer mt-0.5"
                                />
                                <span className="text-[10px] text-slate-400">{trip.trip_date_display}</span>
                              </div>
                              <div className="font-bold text-slate-900 text-sm mb-1">{trip.vehicle_number}</div>
                              <div className="text-xs text-slate-600 ">{trip.route_sequence}</div>
                              <div className="text-[10px] text-slate-400 mt-1">Driver: {trip.driver_name}</div>
                            </div>
                          ))}
                          {filteredUnbilledQueue.length === 0 && <div className="text-center text-slate-400 text-xs py-8">No trips found</div>}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto max-h-87.5 border rounded-xl bg-white shadow-xs">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b text-slate-400 text-xs font-bold bg-neutral-50/80 uppercase">
                                <th className="py-2.5 px-3 sm:px-4 w-12">Select</th>
                                <th className="py-2.5 px-3 sm:px-4">Date</th>
                                <th className="py-2.5 px-3 sm:px-4">Truck Number</th>
                                <th className="py-2.5 px-3 sm:px-4">Calculated Target Run</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y text-xs font-medium text-slate-700">
                              {filteredUnbilledQueue.map(trip => (
                                <tr
                                  key={`${trip.id}-${trip.trip_date_display}`}
                                  onClick={() => handleToggleTripCheckbox(trip.id)}
                                  className={`hover:bg-neutral-50/80 transition-colors cursor-pointer ${selectedTripIds.includes(trip.id) ? "bg-sky-50/40" : ""}`}
                                >
                                  <td className="py-3 px-3 sm:px-4" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={selectedTripIds.includes(trip.id)}
                                      onChange={() => handleToggleTripCheckbox(trip.id)}
                                      className="h-4 w-4 text-sky-600 rounded cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-3 px-3 sm:px-4 text-slate-400">{trip.trip_date_display}</td>
                                  <td className="py-3 px-3 sm:px-4 font-bold text-slate-900">{trip.vehicle_number}</td>
                                  <td className="py-3 px-3 sm:px-4 font-semibold">{trip.route_sequence} <span className="text-slate-400 font-normal">({trip.driver_name})</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="lg:flex-1 bg-neutral-50 p-4 sm:p-5 rounded-xl border border-neutral-200 h-max flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Batch Processing Registry</h4>
                          <div className="text-xs bg-white p-3 border rounded-lg space-y-1.5 text-slate-600 font-medium shadow-xs">
                            <div>Carver Target: <strong>Target Client:</strong> {batchPartyName || <span className="text-rose-500 italic">Missing Party*</span>}</div>
                            <div><strong>Trips Checked:</strong> <span className="text-sky-700 font-bold">{selectedTripIds.length} Rows</span></div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleProceedToGrid}
                          style={{ backgroundColor: systemSettings.billUI.themeColor }}
                          className="w-full text-white font-bold py-2.5 sm:py-3 rounded-xl shadow-md transition-all text-[11px] sm:text-xs hover:brightness-105 cursor-pointer"
                        >
                          Proceed to Multi-Trip Entry →
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STEP 2: EDTIABLE MULTI-TRIP SPREADSHEET LEDGER GRID */
                  <div className="space-y-4 sm:space-y-6">
                    <div className="border-b border-neutral-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-neutral-50/60 p-3 sm:p-4 rounded-xl border gap-3">
                      <div className="w-full sm:w-auto">
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {editingBillId ? "Modifying Registered Bill Row" : "Freight Allocation Ledger"}
                        </span>
                        <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-900 mt-0.5">{batchPartyName}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsGridMode(false); setEditingBillId(null); }}
                        className="text-xs font-bold text-slate-500 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors w-full sm:w-auto"
                      >
                        ← Cancel
                      </button>
                    </div>

                    {/* Mobile Card View for Grid Rows */}
                    <div className="block md:hidden space-y-4 max-h-125 overflow-y-auto">
                      {gridRows.map((row, index) => {
                        const balance = calculateRowBalance(row);
                        return (
                          <div key={row.trip.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-3">
                            <div className="border-b border-neutral-100 pb-2">
                              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">LR Number <span className="text-rose-500">*</span></label>
                              <input
                                type="text"
                                required
                                placeholder="Slip Number"
                                value={row.lr_number}
                                onChange={e => handleGridRowChange(index, { lr_number: e.target.value })}
                                className="w-full bg-neutral-50 border border-neutral-300 p-2 rounded-lg font-mono font-bold outline-none focus:bg-white focus:border-sky-500 text-slate-900 text-sm"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Date</label>
                                <div className="text-slate-400 font-medium text-sm bg-neutral-50 p-2 rounded-lg border border-neutral-200">{row.trip.trip_date_display}</div>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Truck Number</label>
                                <div className="font-mono font-bold text-slate-900 text-sm bg-neutral-50 p-2 rounded-lg border border-neutral-200">{row.trip.vehicle_number}</div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Destination</label>
                              <input
                                type="text"
                                placeholder="Destination"
                                value={row.destination}
                                onChange={e => handleGridRowChange(index, { destination: e.target.value })}
                                className="w-full bg-neutral-50 border border-neutral-300 p-2 rounded-lg outline-none focus:bg-white focus:border-sky-500 text-slate-900 text-sm"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Weight (MT)</label>
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="0.00"
                                  value={row.weight}
                                  onChange={e => handleGridRowChange(index, { weight: e.target.value })}
                                  className="w-full border border-neutral-300 p-2 rounded-lg outline-none text-slate-900 font-mono text-center text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Rate (₹)</label>
                                <input
                                  type="number"
                                  placeholder="Rate"
                                  value={row.rate}
                                  onChange={e => handleGridRowChange(index, { rate: e.target.value })}
                                  className="w-full border border-neutral-300 p-2 rounded-lg outline-none text-slate-900 font-mono text-right text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Freight (₹)</label>
                                <input type="number" value={row.freight} readOnly className="w-full border p-2 rounded-lg outline-none text-slate-500 font-mono text-right text-xs bg-neutral-100" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Diten (₹)</label>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={row.diten}
                                  onChange={e => handleGridRowChange(index, { diten: e.target.value })}
                                  className="w-full border border-neutral-300 p-2 rounded-lg outline-none text-slate-900 font-mono text-right text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Advance (₹)</label>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={row.advance}
                                  onChange={e => handleGridRowChange(index, { advance: e.target.value })}
                                  className="w-full border border-neutral-300 p-2 rounded-lg outline-none text-slate-900 font-mono text-right text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Net Balance</label>
                                <div className="bg-sky-50 border border-sky-200 p-2 rounded-lg font-mono font-black text-slate-950 text-sm text-right">
                                  ₹ {Math.round(balance).toLocaleString("en-IN")}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200 shadow-xs bg-white">
                      <div className="min-w-225 lg:min-w-250">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: `${systemSettings.billUI.themeColor}08` }} className="border-b text-slate-500 text-[10px] lg:text-xs font-bold uppercase tracking-wider">
                              <th className="py-2 lg:py-3 px-2 lg:px-3 w-32 lg:w-40">LR Num <span className="text-rose-500">*</span></th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 w-24 lg:w-28">Date</th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 w-28 lg:w-32">Truck Num</th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 min-w-25">Destination</th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 w-20 lg:w-24">Weight (MT)</th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 w-24 lg:w-28">Rate (₹)</th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 w-24 lg:w-28">Freight (₹)</th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 w-20 lg:w-24">Diten (₹)</th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 w-20 lg:w-24">Advance (₹)</th>
                              <th className="py-2 lg:py-3 px-2 lg:px-3 text-right w-28 lg:w-36">Net Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-xs font-semibold text-slate-800">
                            {gridRows.map((row, index) => {
                              const balance = calculateRowBalance(row);
                              return (
                                <tr key={row.trip.id} className="hover:bg-neutral-50/40">
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3">
                                    <input
                                      type="text"
                                      required
                                      placeholder="Slip Num"
                                      value={row.lr_number}
                                      onChange={e => handleGridRowChange(index, { lr_number: e.target.value })}
                                      className="w-full bg-neutral-50 border p-1.5 lg:p-2 rounded-lg font-mono font-bold outline-none focus:bg-white focus:border-sky-500 text-slate-900 border-neutral-300 shadow-inner text-xs"
                                    />
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3 text-slate-400 font-medium text-[10px] lg:text-xs">{row.trip.trip_date_display}</td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3 font-mono font-bold text-slate-900 text-xs">{row.trip.vehicle_number}</td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3">
                                    <input
                                      type="text"
                                      placeholder="Destination"
                                      value={row.destination}
                                      onChange={e => handleGridRowChange(index, { destination: e.target.value })}
                                      className="w-full bg-neutral-50 border border-neutral-300 p-1.5 lg:p-2 rounded-lg outline-none focus:bg-white focus:border-sky-500 text-slate-900 shadow-inner text-xs"
                                    />
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3">
                                    <input
                                      type="number"
                                      step="any"
                                      placeholder="0.00"
                                      value={row.weight}
                                      onChange={e => handleGridRowChange(index, { weight: e.target.value })}
                                      className="w-full border p-1.5 lg:p-2 rounded-lg outline-none text-slate-900 font-mono text-center text-xs"
                                    />
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3">
                                    <input
                                      type="number"
                                      placeholder="Rate"
                                      value={row.rate}
                                      onChange={e => handleGridRowChange(index, { rate: e.target.value })}
                                      className="w-full border p-1.5 lg:p-2 rounded-lg outline-none text-slate-900 font-mono text-right text-xs"
                                    />
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3">
                                    <input type="number" value={row.freight} readOnly className="w-full border p-2 rounded-lg outline-none text-slate-500 font-mono text-right text-xs bg-neutral-100" />
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3">
                                    <input
                                      type="number"
                                      placeholder="0"
                                      value={row.diten}
                                      onChange={e => handleGridRowChange(index, { diten: e.target.value })}
                                      className="w-full border p-1.5 lg:p-2 rounded-lg outline-none text-slate-900 font-mono text-right text-xs"
                                    />
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3">
                                    <input
                                      type="number"
                                      placeholder="0"
                                      value={row.advance}
                                      onChange={e => handleGridRowChange(index, { advance: e.target.value })}
                                      className="w-full border p-1.5 lg:p-2 rounded-lg outline-none text-slate-900 font-mono text-right text-xs"
                                    />
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-3 text-right font-mono font-black text-slate-950 text-xs">
                                    ₹ {Math.round(balance).toLocaleString("en-IN")}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 bg-neutral-900 text-white rounded-xl shadow-lg border border-neutral-800">
                      <div className="w-full sm:w-auto">
                        <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 block uppercase tracking-wider">Group Balance Allocation Sum</span>
                        <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">₹ {Math.round(getGridGrandTotal()).toLocaleString("en-IN")}</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveBatchLedgerGrid}
                        className="bg-sky-500 hover:bg-sky-600 text-white font-black px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl shadow-md transition-colors text-[10px] sm:text-xs uppercase tracking-wide cursor-pointer w-full sm:w-auto"
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
              <motion.div key="bills-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 sm:space-y-6">
                <div className="border-b border-neutral-100 pb-3">
                  <h3 className="font-bold text-base sm:text-lg text-slate-800">Pending Accounts Statement</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400">Select a target client company profile to review matching records and batch a multi-trip GST Tax Invoice spreadsheet.</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
                  <div className="lg:flex-2 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-neutral-50 p-3 rounded-xl border w-full sm:w-max">
                      <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-500 whitespace-nowrap">Group Matrix By Company:</label>
                      <select value={selectedParty} onChange={e => { setSelectedParty(e.target.value); setSelectedBillIds([]); }} className="bg-white border border-neutral-200 p-2 rounded-lg text-xs font-bold text-slate-700 outline-none w-full sm:w-auto">
                        <option value="">-- View All Pending Accounts --</option>
                        {unbilledParties.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    {/* Mobile Card View for Bills */}
                    <div className="block lg:hidden space-y-3 max-h-125 overflow-y-auto">
                      {bills.filter(b => selectedParty ? b.party_name === selectedParty : true).map(bill => (
                        <div
                          key={bill.id}
                          onClick={() => bill.status !== "Invoiced" && handleToggleBillSelect(bill.id)}
                          className={`border rounded-lg p-3 space-y-2 bg-white transition-colors ${selectedBillIds.includes(bill.id) ? "border-sky-500 bg-sky-50" : "border-neutral-200"}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {bill.status === "Invoiced" ? (
                                <input type="checkbox" checked={true} disabled={true} className="h-4 w-4 text-emerald-600 rounded cursor-not-allowed opacity-100" />
                              ) : (
                                <input type="checkbox" checked={selectedBillIds.includes(bill.id)} onChange={() => handleToggleBillSelect(bill.id)} className="h-4 w-4 text-sky-600 rounded cursor-pointer" />
                              )}
                              <span className="font-mono font-bold text-slate-500 text-xs">{bill.lr_number}</span>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${bill.status === "Pending Invoice" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{bill.status}</span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{bill.vehicle_number}</div>
                            <div className="text-[10px] text-slate-400">[{bill.party_name}]</div>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{bill.route_sequence}</div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="font-mono font-bold text-slate-950 text-xs">
                              {bill.total_amount === 0 ? <span className="text-rose-600 italic">₹ 0 (Open Rate)</span> : `₹ ${bill.total_amount.toLocaleString("en-IN")}`}
                            </span>
                            <div className="space-x-2">
                              <button type="button" disabled={bill.status === "Invoiced"} onClick={() => handleTriggerEdit(bill)} className="text-[10px] text-sky-600 disabled:opacity-30 font-bold hover:underline">Modify</button>
                              <button type="button" disabled={bill.status === "Invoiced"} onClick={() => handleDeleteBill(bill.id)} className="text-[10px] text-rose-600 disabled:opacity-30 font-bold hover:underline">Erase</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {bills.filter(b => selectedParty ? b.party_name === selectedParty : true).length === 0 && <div className="text-center text-slate-400 text-xs py-8">No bills found</div>}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-200 text-slate-400 text-[10px] sm:text-xs font-bold uppercase bg-neutral-50/80">
                            <th className="py-2.5 px-3 sm:px-4 w-12">Select</th>
                            <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">LR Slip</th>
                            <th className="py-2.5 px-3 sm:px-4">Vehicle Details</th>
                            <th className="py-2.5 px-3 sm:px-4">Current Total (₹)</th>
                            <th className="py-2.5 px-3 sm:px-4">Status</th>
                            <th className="py-2.5 px-3 sm:px-4 text-right">Operations</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs font-medium text-slate-700">
                          {bills.filter(b => selectedParty ? b.party_name === selectedParty : true).map(bill => (
                            <tr key={bill.id} onClick={() => bill.status !== "Invoiced" && handleToggleBillSelect(bill.id)} className="hover:bg-neutral-50/40 cursor-pointer">
                              <td className="py-3.5 px-3 sm:px-4">
                                {bill.status === "Invoiced" ? (
                                  <input type="checkbox" checked={true} disabled={true} className="h-4 w-4 text-emerald-600 rounded cursor-not-allowed opacity-100" />
                                ) : (
                                  <input type="checkbox" checked={selectedBillIds.includes(bill.id)} onChange={() => handleToggleBillSelect(bill.id)} className="h-4 w-4 text-sky-600 rounded cursor-pointer" />
                                )}
                              </td>
                              <td className="py-3.5 px-3 sm:px-4 font-mono font-bold text-slate-500 text-xs whitespace-nowrap">{bill.lr_number}</td>
                              <td className="py-3.5 px-3 sm:px-4">
                                <div className="font-bold text-slate-900 text-xs sm:text-sm">{bill.vehicle_number} <span className="text-slate-400 font-normal text-[10px] sm:text-xs">[{bill.party_name}]</span></div>
                                <div className="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-xs">{bill.route_sequence}</div>
                              </td>
                              <td className="py-3.5 px-3 sm:px-4 font-mono font-bold text-slate-950 text-xs sm:text-sm">
                                {bill.total_amount === 0 ? <span className="text-rose-600 font-semibold italic">₹ 0 (Open Rate)</span> : `₹ ${bill.total_amount.toLocaleString("en-IN")}`}
                              </td>
                              <td className="py-3.5 px-3 sm:px-4">
                                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded ${bill.status === "Pending Invoice" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800"}`}>{bill.status}</span>
                              </td>
                              <td className="py-3.5 px-3 sm:px-4 text-right space-x-2 whitespace-nowrap">
                                <button type="button" disabled={bill.status === "Invoiced"} onClick={() => handleTriggerEdit(bill)} className="text-[10px] sm:text-xs text-sky-600 disabled:opacity-30 font-bold hover:underline cursor-pointer">Modify</button>
                                <button type="button" disabled={bill.status === "Invoiced"} onClick={() => handleDeleteBill(bill.id)} className="text-[10px] sm:text-xs text-rose-600 disabled:opacity-30 font-bold hover:underline cursor-pointer">Erase</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="lg:flex-1 bg-neutral-50/80 border border-neutral-200 p-4 sm:p-5 rounded-xl h-max space-y-4">
                    <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Invoice Batching Deck</h4>
                    {selectedBillIds.length > 0 ? (
                      <div className="space-y-3 sm:space-y-4 text-xs font-medium">
                        <div className="bg-white p-3 border rounded-xl space-y-1.5 text-slate-500 shadow-xs">
                          <div><strong>Selected Carrier Runs:</strong> {selectedBillIds.length} Bills Bundled</div>
                          <div><strong>Billed Client:</strong> <span className="text-slate-900 font-bold">{selectedParty}</span></div>
                          <div className="pt-2 border-t font-bold text-slate-900 flex justify-between text-xs sm:text-sm">
                            <span>Subtotal Base Net:</span>
                            <span>₹ {bills.filter(b => selectedBillIds.includes(b.id)).reduce((a, b) => a + b.total_amount, 0).toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={processInvoiceCompilation}
                          className="w-full text-white font-bold py-2.5 sm:py-3 rounded-xl cursor-pointer shadow-md transition-colors text-[10px] sm:text-xs hover:brightness-105"
                          style={{ backgroundColor: systemSettings.billUI.themeColor }}
                        >
                          Compile Final GST Invoice ({systemSettings.billUI.showGst ? "18%" : "0%"})
                        </button>
                      </div>
                    ) : (
                      <p className="text-center text-slate-400 italic py-6 text-xs">Check one or more pending bills belonging to an individual cargo account to compile a corporate invoice summary sheet.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: TAX INVOICES ARCHIVE */}
            {activeTabState === "invoices" && (
              <motion.div key="invoices-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="border-b border-neutral-100 pb-3">
                  <h3 className="font-bold text-base sm:text-lg text-slate-800">Issued Corporate Tax Invoices</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400">Print or view historical compliance structures. Pairs multiple freight runs under unified invoices.</p>
                </div>

                {/* Newly Added Company Dropdown Filter Matrix */}
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-neutral-50 p-3 rounded-xl border w-full sm:w-max mb-2">
                  <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-500 whitespace-nowrap">Filter Invoices By Company:</label>
                  <select 
                    value={selectedInvoiceParty} 
                    onChange={e => setSelectedInvoiceParty(e.target.value)} 
                    className="bg-white border border-neutral-200 p-2 rounded-lg text-xs font-bold text-slate-700 outline-none w-full sm:w-auto"
                  >
                    <option value="">-- View All Corporate Invoices --</option>
                    {invoicedParties.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {filteredInvoicesList.length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center col-span-2 py-12 bg-neutral-50 rounded-xl border">
                      {selectedInvoiceParty ? `No generated invoices found for "${selectedInvoiceParty}".` : "No invoices generated inside local repositories yet."}
                    </div>
                  ) : filteredInvoicesList.map(inv => (
                    <div key={inv._id} className="border border-neutral-200 p-4 sm:p-5 rounded-xl bg-neutral-50/30 flex flex-col justify-between space-y-3 sm:space-y-4 shadow-sm hover:border-neutral-300 transition-colors">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <span className="font-mono text-[9px] sm:text-[10px] font-bold bg-neutral-200 px-2 py-0.5 rounded text-slate-600">{inv.invoice_number}</span>
                          <h4 className="font-bold text-sm sm:text-base text-slate-900 mt-2">{inv.client_name || "Client"}</h4>
                          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Tied manifests: {inv.bills_bundled.length} items • Issued: {inv.date}</p>
                        </div>
                        <div className="flex lg:flex-col w-full md:w-fit justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setActivePrintInvoice(inv)}
                            style={{ backgroundColor: systemSettings.billUI.themeColor }}
                            className="text-[10px] sm:text-xs font-bold text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-all text-center"
                          >
                            Launch Print View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.invoice_number)}
                            className="text-[10px] lg:text-[12px] font-bold text-rose-600 hover:underline text-right bg-transparent border-none outline-none cursor-pointer"
                          >
                            Erase Invoice
                          </button>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-neutral-200/60 font-mono font-bold text-slate-800 flex justify-between text-[10px] sm:text-xs items-center flex-wrap gap-2">
                        <span>Invoice Grand Total (Inc. GST):</span>
                        <span style={{ color: systemSettings.billUI.themeColor, backgroundColor: `${systemSettings.billUI.themeColor}10`, borderColor: `${systemSettings.billUI.themeColor}20` }} className="text-xs sm:text-sm border font-bold px-2 py-0.5 sm:py-1 rounded-md">
                          ₹ {Math.round(inv.grand_total).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* --- PRINT PREVIEW ENGINE HOOKS - Responsive Print Modal --- */}
      {
        activePrintInvoice && (
          <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex justify-center p-3 sm:p-0 md:p-6 backdrop-blur-xs print:fixed print:inset-0 print:bg-white print:p-0 print:z-9999 print:overflow-visible">
            <div
              style={{
                fontFamily:
                  systemSettings.billUI.fontStyle === "serif" ? "Georgia, serif" :
                    systemSettings.billUI.fontStyle === "mono" ? "Courier New, monospace" : "inherit"
              }}
              className="bg-white w-full max-w-4xl h-max p-4 sm:p-6 md:p-8 rounded-none sm:rounded-xl shadow-2xl space-y-6 text-xs text-slate-800 border print:shadow-none print:border-none print:w-full print:h-auto print:p-4 print:overflow-visible"
            >

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b pb-4 print:hidden">
                <div className="font-bold text-sm text-slate-700">Tax Invoice Print Engine Canvas</div>
                <div className="flex gap-2">
                  <DownloadToPDF
                    fileName={`OptimaFlow|${activePrintInvoice.client_name} - Invoice_${activePrintInvoice.invoice_number}.pdf`}
                    buttonText="Download PDF Directly"
                    active={activePrintInvoice}
                    billsData={bills.filter(b => activePrintInvoice.bills_bundled.includes(b.id))}
                    systemSettings={systemSettings}
                    className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                  />
                  <button type="button" onClick={() => setActivePrintInvoice(null)} className="bg-neutral-100 border text-slate-600 text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg cursor-pointer">Close Preview</button>
                </div>
              </div>

              <div id="invoice-print-canvas" className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-neutral-200 pb-4 sm:pb-5">
                <div className="flex items-center gap-3">
                  {systemSettings.logoImage ? (
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white border border-neutral-200 overflow-hidden flex items-center justify-center p-0.5 shadow-xs">
                      <img src={systemSettings.logoImage} alt="Brand Logo" className="h-full w-full object-contain" />
                    </div>
                  ) : systemSettings.companyLogoText ? (
                    <div
                      style={{ backgroundColor: systemSettings.billUI.themeColor }}
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-inner"
                    >
                      {systemSettings.companyLogoText}
                    </div>
                  ) : null}
                  <div>
                    <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight uppercase">{systemSettings.companyName}</h2>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1 max-w-xs sm:max-w-sm font-medium leading-normal">{systemSettings.billUI.companyAddress}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                  <h3 style={{ color: systemSettings.billUI.themeColor }} className="text-base sm:text-lg font-black uppercase tracking-wide">Tax Invoice</h3>
                  <p className="font-mono text-slate-500 font-bold mt-1 text-[10px] sm:text-[11px]">{activePrintInvoice.invoice_number}</p>
                  <p className="text-slate-400 text-[9px] sm:text-[10px] mt-0.5">Date Issued: {activePrintInvoice.date}</p>
                </div>
              </div>

              <div className="bg-neutral-50 border p-3 sm:p-4 rounded-xl text-[10px] sm:text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 print:bg-transparent">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block">Billed Client Party:</span>
                  <div className="font-black text-slate-900 mt-1 text-sm sm:text-base">{activePrintInvoice.client_name}</div>
                  <div className="text-slate-500 font-medium mt-0.5 text-[10px]">Corporate Supply Chain Account</div>
                </div>
                <div className="sm:text-right">
                  <div className="text-slate-500 font-medium text-[10px]"><strong>Compliance Status:</strong> {systemSettings.billUI.showGst ? "18% Logistics GST Registered" : "Zero Rated/Exempted Logistics"}</div>
                  <div className="text-slate-500 font-medium text-[10px] mt-1"><strong>Payment Terms:</strong> Freight Manifest Signature Due</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-200">
                  <thead>
                    <tr style={{ backgroundColor: `${systemSettings.billUI.themeColor}10` }} className="border-b-2 border-neutral-200 text-slate-500 font-bold text-[9px] uppercase">
                      <th className="py-3 px-3">LR Slip</th>
                      <th className="py-3 px-3">Asset</th>
                      <th className="py-3 px-3">Route / Destination</th>
                      <th className="py-3 px-3 text-right">Weight (T)</th>
                      <th className="py-3 px-3 text-right">Rate</th>
                      <th className="py-3 px-3 text-right">Freight</th>
                      <th className="py-3 px-3 text-right">Detention</th>
                      <th className="py-3 px-3 text-right">Advance (-)</th>
                      <th className="py-3 px-3 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-xs">
                    {bills.filter(b => activePrintInvoice.bills_bundled.includes(b.id)).map(b => (
                      <tr key={b.id} className="text-slate-700 hover:bg-neutral-50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-500">{b.lr_number}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{b.vehicle_number}</td>
                        <td className="py-3 px-3">
                          <div>{b.route_sequence}</div>
                          <div className="text-[10px] text-slate-400 font-normal">To: {b.destination}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">{b.weight || 0}</td>
                        <td className="py-3 px-3 text-right font-mono">{b.rate.toLocaleString("en-IN")}</td>
                        <td className="py-3 px-3 text-right font-mono">{b.freight > 0 ? b.freight.toLocaleString("en-IN") : "-"}</td>
                        <td className="py-3 px-3 text-right font-mono text-amber-600">{b.diten > 0 ? b.diten.toLocaleString("en-IN") : "-"}</td>
                        <td className="py-3 px-3 text-right font-mono text-rose-600">
                          {b.advance > 0 ? `₹ ${b.advance.toLocaleString("en-IN")}` : "-"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹ {Math.round(b.total_amount).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="w-full sm:w-72 ml-auto space-y-2 pt-3 border-t-2 border-neutral-200">
                <div className="flex justify-between font-medium text-slate-500 text-[10px] sm:text-xs">
                  <span>Gross Manifests Subtotal:</span>
                  <span className="font-mono">₹ {Math.round(activePrintInvoice.subtotal).toLocaleString("en-IN")}</span>
                </div>
                {systemSettings.billUI.showGst && (
                  <div className="flex justify-between font-medium text-slate-400 text-[10px] sm:text-[11px]">
                    <span>Transport GST Sacc (18%):</span>
                    <span className="font-mono">₹ {activePrintInvoice.gst_amount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div style={{ color: systemSettings.billUI.themeColor }} className="flex justify-between font-black text-sm sm:text-base pt-2 border-t border-dashed">
                  <span>Grand Account Total:</span>
                  <span className="font-mono">₹ {Math.round(activePrintInvoice.grand_total).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-200">
                <div className="bg-neutral-50 rounded-xl p-4 sm:p-5 border border-neutral-100 flex flex-col sm:flex-row gap-6">
                  <div className="flex-1 space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Payment Settlement Details</span>
                    <p className="font-bold text-slate-800 text-sm sm:text-base tracking-tight">{systemSettings.bank_display_details.bankName || "Bank Name"}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Account Holder: {systemSettings.bank_display_details.accountHolder || "-"}</p>
                  </div>

                  <div className="flex flex-col sm:items-end justify-center gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">A/c No:</span>
                      <span className="font-mono font-bold text-slate-900">{systemSettings.bank_display_details.accountNumber || "0000 0000 0000"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">IFSC:</span>
                      <span className="font-mono font-bold text-slate-900">{systemSettings.bank_display_details.ifscCode || "IFSC0000000"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 pt-6 sm:pt-8 border-t border-neutral-100 text-[9px] sm:text-[10px] text-slate-400">
                <div className="leading-relaxed whitespace-pre-line text-slate-500">
                  <span className="font-bold text-slate-600 uppercase block tracking-wider mb-1">Contract Declarations:</span>
                  {systemSettings.billUI.termsText}
                </div>

                {systemSettings.billUI.showSignature && (
                  <div className="flex flex-col justify-end items-start sm:items-end pr-0 sm:pr-4 mt-4 sm:mt-0">
                    <div className="w-32 sm:w-36 border-b text-center border-slate-300 pb-1 text-slate-300 italic font-serif text-xs">
                      {systemSettings.companyName.split(" ")[0]} Seal
                    </div>
                    <div className="font-bold uppercase tracking-wide mt-1 text-[8px] sm:text-[9px]">Authorized Signatory</div>
                  </div>
                )}
              </div>

              {systemSettings.billUI.footerNotes && (
                <div className="w-full text-center text-slate-400 text-[9px] sm:text-[10px] pt-4 border-t border-neutral-100 italic">
                  {systemSettings.billUI.footerNotes}
                </div>
              )}

            </div>
          </div>
        )
      }
    </main >
  );
}
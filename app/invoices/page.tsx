"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [bills, setBills] = useState<any[]>([]);
    const [unbilledTrips, setUnbilledTrips] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            fetch("/api/invoices").then((res) => res.json()),
            fetch("/api/bills").then((res) => res.json()),
        ]).then(([invData, billData]) => {
            setInvoices(invData.invoices || []);
            setBills(billData.bills || []);
            setUnbilledTrips(billData.unbilledTrips || []);
        });
    }, []);

    const updatePayment = async (invoice_number: string, status: string) => {
        setInvoices(prev => prev.map(inv => inv.invoice_number === invoice_number ? { ...inv, payment_status: status } : inv));
        await fetch("/api/invoices", {
            method: "PATCH",
            body: JSON.stringify({ invoice_number, payment_status: status }),
            headers: { "Content-Type": "application/json" },
        });
    };

    const totalRevenue = invoices.reduce((acc, i) => acc + (i.grand_total || 0), 0);
    const pendingBills = bills.filter((b) => b.status === "Pending Invoice");
    const clientGroups = Array.from(new Set(invoices.map((i) => i.client_name))).map((name) => ({
        name,
        invoices: invoices.filter((i) => i.client_name === name),
        pending: invoices.filter((i) => i.client_name === name && i.payment_status !== "Paid")
            .reduce((a, b) => a + (b.grand_total || 0), 0),
    }));

    return (
        <div className="p-4 md:p-8 w-full max-w-7xl mx-auto bg-neutral-50 min-h-screen">
            <AnimatePresence mode="wait">
                {!selectedClient ? (
                    /* --- DASHBOARD VIEW --- */
                    <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="mb-8 border-b pb-6">
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Billing & Collections</h1>
                            <p className="text-slate-500 font-medium mt-1 text-sm">
                                ₹{totalRevenue.toLocaleString("en-IN")} Revenue | {invoices.length} Invoices | {unbilledTrips.length} Trips Due
                            </p>
                        </div>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <MetricCard label="Revenue" val={`₹${(totalRevenue / 100000).toFixed(2)}L`} color="bg-sky-600" />
                            <MetricCard label="Invoices" val={invoices.length} color="bg-slate-800" />
                            <MetricCard label="Bills" val={bills.length} color="bg-slate-800" />
                            <MetricCard label="Clients" val={clientGroups.length} color="bg-slate-800" />
                        </div>

                        {/* Action Required */}
                        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8">
                            <h3 className="font-black text-amber-900 mb-3 uppercase text-xs">⚠ Action Required</h3>
                            <ul className="text-amber-800 font-bold text-sm space-y-1">
                                <li>• {pendingBills.length} Bills pending invoice generation</li>
                                <li>• {unbilledTrips.length} Unbilled trips awaiting logs</li>
                            </ul>
                        </div>

                        {/* Revenue Leaderboard */}
                        <h2 className="text-xl font-black mb-4">Revenue Leaderboard</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {clientGroups.map((group) => (
                                <motion.div key={group.name} whileHover={{ y: -5 }} onClick={() => setSelectedClient(group.name)} className="bg-white p-6 rounded-2xl border shadow-sm cursor-pointer hover:border-sky-500 transition-all">
                                    <h4 className="font-black text-lg truncate">{group.name}</h4>
                                    <p className="text-slate-400 font-bold text-[10px] uppercase mt-1 mb-4">{group.invoices.length} Invoices</p>
                                    <div className="text-xl font-mono font-black">₹{formatCurrency(group.pending)}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    /* --- CLIENT DETAIL VIEW --- */
                    <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <button onClick={() => setSelectedClient(null)} className="mb-6 font-bold text-sky-600 hover:underline">← Back to Overview</button>
                        <h1 className="text-2xl md:text-3xl font-black mb-8">{selectedClient} - Invoice Portfolio</h1>

                        <div className="space-y-8">
                            {invoices.filter(i => i.client_name === selectedClient).map(inv => {
                                const associatedBills = bills.filter(b => inv.bills_bundled.includes(b.id));

                                return (
                                    <div key={inv.invoice_number} className="bg-white p-4 md:p-6 rounded-2xl border shadow-sm">
                                        {/* Invoice Header */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start mb-6 border-b pb-4 gap-4">
                                            <div>
                                                <h3 className="font-black text-slate-900">{inv.invoice_number}</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{inv.date}</p>
                                            </div>
                                            <div className="text-left sm:text-right">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Grand Total</p>
                                                <h4 className="font-black text-xl text-sky-700">₹{formatCurrency(inv.grand_total)}</h4>
                                            </div>
                                        </div>

                                        {/* Desktop Table */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-slate-400 uppercase text-left border-b">
                                                        <th className="pb-3">LR #</th>
                                                        <th className="pb-3 text-right">Weight</th>
                                                        <th className="pb-3 text-right">Rate</th>
                                                        <th className="pb-3 text-right">Freight</th>
                                                        <th className="pb-3 text-right text-amber-600">Diten</th>
                                                        <th className="pb-3 text-right text-rose-600">Advance</th>
                                                        <th className="pb-3 text-right">Net</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {associatedBills.map(b => (
                                                        <tr key={b.id} className="hover:bg-neutral-50">
                                                            <td className="py-3 font-mono font-bold">{b.lr_number}</td>
                                                            <td className="py-3 text-right font-mono">{b.weight || 0}</td>
                                                            <td className="py-3 text-right font-mono">₹{b.rate || 0}</td>
                                                            <td className="py-3 text-right font-mono">₹{formatCurrency(b.freight)}</td>
                                                            <td className="py-3 text-right font-mono text-amber-600">{b.diten || "-"}</td>
                                                            <td className="py-3 text-right font-mono text-rose-600">{b.advance || "-"}</td>
                                                            <td className="py-3 text-right font-mono font-bold">₹{formatCurrency(b.total_amount)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Card View (Optimized for 6 data points) */}
                                        <div className="md:hidden space-y-3">
                                            {associatedBills.map(b => (
                                                <div key={b.id} className="bg-neutral-50 p-3 rounded-xl border space-y-2">
                                                    <div className="flex justify-between font-black text-sm border-b pb-1">
                                                        <span>LR #{b.lr_number}</span>
                                                        <span className="text-sky-700">₹{formatCurrency(b.total_amount)}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                                                        <div className="bg-white p-1 rounded border"><span className="text-slate-400 block uppercase">Wt</span>{b.weight || 0}</div>
                                                        <div className="bg-white p-1 rounded border"><span className="text-slate-400 block uppercase">Rate</span>₹{b.rate || 0}</div>
                                                        <div className="bg-white p-1 rounded border"><span className="text-slate-400 block uppercase">Fr</span>₹{b.freight}</div>
                                                        <div className="bg-white p-1 rounded border text-amber-600"><span className="block uppercase">Diten</span>{b.diten || "-"}</div>
                                                        <div className="bg-white p-1 rounded border text-rose-600"><span className="block uppercase">Adv</span>{b.advance || "-"}</div>
                                                        <div className="bg-sky-50 p-1 rounded border"><span className="text-sky-700 block uppercase">Net</span>₹{b.total_amount}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Footer Financials */}
                                        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-[10px] md:text-xs font-bold bg-neutral-50 p-4 rounded-xl">
                                            <div>Subtotal: <span className="text-slate-900">₹{formatCurrency(inv.subtotal)}</span></div>
                                            <div>GST: <span className="text-slate-900">₹{formatCurrency(inv.gst_amount)}</span></div>
                                            <div className="text-right">Total: <span className="text-sky-700">₹{formatCurrency(inv.grand_total)}</span></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Client Grand Total Footer */}
                        <div className="mt-8 p-6 bg-slate-900 text-white rounded-2xl shadow-xl flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Outstanding for {selectedClient}</p>
                                <h2 className="text-3xl font-black">
                                    ₹ {formatCurrency(
                                        invoices
                                            .filter(i => i.client_name === selectedClient)
                                            .reduce((a, b) => a + (b.grand_total || 0), 0)
                                    )}
                                </h2>
                            </div>
                            <div className="text-right text-[10px] font-medium text-slate-400">
                                Includes all bundled invoices and applicable GST.
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function MetricCard({ label, val, color = "bg-slate-800" }: any) {
    return (
        <div className={`${color} text-white p-6 rounded-2xl shadow-sm`}>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{label}</p>
            <h3 className="text-2xl font-black mt-2">{val}</h3>
        </div>
    );
}

const formatCurrency = (num: number) => {
    // 1. Round to the nearest whole number based on the .5 rule
    const rounded = Math.floor(num + 0.5); 
    
    // 2. Format to always show 2 decimal places
    return rounded.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};
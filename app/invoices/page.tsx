"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

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

    const pendingBills = bills.filter((b) => b.status === "Pending Invoice");
    const totalRevenue = invoices.reduce((acc, i) => acc + i.grand_total, 0);

    return (
        <div className="p-4 md:p-8 w-full mx-auto bg-neutral-50 min-h-screen">
            <AnimatePresence mode="wait">
                {!selectedClient ? (
                    // --- DASHBOARD VIEW ---
                    <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="mb-8 border-b pb-6">
                            <h1 className="text-3xl font-black text-slate-900">Billing & Collections</h1>
                            <p className="text-slate-500 font-medium mt-1">
                                ₹{totalRevenue.toLocaleString()} Revenue | {invoices.length} Invoices | {unbilledTrips.length} Trips Due
                            </p>
                        </motion.div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {[
                                { label: "Revenue", val: `₹${(totalRevenue / 100000).toFixed(2)}L` },
                                { label: "Invoices", val: invoices.length, path: "/generations" },
                                { label: "Bills", val: bills.length, path: "/generations" },
                                { label: "Clients", val: new Set(invoices.map((i) => i.client_name)).size },
                            ].map((stat) => {
                                // Determine if the card is clickable
                                const isClickable = !!stat.path;

                                // Base classes for the card
                                const cardClasses = "bg-slate-800 text-white p-6 rounded-2xl shadow-sm transition-transform hover:scale-[1.02]";

                                const cardContent = (
                                    <>
                                        <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                                        <h3 className="text-2xl font-black mt-2">{stat.val}</h3>
                                    </>
                                );

                                return isClickable ? (
                                    <Link key={stat.label} href={stat.path} className={cardClasses}>
                                        {cardContent}
                                    </Link>
                                ) : (
                                    <div key={stat.label} className={cardClasses}>
                                        {cardContent}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8">
                            <h3 className="font-black text-amber-900 mb-3 uppercase text-sm">⚠ Action Required</h3>
                            <ul className="text-amber-800 font-bold text-sm space-y-1">
                                <li>• {pendingBills.length} Bills pending invoice generation</li>
                                <li>• {unbilledTrips.length} Unbilled trips awaiting logs</li>
                            </ul>
                        </div>

                        <h2 className="text-xl font-black mb-4">Revenue Leaderboard</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Array.from(new Set(invoices.map((i) => i.client_name))).map((client) => {
                                const clientInvoices = invoices.filter((i) => i.client_name === client);
                                const total = clientInvoices.reduce((a, b) => a + b.grand_total, 0);
                                return (
                                    <motion.div key={client} whileHover={{ y: -5 }} onClick={() => setSelectedClient(client)} className="bg-white p-6 rounded-2xl border shadow-sm cursor-pointer hover:border-sky-500">
                                        <h4 className="font-black text-lg truncate">{client}</h4>
                                        <p className="text-slate-400 font-bold text-xs uppercase mt-1 mb-4">{clientInvoices.length} Invoices</p>
                                        <div className="text-xl font-mono font-black">₹{total.toLocaleString()}</div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                ) : (
                    /* --- CLIENT DETAIL VIEW --- */
                    <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <button onClick={() => setSelectedClient(null)} className="mb-6 font-bold text-sky-600 hover:underline">← Back to Overview</button>
                        <h1 className="text-3xl font-black mb-8">{selectedClient} - Invoice Portfolio</h1>

                        <div className="space-y-8">
                            {invoices.filter(i => i.client_name === selectedClient).map(inv => {
                                const associatedBills = bills.filter(b => inv.bills_bundled.includes(b.id));

                                return (
                                    <div key={inv.invoice_number} className="bg-white p-6 rounded-2xl border shadow-sm">
                                        {/* Invoice Header */}
                                        <div className="flex justify-between items-start mb-6 border-b pb-4">
                                            <div>
                                                <h3 className="font-black text-lg text-slate-900">{inv.invoice_number}</h3>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{inv.date}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Grand Total</p>
                                                <h4 className="font-black text-2xl text-sky-700">₹{inv.grand_total.toLocaleString("en-IN")}</h4>
                                            </div>
                                        </div>

                                        {/* Itemized Table */}
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-slate-400 uppercase text-left border-b">
                                                    <th className="pb-3">LR #</th>
                                                    <th className="pb-3">Route</th>
                                                    <th className="pb-3 text-right">Freight</th>
                                                    <th className="pb-3 text-right text-amber-600">Diten</th>
                                                    <th className="pb-3 text-right text-rose-600">Advance</th>
                                                    <th className="pb-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {associatedBills.map(bill => (
                                                    <tr key={bill.id} className="hover:bg-neutral-50">
                                                        <td className="py-3 font-mono font-bold text-slate-700">{bill.lr_number}</td>
                                                        <td className="py-3 text-slate-600">{bill.route_sequence}</td>
                                                        <td className="py-3 text-right font-mono">₹{bill.freight.toLocaleString("en-IN")}</td>
                                                        <td className="py-3 text-right font-mono text-amber-600">{bill.diten > 0 ? `₹${bill.diten}` : "-"}</td>
                                                        <td className="py-3 text-right font-mono text-rose-600">{bill.advance > 0 ? `₹${bill.advance}` : "-"}</td>
                                                        <td className="py-3 text-right font-mono font-bold text-slate-900">₹{bill.total_amount.toLocaleString("en-IN")}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Individual Invoice Financials */}
                                        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-xs font-bold text-slate-500 bg-neutral-50 p-4 rounded-xl">
                                            <div>Subtotal: <span className="text-slate-900">₹{inv.subtotal.toLocaleString("en-IN")}</span></div>
                                            <div>GST: <span className="text-slate-900">₹{inv.gst_amount.toLocaleString("en-IN")}</span></div>
                                            <div className="text-right">Total: <span className="text-sky-700">₹{inv.grand_total.toLocaleString("en-IN")}</span></div>
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
                                    ₹ {invoices
                                        .filter(i => i.client_name === selectedClient)
                                        .reduce((a, b) => a + (b.grand_total || 0), 0)
                                        .toLocaleString("en-IN")}
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
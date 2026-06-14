"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

interface InvoiceDesign {
  themeColor: string;
  fontStyle: "sans" | "serif" | "mono";
  showGst: boolean;
  showSignature: boolean;
  termsText: string;
  companyAddress: string;
  footerNotes: string;
}

export default function SettingsPanel() {
  // --- Core Configuration States ---
  const [sheetLink, setSheetLink] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLogoText, setCompanyLogoText] = useState("");
  const [logoImage, setLogoImage] = useState<string | null>(null);
  
  const [billUI, setBillUI] = useState<InvoiceDesign>({
    themeColor: "#0284c7",
    fontStyle: "sans",
    showGst: true,
    showSignature: true,
    termsText: "",
    companyAddress: "",
    footerNotes: ""
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSavedGlow, setIsSavedGlow] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [customColorInput, setCustomColorInput] = useState("#0284c7");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presets = ["#0284c7", "#0f172a", "#10b981", "#7c3aed", "#e11d48"];

  // Fetch verified data state from settings.json on layer initialization
  useEffect(() => {
    async function loadSystemSettings() {
      try {
        const response = await fetch("/api/dashboard");
        const json = await response.json();
        if (json.success && json.settings) {
          const cfg = json.settings;
          setSheetLink(cfg.sheetLink || "");
          setCompanyName(cfg.companyName || "");
          setCompanyLogoText(cfg.companyLogoText || "");
          setLogoImage(cfg.logoImage || null);
          if (cfg.billUI) setBillUI(cfg.billUI);
        }
      } catch (err) {
        console.error("Failed loading preferences file:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSystemSettings();
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // POST everything together in one secure runtime object package block
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavedGlow(true);

    const fullPayload = {
      sheetLink,
      companyName,
      companyLogoText,
      logoImage,
      billUI
    };

    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPayload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message);
    } catch (err: any) {
      toast.error(`⚠️ Settings Synchronization Denied: ${err.message}`);
    } finally {
      setTimeout(() => setIsSavedGlow(false), 1500);
    }
  };

  const handleCustomColorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBillUI({ ...billUI, themeColor: customColorInput });
    setIsPickerOpen(false);
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-neutral-100">
        <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="w-full min-h-screen bg-neutral-100 text-slate-900 antialiased p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* --- SETTINGS HEADER - Responsive --- */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-white p-4 sm:p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">System Controls & Branding</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Configure cloud integrations, core profile tags, and customize your financial billing printouts.</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSaveSettings}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl cursor-pointer shadow-sm transition-all self-start sm:self-auto"
          >
            {isSavedGlow ? "✓ Configuration Locked" : "Save All Changes"}
          </motion.button>
        </div>

        {/* --- GRID ENVIRONMENT WORKSPACE - Responsive --- */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* LEFT INTERACTIVE CONTROL DECK */}
          <div className="lg:w-5/12 space-y-6">
            
            {/* Sheet Link */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4 sm:p-5 space-y-4">
              <h2 className="font-bold text-base text-slate-800 border-b border-neutral-100 pb-2">📦 Sheet Data Integrations</h2>
              <div>
                <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Connected Google-Sheets URL</label>
                <input 
                  type="text"
                  value={sheetLink}
                  onChange={(e) => setSheetLink(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full mt-1.5 bg-neutral-50 border border-neutral-200 text-xs p-2.5 sm:p-3 rounded-lg font-mono focus:outline-none focus:border-sky-500 text-slate-700"
                />
              </div>
            </div>

            {/* Business Identity */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4 sm:p-5 space-y-4">
              <h2 className="font-bold text-base text-slate-800 border-b border-neutral-100 pb-2">🏢 Business Identity Details</h2>
              
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Corporate Graphic Logo</label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  {logoImage ? (
                    <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-lg overflow-hidden bg-white border border-neutral-200 flex items-center justify-center">
                      <img src={logoImage} alt="Preview" className="h-full w-full object-contain" />
                      <button 
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] sm:text-[10px] font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg bg-neutral-200 border border-dashed border-neutral-300 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-slate-400 text-center px-1">
                      No Image
                    </div>
                  )}
                  <div className="flex-1 w-full">
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef}
                      onChange={handleLogoChange}
                      className="hidden" 
                      id="invoice-logo-upload"
                    />
                    <label 
                      htmlFor="invoice-logo-upload"
                      className="inline-block text-[10px] sm:text-xs font-bold text-slate-700 bg-white border border-neutral-200 shadow-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors"
                    >
                      Choose Media File
                    </label>
                    <p className="text-[8px] sm:text-[9px] text-slate-400 mt-1">PNG, JPG formats accepted. Replaces initials.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Registered Company Name</label>
                  <input 
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full mt-1.5 bg-neutral-50 border border-neutral-200 text-xs p-2.5 sm:p-3 rounded-lg font-medium focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Fallback Initials</label>
                  <input 
                    type="text"
                    maxLength={3}
                    value={companyLogoText}
                    onChange={(e) => setCompanyLogoText(e.target.value.toUpperCase())}
                    className="w-full mt-1.5 bg-neutral-50 border border-neutral-200 text-xs p-2.5 sm:p-3 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Corporate Address Layout</label>
                <textarea 
                  rows={2}
                  value={billUI.companyAddress}
                  onChange={(e) => setBillUI({ ...billUI, companyAddress: e.target.value })}
                  className="w-full mt-1.5 bg-neutral-50 border border-neutral-200 text-xs p-2.5 sm:p-3 rounded-lg focus:outline-none focus:border-sky-500 leading-normal"
                />
              </div>
            </div>

            {/* Theme Designer */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4 sm:p-5 space-y-4">
              <h2 className="font-bold text-base text-slate-800 border-b border-neutral-100 pb-2">🎨 Invoice Theme Designer Controls</h2>
              
              <div>
                <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Invoice Primary Theme Tint</label>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {presets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBillUI({ ...billUI, themeColor: color })}
                      style={{ backgroundColor: color }}
                      className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full border-2 cursor-pointer transition-transform ${billUI.themeColor === color ? "border-slate-900 scale-110 shadow-sm" : "border-transparent"}`}
                    />
                  ))}
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setIsPickerOpen(!isPickerOpen); setCustomColorInput(billUI.themeColor); }}
                      className="h-6 sm:h-7 px-2 rounded-full border border-neutral-300 bg-neutral-50 text-[9px] sm:text-[10px] font-bold text-slate-600 flex items-center justify-center gap-1 hover:bg-neutral-100 cursor-pointer shadow-xs"
                    >
                      {!presets.includes(billUI.themeColor) && (
                        <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border border-black/10 inline-block" style={{ backgroundColor: billUI.themeColor }} />
                      )}
                      Custom +
                    </button>

                    <AnimatePresence>
                      {isPickerOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 5 }}
                          className="absolute bottom-9 left-0 z-40 bg-white p-3 sm:p-4 rounded-xl border border-neutral-200 shadow-xl w-48 sm:w-56 space-y-3"
                        >
                          <div className="text-[10px] sm:text-xs font-bold text-slate-700">Color Spectrum Playground</div>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={customColorInput}
                              onChange={(e) => setCustomColorInput(e.target.value)}
                              className="h-8 w-10 sm:h-9 sm:w-12 border border-neutral-200 rounded-lg cursor-pointer p-0 bg-transparent"
                            />
                            <input 
                              type="text" 
                              value={customColorInput}
                              onChange={(e) => setCustomColorInput(e.target.value)}
                              className="flex-1 bg-neutral-50 border border-neutral-200 font-mono text-[10px] sm:text-xs p-1.5 sm:p-2 rounded-lg focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-2 justify-end text-[9px] sm:text-[10px] font-bold pt-1">
                            <button type="button" onClick={() => setIsPickerOpen(false)} className="px-2 py-1 sm:px-2.5 sm:py-1.5 text-slate-500 hover:bg-neutral-50 rounded-md cursor-pointer">Close</button>
                            <button type="button" onClick={handleCustomColorSubmit} className="px-2 py-1 sm:px-2.5 sm:py-1.5 bg-slate-900 text-white rounded-md cursor-pointer shadow-xs">Apply Tint</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Typography Settings</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {(["sans", "serif", "mono"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setBillUI({ ...billUI, fontStyle: style })}
                      className={`text-[10px] sm:text-xs font-bold p-2 sm:p-2.5 rounded-lg border cursor-pointer capitalize transition-all ${billUI.fontStyle === style ? "bg-slate-900 text-white border-slate-900" : "bg-neutral-50 border-neutral-200 text-slate-600"}`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-700">Include Automated GST Columns (18%)</span>
                  <input 
                    type="checkbox" 
                    checked={billUI.showGst} 
                    onChange={(e) => setBillUI({ ...billUI, showGst: e.target.checked })}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 border-neutral-300 rounded focus:ring-sky-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-700">Display Consignee Signature Deck</span>
                  <input 
                    type="checkbox" 
                    checked={billUI.showSignature} 
                    onChange={(e) => setBillUI({ ...billUI, showSignature: e.target.checked })}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 border-neutral-300 rounded focus:ring-sky-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold uppercase text-slate-400">Terms & Conditions Contract Strings</label>
                <textarea 
                  rows={2}
                  value={billUI.termsText}
                  onChange={(e) => setBillUI({ ...billUI, termsText: e.target.value })}
                  className="w-full mt-1.5 bg-neutral-50 border border-neutral-200 text-[10px] sm:text-[11px] p-2 sm:p-2.5 rounded-lg focus:outline-none focus:border-sky-500 leading-relaxed"
                />
              </div>
            </div>

          </div>

          {/* RIGHT LIVE INVOICE PREVIEW CANVAS - Responsive */}
          <div className="lg:w-7/12 lg:sticky lg:top-8">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-400 mb-2 px-1">🖥️ Interactive Print Canvas Preview</div>
            
            <div 
              style={{
                fontFamily: 
                  billUI.fontStyle === "serif" ? "Georgia, serif" : 
                  billUI.fontStyle === "mono" ? "Courier New, monospace" : "inherit"
              }}
              className="bg-white rounded-xl border border-neutral-200 shadow-xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 text-xs text-slate-800 transition-all duration-200"
            >
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-4 sm:pb-5">
                <div className="flex items-center gap-3">
                  {logoImage ? (
                    <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white border border-neutral-200 overflow-hidden flex items-center justify-center p-0.5 shadow-xs">
                      <img src={logoImage} alt="Brand Logo" className="h-full w-full object-contain" />
                    </div>
                  ) : companyLogoText ? (
                    <div 
                      style={{ backgroundColor: billUI.themeColor }}
                      className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-inner transition-colors duration-200"
                    >
                      {companyLogoText}
                    </div>
                  ) : null}

                  <div className="flex-1">
                    <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 break-words">{companyName || "Your Company Name"}</h3>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 max-w-xs leading-normal break-words">{billUI.companyAddress || "No Corporate Address Set."}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                  <h2 style={{ color: billUI.themeColor }} className="text-base sm:text-lg font-black uppercase tracking-wider transition-colors duration-200">Tax Invoice</h2>
                  <p className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 mt-1">#TS-2026-904</p>
                </div>
              </div>

              {/* Client Info Section */}
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4 text-[9px] sm:text-[10px] bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                <div className="w-full">
                  <span className="text-slate-400 font-bold uppercase block tracking-wide">Billed Consignee:</span>
                  <div className="font-bold text-slate-800 mt-0.5 text-[10px] sm:text-xs break-words">Adani Enterprises Distribution</div>
                  <div className="text-slate-500 break-words">Mundra Port Terminal, Kutch, Gujarat</div>
                </div>
                <div className="sm:text-right w-full">
                  <span className="text-slate-400 font-bold uppercase block tracking-wide">Shipment References:</span>
                  <div className="font-medium text-slate-800 mt-0.5 text-[10px] sm:text-xs"><strong>Vehicle Num:</strong> GJ-01-ZZ-1024</div>
                  <div className="text-slate-500 text-[9px] sm:text-[10px] break-words"><strong>Route manifest:</strong> Ahmedabad ⇄ Surat</div>
                </div>
              </div>

              {/* Invoice Table - Horizontal scroll on mobile */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead>
                    <tr style={{ backgroundColor: `${billUI.themeColor}10` }} className="border-b border-neutral-200 text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 transition-colors duration-200">
                      <th className="py-2 px-2 sm:px-3">Cargo Description</th>
                      <th className="py-2 px-2 sm:px-3 text-center w-14 sm:w-16">Qty</th>
                      <th className="py-2 px-2 sm:px-3 text-right w-20 sm:w-24">Freight Rate</th>
                      <th className="py-2 px-2 sm:px-3 text-right w-20 sm:w-24">Line Net</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium">
                    <tr>
                      <td className="py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs break-words">Bulk Freight Transportation (Trip log ID: #904)</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-3 text-center font-mono text-[10px] sm:text-xs">1</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-3 text-right font-mono text-[10px] sm:text-xs">₹24,000.00</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-3 text-right font-mono text-[10px] sm:text-xs">₹24,000.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="w-full sm:w-64 ml-auto space-y-1.5 pt-2 border-t border-neutral-100 text-[10px] sm:text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Gross Charges Subtotal:</span>
                  <span className="font-mono">₹24,000.00</span>
                </div>
                {billUI.showGst && (
                  <div className="flex justify-between text-slate-400 text-[9px] sm:text-[10px]">
                    <span>Transport GST (18%):</span>
                    <span className="font-mono">₹4,320.00</span>
                  </div>
                )}
                <div style={{ color: billUI.themeColor }} className="flex justify-between font-black text-xs sm:text-sm pt-1.5 border-t border-dashed border-neutral-200 transition-colors duration-200">
                  <span>Grand Invoice Total:</span>
                  <span className="font-mono">₹{billUI.showGst ? "28,320.00" : "24,000.00"}</span>
                </div>
              </div>

              {/* Footer Section */}
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 text-[8px] sm:text-[9px] pt-4 border-t border-neutral-100">
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold uppercase block tracking-wide">Contract Declarations:</span>
                  <p className="text-slate-400 whitespace-pre-line leading-relaxed break-words">{billUI.termsText || "No explicit terms specified."}</p>
                </div>
                
                {billUI.showSignature && (
                  <div className="flex flex-col justify-end items-start sm:items-end h-full pt-4 sm:pt-6 sm:pr-2">
                    <div className="w-24 sm:w-32 border-b border-slate-400 text-center text-slate-300 italic font-serif text-[9px] sm:text-[10px]">Authorized Stamp</div>
                    <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wide">Signatory Seal</div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
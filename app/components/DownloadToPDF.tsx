"use client";

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface Bill {
  id: string;
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
  total_amount: number;
}

interface Invoice {
  invoice_number: string;
  date: string;
  client_name: string;
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
  };
}

interface DownloadPDFProps {
  fileName: string;
  buttonText?: string;
  className?: string;
  active: Invoice;
  billsData: Bill[];
  systemSettings: SystemSettings;
}

export default function DownloadToPDF({ 
  fileName, 
  buttonText = "Download PDF Directly", 
  className,
  active,
  billsData,
  systemSettings
}: DownloadPDFProps) {
  const [html2canvasPro, setHtml2canvasPro] = useState<any>(null);
  const [jsPDF, setJsPDF] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    Promise.all([
      import("html2canvas-pro"),
      import("jspdf")
    ]).then(([canvasModule, pdfModule]) => {
      setHtml2canvasPro(() => canvasModule.default);
      setJsPDF(() => pdfModule.jsPDF);
    });
  }, []);

  const handleDownloadPDF = async () => {
    if (!html2canvasPro || !jsPDF || !active || !billsData.length) return;
    setIsGenerating(true);

    // 1. Create an off-screen isolated container to render the print layout perfectly
    const printContainer = document.createElement("div");
    printContainer.style.position = "absolute";
    printContainer.style.left = "-9999px";
    printContainer.style.top = "-9999px";
    printContainer.style.width = "850px"; // Fixed canvas resolution optimized for A4 scale aspect ratios
    printContainer.style.backgroundColor = "#ffffff";
    document.body.appendChild(printContainer);

    // 2. Pure Invoice Element Template (No Action Header Rows, No close buttons)
    const InvoiceTemplate = () => (
      <div
        style={{
          padding: "32px",
          color: "#1e293b",
          fontFamily:
            systemSettings.billUI.fontStyle === "serif" ? "Georgia, serif" :
            systemSettings.billUI.fontStyle === "mono" ? "Courier New, monospace" : "ui-sans-serif, system-ui"
        }}
        className="space-y-6 text-xs bg-white"
      >
        {/* Top Header Row */}
        <div className="flex justify-between items-start gap-4 border-b border-neutral-200 pb-5" style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="flex items-center gap-3" style={{ display: "flex", alignItems: "center" }}>
            {systemSettings.logoImage ? (
              <div className="h-12 w-12 rounded-xl bg-white border border-neutral-200 overflow-hidden flex items-center justify-center p-0.5">
                <img src={systemSettings.logoImage} alt="Brand Logo" className="h-full w-full object-contain" />
              </div>
            ) : systemSettings.companyLogoText ? (
              <div
                style={{ backgroundColor: systemSettings.billUI.themeColor }}
                className="h-12 w-12 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-inner"
              >
                {systemSettings.companyLogoText}
              </div>
            ) : null}
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase" style={{ margin: 0 }}>{systemSettings.companyName}</h2>
              <p className="text-[10px] text-slate-400 mt-1 max-w-sm font-medium leading-normal" style={{ margin: 0 }}>{systemSettings.billUI.companyAddress}</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <h3 style={{ color: systemSettings.billUI.themeColor, margin: 0 }} className="text-lg font-black uppercase tracking-wide">Tax Invoice</h3>
            <p className="font-mono text-slate-500 font-bold mt-1 text-[11px]" style={{ margin: 0 }}>{active.invoice_number}</p>
            <p className="text-slate-400 text-[10px] mt-0.5" style={{ margin: 0 }}>Date Issued: {active.date}</p>
          </div>
        </div>

        {/* Client details info-card */}
        <div className="border p-4 rounded-xl text-[11px] bg-neutral-50" style={{ display: "flex", justifyContent: "space-between", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div>
            <span className="font-bold text-slate-400 uppercase tracking-wider block">Billed Client Party:</span>
            <div className="font-black text-slate-900 mt-1 text-base">{active.client_name}</div>
            <div className="text-slate-500 font-medium mt-0.5">Corporate Supply Chain Account</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="text-slate-500 font-medium"><strong>Compliance Status:</strong> {systemSettings.billUI.showGst ? "18% Logistics GST Registered" : "Zero Rated/Exempted Logistics"}</div>
            <div className="text-slate-500 font-medium mt-1"><strong>Payment Terms:</strong> Freight Manifest Signature Due</div>
          </div>
        </div>

        {/* Dynamic Ledger Ledger Item Sheet Table */}
        <table className="w-full text-left border-collapse" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: `${systemSettings.billUI.themeColor}10` }} className="border-b-2 border-neutral-200 text-slate-500 font-bold text-[9px] uppercase">
              <th style={{ padding: "12px 8px" }}>LR Slip</th>
              <th style={{ padding: "12px 8px" }}>Asset</th>
              <th style={{ padding: "12px 8px" }}>Route / Destination</th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>Weight (T)</th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>Rate</th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>Freight</th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>Detention</th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>Advance (-)</th>
              <th style={{ padding: "12px 8px", textAlign: "right" }}>Net</th>
            </tr>
          </thead>
          <tbody className="divide-y font-medium text-xs">
            {billsData.map(b => (
              <tr key={b.id} className="text-slate-700 border-b border-neutral-100">
                <td style={{ padding: "12px 8px" }} className="font-mono font-bold text-slate-500">{b.lr_number}</td>
                <td style={{ padding: "12px 8px" }} className="font-bold text-slate-900">{b.vehicle_number}</td>
                <td style={{ padding: "12px 8px" }}>
                  <div>{b.route_sequence}</div>
                  <div className="text-[10px] text-slate-400 font-normal">To: {b.destination}</div>
                </td>
                <td style={{ padding: "12px 8px", textAlign: "right" }} className="font-mono">{b.weight || 0}</td>
                <td style={{ padding: "12px 8px", textAlign: "right" }} className="font-mono">{Number(b.rate).toLocaleString("en-IN")}</td>
                <td style={{ padding: "12px 8px", textAlign: "right" }} className="font-mono">{b.freight > 0 ? b.freight.toLocaleString("en-IN") : "-"}</td>
                <td style={{ padding: "12px 8px", textAlign: "right" }} className="font-mono text-amber-600">{b.diten > 0 ? b.diten.toLocaleString("en-IN") : "-"}</td>
                <td style={{ padding: "12px 8px", textAlign: "right" }} className="font-mono text-rose-600">{b.advance > 0 ? `₹ ${b.advance.toLocaleString("en-IN")}` : "-"}</td>
                <td style={{ padding: "12px 8px", textAlign: "right" }} className="font-mono font-bold text-slate-900">₹ {Math.round(b.total_amount).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial accounts tally block summary */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%" }}>
          <div className="w-72 space-y-2" style={{ width: "288px" }}>
            <div className="flex justify-between font-medium text-slate-500 text-xs" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Gross Manifests Subtotal:</span>
              <span className="font-mono">₹ {Math.round(active.subtotal).toLocaleString("en-IN")}</span>
            </div>
            {systemSettings.billUI.showGst && (
              <div className="flex justify-between font-medium text-slate-400 text-[11px]" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Transport GST Sacc (18%):</span>
                <span className="font-mono">₹ {active.gst_amount.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div style={{ color: systemSettings.billUI.themeColor, display: "flex", justifyContent: "space-between", borderTop: "1px dashed #cbd5e1", paddingTop: "8px" }} className="flex justify-between font-black text-base">
              <span>Grand Account Total:</span>
              <span className="font-mono">₹ {Math.round(active.grand_total).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Bank Wire Accounts Section */}
        <div className="mt-6 pt-4 border-t border-neutral-200">
          <div className="rounded-xl p-4 border border-neutral-200" style={{ display: "flex", justifyContent: "space-between", backgroundColor: "#f8fafc" }}>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Payment Settlement Details</span>
              <p className="font-bold text-slate-800 text-base" style={{ margin: 0 }}>{systemSettings.bank_display_details.bankName || "Bank Name"}</p>
              <p className="text-[10px] text-slate-500 font-medium" style={{ margin: 0 }}>Account Holder: {systemSettings.bank_display_details.accountHolder || "-"}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "right" }}>
              <div className="flex justify-end gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">A/c No:</span> <span className="font-mono font-bold text-slate-900">{systemSettings.bank_display_details.accountNumber || "0000 0000 0000"}</span></div>
              <div className="flex justify-end gap-2 mt-1"><span className="text-[10px] font-bold text-slate-400 uppercase">IFSC:</span> <span className="font-mono font-bold text-slate-900">{systemSettings.bank_display_details.ifscCode || "IFSC0000000"}</span></div>
            </div>
          </div>
        </div>

        {/* Declarations and Signature lines */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-neutral-100 text-[10px] text-slate-400" style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="leading-relaxed whitespace-pre-line text-slate-500" style={{ width: "50%" }}>
            <span className="font-bold text-slate-600 uppercase block tracking-wider mb-1">Contract Declarations:</span>
            {systemSettings.billUI.termsText}
          </div>
          {systemSettings.billUI.showSignature && (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-end", width: "50%", textAlign: "right" }}>
              <div style={{ width: "144px", borderBottom: "1px solid #cbd5e1", paddingBottom: "4px", color: "#cbd5e1", fontStyle: "italic" }}>
                {systemSettings.companyName.split(" ")[0]} Seal
              </div>
              <div className="font-bold uppercase tracking-wide mt-1 text-[9px]">Authorized Signatory</div>
            </div>
          )}
        </div>

        {/* Global Footer Message line */}
        {systemSettings.billUI.footerNotes && (
          <div className="w-full text-center text-slate-400 text-[10px] pt-4 border-t border-neutral-100 italic" style={{ textAlign: "center" }}>
            {systemSettings.billUI.footerNotes}
          </div>
        )}
      </div>
    );

    try {
      // 3. Fire React pipeline to mount component cleanly in our off-screen container
      const root = createRoot(printContainer);
      root.render(<InvoiceTemplate />);

      // Let style context load safely
      await new Promise((resolve) => setTimeout(resolve, 350));

      // 4. Capture memory element utilizing html2canvas-pro color engine
      const canvas = await html2canvasPro(printContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      // Remove off-screen element from real active DOM right after snapshotting
      root.unmount();
      document.body.removeChild(printContainer);

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      // A4 Multi-page calculation configuration metrics
      const pageHeightInches = 11.69;
      const pageWidthInches = 8.27;
      const margin = 0.4;
      const printWidth = pageWidthInches - (margin * 2);
      const printPageHeight = pageHeightInches - (margin * 2);

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const totalPdfHeightNeeded = (imgHeightPx * printWidth) / imgWidthPx;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: "a4"
      });

      let heightLeft = totalPdfHeightNeeded;
      let position = margin;

      if (totalPdfHeightNeeded <= printPageHeight) {
        pdf.addImage(imgData, "JPEG", margin, position, printWidth, totalPdfHeightNeeded);
      } else {
        while (heightLeft > 0) {
          pdf.addImage(imgData, "JPEG", margin, position, printWidth, totalPdfHeightNeeded);
          heightLeft -= printPageHeight;
          position -= printPageHeight;

          if (heightLeft > 0) {
            pdf.addPage();
            position = margin;
          }
        }
      }

      pdf.save(fileName);
    } catch (error) {
      console.error("In-memory background PDF compilation engine crash:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const isEngineReady = html2canvasPro && jsPDF && active && billsData?.length > 0;

  return (
    <button 
      onClick={handleDownloadPDF} 
      disabled={!isEngineReady || isGenerating}
      className={className || "bg-sky-600 text-white font-bold px-4 py-2 rounded-lg"}
    >
      {isGenerating ? "Compiling Document..." : isEngineReady ? buttonText : "Loading Assets..."}
    </button>
  );
}
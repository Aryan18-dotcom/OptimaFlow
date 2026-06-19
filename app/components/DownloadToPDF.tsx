"use client";

import React, { useEffect, useState } from "react";

interface DownloadPDFProps {
  elementId: string;
  fileName: string;
  buttonText?: string;
  className?: string;
}

export default function DownloadToPDF({ 
  elementId, 
  fileName, 
  buttonText = "Download PDF", 
  className 
}: DownloadPDFProps) {
  const [html2pdf, setHtml2pdf] = useState<any>(null);

  // Dynamically load the library only on the client
  useEffect(() => {
    import("html2pdf.js").then((module) => {
      setHtml2pdf(() => module.default);
    });
  }, []);

  const handleDownloadPDF = () => {
    if (!html2pdf) return;

    const element = document.getElementById(elementId);
    if (!element) return;

    const opt = {
      margin: 0.5,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <button 
      onClick={handleDownloadPDF} 
      disabled={!html2pdf}
      className={className || "bg-sky-600 text-white font-bold px-4 py-2 rounded-lg"}
    >
      {html2pdf ? buttonText : "Loading PDF engine..."}
    </button>
  );
}
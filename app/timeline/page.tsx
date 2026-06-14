"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TimelineViewer() {
  const [bounds, setBounds] = useState({ min: "", max: "" });
  const [range, setRange] = useState({ start: "", end: "" });
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/timeline/meta")
      .then(res => res.json())
      .then(data => setBounds({ min: data.start, max: data.end }));
  }, []);

  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {};
    previewData.forEach(item => {
      const date = item.date || "Unknown Date";
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  }, [previewData]);

  const fetchPreview = async () => {
    if (!range.start || !range.end) return toast.warn("Please select both dates");
    const [sY, sM] = range.start.split("-");
    const [eY, eM] = range.end.split("-");
    const query = `${sM}-${sY}-${eM}-${eY}`;
    const res = await fetch(`/api/timeline?range=${query}`);
    const json = await res.json();
    if (json.success) {
      setPreviewData(json.data);
      setShowPreview(true);
    } else {
      toast.error(json.message);
    }
  };

  const getTheme = async () => {
    const res = await fetch("/api/dashboard");
    const json = await res.json();
    return json.settings?.billUI?.themeColor || "#0284c7";
  };

  const exportToExcel = async () => {
    const themeColor = await getTheme();
    const hexColor = themeColor.replace('#', '');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('LogisticsData');

    Object.keys(groupedData).forEach((date) => {
      const headerRow = worksheet.addRow([`Date: ${date}`]);
      headerRow.height = 30;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hexColor.toUpperCase() } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.mergeCells(`A${headerRow.number}:D${headerRow.number}`);

      const subHeader = worksheet.addRow(['Trip ID', 'Vehicle', 'Driver', 'Route Sequence']);
      subHeader.font = { bold: true, size: 11 };
      subHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

      groupedData[date].forEach((trip: any, index: number) => {
        const row = worksheet.addRow([trip.id, trip.vehicleNumber, trip.driverName, trip.routeSequence]);
        if (index % 2 !== 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        row.eachCell((cell) => cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
      });
      worksheet.addRow([]);
    });
    worksheet.columns = [{ width: 45 }, { width: 20 }, { width: 15 }, { width: 70 }];
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Export_${range.start}.xlsx`; a.click();
    toast.success("Excel generated!");
  };

const exportToPDF = async () => {
  const themeColor = await getTheme();
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`Logistics Report: ${range.start} to ${range.end}`, 14, 20);

  let startY = 30; // Initial vertical position

  Object.keys(groupedData).forEach((date) => {
    // 1. Add Date Header for the PDF
    doc.setFillColor(themeColor);
    doc.rect(14, startY, 180, 10, 'F'); // Blue background bar
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`Date: ${date}`, 16, startY + 7);
    
    startY += 10;

    // 2. Prepare rows for this specific date
    const tableRows = groupedData[date].map(item => [
      item.id, 
      item.vehicleNumber, 
      item.driverName, 
      item.routeSequence
    ]);

    // 3. Render table for this date
    autoTable(doc, {
      head: [['Trip ID', 'Vehicle', 'Driver', 'Route']],
      body: tableRows,
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14 }
    });

    // 4. Update startY for the next date block (adding a little space)
    startY = (doc as any).lastAutoTable.finalY + 10;

    // Optional: Add new page if we run out of space
    if (startY > 250) {
      doc.addPage();
      startY = 20;
    }
  });

  doc.save(`Report_${range.start}.pdf`);
  setExportMenuOpen(false);
};

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl border">
        <h1 className="text-xl font-bold mb-4">Select Timeline Range</h1>
        <div className="flex gap-4 items-center">
          <input type="month" onChange={e => setRange({ ...range, start: e.target.value })} className="border p-2 rounded" />
          <input type="month" onChange={e => setRange({ ...range, end: e.target.value })} className="border p-2 rounded" />
          <button onClick={fetchPreview} className="bg-sky-600 text-white px-4 py-2 rounded">Preview</button>
        </div>
      </div>

      {showPreview && (
        <div className="bg-white p-6 rounded-xl border shadow-lg">
          <div className="flex justify-between mb-6">
            <h2 className="font-bold text-lg">Live Data Preview</h2>
            <div className="relative">
              <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="bg-slate-800 text-white px-4 py-2 rounded text-sm">Export Options ▾</button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border shadow-xl z-10">
                  <button onClick={exportToExcel} className="block w-full p-3 text-sm hover:bg-neutral-50 text-emerald-600 font-bold">Excel (.xlsx)</button>
                  <button onClick={exportToPDF} className="block w-full p-3 text-sm hover:bg-neutral-50 text-rose-600 font-bold border-t">PDF (.pdf)</button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-8">
            {Object.keys(groupedData).map((date) => (
              <div key={date}>
                <h3 className="font-black text-sky-700 bg-sky-50 px-3 py-1 rounded w-max text-sm border-l-4 border-sky-600">{date}</h3>
                <table className="w-full text-sm mt-2 border">
                  <thead className="bg-neutral-100 font-bold">
                    <tr><th className="p-3">Vehicle ID</th><th className="p-3">Number (Driver)</th><th className="p-3">Route</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {groupedData[date].map((row, i) => (
                      <tr key={i} className="hover:bg-neutral-50">
                        <td className="p-3 font-mono text-xs">{row.id}</td>
                        <td className="p-3 font-semibold">{row.vehicleNumber} ({row.driverName})</td>
                        <td className="p-3 italic">{row.routeSequence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
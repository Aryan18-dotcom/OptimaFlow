import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BILLS_DIR = path.join(process.cwd(), "data", "bills");
const INVOICES_DIR = path.join(process.cwd(), "data", "invoices");
const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "settings.json");

function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getQuarterShardPath(directory: string, prefix: string, dateInput?: string): string {
  ensureDirectoryExists(directory);
  const targetDate = dateInput ? new Date(dateInput) : new Date();
  const year = targetDate.getFullYear();
  const quarter = Math.ceil((targetDate.getMonth() + 1) / 3);
  return path.join(directory, `${prefix}-Q${quarter}-${year}.json`);
}

function loadAllQuarterFiles(directory: string, prefix: string): any[] {
  ensureDirectoryExists(directory);
  const files = fs.readdirSync(directory).filter(f => f.startsWith(`${prefix}-`) && f.endsWith(".json"));
  let compiledArray: any[] = [];
  files.forEach(file => {
    const raw = fs.readFileSync(path.join(directory, file), "utf-8").trim();
    if (raw) compiledArray = compiledArray.concat(JSON.parse(raw));
  });
  return compiledArray;
}

// ==========================================
//  GET: LOAD COMBINED INVOICES LIST
// ==========================================
export async function GET() {
  try {
    const invoices = loadAllQuarterFiles(INVOICES_DIR, "invoices");
    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message }, { status: 500 });
  }
}

// ==========================================
//  POST: BUNDLE TAX INVOICE IN QUARTER SHARD
// ==========================================
export async function POST(request: Request) {
  try {
    const frontendPayload = await request.json();
    
    if (!frontendPayload || !frontendPayload.billsBundled || frontendPayload.billsBundled.length === 0) {
      return NextResponse.json({ success: false, message: "Missing required bundled manifests." }, { status: 400 });
    }

    const settings = fs.existsSync(SETTINGS_FILE_PATH) ? JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, "utf-8")) : {};
    const billsQuarterFiles = fs.readdirSync(BILLS_DIR).filter(f => f.startsWith("bills-") && f.endsWith(".json"));

    // 1. Re-fetch bundled bills across shards to calculate subtotal safely
    let targetBills: any[] = [];
    billsQuarterFiles.forEach(file => {
      const filePath = path.join(BILLS_DIR, file);
      let fileBills = JSON.parse(fs.readFileSync(filePath, "utf-8") || "[]");
      
      // Lock status of matching bills to Invoiced
      let changed = false;
      fileBills = fileBills.map((b: any) => {
        if (frontendPayload.billsBundled.includes(b.id)) {
          targetBills.push(b);
          changed = true;
          return { ...b, status: "Invoiced" };
        }
        return b;
      });
      if (changed) fs.writeFileSync(filePath, JSON.stringify(fileBills, null, 2), "utf-8");
    });

    const calculatedSubtotal = targetBills.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
    const shouldApplyGst = settings.billUI?.showGst !== false;
    const calculatedGstAmount = shouldApplyGst ? Math.round(calculatedSubtotal * 0.18) : 0;

    const fullyConfiguredInvoice = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      invoiceNumber: `${settings.companyLogoText || "CHHEDA"}-TS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString().split("T")[0],
      clientName: frontendPayload.clientName || targetBills[0]?.partyName || "General Client Account",
      billsBundled: frontendPayload.billsBundled,
      subtotal: calculatedSubtotal,
      gstAmount: calculatedGstAmount,
      grandTotal: calculatedSubtotal + calculatedGstAmount
    };

    // Save invoice to the correct current Quarter Shard
    const activeShardPath = getQuarterShardPath(INVOICES_DIR, "invoices", fullyConfiguredInvoice.date);
    let shardInvoices = [];
    if (fs.existsSync(activeShardPath)) {
      shardInvoices = JSON.parse(fs.readFileSync(activeShardPath, "utf-8") || "[]");
    }
    shardInvoices.unshift(fullyConfiguredInvoice);
    fs.writeFileSync(activeShardPath, JSON.stringify(shardInvoices, null, 2), "utf-8");

    return NextResponse.json({ success: true, invoice: fullyConfiguredInvoice });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message }, { status: 500 });
  }
}

// ==========================================
//  DELETE: REMOVE INVOICE & UNLOCK BILLS
// ==========================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("id");
    if (!invoiceId) return NextResponse.json({ success: false, message: "Missing Invoice ID" }, { status: 400 });

    ensureDirectoryExists(INVOICES_DIR);
    const invFiles = fs.readdirSync(INVOICES_DIR).filter(f => f.startsWith("invoices-") && f.endsWith(".json"));
    let targetedInvoice: any = null;

    // 1. Locate and remove the invoice record from its quarter shard
    for (const file of invFiles) {
      const filePath = path.join(INVOICES_DIR, file);
      let shardInvoices = JSON.parse(fs.readFileSync(filePath, "utf-8") || "[]");
      targetedInvoice = shardInvoices.find((inv: any) => inv.id === invoiceId);
      
      if (targetedInvoice) {
        shardInvoices = shardInvoices.filter((inv: any) => inv.id !== invoiceId);
        fs.writeFileSync(filePath, JSON.stringify(shardInvoices, null, 2), "utf-8");
        break;
      }
    }

    if (!targetedInvoice) return NextResponse.json({ success: false, message: "Invoice not found" }, { status: 404 });

    // 2. Return bundled bills back to Pending Invoice status across files
    const billsQuarterFiles = fs.readdirSync(BILLS_DIR).filter(f => f.startsWith("bills-") && f.endsWith(".json"));
    billsQuarterFiles.forEach(file => {
      const filePath = path.join(BILLS_DIR, file);
      let fileBills = JSON.parse(fs.readFileSync(filePath, "utf-8") || "[]");
      let changed = false;
      fileBills = fileBills.map((b: any) => {
        if (targetedInvoice.billsBundled.includes(b.id)) {
          changed = true;
          return { ...b, status: "Pending Invoice" };
        }
        return b;
      });
      if (changed) fs.writeFileSync(filePath, JSON.stringify(fileBills, null, 2), "utf-8");
    });

    return NextResponse.json({ success: true, message: "Invoice deleted cleanly. Bills released." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message }, { status: 500 });
  }
}
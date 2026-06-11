import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TRIPS_DIR = path.join(process.cwd(), "data", "trips");
const BILLS_DIR = path.join(process.cwd(), "data", "bills");
const INVOICES_DIR = path.join(process.cwd(), "data", "invoices");
const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "settings.json");

function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// Helper to resolve 3-Month Quarter Shards file pathways
function getQuarterShardPath(directory: string, prefix: string, dateInput?: string): string {
  ensureDirectoryExists(directory);
  
  let targetDate = new Date();
  if (dateInput) {
    // If it's a standard calendar date "2026-05-11"
    if (dateInput.includes("-") && dateInput.split("-")[0].length === 4) {
      targetDate = new Date(dateInput);
    } else {
      // If it's a custom display date like "11-May" or "5-Jun", parse it safely
      const parts = dateInput.split("-");
      const day = parseInt(parts[0], 10);
      const monthStr = parts[1]?.toLowerCase().substring(0, 3);
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const monthIndex = months.indexOf(monthStr);
      if (monthIndex !== -1) {
        targetDate = new Date(new Date().getFullYear(), monthIndex, day);
      }
    }
  }

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const quarter = Math.ceil(month / 3); 
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

function saveToQuarterShard(directory: string, prefix: string, dateInput: string, targetPayload: any, uniqueKey: string = "id") {
  const shardPath = getQuarterShardPath(directory, prefix, dateInput);
  let dataset: any[] = [];
  if (fs.existsSync(shardPath)) {
    const raw = fs.readFileSync(shardPath, "utf-8").trim();
    if (raw) dataset = JSON.parse(raw);
  }
  
  const existingIndex = dataset.findIndex((item: any) => item[uniqueKey] === targetPayload[uniqueKey]);
  if (existingIndex !== -1) {
    dataset[existingIndex] = { ...dataset[existingIndex], ...targetPayload };
  } else {
    dataset.push(targetPayload);
  }
  fs.writeFileSync(shardPath, JSON.stringify(dataset, null, 2), "utf-8");
}

// ==========================================
//  GET: AGGREGATE BILLS AND UNBILLED TRIPS
// ==========================================
export async function GET() {
  try {
    ensureDirectoryExists(TRIPS_DIR);
    const tripFiles = fs.readdirSync(TRIPS_DIR).filter(f => f.startsWith("trips-") && f.endsWith(".json"));
    
    const allTrips: any[] = [];
    tripFiles.forEach((file) => {
      const dailyLogGroup = JSON.parse(fs.readFileSync(path.join(TRIPS_DIR, file), "utf-8") || "[]");
      dailyLogGroup.forEach((group: any) => {
        group.trips.forEach((t: any) => {
          let displayRoute = t.routeSequence || "";
          if (displayRoute.includes("-")) {
            displayRoute = displayRoute.split("-")[1]?.trim() || displayRoute;
          }
          const destination = displayRoute.match(/\[([^\]]+)\]/)?.[1]?.split("(")[0]?.trim() || displayRoute.split("(")[0].trim();

          allTrips.push({
            id: t.id,
            date: group.currentDay,
            vehicleNumber: t.vehicleNumber,
            routeSequence: t.routeSequence,
            destination,
            driverName: t.driverName
          });
        });
      });
    });

    const currentBills = loadAllQuarterFiles(BILLS_DIR, "bills");
    const billedTripIds = currentBills.map((b: any) => b.tripId);
    const unbilledTrips = allTrips.filter(t => !billedTripIds.includes(t.id));

    return NextResponse.json({ success: true, bills: currentBills, unbilledTrips });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Aggregation Error" }, { status: 500 });
  }
}

// ==========================================
//  POST: BATCH BILL OPERATIONS ACROSS QUARTERS
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body; 

    ensureDirectoryExists(BILLS_DIR);
    const settings = fs.existsSync(SETTINGS_FILE_PATH) ? JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, "utf-8")) : {};
    const shouldApplyGst = settings.billUI?.showGst !== false;

    if (action === "create") {
      saveToQuarterShard(BILLS_DIR, "bills", payload.date, payload, "id");
    } 
    
    else if (action === "update") {
      const files = fs.readdirSync(BILLS_DIR).filter(f => f.startsWith("bills-") && f.endsWith(".json"));
      let updatedFlag = false;

      // Scan all quarter files to find where this exact bill resides
      for (const file of files) {
        const filePath = path.join(BILLS_DIR, file);
        let currentBills = JSON.parse(fs.readFileSync(filePath, "utf-8") || "[]");
        const existingBillIndex = currentBills.findIndex((b: any) => b.id === payload.id);

        if (existingBillIndex !== -1) {
          // Replace it directly within its original shard file
          currentBills[existingBillIndex] = { ...currentBills[existingBillIndex], ...payload };
          fs.writeFileSync(filePath, JSON.stringify(currentBills, null, 2), "utf-8");
          updatedFlag = true;
          break;
        }
      }

      // Fallback: If it wasn't found in any shard, save it using the standard date resolver
      if (!updatedFlag) {
        saveToQuarterShard(BILLS_DIR, "bills", payload.date, payload, "id");
      }
      
      // CASCADING UPDATE: If the updated bill is already bound inside an invoice, recalculate parent invoice totals
      if (payload.status === "Invoiced") {
        const invoices = loadAllQuarterFiles(INVOICES_DIR, "invoices");
        const invoiceToAdjust = invoices.find((inv: any) => inv.billsBundled.includes(payload.id));
        
        if (invoiceToAdjust) {
          const freshBills = loadAllQuarterFiles(BILLS_DIR, "bills");
          const bundledBills = freshBills.filter((b: any) => invoiceToAdjust.billsBundled.includes(b.id));
          
          const subtotal = bundledBills.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
          const gstAmount = shouldApplyGst ? Math.round(subtotal * 0.18) : 0;
          
          const freshInvoiceData = { ...invoiceToAdjust, subtotal, gstAmount, grandTotal: subtotal + gstAmount };
          saveToQuarterShard(INVOICES_DIR, "invoices", invoiceToAdjust.date, freshInvoiceData, "id");
        }
      }
    } 
    
    else if (action === "delete") {
      const files = fs.readdirSync(BILLS_DIR).filter(f => f.startsWith("bills-") && f.endsWith(".json"));
      
      for (const file of files) {
        const filePath = path.join(BILLS_DIR, file);
        let currentBills = JSON.parse(fs.readFileSync(filePath, "utf-8") || "[]");
        const targetBill = currentBills.find((b: any) => b.id === payload.id);
        
        if (targetBill) {
          // CASCADING ADJUSTMENT: If the bill is locked inside an invoice, remove it from the bundle matrix
          if (targetBill.status === "Invoiced") {
            const invoices = loadAllQuarterFiles(INVOICES_DIR, "invoices");
            const parentInv = invoices.find((inv: any) => inv.billsBundled.includes(payload.id));
            if (parentInv) {
              const updatedBundledIds = parentInv.billsBundled.filter((id: string) => id !== payload.id);
              const allRemainingBills = loadAllQuarterFiles(BILLS_DIR, "bills").filter((b: any) => b.id !== payload.id);
              const bundledBills = allRemainingBills.filter((b: any) => updatedBundledIds.includes(b.id));
              
              const subtotal = bundledBills.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
              const gstAmount = shouldApplyGst ? Math.round(subtotal * 0.18) : 0;

              const freshInvoiceData = { ...parentInv, billsBundled: updatedBundledIds, subtotal, gstAmount, grandTotal: subtotal + gstAmount };
              saveToQuarterShard(INVOICES_DIR, "invoices", parentInv.date, freshInvoiceData, "id");
            }
          }
          currentBills = currentBills.filter((b: any) => b.id !== payload.id);
          fs.writeFileSync(filePath, JSON.stringify(currentBills, null, 2), "utf-8");
          break;
        }
      }
    }

    return NextResponse.json({ success: true, message: "Bills operation processed successfully." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Internal Write Error" }, { status: 500 });
  }
}
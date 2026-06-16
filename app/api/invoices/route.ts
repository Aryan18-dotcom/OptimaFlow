import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/connectDB";
import { Bill, Invoice, Setting } from "@/models/dataModels";

// ==========================================
//  GET: LOAD ALL INVOICES
// ==========================================
export async function GET() {
  try {
    await connectToDatabase();
    
    // Sort invoices by date descending
    const invoices = await Invoice.find({}).sort({ date: -1 });
    
    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ==========================================
//  POST: CREATE TAX INVOICE & BUNDLE BILLS
// ==========================================
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { billsBundled, clientName, date } = await request.json();

    if (!billsBundled || billsBundled.length === 0) {
      return NextResponse.json({ success: false, message: "No bills selected for bundling." }, { status: 400 });
    }

    // 1. Fetch settings to calculate GST
    const settings = await Setting.findOne({ key: "appSettings" });
    const shouldApplyGst = settings?.value?.billUI?.showGst !== false;

    // 2. Fetch all bills being bundled to calculate totals
    const targetBills = await Bill.find({ id: { $in: billsBundled } });
    const subtotal = targetBills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
    const gstAmount = shouldApplyGst ? Math.round(subtotal * 0.18) : 0;

    // 3. Create the Invoice document
    const newInvoice = await Invoice.create({
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      date: date || new Date().toISOString().split("T")[0],
      party_name: clientName || targetBills[0]?.party_name || "General Client",
      subtotal,
      gst_amount: gstAmount,
      grand_total: subtotal + gstAmount,
      bills_bundled: billsBundled,
      status: 'Generated'
    });

    // 4. Update the bundled bills to 'Invoiced' status and link them to this invoice
    await Bill.updateMany(
      { id: { $in: billsBundled } },
      { status: "Invoiced", invoice_id: newInvoice.invoice_number }
    );

    return NextResponse.json({ success: true, invoice: newInvoice });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ==========================================
//  DELETE: REMOVE INVOICE & UNLOCK BILLS
// ==========================================
export async function DELETE(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("id");

    if (!invoiceId) return NextResponse.json({ success: false, message: "Missing ID" }, { status: 400 });

    // 1. Find the invoice to know which bills were bundled
    const invoice = await Invoice.findOne({ invoice_number: invoiceId });
    if (!invoice) return NextResponse.json({ success: false, message: "Invoice not found" }, { status: 404 });

    // 2. Unlock the bills (reset status and clear invoice reference)
    await Bill.updateMany(
      { id: { $in: invoice.bills_bundled } },
      { status: "Pending Invoice", invoice_id: null }
    );

    // 3. Delete the invoice
    await Invoice.findOneAndDelete({ invoice_number: invoiceId });

    return NextResponse.json({ success: true, message: "Invoice deleted, bills unlocked." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
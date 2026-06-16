import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/connectDB";
import { Bill, Trip, Invoice, Setting } from "@/models/dataModels";

// ==========================================
//  GET: AGGREGATE BILLS AND UNBILLED TRIPS
// ==========================================
export async function GET() {
  try {
    await connectToDatabase();
    
    // Fetch all trips and all bills from MongoDB
    const allTrips = await Trip.find({});
    const currentBills = await Bill.find({});

    // Filter unbilled trips: Trips that don't have an ID in currentBills
    const billedTripIds = currentBills.map((b: any) => b.trip_id);
    const unbilledTrips = allTrips.filter((t: any) => !billedTripIds.includes(t.id));

    if(currentBills.length > 0){
      return NextResponse.json({ success: true, bills: currentBills, unbilledTrips });
    } else{
      return NextResponse.json({ success: false, message: "There are currently 0 Bills." });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ==========================================
//  POST: BATCH BILL OPERATIONS
// ==========================================
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { action, payload } = await request.json();

    // Fetch settings to check GST
    const settings = await Setting.findOne({ key: "appSettings" }) || {};
    const shouldApplyGst = settings.value?.billUI?.showGst !== false;

    if (action === "create") {
      await Bill.create(payload);
    } 
    
    else if (action === "update") {
      await Bill.findOneAndUpdate({ id: payload.id }, payload, { upsert: true });

      // CASCADING UPDATE: If invoiced, recalculate the Invoice totals
      if (payload.status === "Invoiced") {
        const invoice = await Invoice.findOne({ bills_bundled: payload.id });
        if (invoice) {
          const bundledBills = await Bill.find({ id: { $in: invoice.bills_bundled } });
          const subtotal = bundledBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
          const gstAmount = shouldApplyGst ? Math.round(subtotal * 0.18) : 0;
          
          await Invoice.findOneAndUpdate(
            { _id: invoice._id },
            { subtotal, gst_amount: gstAmount, grand_total: subtotal + gstAmount }
          );
        }
      }
    } 
    
    else if (action === "delete") {
      const targetBill = await Bill.findOne({ id: payload.id });
      if (targetBill && targetBill.status === "Invoiced") {
        // CASCADING: Unlock from invoice
        const invoice = await Invoice.findOne({ bills_bundled: payload.id });
        if (invoice) {
          const updatedBundledIds = invoice.bills_bundled.filter((id: string) => id !== payload.id);
          const bundledBills = await Bill.find({ id: { $in: updatedBundledIds } });
          const subtotal = bundledBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
          const gstAmount = shouldApplyGst ? Math.round(subtotal * 0.18) : 0;

          await Invoice.findOneAndUpdate(
            { _id: invoice._id },
            { bills_bundled: updatedBundledIds, subtotal, gst_amount: gstAmount, grand_total: subtotal + gstAmount }
          );
        }
      }
      await Bill.findOneAndDelete({ id: payload.id });
    }

    return NextResponse.json({ success: true, message: "Bills operation processed successfully." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
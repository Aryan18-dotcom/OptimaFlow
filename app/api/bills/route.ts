import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/connectDB";
import { Bill, Trip, Invoice, Setting } from "@/models/dataModels";

function formatRoute(sequence: string) {
  if (!sequence) return sequence;

  // Handles:
  // Phenix(LD)[Kashindra]
  // Baroda(MT)-Manjusar(LD)[SuryaShree]
  const match = sequence.match(
    /(?:.*?\(MT\)-)?(.*?)\(LD\)\[(.*?)\]/
  );

  if (match) {
    return `${match[1].trim()} - ${match[2].trim()}`;
  }

  return sequence;
}

// ==========================================
//  GET: AGGREGATE BILLS AND UNBILLED TRIPS
// ========================================
export async function GET() {
  try {
    await connectToDatabase();

    const allTrips = await Trip.find({}).lean();
    const currentBills = await Bill.find({}).lean();

    // 1. Identify all IDs that have already been billed
    const billedTripIds = new Set<string>();
    currentBills.forEach((bill: any) => {
      if (Array.isArray(bill.trips)) {
        bill.trips.forEach((trip: any) => {
          if (trip.tripId) billedTripIds.add(String(trip.tripId));
        });
      }
      // ALSO check if there's a direct reference if your schema uses one
      if (bill.trip_id) billedTripIds.add(String(bill.trip_id));
    });

    // 2. Define Billable Logic
    const isBillableTrip = (seq: string) => {
      if (!seq) return false;
      // Must contain a load point (LD) AND a final destination [x]
      return seq.includes("(LD)") && seq.includes("[");
    };

    // 3. Filter: Apply both Billed status AND Billable logic
    const unbilledTrips = allTrips
      .filter((trip: any) => {
        // Filter 1: Has this trip been billed?
        const isAlreadyBilled = billedTripIds.has(String(trip._id)) || billedTripIds.has(String(trip.id));
        if (isAlreadyBilled) return false;

        // Filter 2: Is this a "real" billable route?
        return isBillableTrip(trip.route_sequence);
      })
      .map((trip: any) => ({
        ...trip,
        route_sequence: formatRoute(trip.route_sequence),
      }));

    return NextResponse.json({
      success: true,
      bills: currentBills,
      unbilledTrips,
    });
  } catch (error: any) {
    console.error("GET Bills Error:", error);
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
      // console.log(payload)
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
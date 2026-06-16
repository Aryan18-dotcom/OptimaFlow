import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/connectDB";
import { Trip, Resource, Setting } from "@/models/dataModels";
import { uploadToCloudinary } from "@/lib/connectCloudinary";

// Helper function remains the same as it's pure logic
function parseRouteSequenceToLegs(sequenceStr: string) {
  if (!sequenceStr) return [{ location: "No Data", type: "None" }];
  return sequenceStr.split("-").map(legText => {
    let type: "LD" | "MT" | "Parking" | "None" = "None";
    let customTag = undefined;
    let location = legText;

    const tagMatch = location.match(/\[([^\]]+)\]/);
    if (tagMatch) { customTag = tagMatch[1]; location = location.replace(/\[[^\]]+\]/, ""); }

    const typeMatch = location.match(/\([^)]+\)/);
    if (typeMatch) {
      const parsedType = typeMatch[1];
      if (parsedType === "LD" || parsedType === "MT" || parsedType === "PARKING") {
        type = parsedType === "PARKING" ? "Parking" : (parsedType as any);
      }
      location = location.replace(/\([^)]+\)/, "");
    }
    return { location: location.trim(), type, customTag };
  });
}

export async function GET() {
  try {
    await connectToDatabase();

    // 1. Fetch data from MongoDB
    const settingsDoc = await Setting.findOne({});
    (settingsDoc)
    const allTrips = await Trip.find({}).sort({ sort_timestamp: -1 });
    const allResources = await Resource.find({});

    // 2. Metrics Calculation
    const drivers = allResources.filter(r => r.category === 'driver');
    const trucks = allResources.filter(r => r.category === 'truck');
    const assignments = allResources.filter(r => r.category === 'assignment');

    const today = new Date().toISOString().split('T')[0];
    const totalTripsToday = allTrips.filter(t => t.trip_date_display === today).length;

    // 3. Prepare Feed
    const compiledTripsFeed = allTrips.map(trip => ({
      id: trip.id,
      dateString: trip.trip_date_display,
      assetPlate: trip.vehicle_number,
      operatorPilot: trip.driver_name,
      routeSequence: trip.route_sequence,
      legs: parseRouteSequenceToLegs(trip.route_sequence),
      status: trip.route_sequence.toLowerCase().includes("parking") ? "Delayed" : "In Transit"
    }));

    return NextResponse.json({
      success: true,
      metrics: {
        assignmentsDistribution: `${assignments.length} / ${trucks.length}`,
        unassignedCountText: `${Math.max(0, trucks.length - assignments.length)} Vehicles unassigned`,
        fleetsOnRoad: trucks.filter((t: any) => t.details?.status === "active").length,
        fleetsUnavailable: trucks.filter((t: any) => ["under maintenance", "accidental", "inActive"].includes(t.details?.status)).length,
        totalTripsToday,
        drivers
      },
      activeLogsTable: compiledTripsFeed.slice(0, 8),
      settings: settingsDoc || {}
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const payload = await request.json();
    let processedPayload = { ...payload };

    // Use the helper if it's a new upload
    if (payload.logoImage?.startsWith("data:image/")) {
      processedPayload.logoImage = await uploadToCloudinary(payload.logoImage, "company_logos");
    }

    const updatedSettings = await Setting.findOneAndUpdate(
      {}, 
      { $set: processedPayload }, 
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Configurations saved successfully.",
      settings: updatedSettings
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
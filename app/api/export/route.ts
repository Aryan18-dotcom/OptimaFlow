import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/connectDB";
import { Trip } from "@/models/dataModels";

export async function GET() {
  try {
    await connectToDatabase();

    // 1. Fetch all trip data from MongoDB
    const trips = await Trip.find({}).sort({ trip_date: -1 });

    if (!trips || trips.length === 0) {
      return NextResponse.json({ success: false, message: "No data available." }, { status: 404 });
    }

    // 2. Convert to CSV format
    const headers = ["ID", "Vehicle Number", "Driver Name", "Route Sequence", "Date"];
    const csvRows = [
      headers.join(","),
      ...trips.map(row => 
        [
          row.id, 
          row.vehicle_number, 
          row.driver_name, 
          `"${row.route_sequence?.replace(/"/g, '""') || ""}"`,
          row.trip_date?.toISOString().split('T')[0]
        ].join(",")
      )
    ];

    const csvString = csvRows.join("\n");

    // 3. Return as a downloadable file
    return new NextResponse(csvString, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="logistics-export-${new Date().getFullYear()}.csv"`,
      },
    });

  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
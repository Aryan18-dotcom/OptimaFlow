import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const TRIPS_DIR = path.join(process.cwd(), "data", "trips");

export async function GET() {
  try {
    // 1. Fetch all data for the current year (2026)
    const files = fs.readdirSync(TRIPS_DIR).filter(f => f.endsWith("-2026.json"));
    const results: any[] = [];

    files.forEach(file => {
      const data = JSON.parse(fs.readFileSync(path.join(TRIPS_DIR, file), "utf-8"));
      data.forEach((group: any) => results.push(...group.trips));
    });

    if (results.length === 0) {
      return NextResponse.json({ success: false, message: "No data available for 2026." }, { status: 404 });
    }

    // 2. Convert JSON to CSV format
    const headers = ["ID", "Vehicle Number", "Driver Name", "Route Sequence"];
    const csvRows = [
      headers.join(","),
      ...results.map(row => 
        [row.id, row.vehicleNumber, row.driverName, `"${row.routeSequence.replace(/"/g, '""')}"`].join(",")
      )
    ];

    const csvString = csvRows.join("\n");

    // 3. Return as a downloadable file
    return new NextResponse(csvString, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="logistics-export-2026.csv"`,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
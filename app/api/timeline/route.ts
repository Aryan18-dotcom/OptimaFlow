import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/connectDB";
import { Trip } from "@/models/dataModels";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range");

    if (!range) {
        return NextResponse.json({ success: false, message: "Missing 'range' parameter" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        
        // 1. Logic to define start and end timestamps based on the 'range' string
        let startDate = new Date(1970, 0, 1).getTime();
        let endDate = new Date(2100, 0, 1).getTime();

        const parts = range.split("-");
        
        // Handle year-based or month-year based ranges
        if (parts.length === 1) { // Single Year (e.g., "2026")
            startDate = new Date(parseInt(parts[0]), 0, 1).getTime();
            endDate = new Date(parseInt(parts[0]), 11, 31, 23, 59, 59).getTime();
        } else if (parts.length === 2 && parseInt(parts[0]) <= 12) { // Month-Year (e.g., "05-2026")
            const month = parseInt(parts[0]) - 1;
            const year = parseInt(parts[1]);
            startDate = new Date(year, month, 1).getTime();
            endDate = new Date(year, month + 1, 0, 23, 59, 59).getTime();
        } else if (parts.length === 4) { // Range (e.g., "05-2026-06-2026")
            startDate = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1).getTime();
            endDate = new Date(parseInt(parts[3]), parseInt(parts[2]), 0, 23, 59, 59).getTime();
        }

        // 2. Query MongoDB using the timestamps
        const trips = await Trip.find({
            sort_timestamp: { $gte: startDate, $lte: endDate }
        }).sort({ sort_timestamp: 1 });

        // 3. Format response for your frontend
        const results = trips.map(t => ({
            id: t.id,
            date: t.trip_date_display,
            vehicleNumber: t.vehicle_number,
            driverName: t.driver_name || "N/A",
            routeSequence: t.route_sequence || "No Route Specified"
        }));

        if (results.length > 0) {
            return NextResponse.json({
                success: true,
                message: `Successfully retrieved ${results.length} logs.`,
                data: results
            });
        } else {
            return NextResponse.json({ success: false, message: "No logs found.", data: [] });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TRIPS_DIR = path.join(process.cwd(), "data", "trips");

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range");

    if (!range) {
        return NextResponse.json({ success: false, message: "Missing 'range' parameter" }, { status: 400 });
    }

    try {
        const files = fs.readdirSync(TRIPS_DIR).filter(f => f.startsWith("trips-") && f.endsWith(".json"));
        const results: any[] = [];
        const parts = range.split("-");

        files.forEach(file => {
            const match = file.match(/trips-(\d+)-(\d+)\.json/);
            if (!match) return;
            const fileYear = parseInt(match[2], 10);
            const fileMonth = parseInt(match[1], 10);

            let include = false;
            // ... (Keep your existing date filtering logic here)
            if (parts.length === 2 && parseInt(parts[0], 10) <= 12) {
                if (fileMonth === parseInt(parts[0], 10) && fileYear === parseInt(parts[1], 10)) include = true;
            } else if (parts.length === 1) {
                if (fileYear === parseInt(parts[0], 10)) include = true;
            } else if (parts.length === 2) {
                if (fileYear >= parseInt(parts[0], 10) && fileYear <= parseInt(parts[1], 10)) include = true;
            } else if (parts.length === 4) {
                const fileDate = new Date(fileYear, fileMonth - 1);
                if (fileDate >= new Date(parseInt(parts[1], 10), parseInt(parts[0], 10) - 1) && 
                    fileDate <= new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1)) include = true;
            }

            if (include) {
                const data = JSON.parse(fs.readFileSync(path.join(TRIPS_DIR, file), "utf-8"));
                data.forEach((group: any) => {
                    // Format the date here once for the frontend
                    const formattedDate = group.currentDay; 
                    
                    group.trips.forEach((t: any) => {
                        results.push({
                            id: t.id,
                            date: formattedDate, // Use group date
                            vehicleNumber: t.vehicleNumber,
                            driverName: t.driverName || "N/A",
                            routeSequence: t.routeSequence || "No Route Specified"
                        });
                    });
                });
            }
        });

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
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TRIPS_DIR = path.join(process.cwd(), "data", "trips");

function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper to determine the target trip file path based on a given date string ("2026-05-11")
function getTripsFilePath(dateString: string): string {
  ensureDirectoryExists(TRIPS_DIR);
  const dateObj = new Date(dateString);
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return path.join(TRIPS_DIR, `trips-${month}-${year}.json`);
}

function formatToSheetDate(dateString: string): string {
  const dateObj = new Date(dateString);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dateObj.getDate()}-${months[dateObj.getMonth()]}`;
}

// Fixed month index mapping handler to maintain cross-year time-sorting states
function parseDisplayDateToTime(displayDate: string, targetYear: number): number {
  const parts = displayDate.split("-"); // [ "11", "May" ]
  if (parts.length < 2) return 0;
  
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toLowerCase().substring(0, 3);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthIndex = months.indexOf(monthStr);
  
  // Safe validation check fallback
  const validMonth = monthIndex !== -1 ? monthIndex : 5;
  return new Date(targetYear, validMonth, day, 12, 0, 0).getTime(); // Mid-day stamp prevents UTC shifts
}

// ==========================================
//  POST PIPELINE: Save / Update Route Logs
// ==========================================
export async function POST(request: Request) {
  try {
    ensureDirectoryExists(TRIPS_DIR);

    const body = await request.json();
    const { data } = body; 

    if (!data || !data.date || !data.vehicleNumber) {
      return NextResponse.json(
        { success: false, message: "Missing required payload tracking configurations." },
        { status: 400 }
      );
    }

    const currentDayStr = formatToSheetDate(data.date);
    const targetVehicle = data.vehicleNumber.trim();
    const targetDriver = data.driverName.trim() || "None";
    const targetYear = new Date(data.date).getFullYear();

    const activeFilePath = getTripsFilePath(data.date);
    
    let dailyLogGroup: any[] = [];
    if (fs.existsSync(activeFilePath)) {
      const fileContent = fs.readFileSync(activeFilePath, "utf-8").trim();
      if (fileContent) dailyLogGroup = JSON.parse(fileContent);
    }

    let dayBucket = dailyLogGroup.find((group) => group.currentDay === currentDayStr);

    if (!dayBucket) {
      dayBucket = {
        currentDay: currentDayStr,
        trips: [],
      };
      dailyLogGroup.push(dayBucket);
    }

    const vehicleExistingTripIndex = dayBucket.trips.findIndex(
      (t: any) => t.vehicleNumber.toLowerCase() === targetVehicle.toLowerCase()
    );

    const tripDataPayload = {
      id: data.id || `TRIP-${targetVehicle}-${Date.now()}`,
      vehicleNumber: targetVehicle,
      driverName: targetDriver,
      routeSequence: data.routeSequence,
    };

    if (vehicleExistingTripIndex !== -1) {
      dayBucket.trips[vehicleExistingTripIndex] = tripDataPayload;
    } else {
      dayBucket.trips.push(tripDataPayload);
    }

    dailyLogGroup.sort((a, b) => {
      return parseDisplayDateToTime(a.currentDay, targetYear) - parseDisplayDateToTime(b.currentDay, targetYear);
    });

    fs.writeFileSync(activeFilePath, JSON.stringify(dailyLogGroup, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: `Log verified and successfully saved locally under shard [${path.basename(activeFilePath)}]`,
    });

  } catch (error: any) {
    console.error("Local JSON Write Pipeline Crash:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal Server Data Persistence Error" },
      { status: 500 }
    );
  }
}

// ==========================================
//  GET PIPELINE: Read & Stream Data Logs
// ==========================================
export async function GET() {
  try {
    ensureDirectoryExists(TRIPS_DIR);

    const files = fs.readdirSync(TRIPS_DIR).filter(f => f.startsWith("trips-") && f.endsWith(".json"));
    const flattenedTrips: any[] = [];

    files.forEach((file) => {
      const filePath = path.join(TRIPS_DIR, file);
      const fileContent = fs.readFileSync(filePath, "utf-8").trim();
      if (!fileContent) return;

      const dailyLogGroup = JSON.parse(fileContent);

      // Extract year value dynamically out of filename context ("trips-05-2026.json" -> 2026)
      const yearMatch = file.match(/trips-\d+-(\d+)\.json/);
      const fileYear = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

      dailyLogGroup.forEach((group: any) => {
        const isoFormattedDate = parseDisplayDateToTime(group.currentDay, fileYear);
        const dateInstance = new Date(isoFormattedDate);
        
        const yyyy = dateInstance.getFullYear();
        const mm = String(dateInstance.getMonth() + 1).padStart(2, "0");
        const dd = String(dateInstance.getDate()).padStart(2, "0");
        const yyyyMmDd = `${yyyy}-${mm}-${dd}`;

        group.trips.forEach((trip: any) => {
          flattenedTrips.push({
            id: trip.id,
            date: yyyyMmDd, 
            vehicleNumber: trip.vehicleNumber,
            driverName: trip.driverName,
            routeSequence: trip.routeSequence,
          });
        });
      });
    });

    // Chronologically sort compiled global stack output so May items line up seamlessly above June lines
    flattenedTrips.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      success: true,
      data: flattenedTrips,
    });

  } catch (error: any) {
    console.error("Local JSON Read Pipeline Crash:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal Server Data Reading Fault" },
      { status: 500 }
    );
  }
}

// ==========================================
//  DELETE PIPELINE: Remove Target Log Row
// ==========================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing required identifier parameter" },
        { status: 400 }
      );
    }

    ensureDirectoryExists(TRIPS_DIR);
    const files = fs.readdirSync(TRIPS_DIR).filter(f => f.startsWith("trips-") && f.endsWith(".json"));
    let removed = false;

    for (const file of files) {
      const filePath = path.join(TRIPS_DIR, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      let dailyLogGroup: any[] = JSON.parse(fileContent);

      let altered = false;
      dailyLogGroup = dailyLogGroup.map((group) => {
        const originalLength = group.trips.length;
        group.trips = group.trips.filter((trip: any) => trip.id !== id);
        if (group.trips.length !== originalLength) {
          altered = true;
          removed = true;
        }
        return group;
      }).filter((group) => group.trips.length > 0);

      if (altered) {
        fs.writeFileSync(filePath, JSON.stringify(dailyLogGroup, null, 2), "utf-8");
        break; // Purge action complete, exit lookups loop safely
      }
    }

    return NextResponse.json({
      success: removed,
      message: removed ? "Notary route log successfully removed from persistence layers." : "Log not found."
    });

  } catch (error: any) {
    console.error("Local JSON Delete Pipeline Crash:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal Server Data Removal Fault" },
      { status: 500 }
    );
  }
}

// import { NextResponse } from "next/server";

// const googleWebAppUrl = process.env.GOOGLE_APPS_WEB_APP_URL;

// export async function POST(request: Request) {
//   try {
//     if (!googleWebAppUrl) {
//       console.error("GOOGLE_APPS_WEB_APP_URL is missing");

//       return NextResponse.json(
//         {
//           success: false,
//           message: "Google Sheets integration is not configured",
//         },
//         { status: 500 }
//       );
//     }

//     const body = await request.json();
//     const { action, data } = body;

//     if (!action || !data) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Missing required payload parameters",
//         },
//         { status: 400 }
//       );
//     }

//     console.log("Sending to Google Apps Script:", {
//       action,
//       data,
//     });

//     const googleResponse = await fetch(googleWebAppUrl, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         action,
//         data,
//       }),
//       cache: "no-store",
//     });

//     const responseText = await googleResponse.text();
//     console.log("Response Data:-", responseText)

//     let result: any;

//     try {
//       result = JSON.parse(responseText);
//     } catch {
//       result = {
//         status: googleResponse.ok ? "success" : "error",
//         message: responseText,
//       };
//     }

//     if (!googleResponse.ok) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             result.message ||
//             `Google Apps Script returned ${googleResponse.status}`,
//         },
//         { status: 500 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message: result.message || "Data synced successfully",
//       data: result.data || null,
//     });
//   } catch (error: any) {
//     console.error("Sheets API Route Error:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message:
//           error?.message || "Internal Server Pipeline Interruption",
//       },
//       { status: 500 }
//     );
//   }
// }

// export async function GET() {
//   try {
//     const googleWebAppUrl = process.env.GOOGLE_APPS_WEB_APP_URL;

//     if (!googleWebAppUrl) {
//       return NextResponse.json(
//         { success: false, message: "Google Sheets integration not configured" },
//         { status: 500 }
//       );
//     }

//     const response = await fetch(googleWebAppUrl, {
//       method: "GET",
//       cache: "no-store",
//     });

//     const data = await response.json();
    
//     console.log("Live Sheets Data Matrix Extracted:", data);

//     // 3. Forward the clean JSON data structure directly back to the frontend
//     return NextResponse.json(data);

//   } catch (error: any) {
//     console.error("Sheets API GET Error Pipeline:", error);
//     return NextResponse.json(
//       { success: false, message: error?.message || "Pipeline error" },
//       { status: 500 }
//     );
//   }
// }
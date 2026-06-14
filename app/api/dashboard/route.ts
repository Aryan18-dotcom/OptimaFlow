import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TRIPS_DIR = path.join(process.cwd(), "data", "trips");
const RESOURCES_FILE_PATH = path.join(process.cwd(), "data", "resources.json");
const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "settings.json");

function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadJsonData(filePath: string, defaultFallback: any) {
  if (!fs.existsSync(filePath)) {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(defaultFallback, null, 2), "utf-8");
    return defaultFallback;
  }
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    return content ? JSON.parse(content) : defaultFallback;
  } catch (error) {
    return defaultFallback;
  }
}

// Helper to convert display string dates ("11-May") back to absolute epoch stamps for clean sorting
function parseDisplayDateToTime(displayDate: string, targetYear: number): number {
  const parts = displayDate.split("-");
  if (parts.length < 2) return 0;
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toLowerCase().substring(0, 3);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthIndex = months.indexOf(monthStr);
  return new Date(targetYear, monthIndex !== -1 ? monthIndex : 5, day, 12, 0, 0).getTime();
}

function parseRouteSequenceToLegs(sequenceStr: string) {
  if (!sequenceStr) return [{ location: "No Data", type: "None" }];

  return sequenceStr.split("-").map(legText => {
    let type: "LD" | "MT" | "Parking" | "None" = "None";
    let customTag = undefined;
    let location = legText;

    const tagMatch = location.match(/\[([^\]]+)\]/);
    if (tagMatch) { customTag = tagMatch[1]; location = location.replace(/\[[^\]]+\]/, ""); }

    const typeMatch = location.match(/\(([^)]+)\)/);
    if (typeMatch) {
      const parsedType = typeMatch[1].trim().toUpperCase();
      if (parsedType === "LD" || parsedType === "MT" || parsedType === "PARKING") {
        type = parsedType === "PARKING" ? "Parking" : (parsedType as any);
      }
      location = location.replace(/\([^)]+\)/, "");
    }
    return { location: location.trim(), type, customTag };
  });
}

// ==========================================
//  GET: AGGREGATE METRICS & SYSTEM SETTINGS
// ==========================================
export async function GET() {
  try {
    ensureDirectoryExists(TRIPS_DIR);

    // 1. Load basic registries
    const resourcesDb = loadJsonData(RESOURCES_FILE_PATH, { drivers: [], trucks: [], assignments: [] });

    const defaultSettings = {
      sheetLink: "https://docs.google.com/spreadsheets/d/1x9B_Notary_Transit_v6Zk/edit",
      companyName: "Chheda Roadways Logistics",
      companyLogoText: "CR",
      logoImage: null,
      billUI: {
        themeColor: "#0284c7",
        fontStyle: "sans",
        showGst: true,
        showSignature: true,
        termsText: "1. All disputes are subject to local jurisdiction laws.\n2. Payment must accompany standard freight receipt signatures.",
        companyAddress: "Logistics Hub, Sarkhej-Gandhinagar Highway, Ahmedabad, Gujarat",
        footerNotes: "Thank you for trusting us with your supply chain cargo!"
      }
    };
    const systemSettings = loadJsonData(SETTINGS_FILE_PATH, defaultSettings);

    // 2. Compute dynamic time parameters for "Today's Total Trips" tracking
    const todayLocal = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const todayKeyString = `${todayLocal.getDate()}-${months[todayLocal.getMonth()]}`;

    let totalTripsTodayCount = 0;
    const compiledTripsFeed: any[] = [];

    // 3. Scan the trips folder to aggregate logs dynamically across all shards
    const tripFiles = fs.readdirSync(TRIPS_DIR).filter(f => f.startsWith("trips-") && f.endsWith(".json"));

    tripFiles.forEach((file) => {
      const filePath = path.join(TRIPS_DIR, file);
      const fileContent = fs.readFileSync(filePath, "utf-8").trim();
      if (!fileContent) return;

      const dailyLogMatrix = JSON.parse(fileContent);

      // Determine shard file year context dynamically
      const yearMatch = file.match(/trips-\d+-(\d+)\.json/);
      const fileYear = yearMatch ? parseInt(yearMatch[1], 10) : todayLocal.getFullYear();

      dailyLogMatrix.forEach((group: any) => {
        // If the parsed date context matches today's date stamp, collect the length
        if (group.currentDay === todayKeyString && fileYear === todayLocal.getFullYear()) {
          totalTripsTodayCount = group.trips.length;
        }

        group.trips.forEach((trip: any) => {
          compiledTripsFeed.push({
            id: trip.id,
            dateString: group.currentDay,
            timestamp: parseDisplayDateToTime(group.currentDay, fileYear),
            assetPlate: trip.vehicleNumber,
            operatorPilot: trip.driverName,
            routeSequence: trip.routeSequence,
            legs: parseRouteSequenceToLegs(trip.routeSequence),
            status: trip.routeSequence.toLowerCase().includes("parking") ? "Delayed" : "In Transit"
          });
        });
      });
    });

    // 4. Sort compiled logs timeline in descending order (newest items on top)
    compiledTripsFeed.sort((a, b) => b.timestamp - a.timestamp);

    // 5. Calculate vehicle statistics from your resources asset logs
    const registeredTrucksCount = resourcesDb.trucks.length;
    const activeAssignmentsCount = resourcesDb.assignments.length;
    const unassignedFleetCount = Math.max(0, registeredTrucksCount - activeAssignmentsCount);

    const trucksOnRoadCount = resourcesDb.trucks.filter((t: any) => t.status === "active").length;
    const trucksInMaintenanceCount = resourcesDb.trucks.filter((t: any) => t.status === "under maintenance" || t.status === "accidental").length;

    return NextResponse.json({
      success: true,
      metrics: {
        assignmentsDistribution: `${activeAssignmentsCount} / ${registeredTrucksCount}`,
        unassignedCountText: `${unassignedFleetCount} Vehicles unassigned`,
        fleetsOnRoad: trucksOnRoadCount,
        fleetsUnavailable: trucksInMaintenanceCount,
        totalTripsToday: totalTripsTodayCount
      },
      // Keep feed capped to top 15 rows for clear page loads
      activeLogsTable: compiledTripsFeed,
      settings: systemSettings
    });

  } catch (error: any) {
    console.error("Dashboard compilation error:", error);
    return NextResponse.json({ success: false, message: error?.message || "Aggregation layer error" }, { status: 500 });
  }
}

// ==========================================
//  POST: SAVE ALL SYSTEM SETTINGS DIRECTLY
// ==========================================
export async function POST(request: Request) {
  try {
    const updatedSettingsPayload = await request.json();

    if (!updatedSettingsPayload || typeof updatedSettingsPayload !== "object") {
      return NextResponse.json({ success: false, message: "Invalid settings structural content" }, { status: 400 });
    }

    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updatedSettingsPayload, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "Branding and system control configurations saved successfully.",
      settings: updatedSettingsPayload
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Save operation failed" }, { status: 500 });
  }
}
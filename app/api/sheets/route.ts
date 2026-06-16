import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/connectDB";
import { Trip } from "@/models/dataModels";

// ==========================================
//  POST: Save / Update Trip Logs
// ==========================================
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { data } = await request.json();

    if (!data || !data.date || !data.vehicleNumber) {
      return NextResponse.json(
        { success: false, message: "Missing required payload tracking configurations." },
        { status: 400 }
      );
    }

    // Helper: Convert "2026-05-11" to "11-May-2026"
    const dateObj = new Date(data.date);

    const tripPayload = {
      id: data.id || `TRIP-${data.vehicleNumber.trim()}-${Date.now()}`,
      trip_date_display: data.date, 
      sort_timestamp: dateObj.getTime(), 
      vehicle_number: data.vehicleNumber.trim(),
      driver_name: data.driverName?.trim() || "None",
      route_sequence: data.routeSequence,
    };

    await Trip.findOneAndUpdate(
      { id: tripPayload.id },
      tripPayload,
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      message: "Log successfully persisted to MongoDB.",
    });
  } catch (error: any) {
    console.error("MongoDB Write Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Persistence Error" },
      { status: 500 }
    );
  }
}

// ==========================================
//  GET: Read & Stream Data Logs
// ==========================================
export async function GET() {
  try {
    await connectToDatabase();

    const trips = await Trip.find({}).sort({ sort_timestamp: -1 });

    // 2. Format for your existing frontend
    const flattenedTrips = trips.map(t => ({
      id: t.id,
      date: t.trip_date_display, 
      vehicleNumber: t.vehicle_number,
      driverName: t.driver_name,
      routeSequence: t.route_sequence,
    }));

    return NextResponse.json({ 
      success: true, 
      data: flattenedTrips 
    });
    
  } catch (error: any) {
    console.error("MongoDB Read Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Reading Fault" },
      { status: 500 }
    );
  }
}

// ==========================================
//  DELETE: Remove Log Row
// ==========================================
export async function DELETE(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing identifier" }, { status: 400 });
    }

    const result = await Trip.findOneAndDelete({ id });

    return NextResponse.json({
      success: !!result,
      message: result ? "Log successfully removed." : "Log not found."
    });
  } catch (error: any) {
    console.error("MongoDB Delete Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Removal Fault" },
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
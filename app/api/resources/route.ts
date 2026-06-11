import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RES_FILE_PATH = path.join(process.cwd(), "data", "resources.json");

type DriverStatus = "home" | "hospital" | "active" | "leaved" | "inActive";
type TruckStatus = "active" | "inActive" | "under maintenance" | "accidental";

interface Driver {
  id: string;
  name: string;
  phone: string;
  status: DriverStatus;
}

interface Truck {
  id: string;
  plateNumber: string;
  model: string;
  ownerName: string;
  status: TruckStatus;
}

interface Assignment {
  truckId: string;
  driverId: string;
  assignedAt: string;
}

interface Database {
  drivers: Driver[];
  trucks: Truck[];
  assignments: Assignment[];
}

function ensureResourceDB() {
  const dirPath = path.dirname(RES_FILE_PATH);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  if (!fs.existsSync(RES_FILE_PATH)) {
    const baseState: Database = { drivers: [], trucks: [], assignments: [] };
    fs.writeFileSync(RES_FILE_PATH, JSON.stringify(baseState, null, 2), "utf-8");
  }
}

function readDB(): Database {
  ensureResourceDB();
  return JSON.parse(fs.readFileSync(RES_FILE_PATH, "utf-8"));
}

function writeDB(data: Database) {
  fs.writeFileSync(RES_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  try {
    const db = readDB();
    return NextResponse.json({ success: true, ...db });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Read Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;
    const db = readDB();

    switch (action) {
      case "addDriver":
        // Clean phone numbers to compare them accurately
        const incomingPhone = payload.phone.trim().replace(/\s+/g, "");
        
        // Strict Check: Ensure a driver with this exact phone number isn't already registered
        const isDuplicatePhone = db.drivers.some(
          d => d.phone.trim().replace(/\s+/g, "") === incomingPhone
        );

        if (isDuplicatePhone) {
          return NextResponse.json(
            { success: false, message: "An operator with this contact phone number already exists in the system." },
            { status: 400 }
          );
        }
        
        db.drivers.push(payload);
        break;

      case "updateDriverStatus":
        db.drivers = db.drivers.map(d => d.id === payload.id ? { ...d, status: payload.status } : d);
        break;

      case "addTruck":
        if (db.trucks.some(t => t.plateNumber.toLowerCase() === payload.plateNumber.toLowerCase())) {
          return NextResponse.json({ success: false, message: "Plate number already exists." }, { status: 400 });
        }
        db.trucks.push(payload);
        
        if (payload.directDriverId) {
          db.assignments = db.assignments.filter(a => a.driverId !== payload.directDriverId);
          db.assignments.push({
            truckId: payload.id,
            driverId: payload.directDriverId,
            assignedAt: new Date().toISOString()
          });
        }
        break;

      case "updateTruckStatus":
        db.trucks = db.trucks.map(t => t.id === payload.id ? { ...t, status: payload.status } : t);
        break;

      case "assign":
        const { truckId, driverId } = payload;
        db.assignments = db.assignments.filter(a => a.truckId !== truckId);
        
        if (driverId) {
          if (db.assignments.some(a => a.driverId === driverId)) {
            return NextResponse.json({ success: false, message: "Operator is already linked to another truck resource configuration." }, { status: 400 });
          }
          db.assignments.push({ truckId, driverId, assignedAt: new Date().toISOString() });
        }
        break;

      case "deleteDriver":
        db.drivers = db.drivers.filter(d => d.id !== payload.id);
        db.assignments = db.assignments.filter(a => a.driverId !== payload.id);
        break;

      case "deleteTruck":
        db.trucks = db.trucks.filter(t => t.id !== payload.id);
        db.assignments = db.assignments.filter(a => a.truckId !== payload.id);
        break;

      default:
        return NextResponse.json({ success: false, message: "Action fallback error" }, { status: 400 });
    }

    writeDB(db);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Write Error" }, { status: 500 });
  }
}
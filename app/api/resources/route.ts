import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/connectDB";
import { Resource } from "@/models/dataModels";

// ==========================================
//  GET: Fetch all resources
// ==========================================
export async function GET() {
  try {
    await connectToDatabase();

    // Fetch all resources at once
    const allResources = await Resource.find({});

    // Group them for your existing frontend structure
    const drivers = allResources.filter(r => r.category === 'driver');
    const trucks = allResources.filter(r => r.category === 'truck');
    const assignments = allResources.filter(r => r.category === 'assignment');

    return NextResponse.json({ success: true, drivers, trucks, assignments });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// ==========================================
//  POST: Resource CRUD Actions
// ==========================================
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { action, payload } = await request.json();

    switch (action) {
      case "addDriver":
        const phoneClean = payload.phone.trim().replace(/\s+/g, "");
        const existingDriver = await Resource.findOne({ category: 'driver', 'details.phone': phoneClean });
        if (existingDriver) {
          return NextResponse.json({ success: false, message: "Driver already exists." }, { status: 400 });
        }
        await Resource.create({ name: payload.name, category: 'driver', details: payload });
        break;

      case "updateDriverStatus":
        // 1. Find if this driver is currently assigned
        const assignment = await Resource.findOne({
          category: 'assignment',
          'details.driverId': payload.id
        });

        if (assignment) {
          // 2. Remove the assignment
          await Resource.deleteMany({
            category: 'assignment',
            'details.driverId': payload.id
          });

          // 3. Update the associated Truck's status to "inActive"
          // We use the truckId found in the assignment document
          await Resource.findOneAndUpdate(
            { category: 'truck', 'details.id': assignment.details.truckId },
            { $set: { "details.status": "inActive" } }
          );
        }

        // 4. Finally, update the driver's own status
        await Resource.findOneAndUpdate(
          { category: 'driver', 'details.id': payload.id },
          { $set: { "details.status": payload.status } }
        );
        break;

      case "addTruck":
        await Resource.create({ name: payload.plateNumber, category: 'truck', details: payload });
        if (payload.directDriverId) {
          // Logic for immediate assignment
          await Resource.deleteMany({ category: 'assignment', 'details.driverId': payload.directDriverId });
          await Resource.create({
            name: "assignment",
            category: 'assignment',
            details: { truckId: payload.id, driverId: payload.directDriverId, assignedAt: new Date() }
          });
        }
        break;

      case "updateTruckStatus":
        await Resource.findOneAndUpdate({ id: payload.id }, { "details.status": payload.status });
        break;

      case "assign":
        await Resource.deleteMany({ category: 'assignment', 'details.truckId': payload.truckId });
        if (payload.driverId) {
          await Resource.create({
            name: `Assignment-${payload.truckId}`,
            category: 'assignment',
            details: payload
          });
        }
        break;

      case "deleteDriver":
        await Resource.findOneAndDelete({ id: payload.id });
        await Resource.deleteMany({ category: 'assignment', 'details.driverId': payload.id });
        break;

      case "deleteTruck":
        await Resource.findOneAndDelete({ id: payload.id });
        await Resource.deleteMany({ category: 'assignment', 'details.truckId': payload.truckId });
        break;

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
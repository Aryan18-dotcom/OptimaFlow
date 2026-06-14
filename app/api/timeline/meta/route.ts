// app/api/timeline/meta/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TRIPS_DIR = path.join(process.cwd(), "data", "trips");

export async function GET() {
  const files = fs.readdirSync(TRIPS_DIR).filter(f => f.startsWith("trips-") && f.endsWith(".json"));
  
  const dates = files.map(f => {
    const match = f.match(/trips-(\d+)-(\d+)\.json/);
    if (!match) return null;
    
    // Construct the date at NOON (12:00) to safely avoid timezone shifts
    // months are 0-indexed, so parseInt(match[1]) - 1 is correct for May (4)
    return new Date(parseInt(match[2]), parseInt(match[1]) - 1, 1, 12, 0, 0);
  }).filter(Boolean) as Date[];

  const start = new Date(Math.min(...dates.map(d => d.getTime())));
  const end = new Date(Math.max(...dates.map(d => d.getTime())));

  return NextResponse.json({
    // Use .getUTCFullYear() and .getUTCMonth() to ensure the date matches the YYYY-MM format correctly
    start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
  });
}
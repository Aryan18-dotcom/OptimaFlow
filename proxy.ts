import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  // 1. Bypass IP check entirely if running in development mode
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // 2. Get the allowed IPs from environment variables
  const allowedIps = process.env.ALLOWED_IPS?.split(",").map((ip) => ip.trim()) ?? [];

  // 3. Safely get the client IP
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : null;

  // 4. Validate IP availability
  if (!ip) {
    return new NextResponse("Access Denied: Unable to determine IP", { status: 403 });
  }

  // 5. Check if the IP is in the allowed list
  if (!allowedIps.includes(ip)) {
    console.warn(`Blocked access attempt from IP: ${ip}`);
    return new NextResponse("Access Denied", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
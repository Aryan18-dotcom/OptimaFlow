import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // 1. Allow public routes
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // 2. Check for credentials
  const token = req.cookies.get("accessToken");
  const deviceId = req.cookies.get("deviceId");

  // 3. If missing, redirect to login
  if (!token || !deviceId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 4. If user is at /login but has a session, send to dashboard
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
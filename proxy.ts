import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token = req.cookies.get("accessToken");
  const deviceId = req.cookies.get("deviceId");

  if (!token || !deviceId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
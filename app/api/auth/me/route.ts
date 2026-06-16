import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken');

  if (!token) return NextResponse.json({ authenticated: false });

  try {
    jwt.verify(token.value, process.env.JWT_SECRET || "your-secret-key");
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
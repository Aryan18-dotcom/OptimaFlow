import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { User } from '@/models/dataModels';
import { connectToDatabase } from '@/lib/connectDB';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  
  if (!token) return NextResponse.json({ role: null });

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    await connectToDatabase();
    const user = await User.findById(decoded.userId);
    return NextResponse.json({ role: user?.role || 'user' });
  } catch (error: any) {
    // If the error is specifically that the token expired
    if (error.name === 'TokenExpiredError') {
      console.log("Access token expired, please refresh.");
      return NextResponse.json({ role: 'expired' }); // Notify frontend to refresh
    }
    return NextResponse.json({ role: null });
  }
}
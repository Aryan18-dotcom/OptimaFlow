import { NextResponse } from 'next/server';
import { User } from '@/models/dataModels';
import { connectToDatabase } from '@/lib/connectDB';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function POST(request: Request) {
    try {
        await connectToDatabase();
        const { action, payload, deviceId } = await request.json();

        switch (action) {
            case 'register': {
                // 1. Get the role from the request URL
                const { searchParams } = new URL(request.url);
                const roleParam = searchParams.get('role');

                // 2. Define the user data, defaulting to 'user' if not 'admin'
                const userData = {
                    ...payload,
                    password: await bcrypt.hash(payload.password, 10),
                    deviceId,
                    role: roleParam === 'admin' ? 'admin' : 'user' // Set role based on query param
                };

                const newUser = await User.create(userData);

                const accessToken = jwt.sign(
                    { userId: newUser._id, role: newUser.role },
                    JWT_SECRET,
                    { expiresIn: '15m' }
                );

                const response = NextResponse.json({ success: true, userId: newUser._id });

                response.cookies.set("accessToken", accessToken, { httpOnly: true, secure: true, sameSite: 'lax' });
                response.cookies.set("deviceId", deviceId, { httpOnly: true, secure: true, sameSite: 'lax' });

                return response;
            }

            case 'login': {
                // Convert payload.phone to a Number to match the $numberLong type in DB
                const phoneNumber = Number(payload.phone);
                const user = await User.findOne({ phone: phoneNumber });

                if (!user) {
                    console.log("No user found for phone:", phoneNumber);
                    return NextResponse.json({ success: false, message: "User not found." }, { status: 401 });
                }

                const isMatch = await bcrypt.compare(payload.password, user.password);

                if (!isMatch) {
                    return NextResponse.json({ success: false, message: "Invalid credentials." }, { status: 401 });
                }

                if (user.deviceId && user.deviceId !== deviceId) {
                    return NextResponse.json({ success: false, message: "Unauthorized device." }, { status: 403 });
                }

                const accessToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '15m' });
                const response = NextResponse.json({ success: true, userId: user._id });

                response.cookies.set("accessToken", accessToken, { httpOnly: true, secure: true, sameSite: 'lax' });
                response.cookies.set("deviceId", deviceId, { httpOnly: true, secure: true, sameSite: 'lax' });

                return response;
            }

            case 'verify-device': {
                const user = await User.findById(payload.userId);
                if (!user || user.deviceId !== deviceId) {
                    return NextResponse.json({ success: false, message: "Unauthorized device." }, { status: 403 });
                }
                return NextResponse.json({ success: true });
            }

            case 'send-otp': {
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                await User.findOneAndUpdate({ phone: payload.phone }, {
                    otp: { code: otp, expiresAt: new Date(Date.now() + 5 * 60000) }
                });
                return NextResponse.json({ success: true, otp });
            }

            case 'verify-otp': {
                const u = await User.findOne({ phone: payload.phone, 'otp.code': payload.otp });
                if (u && u.otp.expiresAt > new Date()) {
                    await User.updateOne({ _id: u._id }, { isVerified: true, otp: null });
                    return NextResponse.json({ success: true });
                }
                return NextResponse.json({ success: false, message: "Invalid or expired OTP." }, { status: 400 });
            }

            case 'update-password': {
                const newHash = await bcrypt.hash(payload.newPassword, 10);
                await User.findByIdAndUpdate(payload.userId, { password: newHash });
                return NextResponse.json({ success: true });
            }

            case 'refresh': {
                try {
                    const decoded: any = jwt.verify(payload.refreshToken, JWT_SECRET);
                    const accessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '15m' });
                    return NextResponse.json({ success: true, accessToken });
                } catch {
                    return NextResponse.json({ success: false, message: "Invalid refresh token." }, { status: 401 });
                }
            }

            case 'logout': {
                const response = NextResponse.json({ success: true, message: "Logged out successfully" });

                // Expire the cookies by setting their maxAge to 0
                response.cookies.set("accessToken", "", {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    expires: new Date(0)
                });
                response.cookies.set("deviceId", "", {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    expires: new Date(0)
                });

                return response;
            }

            case 'add-user': {
                const hashedPassword = await bcrypt.hash(payload.password, 10);
                await User.create({
                    name: payload.name,
                    phone: payload.phone,
                    password: hashedPassword,
                    role: payload.role || 'user'
                });

                return NextResponse.json({ success: true, message: "User created successfully" });
            }

            default:
                return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
        }
    } catch (error: any) {
        console.error("Auth System Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
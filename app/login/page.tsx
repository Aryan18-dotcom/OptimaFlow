"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { toast } from "react-toastify";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [formData, setFormData] = useState({ name: "", phone: "", password: "" });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Verify session via the secure auth/me route
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        
        if (data.authenticated) {
          router.replace("/"); // Redirect to dashboard
          return;
        }
      } catch (error) {
        console.error("Auth check failed", error);
      }
      
      // 2. Initialize Fingerprint only if not authenticated
      const fpPromise = FingerprintJS.load();
      const fp = await fpPromise;
      const result = await fp.get();
      setDeviceId(result.visitorId);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: isLogin ? "login" : "register", 
        payload: formData, 
        deviceId 
      }),
    });

    const data = await res.json();
    
    if (data.success) {
      toast.success(isLogin ? "Welcome back!" : "Registered successfully!");
      // Force reload to ensure middleware catches the new HttpOnly cookies
      window.location.href = "/"; 
    } else {
      toast.error(data.message || "Authentication failed");
    }
  };

  if (loading) return null; // Prevents layout flickering

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">{isLogin ? "Login" : "Sign Up"}</h1>
        {!isLogin && (
          <input 
            type="text" placeholder="Full Name" required 
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full p-3 border rounded-lg"
          />
        )}
        <input 
          type="text" placeholder="Phone Number" required 
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          className="w-full p-3 border rounded-lg"
        />
        <input 
          type="password" placeholder="Password" required 
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          className="w-full p-3 border rounded-lg"
        />
        <button className="w-full bg-slate-900 text-white p-3 rounded-lg font-bold">
          {isLogin ? "Log In" : "Register"}
        </button>
        <p className="text-xs text-center cursor-pointer" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
        </p>
      </form>
    </div>
  );
}
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

export default function AdminPage() {
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ name: '', phone: '', password: '', role: 'user' });
    const router = useRouter();

    useEffect(() => {
        const checkRole = async () => {
            const res = await fetch("/api/auth/role");
            const data = await res.json();
            if (data.role !== 'admin') {
                toast.error("Access Denied: Admins only.");
                router.push("/");
            } else {
                setLoading(false);
            }
        };
        checkRole();
    }, [router]);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add-user", payload: formData }),
        });

        const data = await res.json();
        if (data.success) {
            toast.success("User added successfully!");
            setFormData({ name: '', phone: '', password: '', role: 'user' }); // Clear form
        } else {
            toast.error(data.message || "Failed to add user");
        }
    };

    if (loading) return null;

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
            <form onSubmit={handleAddUser} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 space-y-4">
                <h2 className="text-lg font-semibold">Add New User</h2>
                <input 
                    type="text" placeholder="Full Name" required 
                    className="w-full p-3 border rounded-xl"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
                <input 
                    type="text" placeholder="Phone Number" required 
                    className="w-full p-3 border rounded-xl"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
                <input 
                    type="password" placeholder="Password" required 
                    className="w-full p-3 border rounded-xl"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
                <select 
                    className="w-full p-3 border rounded-xl"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
                <button type="submit" className="w-full bg-sky-600 text-white p-3 rounded-xl font-bold hover:bg-sky-700">
                    Create User
                </button>
            </form>
        </div>
    );
}
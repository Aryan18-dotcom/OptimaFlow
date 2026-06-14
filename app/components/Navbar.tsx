"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", path: "/", description: "Logistics control dashboard" },
    { label: "Daily Notary", path: "/notary", description: "Daily notary logs" },
    { label: "Generations", path: "/generations", description: "Logistics bill generation" },
    { label: "Configurations", path: "/config", description: "System configurations" },
    { label: "Settings", path: "/settings", description: "System Settings" },
  ];

  return (
    <header className="w-full px-4 py-4 md:px-8 md:pt-6 sticky top-0 z-50">
      <nav 
        role="navigation" 
        aria-label="Main Menu"
        className="max-w-[1600px] mx-auto bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-2xl px-4 py-3 md:px-6 shadow-sm flex items-center justify-between z-50 relative"
      >
        <Link href="/" aria-label="LogiSync Home" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-xl bg-sky-600 flex items-center justify-center text-white font-extrabold text-sm">LS</div>
          <span className="font-bold text-base text-slate-900">
            LogiSync<span className="text-sky-600 font-medium">.erp</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <ul className="hidden md:flex items-center gap-1 list-none">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path} className={`relative px-3 py-2 text-sm font-semibold rounded-xl block transition-colors ${pathname === item.path ? "text-sky-700" : "text-slate-600"}`}>
                {pathname === item.path && <motion.div layoutId="nav" className="absolute inset-0 bg-sky-50 rounded-xl" />}
                <span className="relative z-10">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile Toggle Button */}
        <button className="md:hidden p-2 text-slate-600 z-50" onClick={() => setIsOpen(true)}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </nav>

      {/* Full-Screen Mobile Slide-Over */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-white/70 backdrop-blur-2xl p-8 pt-24 md:hidden"
          >
            <button onClick={() => setIsOpen(false)} className="absolute top-6 right-6 p-2 text-slate-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <ul className="list-none space-y-4">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link 
                    href={item.path} 
                    onClick={() => setIsOpen(false)}
                    className={`block text-2xl font-bold py-4 border-b border-neutral-200 ${pathname === item.path ? "text-sky-600" : "text-slate-800"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
"use client";

import React from "react";
import Link from "next/link";
import { redirect, usePathname } from "next/navigation";
import { motion } from "framer-motion";

export default function Navbar() {
  const pathname = usePathname();

  // Navigation Links array representing all your custom dashboard modules
  const navItems = [
    { label: "Dashboard", path: "/" },
    { label: "Daily Notary", path: "/notary" },
    { label: "Generations", path: "/generations" },
    { label: "Configurations", path: "/config" },
  ];

  return (
    <header className="w-full px-4 pt-4 md:px-8 md:pt-6 sticky top-0 z-50 pointer-events-none">
      <nav className="max-w-[1600px] mx-auto bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-2xl px-4 py-3 md:px-6 shadow-sm flex items-center justify-between pointer-events-auto transition-shadow hover:shadow-md">
        
        {/* --- BRAND BRANDING --- */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-xl bg-sky-600 flex items-center justify-center text-white font-extrabold text-sm tracking-tighter transition-transform group-hover:scale-105 active:scale-95">
            LS
          </div>
          <span className="font-bold text-base tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors">
            LogiSync<span className="text-sky-600 font-medium">.erp</span>
          </span>
        </Link>

        {/* --- ROUTE LINKS DECK --- */}
        <div className="flex items-center gap-1 md:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className="relative px-3 py-2 text-xs md:text-sm font-semibold transition-colors rounded-xl cursor-pointer select-none text-slate-600 hover:text-slate-900"
              >
                {/* Text Content Layer */}
                <span className={`relative z-10 transition-colors duration-200 ${isActive ? "text-sky-700" : ""}`}>
                  {item.label}
                </span>

                {/* Micro-interaction sliding hover background pill */}
                {isActive && (
                  <motion.div
                    layoutId="navbarActiveIndicator"
                    className="absolute inset-0 bg-sky-50 border border-sky-100/40 rounded-xl"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* --- USER/STATUS PROFILE INDICATOR --- */}
        <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-neutral-200">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-800">Admin Control</div>
            <div className="text-[10px] text-emerald-600 font-semibold tracking-wide flex items-center gap-1 justify-end">
              <span className="h-1 w-1 rounded-full bg-emerald-500 inline-block animate-ping" />
              Online
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="h-8 w-8 rounded-full bg-neutral-200 border border-neutral-300 flex items-center justify-center font-bold text-xs text-slate-600 cursor-pointer shadow-inner"
            onClick={()=> redirect('/settings')}
          >
            <span>A</span>
          </motion.button>
        </div>

      </nav>
    </header>
  );
}
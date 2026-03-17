/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  CalendarDays,
  Users,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useViewMode } from "./ViewContext";

const NAV_ITEMS = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/my-appointments", label: "My Appointments", icon: CalendarDays },
  { href: "/my-household", label: "My Household", icon: Users },
];

export default function PatientSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { setViewMode } = useViewMode();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState<{ top: number; height: number } | null>(null);
  const [pillReady, setPillReady] = useState(false);

  useEffect(() => {
    const activeIndex = NAV_ITEMS.findIndex((item) => item.href === pathname);
    const el = itemRefs.current[activeIndex];
    const nav = navRef.current;
    if (!el || !nav) return;

    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setPillStyle({
      top: elRect.top - navRect.top,
      height: elRect.height,
    });

    if (!pillReady) {
      requestAnimationFrame(() => setPillReady(true));
    }
  }, [pathname, collapsed, pillReady]);

  return (
    <aside
      className={`glass-sidebar fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-300 ease-out ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
      style={{ position: "fixed" }}
    >
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo */}
        <div className="px-4 h-16 flex items-center gap-3 shrink-0 select-none">
          <div className="w-9 h-9 shrink-0">
            <Image
              src="/ai_resonate_logo.jpeg"
              alt="Resonate"
              width={36}
              height={36}
              className="rounded-xl w-9 h-9"
            />
          </div>
          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{ width: collapsed ? 0 : 160, opacity: collapsed ? 0 : 1 }}
          >
            <div className="text-[15px] font-semibold tracking-tight leading-tight whitespace-nowrap" style={{ color: "var(--resonate-dark)" }}>
              Resonate
            </div>
            <div className="text-[10px] uppercase tracking-widest whitespace-nowrap" style={{ color: "rgba(50, 69, 62, 0.45)" }}>
              Dental Care
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="glass-divider mx-3" />

        {/* Nav */}
        <nav ref={navRef} className="relative flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {pillStyle && (
            <div
              className="absolute left-2 right-2 glass-nav-active rounded-xl pointer-events-none"
              style={{
                top: pillStyle.top,
                height: pillStyle.height,
                transition: pillReady ? "top 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
              }}
            />
          )}

          {NAV_ITEMS.map((item, index) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                ref={(el) => { itemRefs.current[index] = el; }}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  active ? "" : "glass-nav-hover"
                }`}
                style={{
                  color: active ? "var(--resonate-dark)" : "rgba(50, 69, 62, 0.55)",
                }}
              >
                <div className="relative shrink-0">
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <span
                  className="overflow-hidden transition-all duration-300 ease-out whitespace-nowrap"
                  style={{ width: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="glass-divider mx-3" />

        {/* Bottom section */}
        <div className="px-2 pb-4 pt-3 space-y-0.5">
          {/* Admin View button */}
          <button
            onClick={() => setViewMode("admin")}
            className="glass-nav-hover flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm w-full transition-all duration-200"
            style={{ color: "rgba(50, 69, 62, 0.55)" }}
          >
            <div className="w-[18px] h-[18px] shrink-0">
              <ShieldCheck className="w-[18px] h-[18px]" />
            </div>
            <span
              className="overflow-hidden transition-all duration-300 ease-out whitespace-nowrap"
              style={{ width: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
            >
              Admin View
            </span>
          </button>

          <button
            onClick={onToggle}
            className="glass-nav-hover flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm w-full transition-all duration-200"
            style={{ color: "rgba(50, 69, 62, 0.4)" }}
          >
            <div className="w-[18px] h-[18px] shrink-0 transition-transform duration-300 ease-out" style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}>
              <ChevronLeft className="w-[18px] h-[18px]" />
            </div>
            <span
              className="overflow-hidden transition-all duration-300 ease-out whitespace-nowrap"
              style={{ width: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
            >
              Collapse
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}

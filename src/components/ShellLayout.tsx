/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import PatientSidebar from "./PatientSidebar";
import { NotificationProvider } from "./NotificationContext";
import { ViewProvider, useViewMode } from "./ViewContext";

function ShellContent({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { viewMode } = useViewMode();

  return (
    <>
      {/* Ambient gradient mesh — gives glass sidebar content to refract */}
      <div className="ambient-bg" />

      {viewMode === "admin" ? (
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      ) : (
        <PatientSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      )}
      <div
        className="relative z-10 min-h-screen transition-all duration-300 ease-out"
        style={{ paddingLeft: collapsed ? 68 : 240 }}
      >
        {children}
      </div>
    </>
  );
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewProvider>
      <NotificationProvider>
        <ShellContent>{children}</ShellContent>
      </NotificationProvider>
    </ViewProvider>
  );
}

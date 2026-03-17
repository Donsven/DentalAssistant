/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ViewMode = "patient" | "admin";

interface ViewContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewContext = createContext<ViewContextType>({
  viewMode: "patient",
  setViewMode: () => {},
});

export function ViewProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>("patient");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("view_mode");
    if (stored === "admin" || stored === "patient") {
      setViewMode(stored);
    }
    setLoaded(true);
  }, []);

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("view_mode", mode);
  };

  if (!loaded) return null;

  return (
    <ViewContext.Provider value={{ viewMode, setViewMode: handleSetViewMode }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewContext);
}

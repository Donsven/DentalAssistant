/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import { createContext, useContext, useState } from "react";

interface Notification {
  id: string;
  message: string;
  type: "info" | "emergency" | "appointment";
  timestamp: string;
  read: boolean;
}

const NotificationContext = createContext<{
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAllRead: () => void;
}>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAllRead: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = (n: Omit<Notification, "id" | "timestamp" | "read">) => {
    setNotifications((prev) => [
      {
        ...n,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        read: false,
      },
      ...prev,
    ]);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

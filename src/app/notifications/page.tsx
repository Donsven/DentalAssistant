/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import { useNotifications } from "@/components/NotificationContext";
import { Bell, AlertTriangle, CalendarDays, Info, CheckCheck } from "lucide-react";

const typeIcons = {
  info: Info,
  emergency: AlertTriangle,
  appointment: CalendarDays,
};

const typeColors = {
  info: "text-blue-500 bg-blue-50",
  emergency: "text-red-500 bg-red-50",
  appointment: "text-green-500 bg-green-50",
};

export default function NotificationsPage() {
  const { notifications, unreadCount, markAllRead } = useNotifications();

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Notifications</h1>
          <p className="text-xs text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </header>

      <div className="p-6">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs mt-1">
              Notifications will appear here when actions are taken in the chat
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = typeIcons[n.type];
              return (
                <div
                  key={n.id}
                  className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${
                    n.read ? "border-gray-100" : "border-blue-200 bg-blue-50/30"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors[n.type]}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

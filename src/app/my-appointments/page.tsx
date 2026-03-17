/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  Clock,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  type: string;
  status: string;
  notes: string;
}

interface Patient {
  id: string;
  fullName: string;
  familyGroupId?: string | null;
}

const typeLabels: Record<string, string> = {
  cleaning: "Cleaning",
  general_checkup: "General Checkup",
  emergency: "Emergency",
};

const typeColors: Record<string, string> = {
  cleaning: "bg-[#B3C5B6]/30 text-[#32453E]",
  general_checkup: "bg-[#B3C5B6]/50 text-[#32453E]",
  emergency: "bg-red-50 text-red-700",
};

function getMyPatientIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("my_patient_ids") || "[]");
  } catch { return []; }
}

function getMyPatientNames(): string[] {
  try {
    return JSON.parse(localStorage.getItem("my_patient_names") || "[]");
  } catch { return []; }
}

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [myIds, setMyIds] = useState<string[]>([]);
  const [myNames, setMyNames] = useState<string[]>([]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Load IDs on mount and re-read whenever the tab gets focus (user comes back from chat)
  useEffect(() => {
    const load = () => {
      setMyIds(getMyPatientIds());
      setMyNames(getMyPatientNames());
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [aRes, pRes] = await Promise.all([
      fetch("/api/appointments"),
      fetch("/api/patients"),
    ]);
    const [aData, pData] = await Promise.all([aRes.json(), pRes.json()]);
    setAppointments(aData);
    setAllPatients(pData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch when IDs change (e.g. user navigated back from chat)
  useEffect(() => {
    if (myIds.length > 0) fetchData();
  }, [myIds.length, fetchData]);

  // Resolve patient IDs from stored names (fallback for when model used wrong patientId)
  const idsFromNames = allPatients
    .filter((p) => myNames.includes(p.fullName))
    .map((p) => p.id);

  const resolvedIds = [...new Set([...myIds, ...idsFromNames])];

  // Build the full set of IDs including family members
  const myFamilyGroupIds = new Set(
    allPatients.filter((p) => resolvedIds.includes(p.id) && p.familyGroupId).map((p) => p.familyGroupId!)
  );
  const allMyIds = new Set([
    ...resolvedIds,
    ...allPatients.filter((p) => p.familyGroupId && myFamilyGroupIds.has(p.familyGroupId)).map((p) => p.id),
  ]);

  // Also collect patient names for matching appointments with mismatched IDs
  const allMyNames = new Set([
    ...myNames,
    ...allPatients.filter((p) => allMyIds.has(p.id)).map((p) => p.fullName),
  ]);

  // Filter to only this patient's (and family's) appointments — match by ID or name
  const myAppointments = (allMyIds.size > 0 || allMyNames.size > 0)
    ? appointments.filter((a) => allMyIds.has(a.patientId) || allMyNames.has(a.patientName))
    : [];

  const upcoming = myAppointments
    .filter((a) => a.date >= todayKey)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const past = myAppointments
    .filter((a) => a.date < todayKey)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const noIdentity = myIds.length === 0 && myNames.length === 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight">My Appointments</h1>
          <p className="text-[11px] text-gray-500">
            {noIdentity ? "Chat with Ria to get started" : `${upcoming.length} upcoming appointment${upcoming.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="flex items-center gap-1 text-[11px] text-white rounded-md px-2.5 py-1 transition hover:opacity-90"
            style={{ background: "#32453E" }}
          >
            <MessageSquare className="w-3 h-3" />
            Book via Chat
          </Link>
          <button
            onClick={() => { setMyIds(getMyPatientIds()); setMyNames(getMyPatientNames()); fetchData(); }}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </header>

      <div className="px-4 py-3 space-y-4 max-w-2xl mx-auto">
        {/* Quick info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#B3C5B6" }}>
              <CalendarDays className="w-5 h-5" style={{ color: "#32453E" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Need to book, reschedule, or cancel?</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Chat with Ria — she can handle all appointment changes for you.
              </p>
            </div>
          </div>
        </div>

        {noIdentity ? (
          /* No identity yet — prompt to chat first */
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500 font-medium">Let's get you set up</p>
            <p className="text-xs text-gray-400 mt-1">Chat with Ria to register or look up your account, then your appointments will show here.</p>
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium mt-3 px-3 py-1.5 rounded-lg text-white transition hover:opacity-90" style={{ background: "#32453E" }}>
              <MessageSquare className="w-3 h-3" />
              Start chatting
            </Link>
          </div>
        ) : (
          <>
            {/* Upcoming */}
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Upcoming</h2>
              {loading ? (
                <div className="space-y-1.5">
                  {[1, 2].map((i) => (
                    <div key={i} className="shimmer h-16 rounded-lg" />
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs text-gray-400">No upcoming appointments</p>
                  <Link href="/" className="text-xs font-medium mt-2 inline-block" style={{ color: "#32453E" }}>
                    Book one now
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {upcoming.map((appt) => {
                    const apptDate = new Date(appt.date + "T00:00:00");
                    const isToday = appt.date === todayKey;

                    return (
                      <div
                        key={appt.id}
                        className={`bg-white rounded-xl border px-4 py-3 ${
                          isToday ? "border-[#32453E]/30 ring-1 ring-[#32453E]/10" : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gray-50 flex flex-col items-center justify-center shrink-0 border border-gray-100">
                            <span className="text-[9px] font-medium text-gray-400 uppercase leading-none">
                              {apptDate.toLocaleDateString("en-US", { month: "short" })}
                            </span>
                            <span className="text-lg font-bold text-gray-800 leading-none">
                              {apptDate.getDate()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">
                                {appt.patientName}
                              </span>
                              {isToday && (
                                <span className="text-[9px] font-bold text-white rounded-full px-2 py-0.5" style={{ background: "#32453E" }}>
                                  TODAY
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${typeColors[appt.type] || "bg-gray-50 text-gray-600"}`}>
                                {typeLabels[appt.type] || appt.type}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                <Clock className="w-2.5 h-2.5" />
                                {appt.time}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                {apptDate.toLocaleDateString("en-US", { weekday: "short" })}
                              </span>
                            </div>
                            {appt.notes && (
                              <p className="text-[10px] text-gray-400 mt-1 truncate">{appt.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past */}
            {past.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Past</h2>
                <div className="space-y-1">
                  {past.slice(0, 5).map((appt) => {
                    const apptDate = new Date(appt.date + "T00:00:00");
                    return (
                      <div
                        key={appt.id}
                        className="bg-white/60 rounded-lg border border-gray-100 px-3 py-2 flex items-center gap-3 opacity-60"
                      >
                        <div className="w-8 h-8 rounded-md bg-gray-50 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[8px] font-medium text-gray-400 uppercase leading-none">
                            {apptDate.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-sm font-bold text-gray-600 leading-none">
                            {apptDate.getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-600">{appt.patientName}</span>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            <span>{typeLabels[appt.type] || appt.type}</span>
                            <span>{appt.time}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Practice info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500">
            Resonate Dental Care
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Mon–Sat, 8:00 AM – 6:00 PM &middot; (512) 555-0199
          </p>
          <p className="text-[11px] text-gray-400">
            625 8th Street, Apt 635, San Francisco, CA 94103
          </p>
        </div>
      </div>
    </div>
  );
}

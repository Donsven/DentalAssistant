/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Phone,
  Calendar,
  Shield,
  RefreshCw,
  MessageSquare,
  Crown,
  Heart,
} from "lucide-react";
import Link from "next/link";

interface Patient {
  id: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  insurance: string | null;
  notes: string;
  createdAt: string;
  familyGroupId?: string | null;
}

interface FamilyGroup {
  id: string;
  name: string;
  primaryContactId: string;
  members: Patient[];
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  type: string;
  status: string;
}

const typeLabels: Record<string, string> = {
  cleaning: "Cleaning",
  general_checkup: "General Checkup",
  emergency: "Emergency",
};

function getMyPatientIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("my_patient_ids") || "[]");
  } catch { return []; }
}

function getMyFamilyGroupIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("my_family_group_ids") || "[]");
  } catch { return []; }
}

function getMyPatientNames(): string[] {
  try {
    return JSON.parse(localStorage.getItem("my_patient_names") || "[]");
  } catch { return []; }
}

export default function MyHouseholdPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [myIds, setMyIds] = useState<string[]>([]);
  const [myFgIds, setMyFgIds] = useState<string[]>([]);
  const [myNames, setMyNames] = useState<string[]>([]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Load IDs on mount and re-read whenever the tab gets focus (user comes back from chat)
  useEffect(() => {
    const load = () => {
      setMyIds(getMyPatientIds());
      setMyFgIds(getMyFamilyGroupIds());
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
    const [pRes, fRes, aRes] = await Promise.all([
      fetch("/api/patients"),
      fetch("/api/family-groups"),
      fetch("/api/appointments"),
    ]);
    const [pData, fData, aData] = await Promise.all([pRes.json(), fRes.json(), aRes.json()]);
    setPatients(pData);
    setFamilyGroups(fData);
    setAppointments(aData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshIds = () => {
    setMyIds(getMyPatientIds());
    setMyFgIds(getMyFamilyGroupIds());
    setMyNames(getMyPatientNames());
  };

  // Resolve patient IDs from stored names
  const idsFromNames = patients
    .filter((p) => myNames.includes(p.fullName))
    .map((p) => p.id);
  const resolvedIds = [...new Set([...myIds, ...idsFromNames])];

  // Build the set of patient IDs that belong to "me"
  // This includes: my direct IDs + all members of my family groups
  const myFamilyGroups = familyGroups.filter((g) => {
    // Family group I created or am a member of
    if (myFgIds.includes(g.id)) return true;
    // Family group that contains one of my patient IDs
    if (g.members.some((m) => resolvedIds.includes(m.id))) return true;
    return false;
  });

  const familyMemberIds = new Set(myFamilyGroups.flatMap((g) => g.members.map((m) => m.id)));
  const allMyIds = new Set([...resolvedIds, ...familyMemberIds]);

  // Filter patients to only mine (by ID or name)
  const myPatients = patients.filter((p) => allMyIds.has(p.id) || myNames.includes(p.fullName));

  const getUpcomingAppointment = (patientId: string) => {
    return appointments
      .filter((a) => a.patientId === patientId && a.date >= todayKey)
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  };

  const noIdentity = myIds.length === 0 && myNames.length === 0;
  const memberCount = myPatients.length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight">My Household</h1>
          <p className="text-[11px] text-gray-500">
            {noIdentity ? "Chat with Ria to get started" : `${memberCount} member${memberCount !== 1 ? "s" : ""}${myFamilyGroups.length > 0 ? ` · ${myFamilyGroups.length} famil${myFamilyGroups.length !== 1 ? "ies" : "y"}` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="flex items-center gap-1 text-[11px] text-white rounded-md px-2.5 py-1 transition hover:opacity-90"
            style={{ background: "#32453E" }}
          >
            <MessageSquare className="w-3 h-3" />
            Add via Chat
          </Link>
          <button
            onClick={() => { refreshIds(); fetchData(); }}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </header>

      <div className="px-4 py-3 space-y-4 max-w-2xl mx-auto">
        {/* Info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#B3C5B6" }}>
              <Heart className="w-5 h-5" style={{ color: "#32453E" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Family scheduling made easy</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Ask Ria to book back-to-back appointments for your whole family in one go.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-20 rounded-xl" />
            ))}
          </div>
        ) : noIdentity ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500 font-medium">Let's get you set up</p>
            <p className="text-xs text-gray-400 mt-1">Chat with Ria to register or look up your account, then your household will show here.</p>
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium mt-3 px-3 py-1.5 rounded-lg text-white transition hover:opacity-90" style={{ background: "#32453E" }}>
              <MessageSquare className="w-3 h-3" />
              Start chatting
            </Link>
          </div>
        ) : myPatients.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500 font-medium">No household members yet</p>
            <p className="text-xs text-gray-400 mt-1">Chat with Ria to register your family.</p>
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium mt-3 px-3 py-1.5 rounded-lg text-white transition hover:opacity-90" style={{ background: "#32453E" }}>
              <MessageSquare className="w-3 h-3" />
              Start chatting
            </Link>
          </div>
        ) : (
          <>
            {/* Family Groups */}
            {myFamilyGroups.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-gray-500" />
                  <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {group.name}
                  </h2>
                  <span className="text-[10px] text-gray-400">
                    {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.members.map((member) => {
                    const nextAppt = getUpcomingAppointment(member.id);
                    const isPrimary = group.primaryContactId === member.id;
                    return (
                      <div
                        key={member.id}
                        className="bg-white rounded-xl border border-gray-200 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                            style={{ background: "#B3C5B6", color: "#32453E" }}
                          >
                            {member.fullName.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-gray-800">{member.fullName}</span>
                              {isPrimary && <Crown className="w-3 h-3 text-amber-500" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />{member.phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />{member.dateOfBirth}
                              </span>
                              <span className="flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5" />{member.insurance || "Self-pay"}
                              </span>
                            </div>
                            {nextAppt && (
                              <div className="mt-2 flex items-center gap-2 text-[10px] bg-[#B3C5B6]/15 rounded-lg px-2.5 py-1.5">
                                <Calendar className="w-3 h-3" style={{ color: "#32453E" }} />
                                <span className="font-medium" style={{ color: "#32453E" }}>
                                  Next: {typeLabels[nextAppt.type] || nextAppt.type} on{" "}
                                  {new Date(nextAppt.date + "T00:00:00").toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}{" "}
                                  at {nextAppt.time}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Individual patients (not in a family group) */}
            {(() => {
              const groupedIds = new Set(myFamilyGroups.flatMap((g) => g.members.map((m) => m.id)));
              const individuals = myPatients.filter((p) => !groupedIds.has(p.id));

              if (individuals.length === 0) return null;

              return (
                <div>
                  {myFamilyGroups.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Individual Members
                      </h2>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {individuals.map((patient) => {
                      const nextAppt = getUpcomingAppointment(patient.id);
                      return (
                        <div
                          key={patient.id}
                          className="bg-white rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                              style={{ background: "#B3C5B6", color: "#32453E" }}
                            >
                              {patient.fullName.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-semibold text-gray-800">{patient.fullName}</span>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5" />{patient.phone}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5" />{patient.dateOfBirth}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Shield className="w-2.5 h-2.5" />{patient.insurance || "Self-pay"}
                                </span>
                              </div>
                              {nextAppt && (
                                <div className="mt-2 flex items-center gap-2 text-[10px] bg-[#B3C5B6]/15 rounded-lg px-2.5 py-1.5">
                                  <Calendar className="w-3 h-3" style={{ color: "#32453E" }} />
                                  <span className="font-medium" style={{ color: "#32453E" }}>
                                    Next: {typeLabels[nextAppt.type] || nextAppt.type} on{" "}
                                    {new Date(nextAppt.date + "T00:00:00").toLocaleDateString("en-US", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    })}{" "}
                                    at {nextAppt.time}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
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

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
  User,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
} from "lucide-react";

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
  phone: string;
  dateOfBirth: string;
  insurance: string | null;
}

interface Slot {
  date: string;
  time: string;
  available: boolean;
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

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Form state
  const [formPatientId, setFormPatientId] = useState("");
  const [formIsNewPatient, setFormIsNewPatient] = useState(false);
  const [formFullName, setFormFullName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formInsurance, setFormInsurance] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formType, setFormType] = useState<string>("cleaning");
  const [formNotes, setFormNotes] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/appointments");
    const data = await res.json();
    setAppointments(data);
    setLoading(false);
  }, []);

  const fetchPatients = useCallback(async () => {
    const res = await fetch("/api/patients");
    const data = await res.json();
    setPatients(data);
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchPatients();
  }, [fetchAppointments, fetchPatients]);

  const handleCancel = async (id: string) => {
    await fetch(`/api/appointments?id=${id}`, { method: "DELETE" });
    setConfirmCancelId(null);
    fetchAppointments();
  };

  // Fetch available slots when form date changes
  useEffect(() => {
    if (!formDate) {
      setAvailableSlots([]);
      return;
    }
    (async () => {
      const res = await fetch(`/api/availability?date=${formDate}`);
      const data = await res.json();
      setAvailableSlots(data);
      setFormTime("");
    })();
  }, [formDate]);

  // Build a set of dates that have appointments for quick lookup
  const appointmentDates = new Set(appointments.map((a) => a.date));

  // Calendar grid
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalYear(calYear - 1);
      setCalMonth(11);
    } else {
      setCalMonth(calMonth - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalYear(calYear + 1);
      setCalMonth(0);
    } else {
      setCalMonth(calMonth + 1);
    }
    setSelectedDay(null);
  };

  // Filtered appointments
  const filteredAppointments = selectedDay
    ? appointments.filter((a) => a.date === selectedDay)
    : appointments.filter((a) => a.date >= todayKey);

  const sortedAppointments = [...filteredAppointments].sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
  );

  const resetForm = () => {
    setFormPatientId("");
    setFormIsNewPatient(false);
    setFormFullName("");
    setFormPhone("");
    setFormDob("");
    setFormInsurance("");
    setFormDate("");
    setFormTime("");
    setFormType("cleaning");
    setFormNotes("");
    setFormError("");
    setAvailableSlots([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const payload: Record<string, string> = {
        date: formDate,
        time: formTime,
        type: formType,
        notes: formNotes,
      };

      if (formIsNewPatient) {
        payload.patientId = "new";
        payload.patientName = formFullName;
        payload.fullName = formFullName;
        payload.phone = formPhone;
        payload.dateOfBirth = formDob;
        payload.insurance = formInsurance;
      } else {
        const patient = patients.find((p) => p.id === formPatientId);
        if (!patient) {
          setFormError("Please select a patient.");
          setSubmitting(false);
          return;
        }
        payload.patientId = formPatientId;
        payload.patientName = patient.fullName;
      }

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || "Failed to create appointment.");
        setSubmitting(false);
        return;
      }

      resetForm();
      setShowForm(false);
      await fetchAppointments();
      await fetchPatients();
    } catch {
      setFormError("Failed to create appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight">Appointments</h1>
          <p className="text-[11px] text-gray-500">
            {selectedDay
              ? new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
              : "Upcoming"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            style={{ background: "#32453E" }}
            className="flex items-center gap-1 text-[11px] text-white rounded-md px-2.5 py-1 transition hover:opacity-90"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
          <button
            onClick={fetchAppointments}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </header>

      <div className="px-4 py-3 space-y-3">
        {/* Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-gray-100 transition"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-sm font-semibold text-gray-800">
              {new Date(calYear, calMonth).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              onClick={nextMonth}
              className="p-1 rounded hover:bg-gray-100 transition"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-medium text-gray-400 uppercase py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }

              const dateKey = formatDateKey(calYear, calMonth, day);
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDay;
              const hasAppointments = appointmentDates.has(dateKey);

              return (
                <button
                  key={dateKey}
                  onClick={() =>
                    setSelectedDay(isSelected ? null : dateKey)
                  }
                  className={`h-10 flex flex-col items-center justify-center rounded-lg text-xs transition relative ${
                    isSelected
                      ? "text-white font-semibold"
                      : isToday
                        ? "font-semibold text-[#32453E]"
                        : "text-gray-700 hover:bg-gray-50"
                  }`}
                  style={
                    isSelected
                      ? { background: "#32453E" }
                      : isToday && !isSelected
                        ? { background: "rgba(179,197,182,0.3)" }
                        : undefined
                  }
                >
                  {day}
                  {hasAppointments && (
                    <span
                      className={`absolute bottom-1 w-1 h-1 rounded-full ${
                        isSelected ? "bg-white" : "bg-[#32453E]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Appointment List */}
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-14 rounded-lg" />
            ))}
          </div>
        ) : sortedAppointments.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-xs">
              {selectedDay ? "No appointments on this day" : "No upcoming appointments"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedAppointments.map((appt) => (
              <div
                key={appt.id}
                className="bg-white rounded-lg border border-gray-200 px-3 py-2 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-md bg-gray-50 flex flex-col items-center justify-center shrink-0 border border-gray-100">
                  <span className="text-[8px] font-medium text-gray-400 uppercase leading-none">
                    {new Date(appt.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-sm font-bold text-gray-800 leading-none">
                    {new Date(appt.date + "T00:00:00").getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 leading-tight">
                      {appt.patientName}
                    </span>
                    <span
                      className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                        typeColors[appt.type] || "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {typeLabels[appt.type] || appt.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-2.5 h-2.5" />
                      {new Date(appt.date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {appt.time}
                    </span>
                  </div>
                </div>
                {confirmCancelId === appt.id ? (
                  <div className="flex items-center gap-1 shrink-0 animate-[fade-in_0.15s_ease-out]">
                    <button
                      onClick={() => handleCancel(appt.id)}
                      className="text-[10px] text-white rounded-md px-2 py-0.5 transition"
                      style={{ background: "#dc2626" }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmCancelId(null)}
                      className="text-[10px] text-gray-500 bg-gray-100 rounded-md px-2 py-0.5 transition"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmCancelId(appt.id)}
                    className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                    title="Cancel appointment"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Appointment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-bold text-gray-800">Add Appointment</h2>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="p-1 rounded hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Patient selection */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Patient
                </label>
                {!formIsNewPatient ? (
                  <div className="space-y-2">
                    <select
                      value={formPatientId}
                      onChange={(e) => setFormPatientId(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                    >
                      <option value="">Select a patient...</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setFormIsNewPatient(true);
                        setFormPatientId("");
                      }}
                      className="text-xs text-[#32453E] font-medium hover:underline"
                    >
                      + Add new patient
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">New Patient</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormIsNewPatient(false);
                          setFormFullName("");
                          setFormPhone("");
                          setFormDob("");
                          setFormInsurance("");
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                    />
                    <input
                      type="date"
                      placeholder="Date of birth"
                      value={formDob}
                      onChange={(e) => setFormDob(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                    />
                    <input
                      type="text"
                      placeholder="Insurance (optional)"
                      value={formInsurance}
                      onChange={(e) => setFormInsurance(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                    />
                  </div>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Time
                </label>
                <select
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                >
                  <option value="">
                    {formDate
                      ? availableSlots.length > 0
                        ? "Select a time..."
                        : "No available slots"
                      : "Select a date first"}
                  </option>
                  {availableSlots.map((slot) => (
                    <option key={slot.time} value={slot.time}>
                      {slot.time}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Appointment Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                >
                  <option value="cleaning">Cleaning</option>
                  <option value="general_checkup">General Checkup</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6] resize-none"
                  placeholder="Any special notes..."
                />
              </div>

              {formError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ background: "#32453E" }}
                className="w-full text-white text-sm font-medium rounded-lg py-2.5 transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Appointment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

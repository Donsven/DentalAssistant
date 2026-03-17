/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "src", "data");

export interface Patient {
  id: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  insurance: string | null;
  notes: string;
  createdAt: string;
  familyGroupId?: string | null;
}

export interface FamilyGroup {
  id: string;
  name: string;
  primaryContactId: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  type: "cleaning" | "general_checkup" | "emergency";
  status: "scheduled" | "cancelled" | "completed";
  notes: string;
}

export interface Slot {
  date: string;
  time: string;
  available: boolean;
}

export interface Availability {
  slotDurationMinutes: number;
  operatingHours: {
    open: string;
    close: string;
    days: string[];
  };
  slots: Slot[];
}

function readJSON<T>(filename: string): T {
  const raw = readFileSync(join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

function writeJSON<T>(filename: string, data: T): void {
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// --- Patients ---

export function getPatients(): Patient[] {
  return readJSON<Patient[]>("patients.json");
}

export function getPatientById(id: string): Patient | undefined {
  return getPatients().find((p) => p.id === id);
}

export function findPatient(name: string, dob: string): Patient | undefined {
  const lower = name.toLowerCase();
  return getPatients().find(
    (p) => p.fullName.toLowerCase().includes(lower) && p.dateOfBirth === dob
  );
}

export function findPatientByName(name: string): Patient[] {
  const lower = name.toLowerCase();
  return getPatients().filter((p) => p.fullName.toLowerCase().includes(lower));
}

export function createPatient(patient: Omit<Patient, "id" | "createdAt" | "notes" | "familyGroupId"> & { notes?: string; familyGroupId?: string | null }): Patient {
  const patients = getPatients();
  const newPatient: Patient = {
    ...patient,
    notes: patient.notes || "",
    familyGroupId: patient.familyGroupId || null,
    id: `p${Date.now()}`,
    createdAt: new Date().toISOString().split("T")[0],
  };
  patients.push(newPatient);
  writeJSON("patients.json", patients);
  return newPatient;
}

// --- Appointments ---

export function getAppointments(): Appointment[] {
  return readJSON<Appointment[]>("appointments.json");
}

export function getAppointmentsByPatient(patientId: string): Appointment[] {
  return getAppointments().filter(
    (a) => a.patientId === patientId && a.status === "scheduled"
  );
}

export function createAppointment(
  appt: Omit<Appointment, "id" | "status">
): Appointment {
  const appointments = getAppointments();
  const newAppt: Appointment = {
    ...appt,
    id: `a${Date.now()}`,
    status: "scheduled",
  };
  appointments.push(newAppt);
  writeJSON("appointments.json", appointments);

  // Mark the slot as unavailable
  const avail = getAvailability();
  avail.slots = avail.slots.map((s) =>
    s.date === appt.date && s.time === appt.time
      ? { ...s, available: false }
      : s
  );
  writeJSON("availability.json", avail);

  return newAppt;
}

export function cancelAppointment(appointmentId: string): Appointment | null {
  const appointments = getAppointments();
  const idx = appointments.findIndex((a) => a.id === appointmentId);
  if (idx === -1) return null;

  const appt = appointments[idx];
  appointments[idx] = { ...appt, status: "cancelled" };
  writeJSON("appointments.json", appointments);

  // Free the slot
  const avail = getAvailability();
  avail.slots = avail.slots.map((s) =>
    s.date === appt.date && s.time === appt.time
      ? { ...s, available: true }
      : s
  );
  writeJSON("availability.json", avail);

  return appointments[idx];
}

export function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newTime: string
): Appointment | null {
  const appointments = getAppointments();
  const idx = appointments.findIndex((a) => a.id === appointmentId);
  if (idx === -1) return null;

  const oldAppt = appointments[idx];
  const avail = getAvailability();

  // Free old slot
  avail.slots = avail.slots.map((s) =>
    s.date === oldAppt.date && s.time === oldAppt.time
      ? { ...s, available: true }
      : s
  );

  // Book new slot
  avail.slots = avail.slots.map((s) =>
    s.date === newDate && s.time === newTime
      ? { ...s, available: false }
      : s
  );

  writeJSON("availability.json", avail);

  appointments[idx] = { ...oldAppt, date: newDate, time: newTime };
  writeJSON("appointments.json", appointments);

  return appointments[idx];
}

// --- Availability ---

export function getAvailability(): Availability {
  return readJSON<Availability>("availability.json");
}

export function getAvailableSlots(date?: string): Slot[] {
  const avail = getAvailability();
  const available = avail.slots.filter((s) => s.available);
  if (date) return available.filter((s) => s.date === date);
  return available;
}

// --- Family Groups ---

export function getFamilyGroups(): FamilyGroup[] {
  return readJSON<FamilyGroup[]>("familyGroups.json");
}

export function getFamilyGroupById(id: string): FamilyGroup | undefined {
  return getFamilyGroups().find((g) => g.id === id);
}

export function getFamilyMembers(familyGroupId: string): Patient[] {
  return getPatients().filter((p) => p.familyGroupId === familyGroupId);
}

export function createFamilyGroup(name: string, primaryContactId: string, memberIds: string[] = []): FamilyGroup {
  const groups = getFamilyGroups();
  const newGroup: FamilyGroup = {
    id: `fg${Date.now()}`,
    name,
    primaryContactId,
    createdAt: new Date().toISOString().split("T")[0],
  };
  groups.push(newGroup);
  writeJSON("familyGroups.json", groups);

  // Assign familyGroupId to all members (including primary)
  const allMemberIds = new Set([primaryContactId, ...memberIds]);
  const patients = getPatients();
  for (const p of patients) {
    if (allMemberIds.has(p.id)) {
      p.familyGroupId = newGroup.id;
    }
  }
  writeJSON("patients.json", patients);

  return newGroup;
}

export function addPatientToFamily(patientId: string, familyGroupId: string): Patient | null {
  const patients = getPatients();
  const idx = patients.findIndex((p) => p.id === patientId);
  if (idx === -1) return null;
  patients[idx].familyGroupId = familyGroupId;
  writeJSON("patients.json", patients);
  return patients[idx];
}

export function removePatientFromFamily(patientId: string): Patient | null {
  const patients = getPatients();
  const idx = patients.findIndex((p) => p.id === patientId);
  if (idx === -1) return null;
  patients[idx].familyGroupId = null;
  writeJSON("patients.json", patients);
  return patients[idx];
}

export function updateFamilyGroup(id: string, updates: { name?: string; primaryContactId?: string }): FamilyGroup | null {
  const groups = getFamilyGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return null;
  groups[idx] = { ...groups[idx], ...updates };
  writeJSON("familyGroups.json", groups);
  return groups[idx];
}

export function deleteFamilyGroup(id: string): boolean {
  const groups = getFamilyGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return false;
  groups.splice(idx, 1);
  writeJSON("familyGroups.json", groups);

  // Clear familyGroupId from all members
  const patients = getPatients();
  for (const p of patients) {
    if (p.familyGroupId === id) p.familyGroupId = null;
  }
  writeJSON("patients.json", patients);
  return true;
}

// --- Atomic Family Scheduling ---

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function findConsecutiveSlots(date: string, count: number): string[][] {
  const avail = getAvailability();
  const daySlots = avail.slots
    .filter((s) => s.date === date && s.available)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  const duration = avail.slotDurationMinutes;
  const results: string[][] = [];

  for (let i = 0; i <= daySlots.length - count; i++) {
    let valid = true;
    for (let j = 1; j < count; j++) {
      if (timeToMinutes(daySlots[i + j].time) !== timeToMinutes(daySlots[i].time) + duration * j) {
        valid = false;
        break;
      }
    }
    if (valid) {
      results.push(daySlots.slice(i, i + count).map((s) => s.time));
    }
  }

  return results;
}

export function bookFamilyAppointments(
  bookings: Omit<Appointment, "id" | "status">[]
): Appointment[] {
  const avail = getAvailability();

  // Verify all slots are available
  for (const b of bookings) {
    const slot = avail.slots.find((s) => s.date === b.date && s.time === b.time);
    if (!slot || !slot.available) {
      throw new Error(`Slot ${b.date} at ${b.time} is not available`);
    }
  }

  // Book all slots atomically
  const appointments = getAppointments();
  const booked: Appointment[] = [];

  for (const b of bookings) {
    const newAppt: Appointment = {
      ...b,
      id: `a${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      status: "scheduled",
    };
    appointments.push(newAppt);
    booked.push(newAppt);

    // Mark slot unavailable
    avail.slots = avail.slots.map((s) =>
      s.date === b.date && s.time === b.time ? { ...s, available: false } : s
    );
  }

  writeJSON("appointments.json", appointments);
  writeJSON("availability.json", avail);

  return booked;
}

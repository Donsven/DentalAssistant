/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAppointments, createAppointment, createPatient, cancelAppointment } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getAppointments().filter((a) => a.status === "scheduled"));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, patientName, date, time, type, notes } = body;

    if (!patientId || !date || !time || !type) {
      return NextResponse.json(
        { error: "patientId, date, time, and type are required." },
        { status: 400 }
      );
    }

    const validTypes = ["cleaning", "general_checkup", "emergency"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "type must be cleaning, general_checkup, or emergency." },
        { status: 400 }
      );
    }

    let resolvedPatientId = patientId;
    let resolvedPatientName = patientName;
    let newPatient = null;

    // If patientId is "new", create a new patient first
    if (patientId === "new") {
      const { fullName, phone, dateOfBirth, insurance } = body;

      if (!fullName || !phone || !dateOfBirth) {
        return NextResponse.json(
          { error: "fullName, phone, and dateOfBirth are required for new patients." },
          { status: 400 }
        );
      }

      newPatient = createPatient({
        fullName,
        phone,
        dateOfBirth,
        insurance: insurance || null,
      });

      resolvedPatientId = newPatient.id;
      resolvedPatientName = newPatient.fullName;
    }

    const appointment = createAppointment({
      patientId: resolvedPatientId,
      patientName: resolvedPatientName,
      date,
      time,
      type,
      notes: notes || "",
    });

    return NextResponse.json(
      { appointment, ...(newPatient ? { patient: newPatient } : {}) },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to create appointment." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Appointment ID is required." }, { status: 400 });
    }

    const cancelled = cancelAppointment(id);
    if (!cancelled) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    return NextResponse.json(cancelled);
  } catch {
    return NextResponse.json({ error: "Failed to cancel appointment." }, { status: 500 });
  }
}

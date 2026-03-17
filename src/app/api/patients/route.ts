/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPatients, createPatient, Patient } from "@/lib/db";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export async function GET() {
  return NextResponse.json(getPatients());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, phone, dateOfBirth, insurance, notes, familyGroupId } = body;

    if (!fullName || !phone || !dateOfBirth) {
      return NextResponse.json(
        { error: "Full name, phone, and date of birth are required." },
        { status: 400 }
      );
    }

    const patient = createPatient({
      fullName,
      phone,
      dateOfBirth,
      insurance: insurance || null,
      notes: notes || "",
      familyGroupId: familyGroupId || null,
    });

    return NextResponse.json(patient, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create patient." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, fullName, phone, dateOfBirth, insurance, notes, familyGroupId } = body;

    if (!id) {
      return NextResponse.json({ error: "Patient ID is required." }, { status: 400 });
    }

    const dataPath = join(process.cwd(), "src", "data", "patients.json");
    const patients: Patient[] = JSON.parse(readFileSync(dataPath, "utf-8"));
    const idx = patients.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    patients[idx] = {
      ...patients[idx],
      ...(fullName && { fullName }),
      ...(phone && { phone }),
      ...(dateOfBirth && { dateOfBirth }),
      ...(insurance !== undefined && { insurance: insurance || null }),
      ...(notes !== undefined && { notes: notes || "" }),
      ...(familyGroupId !== undefined && { familyGroupId: familyGroupId || null }),
    };

    writeFileSync(dataPath, JSON.stringify(patients, null, 2));
    return NextResponse.json(patients[idx]);
  } catch {
    return NextResponse.json({ error: "Failed to update patient." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Patient ID is required." }, { status: 400 });
    }

    const dataPath = join(process.cwd(), "src", "data", "patients.json");
    const patients: Patient[] = JSON.parse(readFileSync(dataPath, "utf-8"));
    const idx = patients.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    const removed = patients.splice(idx, 1)[0];
    writeFileSync(dataPath, JSON.stringify(patients, null, 2));
    return NextResponse.json(removed);
  } catch {
    return NextResponse.json({ error: "Failed to delete patient." }, { status: 500 });
  }
}

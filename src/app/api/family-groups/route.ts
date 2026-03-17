/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getFamilyGroups,
  getFamilyMembers,
  createFamilyGroup,
  updateFamilyGroup,
  deleteFamilyGroup,
  addPatientToFamily,
  removePatientFromFamily,
} from "@/lib/db";

export async function GET() {
  const groups = getFamilyGroups();
  const enriched = groups.map((g) => ({
    ...g,
    members: getFamilyMembers(g.id),
  }));
  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, primaryContactId, memberIds } = body;

    if (!name || !primaryContactId) {
      return NextResponse.json(
        { error: "name and primaryContactId are required." },
        { status: 400 }
      );
    }

    const group = createFamilyGroup(name, primaryContactId, memberIds || []);
    const members = getFamilyMembers(group.id);

    return NextResponse.json({ ...group, members }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create family group." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, primaryContactId, addMemberIds, removeMemberIds } = body;

    if (!id) {
      return NextResponse.json({ error: "Family group ID is required." }, { status: 400 });
    }

    if (name || primaryContactId) {
      updateFamilyGroup(id, { ...(name && { name }), ...(primaryContactId && { primaryContactId }) });
    }

    if (addMemberIds) {
      for (const pid of addMemberIds) {
        addPatientToFamily(pid, id);
      }
    }

    if (removeMemberIds) {
      for (const pid of removeMemberIds) {
        removePatientFromFamily(pid);
      }
    }

    const members = getFamilyMembers(id);
    const groups = getFamilyGroups();
    const group = groups.find((g) => g.id === id);

    return NextResponse.json({ ...group, members });
  } catch {
    return NextResponse.json({ error: "Failed to update family group." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Family group ID is required." }, { status: 400 });
    }

    const deleted = deleteFamilyGroup(id);
    if (!deleted) {
      return NextResponse.json({ error: "Family group not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete family group." }, { status: 500 });
  }
}

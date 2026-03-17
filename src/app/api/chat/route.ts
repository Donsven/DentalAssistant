/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/gemini";
import { buildSystemPrompt } from "@/lib/system-prompt";
import {
  createPatient,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  findPatientByName,
  createFamilyGroup,
  addPatientToFamily,
  getFamilyMembers,
  findConsecutiveSlots,
  bookFamilyAppointments,
} from "@/lib/db";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAction(text: string): { action: Record<string, any> | null; cleanText: string } {
  const actionRegex = /```action\s*\n?([\s\S]*?)\n?```/;
  const match = text.match(actionRegex);

  if (!match) return { action: null, cleanText: text };

  try {
    const action = JSON.parse(match[1].trim());
    const cleanText = text.replace(actionRegex, "").trim();
    return { action, cleanText };
  } catch {
    return { action: null, cleanText: text };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function executeAction(action: Record<string, any>): string {
  switch (action.type) {
    case "register_patient": {
      const patient = createPatient({
        fullName: action.fullName,
        phone: action.phone,
        dateOfBirth: action.dateOfBirth,
        insurance: action.insurance || null,
      });
      return `Patient registered successfully: ${patient.fullName} (ID: ${patient.id})`;
    }

    case "book_appointment": {
      const appt = createAppointment({
        patientId: action.patientId,
        patientName: action.patientName,
        date: action.date,
        time: action.time,
        type: action.appointmentType as "cleaning" | "general_checkup" | "emergency",
        notes: action.notes || "",
      });
      return `Appointment booked: ${appt.patientName} for ${appt.type} on ${appt.date} at ${appt.time} (ID: ${appt.id})`;
    }

    case "cancel_appointment": {
      const cancelled = cancelAppointment(action.appointmentId);
      if (!cancelled) return "Appointment not found.";
      return `Appointment cancelled for ${cancelled.patientName} on ${cancelled.date} at ${cancelled.time}`;
    }

    case "reschedule_appointment": {
      const rescheduled = rescheduleAppointment(
        action.appointmentId,
        action.newDate,
        action.newTime
      );
      if (!rescheduled) return "Appointment not found.";
      return `Appointment rescheduled for ${rescheduled.patientName} to ${rescheduled.date} at ${rescheduled.time}`;
    }

    case "notify_staff": {
      return `STAFF NOTIFIED: Emergency for ${action.patientName} — ${action.summary}`;
    }

    case "lookup_patient": {
      const results = findPatientByName(action.name);
      if (results.length === 0) return "No patients found with that name.";
      return `Found patients: ${results.map((p) => `${p.fullName} (DOB: ${p.dateOfBirth}, ID: ${p.id})`).join("; ")}`;
    }

    case "create_family_group": {
      const group = createFamilyGroup(
        action.name,
        action.primaryContactId,
        action.memberIds || []
      );
      const members = getFamilyMembers(group.id);
      return `Family group "${group.name}" created (ID: ${group.id}) with members: ${members.map((m) => m.fullName).join(", ")}`;
    }

    case "add_to_family": {
      const updated = addPatientToFamily(action.patientId, action.familyGroupId);
      if (!updated) return "Patient not found.";
      return `${updated.fullName} added to family group ${action.familyGroupId}`;
    }

    case "book_family_appointments": {
      const members = getFamilyMembers(action.familyGroupId);
      if (members.length === 0) return "No members found in this family group.";

      const consecutiveOptions = findConsecutiveSlots(action.date, members.length);
      if (consecutiveOptions.length === 0) {
        return `No ${members.length} consecutive back-to-back slots available on ${action.date}. Please try a different date.`;
      }

      // Find the option starting at or closest to requested startTime
      let bestTimes = consecutiveOptions[0];
      if (action.startTime) {
        const requested = action.startTime;
        for (const option of consecutiveOptions) {
          if (option[0] >= requested) {
            bestTimes = option;
            break;
          }
        }
      }

      const bookings = members.map((member, i) => ({
        patientId: member.id,
        patientName: member.fullName,
        date: action.date,
        time: bestTimes[i],
        type: (action.appointmentType || "cleaning") as "cleaning" | "general_checkup" | "emergency",
        notes: action.notes || "",
      }));

      try {
        const booked = bookFamilyAppointments(bookings);
        return `Family appointments booked: ${booked.map((a) => `${a.patientName} at ${a.time}`).join(", ")} on ${action.date}`;
      } catch (err) {
        return `Failed to book family appointments: ${err instanceof Error ? err.message : "Unknown error"}`;
      }
    }

    default:
      return "Unknown action type.";
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = (await request.json()) as { messages: ChatMessage[] };

    const systemPrompt = buildSystemPrompt();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "";

    // Check for actions in the response
    const { action, cleanText } = extractAction(responseText);
    let actionResult: string | null = null;
    let finalText = cleanText;

    if (action) {
      actionResult = executeAction(action);

      // Send a follow-up to get a natural confirmation response
      const followUp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "assistant", content: responseText },
          {
            role: "user",
            content: `[System: Action completed — ${actionResult}. Please respond naturally to the patient, confirming what was done. Do NOT include another action block.]`,
          },
        ],
      });

      finalText = (followUp.choices[0]?.message?.content || "")
        .replace(/```action[\s\S]*?```/g, "")
        .trim();
    }

    return NextResponse.json({
      message: finalText,
      action: action ? { ...action, result: actionResult } : null,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

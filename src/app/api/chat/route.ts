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
function extractActions(text: string): { actions: Record<string, any>[]; cleanText: string } {
  const actionRegex = /```action\s*\n?([\s\S]*?)\n?```/g;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actions: Record<string, any>[] = [];
  let cleanText = text;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      actions.push(JSON.parse(match[1].trim()));
    } catch {
      // skip malformed action blocks
    }
  }

  cleanText = text.replace(/```action\s*\n?[\s\S]*?\n?```/g, "").trim();
  return { actions, cleanText };
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
    const { messages, viewMode } = (await request.json()) as { messages: ChatMessage[]; viewMode?: "patient" | "admin" };

    const systemPrompt = buildSystemPrompt(viewMode || "patient");

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

    console.log("\n=== CHAT API DEBUG ===");
    console.log("Model raw response:", responseText);

    // Extract ALL action blocks from the response
    const { actions } = extractActions(responseText);
    console.log("Extracted actions:", JSON.stringify(actions, null, 2));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executedActions: { action: Record<string, any>; result: string }[] = [];
    let finalText = "";

    if (actions.length > 0) {
      // Execute all actions in order
      for (const action of actions) {
        const result = executeAction(action);
        executedActions.push({ action, result });
      }

      const resultsSummary = executedActions.map((e) => e.result).join(". ");

      // Rebuild system prompt with fresh data (newly registered patients now have IDs)
      const freshSystemPrompt = buildSystemPrompt(viewMode || "patient");

      // Send a follow-up — allow actions so the model can chain register then book
      const followUp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: freshSystemPrompt },
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "assistant", content: responseText },
          {
            role: "user",
            content: `[System: Actions completed — ${resultsSummary}. Respond naturally to the patient confirming what was done. If the patient also wanted to book an appointment and that hasn't been done yet, go ahead and include a book_appointment action block now using the patient's correct ID from the system.]`,
          },
        ],
      });

      const followUpText = followUp.choices[0]?.message?.content || "";
      console.log("Follow-up response:", followUpText);
      const { actions: followUpActions, cleanText: followUpClean } = extractActions(followUpText);
      console.log("Follow-up actions:", JSON.stringify(followUpActions, null, 2));

      if (followUpActions.length > 0) {
        // Execute chained actions (e.g. booking after registration)
        for (const action of followUpActions) {
          const result = executeAction(action);
          executedActions.push({ action, result });
        }

        // Final natural response
        const finalPrompt = buildSystemPrompt(viewMode || "patient");
        const finalFollowUp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: finalPrompt },
            ...messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "assistant", content: responseText },
            {
              role: "user",
              content: `[System: All actions completed — ${executedActions.map((e) => e.result).join(". ")}. Respond naturally to the patient confirming everything that was done. Do NOT include any action blocks.]`,
            },
          ],
        });

        finalText = (finalFollowUp.choices[0]?.message?.content || "")
          .replace(/```action[\s\S]*?```/g, "")
          .trim();
      } else {
        finalText = followUpClean;
      }
    } else {
      finalText = responseText;
    }

    console.log("All executed actions:", executedActions.map(e => `${e.action.type}: ${e.result}`));
    console.log("=== END DEBUG ===\n");

    // Return the last executed action for the UI badge (prefer book over register)
    const primaryAction = executedActions.length > 0
      ? executedActions.find((e) => e.action.type === "book_appointment" || e.action.type === "book_family_appointments")
        || executedActions[executedActions.length - 1]
      : null;

    return NextResponse.json({
      message: finalText,
      action: primaryAction ? { ...primaryAction.action, result: primaryAction.result } : null,
      allActions: executedActions.length > 0
        ? executedActions.map((e) => ({ ...e.action, result: e.result }))
        : null,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

# Resonate Dental Chatbot

AI-powered dental practice assistant built for Resonate AI. Features a **dual-view interface**: a consumer-facing **Patient View** for booking and managing appointments through natural conversation, and a staff-facing **Admin View** for full practice management.

## Setup

```bash
git clone <repo-url>
cd ResonateProject
npm install
```

Create a `.env.local` file in the project root:

```
OPENAI_API_KEY=your_key_here
```

Get an API key at https://platform.openai.com/api-keys

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000

## Tech Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS v4
- OpenAI API with GPT-4o-mini
- Local JSON files as the database
- localStorage for chat history

## Project Structure

```
src/
  app/
    page.tsx              Chat interface (shared across both views)
    my-appointments/      Patient-facing appointment list
    my-household/         Patient-facing family/household view
    appointments/         Admin: calendar view and appointment management
    patients/             Admin: patient records with search, sort, edit, delete
    notifications/        Admin: staff notification feed
    api/
      chat/               POST. Sends messages to OpenAI, executes actions
      appointments/       GET, POST, DELETE
      patients/           GET, POST, PUT, DELETE
      availability/       GET with optional date filter
      family-groups/      GET, POST, PUT, DELETE
  components/
    Sidebar.tsx           Admin navigation sidebar (liquid glass)
    PatientSidebar.tsx    Patient navigation sidebar (Chat, My Appointments, My Household)
    ShellLayout.tsx       Layout wrapper — switches sidebar based on view mode
    ViewContext.tsx        React context for patient/admin view toggle
    NotificationContext.tsx  Client-side notification state
  lib/
    db.ts                 All database read/write operations
    gemini.ts             OpenAI client initialization
    system-prompt.ts      Ria's personality, knowledge, and action definitions
  data/
    patients.json         Patient records
    appointments.json     Appointment records
    availability.json     Time slot availability
    familyGroups.json     Family group records
```

## How the Chat Works

1. User sends a message from the frontend
2. The API route builds a system prompt that includes current patients, appointments, available slots, and family groups pulled live from the JSON database
3. The message and conversation history are sent to GPT-4o-mini with the system prompt
4. The model responds with text and optionally includes an action block
5. If an action block is present, the server executes it against the database
6. After execution, a follow-up call is made so the model can confirm the result naturally
7. The response and action status are returned to the frontend

Actions the model can trigger:
- register_patient
- book_appointment
- cancel_appointment
- reschedule_appointment
- notify_staff
- lookup_patient
- create_family_group
- add_to_family
- book_family_appointments

## Dual-View Interface

The app defaults to **Patient View** — a consumer-facing experience with just three pages:

- **Chat** — talk to Ria to book, reschedule, cancel, or ask questions
- **My Appointments** — see upcoming and past appointments with next-appointment highlights
- **My Household** — view family members, insurance info, and each member's next appointment

Switch to **Admin View** via the sidebar button to access the full staff dashboard (Appointments calendar, Patient records, Notifications). The view preference is persisted in localStorage.

## Features

### Chat
- Conversational AI receptionist with direct, no-fluff personality
- Handles new patient registration, appointment booking, rescheduling, cancellation
- Emergency handling with staff notification
- Family scheduling with back-to-back slot reservation
- Insurance and payment questions
- Spanish language support
- Chat history stored in localStorage with pagination
- New chat confirmation dialog
- Action badges that link to relevant pages

### My Appointments (Patient View)
- Clean list of upcoming appointments with date cards and type badges
- "Today" highlight for same-day appointments
- Past appointments section (faded)
- "Book via Chat" button directs to Ria
- Practice info footer with hours, phone, and address

### My Household (Patient View)
- Family groups with member cards showing phone, DOB, insurance
- Primary contact crown indicator
- Next upcoming appointment shown per member
- "Add via Chat" button for registering new family members
- Individual (ungrouped) members section

### Appointments (Admin View)
- Monthly calendar view with day filtering
- Appointment cards with type badges
- Add appointment modal with patient selection or inline new patient creation
- Available time slots fetched per date
- Cancel appointments with confirmation
- Calendar dots indicate days with appointments

### Patients (Admin View)
- Search across name, phone, DOB, insurance, notes
- Sort by name, DOB, insurance, date added
- Add, edit, delete patients
- Notes field per patient
- Family group support with color-coded grouping, primary contact designation, and collapse/expand
- Create family groups from ungrouped patients

### Notifications (Admin View)
- Displays staff alerts from emergency notifications
- Unread count badge in sidebar
- Mark all read

### UI
- Apple-inspired liquid glass sidebar with backdrop blur, specular highlights, and ambient gradient mesh
- Resonate brand colors: olive #32453E, sage #B3C5B6
- Responsive collapsible sidebar
- Typing indicator animation
- Fade-in animations on chat reset

## Database Schema

Three JSON files in src/data/:

**patients.json**: id, fullName, phone, dateOfBirth, insurance, notes, familyGroupId, createdAt

**appointments.json**: id, patientId, patientName, date, time, type, status, notes

**availability.json**: slotDurationMinutes, operatingHours, slots array with date/time/available

**familyGroups.json**: id, name, primaryContactId, createdAt

All data persists across requests during development. Booking an appointment marks the slot unavailable. Cancelling frees it back up.

## Prompt Engineering

Ria's personality is defined in src/lib/system-prompt.ts. Key design decisions:

- Direct and efficient tone. No filler phrases like "Absolutely!" or "I'd be happy to help!"
- 1 to 3 sentences per response. No over-explaining.
- Confirms before executing actions but keeps confirmations tight.
- Emergencies: get the info, notify staff, offer earliest slot. No drawn-out sympathy.
- HIPAA aware: verifies identity with name and DOB before sharing records.
- The system prompt is rebuilt on every request with live data so the model always has current availability and patient records.

## Design Decisions

**Local JSON over external DB**: The assessment recommends local storage. JSON files are zero-config, easy to inspect, and the data layer is abstracted behind db.ts so swapping to SQLite or Supabase later is straightforward.

**Action blocks over function calling**: Instead of OpenAI's native function calling, the model outputs JSON action blocks in its response. This keeps the implementation model-agnostic and makes it easy to swap providers.

**System prompt rebuilt per request**: Availability and patient data change as the chat makes bookings. Rebuilding the prompt each time ensures the model never suggests a slot that was just booked.

**Atomic family booking**: The book_family_appointments action reserves consecutive slots in a single transaction. If any slot is unavailable, none are booked.

**GPT-4o-mini**: Cheapest OpenAI model that follows system prompts well. Full test coverage costs under $0.10.Œ

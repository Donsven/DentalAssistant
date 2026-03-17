/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, RotateCcw, X, History, Trash2, MessageSquare, ChevronRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useViewMode } from "@/components/ViewContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: {
    type: string;
    result?: string;
    patientId?: string;
    patientName?: string;
    familyGroupId?: string;
  } | null;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const WELCOME_MSG: Message = {
  id: "welcome",
  role: "assistant",
  text: "Hey, I'm Ria from Resonate Dental. Need to book, reschedule, or have a question? Go ahead.",
  action: null,
};

function savePatientIdentity(action: Record<string, unknown>) {
  if (!action) return;
  const result = (action.result as string) || "";

  const addPatientId = (id: string) => {
    const ids: string[] = JSON.parse(localStorage.getItem("my_patient_ids") || "[]");
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem("my_patient_ids", JSON.stringify(ids));
    }
  };

  const addPatientName = (name: string) => {
    const names: string[] = JSON.parse(localStorage.getItem("my_patient_names") || "[]");
    if (!names.includes(name)) {
      names.push(name);
      localStorage.setItem("my_patient_names", JSON.stringify(names));
    }
  };

  // Extract patient IDs from result strings (works for register, lookup, book, etc.)
  const idMatches = result.matchAll(/ID:\s*(p[\w-]+)/g);
  for (const m of idMatches) {
    addPatientId(m[1]);
  }

  // Capture patientId field from any action that has it
  if (typeof action.patientId === "string" && action.patientId.startsWith("p")) {
    addPatientId(action.patientId);
  }

  // ALWAYS save patient name — this is the reliable fallback for matching appointments
  // even when the model uses a wrong patientId (e.g. phone number)
  if (typeof action.fullName === "string") {
    addPatientName(action.fullName);
  }
  if (typeof action.patientName === "string") {
    addPatientName(action.patientName);
  }
  // Also extract name from result string for register_patient
  if (action.type === "register_patient") {
    const nameMatch = result.match(/Patient registered successfully:\s*(.+?)\s*\(ID:/);
    if (nameMatch) {
      addPatientName(nameMatch[1]);
    }
  }

  // Save family group ID
  if (action.type === "create_family_group" || action.type === "book_family_appointments") {
    const fgMatch = result.match(/ID:\s*(fg[\w-]+)/);
    const fgId = fgMatch ? fgMatch[1] : (action.familyGroupId as string | undefined);
    if (fgId) {
      const fgIds: string[] = JSON.parse(localStorage.getItem("my_family_group_ids") || "[]");
      if (!fgIds.includes(fgId)) {
        fgIds.push(fgId);
        localStorage.setItem("my_family_group_ids", JSON.stringify(fgIds));
      }
    }
  }
}

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("chat_sessions") || "[]");
  } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem("chat_sessions", JSON.stringify(sessions));
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New Chat";
  const text = firstUser.text;
  return text.length > 40 ? text.slice(0, 40) + "..." : text;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>(crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { viewMode } = useViewMode();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load sessions on mount
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save current chat to localStorage whenever messages change (only if there's real content)
  const persistSession = useCallback(() => {
    const hasUserMsg = messages.some((m) => m.role === "user");
    if (!hasUserMsg) return;

    const existing = loadSessions();
    const idx = existing.findIndex((s) => s.id === sessionId);
    const session: ChatSession = {
      id: sessionId,
      title: deriveTitle(messages),
      messages,
      createdAt: idx >= 0 ? existing[idx].createdAt : new Date().toISOString(),
    };

    if (idx >= 0) {
      existing[idx] = session;
    } else {
      existing.unshift(session);
    }

    // Keep max 50 sessions
    const trimmed = existing.slice(0, 50);
    saveSessions(trimmed);
    setSessions(trimmed);
  }, [messages, sessionId]);

  useEffect(() => {
    persistSession();
  }, [persistSession]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg].map(
        (m) => ({ role: m.role, content: m.text })
      );

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, viewMode }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", text: "I'm sorry, I'm having a little trouble right now. Could you try again in a moment?" },
        ]);
      } else {
        // Save identity from ALL executed actions (register + book can happen together)
        if (data.allActions && Array.isArray(data.allActions)) {
          for (const act of data.allActions) {
            savePatientIdentity(act);
          }
        } else if (data.action) {
          savePatientIdentity(data.action);
        }
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", text: data.message, action: data.action },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: "I'm sorry, something went wrong on my end. Please try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setShowConfirm(false);
    setFadeIn(true);
    const newId = crypto.randomUUID();
    setSessionId(newId);
    setMessages([{ ...WELCOME_MSG, id: "welcome" }]);
    setTimeout(() => setFadeIn(false), 500);
  };

  const loadSession = (session: ChatSession) => {
    setSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  const deleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    saveSessions(updated);
    setSessions(updated);
    setConfirmDeleteId(null);
    if (id === sessionId) resetChat();
  };

  const clearAllHistory = () => {
    saveSessions([]);
    setSessions([]);
    setConfirmClearAll(false);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold tracking-tight">Assistant Chat</h1>
          <p className="text-[11px] text-gray-500">Chat with Ria, Resonate's assistant</p>
        </div>
        <div className="flex items-center gap-1.5">
          {showConfirm ? (
            <div className="flex items-center gap-1.5 animate-[fade-in_0.15s_ease-out]">
              <span className="text-[11px] text-gray-500">New chat?</span>
              <button onClick={resetChat} className="text-[11px] text-white rounded-md px-2.5 py-1 transition" style={{ background: "#32453E" }}>Yes</button>
              <button onClick={() => setShowConfirm(false)} className="text-[11px] text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => { setShowHistory(!showHistory); setHistoryPage(0); }}
                className={`flex items-center gap-1 text-[11px] rounded-md px-2.5 py-1 transition ${showHistory ? "text-white" : "text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200"}`}
                style={showHistory ? { background: "#32453E" } : undefined}
              >
                <History className="w-3 h-3" />
                History
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                New
              </button>
            </>
          )}
        </div>
      </header>

      {/* History Panel */}
      {showHistory && (() => {
        const perPage = 5;
        const totalPages = Math.ceil(sessions.length / perPage);
        const paged = sessions.slice(historyPage * perPage, (historyPage + 1) * perPage);

        return (
        <div className="border-b border-gray-200 bg-white px-4 py-2 animate-[fade-in_0.15s_ease-out]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase">
              Chat History{totalPages > 1 ? ` (${historyPage + 1}/${totalPages})` : ""}
            </span>
            {sessions.length > 0 && (
              confirmClearAll ? (
                <div className="flex items-center gap-1.5 animate-[fade-in_0.15s_ease-out]">
                  <span className="text-[10px] text-red-400">Delete all?</span>
                  <button onClick={clearAllHistory} className="text-[10px] text-white bg-red-500 hover:bg-red-600 rounded px-1.5 py-0.5 transition">Yes</button>
                  <button onClick={() => setConfirmClearAll(false)} className="text-[10px] text-gray-500 hover:text-gray-800 bg-gray-100 rounded px-1.5 py-0.5 transition">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmClearAll(true)} className="text-[10px] text-red-400 hover:text-red-600 transition">
                  Clear all
                </button>
              )
            )}
          </div>
          {sessions.length === 0 ? (
            <p className="text-[11px] text-gray-400 py-2">No previous chats</p>
          ) : (
            <div className="space-y-0.5">
              {paged.map((s) => (
                <div
                  key={s.id}
                  onClick={() => loadSession(s)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition group ${
                    s.id === sessionId ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  <MessageSquare className="w-3 h-3 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-gray-700 truncate">{s.title}</div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" · "}
                      {s.messages.filter((m) => m.role === "user").length} message{s.messages.filter((m) => m.role === "user").length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {confirmDeleteId === s.id ? (
                    <div className="flex items-center gap-1 shrink-0 animate-[fade-in_0.15s_ease-out]" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => deleteSession(s.id)} className="text-[9px] text-white bg-red-500 hover:bg-red-600 rounded px-1.5 py-0.5 transition">Delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[9px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 transition">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                      className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-gray-100">
                  <button
                    onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                    disabled={historyPage === 0}
                    className="flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-3 h-3" />Prev
                  </button>
                  <span className="text-[10px] text-gray-400">{sessions.length} chats</span>
                  <button
                    onClick={() => setHistoryPage(Math.min(totalPages - 1, historyPage + 1))}
                    disabled={historyPage >= totalPages - 1}
                    className="flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    Next<ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        );
      })()}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto px-6 py-6 space-y-4 ${fadeIn ? "animate-[fade-in_0.4s_ease-out]" : ""}`}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "text-white rounded-br-md"
                  : "bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm"
              }`}
              style={msg.role === "user" ? { background: "#32453E" } : undefined}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                msg.text
              )}
              {msg.action && (() => {
                const isNotFound = msg.action!.type === "lookup_patient" && msg.action!.result?.includes("No patients found");
                const label =
                  msg.action!.type === "book_appointment" ? "Appointment booked" :
                  msg.action!.type === "register_patient" ? "Patient registered" :
                  msg.action!.type === "cancel_appointment" ? "Appointment cancelled" :
                  msg.action!.type === "reschedule_appointment" ? "Appointment rescheduled" :
                  msg.action!.type === "notify_staff" ? "Staff notified" :
                  msg.action!.type === "lookup_patient" ? (isNotFound ? "Patient not found" : "Patient found") :
                  null;
                const href =
                  msg.action!.type === "book_appointment" || msg.action!.type === "cancel_appointment" || msg.action!.type === "reschedule_appointment"
                    ? (viewMode === "patient" ? "/my-appointments" : "/appointments") :
                  msg.action!.type === "register_patient" || msg.action!.type === "lookup_patient"
                    ? (viewMode === "patient" ? "/my-household" : "/patients") :
                  msg.action!.type === "notify_staff" ? "/notifications" :
                  null;
                const colors = isNotFound
                  ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                  : "text-green-700 bg-green-50 hover:bg-green-100";

                return label ? (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {href ? (
                      <Link href={href} className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 transition ${colors}`}>
                        {label} <ChevronRight className="w-2.5 h-2.5" />
                      </Link>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 ${colors}`}>
                        {label}
                      </span>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-6 py-4 shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#32453E] focus:border-transparent placeholder:text-gray-400"
            style={{ maxHeight: 120 }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 w-10 h-10 rounded-xl text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{ background: "#32453E" }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          Ria is an AI assistant. Please verify important details with our office.
        </p>
      </div>
    </div>
  );
}

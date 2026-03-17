/*
 * Copyright (c) 2026 Nelson Lee. All rights reserved.
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Phone,
  Calendar,
  Shield,
  RefreshCw,
  Plus,
  Pencil,
  X,
  Check,
  Search,
  ArrowUpDown,
  FileText,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Crown,
  Unlink,
  Trash2,
} from "lucide-react";

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

type SortKey = "fullName" | "dateOfBirth" | "createdAt" | "insurance";

const FAMILY_COLORS = [
  "border-l-blue-400",
  "border-l-emerald-400",
  "border-l-amber-400",
  "border-l-purple-400",
  "border-l-rose-400",
  "border-l-cyan-400",
  "border-l-orange-400",
  "border-l-indigo-400",
];

function getFamilyColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return FAMILY_COLORS[Math.abs(hash) % FAMILY_COLORS.length];
}

const emptyForm = { fullName: "", phone: "", dateOfBirth: "", insurance: "", notes: "", familyGroupId: "" };

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortAsc, setSortAsc] = useState(true);
  const [groupByFamily, setGroupByFamily] = useState(false);
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set());

  // Family creation modal
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [primaryContactId, setPrimaryContactId] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pRes, fRes] = await Promise.all([
      fetch("/api/patients"),
      fetch("/api/family-groups"),
    ]);
    const [pData, fData] = await Promise.all([pRes.json(), fRes.json()]);
    setPatients(pData);
    setFamilyGroups(fData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = patients;
    if (q) {
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.dateOfBirth.includes(q) ||
          (p.insurance || "").toLowerCase().includes(q) ||
          (p.notes || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const aVal = (a[sortKey] || "").toLowerCase();
      const bVal = (b[sortKey] || "").toLowerCase();
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return list;
  }, [patients, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleAdd = async () => {
    if (!form.fullName || !form.phone || !form.dateOfBirth) return;
    setSaving(true);
    await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth,
        insurance: form.insurance || null,
        notes: form.notes || "",
        familyGroupId: form.familyGroupId || null,
      }),
    });
    setForm(emptyForm);
    setShowAdd(false);
    setSaving(false);
    fetchData();
  };

  const startEdit = (patient: Patient) => {
    setEditingId(patient.id);
    setForm({
      fullName: patient.fullName,
      phone: patient.phone,
      dateOfBirth: patient.dateOfBirth,
      insurance: patient.insurance || "",
      notes: patient.notes || "",
      familyGroupId: patient.familyGroupId || "",
    });
  };

  const handleEdit = async () => {
    if (!form.fullName || !form.phone || !form.dateOfBirth) return;
    setSaving(true);
    await fetch("/api/patients", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        fullName: form.fullName,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth,
        insurance: form.insurance || null,
        notes: form.notes || "",
        familyGroupId: form.familyGroupId || null,
      }),
    });
    setEditingId(null);
    setForm(emptyForm);
    setSaving(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/patients?id=${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    fetchData();
  };

  const handleRemoveFromFamily = async (patientId: string, familyGroupId: string) => {
    await fetch("/api/family-groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: familyGroupId, removeMemberIds: [patientId] }),
    });
    fetchData();
  };

  const handleDeleteFamily = async (familyId: string) => {
    await fetch(`/api/family-groups?id=${familyId}`, { method: "DELETE" });
    fetchData();
  };

  const handleCreateFamily = async () => {
    if (!familyName || !primaryContactId || selectedMembers.size === 0) return;
    setSaving(true);
    await fetch("/api/family-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: familyName,
        primaryContactId,
        memberIds: Array.from(selectedMembers),
      }),
    });
    setShowCreateFamily(false);
    setFamilyName("");
    setSelectedMembers(new Set());
    setPrimaryContactId("");
    setSaving(false);
    fetchData();
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primaryContactId === id) setPrimaryContactId("");
      } else {
        next.add(id);
        if (!primaryContactId) setPrimaryContactId(id);
      }
      return next;
    });
  };

  const toggleFamilyCollapse = (id: string) => {
    setCollapsedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const inputClass =
    "w-full rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#32453E] focus:border-transparent placeholder:text-gray-400";

  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => toggleSort(key)}
      className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition ${
        sortKey === key ? "bg-[#32453E] text-white" : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {label}
      {sortKey === key && <ArrowUpDown className="w-2.5 h-2.5" />}
    </button>
  );

  // Grouped view data
  const { familyPatients, individualPatients } = useMemo(() => {
    const familyIds = new Set(familyGroups.map((g) => g.id));
    return {
      familyPatients: filtered.filter((p) => p.familyGroupId && familyIds.has(p.familyGroupId)),
      individualPatients: filtered.filter((p) => !p.familyGroupId || !familyIds.has(p.familyGroupId)),
    };
  }, [filtered, familyGroups]);

  const ungroupedPatients = useMemo(
    () => patients.filter((p) => !p.familyGroupId),
    [patients]
  );

  const renderPatientCard = (patient: Patient, familyColor?: string) => (
    <div
      key={patient.id}
      className={`bg-white rounded-lg border border-gray-200 px-3 py-2 flex items-center gap-3 ${
        familyColor ? `border-l-[3px] ${familyColor}` : ""
      }`}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs"
        style={{ background: "#B3C5B6", color: "#32453E" }}
      >
        {patient.fullName.split(" ").map((n) => n[0]).join("")}
      </div>

      {editingId === patient.id ? (
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-1.5">
            <input className={inputClass} placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <input className={inputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={inputClass} type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            <input className={inputClass} placeholder="Insurance" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} />
          </div>
          <div className="mt-1.5">
            <select
              className={inputClass}
              value={form.familyGroupId}
              onChange={(e) => setForm({ ...form, familyGroupId: e.target.value })}
            >
              <option value="">No family group</option>
              {familyGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <textarea className={`${inputClass} mt-1.5 resize-none`} rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex items-center gap-1.5 mt-1.5">
            <button onClick={handleEdit} disabled={saving} className="flex items-center gap-1 text-[10px] text-white rounded-md px-2 py-0.5 transition disabled:opacity-40" style={{ background: "#32453E" }}>
              <Check className="w-2.5 h-2.5" />Save
            </button>
            <button onClick={cancelForm} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 bg-gray-100 rounded-md px-2 py-0.5 transition">
              <X className="w-2.5 h-2.5" />Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-800 leading-tight">{patient.fullName}</span>
              {patient.familyGroupId && familyGroups.find((g) => g.primaryContactId === patient.id) && (
                <Crown className="w-3 h-3 text-amber-500" />
              )}
              {patient.familyGroupId && !groupByFamily && (
                <span className="text-[9px] font-medium text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                  {familyGroups.find((g) => g.id === patient.familyGroupId)?.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
              <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{patient.phone}</span>
              <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{patient.dateOfBirth}</span>
              <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5" />{patient.insurance || "Self-pay"}</span>
            </div>
            {patient.notes && (
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                <FileText className="w-2.5 h-2.5" />{patient.notes}
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {patient.familyGroupId && groupByFamily && (
              <button
                onClick={() => handleRemoveFromFamily(patient.id, patient.familyGroupId!)}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                title="Remove from family"
              >
                <Unlink className="w-3 h-3" />
              </button>
            )}
            <button onClick={() => startEdit(patient)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
              <Pencil className="w-3 h-3" />
            </button>
            {confirmDeleteId === patient.id ? (
              <div className="flex items-center gap-0.5 animate-[fade-in_0.15s_ease-out]">
                <button onClick={() => handleDelete(patient.id)} className="text-[10px] text-white rounded-md px-2 py-0.5" style={{ background: "#dc2626" }}>Yes</button>
                <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDeleteId(patient.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition" title="Delete patient">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight">Patients</h1>
          <p className="text-[11px] text-gray-500">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {familyGroups.length > 0 && ` \u00B7 ${familyGroups.length} famil${familyGroups.length !== 1 ? "ies" : "y"}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); setForm(emptyForm); }}
            className="flex items-center gap-1 text-[11px] text-white rounded-md px-2.5 py-1 transition"
            style={{ background: "#32453E" }}
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
          <button
            onClick={() => setShowCreateFamily(true)}
            className="flex items-center gap-1 text-[11px] text-white rounded-md px-2.5 py-1 transition"
            style={{ background: "#32453E" }}
          >
            <UserPlus className="w-3 h-3" />
            Family
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </header>

      <div className="px-4 py-3 space-y-2">
        {/* Search + Sort bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, DOB, insurance, or notes..."
              className="w-full rounded-md border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#32453E] focus:border-transparent placeholder:text-gray-400"
            />
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {familyGroups.length > 0 && (
              <button
                onClick={() => setGroupByFamily(!groupByFamily)}
                className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition ${
                  groupByFamily ? "bg-[#32453E] text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <Users className="w-2.5 h-2.5" />
                Families
              </button>
            )}
            {sortBtn("fullName", "Name")}
            {sortBtn("dateOfBirth", "DOB")}
            {sortBtn("insurance", "Insurance")}
            {sortBtn("createdAt", "Added")}
          </div>
        </div>

        {/* Add Patient Form */}
        {showAdd && (
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-semibold text-gray-800 mb-2">New Patient</h3>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              <input className={inputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className={inputClass} type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              <input className={inputClass} placeholder="Insurance (blank = self-pay)" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} />
            </div>
            {familyGroups.length > 0 && (
              <select
                className={`${inputClass} mt-2`}
                value={form.familyGroupId}
                onChange={(e) => setForm({ ...form, familyGroupId: e.target.value })}
              >
                <option value="">No family group</option>
                {familyGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <textarea className={`${inputClass} mt-2 resize-none`} rows={2} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex items-center gap-1.5 mt-2">
              <button onClick={handleAdd} disabled={saving || !form.fullName || !form.phone || !form.dateOfBirth} className="flex items-center gap-1 text-[11px] text-white rounded-md px-2.5 py-1 transition disabled:opacity-40" style={{ background: "#32453E" }}>
                <Check className="w-3 h-3" />{saving ? "Saving..." : "Save"}
              </button>
              <button onClick={cancelForm} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition">
                <X className="w-3 h-3" />Cancel
              </button>
            </div>
          </div>
        )}

        {/* Patient List */}
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (<div key={i} className="shimmer h-14 rounded-lg" />))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-xs">{search ? "No matching patients" : "No patients registered yet"}</p>
          </div>
        ) : groupByFamily ? (
          // Grouped by family view
          <div className="space-y-3">
            {familyGroups.map((group) => {
              const members = familyPatients.filter((p) => p.familyGroupId === group.id);
              if (members.length === 0) return null;
              const isCollapsed = collapsedFamilies.has(group.id);
              const color = getFamilyColor(group.id);

              return (
                <div key={group.id}>
                  {/* Family header */}
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => toggleFamilyCollapse(group.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition"
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                      }
                      <Users className="w-3.5 h-3.5" />
                      {group.name}
                    </button>
                    <span className="text-[10px] text-gray-400">
                      {members.length} member{members.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => handleDeleteFamily(group.id)}
                      className="ml-auto text-[10px] text-gray-400 hover:text-red-500 transition px-1.5 py-0.5 rounded hover:bg-red-50"
                    >
                      Ungroup
                    </button>
                  </div>

                  {/* Family members */}
                  {!isCollapsed && (
                    <div className="space-y-1 pl-1">
                      {members.map((patient) => renderPatientCard(patient, color))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Individual patients */}
            {individualPatients.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-gray-500">Individual Patients</span>
                  <span className="text-[10px] text-gray-400">{individualPatients.length}</span>
                </div>
                <div className="space-y-1">
                  {individualPatients.map((patient) => renderPatientCard(patient))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Flat list view
          <div className="space-y-1">
            {filtered.map((patient) => renderPatientCard(patient))}
          </div>
        )}
      </div>

      {/* Create Family Group Modal */}
      {showCreateFamily && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-bold text-gray-800">Create Family Group</h2>
              <button
                onClick={() => { setShowCreateFamily(false); setFamilyName(""); setSelectedMembers(new Set()); setPrimaryContactId(""); }}
                className="p-1 rounded hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Family Name</label>
                <input
                  type="text"
                  placeholder='e.g. "Johnson Family"'
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Select Members ({selectedMembers.size} selected)
                </label>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {ungroupedPatients.length === 0 ? (
                    <p className="text-xs text-gray-400 p-3 text-center">All patients are already in family groups</p>
                  ) : (
                    ungroupedPatients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => toggleMember(p.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition border-b border-gray-100 last:border-b-0 ${
                          selectedMembers.has(p.id) ? "bg-[#B3C5B6]/20" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selectedMembers.has(p.id) ? "bg-[#32453E] border-[#32453E]" : "border-gray-300"
                        }`}>
                          {selectedMembers.has(p.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="flex-1">{p.fullName}</span>
                        {primaryContactId === p.id && (
                          <span className="text-[9px] font-medium text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">Primary</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedMembers.size > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Primary Contact</label>
                  <select
                    value={primaryContactId}
                    onChange={(e) => setPrimaryContactId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B3C5B6]"
                  >
                    {Array.from(selectedMembers).map((id) => {
                      const p = patients.find((pt) => pt.id === id);
                      return p ? <option key={p.id} value={p.id}>{p.fullName}</option> : null;
                    })}
                  </select>
                </div>
              )}

              <button
                onClick={handleCreateFamily}
                disabled={saving || !familyName || selectedMembers.size < 2 || !primaryContactId}
                style={{ background: "#32453E" }}
                className="w-full text-white text-sm font-medium rounded-lg py-2.5 transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Family Group"}
              </button>
              {selectedMembers.size > 0 && selectedMembers.size < 2 && (
                <p className="text-[10px] text-amber-600 text-center">Select at least 2 members to create a family group</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

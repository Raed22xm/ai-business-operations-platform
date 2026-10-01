"use client";

import { useState } from "react";
import {
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileText,
  Layers,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  type CustomerDeliverable,
  type CustomerMeta,
  type CustomerNoteEntry,
  DELIVERABLE_CATEGORIES,
  POPULAR_TECH_PRESETS,
  PRESET_DELIVERABLE_TEMPLATES,
} from "./customer-meta";

interface CustomerMetaSectionProps {
  customerId: number;
  customerName: string;
  meta: CustomerMeta;
  onUpdateMeta: (newMeta: CustomerMeta) => void;
}

export function CustomerMetaSection({
  customerId,
  customerName,
  meta,
  onUpdateMeta,
}: CustomerMetaSectionProps) {
  const [activeTab, setActiveTab] = useState<"deliverables" | "tech" | "notes">("deliverables");

  // New Deliverable input state
  const [newDelTitle, setNewDelTitle] = useState("");
  const [newDelCategory, setNewDelCategory] = useState<CustomerDeliverable["category"]>("website");
  const [showAddDel, setShowAddDel] = useState(false);

  // New Tech Tag state
  const [newTagInput, setNewTagInput] = useState("");

  // New Note state
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState<CustomerNoteEntry["category"]>("general");

  // --- Deliverables Handlers ---
  function handleAddDeliverable(title: string, category: CustomerDeliverable["category"]) {
    if (!title.trim()) return;
    const newDel: CustomerDeliverable = {
      id: `del-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: title.trim(),
      category,
      status: "completed",
      date: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    };
    const updated = {
      ...meta,
      deliverables: [newDel, ...meta.deliverables],
    };
    onUpdateMeta(updated);
    setNewDelTitle("");
    setShowAddDel(false);
  }

  function handleToggleStatus(delId: string) {
    const nextStatusMap: Record<CustomerDeliverable["status"], CustomerDeliverable["status"]> = {
      completed: "in_progress",
      in_progress: "planned",
      planned: "completed",
    };
    const updated = {
      ...meta,
      deliverables: meta.deliverables.map((d) =>
        d.id === delId ? { ...d, status: nextStatusMap[d.status] } : d
      ),
    };
    onUpdateMeta(updated);
  }

  function handleDeleteDeliverable(delId: string) {
    const updated = {
      ...meta,
      deliverables: meta.deliverables.filter((d) => d.id !== delId),
    };
    onUpdateMeta(updated);
  }

  // --- Tech Stack Handlers ---
  function handleAddTechTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || meta.techStack.includes(trimmed)) return;
    const updated = {
      ...meta,
      techStack: [...meta.techStack, trimmed],
    };
    onUpdateMeta(updated);
    setNewTagInput("");
  }

  function handleRemoveTechTag(tagToRemove: string) {
    const updated = {
      ...meta,
      techStack: meta.techStack.filter((t) => t !== tagToRemove),
    };
    onUpdateMeta(updated);
  }

  // --- Notes Handlers ---
  function handleAddNote() {
    if (!newNoteText.trim()) return;
    const newNote: CustomerNoteEntry = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: newNoteText.trim(),
      createdAt: new Date().toISOString(),
      category: newNoteCategory,
    };
    const updated = {
      ...meta,
      notes: [newNote, ...meta.notes],
    };
    onUpdateMeta(updated);
    setNewNoteText("");
  }

  function handleDeleteNote(noteId: string) {
    const updated = {
      ...meta,
      notes: meta.notes.filter((n) => n.id !== noteId),
    };
    onUpdateMeta(updated);
  }

  return (
    <section className="map-info-section map-meta-container">
      {/* Tab Switcher Header */}
      <div className="map-meta-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("deliverables")}
          className={`map-meta-tab ${activeTab === "deliverables" ? "is-active" : ""}`}
        >
          <Layers size={13} />
          <span>What We Did</span>
          <span className="map-meta-count">{meta.deliverables.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tech")}
          className={`map-meta-tab ${activeTab === "tech" ? "is-active" : ""}`}
        >
          <Cpu size={13} />
          <span>Stuff Used</span>
          <span className="map-meta-count">{meta.techStack.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`map-meta-tab ${activeTab === "notes" ? "is-active" : ""}`}
        >
          <FileText size={13} />
          <span>Notes & Info</span>
          <span className="map-meta-count">{meta.notes.length}</span>
        </button>
      </div>

      {/* TAB 1: DELIVERABLES (WHAT WE DONE FOR HIM) */}
      {activeTab === "deliverables" && (
        <div className="map-meta-body">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">
                Services & Deliverables for {customerName}
              </h4>
              <p className="text-[11px] text-slate-400">
                Websites, apps, automations, and projects delivered.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDel((prev) => !prev)}
              className="workspace-button small-button is-primary"
            >
              <Plus size={12} />
              <span>{showAddDel ? "Cancel" : "Add Project"}</span>
            </button>
          </div>

          {/* Quick preset chips */}
          <div className="mb-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Quick Add Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_DELIVERABLE_TEMPLATES.map((tmpl) => {
                const alreadyAdded = meta.deliverables.some((d) => d.title === tmpl.title);
                const catInfo = DELIVERABLE_CATEGORIES[tmpl.category];
                return (
                  <button
                    key={tmpl.title}
                    type="button"
                    onClick={() => handleAddDeliverable(tmpl.title, tmpl.category)}
                    className="map-meta-preset-chip"
                    title={`Add ${tmpl.title}`}
                  >
                    <span>{catInfo.icon}</span>
                    <span>{tmpl.title}</span>
                    <Plus size={10} className="text-emerald-400 ml-0.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Add Form */}
          {showAddDel && (
            <div className="map-meta-add-form mb-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={newDelTitle}
                  onChange={(e) => setNewDelTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddDeliverable(newDelTitle, newDelCategory);
                    }
                  }}
                  placeholder="e.g. Haircut Booking Website, AI Bot, Mobile App..."
                  className="map-input text-xs flex-1"
                  autoFocus
                />
                <select
                  value={newDelCategory}
                  onChange={(e) =>
                    setNewDelCategory(e.target.value as CustomerDeliverable["category"])
                  }
                  className="map-input text-xs w-36 cursor-pointer"
                >
                  {Object.entries(DELIVERABLE_CATEGORIES).map(([key, info]) => (
                    <option key={key} value={key} className="bg-slate-900 text-slate-100">
                      {info.icon} {info.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDel(false)}
                  className="workspace-button small-button"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddDeliverable(newDelTitle, newDelCategory)}
                  disabled={!newDelTitle.trim()}
                  className="workspace-button small-button is-primary"
                >
                  <Plus size={12} />
                  Save Deliverable
                </button>
              </div>
            </div>
          )}

          {/* Deliverables List */}
          <div className="space-y-2">
            {meta.deliverables.length === 0 ? (
              <div className="p-3 bg-slate-900/50 rounded border border-slate-800 text-xs text-slate-400 text-center">
                No deliverables added yet. Click one of the quick presets above to add a website or application.
              </div>
            ) : (
              meta.deliverables.map((del) => {
                const cat = DELIVERABLE_CATEGORIES[del.category] || DELIVERABLE_CATEGORIES.custom;
                return (
                  <div key={del.id} className="map-deliv-item">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className="map-deliv-icon-box"
                        style={{ background: cat.bg, borderColor: cat.border, color: cat.color }}
                      >
                        <span>{cat.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-100 truncate">
                            {del.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                          <span style={{ color: cat.color }}>{cat.label}</span>
                          {del.date ? <span>· {del.date}</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Clickable Status Switcher */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(del.id)}
                        className={`map-deliv-status-btn ${
                          del.status === "completed"
                            ? "is-completed"
                            : del.status === "in_progress"
                            ? "is-progress"
                            : "is-planned"
                        }`}
                        title="Click to toggle status (Completed -> In Progress -> Planned)"
                      >
                        {del.status === "completed" ? (
                          <>
                            <CheckCircle2 size={11} />
                            <span>Done</span>
                          </>
                        ) : del.status === "in_progress" ? (
                          <>
                            <Clock size={11} />
                            <span>In Progress</span>
                          </>
                        ) : (
                          <>
                            <Layers size={11} />
                            <span>Planned</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDeliverable(del.id)}
                        className="map-deliv-delete-btn"
                        title="Remove deliverable"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TECH STACK & STUFF USED */}
      {activeTab === "tech" && (
        <div className="map-meta-body">
          <div className="mb-2">
            <h4 className="text-xs font-semibold text-slate-200">
              Stuff &amp; Tech Used on {customerName}
            </h4>
            <p className="text-[11px] text-slate-400">
              Tools, frameworks, and technologies applied for this client.
            </p>
          </div>

          {/* Active Tech Badges */}
          <div className="map-tech-tags-container mb-3">
            {meta.techStack.length === 0 ? (
              <span className="text-xs text-slate-500 italic">No tools or tech tags added yet.</span>
            ) : (
              meta.techStack.map((tech) => (
                <span key={tech} className="map-tech-tag">
                  <Cpu size={11} className="text-emerald-400" />
                  <span>{tech}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTechTag(tech)}
                    className="map-tech-tag-remove"
                    title={`Remove ${tech}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Add custom tag input */}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTechTag(newTagInput);
                }
              }}
              placeholder="Add tool/tech (e.g. Next.js, Stripe, Barber Kit, etc.)..."
              className="map-input text-xs flex-1"
            />
            <button
              type="button"
              onClick={() => handleAddTechTag(newTagInput)}
              disabled={!newTagInput.trim()}
              className="workspace-button small-button is-primary"
            >
              <Plus size={12} />
              <span>Add Tag</span>
            </button>
          </div>

          {/* Preset Suggestions */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Click to add suggested tools:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_TECH_PRESETS.map((preset) => {
                const isSelected = meta.techStack.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => (isSelected ? handleRemoveTechTag(preset) : handleAddTechTag(preset))}
                    className={`map-tech-suggest-chip ${isSelected ? "is-active" : ""}`}
                  >
                    {isSelected ? <Check size={10} className="text-emerald-400" /> : <Plus size={10} />}
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NOTES & INFORMATION */}
      {activeTab === "notes" && (
        <div className="map-meta-body">
          <div className="mb-2">
            <h4 className="text-xs font-semibold text-slate-200">
              Customer Notes &amp; Info for {customerName}
            </h4>
            <p className="text-[11px] text-slate-400">
              Internal client notes, special requests, style preferences, and meeting memos.
            </p>
          </div>

          {/* Add Note Input Area */}
          <div className="map-note-composer mb-3">
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder={`Write a note or preference for ${customerName}...`}
              rows={2}
              className="map-input text-xs resize-none mb-1.5"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Type:</span>
                <select
                  value={newNoteCategory}
                  onChange={(e) =>
                    setNewNoteCategory(e.target.value as CustomerNoteEntry["category"])
                  }
                  className="bg-slate-900 border border-slate-800 text-[11px] text-slate-300 rounded px-1.5 py-0.5"
                >
                  <option value="general">📌 General Note</option>
                  <option value="preference">⭐ Client Preference</option>
                  <option value="requirement">⚡ Requirement</option>
                  <option value="meeting">💬 Meeting Memo</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddNote}
                disabled={!newNoteText.trim()}
                className="workspace-button small-button is-primary"
              >
                <Plus size={12} />
                <span>Save Note</span>
              </button>
            </div>
          </div>

          {/* Notes History List */}
          <div className="space-y-2">
            {meta.notes.length === 0 ? (
              <div className="p-3 bg-slate-900/50 rounded border border-slate-800 text-xs text-slate-400 text-center">
                No notes for this customer yet. Add a quick note or preference above!
              </div>
            ) : (
              meta.notes.map((note) => {
                const dateStr = new Date(note.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div key={note.id} className="map-note-card">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wider ${
                            note.category === "preference"
                              ? "bg-amber-950/70 text-amber-300 border border-amber-800/40"
                              : note.category === "requirement"
                              ? "bg-rose-950/70 text-rose-300 border border-rose-800/40"
                              : note.category === "meeting"
                              ? "bg-sky-950/70 text-sky-300 border border-sky-800/40"
                              : "bg-slate-800 text-slate-300 border border-slate-700/50"
                          }`}
                        >
                          {note.category || "Note"}
                        </span>
                        <span className="text-[10px] text-slate-400">{dateStr}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
                        title="Delete note"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed break-words whitespace-pre-wrap">
                      {note.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}

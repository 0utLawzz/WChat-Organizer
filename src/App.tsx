import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseWhatsAppExport,
  groupByDate,
  formatGroupDate,
  avatarColor,
  initials,
  type ChatMessage,
} from "./lib/whatsapp-parser";
import {
  Upload,
  Search,
  Bookmark,
  BookmarkCheck,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Download,
  Lock,
  Cloud,
  FileSpreadsheet,
  LogOut,
  Tag,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface Label {
  id: string;
  name: string;
  color: string;
}

interface Todo {
  id: string;
  text: string;
  done: boolean;
  messageId?: string;
  createdAt: number;
}

interface PersistedState {
  labels: Label[];
  messageLabels: Record<string, string[]>;
  savedIds: string[];
  todos: Todo[];
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const LS_KEY = "marque-nb-state-v1";
const AUTH_KEY = "marque-nb-auth";
// Simple password gate — change this value for production use
const APP_PASSWORD = "brandex2026";

const DEFAULT_LABELS: Label[] = [
  { id: "important", name: "Important", color: "orange" },
  { id: "client", name: "Client", color: "teal" },
  { id: "followup", name: "Follow-up", color: "yellow" },
];

const LABEL_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  orange: { bg: "rgba(201,74,0,0.12)", border: "#C94A00", text: "#C94A00" },
  teal: { bg: "rgba(13,153,112,0.12)", border: "#0D9970", text: "#0A6B52" },
  yellow: { bg: "rgba(212,168,0,0.15)", border: "#D4A800", text: "#8a6800" },
  purple: { bg: "rgba(139,47,201,0.12)", border: "#8B2FC9", text: "#8B2FC9" },
  dark: { bg: "rgba(12,12,12,0.08)", border: "#0C0C0C", text: "#555555" },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    /* ignore */
  }
  return {
    labels: DEFAULT_LABELS,
    messageLabels: {},
    savedIds: [],
    todos: [],
  };
}

function savePersisted(state: PersistedState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/* ------------------------------------------------------------------ */
/* Login Gate                                                         */
/* ------------------------------------------------------------------ */

function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === APP_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      onSuccess();
    } else {
      setError("Incorrect password");
    }
  }

  return (
    <div className="theme-neobrutalism flex min-h-screen items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="nb-panel w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="nb-stamp nb-stamp-orange mb-3" style={{ transform: "rotate(-4deg)" }}>
            LOCKED
          </div>
          <h1 className="font-display text-4xl tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            MARQUE<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1 text-sm opacity-60">Enter password to access the desk</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            className="nb-input"
            placeholder="Password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError("");
            }}
            autoFocus
          />
          {error && (
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              {error}
            </p>
          )}
          <button type="submit" className="nb-btn w-full">
            <Lock size={14} /> Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main App                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === "1",
  );

  if (!authed) {
    return <LoginGate onSuccess={() => setAuthed(true)} />;
  }

  return <Desk onLogout={() => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  }} />;
}

function Desk({ onLogout }: { onLogout: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSender, setActiveSender] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [labelPickerFor, setLabelPickerFor] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newTodoText, setNewTodoText] = useState("");
  const [activeTab, setActiveTab] = useState<"messages" | "todos" | "backup">("messages");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [persisted, setPersisted] = useState<PersistedState>(loadPersisted);

  // Persist on change
  useEffect(() => {
    savePersisted(persisted);
  }, [persisted]);

  // Load sample on first visit
  useEffect(() => {
    async function loadSample() {
      try {
        const res = await fetch("/chat-export.txt");
        if (res.ok) {
          const text = await res.text();
          setMessages(parseWhatsAppExport(text));
        }
      } catch {
        /* no sample */
      } finally {
        setLoading(false);
      }
    }
    loadSample();
  }, []);

  const senders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of messages) {
      if (m.sender) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [messages]);

  const filtered = useMemo(() => {
    let list = messages;
    if (showSavedOnly) {
      list = list.filter((m) => persisted.savedIds.includes(m.id));
    }
    if (activeSender) {
      list = list.filter((m) => m.sender === activeSender);
    }
    if (activeLabel) {
      list = list.filter((m) =>
        (persisted.messageLabels[m.id] ?? []).includes(activeLabel),
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.text.toLowerCase().includes(q) ||
          (m.sender ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [messages, search, activeSender, activeLabel, showSavedOnly, persisted]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  /* Actions */
  function toggleLabel(messageId: string, labelId: string) {
    setPersisted((p) => {
      const current = p.messageLabels[messageId] ?? [];
      const next = current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId];
      return {
        ...p,
        messageLabels: { ...p.messageLabels, [messageId]: next },
      };
    });
  }

  function toggleSave(messageId: string) {
    setPersisted((p) => {
      const has = p.savedIds.includes(messageId);
      return {
        ...p,
        savedIds: has
          ? p.savedIds.filter((id) => id !== messageId)
          : [...p.savedIds, messageId],
      };
    });
  }

  function addTodo(text: string, messageId?: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPersisted((p) => ({
      ...p,
      todos: [
        {
          id: `t${Date.now()}`,
          text: trimmed,
          done: false,
          messageId,
          createdAt: Date.now(),
        },
        ...p.todos,
      ],
    }));
    setNewTodoText("");
  }

  function toggleTodo(id: string) {
    setPersisted((p) => ({
      ...p,
      todos: p.todos.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      ),
    }));
  }

  function removeTodo(id: string) {
    setPersisted((p) => ({
      ...p,
      todos: p.todos.filter((t) => t.id !== id),
    }));
  }

  function addLabel() {
    const name = newLabelName.trim();
    if (!name) return;
    const colors = ["orange", "teal", "yellow", "purple", "dark"];
    const color = colors[persisted.labels.length % colors.length] ?? "orange";
    setPersisted((p) => ({
      ...p,
      labels: [
        ...p.labels,
        { id: `l${Date.now()}`, name, color },
      ],
    }));
    setNewLabelName("");
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setMessages(parseWhatsAppExport(text));
    };
    reader.readAsText(file);
  }

  /* Backup: Google Sheets compatible CSV export */
  function exportToCSV() {
    const rows = [
      ["id", "date", "time", "sender", "text", "labels", "saved"],
      ...messages.map((m) => [
        m.id,
        m.date,
        m.time,
        m.sender ?? "",
        `"${m.text.replace(/"/g, '""')}"`,
        (persisted.messageLabels[m.id] ?? [])
          .map((lid) => persisted.labels.find((l) => l.id === lid)?.name ?? lid)
          .join("; "),
        persisted.savedIds.includes(m.id) ? "yes" : "no",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marque-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportFullJSON() {
    const payload = {
      exportedAt: new Date().toISOString(),
      messages,
      ...persisted,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marque-full-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* Supabase stub — feature ready for future wiring */
  function triggerSupabaseSync() {
    alert(
      "Supabase backup sync is prepared as a feature.\n\n" +
        "To enable:\n" +
        "1. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env\n" +
        "2. Create tables for messages / labels / todos\n" +
        "3. Wire the client in src/integrations/supabase\n\n" +
        "Currently using localStorage + Google Sheets CSV export.",
    );
  }

  const openTodos = persisted.todos.filter((t) => !t.done);

  return (
    <div className="theme-neobrutalism min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Navbar */}
      <header className="nb-navbar">
        <div className="nb-logo">
          MARQUE<span className="dot">.</span>
          <span className="stories"> STORIES</span>
        </div>
        <div className="flex-1" />
        <span className="hidden text-xs text-white/50 sm:inline" style={{ fontFamily: "var(--font-mono)" }}>
          {messages.length.toLocaleString()} MSGS · {openTodos.length} OPEN TODOS
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={handleUpload}
        />
        <button className="nb-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Upload .txt
        </button>
        <button className="nb-btn nb-btn-secondary" onClick={onLogout} title="Logout">
          <LogOut size={14} />
        </button>
      </header>

      {/* Tabs */}
      <div className="nb-tabs">
        <button
          className={`nb-tab ${activeTab === "messages" ? "active" : ""}`}
          onClick={() => setActiveTab("messages")}
        >
          Messages
        </button>
        <button
          className={`nb-tab ${activeTab === "todos" ? "active" : ""}`}
          onClick={() => setActiveTab("todos")}
        >
          To-Dos ({openTodos.length})
        </button>
        <button
          className={`nb-tab ${activeTab === "backup" ? "active" : ""}`}
          onClick={() => setActiveTab("backup")}
        >
          Backup & Sync
        </button>
      </div>

      <div className="mx-auto flex max-w-[1280px] gap-5 px-4 py-5 lg:px-6">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col gap-4 lg:flex">
          {/* Filters */}
          <div className="nb-panel p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50" style={{ fontFamily: "var(--font-mono)" }}>
              Filters
            </div>
            <div className="flex flex-col gap-1">
              <FilterChip
                active={!activeSender && !showSavedOnly && !activeLabel}
                onClick={() => {
                  setActiveSender(null);
                  setShowSavedOnly(false);
                  setActiveLabel(null);
                }}
              >
                All
              </FilterChip>
              <FilterChip
                active={showSavedOnly}
                onClick={() => {
                  setShowSavedOnly(!showSavedOnly);
                  setActiveSender(null);
                  setActiveLabel(null);
                }}
              >
                <Bookmark size={12} /> Saved
              </FilterChip>
            </div>
          </div>

          {/* Labels */}
          <div className="nb-panel p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50" style={{ fontFamily: "var(--font-mono)" }}>
              Labels
            </div>
            <div className="flex flex-col gap-1">
              {persisted.labels.map((label) => {
                const c = LABEL_COLORS[label.color] ?? LABEL_COLORS.orange!;
                return (
                  <FilterChip
                    key={label.id}
                    active={activeLabel === label.id}
                    onClick={() =>
                      setActiveLabel(activeLabel === label.id ? null : label.id)
                    }
                  >
                    <span
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: c.border }}
                    />
                    {label.name}
                  </FilterChip>
                );
              })}
            </div>
            <div className="mt-3 flex gap-1">
              <input
                className="nb-input text-xs"
                placeholder="New label…"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLabel()}
              />
              <button className="nb-btn nb-btn-secondary px-2" onClick={addLabel}>
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Senders */}
          <div className="nb-panel p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50" style={{ fontFamily: "var(--font-mono)" }}>
              Senders
            </div>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {senders.slice(0, 12).map((s) => (
                <FilterChip
                  key={s}
                  active={activeSender === s}
                  onClick={() =>
                    setActiveSender(activeSender === s ? null : s)
                  }
                >
                  <span
                    className="grid size-5 place-items-center rounded-sm text-[9px] font-bold text-white"
                    style={{ background: avatarColor(s) }}
                  >
                    {initials(s)}
                  </span>
                  <span className="truncate">{s}</span>
                </FilterChip>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {activeTab === "messages" && (
            <div className="nb-panel overflow-hidden">
              {/* Search */}
              <div className="flex items-center gap-2 border-b-2 border-black/10 px-4 py-3">
                <Search size={16} className="opacity-40" />
                <input
                  className="flex-1 border-none bg-transparent text-sm outline-none"
                  style={{ fontFamily: "var(--font-body)" }}
                  placeholder="Search messages, senders…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm opacity-50">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="nb-stamp nb-stamp-yellow mb-3" style={{ transform: "rotate(3deg)" }}>
                    EMPTY
                  </div>
                  <p className="text-sm opacity-60">
                    {messages.length === 0
                      ? "Upload a WhatsApp .txt export to begin."
                      : "No messages match the current filters."}
                  </p>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                  {Array.from(groups.entries()).map(([date, msgs]) => (
                    <div key={date}>
                      <div
                        className="sticky top-0 z-10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                        style={{
                          background: "var(--bg-alt)",
                          borderBottom: "2px solid rgba(12,12,12,0.1)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {formatGroupDate(msgs[0]?.timestamp ?? 0)}
                      </div>
                      {msgs.map((m) => (
                        <MessageRow
                          key={m.id}
                          message={m}
                          labels={persisted.labels}
                          assignedLabels={persisted.messageLabels[m.id] ?? []}
                          saved={persisted.savedIds.includes(m.id)}
                          labelPickerOpen={labelPickerFor === m.id}
                          onToggleSave={() => toggleSave(m.id)}
                          onToggleLabel={(lid) => toggleLabel(m.id, lid)}
                          onOpenLabelPicker={() =>
                            setLabelPickerFor(
                              labelPickerFor === m.id ? null : m.id,
                            )
                          }
                          onAddTodo={() => addTodo(m.text.slice(0, 120), m.id)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "todos" && (
            <div className="nb-panel p-5">
              <h2
                className="mb-4 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                TO-DOS
              </h2>
              <div className="mb-4 flex gap-2">
                <input
                  className="nb-input"
                  placeholder="Add a to-do…"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo(newTodoText)}
                />
                <button className="nb-btn" onClick={() => addTodo(newTodoText)}>
                  <Plus size={14} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {persisted.todos.length === 0 && (
                  <p className="text-sm opacity-50">No to-dos yet.</p>
                )}
                {persisted.todos.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 border-2 border-black/10 p-3"
                    style={{
                      background: t.done ? "var(--bg-alt)" : "var(--panel)",
                      opacity: t.done ? 0.65 : 1,
                    }}
                  >
                    <button onClick={() => toggleTodo(t.id)} className="mt-0.5">
                      {t.done ? (
                        <CheckSquare size={18} style={{ color: "var(--accent2)" }} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                    <span
                      className="flex-1 text-sm"
                      style={{
                        textDecoration: t.done ? "line-through" : "none",
                      }}
                    >
                      {t.text}
                    </span>
                    <button
                      onClick={() => removeTodo(t.id)}
                      className="opacity-40 hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "backup" && (
            <div className="nb-panel p-6">
              <h2
                className="mb-2 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                BACKUP & SYNC
              </h2>
              <p className="mb-6 text-sm opacity-60">
                Current primary backup: Google Sheets (CSV export). Supabase sync is available as a ready feature.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="border-3 border-black p-5" style={{ border: "3px solid #0C0C0C", boxShadow: "5px 5px 0 #0C0C0C" }}>
                  <div className="mb-3 flex items-center gap-2">
                    <FileSpreadsheet size={20} style={{ color: "var(--accent2)" }} />
                    <span className="font-medium">Google Sheets</span>
                  </div>
                  <p className="mb-4 text-xs opacity-60">
                    Export a CSV that opens directly in Google Sheets. Import / re-upload later for restore.
                  </p>
                  <button className="nb-btn nb-btn-teal w-full" onClick={exportToCSV}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>

                <div className="border-3 border-black p-5" style={{ border: "3px solid #0C0C0C", boxShadow: "5px 5px 0 #0C0C0C" }}>
                  <div className="mb-3 flex items-center gap-2">
                    <Cloud size={20} style={{ color: "var(--accent)" }} />
                    <span className="font-medium">Supabase Sync</span>
                  </div>
                  <p className="mb-4 text-xs opacity-60">
                    Cloud backup & multi-device sync. Feature scaffolded — connect credentials to activate.
                  </p>
                  <button className="nb-btn w-full" onClick={triggerSupabaseSync}>
                    <Cloud size={14} /> Configure Supabase
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <button className="nb-btn nb-btn-secondary" onClick={exportFullJSON}>
                  <Download size={14} /> Full JSON Backup
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-xs transition-colors"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--black)",
        fontFamily: "var(--font-body)",
        fontWeight: active ? 600 : 400,
        border: active ? "2px solid #0C0C0C" : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function MessageRow({
  message,
  labels,
  assignedLabels,
  saved,
  labelPickerOpen,
  onToggleSave,
  onToggleLabel,
  onOpenLabelPicker,
  onAddTodo,
}: {
  message: ChatMessage;
  labels: Label[];
  assignedLabels: string[];
  saved: boolean;
  labelPickerOpen: boolean;
  onToggleSave: () => void;
  onToggleLabel: (id: string) => void;
  onOpenLabelPicker: () => void;
  onAddTodo: () => void;
}) {
  return (
    <div className="nb-msg relative">
      <div className="flex gap-3">
        {message.sender ? (
          <div
            className="grid size-8 shrink-0 place-items-center rounded-sm text-[11px] font-bold text-white"
            style={{ background: avatarColor(message.sender) }}
          >
            {initials(message.sender)}
          </div>
        ) : (
          <div
            className="grid size-8 shrink-0 place-items-center rounded-sm text-[10px]"
            style={{ background: "var(--bg-alt)", border: "2px solid #0C0C0C" }}
          >
            SYS
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold">
              {message.sender ?? "System"}
            </span>
            <span
              className="text-[11px] opacity-40"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {message.time}
            </span>
            {assignedLabels.map((lid) => {
              const label = labels.find((l) => l.id === lid);
              if (!label) return null;
              const c = LABEL_COLORS[label.color] ?? LABEL_COLORS.orange!;
              return (
                <span
                  key={lid}
                  className="nb-badge"
                  style={{
                    borderColor: c.border,
                    color: c.text,
                    background: c.bg,
                  }}
                >
                  {label.name}
                </span>
              );
            })}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.isMedia ? (
              <span className="italic opacity-50">&lt;Media omitted&gt;</span>
            ) : (
              message.text
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            onClick={onToggleSave}
            title={saved ? "Unsave" : "Save"}
            className="p-1 opacity-50 hover:opacity-100"
          >
            {saved ? (
              <BookmarkCheck size={16} style={{ color: "var(--accent)" }} />
            ) : (
              <Bookmark size={16} />
            )}
          </button>
          <button
            onClick={onOpenLabelPicker}
            title="Labels"
            className="p-1 opacity-50 hover:opacity-100"
          >
            <Tag size={16} />
          </button>
          <button
            onClick={onAddTodo}
            title="Add as to-do"
            className="p-1 opacity-50 hover:opacity-100"
          >
            <CheckSquare size={16} />
          </button>
        </div>
      </div>

      {labelPickerOpen && (
        <div
          className="absolute right-4 top-12 z-20 flex flex-wrap gap-1 p-2"
          style={{
            background: "var(--panel)",
            border: "3px solid #0C0C0C",
            boxShadow: "5px 5px 0 #0C0C0C",
          }}
        >
          {labels.map((label) => {
            const c = LABEL_COLORS[label.color] ?? LABEL_COLORS.orange!;
            const active = assignedLabels.includes(label.id);
            return (
              <button
                key={label.id}
                onClick={() => onToggleLabel(label.id)}
                className="nb-badge"
                style={{
                  borderColor: c.border,
                  color: active ? "#fff" : c.text,
                  background: active ? c.border : c.bg,
                }}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

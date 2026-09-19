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
  pullDeskState,
  pushDeskState,
  SETUP_SQL,
  extractSheetId,
  sheetEditUrl,
  sheetCsvUrl,
} from "./lib/supabase";
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
  Layers,
  MessageSquare,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface Label {
  id: string;
  name: string;
  color: string;
}

interface WorkType {
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
  types: WorkType[];
  messageLabels: Record<string, string[]>;
  messageTypes: Record<string, string[]>;
  savedIds: string[];
  todos: Todo[];
  googleSheetUrl: string;
  googleWebhookUrl: string;
  pageSize: 100 | 250;
}

const LS_KEY = "marque-nb-state-v1";
const AUTH_KEY = "marque-nb-auth";
const APP_PASSWORD = "brandex2026";

const DEFAULT_LABELS: Label[] = [
  { id: "important", name: "Important", color: "orange" },
  { id: "client", name: "Client", color: "teal" },
  { id: "followup", name: "Follow-up", color: "yellow" },
];

const DEFAULT_TYPES: WorkType[] = [
  { id: "trademark", name: "Trademark", color: "orange" },
  { id: "copyright", name: "Copyright", color: "teal" },
  { id: "opposition", name: "Opposition", color: "yellow" },
  { id: "ledger", name: "Ledger Update", color: "purple" },
  { id: "ntn", name: "NTN", color: "dark" },
];

const CHIP_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  orange: { bg: "rgba(201,74,0,0.12)", border: "#C94A00", text: "#C94A00" },
  teal: { bg: "rgba(13,153,112,0.12)", border: "#0D9970", text: "#0A6B52" },
  yellow: { bg: "rgba(212,168,0,0.15)", border: "#D4A800", text: "#8a6800" },
  purple: { bg: "rgba(139,47,201,0.12)", border: "#8B2FC9", text: "#8B2FC9" },
  dark: { bg: "rgba(12,12,12,0.08)", border: "#0C0C0C", text: "#555555" },
};

const COLOR_CYCLE = ["orange", "teal", "yellow", "purple", "dark"];

function emptyState(): PersistedState {
  return {
    labels: DEFAULT_LABELS,
    types: DEFAULT_TYPES,
    messageLabels: {},
    messageTypes: {},
    savedIds: [],
    todos: [],
    googleSheetUrl: "",
    googleWebhookUrl: "",
    pageSize: 100,
  };
}

function normalizeState(raw: unknown): PersistedState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<PersistedState>;
  return {
    labels: s.labels?.length ? s.labels : base.labels,
    types: s.types?.length ? s.types : base.types,
    messageLabels: s.messageLabels ?? {},
    messageTypes: s.messageTypes ?? {},
    savedIds: s.savedIds ?? [],
    todos: s.todos ?? [],
    googleSheetUrl: s.googleSheetUrl ?? "",
    googleWebhookUrl: s.googleWebhookUrl ?? "",
    pageSize: s.pageSize === 250 ? 250 : 100,
  };
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return emptyState();
}

function savePersisted(state: PersistedState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

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
    <div
      className="theme-neobrutalism flex min-h-screen items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="nb-panel w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div
            className="nb-stamp nb-stamp-orange mb-3"
            style={{ transform: "rotate(-4deg)" }}
          >
            LOCKED
          </div>
          <h1
            className="text-4xl tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
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

export default function App() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === "1",
  );

  if (!authed) {
    return <LoginGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <Desk
      onLogout={() => {
        sessionStorage.removeItem(AUTH_KEY);
        setAuthed(false);
      }}
    />
  );
}

function Desk({ onLogout }: { onLogout: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSender, setActiveSender] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [labelPickerFor, setLabelPickerFor] = useState<string | null>(null);
  const [typePickerFor, setTypePickerFor] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newTodoText, setNewTodoText] = useState("");
  const [activeTab, setActiveTab] = useState<"messages" | "todos" | "backup">(
    "messages",
  );
  const [page, setPage] = useState(0);
  const [syncNote, setSyncNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [persisted, setPersisted] = useState<PersistedState>(loadPersisted);

  useEffect(() => {
    savePersisted(persisted);
  }, [persisted]);

  useEffect(() => {
    setPage(0);
  }, [
    search,
    activeSender,
    activeLabel,
    activeType,
    showSavedOnly,
    persisted.pageSize,
    messages.length,
  ]);

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
    if (activeType) {
      list = list.filter((m) =>
        (persisted.messageTypes[m.id] ?? []).includes(activeType),
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
  }, [
    messages,
    search,
    activeSender,
    activeLabel,
    activeType,
    showSavedOnly,
    persisted,
  ]);

  const pageSize = persisted.pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageSlice = filtered.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );
  const groups = useMemo(() => groupByDate(pageSlice), [pageSlice]);

  function toggleOnMessage(
    mapKey: "messageLabels" | "messageTypes",
    messageId: string,
    itemId: string,
  ) {
    setPersisted((p) => {
      const current = p[mapKey][messageId] ?? [];
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      return { ...p, [mapKey]: { ...p[mapKey], [messageId]: next } };
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
      todos: p.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  }

  function removeTodo(id: string) {
    setPersisted((p) => ({
      ...p,
      todos: p.todos.filter((t) => t.id !== id),
    }));
  }

  function addNamed(
    kind: "labels" | "types",
    name: string,
    reset: () => void,
  ) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPersisted((p) => {
      const list = p[kind];
      const color = COLOR_CYCLE[list.length % COLOR_CYCLE.length] ?? "orange";
      const prefix = kind === "types" ? "ty" : "l";
      return {
        ...p,
        [kind]: [...list, { id: `${prefix}${Date.now()}`, name: trimmed, color }],
      };
    });
    reset();
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMessages(parseWhatsAppExport(String(reader.result ?? "")));
    };
    reader.readAsText(file);
  }

  function buildCsv(): string {
    const rows = [
      ["id", "date", "time", "sender", "text", "labels", "types", "saved"],
      ...messages.map((m) => [
        m.id,
        m.date,
        m.time,
        m.sender ?? "",
        `"${m.text.replace(/"/g, '""')}"`,
        (persisted.messageLabels[m.id] ?? [])
          .map((lid) => persisted.labels.find((l) => l.id === lid)?.name ?? lid)
          .join("; "),
        (persisted.messageTypes[m.id] ?? [])
          .map((tid) => persisted.types.find((t) => t.id === tid)?.name ?? tid)
          .join("; "),
        persisted.savedIds.includes(m.id) ? "yes" : "no",
      ]),
    ];
    return rows.map((r) => r.join(",")).join("\n");
  }

  function downloadNamed(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function syncGoogleSheet() {
    const csv = buildCsv();
    downloadNamed(
      `marque-sheet-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8;",
    );
    try {
      await navigator.clipboard.writeText(csv);
    } catch {
      /* clipboard optional */
    }
    const openUrl = sheetEditUrl(persisted.googleSheetUrl);
    if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
    if (persisted.googleWebhookUrl.trim()) {
      try {
        await fetch(persisted.googleWebhookUrl.trim(), {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/csv" },
          body: csv,
        });
        setSyncNote("CSV downloaded, sheet opened, webhook pinged.");
      } catch {
        setSyncNote("CSV downloaded and sheet opened. Webhook could not be reached.");
      }
    } else if (openUrl) {
      setSyncNote(
        "CSV copied and downloaded. Paste via File → Import in the open Google Sheet.",
      );
    } else {
      setSyncNote("CSV downloaded. Paste a Google Sheet link first for one-click open.");
    }
  }

  async function pullPublishedSheet() {
    const csvUrl = sheetCsvUrl(persisted.googleSheetUrl);
    if (!csvUrl) {
      setSyncNote("Save a valid Google Sheet link first.");
      return;
    }
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Sheet is not public");
      const text = await res.text();
      downloadNamed("marque-from-sheet.csv", text, "text/csv;charset=utf-8;");
      setSyncNote(
        "Pulled published CSV. Share the sheet as Anyone with the link (Viewer) for this to work.",
      );
    } catch {
      setSyncNote(
        "Could not pull. In Google Sheets: File → Share → Anyone with the link.",
      );
    }
  }

  async function supabasePush() {
    try {
      await pushDeskState({
        persisted,
        messageCount: messages.length,
        savedAt: new Date().toISOString(),
      });
      setSyncNote("Saved to Supabase.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Supabase error";
      setSyncNote(
        `Supabase needs a table. Open SQL editor and run the setup SQL. (${msg})`,
      );
    }
  }

  async function supabasePull() {
    try {
      const payload = await pullDeskState<{ persisted?: PersistedState }>();
      if (!payload?.persisted) {
        setSyncNote("No Supabase backup found yet. Push once first.");
        return;
      }
      setPersisted(normalizeState(payload.persisted));
      setSyncNote("Loaded desk state from Supabase.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Supabase error";
      setSyncNote(`Could not load from Supabase. (${msg})`);
    }
  }

  const openTodos = persisted.todos.filter((t) => !t.done);
  const rangeStart = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min(filtered.length, (safePage + 1) * pageSize);

  return (
    <div
      className="theme-neobrutalism min-h-screen"
      style={{ background: "var(--bg)" }}
    >
      <header className="nb-navbar">
        <div className="nb-logo">
          MARQUE<span className="dot">.</span>
          <span className="stories"> STORIES</span>
        </div>
        <div className="flex-1" />
        <button
          className="nb-btn nb-btn-secondary"
          onClick={() => setActiveTab("messages")}
          title="Messages"
        >
          <MessageSquare size={14} /> Msgs {messages.length.toLocaleString()}
        </button>
        <button
          className="nb-btn nb-btn-yellow"
          onClick={() => setActiveTab("todos")}
          title="Open to-dos"
        >
          <ListTodo size={14} /> Open Todos {openTodos.length}
        </button>
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
        <button
          className="nb-btn nb-btn-secondary"
          onClick={onLogout}
          title="Logout"
        >
          <LogOut size={14} />
        </button>
      </header>

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

      <div className="mx-auto flex max-w-[1400px] gap-5 px-4 py-5 lg:px-6">
        <aside className="hidden w-56 shrink-0 flex-col gap-4 lg:flex">
          <div className="nb-panel p-3">
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Quick
            </div>
            <div className="flex flex-col gap-1">
              <FilterChip
                active={!activeSender && !showSavedOnly && !activeLabel && !activeType}
                onClick={() => {
                  setActiveSender(null);
                  setShowSavedOnly(false);
                  setActiveLabel(null);
                  setActiveType(null);
                }}
              >
                All
              </FilterChip>
              <FilterChip
                active={showSavedOnly}
                onClick={() => {
                  setShowSavedOnly(!showSavedOnly);
                  setActiveSender(null);
                }}
              >
                <Bookmark size={12} /> Saved
              </FilterChip>
            </div>
          </div>

          <div className="nb-panel p-3">
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Types
            </div>
            <div className="flex flex-col gap-1">
              {persisted.types.map((type) => {
                const c = CHIP_COLORS[type.color] ?? CHIP_COLORS.orange!;
                return (
                  <FilterChip
                    key={type.id}
                    active={activeType === type.id}
                    onClick={() =>
                      setActiveType(activeType === type.id ? null : type.id)
                    }
                  >
                    <span
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: c.border }}
                    />
                    {type.name}
                  </FilterChip>
                );
              })}
            </div>
            <div className="mt-3 flex gap-1">
              <input
                className="nb-input text-xs"
                placeholder="New type…"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addNamed("types", newTypeName, () => setNewTypeName(""))
                }
              />
              <button
                className="nb-btn nb-btn-secondary px-2"
                onClick={() =>
                  addNamed("types", newTypeName, () => setNewTypeName(""))
                }
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div className="nb-panel p-3">
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Labels
            </div>
            <div className="flex flex-col gap-1">
              {persisted.labels.map((label) => {
                const c = CHIP_COLORS[label.color] ?? CHIP_COLORS.orange!;
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
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addNamed("labels", newLabelName, () => setNewLabelName(""))
                }
              />
              <button
                className="nb-btn nb-btn-secondary px-2"
                onClick={() =>
                  addNamed("labels", newLabelName, () => setNewLabelName(""))
                }
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div className="nb-panel p-3">
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Senders
            </div>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {senders.slice(0, 12).map((s) => (
                <FilterChip
                  key={s}
                  active={activeSender === s}
                  onClick={() => setActiveSender(activeSender === s ? null : s)}
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

        <main className="min-w-0 flex-1">
          {activeTab === "messages" && (
            <div className="flex flex-col gap-4 xl:flex-row">
              <div className="nb-panel min-w-0 flex-1 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b-2 border-black/10 px-4 py-3">
                  <Search size={16} className="opacity-40" />
                  <input
                    className="min-w-[140px] flex-1 border-none bg-transparent text-sm outline-none"
                    style={{ fontFamily: "var(--font-body)" }}
                    placeholder="Search messages, senders…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] uppercase tracking-wider opacity-50"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Per page
                    </span>
                    {([100, 250] as const).map((n) => (
                      <button
                        key={n}
                        className="px-2 py-1 text-xs"
                        style={{
                          fontFamily: "var(--font-mono)",
                          border: "2px solid #0C0C0C",
                          background:
                            pageSize === n ? "var(--accent)" : "var(--panel)",
                          color: pageSize === n ? "#fff" : "var(--black)",
                        }}
                        onClick={() =>
                          setPersisted((p) => ({ ...p, pageSize: n }))
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-sm opacity-50">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center">
                    <div
                      className="nb-stamp nb-stamp-yellow mb-3"
                      style={{ transform: "rotate(3deg)" }}
                    >
                      EMPTY
                    </div>
                    <p className="text-sm opacity-60">
                      {messages.length === 0
                        ? "Upload a WhatsApp .txt export to begin."
                        : "No messages match the current filters."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
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
                              types={persisted.types}
                              assignedLabels={persisted.messageLabels[m.id] ?? []}
                              assignedTypes={persisted.messageTypes[m.id] ?? []}
                              saved={persisted.savedIds.includes(m.id)}
                              labelPickerOpen={labelPickerFor === m.id}
                              typePickerOpen={typePickerFor === m.id}
                              onToggleSave={() => toggleSave(m.id)}
                              onToggleLabel={(id) =>
                                toggleOnMessage("messageLabels", m.id, id)
                              }
                              onToggleType={(id) =>
                                toggleOnMessage("messageTypes", m.id, id)
                              }
                              onOpenLabelPicker={() => {
                                setLabelPickerFor(
                                  labelPickerFor === m.id ? null : m.id,
                                );
                                setTypePickerFor(null);
                              }}
                              onOpenTypePicker={() => {
                                setTypePickerFor(
                                  typePickerFor === m.id ? null : m.id,
                                );
                                setLabelPickerFor(null);
                              }}
                              onAddTodo={() => addTodo(m.text.slice(0, 120), m.id)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-black/10 px-4 py-3">
                      <span
                        className="text-xs uppercase tracking-wider opacity-60"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {rangeStart}–{rangeEnd} of {filtered.length}
                      </span>
                      <div className="flex gap-2">
                        <button
                          className="nb-btn nb-btn-secondary"
                          disabled={safePage <= 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft size={14} /> Previous
                        </button>
                        <span
                          className="grid place-items-center px-2 text-xs"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {safePage + 1} / {totalPages}
                        </span>
                        <button
                          className="nb-btn nb-btn-secondary"
                          disabled={safePage >= totalPages - 1}
                          onClick={() =>
                            setPage((p) => Math.min(totalPages - 1, p + 1))
                          }
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <aside className="w-full shrink-0 xl:w-72">
                <div className="nb-panel p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3
                      className="text-xl"
                      style={{
                        fontFamily: "var(--font-display)",
                        letterSpacing: "1px",
                      }}
                    >
                      TO-DOS
                    </h3>
                    <span
                      className="nb-badge"
                      style={{
                        borderColor: "#C94A00",
                        color: "#C94A00",
                        background: "rgba(201,74,0,0.12)",
                      }}
                    >
                      {openTodos.length} open
                    </span>
                  </div>
                  <div className="mb-3 flex gap-1">
                    <input
                      className="nb-input text-xs"
                      placeholder="Quick add…"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && addTodo(newTodoText)
                      }
                    />
                    <button
                      className="nb-btn px-2"
                      onClick={() => addTodo(newTodoText)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto">
                    {openTodos.length === 0 && (
                      <p className="text-xs opacity-50">No open to-dos.</p>
                    )}
                    {openTodos.slice(0, 12).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start gap-2 border-2 border-black/10 p-2"
                      >
                        <button onClick={() => toggleTodo(t.id)}>
                          <Square size={14} />
                        </button>
                        <span className="flex-1 text-xs leading-snug">{t.text}</span>
                      </div>
                    ))}
                    {openTodos.length > 12 && (
                      <button
                        className="text-xs underline"
                        onClick={() => setActiveTab("todos")}
                      >
                        View all {openTodos.length}
                      </button>
                    )}
                  </div>
                </div>
              </aside>
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
              {syncNote && (
                <p className="mb-4 text-sm" style={{ color: "var(--accent4)" }}>
                  {syncNote}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div
                  className="p-5"
                  style={{
                    border: "3px solid #0C0C0C",
                    boxShadow: "5px 5px 0 #0C0C0C",
                  }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <FileSpreadsheet size={20} style={{ color: "var(--accent2)" }} />
                    <span className="font-medium">Google Sheets</span>
                  </div>
                  <p className="mb-3 text-xs opacity-60">
                    Paste your sheet link. One click downloads CSV, copies it, and
                    opens the sheet for File → Import.
                  </p>
                  <input
                    className="nb-input mb-3 text-xs"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={persisted.googleSheetUrl}
                    onChange={(e) =>
                      setPersisted((p) => ({
                        ...p,
                        googleSheetUrl: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="nb-input mb-3 text-xs"
                    placeholder="Optional Apps Script webhook URL"
                    value={persisted.googleWebhookUrl}
                    onChange={(e) =>
                      setPersisted((p) => ({
                        ...p,
                        googleWebhookUrl: e.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-col gap-2">
                    <button className="nb-btn nb-btn-teal w-full" onClick={syncGoogleSheet}>
                      <RefreshCw size={14} /> Sync to Sheet
                    </button>
                    <button
                      className="nb-btn nb-btn-secondary w-full"
                      onClick={() => {
                        const url = sheetEditUrl(persisted.googleSheetUrl);
                        if (url) window.open(url, "_blank", "noopener,noreferrer");
                        else setSyncNote("Paste a Google Sheet link first.");
                      }}
                    >
                      <ExternalLink size={14} /> Open Sheet
                    </button>
                    <button
                      className="nb-btn nb-btn-secondary w-full"
                      onClick={pullPublishedSheet}
                    >
                      <Download size={14} /> Pull published CSV
                    </button>
                  </div>
                  {extractSheetId(persisted.googleSheetUrl) && (
                    <p
                      className="mt-2 truncate text-[10px] opacity-50"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      ID {extractSheetId(persisted.googleSheetUrl)}
                    </p>
                  )}
                </div>

                <div
                  className="p-5"
                  style={{
                    border: "3px solid #0C0C0C",
                    boxShadow: "5px 5px 0 #0C0C0C",
                  }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Cloud size={20} style={{ color: "var(--accent)" }} />
                    <span className="font-medium">Supabase</span>
                  </div>
                  <p className="mb-4 text-xs opacity-60">
                    Cloud backup of labels, types, saved items, and to-dos. Run the
                    SQL once in the Supabase SQL editor if the table is missing.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button className="nb-btn w-full" onClick={supabasePush}>
                      <Cloud size={14} /> Push to Supabase
                    </button>
                    <button className="nb-btn nb-btn-secondary w-full" onClick={supabasePull}>
                      <Download size={14} /> Pull from Supabase
                    </button>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs uppercase tracking-wider opacity-50">
                      Setup SQL (once)
                    </summary>
                    <textarea
                      className="nb-input mt-2 h-32 text-[10px]"
                      readOnly
                      value={SETUP_SQL}
                    />
                  </details>
                </div>
              </div>

              <div className="mt-6">
                <button
                  className="nb-btn nb-btn-secondary"
                  onClick={() =>
                    downloadNamed(
                      `marque-full-${new Date().toISOString().slice(0, 10)}.json`,
                      JSON.stringify(
                        { exportedAt: new Date().toISOString(), messages, ...persisted },
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
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

function PickerRow({
  items,
  assigned,
  onToggle,
}: {
  items: { id: string; name: string; color: string }[];
  assigned: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className="absolute right-4 top-12 z-20 flex flex-wrap gap-1 p-2"
      style={{
        background: "var(--panel)",
        border: "3px solid #0C0C0C",
        boxShadow: "5px 5px 0 #0C0C0C",
      }}
    >
      {items.map((item) => {
        const c = CHIP_COLORS[item.color] ?? CHIP_COLORS.orange!;
        const active = assigned.includes(item.id);
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className="nb-badge"
            style={{
              borderColor: c.border,
              color: active ? "#fff" : c.text,
              background: active ? c.border : c.bg,
            }}
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

function MessageRow({
  message,
  labels,
  types,
  assignedLabels,
  assignedTypes,
  saved,
  labelPickerOpen,
  typePickerOpen,
  onToggleSave,
  onToggleLabel,
  onToggleType,
  onOpenLabelPicker,
  onOpenTypePicker,
  onAddTodo,
}: {
  message: ChatMessage;
  labels: Label[];
  types: WorkType[];
  assignedLabels: string[];
  assignedTypes: string[];
  saved: boolean;
  labelPickerOpen: boolean;
  typePickerOpen: boolean;
  onToggleSave: () => void;
  onToggleLabel: (id: string) => void;
  onToggleType: (id: string) => void;
  onOpenLabelPicker: () => void;
  onOpenTypePicker: () => void;
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
            {assignedTypes.map((tid) => {
              const type = types.find((t) => t.id === tid);
              if (!type) return null;
              const c = CHIP_COLORS[type.color] ?? CHIP_COLORS.orange!;
              return (
                <span
                  key={tid}
                  className="nb-badge"
                  style={{
                    borderColor: c.border,
                    color: c.text,
                    background: c.bg,
                  }}
                >
                  {type.name}
                </span>
              );
            })}
            {assignedLabels.map((lid) => {
              const label = labels.find((l) => l.id === lid);
              if (!label) return null;
              const c = CHIP_COLORS[label.color] ?? CHIP_COLORS.orange!;
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
              <span className="italic opacity-50"><Media omitted></span>
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
            onClick={onOpenTypePicker}
            title="Types"
            className="p-1 opacity-50 hover:opacity-100"
          >
            <Layers size={16} />
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
        <PickerRow items={labels} assigned={assignedLabels} onToggle={onToggleLabel} />
      )}
      {typePickerOpen && (
        <PickerRow items={types} assigned={assignedTypes} onToggle={onToggleType} />
      )}
    </div>
  );
}

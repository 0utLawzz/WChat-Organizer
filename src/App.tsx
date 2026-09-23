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
  getSupabase,
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
  Clock,
  Calendar,
  Flag,
  Brain,
  Activity,
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
  /** YYYY-MM-DD */
  dueDate?: string;
  /** HH:mm */
  dueTime?: string;
  period?: "none" | "today" | "this_week" | "this_month" | "later";
  priority?: "low" | "medium" | "high";
  notes?: string;
  /** Label ids assigned to this todo */
  labelIds?: string[];
  /** Type ids assigned to this todo */
  typeIds?: string[];
}

interface JournalEntry {
  id: string;
  text: string;
  kind: "progress" | "memory" | "note";
  createdAt: number;
}

interface PersistedState {
  labels: Label[];
  types: WorkType[];
  messageLabels: Record<string, string[]>;
  messageTypes: Record<string, string[]>;
  savedIds: string[];
  todos: Todo[];
  journal: JournalEntry[];
  googleSheetUrl: string;
  googleWebhookUrl: string;
  pageSize: 100 | 250;
  /** Display name overrides for senders */
  senderAliases?: Record<string, string>;
  /** Senders hidden from sidebar / filtered out */
  hiddenSenders?: string[];
  /** Optional workspace title */
  workspaceName?: string;
}

const LS_KEY = "marque-nb-state-v2";
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
    journal: [],
    googleSheetUrl:
      "https://docs.google.com/spreadsheets/d/1PyvUTN9zR3kgcYIjhZu1inXoX0ZsIvD2SSo1yxrZ26o/edit?gid=307425405",
    googleWebhookUrl: "",
    pageSize: 100,
    senderAliases: {},
    hiddenSenders: [],
    workspaceName: "BRANDEX",
  };
}

function normalizeTodo(t: Partial<Todo> & { id: string; text: string }): Todo {
  return {
    id: t.id,
    text: t.text,
    done: !!t.done,
    messageId: t.messageId,
    createdAt: t.createdAt ?? Date.now(),
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    period: t.period ?? "none",
    priority: t.priority ?? "medium",
    notes: t.notes,
    labelIds: Array.isArray(t.labelIds) ? t.labelIds : [],
    typeIds: Array.isArray(t.typeIds) ? t.typeIds : [],
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
    todos: Array.isArray(s.todos) ? s.todos.map((t) => normalizeTodo(t)) : [],
    journal: Array.isArray(s.journal) ? s.journal : [],
    googleSheetUrl: s.googleSheetUrl ?? base.googleSheetUrl,
    googleWebhookUrl: s.googleWebhookUrl ?? "",
    pageSize: s.pageSize === 250 ? 250 : 100,
    senderAliases: s.senderAliases ?? {},
    hiddenSenders: s.hiddenSenders ?? [],
    workspaceName: s.workspaceName ?? "BRANDEX",
  };
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
    // migrate from previous key if present
    const legacy = localStorage.getItem("marque-nb-state-v1");
    if (legacy) return normalizeState(JSON.parse(legacy));
  } catch {
    /* ignore */
  }
  return emptyState();
}

function savePersisted(state: PersistedState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/** Due timestamp from todo dueDate + dueTime, or null */
function todoDueMs(t: Todo): number | null {
  if (!t.dueDate) return null;
  const time = t.dueTime && t.dueTime.length >= 4 ? t.dueTime : "23:59";
  const ms = Date.parse(`${t.dueDate}T${time}:00`);
  return Number.isNaN(ms) ? null : ms;
}

function formatCountdown(dueMs: number, now: number): {
  label: string;
  urgency: "overdue" | "soon" | "ok";
} {
  const diff = dueMs - now;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  let label: string;
  if (days >= 1) label = `${days}d ${hours % 24}h`;
  else if (hours >= 1) label = `${hours}h ${mins % 60}m`;
  else label = `${Math.max(1, mins)}m`;
  if (diff < 0) return { label: `Overdue ${label}`, urgency: "overdue" };
  if (diff < 2 * 60 * 60 * 1000)
    return { label: `In ${label}`, urgency: "soon" };
  return { label: `In ${label}`, urgency: "ok" };
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
            BRANDEX<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1 text-sm opacity-60">Workspace — enter password to unlock</p>
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
  const [newTodoDueDate, setNewTodoDueDate] = useState("");
  const [newTodoDueTime, setNewTodoDueTime] = useState("");
  const [newTodoPeriod, setNewTodoPeriod] = useState<
    Todo["period"]
  >("none");
  const [newTodoPriority, setNewTodoPriority] = useState<
    Todo["priority"]
  >("medium");
  const [newTodoNotes, setNewTodoNotes] = useState("");
  const [newTodoLabelIds, setNewTodoLabelIds] = useState<string[]>([]);
  const [newTodoTypeIds, setNewTodoTypeIds] = useState<string[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [newJournalText, setNewJournalText] = useState("");
  const [newJournalKind, setNewJournalKind] = useState<
    JournalEntry["kind"]
  >("progress");
  const [activeTab, setActiveTab] = useState<
    "messages" | "todos" | "progress" | "backup" | "daily" | "db"
  >("messages");
  const [page, setPage] = useState(0);
  const [syncNote, setSyncNote] = useState("");
  const [dbStatus, setDbStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string;
    body: string;
    onConfirm: () => void;
  }>(null);
  const [dbEntries, setDbEntries] = useState<{ id: string; updated_at?: string; payload?: unknown }[]>([]);
  const [printMode, setPrintMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [persisted, setPersisted] = useState<PersistedState>(loadPersisted);

  useEffect(() => {
    savePersisted(persisted);
  }, [persisted]);

  // Auto-connect Supabase on mount: pull desk state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDbStatus("connecting");
      try {
        const payload = await pullDeskState<{ persisted?: PersistedState }>();
        if (cancelled) return;
        if (payload?.persisted) {
          setPersisted(normalizeState(payload.persisted));
          setSyncNote("Loaded desk state from Supabase on startup.");
          setDbStatus("connected");
        } else {
          setDbStatus("connected");
          setSyncNote("Supabase connected. No prior backup found — push to save.");
        }
      } catch {
        if (!cancelled) {
          setDbStatus("error");
          setSyncNote("Supabase not reachable yet. Run the setup SQL or check keys.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    // No dummy data — start empty until user uploads a WhatsApp .txt export
    setLoading(false);
  }, []);

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const senders = useMemo(() => {
    const hidden = new Set(persisted.hiddenSenders ?? []);
    const counts = new Map<string, number>();
    for (const m of messages) {
      if (m.sender && !hidden.has(m.sender))
        counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [messages, persisted.hiddenSenders]);

  const filtered = useMemo(() => {
    const hidden = new Set(persisted.hiddenSenders ?? []);
    let list = messages.filter((m) => !m.sender || !hidden.has(m.sender));
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

  function resetTodoForm() {
    setNewTodoText("");
    setNewTodoDueDate("");
    setNewTodoDueTime("");
    setNewTodoPeriod("none");
    setNewTodoPriority("medium");
    setNewTodoNotes("");
    setNewTodoLabelIds([]);
    setNewTodoTypeIds([]);
    setEditingTodoId(null);
  }

  function addTodo(text: string, messageId?: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (editingTodoId) {
      setPersisted((p) => ({
        ...p,
        todos: p.todos.map((t) =>
          t.id === editingTodoId
            ? {
                ...t,
                text: trimmed,
                dueDate: newTodoDueDate || undefined,
                dueTime: newTodoDueTime || undefined,
                period: newTodoPeriod ?? "none",
                priority: newTodoPriority ?? "medium",
                notes: newTodoNotes.trim() || undefined,
                labelIds: [...newTodoLabelIds],
                typeIds: [...newTodoTypeIds],
              }
            : t,
        ),
      }));
    } else {
      setPersisted((p) => ({
        ...p,
        todos: [
          {
            id: `t${Date.now()}`,
            text: trimmed,
            done: false,
            messageId,
            createdAt: Date.now(),
            dueDate: newTodoDueDate || undefined,
            dueTime: newTodoDueTime || undefined,
            period: newTodoPeriod ?? "none",
            priority: newTodoPriority ?? "medium",
            notes: newTodoNotes.trim() || undefined,
            labelIds: [...newTodoLabelIds],
            typeIds: [...newTodoTypeIds],
          },
          ...p.todos,
        ],
      }));
    }
    resetTodoForm();
  }

  function startEditTodo(t: Todo) {
    setEditingTodoId(t.id);
    setNewTodoText(t.text);
    setNewTodoDueDate(t.dueDate ?? "");
    setNewTodoDueTime(t.dueTime ?? "");
    setNewTodoPeriod(t.period ?? "none");
    setNewTodoPriority(t.priority ?? "medium");
    setNewTodoNotes(t.notes ?? "");
    setNewTodoLabelIds(t.labelIds ?? []);
    setNewTodoTypeIds(t.typeIds ?? []);
    setActiveTab("todos");
  }

  function displaySender(name: string): string {
    return persisted.senderAliases?.[name] ?? name;
  }

  function renameSender(original: string) {
    const current = displaySender(original);
    const next = window.prompt("Rename chat / contact:", current);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    setPersisted((p) => ({
      ...p,
      senderAliases: { ...(p.senderAliases ?? {}), [original]: trimmed },
    }));
  }

  function removeSender(original: string) {
    if (
      !window.confirm(
        `Remove all messages from "${displaySender(original)}" and hide this chat?`,
      )
    )
      return;
    setMessages((prev) => prev.filter((m) => m.sender !== original));
    setPersisted((p) => ({
      ...p,
      hiddenSenders: [...new Set([...(p.hiddenSenders ?? []), original])],
    }));
    if (activeSender === original) setActiveSender(null);
  }

  function requestConfirm(title: string, body: string, onConfirm: () => void) {
    setConfirmAction({ title, body, onConfirm });
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

  function addJournalEntry() {
    const trimmed = newJournalText.trim();
    if (!trimmed) return;
    setPersisted((p) => ({
      ...p,
      journal: [
        {
          id: `j${Date.now()}`,
          text: trimmed,
          kind: newJournalKind,
          createdAt: Date.now(),
        },
        ...p.journal,
      ],
    }));
    setNewJournalText("");
  }

  function removeJournalEntry(id: string) {
    setPersisted((p) => ({
      ...p,
      journal: p.journal.filter((j) => j.id !== id),
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected later
    e.target.value = "";

    const name = file.name.toLowerCase();
    try {
      let rawText = "";
      if (name.endsWith(".zip")) {
        // Dynamic import of JSZip from CDN (avoids local npm install)
        const JSZipMod = await import(
          /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm"
        );
        const JSZip = (JSZipMod as { default?: typeof import("jszip") }).default ?? JSZipMod;
        const zip = await (JSZip as any).loadAsync(file);
        const allNames: string[] = Object.keys(zip.files).filter(
          (n: string) => !zip.files[n].dir,
        );
        const preferred = ["_chat.txt", "chat.txt", "whatsapp chat.txt"];
        let targetName =
          allNames.find((n) =>
            preferred.some((p) => n.toLowerCase().endsWith(p)),
          ) ?? allNames.find((n) => n.toLowerCase().endsWith(".txt"));
        if (!targetName) {
          setSyncNote(
            "ZIP contains no .txt chat export. Export as .txt or include _chat.txt inside the archive.",
          );
          return;
        }
        const entry = zip.file(targetName);
        if (!entry) {
          setSyncNote("Could not read text file inside ZIP.");
          return;
        }
        rawText = await entry.async("string");
        setSyncNote(`Loaded chat from ZIP: ${targetName}`);
      } else {
        // Plain .txt (or any text-like file)
        rawText = await file.text();
        setSyncNote(`Loaded ${file.name}`);
      }
      const parsed = parseWhatsAppExport(rawText);
      setMessages(parsed);
      if (parsed.length === 0) {
        setSyncNote("File parsed but no WhatsApp messages found. Check export format.");
      } else {
        setActiveTab("messages");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setSyncNote(`Upload error: ${msg}`);
    }
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

  async function doSyncGoogleSheet() {
    const csv = buildCsv();
    try {
      await navigator.clipboard.writeText(csv);
    } catch {
      /* clipboard optional */
    }
    const openUrl = sheetEditUrl(persisted.googleSheetUrl);
    const webhook = persisted.googleWebhookUrl.trim();

    if (webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/csv" },
          body: csv,
        });
        if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
        setSyncNote(
          "Pushed CSV to your Apps Script webhook. Open the sheet to confirm rows updated.",
        );
        return;
      } catch {
        setSyncNote("Webhook failed. Falling back to CSV download + open sheet.");
      }
    }

    downloadNamed(
      `brandex-workspace-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8;",
    );
    if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
    setSyncNote("CSV downloaded & copied to clipboard. Sheet opened for manual import.");
  }

  async function doSupabasePush() {
    setDbStatus("connecting");
    setSyncNote("Pushing desk state to Supabase...");
    try {
      await pushDeskState({ persisted });
      setDbStatus("connected");
      setSyncNote("Desk state saved to Supabase.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Push failed";
      setDbStatus("error");
      setSyncNote(`Supabase push error: ${msg}`);
    }
  }

  async function loadDbEntries() {
    setSyncNote("Loading database entries...");
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("desk_state")
        .select("id, updated_at, payload")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setDbEntries(data ?? []);
      setSyncNote(`Loaded ${data?.length ?? 0} database entries.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Load failed";
      setSyncNote(`Database load error: ${msg}`);
    }
  }

  const openTodos = persisted.todos.filter((t) => !t.done);
  const completedTodos = persisted.todos.filter((t) => t.done);

  const rangeStart = safePage * pageSize + 1;
  const rangeEnd = Math.min((safePage + 1) * pageSize, filtered.length);

  // Daily Work: group messages by date, include todos due/open on that day
  const dailyGroups = useMemo(() => {
    const byDate = new Map<string, { messages: ChatMessage[]; todos: Todo[] }>();
    for (const m of messages) {
      const date = m.date;
      if (!byDate.has(date)) {
        byDate.set(date, { messages: [], todos: [] });
      }
      byDate.get(date)!.messages.push(m);
    }
    // Add todos to their due date (if any)
    for (const t of persisted.todos) {
      if (t.dueDate) {
        if (!byDate.has(t.dueDate)) {
          byDate.set(t.dueDate, { messages: [], todos: [] });
        }
        byDate.get(t.dueDate)!.todos.push(t);
      }
    }
    return Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [messages, persisted.todos]);

  return (
    <div className="theme-neobrutalism min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="nb-header sticky top-0 z-50">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl tracking-wide"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {persisted.workspaceName ?? "BRANDEX"}
              <span style={{ color: "var(--accent)" }}>.</span>
            </h1>
            <button
              className="nb-btn nb-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} /> UPLOAD
            </button>
            <button
              className="nb-btn nb-btn-secondary"
              onClick={onLogout}
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="nb-tabs sticky top-[60px] z-40">
        <div className="mx-auto max-w-[1400px] px-4 lg:px-6">
          <div className="flex gap-1">
            <button
              className={`nb-tab ${activeTab === "messages" ? "active" : ""}`}
              onClick={() => setActiveTab("messages")}
            >
              Messages
            </button>
            <button
              className={`nb-tab ${activeTab === "daily" ? "active" : ""}`}
              onClick={() => setActiveTab("daily")}
            >
              Daily Work
            </button>
            <button
              className={`nb-tab ${activeTab === "todos" ? "active" : ""}`}
              onClick={() => setActiveTab("todos")}
            >
              To-Dos ({openTodos.length})
            </button>
            <button
              className={`nb-tab ${activeTab === "progress" ? "active" : ""}`}
              onClick={() => setActiveTab("progress")}
            >
              Progress & Memory
            </button>
            <button
              className={`nb-tab ${activeTab === "backup" ? "active" : ""}`}
              onClick={() => setActiveTab("backup")}
            >
              Backup & Sync
              {dbStatus === "connected" && (
                <span className="ml-1 inline-block size-2 rounded-full bg-teal-600" title="DB connected" />
              )}
              {dbStatus === "error" && (
                <span className="ml-1 inline-block size-2 rounded-full bg-orange-600" title="DB error" />
              )}
              {dbStatus === "connecting" && (
                <span className="ml-1 inline-block size-2 rounded-full bg-yellow-500 animate-pulse" title="Connecting…" />
              )}
            </button>
            <button
              className={`nb-tab ${activeTab === "db" ? "active" : ""}`}
              onClick={() => setActiveTab("db")}
            >
              Database
            </button>
          </div>
        </div>
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
              <button
                className={`nb-filter-chip ${!activeSender && !showSavedOnly && !activeLabel && !activeType ? "active" : ""}`}
                onClick={() => {
                  setActiveSender(null);
                  setShowSavedOnly(false);
                  setActiveLabel(null);
                  setActiveType(null);
                }}
              >
                All
              </button>
              <button
                className={`nb-filter-chip ${showSavedOnly ? "active" : ""}`}
                onClick={() => {
                  setShowSavedOnly(!showSavedOnly);
                  setActiveSender(null);
                }}
              >
                <Bookmark size={12} /> Saved
              </button>
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
                  <button
                    key={type.id}
                    className={`nb-filter-chip ${activeType === type.id ? "active" : ""}`}
                    onClick={() =>
                      setActiveType(activeType === type.id ? null : type.id)
                    }
                  >
                    <span
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: c.border }}
                    />
                    {type.name}
                  </button>
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
                  <button
                    key={label.id}
                    className={`nb-filter-chip ${activeLabel === label.id ? "active" : ""}`}
                    onClick={() =>
                      setActiveLabel(activeLabel === label.id ? null : label.id)
                    }
                  >
                    <span
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: c.border }}
                    />
                    {label.name}
                  </button>
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
              Chats
            </div>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {senders.slice(0, 20).map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <button
                    className={`nb-filter-chip ${activeSender === s ? "active" : ""}`}
                    onClick={() =>
                      setActiveSender(activeSender === s ? null : s)
                    }
                  >
                    <span
                      className="grid size-5 place-items-center rounded-sm text-[9px] font-bold text-white"
                      style={{ background: avatarColor(s) }}
                    >
                      {initials(displaySender(s))}
                    </span>
                    <span className="truncate max-w-[90px]">
                      {displaySender(s)}
                    </span>
                  </button>
                  <button
                    title="Rename"
                    className="opacity-40 hover:opacity-100 text-[10px] px-1"
                    onClick={() => renameSender(s)}
                  >
                    ✎
                  </button>
                  <button
                    title="Remove chat"
                    className="opacity-40 hover:opacity-100"
                    onClick={() => removeSender(s)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Compact Progress & Memory widget */}
          <div className="nb-panel p-3">
            <div
              className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span>Progress</span>
              <button
                className="opacity-60 hover:opacity-100 normal-case tracking-normal"
                onClick={() => setActiveTab("progress")}
              >
                Open →
              </button>
            </div>
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {persisted.journal.slice(0, 4).map((j) => (
                <div key={j.id} className="text-[11px] leading-snug">
                  <span
                    className="nb-badge text-[9px] uppercase mr-1"
                    style={{
                      borderColor:
                        j.kind === "progress"
                          ? "#0D9970"
                          : j.kind === "memory"
                            ? "#8B2FC9"
                            : "#C94A00",
                      color:
                        j.kind === "progress"
                          ? "#0D9970"
                          : j.kind === "memory"
                            ? "#8B2FC9"
                            : "#C94A00",
                    }}
                  >
                    {j.kind}
                  </span>
                  <span className="opacity-80 line-clamp-2">{j.text}</span>
                </div>
              ))}
              {persisted.journal.length === 0 && (
                <p className="text-[11px] opacity-40">No entries yet</p>
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {activeTab === "messages" && (
            <div className="nb-panel min-w-0 overflow-hidden">
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
                      ? "No dummy data. Click UPLOAD and choose a WhatsApp .txt or .zip export."
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
                            onToggleLabel={(id) => {
                              toggleOnMessage("messageLabels", m.id, id);
                              setLabelPickerFor(null);
                            }}
                            onToggleType={(id) => {
                              toggleOnMessage("messageTypes", m.id, id);
                              setTypePickerFor(null);
                            }}
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
          )}

          {activeTab === "daily" && (
            <div className="nb-panel">
              <div className="border-b-2 border-black/10 px-4 py-3">
                <h2 className="text-lg font-medium">Daily Work Preview</h2>
                <p className="text-sm opacity-60">
                  Day-by-day messages, open to-dos, and journal entries.
                </p>
              </div>
              <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
                {dailyGroups.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm opacity-60">
                      No data yet. Upload a WhatsApp export to see daily work.
                    </p>
                  </div>
                ) : (
                  dailyGroups.map(([date, { messages: dayMsgs, todos: dayTodos }]) => (
                    <div key={date} className="border-b border-black/5">
                      <div
                        className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 text-xs font-medium uppercase tracking-wider"
                        style={{
                          background: "var(--bg-alt)",
                          borderBottom: "2px solid rgba(12,12,12,0.1)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        <span>{formatGroupDate(dayMsgs[0]?.timestamp ?? Date.parse(date))}</span>
                        <button
                          className="nb-btn nb-btn-secondary text-xs"
                          onClick={() => {
                            setSelectedDay(date);
                            setPrintMode(true);
                          }}
                        >
                          <Download size={12} /> Print My Day
                        </button>
                      </div>
                      <div className="p-4 space-y-3">
                        {dayMsgs.length > 0 && (
                          <div>
                            <div className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50">
                              Messages ({dayMsgs.length})
                            </div>
                            <div className="space-y-2">
                              {dayMsgs.slice(0, 5).map((m) => (
                                <div key={m.id} className="text-sm">
                                  <span className="opacity-40 mr-2">{m.time}</span>
                                  <span className="font-medium">{displaySender(m.sender ?? "")}:</span>
                                  <span className="ml-2 opacity-80">{m.text.slice(0, 100)}{m.text.length > 100 ? "…" : ""}</span>
                                </div>
                              ))}
                              {dayMsgs.length > 5 && (
                                <div className="text-xs opacity-40">
                                  +{dayMsgs.length - 5} more messages
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {dayTodos.length > 0 && (
                          <div>
                            <div className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50">
                              To-Dos ({dayTodos.filter(t => !t.done).length} open)
                            </div>
                            <div className="space-y-1">
                              {dayTodos.slice(0, 5).map((t) => (
                                <div key={t.id} className="flex items-start gap-2 text-sm">
                                  <button
                                    onClick={() => toggleTodo(t.id)}
                                    className="mt-0.5"
                                  >
                                    {t.done ? (
                                      <CheckSquare size={14} className="text-teal-600" />
                                    ) : (
                                      <Square size={14} className="opacity-40" />
                                    )}
                                  </button>
                                  <span className={t.done ? "opacity-40 line-through" : ""}>
                                    {t.text}
                                  </span>
                                </div>
                              ))}
                              {dayTodos.length > 5 && (
                                <div className="text-xs opacity-40">
                                  +{dayTodos.length - 5} more to-dos
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {dayMsgs.length === 0 && dayTodos.length === 0 && (
                          <p className="text-sm opacity-40">No activity on this day</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "todos" && (
            <div className="nb-panel">
              <div className="border-b-2 border-black/10 px-4 py-3">
                <h2 className="text-lg font-medium">To-Dos</h2>
                <p className="text-sm opacity-60">
                  {openTodos.length} open, {completedTodos.length} completed
                </p>
              </div>
              <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-4 space-y-4">
                {/* Todo Form */}
                <div className="nb-panel p-3 space-y-3">
                  <input
                    className="nb-input"
                    placeholder="New to-do…"
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTodo(newTodoText);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      className="nb-input text-xs"
                      value={newTodoDueDate}
                      onChange={(e) => setNewTodoDueDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className="nb-input text-xs"
                      value={newTodoDueTime}
                      onChange={(e) => setNewTodoDueTime(e.target.value)}
                    />
                    <select
                      className="nb-input text-xs"
                      value={newTodoPeriod}
                      onChange={(e) => setNewTodoPeriod(e.target.value as Todo["period"])}
                    >
                      <option value="none">No period</option>
                      <option value="today">Today</option>
                      <option value="this_week">This week</option>
                      <option value="this_month">This month</option>
                      <option value="later">Later</option>
                    </select>
                    <select
                      className="nb-input text-xs"
                      value={newTodoPriority}
                      onChange={(e) => setNewTodoPriority(e.target.value as Todo["priority"])}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <textarea
                    className="nb-input text-xs"
                    placeholder="Notes (optional)…"
                    value={newTodoNotes}
                    onChange={(e) => setNewTodoNotes(e.target.value)}
                    rows={2}
                  />
                  <div className="flex flex-wrap gap-2">
                    <div className="flex flex-wrap gap-1">
                      {persisted.labels.map((label) => {
                        const c = CHIP_COLORS[label.color] ?? CHIP_COLORS.orange!;
                        return (
                          <button
                            key={label.id}
                            className={`nb-badge text-xs ${newTodoLabelIds.includes(label.id) ? "active" : ""}`}
                            style={{
                              borderColor: c.border,
                              color: newTodoLabelIds.includes(label.id) ? c.border : "#666",
                              background: newTodoLabelIds.includes(label.id) ? c.bg : "transparent",
                            }}
                            onClick={() => {
                              setNewTodoLabelIds(prev =>
                                prev.includes(label.id)
                                  ? prev.filter(id => id !== label.id)
                                  : [...prev, label.id]
                              );
                            }}
                          >
                            {label.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {persisted.types.map((type) => {
                        const c = CHIP_COLORS[type.color] ?? CHIP_COLORS.orange!;
                        return (
                          <button
                            key={type.id}
                            className={`nb-badge text-xs ${newTodoTypeIds.includes(type.id) ? "active" : ""}`}
                            style={{
                              borderColor: c.border,
                              color: newTodoTypeIds.includes(type.id) ? c.border : "#666",
                              background: newTodoTypeIds.includes(type.id) ? c.bg : "transparent",
                            }}
                            onClick={() => {
                              setNewTodoTypeIds(prev =>
                                prev.includes(type.id)
                                  ? prev.filter(id => id !== type.id)
                                  : [...prev, type.id]
                              );
                            }}
                          >
                            {type.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="nb-btn"
                      onClick={() => addTodo(newTodoText)}
                    >
                      {editingTodoId ? "Update" : "Add"} To-Do
                    </button>
                    {editingTodoId && (
                      <button
                        className="nb-btn nb-btn-secondary"
                        onClick={resetTodoForm}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Open Todos */}
                {openTodos.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50">
                      Open ({openTodos.length})
                    </div>
                    <div className="space-y-2">
                      {openTodos.map((t) => {
                        const dueMs = todoDueMs(t);
                        const countdown = dueMs ? formatCountdown(dueMs, nowTick) : null;
                        return (
                          <div key={t.id} className="nb-panel p-3">
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => toggleTodo(t.id)}
                                className="mt-0.5"
                              >
                                <Square size={14} className="opacity-40" />
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{t.text}</div>
                                {t.notes && (
                                  <div className="text-xs opacity-60 mt-1">{t.notes}</div>
                                )}
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {t.dueDate && (
                                    <span className="text-xs opacity-60">
                                      📅 {t.dueDate}
                                      {t.dueTime && ` ${t.dueTime}`}
                                    </span>
                                  )}
                                  {countdown && (
                                    <span
                                      className="text-xs font-medium"
                                      style={{
                                        color:
                                          countdown.urgency === "overdue"
                                            ? "#C94A00"
                                            : countdown.urgency === "soon"
                                              ? "#D4A800"
                                              : "#0D9970",
                                      }}
                                    >
                                      {countdown.label}
                                    </span>
                                  )}
                                  {t.period !== "none" && (
                                    <span className="nb-badge text-xs">{t.period}</span>
                                  )}
                                  {t.priority !== "medium" && (
                                    <span className="nb-badge text-xs">{t.priority}</span>
                                  )}
                                  {t.labelIds && t.labelIds.length > 0 && (
                                    <div className="flex gap-1">
                                      {t.labelIds.map((lid) => {
                                        const label = persisted.labels.find((l) => l.id === lid);
                                        if (!label) return null;
                                        const c = CHIP_COLORS[label.color] ?? CHIP_COLORS.orange!;
                                        return (
                                          <span
                                            key={lid}
                                            className="nb-badge text-xs"
                                            style={{ borderColor: c.border, color: c.text }}
                                          >
                                            {label.name}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {t.typeIds && t.typeIds.length > 0 && (
                                    <div className="flex gap-1">
                                      {t.typeIds.map((tid) => {
                                        const type = persisted.types.find((t) => t.id === tid);
                                        if (!type) return null;
                                        const c = CHIP_COLORS[type.color] ?? CHIP_COLORS.orange!;
                                        return (
                                          <span
                                            key={tid}
                                            className="nb-badge text-xs"
                                            style={{ borderColor: c.border, color: c.text }}
                                          >
                                            {type.name}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  className="opacity-40 hover:opacity-100"
                                  onClick={() => startEditTodo(t)}
                                  title="Edit"
                                >
                                  ✎
                                </button>
                                <button
                                  className="opacity-40 hover:opacity-100"
                                  onClick={() => removeTodo(t.id)}
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Completed Todos */}
                {completedTodos.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50">
                      Completed ({completedTodos.length})
                    </div>
                    <div className="space-y-2">
                      {completedTodos.map((t) => (
                        <div key={t.id} className="nb-panel p-3 opacity-60">
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => toggleTodo(t.id)}
                              className="mt-0.5"
                            >
                              <CheckSquare size={14} className="text-teal-600" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="line-through">{t.text}</div>
                              {t.notes && (
                                <div className="text-xs opacity-60 mt-1">{t.notes}</div>
                              )}
                            </div>
                            <button
                              className="opacity-40 hover:opacity-100"
                              onClick={() => removeTodo(t.id)}
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {persisted.todos.length === 0 && (
                  <div className="p-12 text-center">
                    <p className="text-sm opacity-60">
                      No to-dos yet. Add one above or create from messages.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "progress" && (
            <div className="nb-panel">
              <div className="border-b-2 border-black/10 px-4 py-3">
                <h2 className="text-lg font-medium">Progress & Memory</h2>
                <p className="text-sm opacity-60">
                  Track progress and store agent memory/journal entries.
                </p>
              </div>
              <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-4 space-y-4">
                {/* Journal Entry Form */}
                <div className="nb-panel p-3 space-y-3">
                  <textarea
                    className="nb-input"
                    placeholder="What progress did you make? What should you remember?"
                    value={newJournalText}
                    onChange={(e) => setNewJournalText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <select
                      className="nb-input text-xs"
                      value={newJournalKind}
                      onChange={(e) => setNewJournalKind(e.target.value as JournalEntry["kind"])}
                    >
                      <option value="progress">Progress</option>
                      <option value="memory">Memory</option>
                      <option value="note">Note</option>
                    </select>
                    <button
                      className="nb-btn"
                      onClick={addJournalEntry}
                    >
                      Add Entry
                    </button>
                  </div>
                </div>

                {/* Journal Entries */}
                {persisted.journal.length > 0 ? (
                  <div className="space-y-2">
                    {persisted.journal.map((j) => (
                      <div key={j.id} className="nb-panel p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span
                              className="nb-badge text-[10px] uppercase mr-2"
                              style={{
                                borderColor:
                                  j.kind === "progress"
                                    ? "#0D9970"
                                    : j.kind === "memory"
                                      ? "#8B2FC9"
                                      : "#C94A00",
                                color:
                                  j.kind === "progress"
                                    ? "#0D9970"
                                    : j.kind === "memory"
                                      ? "#8B2FC9"
                                      : "#C94A00",
                              }}
                            >
                              {j.kind}
                            </span>
                            <span className="text-sm">{j.text}</span>
                          </div>
                          <button
                            className="opacity-40 hover:opacity-100"
                            onClick={() => removeJournalEntry(j.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="text-xs opacity-40 mt-1">
                          {new Date(j.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <p className="text-sm opacity-60">
                      No journal entries yet. Add one above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "backup" && (
            <div className="nb-panel">
              <div className="border-b-2 border-black/10 px-4 py-3">
                <h2 className="text-lg font-medium">Backup & Sync</h2>
                <p className="text-sm opacity-60">
                  Export data, sync with Google Sheets, and backup to Supabase.
                </p>
              </div>
              <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-4 space-y-4">
                {/* Google Sheets */}
                <div className="nb-panel p-3 space-y-3">
                  <h3 className="font-medium">Google Sheets</h3>
                  <div>
                    <label className="text-xs uppercase tracking-wider opacity-50 mb-1 block">
                      Sheet URL
                    </label>
                    <input
                      className="nb-input"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={persisted.googleSheetUrl}
                      onChange={(e) =>
                        setPersisted((p) => ({
                          ...p,
                          googleSheetUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider opacity-50 mb-1 block">
                      Apps Script Webhook (optional)
                    </label>
                    <input
                      className="nb-input"
                      placeholder="https://script.google.com/..."
                      value={persisted.googleWebhookUrl}
                      onChange={(e) =>
                        setPersisted((p) => ({
                          ...p,
                          googleWebhookUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <button
                    className="nb-btn"
                    onClick={() =>
                      requestConfirm(
                        "Sync with Google Sheets?",
                        "This will download a CSV of all messages and open your Google Sheet. If you have a webhook configured, it will POST the CSV there.",
                        doSyncGoogleSheet,
                      )
                    }
                  >
                    <FileSpreadsheet size={14} /> Sync with Sheet
                  </button>
                </div>

                {/* Supabase */}
                <div className="nb-panel p-3 space-y-3">
                  <h3 className="font-medium">Supabase Backup</h3>
                  <p className="text-sm opacity-60">
                    Status:{" "}
                    {dbStatus === "connected" ? (
                      <span className="text-teal-600">Connected</span>
                    ) : dbStatus === "connecting" ? (
                      <span className="text-yellow-600">Connecting…</span>
                    ) : dbStatus === "error" ? (
                      <span className="text-orange-600">Error</span>
                    ) : (
                      <span className="opacity-40">Idle</span>
                    )}
                  </p>
                  <button
                    className="nb-btn"
                    onClick={() =>
                      requestConfirm(
                        "Push desk state to Supabase?",
                        "This will save your current labels, types, to-dos, journal, and settings to Supabase.",
                        doSupabasePush,
                      )
                    }
                  >
                    <Cloud size={14} /> Push to Supabase
                  </button>
                  <button
                    className="nb-btn nb-btn-secondary"
                    onClick={() => {
                      setSyncNote("Setup SQL copied to clipboard.");
                      navigator.clipboard.writeText(SETUP_SQL);
                    }}
                  >
                    <Download size={14} /> Copy Setup SQL
                  </button>
                </div>

                {/* Local Export */}
                <div className="nb-panel p-3 space-y-3">
                  <h3 className="font-medium">Local Export</h3>
                  <button
                    className="nb-btn nb-btn-secondary"
                    onClick={() => {
                      const data = {
                        labels: persisted.labels,
                        types: persisted.types,
                        messageLabels: persisted.messageLabels,
                        messageTypes: persisted.messageTypes,
                        savedIds: persisted.savedIds,
                        todos: persisted.todos,
                        journal: persisted.journal,
                        googleSheetUrl: persisted.googleSheetUrl,
                        googleWebhookUrl: persisted.googleWebhookUrl,
                        pageSize: persisted.pageSize,
                        senderAliases: persisted.senderAliases,
                        hiddenSenders: persisted.hiddenSenders,
                        workspaceName: persisted.workspaceName,
                      };
                      downloadNamed(
                        `brandex-backup-${new Date().toISOString().slice(0, 10)}.json`,
                        JSON.stringify(data, null, 2),
                        "application/json",
                      );
                      setSyncNote("Local backup downloaded.");
                    }}
                  >
                    <Download size={14} /> Download JSON Backup
                  </button>
                  <div>
                    <label className="nb-btn nb-btn-secondary inline-flex items-center gap-2 cursor-pointer">
                      <Upload size={14} /> Restore from JSON
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const text = await file.text();
                            const data = JSON.parse(text);
                            setPersisted(normalizeState(data));
                            setSyncNote("Backup restored successfully.");
                          } catch (err) {
                            setSyncNote("Failed to restore backup. Invalid JSON.");
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Sync Note */}
                {syncNote && (
                  <div className="nb-panel p-3">
                    <p className="text-sm">{syncNote}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "db" && (
            <div className="nb-panel">
              <div className="border-b-2 border-black/10 px-4 py-3">
                <h2 className="text-lg font-medium">Database Store</h2>
                <p className="text-sm opacity-60">
                  View and manage Supabase desk_state backups.
                </p>
              </div>
              <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-4 space-y-4">
                <button
                  className="nb-btn"
                  onClick={loadDbEntries}
                >
                  <RefreshCw size={14} /> Load Entries
                </button>
                {dbEntries.length > 0 ? (
                  <div className="space-y-2">
                    {dbEntries.map((entry) => (
                      <div key={entry.id} className="nb-panel p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="text-xs font-mono opacity-60">{entry.id}</div>
                            <div className="text-xs opacity-40">
                              {entry.updated_at
                                ? new Date(entry.updated_at).toLocaleString()
                                : "No timestamp"}
                            </div>
                          </div>
                        </div>
                        <div className="nb-panel p-2 max-h-40 overflow-y-auto">
                          <pre className="text-xs">
                            {JSON.stringify(entry.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <p className="text-sm opacity-60">
                      Click "Load Entries" to fetch database backups.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.zip"
        className="hidden"
        onChange={handleUpload}
      />

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="nb-panel w-full max-w-md p-6">
            <h3 className="text-lg font-medium mb-2">{confirmAction.title}</h3>
            <p className="text-sm opacity-80 mb-4">{confirmAction.body}</p>
            <div className="flex gap-2 justify-end">
              <button
                className="nb-btn nb-btn-secondary"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                className="nb-btn"
                onClick={() => {
                  confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Mode */}
      {printMode && selectedDay && (
        <div className="fixed inset-0 z-50 bg-white p-8 overflow-auto">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold">
                  {persisted.workspaceName ?? "BRANDEX"} — My Day
                </h1>
                <p className="text-lg opacity-60">{formatGroupDate(Date.parse(selectedDay))}</p>
              </div>
              <button
                className="nb-btn nb-btn-secondary"
                onClick={() => {
                  setPrintMode(false);
                  setSelectedDay(null);
                }}
              >
                Close
              </button>
            </div>
            {(() => {
              const dayData = dailyGroups.find(([d]) => d === selectedDay);
              if (!dayData) return null;
              const [_, { messages: dayMsgs, todos: dayTodos }] = dayData;
              return (
                <div className="space-y-6">
                  {dayMsgs.length > 0 && (
                    <div>
                      <h2 className="text-lg font-medium mb-3">Messages ({dayMsgs.length})</h2>
                      <div className="space-y-2">
                        {dayMsgs.map((m) => (
                          <div key={m.id} className="border-b border-gray-200 pb-2">
                            <div className="flex items-center gap-2 text-sm opacity-60">
                              <span>{m.time}</span>
                              <span className="font-medium">{displaySender(m.sender ?? "")}</span>
                            </div>
                            <div className="text-sm mt-1">{m.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {dayTodos.length > 0 && (
                    <div>
                      <h2 className="text-lg font-medium mb-3">
                        To-Dos ({dayTodos.filter(t => !t.done).length} open)
                      </h2>
                      <div className="space-y-2">
                        {dayTodos.map((t) => (
                          <div key={t.id} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={t.done}
                              onChange={() => toggleTodo(t.id)}
                              className="mt-1"
                            />
                            <div className={t.done ? "opacity-40 line-through" : ""}>
                              <div className="font-medium">{t.text}</div>
                              {t.notes && <div className="text-sm opacity-60 mt-1">{t.notes}</div>}
                              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                {t.dueDate && <span>📅 {t.dueDate}</span>}
                                {t.priority !== "medium" && <span>{t.priority}</span>}
                                {t.labelIds && t.labelIds.map((lid) => {
                                  const label = persisted.labels.find((l) => l.id === lid);
                                  return label ? <span key={lid}>{label.name}</span> : null;
                                })}
                                {t.typeIds && t.typeIds.map((tid) => {
                                  const type = persisted.types.find((t) => t.id === tid);
                                  return type ? <span key={tid}>{type.name}</span> : null;
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    className="nb-btn"
                    onClick={() => window.print()}
                  >
                    <Download size={14} /> Print
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
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
    <div className="nb-panel p-3 mb-2">
      <div className="flex items-start gap-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-sm text-sm font-bold text-white"
          style={{ background: avatarColor(message.sender ?? "") }}
        >
          {initials(message.sender ?? "")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{message.sender}</span>
            <span className="text-xs opacity-40">{message.time}</span>
          </div>
          <div className="text-sm leading-relaxed">{message.text}</div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {assignedLabels.map((lid) => {
              const label = labels.find((l) => l.id === lid);
              if (!label) return null;
              const c = CHIP_COLORS[label.color] ?? CHIP_COLORS.orange!;
              return (
                <span
                  key={lid}
                  className="nb-badge text-xs"
                  style={{ borderColor: c.border, color: c.text }}
                >
                  {label.name}
                </span>
              );
            })}
            {assignedTypes.map((tid) => {
              const type = types.find((t) => t.id === tid);
              if (!type) return null;
              const c = CHIP_COLORS[type.color] ?? CHIP_COLORS.orange!;
              return (
                <span
                  key={tid}
                  className="nb-badge text-xs"
                  style={{ borderColor: c.border, color: c.text }}
                >
                  {type.name}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={onToggleSave}
            className="opacity-40 hover:opacity-100"
            title={saved ? "Unsave" : "Save"}
          >
            {saved ? (
              <BookmarkCheck size={14} className="text-teal-600" />
            ) : (
              <Bookmark size={14} />
            )}
          </button>
          <button
            onClick={onOpenLabelPicker}
            className="opacity-40 hover:opacity-100"
            title="Add label"
          >
            <Tag size={14} />
          </button>
          <button
            onClick={onOpenTypePicker}
            className="opacity-40 hover:opacity-100"
            title="Add type"
          >
            <Layers size={14} />
          </button>
          <button
            onClick={onAddTodo}
            className="opacity-40 hover:opacity-100"
            title="Create to-do"
          >
            <ListTodo size={14} />
          </button>
        </div>
      </div>
      {labelPickerOpen && (
        <div className="mt-3 pt-3 border-t border-black/10">
          <div className="text-xs uppercase tracking-wider opacity-50 mb-2">
            Add label
          </div>
          <div className="flex flex-wrap gap-1">
            {labels.map((label) => {
              const c = CHIP_COLORS[label.color] ?? CHIP_COLORS.orange!;
              return (
                <button
                  key={label.id}
                  className={`nb-badge text-xs ${assignedLabels.includes(label.id) ? "active" : ""}`}
                  style={{
                    borderColor: c.border,
                    color: assignedLabels.includes(label.id) ? c.border : "#666",
                    background: assignedLabels.includes(label.id) ? c.bg : "transparent",
                  }}
                  onClick={() => onToggleLabel(label.id)}
                >
                  {label.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {typePickerOpen && (
        <div className="mt-3 pt-3 border-t border-black/10">
          <div className="text-xs uppercase tracking-wider opacity-50 mb-2">
            Add type
          </div>
          <div className="flex flex-wrap gap-1">
            {types.map((type) => {
              const c = CHIP_COLORS[type.color] ?? CHIP_COLORS.orange!;
              return (
                <button
                  key={type.id}
                  className={`nb-badge text-xs ${assignedTypes.includes(type.id) ? "active" : ""}`}
                  style={{
                    borderColor: c.border,
                    color: assignedTypes.includes(type.id) ? c.border : "#666",
                    background: assignedTypes.includes(type.id) ? c.bg : "transparent",
                  }}
                  onClick={() => onToggleType(type.id)}
                >
                  {type.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
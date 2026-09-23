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
    if (openUrl) {
      setSyncNote(
        "CSV copied + downloaded. In the open sheet: File → Import → Upload → Replace/Append. For one-click push, add an Apps Script webhook URL below.",
      );
    } else {
      setSyncNote(
        "CSV downloaded. Paste a Google Sheet link and optional Apps Script webhook for direct push.",
      );
    }
  }

  function syncGoogleSheet() {
    requestConfirm(
      "Sync to Google Sheet?",
      "This will download/copy CSV and optionally POST to your Apps Script webhook. Continue?",
      () => {
        void doSyncGoogleSheet();
      },
    );
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

  async function doSupabasePush() {
    try {
      await pushDeskState({
        persisted,
        messageCount: messages.length,
        savedAt: new Date().toISOString(),
      });
      setSyncNote("Saved to Supabase.");
      setDbStatus("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Supabase error";
      setSyncNote(
        `Supabase needs a table. Open SQL editor and run the setup SQL. (${msg})`,
      );
      setDbStatus("error");
    }
  }

  function supabasePush() {
    requestConfirm(
      "Push to Supabase?",
      "This will overwrite the cloud desk state with your current labels, types, todos, and journal. Continue?",
      () => {
        void doSupabasePush();
      },
    );
  }

  async function doSupabasePull() {
    try {
      const payload = await pullDeskState<{ persisted?: PersistedState }>();
      if (!payload?.persisted) {
        setSyncNote("No Supabase backup found yet. Push once first.");
        return;
      }
      setPersisted(normalizeState(payload.persisted));
      setSyncNote("Loaded desk state from Supabase.");
      setDbStatus("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Supabase error";
      setSyncNote(`Could not load from Supabase. (${msg})`);
      setDbStatus("error");
    }
  }

  function supabasePull() {
    requestConfirm(
      "Pull from Supabase?",
      "This will replace your local labels, types, todos, and journal with the cloud backup. Local-only data may be lost. Continue?",
      () => {
        void doSupabasePull();
      },
    );
  }

  async function loadDbEntries() {
    try {
      const { data, error } = await getSupabase()
        .from("marque_desk")
        .select("id, updated_at, payload")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setDbEntries(data ?? []);
      setSyncNote(`Loaded ${data?.length ?? 0} database row(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DB error";
      setSyncNote(`Could not list database entries. (${msg})`);
    }
  }

  async function deleteDbEntry(id: string) {
    requestConfirm(
      "Delete database row?",
      `Permanently delete row "${id}" from Supabase? This cannot be undone.`,
      async () => {
        try {
          const { error } = await getSupabase().from("marque_desk").delete().eq("id", id);
          if (error) throw error;
          setDbEntries((rows) => rows.filter((r) => r.id !== id));
          setSyncNote(`Deleted row ${id}.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Delete failed";
          setSyncNote(msg);
        }
      },
    );
  }

  function printMyDay() {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 300);
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
          BRANDEX<span className="dot">.</span>
          <span className="stories"> WORKSPACE</span>
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
          accept=".txt,.zip,text/plain,application/zip"
          className="hidden"
          onChange={handleUpload}
        />
        <button className="nb-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> UPLOAD
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
              Chats
            </div>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {senders.slice(0, 20).map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <FilterChip
                    active={activeSender === s}
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
                  </FilterChip>
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
            <div className="nb-panel p-5">
              <h2
                className="mb-2 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                DAILY WORK PREVIEW
              </h2>
              <p className="mb-4 text-sm opacity-60">
                Overview of messages, open to-dos, and journal entries by day.
                Select a date to focus, or view all days with activity.
              </p>

              {(() => {
                const byDate = groupByDate(messages);
                const dayKeys = Array.from(byDate.keys()).sort((a, b) => {
                  // Sort chronologically using first message timestamp of each day
                  const ta = byDate.get(a)?.[0]?.timestamp ?? 0;
                  const tb = byDate.get(b)?.[0]?.timestamp ?? 0;
                  return tb - ta; // newest first
                });
                const focusKey =
                  selectedDay && byDate.has(selectedDay)
                    ? selectedDay
                    : dayKeys[0] ?? null;

                const dayMessages = focusKey ? byDate.get(focusKey) ?? [] : [];
                // Show open todos + any with an explicit due date (date strings vary by locale)
                const dayTodos = persisted.todos.filter((t) => {
                  if (t.done) return false;
                  if (t.period === "today" || t.period === "this_week") return true;
                  if (t.dueDate) return true;
                  // Include recently created (last 48 h) when viewing the newest day
                  if (focusKey === dayKeys[0] && Date.now() - t.createdAt < 48 * 60 * 60 * 1000)
                    return true;
                  return false;
                });
                const dayJournal = focusKey
                  ? persisted.journal.filter((j) => {
                      const msgTs = dayMessages[0]?.timestamp;
                      if (!msgTs) return false;
                      const dayStart = new Date(msgTs);
                      dayStart.setHours(0, 0, 0, 0);
                      const dayEnd = new Date(dayStart);
                      dayEnd.setDate(dayEnd.getDate() + 1);
                      return j.createdAt >= dayStart.getTime() && j.createdAt < dayEnd.getTime();
                    })
                  : [];

                return (
                  <>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {dayKeys.length === 0 && (
                        <p className="text-sm opacity-50">
                          Upload a chat export to see daily breakdowns.
                        </p>
                      )}
                      {dayKeys.slice(0, 14).map((key) => {
                        const count = byDate.get(key)?.length ?? 0;
                        const isFocus = key === focusKey;
                        return (
                          <button
                            key={key}
                            className={`nb-btn ${isFocus ? "" : "nb-btn-secondary"} text-xs`}
                            onClick={() => setSelectedDay(key)}
                          >
                            <Calendar size={12} /> {key} ({count})
                          </button>
                        );
                      })}
                      {dayKeys.length > 14 && (
                        <span className="text-xs opacity-50 self-center">
                          +{dayKeys.length - 14} more days
                        </span>
                      )}
                    </div>

                    {focusKey && (
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div
                          className="p-4"
                          style={{
                            border: "3px solid #0C0C0C",
                            boxShadow: "4px 4px 0 #0C0C0C",
                          }}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <MessageSquare size={16} style={{ color: "var(--accent)" }} />
                            <span className="font-medium">Messages</span>
                            <span className="ml-auto text-xs opacity-50">
                              {dayMessages.length}
                            </span>
                          </div>
                          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                            {dayMessages.slice(0, 30).map((m) => (
                              <div key={m.id} className="border-b border-black/5 pb-1">
                                <span className="text-[11px] opacity-50" style={{ fontFamily: "var(--font-mono)" }}>
                                  {m.time}
                                </span>{" "}
                                <strong>{m.sender ?? "System"}</strong>
                                <div className="truncate opacity-80">{m.isMedia ? "📎 Media" : m.text}</div>
                              </div>
                            ))}
                            {dayMessages.length > 30 && (
                              <p className="text-xs opacity-50">…and {dayMessages.length - 30} more</p>
                            )}
                            {dayMessages.length === 0 && (
                              <p className="text-xs opacity-50">No messages this day.</p>
                            )}
                          </div>
                        </div>

                        <div
                          className="p-4"
                          style={{
                            border: "3px solid #0C0C0C",
                            boxShadow: "4px 4px 0 #0C0C0C",
                          }}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <ListTodo size={16} style={{ color: "var(--accent2)" }} />
                            <span className="font-medium">To-Dos</span>
                            <span className="ml-auto text-xs opacity-50">
                              {dayTodos.filter((t) => !t.done).length} open
                            </span>
                          </div>
                          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                            {dayTodos.length === 0 && (
                              <p className="text-xs opacity-50">No to-dos linked to this day.</p>
                            )}
                            {dayTodos.map((t) => (
                              <div
                                key={t.id}
                                className={`flex items-start gap-2 ${t.done ? "opacity-50 line-through" : ""}`}
                              >
                                <button onClick={() => toggleTodo(t.id)} className="mt-0.5">
                                  {t.done ? <CheckSquare size={14} /> : <Square size={14} />}
                                </button>
                                <div>
                                  <div>{t.text}</div>
                                  {(t.dueDate || t.priority) && (
                                    <div className="text-[11px] opacity-50">
                                      {t.dueDate && `Due ${t.dueDate}`}
                                      {t.priority && ` · ${t.priority}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div
                          className="p-4"
                          style={{
                            border: "3px solid #0C0C0C",
                            boxShadow: "4px 4px 0 #0C0C0C",
                          }}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <Activity size={16} style={{ color: "var(--accent3)" }} />
                            <span className="font-medium">Journal</span>
                            <span className="ml-auto text-xs opacity-50">
                              {dayJournal.length}
                            </span>
                          </div>
                          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                            {dayJournal.length === 0 && (
                              <p className="text-xs opacity-50">No journal entries this day.</p>
                            )}
                            {dayJournal.map((j) => (
                              <div key={j.id} className="border-b border-black/5 pb-1">
                                <span className="nb-badge text-[10px] uppercase mr-1">{j.kind}</span>
                                {j.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {!focusKey && messages.length === 0 && (
                      <div className="py-8 text-center text-sm opacity-50">
                        Upload a WhatsApp .txt or .zip export to populate the daily preview.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === "todos" && (
            <div className="nb-panel p-5">
              <h2
                className="mb-4 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                TO-DOS {editingTodoId ? "· Editing" : ""}
              </h2>
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    className="nb-input min-w-[200px] flex-1"
                    placeholder={editingTodoId ? "Edit to-do…" : "Add a to-do…"}
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTodo(newTodoText)}
                  />
                  <button className="nb-btn" onClick={() => addTodo(newTodoText)}>
                    <Plus size={14} /> {editingTodoId ? "Save" : "Add"}
                  </button>
                  {editingTodoId && (
                    <button className="nb-btn nb-btn-secondary" onClick={resetTodoForm}>
                      Cancel
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-1 text-xs opacity-70">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> Due date
                    </span>
                    <input
                      type="date"
                      className="nb-input text-xs"
                      value={newTodoDueDate}
                      onChange={(e) => setNewTodoDueDate(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs opacity-70">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Time
                    </span>
                    <input
                      type="time"
                      className="nb-input text-xs"
                      value={newTodoDueTime}
                      onChange={(e) => setNewTodoDueTime(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs opacity-70">
                    <span>Period</span>
                    <select
                      className="nb-input text-xs"
                      value={newTodoPeriod}
                      onChange={(e) =>
                        setNewTodoPeriod(e.target.value as Todo["period"])
                      }
                    >
                      <option value="none">No period</option>
                      <option value="today">Today</option>
                      <option value="this_week">This week</option>
                      <option value="this_month">This month</option>
                      <option value="later">Later</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs opacity-70">
                    <span className="flex items-center gap-1">
                      <Flag size={12} /> Priority
                    </span>
                    <select
                      className="nb-input text-xs"
                      value={newTodoPriority}
                      onChange={(e) =>
                        setNewTodoPriority(e.target.value as Todo["priority"])
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
                <input
                  className="nb-input text-xs"
                  placeholder="Notes (optional)…"
                  value={newTodoNotes}
                  onChange={(e) => setNewTodoNotes(e.target.value)}
                />
                {/* Labels (tags) — separate from Types */}
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wider opacity-50 flex items-center gap-1">
                    <Tag size={11} /> Labels
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {persisted.labels.map((l) => {
                      const on = newTodoLabelIds.includes(l.id);
                      const c = CHIP_COLORS[l.color] ?? CHIP_COLORS.orange!;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className="nb-badge text-[11px]"
                          style={{
                            borderColor: c.border,
                            color: on ? "#fff" : c.text,
                            background: on ? c.border : c.bg,
                          }}
                          onClick={() =>
                            setNewTodoLabelIds((ids) =>
                              on ? ids.filter((x) => x !== l.id) : [...ids, l.id],
                            )
                          }
                        >
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Types (work categories) — separate from Labels */}
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wider opacity-50 flex items-center gap-1">
                    <Layers size={11} /> Types
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {persisted.types.map((ty) => {
                      const on = newTodoTypeIds.includes(ty.id);
                      const c = CHIP_COLORS[ty.color] ?? CHIP_COLORS.orange!;
                      return (
                        <button
                          key={ty.id}
                          type="button"
                          className="nb-badge text-[11px]"
                          style={{
                            borderColor: c.border,
                            color: on ? "#fff" : c.text,
                            background: on ? c.border : c.bg,
                          }}
                          onClick={() =>
                            setNewTodoTypeIds((ids) =>
                              on ? ids.filter((x) => x !== ty.id) : [...ids, ty.id],
                            )
                          }
                        >
                          {ty.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {persisted.todos.length === 0 && (
                  <p className="text-sm opacity-50">No to-dos yet.</p>
                )}
                {persisted.todos.map((t) => {
                  const priorityColor =
                    t.priority === "high"
                      ? "#C94A00"
                      : t.priority === "low"
                        ? "#0D9970"
                        : "#D4A800";
                  return (
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
                          <CheckSquare
                            size={18}
                            style={{ color: "var(--accent2)" }}
                          />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-sm"
                          style={{
                            textDecoration: t.done ? "line-through" : "none",
                          }}
                        >
                          {t.text}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] opacity-60">
                          {t.priority && t.priority !== "medium" && (
                            <span
                              className="nb-badge"
                              style={{
                                borderColor: priorityColor,
                                color: priorityColor,
                                background: `${priorityColor}18`,
                              }}
                            >
                              {t.priority}
                            </span>
                          )}
                          {t.period && t.period !== "none" && (
                            <span className="nb-badge">
                              {t.period.replace("_", " ")}
                            </span>
                          )}
                          {(t.dueDate || t.dueTime) && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {[t.dueDate, t.dueTime].filter(Boolean).join(" · ")}
                            </span>
                          )}
                          {(t.labelIds ?? []).map((lid) => {
                            const l = persisted.labels.find((x) => x.id === lid);
                            if (!l) return null;
                            const c = CHIP_COLORS[l.color] ?? CHIP_COLORS.orange!;
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
                                {l.name}
                              </span>
                            );
                          })}
                          {(t.typeIds ?? []).map((tid) => {
                            const ty = persisted.types.find((x) => x.id === tid);
                            if (!ty) return null;
                            const c = CHIP_COLORS[ty.color] ?? CHIP_COLORS.orange!;
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
                                {ty.name}
                              </span>
                            );
                          })}
                          {t.notes && (
                            <span className="italic opacity-80">{t.notes}</span>
                          )}
                        </div>
                      </div>
                      <button
                        title="Edit"
                        onClick={() => startEditTodo(t)}
                        className="opacity-40 hover:opacity-100 mr-1"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => removeTodo(t.id)}
                        className="opacity-40 hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "progress" && (
            <div className="nb-panel p-5">
              <h2
                className="mb-2 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                PROGRESS & MEMORY
              </h2>
              <p className="mb-4 text-sm opacity-60">
                Log progress updates and agent memory notes. Synced with local
                desk state and Supabase backup.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                <select
                  className="nb-input w-auto text-xs"
                  value={newJournalKind}
                  onChange={(e) =>
                    setNewJournalKind(e.target.value as JournalEntry["kind"])
                  }
                >
                  <option value="progress">Progress</option>
                  <option value="memory">Memory</option>
                  <option value="note">Note</option>
                </select>
                <input
                  className="nb-input min-w-[200px] flex-1"
                  placeholder="What happened / what to remember…"
                  value={newJournalText}
                  onChange={(e) => setNewJournalText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addJournalEntry()}
                />
                <button className="nb-btn" onClick={addJournalEntry}>
                  <Plus size={14} /> Log
                </button>
              </div>
              <div className="space-y-2">
                {persisted.journal.length === 0 && (
                  <p className="text-sm opacity-50">
                    No progress or memory entries yet.
                  </p>
                )}
                {persisted.journal.map((j) => {
                  const kindIcon =
                    j.kind === "progress" ? (
                      <Activity size={14} />
                    ) : j.kind === "memory" ? (
                      <Brain size={14} />
                    ) : (
                      <MessageSquare size={14} />
                    );
                  const kindColor =
                    j.kind === "progress"
                      ? "#0D9970"
                      : j.kind === "memory"
                        ? "#8B2FC9"
                        : "#C94A00";
                  return (
                    <div
                      key={j.id}
                      className="flex items-start gap-3 border-2 border-black/10 p-3"
                    >
                      <span style={{ color: kindColor }} className="mt-0.5">
                        {kindIcon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                          <span
                            className="nb-badge text-[10px] uppercase"
                            style={{
                              borderColor: kindColor,
                              color: kindColor,
                              background: `${kindColor}15`,
                            }}
                          >
                            {j.kind}
                          </span>
                          <span
                            className="text-[11px] opacity-40"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {new Date(j.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm leading-snug">{j.text}</p>
                      </div>
                      <button
                        onClick={() => removeJournalEntry(j.id)}
                        className="opacity-40 hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
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
                  <p className="mb-2 text-xs opacity-60">
                    <strong>Sheet URL</strong> — your Google Spreadsheet. Default
                    BrandEx sheet is pre-filled.{" "}
                    <a
                      href="https://docs.google.com/spreadsheets/d/1PyvUTN9zR3kgcYIjhZu1inXoX0ZsIvD2SSo1yxrZ26o/edit?gid=307425405"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                      style={{ color: "var(--accent2)" }}
                    >
                      Open default sheet ↗
                    </a>
                  </p>
                  <p className="mb-3 text-xs opacity-60">
                    <strong>Webhook</strong> — optional Apps Script web-app URL.
                    Without it, Sync downloads CSV + opens the sheet for File →
                    Import. With a webhook, Sync POSTs CSV for one-click append.
                    Create via Extensions → Apps Script → deploy as web app
                    (anyone, execute as you).
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
                    placeholder="Apps Script webhook URL (optional, for direct push)"
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
                    <span className="font-medium">Supabase Database</span>
                    <span
                      className="ml-auto text-[10px] uppercase tracking-wider"
                      style={{
                        color:
                          dbStatus === "connected"
                            ? "#0D9970"
                            : dbStatus === "error"
                              ? "#C94A00"
                              : "#D4A800",
                      }}
                    >
                      {dbStatus === "connected"
                        ? "● Connected"
                        : dbStatus === "error"
                          ? "● Error"
                          : dbStatus === "connecting"
                            ? "● Connecting…"
                            : "○ Idle"}
                    </span>
                  </div>
                  <p className="mb-4 text-xs opacity-60">
                    Cloud backup of labels, types, saved items, to-dos and journal.
                    Desk state is pulled automatically on login. Run the SQL once
                    in the Supabase SQL editor if the table is missing.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      className="nb-btn w-full"
                      onClick={async () => {
                        setDbStatus("connecting");
                        await supabasePush();
                        setDbStatus("connected");
                      }}
                    >
                      <Cloud size={14} /> Push to Supabase
                    </button>
                    <button
                      className="nb-btn nb-btn-secondary w-full"
                      onClick={async () => {
                        setDbStatus("connecting");
                        await supabasePull();
                        setDbStatus("connected");
                      }}
                    >
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

              <div className="mt-6 flex flex-wrap gap-2">
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
                <button className="nb-btn" onClick={printMyDay}>
                  <Calendar size={14} /> Print My Day
                </button>
              </div>
            </div>
          )}

          {activeTab === "db" && (
            <div className="nb-panel p-5">
              <h2
                className="mb-2 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                DATABASE STORE
              </h2>
              <p className="mb-4 text-sm opacity-60">
                View and delete rows stored in Supabase table <code>marque_desk</code>.
                Default row id is <code>default</code>.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                <button className="nb-btn" onClick={() => void loadDbEntries()}>
                  <RefreshCw size={14} /> Refresh entries
                </button>
                <button className="nb-btn nb-btn-secondary" onClick={supabasePull}>
                  <Download size={14} /> Pull default into app
                </button>
              </div>
              {dbEntries.length === 0 && (
                <p className="text-sm opacity-50">
                  No rows loaded yet. Click Refresh (requires table + RLS).
                </p>
              )}
              <div className="space-y-3">
                {dbEntries.map((row) => {
                  const p = (row.payload ?? {}) as {
                    savedAt?: string;
                    messageCount?: number;
                    persisted?: {
                      todos?: { id: string; text: string; done?: boolean }[];
                      labels?: { name: string }[];
                      types?: { name: string }[];
                      journal?: { kind: string; text: string }[];
                      savedIds?: string[];
                      workspaceName?: string;
                    };
                  };
                  const desk = p.persisted ?? {};
                  const todos = desk.todos ?? [];
                  const openTodos = todos.filter((t) => !t.done);
                  const labels = desk.labels ?? [];
                  const types = desk.types ?? [];
                  const journal = desk.journal ?? [];
                  const savedCount = desk.savedIds?.length ?? 0;

                  return (
                    <div
                      key={row.id}
                      className="border-2 border-black p-4"
                      style={{ boxShadow: "4px 4px 0 #0C0C0C" }}
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-base">
                            {desk.workspaceName ?? "Workspace"} ·{" "}
                            <span
                              className="text-xs opacity-50"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              id: {row.id}
                            </span>
                          </div>
                          <div className="text-[11px] opacity-50 mt-0.5">
                            Updated{" "}
                            {row.updated_at
                              ? new Date(row.updated_at).toLocaleString()
                              : p.savedAt
                                ? new Date(p.savedAt).toLocaleString()
                                : "—"}
                          </div>
                        </div>
                        <button
                          className="nb-btn nb-btn-secondary text-xs"
                          onClick={() => void deleteDbEntry(row.id)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
                        <div className="border border-black/15 p-2 text-center">
                          <div className="text-lg font-bold">{todos.length}</div>
                          <div className="text-[10px] uppercase opacity-50">
                            To-dos ({openTodos.length} open)
                          </div>
                        </div>
                        <div className="border border-black/15 p-2 text-center">
                          <div className="text-lg font-bold">{labels.length}</div>
                          <div className="text-[10px] uppercase opacity-50">
                            Labels
                          </div>
                        </div>
                        <div className="border border-black/15 p-2 text-center">
                          <div className="text-lg font-bold">{types.length}</div>
                          <div className="text-[10px] uppercase opacity-50">
                            Types
                          </div>
                        </div>
                        <div className="border border-black/15 p-2 text-center">
                          <div className="text-lg font-bold">
                            {p.messageCount ?? "—"}
                          </div>
                          <div className="text-[10px] uppercase opacity-50">
                            Messages · {savedCount} saved
                          </div>
                        </div>
                      </div>

                      {labels.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] uppercase opacity-50 mb-1">
                            Labels
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {labels.map((l, i) => (
                              <span key={i} className="nb-badge text-[11px]">
                                {l.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {types.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] uppercase opacity-50 mb-1">
                            Types
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {types.map((t, i) => (
                              <span key={i} className="nb-badge text-[11px]">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {openTodos.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] uppercase opacity-50 mb-1">
                            Open to-dos
                          </div>
                          <ul className="text-sm space-y-1">
                            {openTodos.slice(0, 6).map((t) => (
                              <li key={t.id} className="truncate">
                                ☐ {t.text}
                              </li>
                            ))}
                            {openTodos.length > 6 && (
                              <li className="text-xs opacity-50">
                                +{openTodos.length - 6} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {journal.length > 0 && (
                        <div>
                          <div className="text-[10px] uppercase opacity-50 mb-1">
                            Journal ({journal.length})
                          </div>
                          <ul className="text-sm space-y-1">
                            {journal.slice(0, 4).map((j, i) => (
                              <li key={i} className="truncate">
                                <span className="text-[10px] uppercase opacity-50 mr-1">
                                  {j.kind}
                                </span>
                                {j.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {todos.length === 0 &&
                        labels.length === 0 &&
                        types.length === 0 &&
                        journal.length === 0 && (
                          <p className="text-xs opacity-50">
                            Empty desk state (no todos, labels, types, or journal).
                          </p>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Confirm modal */}
        {confirmAction && (
          <div
            className="fixed inset-0 z-50 grid place-items-center p-4"
            style={{ background: "rgba(12,12,12,0.45)" }}
            onClick={() => setConfirmAction(null)}
          >
            <div
              className="nb-panel max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                className="mb-2 text-xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {confirmAction.title}
              </h3>
              <p className="mb-5 text-sm opacity-70">{confirmAction.body}</p>
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
                    const fn = confirmAction.onConfirm;
                    setConfirmAction(null);
                    fn();
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Printable My Day sheet */}
        {printMode && (
          <div
            id="print-my-day"
            className="fixed inset-0 z-[60] overflow-auto p-8"
            style={{ background: "#fff", color: "#0C0C0C" }}
          >
            <div className="mx-auto max-w-2xl">
              <div className="mb-6 border-b-4 border-black pb-4">
                <h1
                  className="text-3xl font-bold tracking-wide"
                  style={{ fontFamily: "var(--font-display, Impact, sans-serif)" }}
                >
                  MY DAY · {persisted.workspaceName ?? "BRANDEX"}
                </h1>
                <p className="text-sm opacity-60">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <section className="mb-6">
                <h2 className="mb-2 text-lg font-bold uppercase tracking-wider">
                  Open To-Dos
                </h2>
                <ul className="space-y-2">
                  {persisted.todos
                    .filter((t) => !t.done)
                    .map((t) => (
                      <li key={t.id} className="border-b border-black/10 pb-2 text-sm">
                        ☐ {t.text}
                        {(t.dueDate || t.priority) && (
                          <span className="ml-2 text-xs opacity-50">
                            {[t.dueDate, t.priority].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </li>
                    ))}
                  {persisted.todos.filter((t) => !t.done).length === 0 && (
                    <li className="text-sm opacity-50">No open to-dos</li>
                  )}
                </ul>
              </section>
              <section className="mb-6">
                <h2 className="mb-2 text-lg font-bold uppercase tracking-wider">
                  Progress & Memory
                </h2>
                <ul className="space-y-2">
                  {persisted.journal.slice(0, 12).map((j) => (
                    <li key={j.id} className="text-sm">
                      <span className="font-bold uppercase text-xs mr-2">
                        {j.kind}
                      </span>
                      {j.text}
                    </li>
                  ))}
                  {persisted.journal.length === 0 && (
                    <li className="text-sm opacity-50">No journal entries</li>
                  )}
                </ul>
              </section>
              <section>
                <h2 className="mb-2 text-lg font-bold uppercase tracking-wider">
                  Messages today (sample)
                </h2>
                <ul className="space-y-1 text-sm">
                  {messages
                    .filter((m) => {
                      const d = new Date(m.timestamp);
                      const now = new Date();
                      return (
                        d.getDate() === now.getDate() &&
                        d.getMonth() === now.getMonth() &&
                        d.getFullYear() === now.getFullYear()
                      );
                    })
                    .slice(0, 20)
                    .map((m) => (
                      <li key={m.id}>
                        <span className="opacity-50">{m.time}</span>{" "}
                        <strong>{displaySender(m.sender ?? "System")}</strong>:{" "}
                        {m.isMedia ? "📎 Media" : m.text.slice(0, 120)}
                      </li>
                    ))}
                </ul>
              </section>
              <p className="mt-10 text-center text-xs opacity-40">
                Generated by BrandEx Workspace · marque
              </p>
            </div>
          </div>
        )}

        {/* Global right rail — todos + countdown on every page */}
        <aside className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
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
                onKeyDown={(e) => e.key === "Enter" && addTodo(newTodoText)}
              />
              <button
                className="nb-btn px-2"
                onClick={() => addTodo(newTodoText)}
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {openTodos.length === 0 && (
                <p className="text-xs opacity-50">No open to-dos.</p>
              )}
              {openTodos.slice(0, 10).map((t) => {
                const due = todoDueMs(t);
                const cd =
                  due != null ? formatCountdown(due, nowTick) : null;
                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-2 border-2 border-black/10 p-2"
                    style={{
                      borderColor:
                        cd?.urgency === "overdue"
                          ? "#C94A00"
                          : cd?.urgency === "soon"
                            ? "#D4A800"
                            : undefined,
                    }}
                  >
                    <button onClick={() => toggleTodo(t.id)}>
                      <Square size={14} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs leading-snug">{t.text}</span>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] opacity-60">
                        {cd && (
                          <span
                            style={{
                              color:
                                cd.urgency === "overdue"
                                  ? "#C94A00"
                                  : cd.urgency === "soon"
                                    ? "#8a6800"
                                    : undefined,
                              fontWeight: cd.urgency !== "ok" ? 700 : 400,
                            }}
                          >
                            <Clock size={10} className="mr-0.5 inline" />
                            {cd.label}
                          </span>
                        )}
                        {t.priority === "high" && <span>high</span>}
                        {t.period && t.period !== "none" && (
                          <span>{t.period.replace("_", " ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {openTodos.length > 10 && (
                <button
                  className="text-xs underline"
                  onClick={() => setActiveTab("todos")}
                >
                  View all {openTodos.length}
                </button>
              )}
            </div>
          </div>

          <div className="nb-panel p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock size={16} style={{ color: "var(--accent)" }} />
              <h3
                className="text-lg"
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: "1px",
                }}
              >
                COUNTDOWN
              </h3>
            </div>
            <p className="mb-3 text-[11px] opacity-50">
              Alerts for to-dos with a due date/time.
            </p>
            <div className="space-y-2">
              {openTodos.filter((t) => todoDueMs(t) != null).length === 0 && (
                <p className="text-xs opacity-50">
                  Set a due date on a to-do to see countdown here.
                </p>
              )}
              {openTodos
                .map((t) => ({ t, due: todoDueMs(t) }))
                .filter((x): x is { t: Todo; due: number } => x.due != null)
                .sort((a, b) => a.due - b.due)
                .slice(0, 8)
                .map(({ t, due }) => {
                  const cd = formatCountdown(due, nowTick);
                  return (
                    <div
                      key={t.id}
                      className="rounded-sm border-2 p-2 text-xs"
                      style={{
                        borderColor:
                          cd.urgency === "overdue"
                            ? "#C94A00"
                            : cd.urgency === "soon"
                              ? "#D4A800"
                              : "#0C0C0C",
                        background:
                          cd.urgency === "overdue"
                            ? "rgba(201,74,0,0.1)"
                            : cd.urgency === "soon"
                              ? "rgba(212,168,0,0.12)"
                              : "var(--panel)",
                      }}
                    >
                      <div className="font-medium leading-snug">{t.text}</div>
                      <div
                        className="mt-1 flex items-center gap-1"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color:
                            cd.urgency === "overdue"
                              ? "#C94A00"
                              : cd.urgency === "soon"
                                ? "#8a6800"
                                : "#555",
                        }}
                      >
                        <Clock size={12} />
                        {cd.label}
                        {t.dueDate && (
                          <span className="ml-1 font-normal opacity-60">
                            {t.dueDate}
                            {t.dueTime ? ` ${t.dueTime}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </aside>
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
          {/* Top: sender + time + LABELS (tags) */}
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
              <span className="italic opacity-50">{"<Media omitted>"}</span>
            ) : (
              message.text
            )}
          </p>
          {/* Bottom: TYPES as rounded pills */}
          {assignedTypes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {assignedTypes.map((tid) => {
                const type = types.find((t) => t.id === tid);
                if (!type) return null;
                const c = CHIP_COLORS[type.color] ?? CHIP_COLORS.orange!;
                return (
                  <span
                    key={tid}
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      border: `2px solid ${c.border}`,
                      color: c.text,
                      background: c.bg,
                    }}
                  >
                    {type.name}
                  </span>
                );
              })}
            </div>
          )}
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

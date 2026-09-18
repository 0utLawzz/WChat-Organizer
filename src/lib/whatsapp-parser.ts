export interface ChatMessage {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  sender: string | null;
  text: string;
  isMedia: boolean;
}

const LINE_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2})\s?(AM|PM|am|pm)?\s+-\s+(.*)$/;

function toTimestamp(
  date: string,
  time: string,
  meridiem?: string,
): number {
  const dparts = date.split("/").map(Number);
  const m = dparts[0] ?? 1;
  const d = dparts[1] ?? 1;
  const yRaw = dparts[2] ?? 2000;
  const year = yRaw < 100 ? 2000 + yRaw : yRaw;
  const tparts = time.split(":").map(Number);
  let hh = tparts[0] ?? 0;
  const mm = tparts[1] ?? 0;
  if (meridiem) {
    const up = meridiem.toUpperCase();
    if (up === "PM" && hh !== 12) hh += 12;
    if (up === "AM" && hh === 12) hh = 0;
  }
  return new Date(year, m - 1, d, hh, mm).getTime();
}

export function parseWhatsAppExport(raw: string): ChatMessage[] {
  const lines = raw.split(/\r?\n/);
  const messages: ChatMessage[] = [];
  let counter = 0;

  for (const line of lines) {
    const match = line.match(LINE_RE);
    if (match) {
      const date = match[1] ?? "";
      const time = match[2] ?? "";
      const meridiem = match[3];
      const rest = match[4] ?? "";
      const sep = rest.indexOf(": ");
      let sender: string | null = null;
      let text = rest;
      if (sep > 0 && sep < 60) {
        sender = rest.slice(0, sep).trim();
        text = rest.slice(sep + 2);
      }
      text = text.replace(/\s?<This message was edited>\s?/g, "").trim();
      const isMedia = text === "<Media omitted>";
      messages.push({
        id: `m${counter++}`,
        date,
        time: meridiem ? `${time} ${meridiem.toUpperCase()}` : time,
        timestamp: toTimestamp(date, time, meridiem),
        sender,
        text,
        isMedia,
      });
    } else if (messages.length > 0 && line.trim()) {
      const last = messages[messages.length - 1];
      if (last) last.text += "\n" + line;
    }
  }
  return messages;
}

export function groupByDate(
  messages: ChatMessage[],
): Map<string, ChatMessage[]> {
  const groups = new Map<string, ChatMessage[]>();
  for (const msg of messages) {
    const key = msg.date;
    const existing = groups.get(key);
    if (existing) existing.push(msg);
    else groups.set(key, [msg]);
  }
  return groups;
}

export function formatGroupDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function avatarColor(name: string): string {
  const colors = [
    "#C94A00",
    "#0D9970",
    "#0A6B52",
    "#D4A800",
    "#8B2FC9",
    "#0C0C0C",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? "#C94A00";
}

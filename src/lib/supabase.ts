import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://bguxpeccimvvixwjhdjc.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_iBdJ6UtM2BnP_sGcdrDeOg_nse9wbw7";

const TABLE = "marque_desk";
const ROW_ID = "default";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, h) => headers.set(h, value));
    }
    if (
      isNewSupabaseApiKey(key) &&
      headers.get("Authorization") === `Bearer ${key}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { fetch: createSupabaseFetch(SUPABASE_KEY) },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const SETUP_SQL = `create table if not exists public.marque_desk (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.marque_desk enable row level security;

drop policy if exists "marque_desk_all" on public.marque_desk;
create policy "marque_desk_all" on public.marque_desk
  for all using (true) with check (true);`;

export async function pullDeskState<T>(): Promise<T | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("payload")
    .eq("id", ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return (data?.payload as T) ?? null;
}

export async function pushDeskState(payload: unknown): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .upsert(
      {
        id: ROW_ID,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) throw error;
}

export function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(url.trim())) return url.trim();
  return null;
}

export function sheetEditUrl(urlOrId: string): string | null {
  const id = extractSheetId(urlOrId);
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

export function sheetCsvUrl(urlOrId: string): string | null {
  const id = extractSheetId(urlOrId);
  return id
    ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`
    : null;
}

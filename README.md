# Whatsapp Chat Organizer

Password-gated WhatsApp correspondence desk for BrandEx.

- **Labels** and **Types** (Trademark, Copyright, Opposition, Ledger Update, NTN — add your own)
- Saved messages, enhanced to-dos (due date, time, period, priority, notes)
- Progress & agent memory journal
- **Daily Work Preview** — day-by-day messages, open to-dos, and journal
- Upload **.txt** or **.zip** WhatsApp chat exports
- Google Sheets CSV one-click sync
- Supabase desk-state backup (auto-pull on login)

## Live

- App: https://marque-puce.vercel.app
- GitHub: https://github.com/0utLawzz/marque

## Login

Default password: `brandex2026`  
Change it in `src/App.tsx` (`APP_PASSWORD`).

## Local

```bash
npm install
npm run dev
```

## Supabase setup

1. In the [Supabase SQL editor](https://supabase.com/dashboard), run the `SETUP_SQL` from `src/lib/supabase.ts` (creates `marque_desk` + open RLS policy for the publishable key).
2. Defaults are already in code. For production on **Vercel**, add environment variables:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://bguxpeccimvvixwjhdjc.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable key |

Redeploy after setting env vars.

## Google Sheets

1. Open **Backup & Sync** in the app.
2. Paste your Google Sheet URL.
3. Optional: Apps Script webhook URL for auto-append.
4. Click sync — CSV downloads, clipboard copy, sheet opens for File → Import.

## Deploy

Vercel (Vite). Linked to this GitHub repo — every push to `main` deploys automatically.

## Community

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

# Whatsapp Chat Organizer

Password-gated WhatsApp correspondence desk for BrandEx.

- **Labels** and **Types** (Trademark, Copyright, Opposition, Ledger Update, NTN — add your own)
- Saved messages, enhanced to-dos (due date, time, period, priority, notes, labels, types, edit)
- Progress & agent memory journal + sidebar widget
- **Daily Work Preview** + printable **My Day**
- Upload **.txt** or **.zip** (button: UPLOAD)
- Rename / remove chats
- Confirm dialogs on Sheet / Supabase sync
- Database store viewer
- Google Sheets CSV one-click sync (default BrandEx sheet)
- Supabase desk-state backup (auto-pull on login)

## Live

- App: https://marque-puce.vercel.app
- GitHub: https://github.com/0utLawzz/WChat-Organizer

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

Default sheet: https://docs.google.com/spreadsheets/d/1PyvUTN9zR3kgcYIjhZu1inXoX0ZsIvD2SSo1yxrZ26o/edit?gid=307425405

1. Open **Backup & Sync** in the app.
2. Sheet URL is pre-filled (or paste your own).
3. Optional: Apps Script webhook URL for auto-append.
4. Click Sync — confirmation dialog, then CSV + open sheet / webhook POST.

## Deploy

Vercel (Vite). Linked to this GitHub repo — every push to `main` deploys automatically.

## Community

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

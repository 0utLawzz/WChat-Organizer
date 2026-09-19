# Contributing to Marque

Thanks for your interest in improving Marque.

## Development

```bash
npm install
npm run dev
```

- Stack: Vite + React 19 + TypeScript + Tailwind CSS v4
- Main UI: `src/App.tsx`
- WhatsApp parser: `src/lib/whatsapp-parser.ts`
- Supabase helpers: `src/lib/supabase.ts`

## Guidelines

1. Keep the neo-brutalism visual language consistent (hard borders, offset shadows, stamp-style badges).
2. Prefer local-first state (`localStorage`) with optional Supabase / Sheets backup.
3. Do not commit secrets. Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for production.
4. Open a pull request against `main` with a clear description of the change.
5. Be respectful — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Commit messages

Use short, imperative subjects, e.g. `Enhance todos with due date and priority`.

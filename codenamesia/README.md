# CodenamesIA

AI-powered Codenames-style word game. Enter **any custom categories** and Groq AI
(`openai/gpt-oss-20b`) generates a complete 25-word board — then play pass-and-play,
against AI, or in **real-time multiplayer rooms** with friends on any device.

> Not affiliated with CGE / Codenames.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn-style UI ·
Lucide · Framer Motion · Zod · Groq SDK · Supabase (Postgres + Auth + Realtime) ·
Vitest · Playwright

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev                  # http://localhost:3000
```

### Environment (`.env.local`, never commit)

```env
GROQ_API_KEY=gsk_...                       # required for real AI (demo mode without it)
GROQ_MODEL=openai/gpt-oss-20b

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # or legacy anon JWT
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...            # or legacy service_role JWT (SERVER ONLY)

GUEST_AUTH_SECRET=a-long-random-string     # signs guest identities
```

Without Supabase the app still runs fully (server-authoritative in-memory store +
SSE realtime). With Supabase configured, rooms/games are also persisted to Postgres
and hydrated after restarts, and `room_events` rows feed Supabase Realtime.

### Supabase setup (5 minutes)

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → paste & run `supabase/migrations/20260101000000_codenamesia_multiplayer.sql`.
3. Project Settings → API: copy **Project URL**, **publishable** key, and **secret/service-role** key into `.env.local` (and into Vercel env vars for deployment).
4. (Optional) Auth → enable Email + Google + Anonymous sign-in.
5. Restart the app — `GET /api/health` should show `"supabase": {"configured": true}`.

Security model: card assignments live in `game_card_secrets` (RLS on, **zero policies**
→ service-role only, never in Realtime). Browsers only ever read `games_public` /
`game_cards_public` views, which expose an assignment only after a card is revealed.
The secret spymaster board is served exclusively by the Next.js API after
membership + role verification (`GET /api/games/[id]/spymaster`).

## How multiplayer works

`/` → **Multiplayer** → create a room (categories, difficulty EN/FR/AR, max players,
optional AI spymasters) → share `/room/CODE` → friends join as guests (signed
identities, no account needed) → pick teams/roles (exactly one human spymaster per
team) → host starts → Groq generates 25 validated words → the **server** assigns
9/8/7/1 with a CSPRNG → everyone plays the same board, synchronized live
(SSE and/or Supabase Realtime notifications → authorized refetch; payloads never
contain secrets). Wrong-team and spymaster guesses are rejected server-side;
concurrent moves are guarded by version checks (409).

AI reliability details (gpt-oss-20b): `reasoning_effort: low`, strict-JSON with a
no-`response_format` fallback, dedupe/near-dedupe cleaning, **top-up generation**
when the model returns <25 words, **balance-trim** when >25, and 429 backoff that
honours Groq's free-tier TPM hints. Groq free tier ≈ 8,000 tokens/min ≈ a few
boards+clues per minute.

## Tests

```bash
npm test          # 30 Vitest tests: engine rules, secrecy, 2-actor multiplayer, concurrency
npm run test:e2e  # Playwright: two REAL browser contexts play one synchronized game
npm run build     # production build
```

## Project layout

```
src/app/                 Pages (/, /multiplayer, /create-game, /room/[id], /game/[id], …)
src/app/api/             Route handlers (guest, rooms, games, ai) — server-authoritative
src/lib/game-engine/     Pure TS engine: board, rules, turns, win conditions, serializers
src/lib/ai/              Groq client, prompts, validation (clean/top-up/trim), services
src/lib/multiplayer/     Identity, room store/service, events (SSE), Supabase persistence
src/lib/store/           Authoritative game store
src/components/          Board, lobby, categories, UI primitives
src/hooks/useRoom.ts     Realtime subscriptions (SSE + Supabase) & presence
supabase/migrations/     Postgres schema + RLS + secure views + realtime publication
tests/ · e2e/            Vitest + Playwright suites
```

## Deploy

- **Vercel**: import the repo, set the env vars above, deploy. (In-memory fallback
  is single-instance — configure Supabase for durable production multiplayer.)
- **Supabase Cloud**: run the migration as described.

# ViMusic – Web Version with Cloud Sync

![React](https://img.shields.io/badge/React-18.3-blue)
![Vite](https://img.shields.io/badge/Vite-5.4-purple)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-teal)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Realtime-brightgreen)

A web version of the **ViMusic** Android app — Google sign-in, real-time cloud sync, background
playback with lock-screen controls, and audio/video toggling.

The web app and the Android app **share one Supabase database**, so a favorite added on the phone
appears on the website within a second, and vice versa. Library `.db` files remain compatible with
the original Android app's SQLite schema.

---

## How it works

```
Browser (React SPA)
   │
   ├── playback ──────► YouTube IFrame Player API      (audio/video never touches our servers)
   │
   ├── search ────────► YouTube Data API v3            (called directly from the browser)
   │
   ├── library CRUD ──► Backend (Vercel functions)  ──► Supabase Postgres
   │                    service-role key, bypasses RLS
   │
   └── live updates ◄── Supabase Realtime (WebSocket)  ◄── same Postgres, via logical replication
                                                            ▲
                                            ViMusic Android ─┘  (writes directly, anon key + RLS)
```

**Playback.** No audio is hosted or proxied. A hidden YouTube IFrame player is created once and
reused via `loadVideoById` for each subsequent track — recreating it per song caused a visible
flash and dropped the buffered stream. "Audio mode" and "video mode" are the same player; only the
container's visibility changes, so switching modes never interrupts playback.

**Identity.** There is no join table between users and their data. Every row carries a `user_id`
TEXT column holding the account's **email address**, with `''` reserved for the shared guest
bucket. The backend derives it from an `X-User-Email` header; the Android client derives it from
its JWT via `public.jwt_user_id()`. Both must normalise identically (lowercased, trimmed) or the
two clients see different libraries.

**Two trust models against one database.** The web backend uses the **service-role key**, which
bypasses row-level security entirely — scoping happens in query filters. The Android app connects
with the **anon key plus a user JWT**, so it is fully subject to RLS. That is why the schema has
both server-side filters and RLS policies: remove either one and a client breaks.

**Guest mode.** Signed-out visitors see a curated "Master's Mix" — the favorites of
`ab007shetty@gmail.com`, exposed read-only via an explicit RLS policy (migration 012).

---

## Features

- **Background & lock-screen playback** — MediaSession metadata, artwork and action handlers
  (play/pause/next/previous/seek), plus position state so Android's media widget renders a
  scrubber. See [Background playback](#background-playback) for what actually keeps audio alive.
- **Audio ⇄ video toggle** — switch modes mid-song without restarting; the mode persists across
  skips and queue jumps.
- **Real-time sync** — favorites, playlists, playlist contents and search history propagate
  between the website and the Android app over Supabase Realtime, with no refresh and no loading
  skeleton. Only genuinely-new cards animate in; everything already on screen is left untouched.
- **Search** — YouTube search with infinite scroll, or paste a YouTube / YouTube Music / Shorts URL
  to play a single track directly.
- **Synced search history** — the last searches follow you between devices; the 5 most recent are
  suggested under the search bar.
- **Playlists** — create, rename, delete, reorder membership, and set any song's artwork as the
  playlist cover (shared with the Android app). Playlists with no chosen cover borrow their first
  song's artwork.
- **Library views** — Favorites, Most Played (by accumulated listening time), Recently Played, and
  per-playlist song lists. All paginate 20 at a time and load more as you scroll.
- **Import / export** — download your library as a `.db` file compatible with Android ViMusic, or
  import one back.
- **Keyboard shortcuts** — `Space` play/pause, `→` next track, `←` previous track. Suppressed
  while typing in an input, textarea or contenteditable, and inert until a song is loaded.
- **Touch & desktop UX** — swipe down to minimize, scrub the progress bar from the mini player,
  an Up Next queue panel, subtitles, shuffle, and repeat (off / one / all).

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18.3, Vite 5.4, TailwindCSS 3.4 |
| Motion | GSAP 3.15 + ScrollTrigger (entrance animation), Lenis 1.3 (smooth scroll) |
| UI | lucide-react (icons), react-hot-toast (notifications) |
| Backend | Node 18+, Vercel serverless functions, Express 5 (local dev shim only) |
| Database | Supabase Postgres, plus `sql.js` (WASM SQLite) for `.db` import/export |
| Auth | Supabase Auth — Google OAuth |

### External APIs

| API | Used for |
| --- | --- |
| **YouTube IFrame Player API** | All playback. Loaded from `www.youtube.com`, controlled via `loadVideoById` / `playVideo` / `seekTo`. |
| **YouTube Data API v3** — `/search` | Keyword search (20 results/page, paged by `pageToken`). |
| **YouTube Data API v3** — `/videos` | Track durations and pasted-URL metadata. `/search` does **not** return duration, so results are enriched with one batched `/videos` call (up to 50 ids per request). |
| **Supabase Auth** | Google OAuth, with `prompt: select_account` so the account chooser always appears. |
| **Supabase Realtime** | `postgres_changes` on `song`, `playlist`, `song_playlist_map`, `search_history`, filtered per user. |
| **MediaSession API** | Lock-screen / notification metadata, artwork and transport controls. |
| **Screen Wake Lock API** | Stops the screen dimming while a song plays *and the tab is visible*. Released automatically when hidden — it does not affect background playback. |
| **Service Worker + Cache API** | Cache-first thumbnail store (see [Thumbnails](#thumbnails--caching)). |
| **IntersectionObserver / ResizeObserver** | Infinite scroll, and matching the Up Next panel height to the video box. |

---

## Backend API

All routes live under `/api`. Vercel maps folders to paths; `dev-server.js` mirrors the same URLs
locally with Express. Identity comes from the `X-User-Email` header (absent ⇒ guest).

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/songs?orderBy=&limit=&offset=` | Most Played (default) or Recently Played (`orderBy=lastPlayedAt`) |
| `GET` | `/favorites?limit=&offset=` | Liked songs, newest first |
| `PUT` | `/songs/:songId/favorite` | Toggle favorite (upserts the song row) |
| `POST` | `/songs/:songId/play` | Add listening time; calls the `increment_play_time` RPC |
| `GET` | `/songs/:songId/playlists` | Which playlists contain this song |
| `GET`/`POST` | `/playlists` | List (with derived covers) / create |
| `PUT`/`DELETE` | `/playlists/:id` | Rename and/or set `coverUrl` / delete |
| `GET` | `/playlists/:id/songs?limit=&offset=` | Songs in a playlist, in position order |
| `POST`/`DELETE` | `/playlists/:id/songs/:songId` | Add / remove a song |
| `GET`/`POST`/`DELETE` | `/search-history` | Recent queries; sign-in required |
| `GET` | `/export-database/:email` | Download library as SQLite `.db` |
| `POST` | `/import-database/:email` | Replace library from an uploaded `.db` |
| `POST` | `/login/:email` | Syncs Google profile metadata into `public.users` |
| `POST` | `/logout/:email` | Marks the session closed |

Paginated routes return `{ songs, hasMore }`; `hasMore` is simply "the page came back full".

---

## Database

`backend/supabase/migrations/` and `ViMusicAndroid/supabase/migrations/` are **one numbered
sequence against one database** — 001–009 and 016 were authored web-side, 010–015 Android-side.
Run them in numeric order regardless of which folder they live in.

Core tables: `song`, `playlist`, `song_playlist_map`, plus `artist`, `album`, `song_artist_map`,
`song_album_map`, `format`, `lyrics`, `event` (mirrored from the Android schema),
`playback_state` (cross-device resume) and `search_history`. Composite primary keys are
`(id, user_id)`, so the same track can exist independently for several accounts.

Two behaviours worth knowing:

- **Cascading delete.** `user_id` is an email string with no foreign key to `public.users`, so
  `ON DELETE CASCADE` is impossible. A trigger (migrations 006/008/009/011/016) deletes matching
  rows from every table instead, and 007 chains it from `auth.users`, so removing a user in the
  Supabase Auth dashboard wipes their entire library. **This is irreversible.**
- **Realtime requires publication membership.** Migration 015 adds the tables to
  `supabase_realtime` and sets `REPLICA IDENTITY FULL`. Without it, subscriptions connect happily
  and simply never receive an event — the failure mode is silence, not an error.

### Maintenance scripts

```bash
cd backend
npm run seed:guest                                   # seed the guest/Master's Mix library
npm run sync:users                                   # backfill public.users from auth.users
YOUTUBE_API_KEY=... node scripts/backfill-durations.js --dry-run   # preview
YOUTUBE_API_KEY=... node scripts/backfill-durations.js             # apply
```

`backfill-durations.js` fills in missing durations and replaces YouTube Music play counts
("869M plays") that the Android app sometimes writes into `durationText`.

---

## Background playback

Three mechanisms cooperate, and it's worth being precise about which does what:

1. **`/silence.wav`** — a 1-second, 8 kHz silent loop played at 1% volume whenever a song is
   playing (`PlayerContext.jsx`). Its only job is to keep an audible-media session attached to the
   *page itself*. Audio actually comes from a cross-origin YouTube iframe, and mobile browsers
   suspend or lose the media session for a backgrounded page; a real `<audio>` element playing from
   our own origin keeps that session — and therefore the notification and lock-screen controls —
   alive.
2. **MediaSession handlers** — supply metadata and wire the lock-screen buttons back to the player.
   Each handler is registered inside its own `try/catch`, because some browsers throw on action
   types they don't support and one throw would otherwise skip every handler after it.
3. **A visibility watchdog** — when the tab is hidden and the player reports anything other than
   PLAYING/BUFFERING without the user having pressed pause, `playVideo()` is re-issued.

**What this does not do:** none of it overrides a browser that refuses background iframe playback.
Whether audio survives screen-off is decided by the browser, not by this code — **Brave allows
background playback and is where this works reliably**; Chrome on Android generally pauses. The
Wake Lock is unrelated: it only prevents the *inactivity* dimming timer while the tab is visible,
and the spec releases it the moment the tab is hidden.

---

## Thumbnails & caching

Two thumbnail URL families arrive from the shared database and are handled in
`frontend/src/utils/thumbnails.js`:

- `i.ytimg.com/vi/<id>/<size>.jpg` — songs added through the website (sizes are named files)
- `lh3.googleusercontent.com/...=w60-h60-l90-rj` — songs synced from Android (size is a parameter)

Size is chosen per surface rather than always requesting the maximum. Grid cards render at roughly
204×224 CSS px, so they request `sddefault` (24 KB) or `w544` (105 KB); only the maximized player
requests `maxresdefault` / `w1000`. Cards, the queue, the mini player and playlist covers
deliberately share one URL so a single cached image serves all four.

`maxresdefault` doesn't exist for every video and fails two different ways — some 404, others
return HTTP 200 with a 120×90 grey placeholder — so both `error` and `load` funnel into the same
step-down through `sddefault` → `hqdefault`. There is no stock-image fallback: every song has real
artwork, so an exhausted ladder means genuine failure and the card shows its own background.

`public/sw.js` caches thumbnails cache-first, bounded to 400 entries. This exists because
`i.ytimg.com` sends `Cache-Control: max-age=7200` — without the worker, every thumbnail you have
already seen re-downloads after two hours.

---

## Setup

**Prerequisites:** Node.js 18+, a Supabase project, and a YouTube Data API v3 key.

```bash
git clone https://github.com/ab007shetty/ViMusic.git
cd ViMusic
```

**1. Database** — run every migration from both `supabase/migrations/` folders in numeric order,
in the Supabase SQL editor.

**2. Backend**

```bash
cd backend
npm install
```

`backend/.env`:

```env
PORT=8080
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

```bash
npm run dev      # http://localhost:8080
```

> The dev server does not hot-reload. Restart it after changing anything under `backend/`.

**3. Frontend**

```bash
cd ../frontend
npm install
```

`frontend/.env`:

```env
VITE_API_URL=http://localhost:8080/api
VITE_YOUTUBE_API_KEY=your_youtube_data_api_v3_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev      # http://localhost:3000
```

Add your app's origin to Supabase → Authentication → URL Configuration, or the Google OAuth
redirect will fail.

---

## Deployment

Both halves deploy to Vercel as separate projects. `frontend/vercel.json` carries the security
headers (CSP, HSTS, frame options) and cache policy.

If you change the CSP, note that the service worker inherits it: its `fetch()` for thumbnails
needs `i.ytimg.com` and `lh3.googleusercontent.com` in **`connect-src`**, not just `img-src`, and
registering it needs `worker-src 'self'`.

---

## Known gaps

- The service worker only registers in production builds, so thumbnail caching is not active in
  `npm run dev`.
- `axios` is listed in `frontend/package.json` but never imported.

---

## License

MIT.

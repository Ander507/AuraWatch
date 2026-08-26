# AuraWatch

A vibe finder for movies, TV, anime, songs, games, books, manga, and board games. Tell it what you’re in the mood for. Get a handful of titles that actually fit, not a wall of “because you watched.”

![AuraWatch desktop UI](docs/desktop.png)

**[Try the live demo →](https://aurawatch.org/)**

<p align="center">
  <img src="docs/minimal.png" alt="Minimal theme" width="48%" />
  <img src="docs/songs.png" alt="Song recommendations" width="48%" />
</p>

---

## Quick start

Open the demo link above. That’s it.

---

## Features

- **Formats** — movies, series, anime, songs, games, books & manga, or board games. Media formats can mix; the exclusive ones (songs, games, books, tabletop) stay in their own lane.
- **Vibe in, picks out** — notes, “like these” titles, genres, decade, content rating, anti-vibe, and the usual light filters. Copy a link and the whole query comes back.
- **Surprise Me** — keeps your Format, rolls a new mood. When a query comes back empty, you get a fallback card instead of a blank pane: Surprise Me or Reset Filters.
- **Games** — platform filter, price range, IGDB covers, store CTAs (Steam / Epic / GOG / console / Official Site).
- **Books & manga** — Open Library covers first, Google Books if that’s blank, then Jikan / AniList for manga. **Buy on Amazon** on the card (author goes into the search so you don’t get the movie).
- **Board games** — live against BoardGameGeek’s XML API. Search → batch `/thing` for box art, year, and player count. Exact titles win over fan expansions. **Buy on Amazon** here too.
- **Where to watch / listen** — region-aware streaming logos for movies and shows; listen links for songs.
- **Playlists** — Discord sign-in, save picks to cloud lists, share a `/list/…` URL, export movies/shows to Letterboxd. Copy Link pops a little terminal toast so you know it actually copied.
- **Group Vibe Rooms** — host signs in, shares a `/room/…` link. Guests join with a nickname (no account). The host calculates a match from everyone’s notes and likes; picks save on the room so the group sees the same cards, including where to watch / play. Rooms self-destruct after 24 hours.
- **Two themes** — dark Minimal, or Desktop board in Light or Dark. Remembered in the browser.

AuraWatch is free. **Buy on Amazon** links are affiliate links. As an Amazon Associate, we earn from qualifying purchases.

---

## Run it locally

**Needs Node 20+.**

```bash
npm install
cp .env.example .env
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

### Environment

Copy `.env.example` → `.env` and fill what you have. **Never commit `.env`** — this repo is public.

| Variable | What it’s for |
|---|---|
| `GEMINI_API_KEYS` | Comma-separated Gemini keys. The app rotates when one fails. |
| `TMDB_API_KEY` | Posters, similar-title search, trailers, and watch providers. |
| `TMDB_WATCH_REGION` | Fallback region only — users pick their own in the UI. |
| `IGDB_CLIENT_ID` | Twitch / IGDB client ID — Games covers, platforms, store links. |
| `IGDB_CLIENT_SECRET` | Twitch / IGDB client secret. |
| `BGG_API_TOKEN` | Optional BoardGameGeek XML API2 token. Without it, BGG often 401s and typeahead falls back to a small local list. |
| `TURSO_DB_URL` / `TURSO_DB_AUTH_TOKEN` | Cloud playlists (libSQL). |
| `AUTH_SECRET` | Required for Auth.js sessions (`openssl rand -hex 32`). |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord OAuth. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional shared cache. Fine to skip. |

Put the same keys in Vercel (or your host) env settings for production. No keys? It still runs off a small local catalog.

```bash
npm run build    # production build
npm run preview  # preview the build
npm run check    # types / svelte-check
```

---

## How it works

Recommendations don’t all go through one path. The backend picks the least-fake option for what you asked:

1. **Songs** → Gemini suggests tracks → iTunes fills covers and listen URLs
2. **Games** → Gemini suggests titles → IGDB fills covers, platforms, and store links
3. **Books & manga** → Gemini suggests titles → Open Library (Google Books if the cover is missing) → Jikan / AniList for manga
4. **Board games** → Gemini suggests titles → BGG XML search → batch `/thing` for box art. BGG likes to answer `202` (“try again later”), so we retry that queue instead of shipping empty boxes
5. **“Like this title”** → TMDB similar / recommendations, filtered by your genres
6. **Vibe / genres** → Gemini concierge (strict JSON) → TMDB for posters + providers
7. **Anything fails** → score a local catalog by format, genres, and vibe keywords

**Group Vibe Rooms** skip the solo form. The host sets format + filters (region, rating, decade, platforms). Guests drop notes and liked titles. Calculate (host only) merges everyone into one recommend call and stores the full cards on the room so watch/play links stay in sync.

Gemini is good at *taste* and bad at *valid JSON*, so there’s a repair pass for fences, curly quotes, and trailing commas. Keys rotate with a short cooldown when one burns out. Result genres are the title’s real tags — never a parrot of whatever you clicked in the UI.

Covers show a brutalist skeleton until the image lands, then fade in. If the image never comes, you get initials on a gradient instead of a broken-image icon.

Surprise Me deliberately does **not** change Format — it only rolls notes and light filters so you stay in the lane you already picked.

Amazon buttons follow the region you picked: US → amazon.com, UK/Ireland → amazon.co.uk, Italy → amazon.it, most of Europe → amazon.de. Tag is baked in, not an env var.

Stack: SvelteKit 2 + Svelte 5, Tailwind 4, Gemini Flash, TMDB, IGDB, iTunes Search, Open Library, BoardGameGeek XML API2.

---

## Credits

- [The Movie Database (TMDB)](https://www.themoviedb.org/) — search, similar titles, posters, trailers, watch providers
- [IGDB](https://www.igdb.com/) / [Twitch](https://dev.twitch.tv/) — game covers, platforms, and store websites
- [Open Library](https://openlibrary.org/) — book search and covers
- [Google Books](https://developers.google.com/books) — cover fallback when Open Library blanks
- [Jikan](https://jikan.moe/) / [AniList](https://anilist.co/) — manga covers
- [BoardGameGeek](https://boardgamegeek.com/) — tabletop search, box art, year, player counts
- [Google Gemini](https://ai.google.dev/) — concierge prompts
- [Apple iTunes Search API](https://affiliate.itunes.apple.com/resources/documentation/itunes-store-web-service-search-api/) — music lookup
- [SvelteKit](https://svelte.dev/docs/kit) + [Tailwind CSS](https://tailwindcss.com/)

---

Made with ❤️ by Ander507 @ Stardance - HackClub

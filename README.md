# AuraWatch

A vibe finder that picks **one** thing to watch, play, read, or listen to tonight — not a wall of "because you watched."

![AuraWatch desktop UI](docs/desktop.png)

**[Try the live demo →](https://aurawatch.org/)**

<p align="center">
  <img src="docs/minimal.png" alt="Minimal theme" width="48%" />
  <img src="docs/songs.png" alt="Song recommendations" width="48%" />
</p>

---

## Why this exists

Decision paralysis is the actual enemy — not "I have nothing to watch," but "I have too much to watch and can't pick." Most recommenders make that worse: they hand you twenty rows and walk away. AuraWatch hands you **one** pick, with a button to open it. If you say no, it picks a different one — and it never suggests the same thing twice.

---

## Quick start

Open the demo link above. That's it. No account needed to get picks.

Sign in with Discord only if you want cloud playlists or to host a Group Vibe Room.

---

## Features

- **One hero pick + "or these"** — the top match renders as a big decision card with a primary Watch / Listen / Play button. The rest sit below as alternates. No more five-equal-cards-into-Netflix-scroll.
- **Decide for me** — one tap opens the best fit's watch link and commits. The anti-paralysis escape hatch.
- **Re-rolls that remember** — "Not this" and "Seen it" titles are sent back to the engine as a hard avoid, so the next pile never resurfaces what you already bounced. The loop is progressive, not amnesiac.
- **Match % + why-chips** — every card shows a fit score and the actual reasons (genre overlap, a keyword from your notes, "like *X*"). Not theater — it's the same signal the engine used.
- **Not this, steer it** — bounce a pick with a direction: *Darker, Lighter, Shorter, Weirder, Opposite.* The steer rewrites the prompt; you don't retype your vibe.
- **Tonight clock** — filter by how much night is left: *< 90 min, ~2 hours, Go long.* Server gates movie runtime; TV episodes are a soft hint.
- **On my apps** — pin Netflix, Max, Prime, etc. Picks on your apps float to the top and get a green badge. Nothing gets filtered to zero — if nothing's on your apps, you still see the best off-apps pick.
- **Match the sky** — a Surprise Me that reads the actual weather and hour. Sleet at 1am won't roll summer-beach.
- **Recent vibes** — your last few searches, with the full filter state (runtime, services, likes, anti-vibe, decade) so re-firing Friday is one tap to the same decision.
- **Watchlist + Hidden** — bookmark a pick or hide a stinker. Both persist in the browser; restore from the drawer anytime.
- **Era filter** — All Time, Modern (2020+), 2010s, 2000s, Classics (<2000).
- **Formats** — movies, series, anime, songs, games, books & manga, board games. Mix media formats; the exclusive lanes (songs, games, books, tabletop) stay in their own lane.
- **Where to watch / listen / play** — region-aware streaming logos for movies and shows, listen links for songs, store CTAs for games, Amazon for books and board games.
- **Group Vibe Rooms** — host signs in, shares a `/room/…` link. Guests join with a nickname (no account). The host calculates a match from everyone's notes and likes; picks save on the room so the group sees the same cards. Rooms self-destruct after 24 hours.
- **Cloud playlists** — Discord sign-in, save picks to lists, share a `/list/…` URL, export movies/shows to Letterboxd.
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

| Variable | What it's for |
|---|---|
| `GEMINI_API_KEYS` | Comma-separated Gemini keys. The app rotates when one fails (429 / dead). |
| `TMDB_API_KEY` | Posters, similar-title search, trailers, watch providers. |
| `TMDB_WATCH_REGION` | Fallback region only — users pick their own in the UI. |
| `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` | Twitch / IGDB — game covers, platforms, store links. |
| `BGG_API_TOKEN` | Optional. Without it, BoardGameGeek search/covers often 401; typeahead falls back to a small local list. |
| `TURSO_DB_URL` + `TURSO_DB_AUTH_TOKEN` | libSQL — cloud playlists, rooms, auth. |
| `AUTH_SECRET` | Auth.js session secret. Generate with `openssl rand -hex 32`. |
| `AUTH_DISCORD_ID` + `AUTH_DISCORD_SECRET` | Discord OAuth. In the Discord Developer Portal, add both redirects exactly (no `www`): `http://localhost:5173/auth/callback/discord` and `https://aurawatch.org/auth/callback/discord`. |

Leave `AUTH_URL` unset — Auth.js infers the host from the request, so localhost / preview / prod all work.

---

## How it works

The engine is a **concierge prompt**, not a collaborative filter. We don't have a watch-history graph and we don't want one — most people aren't logging every film they've seen. Instead, Gemini is given hard constraints (format, genres, era, content rating, runtime, anti-vibe, already-rejected titles) and a priority weighting between the user's free-text notes and their "like these" reference titles. The prompt explicitly tells the model to override popularity bias — *Breaking Bad* and *Game of Thrones* are guilty until proven perfect.

After Gemini returns candidates, each title is enriched against real APIs: TMDB for posters, trailers, runtime, and region-aware watch providers; IGDB for game covers and store links; Open Library / Google Books / Jikan for book and manga covers; BoardGameGeek's XML API2 for tabletop. A runtime gate filters movies against the "Tonight clock" before they reach the card.

The **decision layer** sits client-side in Svelte 5. `visibleResults` is a `$derived` that dedupes by a deterministic title/type/artist hash, filters by era and runtime, then soft-ranks by "on your apps" and match score — so the hero position is honest. Re-rolled titles are collected from `localStorage` (ignored + bounced) and sent back as `excludeTitles` on the next `/api/recommend` call, where they become a hard avoid in the prompt AND a skip in the catalog refill loop. That's why the loop never suggests the same thing twice.

The match percentage is a blend of genre-overlap and keyword-overlap scores, weighted by a user-tunable "notes weight" slider. It's clamped to 52–99% because a number that says "100% Match" is a lie; a number that says "61% Match" tells you to keep scrolling.

---

## Credits

- [TMDB](https://www.themoviedb.org/) — posters, trailers, watch providers.
- [IGDB](https://api-docs.igdb.com/) — game data, covers, platforms.
- [Open Library](https://openlibrary.org/) — book covers and metadata.
- [Jikan](https://jikan.moe/) / [AniList](https://anilist.co/) — manga covers.
- [BoardGameGeek](https://boardgamegeek.com/) — tabletop data via XML API2.
- [Open-Meteo](https://open-meteo.com/) — weather for "Match the sky."
- [Gemini](https://ai.google.dev/) — the concierge brain.
- [SvelteKit](https://svelte.dev/) + [Tailwind 4](https://tailwindcss.com/) + [Drizzle](https://orm.drizzle.team/) + [Turso](https://turso.tech/) + [Auth.js](https://authjs.dev/).

Built for Stardance. Ship something.

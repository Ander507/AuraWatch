# AuraWatch

A vibe finder for movies, TV, anime, songs, and games — tell it what you’re in the mood for, get titles that actually fit.

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

- **Formats** — movies, series, anime, songs, or games (multi-select for media)
- **Vibe in, picks out** — free-text notes, “like these” titles, genres, decade, and content rating
- **Surprise Me** — keeps your Format, randomizes the vibe and light filters
- **Games done right** — platform filter, price range, IGDB covers, and store CTAs (Steam / Epic / GOG / console / Official Site)
- **Where to watch / listen** — region-aware streaming logos for media; listen links for songs
- **Shareable vibes** — copy a link that restores your filters; save picks to a local My List
- **Two themes** — dark minimal or light desktop board, remembered in the browser

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
| `TURSO_DB_URL` / `TURSO_DB_AUTH_TOKEN` | Cloud vibe lists (libSQL). |
| `AUTH_SECRET` | Required for Auth.js sessions (`openssl rand -hex 32`). |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord OAuth. |

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
2. **Games** → Gemini suggests titles → IGDB fills covers, platforms, and store links (Steam / Epic / GOG by category, Official Site when PC has no storefront)  
3. **“Like this title”** → TMDB similar / recommendations, filtered by your genres  
4. **Vibe / genres** → Gemini concierge (strict JSON) → TMDB for posters + providers  
5. **Anything fails** → score a local catalog by format, genres, and vibe keywords  

Gemini is good at *taste* and bad at *valid JSON*, so there’s a repair pass for fences, curly quotes, and trailing commas. Keys rotate with a short cooldown when one burns out. Result genres are the title’s real tags — never a parrot of whatever you clicked in the UI.

Surprise Me deliberately does **not** change Format — it only rolls notes and light filters so you stay in the lane you already picked.

Stack: SvelteKit 2 + Svelte 5, Tailwind 4, Gemini Flash, TMDB, IGDB, iTunes Search.

---

## Credits

- [The Movie Database (TMDB)](https://www.themoviedb.org/) — search, similar titles, posters, trailers, watch providers  
- [IGDB](https://www.igdb.com/) / [Twitch](https://dev.twitch.tv/) — game covers, platforms, and store websites  
- [Google Gemini](https://ai.google.dev/) — concierge prompts  
- [Apple iTunes Search API](https://affiliate.itunes.apple.com/resources/documentation/itunes-store-web-service-search-api/) — music lookup  
- [SvelteKit](https://svelte.dev/docs/kit) + [Tailwind CSS](https://tailwindcss.com/)

---

Made with ❤️ by Ander507 @ Stardance - HackClub

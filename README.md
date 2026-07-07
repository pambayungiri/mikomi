# Mikomi

A fast, server-rendered manga/manhwa/manhua reader built with **Next.js 16 (App Router)** and **TypeScript**, backed by a provider-abstraction data layer that can plug into any content source.

**Live demo:** [mikomi.vercel.app](https://mikomi.vercel.app)

> Mikomi is a personal, educational project. It does **not** host, store, or redistribute any comic content — it is a reading UI that renders metadata and images served directly by third-party sources. For personal use only.

## Features

- **Server-side rendering with ISR** — content pages render on the server and revalidate on a schedule (1h home/list, 30m detail, 24h chapters), so readers never stare at loading spinners
- **Dual-mode chapter reader** — long-strip (vertical scroll) and single-page modes with keyboard navigation, page progress indicator, and per-user mode persistence
- **Browse & discover** — hero carousel, latest updates, new arrivals, genre filtering with cursor-based pagination, and debounced server-side search
- **Bookmarks & reading history** — stored entirely in `localStorage`; no accounts, no tracking, no database of its own
- **Provider abstraction** — all data access goes through a typed `MangaProvider` interface, so a new content source is one class + one env var away
- **Tested data layer** — the Firestore REST wrapper and provider implementation are covered with Vitest

## Architecture

```
app/                      Next.js App Router pages (7 routes)
  page.tsx                  Home — carousel, latest updates, new arrivals
  list/                     Browse — genre filter, sort, cursor pagination
  manga/[slug]/             Detail — metadata, chapter list, bookmark
  chapter/[slug]/[ch]/      Reader — long-strip / single-page modes
  search/                   Search — force-dynamic, debounced client input
  bookmark/  history/       Client-only pages backed by localStorage

lib/
  providers/
    types.ts              MangaProvider interface + shared domain types
    keikomik.ts           Provider implementation (Firestore REST)
    index.ts              getProvider() factory — selects provider via env
  firestore.ts            Minimal typed wrapper over the Firestore REST API
  config.ts               Env validation — fails fast on missing config

components/               MangaCard, ChapterReader, HeroCarousel, ...
```

**Data flow:** Server Components call `getProvider()` directly — no internal API routes, no client-side data fetching for content. The default provider reads a publicly accessible Firestore database through the **Firestore REST API** (no Firebase SDK — keeps the bundle lean and the data layer fully typed and testable). Queries, cursor pagination, and range-based prefix search were implemented against the raw REST protocol.

Bookmark/history pages are pure client components that only touch `localStorage`.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16, App Router, React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (design tokens via `@theme`) |
| Data | Firestore REST API via custom typed client |
| Testing | Vitest + Testing Library |
| Deployment | Vercel |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the provider config
pnpm dev                     # http://localhost:3000
```

Run the test suite:

```bash
pnpm test
```

## Configuration

| Variable | Description |
|---|---|
| `MANGA_PROVIDER` | Which provider implementation to use (default: `keikomik`) |
| `KEIKOMIK_PROJECT_ID` | Firebase project ID of the content source |
| `KEIKOMIK_API_KEY` | Client API key of the content source (public, client-exposed key) |
| `NEXT_PUBLIC_BASE_URL` | Canonical base URL of the deployment |

## Notes

- The content source exposes a client-readable Firestore database; Mikomi consumes it read-only, the same way the source's own web client does.
- Images are hotlinked from the source CDN and never proxied or cached by this project.
- Adding a new source = implement `MangaProvider` (7 methods), register it in `lib/providers/index.ts`, and switch `MANGA_PROVIDER`.

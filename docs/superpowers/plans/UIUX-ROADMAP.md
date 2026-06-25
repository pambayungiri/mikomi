# Mikomi — UI/UX Improvement Roadmap

**Dibuat:** 2026-06-25  
**Status:** In Progress  
**Pedoman:** Setiap perubahan harus merujuk dokumen ini. Tandai `[x]` saat selesai.

---

## Masalah yang Dilaporkan User Langsung

- [ ] **Search sangat buruk** — sulit menemukan manga yang dimaksud (hanya prefix match, tidak fuzzy)
- [ ] **Klik genre tag sangat lambat** — filter genre tidak ada orderBy, query berat
- [ ] **Browse lemot** — pagination load-more butuh optimasi
- [ ] **Tidak ada sort by rating** di Browse
- [ ] **Tidak ada filter by type** (Manga / Manhwa / Manhua) di Browse
- [ ] **Homepage tidak ada section berdasarkan type** (Manhwa populer, Manhua populer, dsb.)
- [ ] **Homepage tidak ada section "Sering Dibaca"** (trending / most viewed)
- [ ] **Jadikan PWA** (Progressive Web App) — installable, offline-capable

---

## Audit UI/UX Expert — Temuan Lengkap

### A. Navigasi

- [ ] **A1** — Inkonsistensi nav: Browse/Bookmark/History pakai teks, Search pakai icon saja
- [ ] **A2** — Tidak ada indikator halaman aktif (active state) di nav
- [ ] **A3** — Tidak ada badge count di Bookmark / History
- [ ] **A4** — Tidak ada bottom navigation bar untuk mobile
- [ ] **A5** — Search icon tidak punya label teks (accessibility)

### B. Homepage

- [ ] **B1** — Hero Carousel auto-play tanpa pause on hover
- [ ] **B2** — Carousel tidak ada tombol prev/next arrow
- [ ] **B3** — Dot indicator carousel terlalu kecil (1.5px, jauh di bawah 44px touch target)
- [ ] **B4** — Carousel tidak menampilkan genre, rating, atau sinopsis
- [ ] **B5** — "Latest Update" — scroll horizontal tersembunyi, tidak ada visual cue / tombol "See All"
- [ ] **B6** — "New Arrivals" tidak ada tombol "See All"
- [ ] **B7** — Tidak ada section **"Continue Reading"** — fitur killer untuk engagement
- [ ] **B8** — Tidak ada section **"Popular Manhwa"** khusus type Manhwa
- [ ] **B9** — Tidak ada section **"Popular Manhua"** khusus type Manhua
- [ ] **B10** — Tidak ada section **"Most Read"** / trending berdasarkan views

### C. MangaCard

- [ ] **C1** — Tidak ada indikator bookmark di card (user tidak tahu mana yang sudah di-bookmark)
- [ ] **C2** — Tidak ada reading progress indicator di card
- [ ] **C3** — Text sangat kecil (`text-[10px]`) — tidak terbaca di mobile
- [ ] **C4** — Hover overlay hanya blacken, tidak ada CTA atau info tambahan
- [ ] **C5** — Tidak ada timestamp "updated X ago" yang informatif
- [ ] **C6** — Tidak ada badge "NEW" untuk manga yang baru diupdate

### D. Manga Detail Page

- [ ] **D1** — Deskripsi `line-clamp-4` tanpa tombol "Show More" — user tidak bisa baca sinopsis penuh
- [ ] **D2** — Daftar chapter tidak ada search/filter — menyiksa untuk manga 500+ chapter
- [ ] **D3** — Tidak ada penanda chapter mana yang sudah dibaca ("last read")
- [ ] **D4** — Author tidak bisa diklik untuk cari manga lain dari author yang sama
- [ ] **D5** — Rating menggunakan emoji ⭐ — inkonsisten dengan design system
- [ ] **D6** — Tidak ada section "Related Manga" — dead end setelah baca
- [ ] **D7** — Tombol "Start Reading" vs "Latest Chapter" kurang jelas hierarkinya
- [ ] **D8** — Tidak ada tombol Share

### E. Chapter Reader

- [ ] **E1** — Tidak ada progress bar (0%–100%) di atas
- [ ] **E2** — Tap zones single-page mode invisible — tidak ada visual affordance sama sekali
- [ ] **E3** — Tidak ada swipe gesture support (hanya tap zone + keyboard)
- [ ] **E4** — Tidak ada tombol "Back to Top" di strip mode
- [ ] **E5** — Mode toggle menggunakan emoji (📄📜) — inkonsisten dengan ikon SVG lainnya
- [ ] **E6** — Tidak ada brightness/zoom controls
- [ ] **E7** — Tidak ada RTL mode (untuk manga Jepang yang dibaca kanan ke kiri)
- [ ] **E8** — Floating bottom nav bisa overlap konten di device tertentu
- [ ] **E9** — Tidak ada panel settings reader (background, ukuran, dll.)

### F. Search

- [ ] **F1** — Search hanya prefix match (`nameLow` range query) — tidak bisa fuzzy/contains  
  **Root cause:** Firestore hanya support prefix, bukan full-text. Solusi: client-side fuzzy setelah ambil semua kandidat, atau Algolia/Typesense.
- [ ] **F2** — Hard limit `results.slice(0, 8)` — hanya 8 hasil, tidak ada load more
- [ ] **F3** — Tidak ada filter di search (by type, genre, status)
- [ ] **F4** — Tidak ada autocomplete / suggestions
- [ ] **F5** — Empty state tidak ada CTA / suggested searches
- [ ] **F6** — Search `endAt` value salah (q + '' bukan q + '') — prefix tidak bekerja optimal

### G. Browse / List Page

- [ ] **G1** — Filter genre sangat lambat karena tidak ada `orderBy` (Firestore limitation)  
  **Root cause:** Genre filter + orderBy butuh composite index. Saat ini query tanpa sort.
- [ ] **G2** — Tidak ada sort by **Rating** (field `rate`)
- [ ] **G3** — Tidak ada filter by **Type** (Manga / Manhwa / Manhua)
- [ ] **G4** — "Load More" adalah link navigasi — user kehilangan scroll position
- [ ] **G5** — Tidak ada total count hasil
- [ ] **G6** — Sort dan genre hanya bisa salah satu, tidak bisa kombinasi

### H. Bookmark Page

- [ ] **H1** — Tombol hapus hanya muncul saat hover — tidak accessible di mobile (touch)
- [ ] **H2** — Tidak ada sort bookmark (by name, last updated, type)
- [ ] **H3** — Tidak ada "Continue Reading" shortcut di bookmark card
- [ ] **H4** — Tidak ada counter ("23 Bookmarks")
- [ ] **H5** — Tidak ada search dalam bookmark

### I. History Page

- [ ] **I1** — Tidak bisa hapus satu entry — hanya "Clear All" yang destruktif
- [ ] **I2** — Tidak ada link ke manga detail, hanya langsung ke chapter
- [ ] **I3** — Tidak ada grouping by date (Hari ini / Kemarin / Minggu lalu)
- [ ] **I4** — Tidak ada counter

### J. Loading States & Performance

- [ ] **J1** — Bookmark dan History return `null` saat loading — blank flash
- [ ] **J2** — Tidak ada skeleton screen di mana pun
- [ ] **J3** — Tidak ada loading indicator saat gambar chapter load
- [ ] **J4** — Search tidak ada loading state yang baik

### K. Empty States

- [ ] **K1** — Bookmark kosong: tidak ada ilustrasi, tidak ada link ke Browse
- [ ] **K2** — History kosong: tidak ada ilustrasi, tidak ada link ke start reading
- [ ] **K3** — Search empty: tidak ada suggested queries

### L. Aksesibilitas

- [ ] **L1** — Dot carousel touch target terlalu kecil (minimum 44×44px)
- [ ] **L2** — Tap zones reader tidak ada visual hint
- [ ] **L3** — Tidak ada skip-to-content link
- [ ] **L4** — Beberapa `text-muted` kemungkinan kurang kontras

### M. PWA & Discoverability

- [ ] **M1** — Jadikan PWA (manifest.json, service worker, installable)
- [ ] **M2** — Offline reading support (cache chapter yang sudah dibaca)
- [ ] **M3** — Push notification untuk chapter baru di manga yang di-bookmark
- [ ] **M4** — Meta tags Open Graph lengkap (share ke sosmed tampil bagus)
- [ ] **M5** — Sitemap.xml untuk SEO
- [ ] **M6** — Schema.org structured data untuk manga
- [ ] **M7** — "Add to Home Screen" prompt yang smart

---

## Strategi Agar Mikomi Jadi Tempat Baca Favorit

### Engagement & Retention
- **"Continue Reading"** di homepage — satu klik langsung lanjut baca
- **Reading streak** — "Kamu sudah baca X hari berturut-turut"
- **Chapter baru** badge di bookmark — "3 manga kamu ada update baru"
- **Rekomendasi personal** berdasarkan history baca

### Discovery
- **Search yang cerdas** — fuzzy, toleran typo, bisa cari by author/genre
- **"Readers Also Like"** di detail page
- **Section by type** di homepage (Manhwa, Manhua, Manga)
- **Trending hari ini** berdasarkan views real-time

### Trust & Polish
- **Loading states yang smooth** (skeleton screens)
- **PWA** — bisa diinstall di HP, terasa seperti app native
- **Offline reading** — bisa baca meski sinyal jelek
- **Dark mode yang nyaman** — eye strain reduction saat malam

---

## Urutan Implementasi (Priority Order)

### Phase 1 — Core Fixes (Kritis, langsung terasa)
1. [x] Buat dokumen roadmap ini
2. [x] **F1/F2/F3** — Overhaul search: fuzzy multi-word search + filter type + 24 hasil + loading state + result count
3. [x] **G1/G2/G3** — Browse: tambah filter Type (Manhwa/Manhua/Manga), sort Top Rated, count hasil
4. [x] **B7/B8/B9/B10** — Homepage: tambah section Continue Reading (localStorage), Popular Manhwa, Popular Manhua + "See All" links
5. [x] **E1/E2** — Reader: progress bar scroll-based (strip) + page-based (single) + visible tap zone chevrons
6. [x] **M1** — PWA: manifest.json + service worker + layout metadata + themeColor viewport

### Phase 2 — Polish & UX
6. [x] **J1/J2** — Skeleton loading screens (all pages + inline skeletons)
7. [x] **D1/D3** — Detail page: expand description + last read indicator
8. [x] **H1/H3/H4** — Bookmark: hapus per item (always visible) + continue reading shortcut
9. [x] **I1/I2/I3/I4** — History: hapus individual + link ke detail + grouping by date + count
10. [x] **B1/B2/B3** — Carousel: pause on hover + arrow buttons + bigger dots (8px)

### Phase 3 — Nav, SEO & Discoverability
11. [x] **A2** — Nav: active state indicator (underline + accent color)
12. [x] **A3** — Nav: bookmark count badge (desktop + mobile)
13. [x] **A4** — Mobile bottom navigation (Home/Browse/Search/Saved/History)
14. [x] **D6** — Related manga section ("You May Also Like" with genre filter)
15. [x] **M4** — Per-manga Open Graph + Twitter card metadata (generateMetadata)
16. [x] **M5** — Sitemap.xml untuk static routes
17. [x] **F4/F5** — Search: recent searches stored + displayed when no query
18. [x] **J4** — Search loading skeleton

### Phase 4 — Remaining
19. [x] **M2** — Offline chapter reading: SW caches images on visit, serves from cache offline
20. [x] **L3** — Accessibility: skip-to-content link
21. [x] **C1/C2** — MangaCard: bookmark indicator overlay + reading progress bar
22. [ ] **E7** — RTL reading mode untuk manga Jepang (skipped)
23. [x] **H2/H5** — Bookmark: sort (date/name/type) + search dalam bookmark
24. [x] **G4** — Load More tanpa kehilangan scroll position (server action + client accumulation)

### Phase 5 — Extra Polish
25. [x] **Search Fuse.js** — Fuzzy typo-tolerant search on top 200 popular manga (threshold 0.35)
26. [x] **error.tsx / not-found.tsx** — Global error boundary + custom 404 page
27. [x] **Chapter image placeholders** — Skeleton pulse while each page loads (strip + single mode)
28. [x] **Reading stats** — Weekly chapter count + series count in History page
29. [ ] **M3** — Push notifications (skipped — requires backend)

---

## Catatan Teknis Penting

### Search Fix
Firestore tidak support full-text search. Opsi:
- **Client-side fuzzy**: Ambil ~200 dokumen dengan nama terurut, filter pakai `fuse.js` di sisi client. Cocok untuk koleksi kecil-menengah.
- **Algolia/Typesense**: Solusi terbaik untuk skala besar, tapi butuh setup external.
- **Rekomendasi**: Mulai dengan client-side fuzzy (Fuse.js), upgrade ke Algolia nanti.

### Browse Genre Performance
Genre filter saat ini tidak ada `orderBy` (karena Firestore butuh composite index untuk `genre ARRAY_CONTAINS + orderBy`). Solusi:
- Tambah composite index di Firestore untuk `genre + UpdateAt`
- Atau sort client-side setelah fetch (acceptable untuk 100 dokumen)

### Type Filter
Field `type` ada di semua dokumen. Bisa tambah filter `type == 'Manhwa'` di query Firestore tanpa composite index baru (combined dengan genre membutuhkan index).

### Homepage Sections by Type
Cukup tambah method baru di provider: `getPopularByType(type: string)` yang query `type == type` + order by `views DESC`.

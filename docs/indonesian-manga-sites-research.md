# Riset Situs Manga Indonesia — Perbandingan & Sumber

> Dibuat: 28 Juni 2026  
> Konteks: Mencari pengganti MangaDex untuk Mikomi karena DMCA massal Mei 2025 (700+ seri dihapus termasuk Solo Leveling, My Dress-Up Darling, JJK)

---

## Kenapa MangaDex Kena DMCA tapi Situs Indo Tidak?

MangaDex berbasis di Belanda tapi mudah dilacak & diakses oleh agen anti-bajakan AS (perusahaan **Comeso**). Karena MangaDex patuh hukum, mereka merespons DMCA takedown. Situs Indonesia beroperasi dari yurisdiksi yang tidak terikat hukum DMCA AS, sering berganti domain, dan penerbit tidak mengejar secara hukum karena kerumitan jurisdiksi lintas negara.

---

## Semua Situs yang Diteliti

### ✅ BISA DIAKSES — API Terbuka

---

#### 1. Kiryuu (`v6.kiryuu.to`) — 🏆 TERBAIK

| Atribut | Detail |
|---------|--------|
| **URL Aktif** | `https://v6.kiryuu.to` (redirect dari `kiryuu.to`, `v5.kiryuu.to`, `v4.kiryuu.to`) |
| **Framework** | WordPress + Madara Theme |
| **API** | WP REST API — `https://v6.kiryuu.to/wp-json/wp/v2/` |
| **Total Manga** | 8,794 |
| **Total Chapters** | 446,821 |
| **Autentikasi** | ❌ Tidak diperlukan (open API) |
| **Cloudflare** | ✅ Bypass dari server (server-side fetch berhasil) |
| **Update Terakhir** | Hari ini (One Piece ch 1186, Juni 2026) |

**Konten Unggulan:**
| Judul | Slug | Chapters | Status |
|-------|------|----------|--------|
| One Piece | `one-piece` | **1,350** (sampai ch 1186) | ✅ Ada |
| Naruto | `naruto` | **700** (tamat) | ✅ Ada |
| Hunter x Hunter | `hunter-x-hunter` | Ratusan | ✅ Ada |
| Solo Leveling | - | - | ❌ Tidak ada (DMCA Kakao) |
| Solo Leveling: Ragnarok | `solo-leveling-ragnarok` | Ada | ✅ Spin-off ada |

**Struktur API:**
```
GET /wp-json/wp/v2/manga
  ?per_page=12
  &orderby=modified&order=desc
  &manga-type=8679          ← filter Manhwa (ID: 8679 = Manhwa, 8683 = Manga, 8687 = Manhua)
  &_embed=wp:featuredmedia,wp:term

GET /wp-json/wp/v2/chapter
  ?search=one+piece         ← cari chapter berdasarkan judul manga
  &per_page=100&page=1
  &orderby=date&order=asc
  &_fields=id,slug,date

GET /wp-json/wp/v2/chapter
  ?slug=one-piece-chapter-1162
  &_fields=content           ← gambar ada di content.rendered sebagai <img> tags
```

**Taksonomi Manga:**
- `wp:term` group taxonomy: `status`, `type`, `genre`, `series-author`, `artist`
- Status IDs: Ongoing=8684, Completed=lainnya
- Type IDs: **Manga=8683**, **Manhwa=8679**, **Manhua=8687**

**Metadata Extra** (dari field `metadata.meta`):
- `released` → tahun terbit (e.g., "1997" untuk One Piece)
- `score` → rating (e.g., "9" untuk One Piece, "7.7" untuk Naruto)
- `alternative_title` → judul alternatif (Jepang, Arab, dll.)

**CDN Gambar:**
- Cover: `https://v6.kiryuu.to/wp-content/uploads/...` → HTTP 200 ✅
- Chapter baru: `https://cdn.uqni.net/images/...` → HTTP 200 ✅
- Chapter lama: `https://yuucdn.com/wp-content/uploads/imgsc/...` → HTTP 200 ✅

**Format Chapter Slug:** `{manga-slug}-chapter-{N}` (e.g., `one-piece-chapter-1186`)

**Cara Ambil Gambar Chapter:**
```
GET /wp-json/wp/v2/chapter?slug=one-piece-chapter-1162&_fields=content
→ parse <img src="..."> dari content.rendered
→ setiap chapter berisi 15-55 gambar tergantung panjang
```

---

#### 2. komikindo.ch — 🥈 Runner-Up

| Atribut | Detail |
|---------|--------|
| **URL Aktif** | `https://komikindo.ch` |
| **Framework** | WordPress (custom theme) |
| **API** | WP REST API + custom `/apk/v2/` dan `/kontolayam/` |
| **Total Manga** | 8,846 |
| **Total Chapters** | Unknown (chapters stored as WP `posts`, bukan custom post type) |
| **Autentikasi** | Partial — `/kontolayam/listchapter` butuh token, tapi `/apk/v2/chapter/{id}` open |
| **Cloudflare** | ✅ Bisa diakses dari server |
| **Update Terakhir** | Hari ini (sangat aktif) |

**Konten Unggulan:**
| Judul | Status |
|-------|--------|
| One Piece | ❌ **Tidak ada** (hanya spin-off: Ace Story, Log Book) |
| Naruto | ❌ **Tidak ada** |
| Hunter x Hunter | ❌ **Tidak ada** |
| Solo Leveling | ❌ Hanya Ragnarok & ARISE |
| Manhwa baru (2024-2026) | ✅ Lengkap dan up-to-date |

**Custom API Endpoints:**
```
GET /wp-json/apk/v2/chapter/{post_id}
→ Returns: { title, prev, thumb, chapter, image: [...] }
→ image[] berisi URL CDN langsung — BISA diakses (HTTP 200)

GET /wp-json/kontolayam/listchapter?id={manga_id}
→ Error: "token_invalid" — butuh autentikasi

GET /wp-json/kontolayam/latestchapter
→ Returns [] — endpoint kosong/deprecated
```

**Cara Dapat Chapter:**
1. Cari chapter by slug via WP posts: `GET /wp-json/wp/v2/posts?slug={chapter-slug}&_fields=id`
2. Ambil gambar via: `GET /wp-json/apk/v2/chapter/{post_id}`

**CDN Gambar Chapter:**
- Domain berputar: `imageainewgeneration.lol`, `himmga.lat`, `gaimgame.pics`, `indocontentaising.lol`, `aicontentwow.lol`, `contentkerewnrorai.lat`
- ⚠️ Domain `.lol` dan `.lat` sangat tidak stabil — bisa hilang kapan saja

**Sumber Konten:** Agak mirip Kiryuu dari sisi jumlah manga. Fokus ke manhwa/webtoon baru, tidak ada classic completed manga.

---

#### 3. komiku.org (bukan komiku.id) — Terbatas

| Atribut | Detail |
|---------|--------|
| **URL Aktif** | `https://komiku.org` (komiku.id redirect ke sini) |
| **Framework** | WordPress (bukan Madara, custom theme) |
| **API** | WP REST API tapi tanpa `/chapter` endpoint |
| **Total Manga** | ~500K+ posts (chapters stored as posts) |
| **Autentikasi** | ❌ Tidak diperlukan |
| **One Piece** | ❌ Tidak ada |

**Catatan:** Chapters stored sebagai WP `posts` biasa. Tidak ada custom `manga` post type untuk API manga. Site name di API = "komikid" (beda dari domain).

---

### ❌ TIDAK BISA DIAKSES — Cloudflare / Down

| Situs | Status | Alasan |
|-------|--------|--------|
| `shinigami.id` | ❌ Timeout | Cloudflare bot protection ketat, tidak bisa diakses server-side |
| `komikid.org` | ❌ 403 Blocked | Cloudflare "You have been blocked" |
| `komikindo.web.id` | ❌ 523 | Server mati (Origin connection error) |
| `nekomik.com` | ❌ Timeout/CF | Cloudflare JS challenge |
| `manhwaid.com` | ❌ Timeout | Tidak bisa diakses |
| `mangamint.kaedenoki.net` | ❌ CF challenge | Cloudflare JS challenge — mengembalikan HTML bukan JSON |
| `komiku-api.fly.dev` | ❌ DNS error | Domain sumber `data.komiku.id` tidak ada DNS |
| `komikcast-api-six.vercel.app` | ❌ Non-JSON | Server down/mengembalikan bukan JSON |
| `manhwa18.net` | ❌ CF | Cloudflare protection |
| `mangatale.id` | ❌ 523 | Server mati |
| `shinigami.id` | ❌ Timeout | CF protection kuat |
| `sektekomik.com` | ❌ Timeout | Tidak accessible |
| `mangakyun.id` | ❌ Timeout | Tidak accessible |
| `klikmanga.net` | ❌ Timeout | Tidak accessible |

---

### ⚠️ BISA DIAKSES tapi Tidak Berguna

| Situs | Status | Masalah |
|-------|--------|---------|
| `bacamanga.id` | ✅ HTTP 200 | WP API ada tapi tidak ada `/manga` endpoint — tidak ada konten manga |
| `mangaku.org` | ✅ HTTP 200 | WP API ada tapi tidak ada `/manga` route |
| `komikstation.co` | ⚠️ 429 (rate limit) | Rate limited |
| `manhwa68.com` | ❌ 403 | CF blocked |
| `mangaraw.org` | ❌ 403 | CF blocked |
| `kiryuuid.net` | ✅ HTTP 200 | Return HTML bukan JSON — bukan WP |
| `mangakyo.id` | ⚠️ 415 | Content type error |

---

### 🔍 AGGREGATOR (bukan source langsung)

#### keikomik.com

| Atribut | Detail |
|---------|--------|
| **URL** | `https://keikomik.com` |
| **Framework** | **Qwik** (bukan WordPress) — custom web app |
| **API** | ❌ Tidak ada public API |
| **Sumber Konten** | Aggregator dari multiple sites |

**Sumber yang digunakan keikomik.com:**
1. **Shinigami ID** (`storage.shngm.id`) — thumbnail images dari Shinigami
2. **Komikindo** (`komikindo.ch`) — beberapa konten diproxy
3. **S3-compatible storage** (`s1.imgkomik.xyz`) — storage mereka sendiri dengan AWS presigned URLs
4. **ImgBB** (`i.ibb.co.com`) — upload gambar publik

**CDN mereka:** `cdn.imgkomik.xyz`, `cdn3.imgkomik.xyz`, `s1.imgkomik.xyz`

**Cara kerja:** Server-side render Qwik + mengambil data dari beberapa sumber. Tidak ada API publik yang bisa kita konsumsi langsung.

**Keywords meta mereka:** `komikindo, komikcast, komikav, kiryuu, shinigami, sektekomik` — mengakui mereka mengambil dari site-site ini.

---

## Pola Umum: Ekosistem yang Sama

Hampir semua situs manga Indonesia **berbagi infrastruktur CDN yang sama**:
- `yuucdn.com` dan `cdn.uqni.net` dipakai Kiryuu
- `storage.shngm.id` dipakai Shinigami (dan diproxy ke keikomik)
- Kebanyakan pakai **Madara WordPress theme** yang sama
- Chapter images sering sharing format path yang identik

Ini berarti banyak situs ini kemungkinan besar mengambil dari **sumber raw scan yang sama** dan mengunggahnya ke CDN masing-masing.

---

## Perbandingan Final

| Kriteria | Kiryuu | komikindo.ch | keikomik.com | Lainnya |
|----------|--------|--------------|--------------|---------|
| **Total Manga** | 8,794 | 8,846 | Aggregator | Down/CF |
| **Total Chapters** | 446,821 | Unknown | Aggregator | — |
| **One Piece** | ✅ 1,350 ch | ❌ | ❌ | ❌ |
| **Naruto** | ✅ 700 ch | ❌ | ❌ | ❌ |
| **Hunter x Hunter** | ✅ Ada | ❌ | ❌ | ❌ |
| **Solo Leveling** | ❌ (DMCA) | ❌ (DMCA) | ❌ | ❌ |
| **API Terbuka** | ✅ WP REST | ⚠️ Partial | ❌ | — |
| **Chapter List** | ✅ Tanpa auth | ❌ Butuh token | ❌ | — |
| **CDN Stabil** | ✅ yuucdn/uqni | ❌ .lol/.lat | ❌ Presigned S3 | — |
| **Cloudflare** | ✅ Bypass | ✅ Bypass | ✅ | ❌ kebanyakan |
| **Update Aktif** | ✅ Harian | ✅ Harian | ✅ | — |
| **Implementasi** | ⭐ Mudah | ⚠️ Kompleks | ❌ Tidak bisa | — |

---

## Rekomendasi: Kiryuu

**Alasan memilih Kiryuu:**
1. **Konten terlengkap untuk classic manga** — satu-satunya dengan One Piece, Naruto, HxH
2. **API paling terbuka** — WP REST API lengkap, tanpa autentikasi, tanpa token
3. **CDN stabil** — `yuucdn.com` dan `cdn.uqni.net` sudah lama aktif dan reliable
4. **Volume sama** — 8794 vs 8846 manga, hampir identik dengan komikindo.ch
5. **Mudah diimplementasi** — chapter images di `content.rendered`, format slug konsisten

**Keterbatasan:**
- Solo Leveling main tidak tersedia (DMCA Kakao — sama di semua platform Indonesia)
- Konten bahasa Indonesia (bukan English sub)

---

## Catatan Teknis untuk Implementasi

### Kiryuu WP REST API Quick Reference

```typescript
const BASE = 'https://v6.kiryuu.to/wp-json/wp/v2'

// Type IDs
const TYPES = { Manga: 8683, Manhwa: 8679, Manhua: 8687 }

// List manga terbaru
GET ${BASE}/manga?per_page=12&orderby=modified&order=desc&_embed=wp:featuredmedia,wp:term

// Filter per type
GET ${BASE}/manga?manga-type=8679&per_page=12&orderby=modified&order=desc&_embed=...

// Search manga
GET ${BASE}/manga?search=naruto&per_page=10&_embed=...

// Detail manga
GET ${BASE}/manga?slug=one-piece&_embed=wp:featuredmedia,wp:term

// List chapters (semua chapter untuk manga tertentu)
GET ${BASE}/chapter?search=one+piece&per_page=100&page=1&orderby=date&order=asc&_fields=id,slug,date

// Gambar chapter
GET ${BASE}/chapter?slug=one-piece-chapter-1186&_fields=content
→ parse: /<img[^>]+src=["']([^"']+)["']/gi dari content.rendered
```

### Response Struktur

```typescript
// Manga dari _embedded
{
  id: number,
  slug: string,
  title: { rendered: string },        // nama manga
  modified: string,                   // ISO timestamp update
  excerpt: { rendered: string },      // deskripsi (HTML, perlu di-strip)
  metadata: {
    meta: {
      released: string,               // tahun terbit ("1997")
      score: string,                  // rating ("9")
      alternative_title: string       // judul alternatif
    }
  },
  _embedded: {
    'wp:featuredmedia': [{ source_url: string }],  // cover image URL
    'wp:term': [
      [{ taxonomy: 'status', name: 'Ongoing'|'Completed' }],
      [{ taxonomy: 'type', name: 'Manga'|'Manhwa'|'Manhua' }],
      [{ taxonomy: 'genre', name: string }[], ...],
      [{ taxonomy: 'series-author', name: string }],
      [{ taxonomy: 'artist', name: string }]
    ]
  }
}
```

# Product Requirements Document
# QC Market Quality Tracker — Web Application

**Version:** 1.2.0  
**Tanggal:** Juni 2025  
**Stack:** Nuxt 4 · Nuxt UI · SQLite · Drizzle ORM · TypeScript  
**Dibuat untuk:** QRCC — Market Quality Monitoring

---

## 1. Latar Belakang & Tujuan

### 1.1 Masalah Saat Ini
Tim QRCC yang bertugas memantau kualitas produk elektronik di pasar (*after-market*) saat ini mengelola data secara terpisah di banyak file Excel. Akibatnya:

- Data claim, sample, dan hasil analisa PQA tersebar dan sulit ditelusuri
- Tidak ada satu sumber kebenaran (*single source of truth*)
- Pembuatan laporan bulanan memakan waktu lama karena harus mengumpulkan data dari banyak file
- Tidak ada visibilitas status secara *real-time* untuk semua pihak terkait

### 1.2 Tujuan Produk
Membangun web application terpusat yang menggantikan sistem Excel, memungkinkan seluruh alur kerja QC — dari pencatatan claim, pengiriman sample ke PQA, penerimaan hasil analisa, hingga pembuatan laporan bulanan — dilakukan dalam satu platform yang terintegrasi.

### 1.3 Sasaran Pengguna
| Peran | Deskripsi |
|---|---|
| **QRCC** | Pengguna utama. Mengelola seluruh data claim, sample, dan laporan |
| **PQA (Product Quality Assurance)** | Menerima dan mengisi hasil analisa sample, update jurnal harian atau progress |
| **Manager / Supervisor** | Memantau dashboard dan laporan bulanan |

---

## 2. Ruang Lingkup (Scope)

### 2.1 Dalam Scope (MVP)
- ✅ Manajemen Market Quality Claims (CRUD)
- ✅ Manajemen Sample Defect Log
- ✅ Manajemen PQA Summary & Improvement
- ✅ Template & pembuatan Ringkasan per item Claims
- ✅ Dashboard KPI & statistik
- ✅ Filter, pencarian, dan sorting data
- ✅ Export data ke Excel / CSV
- ✅ Export ringkasan per item claims ke PDF
- ✅ Autentikasi dasar (login/logout)
- ✅ Manajemen pengguna sederhana
- ✅ Upload foto/dokumen attachment

### 2.2 Luar Scope (Future Release)
- ❌ Notifikasi email otomatis
- ❌ Integrasi ERP / sistem produksi
- ❌ Mobile app native
- ❌ Multi-bahasa (i18n)

---

## 3. Fitur & Kebutuhan Fungsional

### 3.1 Modul: Dashboard
**FR-01** — Dashboard menampilkan KPI utama secara real-time:
- Total claim (all-time & bulan berjalan)
- Jumlah per status: Open, On Progress, Waiting PQA, Closed
- Jumlah sample terkirim & selesai dianalisa
- Jumlah improvement yang sudah diimplementasi

**FR-02** — Grafik tren bulanan: jumlah claim masuk vs closed per bulan (12 bulan terakhir)

**FR-03** — Grafik distribusi defect: top 5 jenis defect berdasarkan frekuensi

**FR-04** — Tabel "Claim Terbaru" — 10 claim terbaru dengan status dan aksi cepat

**FR-05** — Filter dashboard by: rentang tanggal, produk, model

---

### 3.2 Modul: Claims Log
**FR-06** — Tambah claim baru dengan form:
- Claim ID (auto-generate format `CLM-YYYY-NNN`)
- Tanggal masuk (date picker)
- Produk & Model/SKU (dropdown dari master data)
- Jenis defect (dropdown dari master data)
- Deskripsi masalah (textarea)
- Sumber claim: Distributor / CS / Online Review / Lainnya
- Status awal: Open
- Upload foto/dokumen pendukung (attachment)

**FR-07** — Tabel daftar claim dengan kolom: Claim ID, Tanggal, Produk, Model, Jenis Defect, Status, Aksi

**FR-08** — Filter claim: status, produk, bulan/tahun, jenis defect, sumber

**FR-09** — Pencarian full-text berdasarkan Claim ID atau deskripsi

**FR-10** — Edit dan hapus claim (dengan konfirmasi)

**FR-11** — Detail halaman per claim menampilkan:
- Semua field claim beserta attachment
- Sample terkait (jika ada)
- Hasil analisa PQA (jika ada)
- Timeline/riwayat perubahan status

**FR-12** — Ubah status claim dengan satu klik dari tabel (quick action)

**FR-13** — Generate & export ringkasan per item claim ke PDF (satu halaman per claim, memuat semua informasi terkait termasuk sample dan hasil PQA)

---

### 3.3 Modul: Sample Log
**FR-14** — Tambah sample baru dengan form:
- Sample ID (auto-generate format `SMP-NNN`)
- Referensi Claim ID (pilih dari claim yang ada)
- Produk & Model (otomatis terisi dari claim)
- Daftar part sample: satu sample log bisa memuat **lebih dari 1 jenis part** (nama part, jumlah unit per part)
- Nama penerima sample di PQA (field wajib)
- Tanggal kirim ke PQA
- Status: Menunggu Kirim / Terkirim / On Progress / Selesai / Cancelled
- Upload foto/dokumen kondisi sample (attachment)
- Catatan

**FR-15** — Tabel daftar sample dengan filter status dan pencarian

**FR-16** — Update status sample dan isi hasil analisa langsung dari tabel

**FR-17** — Notifikasi visual (badge) jika ada sample yang sudah >7 hari belum ada update

---

### 3.4 Modul: PQA Summary
**FR-18** — Tambah summary hasil analisa dengan form:
- Referensi Claim ID & Sample ID
- Produk & Model
- Jenis defect
- Root Cause (textarea)
- Improvement / Rekomendasi (textarea)
- Status implementasi: Menunggu / Implementasi / Selesai / Ditolak
- Status share ke CS: Ya / Belum / Tidak Perlu
- Tanggal di-share ke CS
- Upload dokumen laporan analisa dari PQA (attachment)
- Catatan

**FR-19** — Tabel daftar summary dengan filter dan pencarian

**FR-20** — Tombol "Mark as Shared to CS" yang mengisi tanggal otomatis

**FR-21** — Detail view PQA summary yang bisa dicetak / diekspor sebagai PDF satu halaman

---

### 3.5 Modul: Ringkasan per Item Claims (Claim Summary Report)
**FR-22** — Generate ringkasan lengkap untuk satu claim tertentu, mencakup:
- Header informasi claim (Claim ID, tanggal, produk, model, sumber, jenis defect, deskripsi)
- Detail sample yang dikirim (daftar part, jumlah, penerima, tanggal)
- Hasil analisa PQA (root cause, rekomendasi, status implementasi)
- Status share ke CS
- Riwayat perubahan status claim

**FR-23** — Export ringkasan per item claim ke format PDF, siap cetak dan dibagikan

**FR-24** — Ringkasan tersedia langsung dari halaman detail claim (tombol "Export PDF")

---

### 3.6 Modul: Laporan Bulanan
**FR-25** — Pilih periode (bulan & tahun) untuk generate laporan

**FR-26** — Laporan otomatis mengagregasi data dari Claims Log, Sample Log, PQA Summary

**FR-27** — Konten laporan:
- Ringkasan claim (total, per status, vs bulan lalu)
- Ringkasan sample & analisa PQA
- Top defect & improvement bulan ini
- Section catatan & rencana tindak lanjut (editable)

**FR-28** — Simpan laporan ke database (bisa diedit ulang sebelum finalized)

**FR-29** — Export laporan ke Excel (.xlsx) sesuai format template

**FR-30** — Riwayat laporan bulanan yang sudah dibuat

---

### 3.7 Modul: Master Data
**FR-31** — CRUD Produk (nama produk, kode)

**FR-32** — CRUD Model/SKU (relasi ke produk)

**FR-33** — CRUD Jenis Defect (nama, kategori)

**FR-34** — CRUD Pengguna (nama, email, role)

---

### 3.8 Modul: Autentikasi
**FR-35** — Login dengan email & password

**FR-36** — Session management via Better-auth

**FR-37** — Role-based access: Admin, QRCC, Viewer

**FR-38** — Halaman profil: ganti nama & password

---

## 4. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| **Performa** | Halaman utama load < 2 detik; tabel dengan 1000+ baris tetap responsif |
| **Keamanan** | Password di-hash (bcrypt via Better-auth); session expire setelah 8 jam; input sanitization |
| **Keandalan** | SQLite dengan WAL mode; auto-backup harian ke file lokal |
| **Aksesibilitas** | Bisa diakses via browser modern (Chrome, Firefox, Edge) |
| **Responsivitas** | UI responsif untuk desktop dan tablet (min 768px) |
| **Maintainability** | TypeScript strict mode; komponen modular; Drizzle migration untuk schema |
| **File Storage** | Attachment disimpan lokal di server (`/uploads`); validasi tipe file (jpg, png, pdf, docx) dan ukuran maksimal 10MB per file |

---

## 5. Arsitektur Teknis

### 5.1 Stack Teknologi
```
Frontend    : Nuxt 4 (Vue 3 + Composition API)
UI Library  : Nuxt UI (berbasis Tailwind CSS + Headless UI)
Language    : TypeScript (strict)
Database    : SQLite (file-based, lokal)
ORM         : Drizzle ORM
Server      : Nuxt server routes (Nitro)
Auth        : Better-auth
Export      : xlsx (SheetJS) untuk export Excel
PDF         : pdfmake / puppeteer untuk export PDF ringkasan claim
Storage     : File system lokal (/uploads) untuk attachment
```

### 5.2 Struktur Direktori Proyek
```
qc-tracker/
├── server/
│   ├── api/
│   │   ├── claims/          # GET, POST, PUT, DELETE + export PDF
│   │   ├── samples/
│   │   ├── pqa-summary/
│   │   ├── reports/
│   │   ├── attachments/     # Upload & serve file attachment
│   │   ├── master/          # products, models, defect, users
│   │   └── auth/            # Better-auth handler
│   ├── db/
│   │   ├── schema.ts        # Drizzle schema definitions
│   │   ├── migrations/      # Drizzle migration files
│   │   └── index.ts         # DB connection instance
│   └── utils/
│       ├── id-generator.ts  # CLM-YYYY-NNN, SMP-NNN generator
│       ├── export.ts        # Excel export helpers
│       └── pdf.ts           # PDF generation helpers
├── components/
│   ├── claims/
│   ├── samples/
│   ├── pqa/
│   ├── dashboard/
│   ├── attachments/         # Upload & preview komponen
│   └── shared/
├── pages/
│   ├── index.vue            # Dashboard
│   ├── claims/
│   │   ├── index.vue
│   │   └── [id].vue         # Detail + Export PDF ringkasan
│   ├── samples/index.vue
│   ├── pqa/index.vue
│   ├── reports/
│   │   ├── index.vue
│   │   └── [id].vue
│   ├── master/index.vue
│   └── auth/login.vue
├── composables/
│   ├── useClaims.ts
│   ├── useSamples.ts
│   ├── useAttachments.ts
│   └── useDashboard.ts
├── types/
│   └── index.ts
├── public/
│   └── uploads/             # File attachment tersimpan di sini
├── nuxt.config.ts
├── drizzle.config.ts
└── package.json
```

### 5.3 API Routes
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/claims` | List semua claim (filter, pagination) |
| POST | `/api/claims` | Buat claim baru |
| GET | `/api/claims/:id` | Detail claim |
| PUT | `/api/claims/:id` | Update claim |
| DELETE | `/api/claims/:id` | Hapus claim |
| GET | `/api/claims/:id/export-pdf` | Export ringkasan claim ke PDF |
| GET | `/api/samples` | List sample |
| POST | `/api/samples` | Buat sample baru (dengan daftar part) |
| PUT | `/api/samples/:id` | Update sample |
| GET | `/api/pqa-summary` | List PQA summary |
| POST | `/api/pqa-summary` | Buat summary baru |
| PUT | `/api/pqa-summary/:id` | Update summary |
| GET | `/api/reports` | List laporan |
| POST | `/api/reports/generate` | Generate laporan bulanan |
| GET | `/api/reports/:id/export` | Export laporan ke Excel |
| GET | `/api/dashboard/kpi` | Data KPI dashboard |
| GET | `/api/dashboard/trend` | Data tren bulanan |
| GET | `/api/master/products` | List produk |
| GET | `/api/master/defect` | List jenis defect |
| POST | `/api/attachments/upload` | Upload file attachment |
| GET | `/api/attachments/:id` | Serve/download file attachment |
| DELETE | `/api/attachments/:id` | Hapus attachment |
| ALL | `/api/auth/**` | Better-auth handler |

---

## 6. User Stories

```
US-01  Sebagai QRCC, saya ingin mencatat claim baru dengan cepat
       agar tidak ada issue yang terlewat.

US-02  Sebagai QRCC, saya ingin melihat semua claim yang masih Open
       dalam satu tampilan agar bisa memprioritaskan penanganan.

US-03  Sebagai QRCC, saya ingin mencatat pengiriman sample ke PQA
       dan tracking statusnya, termasuk nama penerima dan beberapa
       jenis part dalam satu pengiriman, agar tahu kapan hasil analisa
       bisa diharapkan dan ada catatan penerima yang jelas.

US-04  Sebagai QRCC, saya ingin menyimpan hasil analisa PQA
       dan menandainya sudah di-share ke CS agar tidak ada yang terlewat.

US-05  Sebagai QRCC, saya ingin generate laporan bulanan otomatis
       agar tidak perlu mengumpulkan data manual dari banyak file.

US-06  Sebagai Manager, saya ingin melihat dashboard KPI secara real-time
       agar bisa memantau kualitas market tanpa perlu minta laporan.

US-07  Sebagai QRCC, saya ingin mencari claim by keyword atau filter
       agar bisa menemukan data historis dengan cepat.

US-08  Sebagai Admin, saya ingin mengelola master data produk dan jenis defect
       agar tim QC tidak perlu mengetik bebas di setiap input.

US-09  Sebagai QRCC, saya ingin generate summary detail per item claims
       dalam format PDF agar bisa langsung dibagikan ke pihak terkait.
```

---

## 7. Alur Kerja Utama (Happy Path)

```
[Claim Masuk]
     │
     ▼
QRCC buat claim baru di Claims Log
(+ upload attachment jika ada)
     │
     ▼
Status: OPEN
     │
     ├─── Perlu sample? ──YES──► Buat Sample Log ──► Isi daftar part + penerima
     │                                                     │
     │                                            Kirim sample ke PQA
     │                                                     │
     │                                              Status: ON PROGRESS
     │                                                     │
     │                                            Hasil analisa diterima
     │                                                     │
     │                                            Isi PQA Summary
     │                                                     │
     │                                            Share ke CS ──► Mark Shared
     │                                                     │
     └─── Tidak perlu ────────────────────────────────────┘
                                                          │
                                                   Update Claim Status
                                                          │
                                                   Status: CLOSED
                                                          │
                                          ┌──────────────┴──────────────┐
                                          │                             │
                                   Export PDF                  Masuk laporan
                                   Ringkasan Claim             bulanan
```

---

## 8. Acceptance Criteria (MVP)

| ID | Kriteria | Priority |
|---|---|---|
| AC-01 | User bisa login & logout dengan aman via Better-auth | Must Have |
| AC-02 | CRUD Claims Log berfungsi penuh dengan validasi | Must Have |
| AC-03 | Auto-generate Claim ID format CLM-YYYY-NNN | Must Have |
| AC-04 | Status claim bisa diubah dengan konfirmasi | Must Have |
| AC-05 | CRUD Sample Log dengan relasi ke claim | Must Have |
| AC-06 | Sample log mendukung lebih dari 1 jenis part per pengiriman | Must Have |
| AC-07 | Field nama penerima sample wajib diisi di Sample Log | Must Have |
| AC-08 | CRUD PQA Summary dengan relasi ke claim & sample | Must Have |
| AC-09 | Dashboard menampilkan KPI real-time | Must Have |
| AC-10 | Filter & pencarian di semua modul utama | Must Have |
| AC-11 | Upload & preview attachment di Claims, Sample, PQA Summary | Must Have |
| AC-12 | Export ringkasan per item claim ke PDF | Must Have |
| AC-13 | Generate laporan bulanan otomatis dari data | Should Have |
| AC-14 | Export laporan ke Excel | Should Have |
| AC-15 | Grafik tren & distribusi defect di dashboard | Should Have |
| AC-16 | Master data produk, model, jenis defect | Should Have |
| AC-17 | Role-based access (Admin, QRCC, Viewer) | Should Have |
| AC-18 | Responsif untuk tablet | Could Have |

---

## 9. Timeline & Milestone (Estimasi)

| Milestone | Deskripsi | Estimasi |
|---|---|---|
| **M1 — Foundation** | Setup project, Better-auth, DB schema, migrations | Week 1 |
| **M2 — Core CRUD** | Claims Log + Sample Log (multi-part) CRUD + API | Week 2 |
| **M3 — PQA & Attachment** | PQA Summary + upload attachment + export PDF ringkasan | Week 3 |
| **M4 — Reports** | Laporan Bulanan generate & export Excel | Week 4 |
| **M5 — Dashboard** | KPI, grafik, filter dashboard | Week 5 |
| **M6 — Polish & Deploy** | Master data, UI polish, testing, UAT, go-live | Week 6 |

---

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| SQLite tidak support concurrent writes tinggi | Medium | Aktifkan WAL mode; jika user >10 concurrent, pertimbangkan migrasi ke PostgreSQL |
| Data lama di Excel sulit dimigrasikan | Medium | Buat script import CSV/Excel ke DB |
| User tidak mau beralih dari Excel | High | Onboarding session + pastikan export Excel & PDF tetap tersedia |
| Storage attachment membengkak | Medium | Validasi ukuran file max 10MB; monitoring disk usage; pertimbangkan cleanup policy |
| Scope creep fitur | Medium | Kunci MVP di M1-M5, fitur baru masuk backlog |

---

## 11. Perubahan Versi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0.0 | Juni 2025 | Dokumen awal |
| 1.1.0 | Juni 2025 | Nuxt 3 → Nuxt 4; Tim QRCC (CS dihapus dari sasaran pengguna); Auth → Better-auth; Upload attachment masuk MVP; Export PDF ringkasan per claim masuk MVP; Sample log mendukung multi-part + field penerima; Laporan bulanan → Ringkasan per item claim; FR & AC diperbarui |
| 1.2.0 | Juni 2025 | Database schema diperbarui: tabel `sample_parts` untuk multi-part sample; tabel `attachments` untuk upload file; diagram ERD diperbarui |

---

*Dokumen ini adalah living document — diperbarui seiring perkembangan development.*

Halo! Rencana implementasi (*Implementation Plan*) yang Anda lampirkan sudah sangat luar biasa, komprehensif, dan memiliki batasan ruang lingkup (*scope*) yang sangat jelas. Struktur seperti ini adalah impian setiap developer dan PM.

Karena Anda sudah memecah proyek ini menjadi 10 fase dengan estimasi total 30 hari kerja, kita bisa mengelompokkan fase-fase tersebut ke dalam **5 Sprint Agile standar** (dengan asumsi 1 Sprint = 1 minggu / 5-7 hari kerja).

Berikut adalah draf file `task-plan.md` yang sudah dikonversi ke standar industri dan siap Anda masukkan ke dalam Jira, Trello, Notion, atau GitHub Projects, serta siap dibaca oleh AI.

---

# task-plan.md

# QC Market Quality Tracker - Agile Task Plan

* **Project:** QC Market Quality Tracker (MVP)
* **Status:** Approved for Development
* **Tech Stack:** Nuxt 4, Nuxt UI, SQLite, Drizzle ORM, Better Auth
* **Total Estimasi:** ~30 Hari Kerja
* **Dokumen Referensi:** `implementation-plan.md`, `frontend.md`, `backend.md`

---

## Sprint 0: Foundation & Core Backend (Estimasi: 5 Hari)

**Fokus:** Setup awal proyek, arsitektur database, dan implementasi autentikasi. *(Mengacu pada Phase 0 & Phase 1)*

* **Epic: Project Foundation**
* **[Task] Setup Nuxt 4 & Dependencies**
* **Deskripsi:** Inisialisasi Nuxt, install Nuxt UI, Drizzle, Better Auth, SQLite, Zod, dan konfigurasi pnpm workspace.
* **Assignee:** Tech Lead / Fullstack
* **Est:** 1 Hari
* **Status:** To Do


* **[Task] Setup Environment & Folder Structure**
* **Deskripsi:** Buat struktur folder sesuai blueprint (`app/`, `server/api/`, `uploads/`, dll) dan file `.env`.
* **Assignee:** Fullstack
* **Est:** 1 Hari
* **Status:** To Do




* **Epic: Database & Authentication**
* **[Task] Implementasi Schema Drizzle (Semua Tabel)**
* **Deskripsi:** Buat schema untuk users, products, claims, samples, pqa, dan reports sesuai urutan di `backend.md`. Generate & run migration.
* **Assignee:** Backend
* **Est:** 1.5 Hari
* **Status:** To Do


* **[Task] Integrasi Better Auth & Seeder**
* **Deskripsi:** Setup Better Auth, endpoint login/logout, session 8 jam, dan buat script seeder (Admin, Products, Defect Types).
* **Assignee:** Backend
* **Est:** 1.5 Hari
* **Status:** To Do





---

## Sprint 1: Master Data & Claims MVP (Estimasi: 7 Hari)

**Fokus:** Menyiapkan data master dan fitur utama pencatatan claim (CRUD). *(Mengacu pada Phase 2 & Phase 3)*

* **Epic: Master Data Module**
* **[Story] CRUD Master Data (API & UI)**
* **Deskripsi:** Backend API dan halaman UI untuk mengelola Products, Models, Defect Types, dan Users. Hak akses khusus Admin.
* **Assignee:** Fullstack
* **Est:** 2 Hari
* **Status:** Backlog




* **Epic: Claims Management**
* **[Task] Backend: API & Service Claims**
* **Deskripsi:** Implementasi `claim.service.ts` (generate ID `CLM-YYYY-NNN`, transaction), validator Zod, dan API endpoints.
* **Assignee:** Backend
* **Est:** 2 Hari
* **Status:** Backlog


* **[Story] Frontend: Halaman List & Detail Claim**
* **Deskripsi:** Buat UI tabel claim dengan pagination/filter dan halaman detail read-only. Integrasi dengan `useClaims.ts`.
* **Assignee:** Frontend
* **Est:** 1.5 Hari
* **Status:** Backlog


* **[Story] Frontend: Form Create & Update Claim**
* **Deskripsi:** Form input dengan validasi Zod untuk menambah dan mengedit claim. Logika perubahan status claim otomatis.
* **Assignee:** Frontend
* **Est:** 1.5 Hari
* **Status:** Backlog





---

## Sprint 2: Samples, PQA, & Attachments (Estimasi: 8 Hari)

**Fokus:** Alur logistik sample, analisa kualitas (PQA), dan sistem unggah file. *(Mengacu pada Phase 4, Phase 5, Phase 6)*

* **Epic: Samples Module**
* **[Story] Pengelolaan Data Sample (API & UI)**
* **Deskripsi:** CRUD Sample dan `sample_parts` (minimal 1 part per sample). Auto-generate ID `SMP-NNN`. Tampilan badge `OVERDUE` di UI.
* **Assignee:** Fullstack
* **Est:** 3 Hari
* **Status:** Backlog




* **Epic: PQA Summary Module**
* **[Story] Catatan Analisa PQA (API & UI)**
* **Deskripsi:** Relasi PQA dengan claim dan sample. Implementasi aksi "Mark as Shared" (isi `cs_shared_at` otomatis).
* **Assignee:** Fullstack
* **Est:** 3 Hari
* **Status:** Backlog




* **Epic: Global Attachments**
* **[Task] Sistem Upload & Download File**
* **Deskripsi:** Endpoint upload file (max 10MB, validasi mime), simpan di `uploads/YYYY/MM/`, polimorfik DB ke claim/sample/pqa. UI komponen file uploader.
* **Assignee:** Fullstack
* **Est:** 2 Hari
* **Status:** Backlog





---

## Sprint 3: Dashboard, Reports & Exports (Estimasi: 7 Hari)

**Fokus:** Visualisasi data, laporan bulanan, dan sistem ekspor dokumen. *(Mengacu pada Phase 7, Phase 8, Phase 9)*

* **Epic: Dashboard & KPI**
* **[Story] Visualisasi Dashboard UI/API**
* **Deskripsi:** Endpoint agregasi data untuk KPI bulanan, tren defect, dan top defect. UI menggunakan chart sederhana (Nuxt UI/eksternal).
* **Assignee:** Fullstack
* **Est:** 2 Hari
* **Status:** Backlog




* **Epic: Reporting & Excel Export**
* **[Story] Monthly Reports Module**
* **Deskripsi:** Generate laporan bulanan, unique per (year, month). Logika `is_finalized` (readonly). Implementasi ekspor SheetJS (xlsx).
* **Assignee:** Fullstack
* **Est:** 3 Hari
* **Status:** Backlog




* **Epic: PDF Document Export**
* **[Task] Claim Summary PDF menggunakan Puppeteer**
* **Deskripsi:** Setup Puppeteer render HTML to PDF dari halaman detail claim untuk format standar perusahaan.
* **Assignee:** Backend
* **Est:** 2 Hari
* **Status:** Backlog
---

## Sprint 4: QA, Testing, & Go-Live (Estimasi: 3 Hari)

**Fokus:** Stabilitas, perbaikan bug, dan rilis MVP ke environment lokal perusahaan. *(Mengacu pada Phase 10)*

* **Epic: Quality Assurance (QA) & UAT**
* **[Task] Unit & Integration Testing (Vitest)**
* **Deskripsi:** Pastikan test coverage minimal 70% untuk Service (terutama Claim, Sample, PQA) dan Validator.
* **Assignee:** Backend
* **Est:** 1 Hari
* **Status:** Backlog


* **[Task] E2E Testing (Playwright) & Bug Fixing**
* **Deskripsi:** Jalankan 6 Critical User Journeys (Login hingga Ekspor PDF). Perbaiki bug temuan selama simulasi.
* **Assignee:** Fullstack
* **Est:** 1 Hari
* **Status:** Backlog


* **[Story] UAT & Production Build**
* **Deskripsi:** Build aplikasi lokal (`pnpm build`), setup cron job untuk Backup SQLite, dan testing langsung bersama tim QRCC.
* **Assignee:** Tech Lead
* **Est:** 1 Hari
* **Status:** Backlog
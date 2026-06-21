# Task Plan: Pengembangan Core Module "Claims"
* **Status:** Draft / Ready for Development
* **Epic:** Sistem Manajemen Claims Terpusat (QC Market Quality Tracker)
* **Tech Stack:** Nuxt 4, Nuxt UI, SQLite, Drizzle ORM, Better Auth

---

## 1. Latar Belakang & Ruang Lingkup
Modul ini adalah *core* dari aplikasi QC Market Quality Tracker. Modul ini bertujuan menggantikan Excel menjadi *Single Source of Truth* untuk pencatatan claim, riwayat status, dan jurnal progres kerja antara QRCC dan PQA.

### Kriteria Hak Akses:
* **Admin:** Full CRUD.
* **QRCC:** CRUD data claim miliknya.
* **Viewer:** Read-only dashboard & laporan.

---

## 2. Pembaruan Skema Database (Drizzle ORM / SQLite)

### 2.1. Tabel Utama (`claims`)
Menyimpan data utama klaim.
* `id` (integer, PK)
* `claim_code` (text, format: `CLM-YYYY-NNN`, auto-generated)
* `status` (text, default 'OPEN'. Flow: `OPEN` → `WAITING_PQA` → `ON_PROGRESS` → `CLOSED`)
* `product_id`, `model_id`, `defect_id` (integer, FK, `onDelete: RESTRICT`)
* `source`, `description` (text)
* Timestamps & User track (`created_by`, `updated_by`, `created_at`, `updated_at`)

### 2.2. Tabel Status Log (`claim_status_logs`)
Menyimpan riwayat transisi status klaim (State Machine).
* `claim_id` (FK, `CASCADE`)
* `old_status`, `new_status`
* `changed_by`, `changed_at`

### 2.3. [NEW] Tabel Progress Update (`claim_progress_logs`)
Menampung log harian/jurnal progres dari QRCC dan PQA (mendukung teks tebal, tabel, dan gambar via HTML).
* `id` (integer, PK)
* `claim_id` (integer, FK ke `claims.id`, `CASCADE`)
* `progress_date` (integer, Unix timestamp tanggal aktual kegiatan)
* `notes` (text, menyimpan output HTML dari Rich Text Editor)
* `created_by` (text, FK ke `users.id`)
* `created_at`, `updated_at` (integer)

### 2.4. Integrasi Attachment
Memanfaatkan tabel `attachments` dengan metode Polymorphic:
* Untuk file klaim umum: `entity_type = 'claim'` & `entity_id = claim.id`
* Untuk gambar sisipan di dalam progress log: `entity_type = 'claim_progress'` & `entity_id = claim_progress_logs.id`
* **[NEW] Issue Photos (saat Create Claim)**: Saat QRCC membuat claim baru, dapat meng-upload beberapa foto yang merepresentasikan **bentuk visual defect/issue** yang ditemukan. Disimpan dengan `entity_type = 'claim'` & `entity_id = claim.id` (polymorphic yang sama dengan attachment umum klaim, namun secara UX dikelompokkan sebagai "Issue Photos").

### 2.4.1. Spesifikasi Issue Photos
* **Jumlah**: Maksimal 5 foto per claim pada saat creation (dapat ditambah/dikurangi melalui Claim Detail setelah creation).
* **Format yang diizinkan**: `image/jpeg`, `image/png`, `image/webp`.
* **Ukuran maksimal**: 5 MB per foto.
* **Wajib**: Minimal 1 foto disarankan (untuk dokumentasi visual issue), namun tidak *hard-required* agar user tetap bisa submit jika kondisi tidak memungkinkan.
* **UI**: Tampil sebagai *thumbnail grid* di section "Issue Photos" pada halaman Detail Claim (di atas Timeline Status).
* **Lightbox**: Klik thumbnail membuka *lightbox* untuk melihat foto full-size dengan navigasi next/prev.
* **Sorting**: Foto diurutkan berdasarkan `uploaded_at` ASC (kronologis upload).

---

## 3. Rencana Tugas (Task Plan / Sprint Backlog)

### Phase 1: Database & Backend (Estimasi: 2 Hari)
* [x] **Task 1.1:** Setup migrasi skema tabel `claims` dan `claim_status_logs` menggunakan Drizzle ORM.
* [x] **Task 1.2:** Setup migrasi skema tabel baru `claim_progress_logs`.
* [x] **Task 1.3:** Buat logika *Service* pembuat `claim_code` otomatis (`CLM-YYYY-NNN`).
* [x] **Task 1.4:** Buat API CRUD untuk `claims` (Implementasi validasi Zod schema).
* [x] **Task 1.5:** Implementasi Database Transaction saat Create Claim + Upload Attachment awal (termasuk **Issue Photos** dengan `entity_type = 'claim'`).
* [x] **Task 1.6:** Implementasi Database Transaction saat Update Status (memasukkan ke `claim_status_logs`).
* [x] **Task 1.7:** Buat API CRUD untuk `claim_progress_logs` (mendukung penerimaan string HTML).
* [x] **Task 1.8 [NEW]:** Buat API khusus untuk upload & delete **Issue Photos** pada claim yang sudah ada (endpoint: `POST /api/claims/:id/photos` & `DELETE /api/claims/:id/photos/:photoId`). Validasi mime-type (jpeg/png/webp) dan ukuran max 5MB.

### Phase 2: Frontend Layout & Components (Estimasi: 2 Hari)


* [x] **Task 2.1:** Buat UI List Claim dengan tabel data dan filter pencarian (Nuxt UI).
* [x] **Task 2.2:** Integrasi *Composable* `useClaims()` untuk fetching data ke tabel List.
* [x] **Task 2.3:** Buat Form Create/Edit Claim. Terapkan rule dropdown bertingkat (Product -> Model filter). **[NEW]** Tambahkan komponen `IssuePhotoUploader` (multi-file picker dengan preview, max 5 foto, validasi client-side).
* [x] **Task 2.4:** Instalasi dan konfigurasi Rich Text Editor (WYSIWYG spt TipTap/Quill) untuk input `notes` progress.
* [x] **Task 2.5:** Buat UI Detail Claim. Slicing section untuk merender HTML dari `claim_progress_logs` secara kronologis (berdasarkan `progress_date`).
* [x] **Task 2.6 [NEW]:** Buat section **Issue Photos** di halaman Detail Claim (thumbnail grid + lightbox + tombol Add/Remove Photo sesuai hak akses).
* [x] **Task 2.7 [NEW]:** Komponen reusable `PhotoLightbox.vue` (modal viewer dengan navigasi next/prev/close via keyboard & klik).

### Phase 3: Integration & Progress Attachment (Estimasi: 1 Hari)
* [x] **Task 3.1:** Implementasi logic upload gambar dari dalam Rich Text Editor agar masuk ke API `attachments` dengan entity `claim_progress`.
* [x] **Task 3.2:** Integrasi hak akses menggunakan Better Auth (Tombol Edit/Delete hanya muncul untuk Admin dan QRCC pemilik).
* [x] **Task 3.3:** Pastikan validasi bahwa master data (Product, Model, Defect) tidak bisa dihapus (*RESTRICT*) jika sedang dipakai di claim.

### Phase 4: Testing & UAT (Estimasi: 1 Hari)
* [ ] **Task 4.1:** Integration Test API Create, Update Status, dan Delete Claim.
* [ ] **Task 4.2:** E2E Test (Journey 2): Simulasi User login, buat claim baru dengan **upload 2-3 Issue Photos**, tambah progress update berformat tebal & gambar, lalu update status menjadi CLOSED.
* [ ] **Task 4.3 [NEW]:** Integration Test API Issue Photos: upload valid (jpeg/png), reject invalid mime-type (pdf/gif), reject > 5MB, delete photo, dan cleanup saat claim dihapus (CASCADE).
* [ ] **Task 4.4:** UAT dengan end-user (QRCC).

---

## 4. Kriteria Penerimaan (Acceptance Criteria)
1. Data klaim baru berhasil disimpan dan langsung memiliki kode dengan format CLM-YYYY-NNN.
2. Setiap kali status berubah, riwayat tercatat di Timeline Status.
3. User (QRCC/PQA) dapat menambahkan update progress berisi tabel/gambar di dalam editor UI, dan tampil rapi saat dibaca di halaman Detail Claim.
4. Menghapus sebuah klaim akan otomatis membersihkan semua data progress log, status log, dan metadata attachment yang terhubung.
5. **[NEW]** Saat membuat claim baru, QRCC dapat meng-upload hingga 5 foto sebagai dokumentasi visual issue (jpeg/png/webp, max 5MB per foto). Foto tampil sebagai thumbnail grid di section "Issue Photos" pada Detail Claim dengan lightbox untuk full-size view.
6. **[NEW]** QRCC/Admin dapat menambah atau menghapus Issue Photos dari halaman Detail Claim; foto yang dihapus akan hilang dari storage dan database.

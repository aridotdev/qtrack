# 1. PROJECT OVERVIEW: QC Market Quality Tracker

## 1. CORE TECH STACK & ARCHITECTURE
- **Frontend/Backend**: Nuxt 4 (Vue Ecosystem) + Nuxt UI
- **Auth**: Better Auth (CSRF protection, 8-hour session)
- **Database**: SQLite (WAL mode, Foreign Keys ON) + Drizzle ORM
- **Validation**: Zod (Type-Safe Request Utils)
- **Export Tools**: Puppeteer (PDF Export) & SheetJS (Excel Export)
- **Layers**: API Route (HTTP) -> Validator (Zod) -> Service (Business Logic/Trx) -> Repository (DB)

---

## 2. DATABASE SCHEMA (DRIZZLE)
*Database dikelola sepenuhnya oleh Drizzle ORM. Definisi detail ada di `backend.md`.*

### 2.1 Master Tables
- **users**: Data pengguna untuk otentikasi (dikelola oleh Better Auth).
- **products**: Daftar produk utama.
- **product_models**: SKU atau model dari produk (terhubung ke tabel `products`).
- **defect_types**: Master data jenis kerusakan yang digunakan dalam form klaim.

### 2.2 Transaction Tables
- **claims**: `claim_code` (Generated `CLM-YYYY-NNN`), `status` (OPEN, WAITING_PQA, ON_PROGRESS, CLOSED).
- **samples**: `sample_code` (Generated `SMP-NNN`), `status` (berkaitan dengan sample).
- **sample_parts**: Bagian-bagian dari sampel (Minimal 1 per `samples`).
- **pqa_summaries**: Hasil analisa PQA (Terkait dengan `claims` dan `samples`).
- **monthly_reports**: Laporan bulanan dengan `(year, month)` sebagai unique constraint.

### 2.3 Supporting & Logs Tables
- **claim_status_logs**: Timeline rekaman setiap perubahan status klaim (State Machine).
- **claim_progress_logs**: Jurnal progres harian klaim dari QRCC/PQA, menyimpan HTML (bold, tabel, gambar) dari Rich Text Editor.
- **attachments**: Tabel *polymorphic* untuk file lampiran (`entity_type` + `entity_id`):
  - `entity_type = 'claim'` — termasuk **Issue Photos** (foto dokumentasi visual defect/issue, max 5 foto/claim, jpeg/png/webp, max 5MB/foto).
  - `entity_type = 'claim_progress'` — gambar inline di dalam jurnal progres.
  - `entity_type = 'sample'` / `entity_type = 'pqa'` — lampiran sample & analisa PQA.

---

## 3. USER ROLES & ACCESS CONTROL
| Role | Landing Page | Key Permissions |
| :--- | :--- | :--- |
| **QRCC** | `/dashboard` | **Pengguna Utama.** CRUD Claim, CRUD Sample, CRUD PQA, Upload attachment, Generate & Export Report. Master Data |
| **PQA (Product Quality Assurance)** | `/dashboard` | **Pengguna Utama.** Menerima dan mengisi hasil analisa sample, update jurnal harian atau progress |
| **Management** | `/dashboard` | **View Only.** Memantau dashboard dan laporan bulanan |
| **ADMIN** | `/dashboard` | **Full Access.** Semua izin QRCC + Kelola Users, Role Management. |


---

## 4. KEY SYSTEM FLOWS
### 4.1 Claim Flow (QRCC & PQA)
1. **Entry**: Pembuatan klaim oleh QRCC menghasilkan `claim_code` otomatis (`CLM-YYYY-NNN`) dalam satu *database transaction* (termasuk attachment awal bila ada).
2. **Issue Photos [NEW]**: QRCC dapat meng-upload hingga 5 foto dokumentasi visual defect/issue saat create claim (jpeg/png/webp, max 5MB/foto). Disimpan via `attachments` (`entity_type='claim'`) dan ditampilkan sebagai thumbnail grid dengan lightbox di section "Issue Photos" pada Detail Claim.
3. **Progress Status**: Status berjalan satu arah: `OPEN` -> `WAITING_PQA` -> `ON_PROGRESS` -> `CLOSED`.
4. **Status Audit**: Setiap perubahan status otomatis tercatat di `claim_status_logs` (termasuk `old_status`, `new_status`, `changed_by`, `changed_at`) melalui *database transaction*.
5. **Progress Journal**: QRCC dan PQA dapat menambahkan jurnal progres harian melalui Rich Text Editor (mendukung teks tebal, tabel, dan gambar). Output HTML disimpan di `claim_progress_logs.notes` diurutkan berdasarkan `progress_date`.
6. **Inline Attachment**: Gambar yang di-upload dari dalam Rich Text Editor masuk ke tabel `attachments` dengan `entity_type = 'claim_progress'` & `entity_id = claim_progress_logs.id`.
7. **Master Data Protection**: Product, Model, dan Defect yang sedang dipakai di klaim tidak dapat dihapus (*`onDelete: RESTRICT`*).
8. **Cascade Cleanup**: Menghapus klaim akan otomatis membersihkan seluruh `claim_status_logs`, `claim_progress_logs`, dan metadata `attachments` terkait (`CASCADE`).

### 4.2 Sample & PQA Flow (QRCC)
1. **Sample Entry**: Tambah sampel baru (`SMP-NNN`) wajib bersama minimal 1 `sample_parts` dalam satu *database transaction*.
2. **SLA Tracking**: Sampel dengan umur > 7 hari (status belum `COMPLETED`/`CANCELLED`) mendapat badge `OVERDUE` di UI.
3. **PQA Summary**: Dokumentasi hasil analisa PQA. Menekan tombol "Mark as Shared" otomatis mencatat waktu di `cs_shared_at`.

### 4.3 Report & Export Flow
- **Monthly Report**: Laporan di-generate berdasarkan data bulanan. Jika status diubah menjadi `is_finalized`, data terkunci dan tidak bisa diedit.
- **Export**: Export rekap data ke Excel via *SheetJS*, atau Claim Summary PDF menggunakan renderer *Puppeteer*.

---

## 5. DEVELOPMENT STANDARDS
- **Prinsip Utama**: *Simplicity First*, *Explicit Over Magic*, *Type Safety*, *Progressive Enhancement*.
- **Security**: Validasi input dengan Zod, pengecekan Mime-Type dan limit 10MB per unggahan file, Hash password bawaan Better Auth.
- **Storage**: Skema file upload terstruktur `./uploads/YYYY/MM/filename`. Metadata file (size, mime_type, uploader) disimpan ke database.
- **Response Format**: Format standard API (`{ success: boolean, data/message/errors: ... }`).

---

## 6. Code Style Guidelines
- **TypeScript**: Wajib menggunakan `"strict": true` di `tsconfig`.
- **Component Naming**: Gunakan PascalCase untuk komponen (contoh: `ClaimForm.vue`, `ClaimTable.vue`).
- **Composable Naming**: Gunakan camelCase dengan prefix `use` (contoh: `useClaims.ts`).
- **File Suffixes**: Penamaan file logic spesifik (contoh: `claim.service.ts`, `claim.repository.ts`, `claim.schema.ts`).
- **Error Handling**: Gunakan format HTTP Status standar (400 Validation, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Unexpected Error).
- **State Management**: Untuk tingkat MVP, dianjurkan menggunakan Nuxt `useState()` dibanding Pinia untuk *simplicity*.
- **Testing**: Gunakan *Vitest* (Unit testing untuk Services, Target coverage 70%) dan *Playwright* (E2E Testing browser).

---

## 7. Separation of Concerns
| Layer | Tanggung Jawab | Tidak Boleh | Folder |
| :--- | :--- | :--- | :--- |
| **API Route** | HTTP routing, Panggil auth/middleware, Kembalikan format standar | Eksekusi DB, Business logic rumit | `server/api/` |
| **Validators** | Validasi input skema request dengan Zod | Koordinasi data antar tabel | `server/validators/` |
| **Service** | Business rules, Transactions, Cross-module logic, File processing | Panggil database langsung, Proses HTTP req/res | `server/services/` |
| **Repository**| CRUD murni ke Drizzle ORM | Validasi bisnis, Buat ID/Code, Handle error HTTP | `server/repositories/` |
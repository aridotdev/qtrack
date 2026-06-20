# Database Tables

## 1. users

> Dikelola oleh Better Auth. Tidak dibuat manual via Drizzle schema utama.

| Kolom      | Tipe    | Constraint       | Keterangan                    |
| ---------- | ------- | ---------------- | ----------------------------- |
| id         | text    | PK (UUID)        | ID user dari Better Auth      |
| name       | text    | NOT NULL         | Nama lengkap user             |
| email      | text    | NOT NULL, UNIQUE | Email login                   |
| password   | text    | NOT NULL         | Password (di-hash Better Auth)|
| role       | text    | NOT NULL         | `admin` / `qrcc` / `viewer`   |
| created_at | integer | NOT NULL         | Waktu dibuat (Unix timestamp) |
| updated_at | integer | NOT NULL         | Waktu diupdate                |

INDEX:
- UNIQUE (email)
- INDEX (role)

📌 CATATAN:
- Password tidak pernah disimpan plaintext
- Session expire otomatis setelah 8 jam
- User hanya bisa dibuat oleh Admin, bukan self-register

**Digunakan di halaman:** Master Data (tab Users) · Profile

---

## 2. products

| Kolom      | Tipe    | Constraint       | Keterangan                    |
| ---------- | ------- | ---------------- | ----------------------------- |
| id         | integer | PK               | ID produk                     |
| code       | text    | NOT NULL, UNIQUE | Kode produk (identifier)      |
| name       | text    | NOT NULL         | Nama produk (tampil di UI)    |
| is_active  | integer | NOT NULL         | Boolean (1 = aktif)           |
| created_by | text    | FK → users.id    | ID user yang membuat          |
| updated_by | text    | FK → users.id    | ID user yang mengupdate       |
| created_at | integer | NOT NULL         | Waktu dibuat (Unix timestamp) |
| updated_at | integer | NOT NULL         | Waktu diupdate                |

INDEX:
- UNIQUE (code)
- INDEX (is_active)
- INDEX (created_at)

📌 CATATAN:
- Menggunakan soft delete via `is_active` flag
- Tidak bisa dihapus permanen jika sudah dipakai di claim

**Digunakan di halaman:** Master Data `/masters` (Products) · Claims (form & filter) · Dashboard (filter)

---

## 3. product_models

| Kolom      | Tipe    | Constraint                          | Keterangan                    |
| ---------- | ------- | ----------------------------------- | ----------------------------- |
| id         | integer | PK                                  | ID model                      |
| sku        | text    | NOT NULL, UNIQUE                    | SKU model                     |
| name       | text    | NOT NULL                            | Nama model                    |
| product_id | integer | FK → products.id, onDelete: RESTRICT| Produk induk                  |
| is_active  | integer | NOT NULL                            | Boolean (1 = aktif)           |
| created_by | text    | FK → users.id                       | ID user yang membuat          |
| updated_by | text    | FK → users.id                       | ID user yang mengupdate       |
| created_at | integer | NOT NULL                            | Waktu dibuat (Unix timestamp) |
| updated_at | integer | NOT NULL                            | Waktu diupdate                |

INDEX:
- UNIQUE (sku)
- UNIQUE (name, product_id)
- INDEX (product_id)
- INDEX (is_active)
- INDEX (product_id, is_active)

📌 CATATAN:
- Tidak bisa hapus produk induk jika masih ada model aktif (RESTRICT)
- Dropdown model di form claim difilter berdasarkan produk yang dipilih

**Digunakan di halaman:** Master Data `/masters/models` (Models) · Claims (form & filter) · Dashboard (filter)

---

## 4. defect_categories

| Kolom      | Tipe    | Constraint       | Keterangan                    |
| ---------- | ------- | ---------------- | ----------------------------- |
| id         | integer | PK               | ID kategori defect            |
| code       | text    | NOT NULL, UNIQUE | Kode kategori                 |
| name       | text    | NOT NULL, UNIQUE | Nama kategori                 |
| description| text    | NULL             | Deskripsi kategori            |
| is_active  | integer | NOT NULL         | Boolean (1 = aktif)           |
| created_by | text    | FK → users.id    | ID user yang membuat          |
| updated_by | text    | FK → users.id    | ID user yang mengupdate       |
| created_at | integer | NOT NULL         | Waktu dibuat (Unix timestamp) |
| updated_at | integer | NOT NULL         | Waktu diupdate                |

INDEX:
- UNIQUE (code)
- UNIQUE (name)
- INDEX (is_active)
- INDEX (created_at)

📌 CATATAN:
- Menggunakan soft delete via `is_active` flag

- Kategori tidak bisa dihapus permanen jika masih ada defect aktif di bawahnya

**Digunakan di halaman:** Master Data `/masters/defect-categories` · Master Data `/masters/defect` (dropdown/filter)

---

## 5. defects

| Kolom      | Tipe    | Constraint                                    | Keterangan                    |
| ---------- | ------- | --------------------------------------------- | ----------------------------- |
| id         | integer | PK                                            | ID defect                     |
| code       | text    | NOT NULL, UNIQUE                              | Kode defect                   |
| name       | text    | NOT NULL                                      | Nama defect                   |
| description| text    | NULL                                          | Deskripsi defect              |
| category_id| integer | FK -> defect_categories.id, onDelete: RESTRICT | Kategori defect               |
| is_active  | integer | NOT NULL                                      | Boolean (1 = aktif)           |
| created_by | text    | FK -> users.id                                | ID user yang membuat          |
| updated_by | text    | FK -> users.id                                | ID user yang mengupdate       |
| created_at | integer | NOT NULL                                      | Waktu dibuat (Unix timestamp) |
| updated_at | integer | NOT NULL                                      | Waktu diupdate                |

INDEX:
- UNIQUE (code)
- UNIQUE (name, category_id)
- INDEX (category_id)
- INDEX (is_active)
- INDEX (created_at)
- INDEX (category_id, is_active)

CATATAN:
- Menggunakan soft delete via `is_active` flag
- Nama defect unik dalam scope kategori yang sama
- Tidak bisa dihapus permanen jika sudah dipakai di claim

**Digunakan di halaman:** Master Data `/masters/defect` · Claims (form) · Dashboard (chart Top Defect)

---

## 6. claims

| Kolom          | Tipe    | Constraint                              | Keterangan                         |
| -------------- | ------- | --------------------------------------- | ---------------------------------- |
| id             | integer | PK                                      | ID claim                           |
| claim_code     | text    | NOT NULL, UNIQUE                        | Format: `CLM-YYYY-NNN`             |
| product_id     | integer | FK → products.id, onDelete: RESTRICT    | Produk terkait                     |
| model_id       | integer | FK → product_models.id, onDelete: RESTRICT | Model terkait                   |
| defect_id      | integer | FK → defects.id, onDelete: RESTRICT     | Jenis defect                       |
| source         | text    | NOT NULL                                | Sumber claim                       |
| description    | text    | NOT NULL                                | Deskripsi masalah                  |
| status         | text    | NOT NULL, DEFAULT 'OPEN'                | `OPEN` / `WAITING_PQA` / `ON_PROGRESS` / `CLOSED` |
| created_by     | text    | FK → users.id                           | ID user yang membuat               |
| updated_by     | text    | FK → users.id                           | ID user yang mengupdate            |
| created_at     | integer | NOT NULL                                | Waktu dibuat (Unix timestamp)      |
| updated_at     | integer | NOT NULL                                | Waktu diupdate                     |

INDEX:
- UNIQUE (claim_code)
- INDEX (status)
- INDEX (product_id)
- INDEX (model_id)
- INDEX (defect_id)
- INDEX (created_at)
- INDEX (product_id, status)

📌 CATATAN:
- `claim_code` di-generate otomatis oleh service layer, bukan input user
- Status hanya boleh maju sesuai alur: OPEN → WAITING_PQA → ON_PROGRESS → CLOSED
- Setiap perubahan status otomatis mencatat log ke tabel `claim_status_logs`

**Digunakan di halaman:** Claims (list & form) · Detail Claim · Dashboard (KPI cards, tabel terbaru, chart trend) · Samples (relasi) · PQA Summary (relasi) · Reports

---

## 7. claim_status_logs

| Kolom      | Tipe    | Constraint                            | Keterangan                         |
| ---------- | ------- | ------------------------------------- | ---------------------------------- |
| id         | integer | PK                                    | ID log                             |
| claim_id   | integer | FK → claims.id, onDelete: CASCADE     | Claim terkait                      |
| old_status | text    | NULL                                  | Status sebelumnya (null jika baru) |
| new_status | text    | NOT NULL                              | Status baru                        |
| changed_by | text    | FK → users.id                         | ID user yang mengubah status       |
| changed_at | integer | NOT NULL                              | Waktu perubahan (Unix timestamp)   |

INDEX:
- INDEX (claim_id)
- INDEX (changed_at)

📌 CATATAN:
- Dibuat otomatis oleh service, tidak pernah dibuat manual dari UI
- Jika claim dihapus, semua log ikut terhapus (CASCADE)

**Digunakan di halaman:** Detail Claim (section Timeline Status)

---

## 8. samples

| Kolom         | Tipe    | Constraint                          | Keterangan                           |
| ------------- | ------- | ----------------------------------- | ------------------------------------ |
| id            | integer | PK                                  | ID sample                            |
| sample_code   | text    | NOT NULL, UNIQUE                    | Format: `SMP-NNN`                    |
| claim_id      | integer | FK → claims.id, onDelete: RESTRICT  | Claim terkait                        |
| receiver_name | text    | NOT NULL                            | Nama penerima sample                 |
| sent_at       | integer | NOT NULL                            | Tanggal pengiriman (Unix timestamp)  |
| status        | text    | NOT NULL                            | `WAITING_SEND` / `SENT` / `ON_PROGRESS` / `COMPLETED` / `CANCELLED` |
| notes         | text    | NULL                                | Catatan tambahan                     |
| created_by    | text    | FK → users.id                       | ID user yang membuat                 |
| updated_by    | text    | FK → users.id                       | ID user yang mengupdate              |
| created_at    | integer | NOT NULL                            | Waktu dibuat (Unix timestamp)        |
| updated_at    | integer | NOT NULL                            | Waktu diupdate                       |

INDEX:
- UNIQUE (sample_code)
- INDEX (claim_id)
- INDEX (status)
- INDEX (sent_at)
- INDEX (created_at)
- INDEX (claim_id, status)

📌 CATATAN:
- `sample_code` di-generate otomatis oleh service layer
- Sample dengan `updated_at` > 7 hari yang lalu dan status bukan COMPLETED/CANCELLED ditampilkan badge OVERDUE di UI
- Minimal harus punya 1 `sample_parts`; dibuat dalam satu transaksi

**Digunakan di halaman:** Samples (list & form) · Detail Claim (section Sample terkait) · PQA Summary (relasi)

---

## 9. sample_parts

| Kolom      | Tipe    | Constraint                           | Keterangan                    |
| ---------- | ------- | ------------------------------------ | ----------------------------- |
| id         | integer | PK                                   | ID part                       |
| sample_id  | integer | FK → samples.id, onDelete: CASCADE   | Sample induk                  |
| part_name  | text    | NOT NULL                             | Nama part (misal: Motor, PCB) |
| unit_count | integer | NOT NULL, CHECK (unit_count > 0)     | Jumlah unit (minimal 1)       |
| created_at | integer | NOT NULL                             | Waktu dibuat (Unix timestamp) |

INDEX:
- INDEX (sample_id)

📌 CATATAN:
- Minimal 1 part per sample; divalidasi di service layer
- Jika sample dihapus, semua part ikut terhapus (CASCADE)
- Dibuat dan diedit melalui Sample Parts Editor di form sample

**Digunakan di halaman:** Samples (form — Sample Parts Editor)

---

## 10. pqa_summaries

| Kolom                   | Tipe    | Constraint                           | Keterangan                                          |
| ----------------------- | ------- | ------------------------------------ | --------------------------------------------------- |
| id                      | integer | PK                                   | ID PQA summary                                      |
| claim_id                | integer | FK → claims.id, onDelete: RESTRICT   | Claim terkait                                       |
| sample_id               | integer | FK → samples.id, onDelete: RESTRICT  | Sample terkait                                      |
| root_cause              | text    | NOT NULL                             | Akar masalah                                        |
| recommendation          | text    | NOT NULL                             | Rekomendasi perbaikan                               |
| implementation_status   | text    | NOT NULL, DEFAULT 'WAITING'          | `WAITING` / `IMPLEMENTING` / `DONE` / `REJECTED`    |
| cs_shared_status        | text    | NOT NULL, DEFAULT 'NOT_SHARED'       | `NOT_SHARED` / `SHARED` / `NOT_REQUIRED`            |
| cs_shared_at            | integer | NULL                                 | Waktu di-mark shared (Unix timestamp)               |
| created_by              | text    | FK → users.id                        | ID user yang membuat                                |
| updated_by              | text    | FK → users.id                        | ID user yang mengupdate                             |
| created_at              | integer | NOT NULL                             | Waktu dibuat (Unix timestamp)                       |
| updated_at              | integer | NOT NULL                             | Waktu diupdate                                      |

INDEX:
- INDEX (claim_id)
- INDEX (sample_id)
- INDEX (implementation_status)
- INDEX (cs_shared_status)
- INDEX (created_at)

📌 CATATAN:
- `cs_shared_at` diisi otomatis oleh service saat user klik "Mark as Shared"
- Bisa punya attachment (via tabel `attachments` dengan `entity_type = 'pqa'`)

**Digunakan di halaman:** PQA Summary (list & form) · Detail Claim (section PQA Summary)

---

## 11. attachments

| Kolom       | Tipe    | Constraint    | Keterangan                                         |
| ----------- | ------- | ------------- | -------------------------------------------------- |
| id          | integer | PK            | ID attachment                                      |
| entity_type | text    | NOT NULL      | `claim` / `sample` / `pqa`                         |
| entity_id   | integer | NOT NULL      | ID dari entitas terkait                            |
| file_name   | text    | NOT NULL      | Nama file asli                                     |
| file_path   | text    | NOT NULL      | Path file di server (`uploads/YYYY/MM/filename`)   |
| mime_type   | text    | NOT NULL      | `image/jpeg` / `image/png` / `application/pdf` / `application/vnd...docx` |
| file_size   | integer | NOT NULL      | Ukuran file dalam bytes (max 10 MB)                |
| uploaded_by | text    | FK → users.id | ID user yang mengupload                            |
| uploaded_at | integer | NOT NULL      | Waktu upload (Unix timestamp)                      |

INDEX:
- INDEX (entity_type, entity_id)
- INDEX (uploaded_at)

📌 CATATAN:
- Tidak menggunakan FK ke entitas spesifik; relasi dikelola via `entity_type` + `entity_id` (polymorphic)
- Validasi mime type dan ukuran file dilakukan di service layer sebelum disimpan
- File fisik disimpan di folder `uploads/YYYY/MM/`; database hanya menyimpan metadata

**Digunakan di halaman:** Detail Claim (section Attachment) · Samples (attachment) · PQA Summary (attachment)

---

## 12. monthly_reports

| Kolom        | Tipe    | Constraint                 | Keterangan                                  |
| ------------ | ------- | -------------------------- | ------------------------------------------- |
| id           | integer | PK                         | ID laporan                                  |
| year         | integer | NOT NULL                   | Tahun laporan                               |
| month        | integer | NOT NULL                   | Bulan laporan (1–12)                        |
| notes        | text    | NULL                       | Catatan tambahan dari user                  |
| is_finalized | integer | NOT NULL, DEFAULT 0        | Boolean; jika 1 laporan dikunci             |
| finalized_by | text    | FK → users.id, NULL        | ID user yang memfinalisasi                  |
| finalized_at | integer | NULL                       | Waktu finalisasi (Unix timestamp)           |
| created_by   | text    | FK → users.id              | ID user yang generate laporan               |
| updated_by   | text    | FK → users.id              | ID user yang mengupdate                     |
| created_at   | integer | NOT NULL                   | Waktu dibuat (Unix timestamp)               |
| updated_at   | integer | NOT NULL                   | Waktu diupdate                              |

INDEX:
- UNIQUE (year, month)
- INDEX (is_finalized)
- INDEX (created_at)

📌 CATATAN:
- Tidak boleh ada dua laporan dengan `year` + `month` yang sama
- Laporan yang sudah `is_finalized = 1` tidak bisa diedit kembali
- Data isi laporan (jumlah claim, defect, dll) di-query langsung dari tabel `claims` saat generate, bukan disimpan ulang

**Digunakan di halaman:** Reports

---

## Ringkasan Relasi Tabel

```
users
 ├── products (created_by, updated_by)
 ├── product_models (created_by, updated_by)
 ├── defect_categories (created_by, updated_by)
 ├── defects (created_by, updated_by)
 ├── claims (created_by, updated_by)
 ├── claim_status_logs (changed_by)
 ├── samples (created_by, updated_by)
 ├── pqa_summaries (created_by, updated_by)
 ├── attachments (uploaded_by)
 └── monthly_reports (created_by, updated_by, finalized_by)

products
 └── product_models (product_id)

product_models ──→ claims (model_id)
products       ──→ claims (product_id)
defect_categories ──→ defects (category_id)
defects           ──→ claims (defect_id)

claims
 ├── claim_status_logs (claim_id) — CASCADE
 ├── samples (claim_id)
 ├── pqa_summaries (claim_id)
 └── attachments (entity_type='claim', entity_id)

samples
 ├── sample_parts (sample_id) — CASCADE
 ├── pqa_summaries (sample_id)
 └── attachments (entity_type='sample', entity_id)

pqa_summaries
 └── attachments (entity_type='pqa', entity_id)
```

---

## Pemetaan Tabel ke Halaman Frontend

| Tabel                | Dashboard | Claims | Detail Claim | Samples | PQA Summary | Reports | Master Data | Profile |
| -------------------- | :-------: | :----: | :----------: | :-----: | :---------: | :-----: | :---------: | :-----: |
| users                |           |        |              |         |             |         | ✓           | ✓       |
| products             | ✓ (filter)| ✓      |              |         |             |         | ✓           |         |
| product_models       | ✓ (filter)| ✓      |              |         |             |         | ✓           |         |
| defect_categories    |           |        |              |         |             |         | ✓           |         |
| defects              | ✓ (chart) | ✓      |              |         |             |         | ✓           |         |
| claims               | ✓         | ✓      | ✓            |         |             | ✓       |             |         |
| claim_status_logs    |           |        | ✓            |         |             |         |             |         |
| samples              |           |        | ✓            | ✓       | ✓           |         |             |         |
| sample_parts         |           |        |              | ✓       |             |         |             |         |
| pqa_summaries        |           |        | ✓            |         | ✓           |         |             |         |
| attachments          |           |        | ✓            | ✓       | ✓           |         |             |         |
| monthly_reports      |           |        |              |         |             | ✓       |             |         |

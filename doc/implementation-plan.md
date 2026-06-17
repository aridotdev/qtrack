# implementation-plan.md

# QC Market Quality Tracker

## Implementation Plan (Part 1 — Foundation & Architecture)

**Version:** 1.0.0
**Tanggal:** Juni 2026
**Status:** Approved for Development
**Project Owner:** QRCC
**Technical Stack:** Nuxt 4 + Nuxt UI + SQLite + Drizzle ORM + Better Auth

---

# 1. Executive Summary

QC Market Quality Tracker merupakan aplikasi web internal yang bertujuan menggantikan proses pengelolaan Market Quality menggunakan banyak file Excel menjadi satu sistem terpusat.

Sistem ini akan mendukung seluruh alur kerja QRCC, mulai dari:

* Pencatatan claim
* Tracking sample
* Dokumentasi hasil analisa PQA
* Pembuatan laporan bulanan
* Dashboard KPI
* Export PDF dan Excel

Target implementasi MVP adalah dapat digunakan pada lingkungan internal dengan jumlah pengguna aktif rendah hingga menengah.

---

# 2. Objective

## Business Objective

* Menghilangkan ketergantungan terhadap file Excel.
* Menjadi single source of truth.
* Mempercepat proses pembuatan laporan.
* Memberikan visibilitas status claim secara real-time.

## Technical Objective

* Mudah dipelihara.
* Mudah dipelajari developer baru.
* Cepat dikembangkan.
* Aman untuk penggunaan internal.
* Siap berkembang ke PostgreSQL jika dibutuhkan.

---

# 3. Scope

## Included (MVP)

* Authentication
* Dashboard
* Claims
* Sample Log
* PQA Summary
* Monthly Reports
* Master Data
* Attachments
* PDF Export
* Excel Export

## Excluded

* Email Notification
* ERP Integration
* Mobile App
* Multi-language

---

# 4. Guiding Principles

Seluruh development harus mengikuti prinsip berikut:

## Simplicity First

Pilih solusi paling sederhana selama memenuhi kebutuhan bisnis.

## Explicit Over Magic

Kode harus mudah dibaca dibanding terlalu abstrak.

## Type Safety

Semua layer menggunakan TypeScript strict mode.

## Feature Isolation

Setiap fitur memiliki boundary yang jelas.

## Progressive Enhancement

MVP selesai terlebih dahulu sebelum fitur tambahan.

---

# 5. High-Level Architecture

```
┌─────────────────────┐
│      Browser        │
│ Nuxt UI Frontend    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│     Nuxt Server     │
│ Nitro API Routes    │
└─────────┬───────────┘
          │
 ┌────────┼──────────┐
 │        │          │
 ▼        ▼          ▼
Auth   Drizzle     File System
        ORM         Uploads
 │        │
 ▼        ▼
Better   SQLite
Auth      WAL
```

---

# 6. Module Architecture

```
Dashboard
│
├─ Claims
│   ├─ Attachments
│   ├─ Status Logs
│   └─ Claim Summary PDF
│
├─ Samples
│   └─ Sample Parts
│
├─ PQA Summary
│
├─ Monthly Reports
│
├─ Master Data
│
└─ Authentication
```

---

# 7. User Roles

## Admin

Hak akses penuh.

Dapat:

* Kelola user
* Kelola master data
* CRUD seluruh modul
* Export seluruh laporan

---

## QRCC

Pengguna utama.

Dapat:

* CRUD claim
* CRUD sample
* CRUD PQA
* Generate report
* Upload attachment
* Export PDF/Excel

---

## Viewer

Hanya dapat melihat data.

Dapat:

* Dashboard
* Detail claim
* Report

Tidak dapat mengubah data.

---

# 8. Technology Decisions

## Frontend

### Nuxt 4

Alasan:

* Full-stack
* Vue ecosystem
* Server routes bawaan
* TypeScript support baik

---

## UI

### Nuxt UI

Alasan:

* Integrasi sempurna dengan Nuxt
* Komponen lengkap
* Konsisten
* Cepat dikembangkan

---

## Database

### SQLite

Alasan:

* Tidak membutuhkan server terpisah
* Mudah backup
* Sangat cocok untuk internal tools

Konfigurasi wajib:

```
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

---

## ORM

### Drizzle ORM

Alasan:

* Type-safe
* SQL-first
* Migration sederhana
* Performa baik

---

## Authentication

### Better Auth

Strategi:

Admin membuat user.

Flow:

```
Admin
 ↓
Create User
 ↓
Temporary Password
 ↓
User Login
 ↓
Change Password
```

---

## PDF Export

### Puppeteer

Flow:

```
Nuxt HTML Page
↓
Puppeteer Render
↓
PDF Download
```

Alasan:

* Tampilan profesional
* Mudah mengikuti template perusahaan

---

## Excel Export

### SheetJS (xlsx)

Alasan:

* Mature
* Stabil
* Fleksibel

---

# 9. Project Structure

```
qc-tracker/
├─ app/
├─ components/
├─ composables/
├─ middleware/
├─ pages/
├─ server/
├─ shared/
├─ types/
├─ public/
├─ tests/
├─ scripts/
├─ drizzle/
├─ uploads/
└─ docs/
```

---

# 10. Detailed Folder Structure

```
server/
├─ api/
│
├─ auth/
│
├─ db/
│
├─ repositories/
│
├─ services/
│
├─ validators/
│
└─ utils/
```

---

## API

```
api/
├─ claims/
├─ samples/
├─ pqa/
├─ reports/
├─ dashboard/
├─ attachments/
├─ master/
└─ users/
```

---

## Repository Layer

Tanggung jawab:

* Query database
* Tidak berisi business logic

Contoh:

```
claim.repository.ts
sample.repository.ts
```

---

## Service Layer

Tanggung jawab:

* Business rules
* Transaction
* Validasi lintas modul

Contoh:

```
claim.service.ts
report.service.ts
```

---

## Validators

Menggunakan Zod.

Contoh:

```
claim.schema.ts
sample.schema.ts
```

---

# 11. Environment Requirements

## Development Machine

Minimal:

```
OS       : Linux
Node     : 22.x
RAM      : 8 GB
Storage  : 10 GB
Browser  : Chrome
```

Direkomendasikan:

```
RAM      : 16 GB
SSD
VS Code
```

---

# 12. Package Manager

## pnpm

Alasan:

* Cepat
* Hemat storage
* Cocok monorepo maupun single repo

Versi:

```
pnpm >= 10
```

---

# 13. Initial Project Setup

## Create Project

```bash
pnpm create nuxt qc-tracker
```

---

## Install Dependencies

### Core

```bash
pnpm add @nuxt/ui
pnpm add drizzle-orm
pnpm add better-auth
pnpm add better-sqlite3
pnpm add zod
pnpm add xlsx
pnpm add puppeteer
pnpm add date-fns
```

---

### Dev Dependencies

```bash
pnpm add -D drizzle-kit
pnpm add -D typescript
pnpm add -D @types/node
pnpm add -D eslint
pnpm add -D prettier
pnpm add -D vitest
pnpm add -D @vue/test-utils
pnpm add -D playwright
```

---

# 14. Environment Variables

File:

```
.env
```

Isi:

```env
DATABASE_URL=./data/qc-tracker.db

BETTER_AUTH_SECRET=

BETTER_AUTH_URL=http://localhost:3000

UPLOAD_DIR=./uploads

SESSION_EXPIRE_HOURS=8

PDF_BASE_URL=http://localhost:3000
```

---

# 15. Upload Strategy

Directory:

```
uploads/
└─ YYYY/
   └─ MM/
```

Contoh:

```
uploads/
└─ 2026/
   └─ 06/
      └─ 174912938-photo.jpg
```

---

## Metadata Database

Disimpan:

* file_name
* file_path
* mime_type
* file_size
* uploaded_by
* uploaded_at

---

# 16. Coding Standards

## TypeScript

Gunakan:

```json
"strict": true
```

---

## Naming

### Component

```
ClaimForm.vue
ClaimTable.vue
```

---

### Composable

```
useClaims.ts
useDashboard.ts
```

---

### Service

```
claim.service.ts
```

---

### Repository

```
claim.repository.ts
```

---

# 17. Error Handling Standard

Gunakan format:

```ts
{
  success: false,
  message: string,
  errors?: unknown
}
```

Response sukses:

```ts
{
  success: true,
  data: ...
}
```

---

# 18. Logging Standard

Development:

```
console.error()
```

Production:

```
server/utils/logger.ts
```

Mencatat:

* Error
* User
* Endpoint
* Timestamp

---

# 19. Security Standards

Wajib:

* Password hash oleh Better Auth
* Session timeout 8 jam
* Input validation Zod
* File type validation
* Max upload 10MB
* Escape output HTML
* CSRF protection Better Auth

---

# 20. Definition of Foundation Complete

Phase Foundation dianggap selesai apabila:

* [ ] Nuxt 4 berhasil dijalankan
* [ ] pnpm terkonfigurasi
* [ ] TypeScript strict aktif
* [ ] ESLint aktif
* [ ] Prettier aktif
* [ ] SQLite dapat terkoneksi
* [ ] Drizzle berhasil generate migration
* [ ] Better Auth terpasang
* [ ] Folder structure dibuat
* [ ] Environment variables lengkap
* [ ] Upload directory tersedia
* [ ] Project dapat dijalankan menggunakan:

```bash
pnpm dev
```

dan dapat diakses pada:

```
http://localhost:3000
```

---

# Deliverables Part 1

Output dari tahap Foundation & Architecture:

* Project blueprint disetujui.
* Struktur folder final tersedia.
* Keputusan teknologi dikunci.
* Environment development siap.
* Tim siap memasuki tahap Database & Backend Implementation.

# implementation-plan.md

# QC Market Quality Tracker

## Part 2 — Database & Backend Implementation Plan

---

# 21. Objective

Tahap ini bertujuan membangun pondasi backend yang stabil sebelum memulai UI.

Output akhir yang diharapkan:

* Database siap digunakan.
* Migration berjalan normal.
* Better Auth terintegrasi.
* API pattern telah ditetapkan.
* Semua business rule utama terdokumentasi.
* Backend siap digunakan frontend.

---

# 22. Backend Development Principles

Urutan pengerjaan backend wajib mengikuti prinsip berikut:

```text
Schema
↓
Migration
↓
Repository
↓
Validator
↓
Service
↓
API Route
↓
Testing
```

Jangan melompati tahapan.

---

# 23. Database Strategy

Database:

```text
SQLite
```

ORM:

```text
Drizzle ORM
```

Driver:

```text
better-sqlite3
```

Lokasi database:

```text
/data/qc-tracker.db
```

---

# 24. Migration Strategy

Gunakan migration berbasis source of truth.

Flow:

```text
Schema
↓
Generate Migration
↓
Review SQL
↓
Apply Migration
```

Jangan pernah mengedit database secara manual.

---

# 25. Drizzle Folder Structure

```text
server/db/
├─ index.ts
├─ schema/
├─ migrations/
├─ seeds/
└─ utils/
```

---

# 26. Schema Implementation Order

Untuk menghindari dependency error, schema dibuat dengan urutan berikut.

## Phase DB-01

Independent Tables

* users
* products
* defect_types

---

## Phase DB-02

Dependent Tables

* product_models

---

## Phase DB-03

Core Tables

* claims

---

## Phase DB-04

Sample Module

* samples
* sample_parts

---

## Phase DB-05

PQA Module

* pqa_summaries

---

## Phase DB-06

Supporting Tables

* claim_status_logs
* attachments
* monthly_reports

---

# 27. Users Schema Rules

Table:

```text
users
```

Rules:

* email unique
* role wajib
* password hash Better Auth
* created_at otomatis

Allowed role:

```text
admin
qrcc
viewer
```

---

# 28. Products Schema Rules

Table:

```text
products
```

Rules:

* code unique
* name wajib
* is_active default true

---

# 29. Product Models Rules

Table:

```text
product_models
```

Rules:

* harus memiliki product
* sku unique
* is_active default true

---

# 30. Defect Types Rules

Table:

```text
defect_types
```

Rules:

* nama wajib
* kategori opsional
* is_active default true

---

# 31. Claim Schema Rules

Table:

```text
claims
```

Claim Code Format:

```text
CLM-YYYY-NNN
```

Contoh:

```text
CLM-2026-001
```

Rules:

* product wajib
* model wajib
* defect wajib
* source wajib
* description wajib
* status default OPEN

Allowed status:

```text
OPEN
WAITING_PQA
ON_PROGRESS
CLOSED
```

---

# 32. Claim Code Generator

Generator dilakukan pada service layer.

Flow:

```text
Ambil tahun saat ini
↓
Cari nomor terbesar tahun tersebut
↓
Tambah 1
↓
PadStart(3)
```

Contoh:

```text
CLM-2026-014
```

---

# 33. Sample Schema Rules

Table:

```text
samples
```

Sample Code Format:

```text
SMP-NNN
```

Contoh:

```text
SMP-001
```

Rules:

* claim wajib
* receiver_name wajib
* sent_at wajib
* status wajib

Allowed status:

```text
WAITING_SEND
SENT
ON_PROGRESS
COMPLETED
CANCELLED
```

---

# 34. Sample Parts Rules

Table:

```text
sample_parts
```

Rules:

* minimal 1 part
* unit_count > 0
* part_name wajib

Contoh:

Satu sample dapat memiliki:

```text
Motor : 2 pcs
Bearing : 1 pcs
PCB : 1 pcs
```

---

# 35. PQA Summary Rules

Table:

```text
pqa_summaries
```

Rules:

* claim wajib
* sample wajib
* root cause wajib
* recommendation wajib

Implementation Status:

```text
WAITING
IMPLEMENTING
DONE
REJECTED
```

CS Shared Status:

```text
NOT_SHARED
SHARED
NOT_REQUIRED
```

---

# 36. Monthly Reports Rules

Table:

```text
monthly_reports
```

Unique Constraint:

```text
year + month
```

Tidak boleh ada dua laporan bulan yang sama.

---

# 37. Attachments Rules

Table:

```text
attachments
```

Allowed Entity:

```text
claim
sample
pqa
```

Allowed Mime Type:

```text
image/jpeg
image/png
application/pdf
application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

Max Size:

```text
10 MB
```

---

# 38. Claim Status Logs

Table:

```text
claim_status_logs
```

Harus dibuat otomatis ketika status berubah.

Flow:

```text
OPEN
↓
WAITING_PQA
↓
ON_PROGRESS
↓
CLOSED
```

---

# 39. Seed Strategy

Tujuan:

Mempermudah development.

Seed wajib:

## Admin

```text
admin@example.com
```

Role:

```text
admin
```

---

## Products

Minimal:

* TV
* Refrigerator
* Washing Machine

---

## Defect Types

Minimal:

* No Power
* Noise
* Cosmetic
* Leakage

---

# 40. Better Auth Strategy

Flow:

```text
Admin Login
↓
Create User
↓
Generate Temporary Password
↓
User Login
↓
Change Password
```

---

# 41. Session Rules

Session Expiration:

```text
8 jam
```

Remember Me:

```text
Tidak digunakan pada MVP
```

Concurrent Session:

```text
Diizinkan
```

---

# 42. API Design Principles

Gunakan REST.

Response konsisten.

Contoh sukses:

```json
{
  "success": true,
  "data": {}
}
```

Contoh gagal:

```json
{
  "success": false,
  "message": "Validation failed"
}
```

---

# 43. API Implementation Order

Backend dibangun dengan urutan berikut.

## API-01

Authentication

* Login
* Logout
* Session

---

## API-02

Master Data

* Products
* Models
* Defect Types
* Users

---

## API-03

Claims

* List
* Detail
* Create
* Update
* Delete

---

## API-04

Samples

* List
* Detail
* Create
* Update

---

## API-05

PQA Summary

* List
* Detail
* Create
* Update

---

## API-06

Attachments

* Upload
* Download
* Delete

---

## API-07

Dashboard

* KPI
* Trend
* Top Defect

---

## API-08

Reports

* Generate
* Export Excel

---

## API-09

PDF Export

* Claim Summary PDF

---

# 44. Repository Pattern

Repository hanya bertugas mengakses database.

Tidak boleh:

* validasi bisnis
* generate ID
* transaction

Contoh:

```text
claim.repository.ts
```

Berisi:

```text
findAll()
findById()
create()
update()
delete()
```

---

# 45. Service Pattern

Service bertugas menangani business logic.

Contoh:

```text
claim.service.ts
```

Berisi:

* generate claim code
* create status log
* transaction
* validasi lintas tabel

---

# 46. Transaction Rules

Gunakan transaction pada:

## Claim Creation

Claim

* Attachment

---

## Sample Creation

Sample

* Sample Parts

---

## PQA Creation

Summary

* Attachment

---

## Claim Status Update

Claim

* Status Log

---

# 47. Validation Strategy

Gunakan:

```text
Zod
```

Semua request harus divalidasi.

Flow:

```text
Request
↓
Zod Validation
↓
Service
↓
Repository
```

---

# 48. Error Handling Rules

HTTP Status:

Validation:

```text
400
```

Unauthorized:

```text
401
```

Forbidden:

```text
403
```

Not Found:

```text
404
```

Unexpected Error:

```text
500
```

---

# 49. Backend Testing Strategy

Repository:

```text
Integration Test
```

Service:

```text
Unit Test
```

API:

```text
Integration Test
```

Authentication:

```text
E2E Test
```

---

# 50. Definition of Backend Complete

Backend dianggap selesai apabila:

* [ ] Semua migration berhasil dijalankan.
* [ ] Database dapat dibuat dari nol.
* [ ] Seed berjalan normal.
* [ ] Better Auth bekerja.
* [ ] Session berjalan.
* [ ] Semua validator tersedia.
* [ ] Semua repository tersedia.
* [ ] Semua service tersedia.
* [ ] Semua endpoint utama tersedia.
* [ ] Unit test backend lulus.
* [ ] Integration test backend lulus.
* [ ] API dapat digunakan frontend.

---

# Deliverables Part 2

Output tahap ini:

* Database production-ready.
* Better Auth aktif.
* API MVP selesai.
* Business rule terdokumentasi.
* Backend siap diintegrasikan ke frontend.

# implementation-plan.md

# QC Market Quality Tracker

## Part 3 — Frontend & Development Roadmap

---

# 51. Objective

Tahap ini bertujuan membangun antarmuka pengguna yang konsisten, mudah digunakan oleh tim QRCC, serta memiliki roadmap implementasi yang jelas.

Output akhir:

* Seluruh halaman MVP tersedia.
* UI mengikuti standar Nuxt UI.
* Frontend siap digunakan pengguna.
* Roadmap development dapat dijadikan checklist harian.

---

# 52. Frontend Architecture Principles

Frontend harus mengikuti prinsip berikut.

## Consistency

Semua halaman menggunakan pola UI yang sama.

---

## Reusability

Komponen yang sama tidak boleh dibuat berulang.

---

## Predictability

Alur data mudah dipahami.

---

## Thin Pages

Business logic tidak ditulis di halaman.

---

## Composition First

Gunakan composable sebelum membuat global state.

---

# 53. Frontend Directory Structure

```text
app/
├─ components/
├─ composables/
├─ layouts/
├─ middleware/
├─ pages/
├─ plugins/
├─ utils/
└─ types/
```

---

# 54. Layout Strategy

## Public Layout

Digunakan untuk:

```text
Login
```

---

## Default Layout

Digunakan untuk:

```text
Dashboard
Claims
Samples
PQA
Reports
Master Data
Profile
```

---

# 55. Sidebar Navigation

Urutan menu:

```text
Dashboard
Claims
Samples
PQA Summary
Reports
Master Data
Profile
Logout
```

---

# 56. Route Protection

Middleware:

```text
auth.ts
```

Flow:

```text
Route Access
↓
Check Session
↓
Authorized?
├─ YES → Continue
└─ NO → Login
```

---

# 57. Role-Based Navigation

## Admin

Melihat:

```text
Semua menu
```

---

## QRCC

Melihat:

```text
Dashboard
Claims
Samples
PQA
Reports
Profile
Logout
```

---

## Viewer

Melihat:

```text
Dashboard
Claims (Read Only)
Reports (Read Only)
Profile
Logout
```

---

# 58. Page Implementation Order

Frontend dibangun dengan urutan berikut.

## UI-01

Login

---

## UI-02

Dashboard

---

## UI-03

Master Data

---

## UI-04

Claims

---

## UI-05

Samples

---

## UI-06

PQA Summary

---

## UI-07

Attachments

---

## UI-08

Reports

---

## UI-09

Profile

---

# 59. Dashboard Design

Widget utama:

## KPI Cards

Menampilkan:

* Total Claim
* Open
* Waiting PQA
* Closed

---

## Charts

Menampilkan:

* Trend 12 bulan
* Top 5 defect

---

## Latest Claims

Menampilkan:

* 10 claim terbaru

---

## Filters

Menampilkan:

* Date Range
* Product
* Model

---

# 60. Claims Module Design

Halaman:

```text
/claims
```

Komponen:

```text
ClaimTable
ClaimFilters
ClaimForm
ClaimStatusBadge
ClaimActions
```

---

## Detail Claim

Halaman:

```text
/claims/[id]
```

Menampilkan:

### Informasi Claim

* Claim Code
* Product
* Model
* Defect
* Source
* Description

---

### Sample Terkait

---

### PQA Summary

---

### Timeline Status

---

### Attachment

---

### Export PDF

---

# 61. Claims UX Rules

User harus dapat:

* Search maksimal 2 klik.
* Filter tanpa reload.
* Quick update status.
* Melihat detail tanpa kehilangan konteks.

---

# 62. Samples Module Design

Halaman:

```text
/samples
```

Komponen:

```text
SampleTable
SampleForm
SampleStatusBadge
SamplePartsEditor
```

---

## Sample Parts Editor

Mendukung:

```text
Tambah Part
Edit Part
Hapus Part
```

Minimal:

```text
1 Part
```

---

# 63. Sample Warning Rules

Sample lebih dari 7 hari tanpa update:

Tampilkan badge:

```text
OVERDUE
```

Prioritas:

```text
High
```

---

# 64. PQA Module Design

Halaman:

```text
/pqa
```

Komponen:

```text
PqaTable
PqaForm
PqaStatusBadge
PqaShareButton
```

---

## Mark Shared Flow

User klik:

```text
Mark as Shared
```

↓

Sistem:

```text
Set status = SHARED
Set cs_shared_at = NOW
```

---

# 65. Reports Module Design

Halaman:

```text
/reports
```

Fitur:

* Generate laporan
* Edit notes
* Finalize
* Export Excel
* View history

---

# 66. Master Data Design

Tabs:

```text
Products
Models
Defect Types
Users
```

Admin only.

---

# 67. Profile Design

Fitur:

```text
Edit Name
Change Password
View Role
```

---

# 68. Composable Strategy

Tujuan:

Memisahkan UI dan API.

---

## useClaims

Bertanggung jawab:

```text
List Claim
Create Claim
Update Claim
Delete Claim
Export PDF
```

---

## useSamples

Bertanggung jawab:

```text
List Sample
CRUD Sample
```

---

## usePqa

Bertanggung jawab:

```text
List PQA
CRUD PQA
```

---

## useReports

Bertanggung jawab:

```text
Generate Report
Export Excel
```

---

## useDashboard

Bertanggung jawab:

```text
Fetch KPI
Fetch Trend
Fetch Top Defect
```

---

# 69. State Management Strategy

MVP:

Gunakan:

```text
useState()
```

Hindari Pinia.

Alasan:

* Lebih sederhana.
* Mudah dipelajari.
* Cukup untuk skala MVP.

---

# 70. Table Strategy

Semua tabel wajib mendukung:

* Pagination
* Search
* Sorting
* Filter
* Empty State
* Loading State

---

# 71. Form Strategy

Gunakan:

```text
Nuxt UI Form
+
Zod
```

Flow:

```text
Input
↓
Zod
↓
API
↓
Toast
```

---

# 72. Toast Notifications

Sukses:

```text
Data berhasil disimpan.
```

Error:

```text
Terjadi kesalahan.
```

Warning:

```text
Periksa kembali input Anda.
```

---

# 73. Loading Strategy

Gunakan:

```text
Skeleton
```

untuk:

* Table
* Dashboard
* Detail Page

---

# 74. Empty State Strategy

Contoh:

```text
Belum ada data.
Klik tombol Tambah untuk membuat data baru.
```

---

# 75. Development Roadmap

## Phase 0

Foundation

Durasi:

```text
2 hari
```

Output:

Project siap.

---

## Phase 1

Database + Auth

Durasi:

```text
3 hari
```

Output:

Backend siap.

---

## Phase 2

Master Data

Durasi:

```text
2 hari
```

Output:

Produk siap.

---

## Phase 3

Claims

Durasi:

```text
5 hari
```

Output:

Claim berjalan.

---

## Phase 4

Samples

Durasi:

```text
3 hari
```

Output:

Sample berjalan.

---

## Phase 5

PQA

Durasi:

```text
3 hari
```

Output:

PQA berjalan.

---

## Phase 6

Attachments

Durasi:

```text
2 hari
```

Output:

Upload berjalan.

---

## Phase 7

Dashboard

Durasi:

```text
2 hari
```

Output:

Dashboard selesai.

---

## Phase 8

Reports

Durasi:

```text
3 hari
```

Output:

Laporan selesai.

---

## Phase 9

PDF Export

Durasi:

```text
2 hari
```

Output:

PDF siap.

---

## Phase 10

Testing & UAT

Durasi:

```text
3 hari
```

Output:

MVP siap digunakan.

---

# 76. Total Estimation

Estimasi developer tunggal:

```text
30 hari kerja
≈ 6 minggu
```

Dengan asumsi:

* Full-time
* Scope tidak berubah
* Tidak ada perubahan mayor

---

# 77. Daily Workflow Recommendation

Setiap task mengikuti alur:

```text
Design
↓
Schema/API
↓
UI
↓
Testing
↓
Review
↓
Commit
```

---

# 78. Git Commit Convention

Format:

```text
type(scope): message
```

Contoh:

```text
feat(claim): add claim detail page
fix(sample): resolve status validation
refactor(auth): simplify middleware
docs(report): update implementation plan
```

---

# 79. Definition of Frontend Complete

Frontend dianggap selesai apabila:

* [ ] Login berjalan.
* [ ] Dashboard berjalan.
* [ ] Claims berjalan.
* [ ] Samples berjalan.
* [ ] PQA berjalan.
* [ ] Reports berjalan.
* [ ] Master Data berjalan.
* [ ] Profile berjalan.
* [ ] Export berjalan.
* [ ] Semua role teruji.
* [ ] UI responsif tablet.

---

# Deliverables Part 3

Output tahap ini:

* Seluruh desain frontend terdokumentasi.
* Roadmap implementasi jelas.
* Task breakdown tersedia.
* Estimasi proyek tersedia.
* Frontend siap memasuki tahap Testing & Deployment.

# implementation-plan.md

# QC Market Quality Tracker

## Part 4 — Testing, Deployment & Go-Live Plan

---

# 80. Objective

Tahap ini bertujuan memastikan aplikasi yang telah dikembangkan benar-benar siap digunakan oleh pengguna akhir.

Output akhir:

* Seluruh fitur tervalidasi.
* Risiko implementasi diminimalkan.
* Build dapat dijalankan secara konsisten.
* Aplikasi siap digunakan di lingkungan lokal perusahaan.

---

# 81. Quality Assurance Principles

Seluruh pengujian harus mengikuti prinsip berikut:

## Test Early

Lakukan pengujian sejak awal development.

---

## Automate Critical Paths

Fitur penting harus memiliki automated test.

---

## Test Like Users

Uji aplikasi sesuai perilaku pengguna nyata.

---

## Prevent Regression

Pastikan perubahan baru tidak merusak fitur lama.

---

# 82. Testing Pyramid

Strategi testing menggunakan pendekatan berikut:

```text
           E2E
            ▲
            │
      Integration
            ▲
            │
          Unit
```

---

# 83. Unit Testing Strategy

Tool:

```text
Vitest
```

Target:

* Service
* Utility
* Validator

---

## Coverage Minimum

Target:

```text
70%
```

Prioritas:

* Claim Service
* Sample Service
* PQA Service
* ID Generator

---

# 84. Integration Testing Strategy

Target:

* Repository
* API Routes
* Database Transaction

---

## Yang diuji

Claims:

* create
* update
* delete

Samples:

* create
* update

PQA:

* create
* update

Reports:

* generate

---

# 85. E2E Testing Strategy

Tool:

```text
Playwright
```

Browser:

```text
Chromium
```

---

# 86. Critical User Journeys

## Journey 1

Login

```text
Login
↓
Dashboard
↓
Logout
```

---

## Journey 2

Claim Flow

```text
Create Claim
↓
Update Claim
↓
Close Claim
```

---

## Journey 3

Sample Flow

```text
Create Sample
↓
Add Parts
↓
Update Status
```

---

## Journey 4

PQA Flow

```text
Create Summary
↓
Mark Shared
```

---

## Journey 5

Report Flow

```text
Generate Report
↓
Export Excel
```

---

## Journey 6

PDF Flow

```text
Open Claim
↓
Export PDF
```

---

# 87. Manual Testing Checklist

Semua form harus diuji terhadap:

## Valid Input

---

## Invalid Input

---

## Empty Input

---

## Duplicate Data

---

## Unauthorized Access

---

## Browser Refresh

---

## Slow Connection

---

# 88. UAT Strategy

User Acceptance Test dilakukan oleh:

## QRCC

Memvalidasi:

* Claim
* Sample
* PQA

---

## Supervisor

Memvalidasi:

* Dashboard
* Reports

---

## Admin

Memvalidasi:

* User
* Master Data

---

# 89. UAT Environment

Gunakan:

```text
Local Production Build
```

Bukan:

```text
pnpm dev
```

---

# 90. UAT Acceptance Checklist

## Authentication

* [ ] Login berhasil.
* [ ] Logout berhasil.
* [ ] Session berakhir sesuai aturan.

---

## Claims

* [ ] Tambah claim.
* [ ] Edit claim.
* [ ] Hapus claim.
* [ ] Search claim.
* [ ] Filter claim.
* [ ] Export PDF.

---

## Samples

* [ ] Tambah sample.
* [ ] Multi-part berjalan.
* [ ] Status berubah.

---

## PQA

* [ ] Tambah summary.
* [ ] Mark Shared.
* [ ] Attachment berjalan.

---

## Dashboard

* [ ] KPI tampil.
* [ ] Chart tampil.
* [ ] Filter berjalan.

---

## Reports

* [ ] Generate laporan.
* [ ] Edit notes.
* [ ] Export Excel.

---

# 91. Performance Targets

Dashboard:

```text
< 2 detik
```

---

Table:

```text
1000+ data tetap responsif
```

---

PDF Export:

```text
< 10 detik
```

---

Excel Export:

```text
< 5 detik
```

---

# 92. Security Testing Checklist

* [ ] Password tidak tersimpan plaintext.
* [ ] Route terlindungi.
* [ ] Viewer tidak dapat edit.
* [ ] File upload tervalidasi.
* [ ] Session timeout berjalan.
* [ ] Invalid request ditolak.

---

# 93. Backup Strategy

Database:

```text
SQLite
```

Lokasi:

```text
data/qc-tracker.db
```

---

## Backup Schedule

Harian.

Direkomendasikan:

```text
23:00
```

---

## Backup Files

```text
backup/
└─ YYYY-MM-DD/
   ├─ qc-tracker.db
   └─ uploads/
```

---

# 94. Recovery Strategy

Flow:

```text
Stop Application
↓
Restore DB
↓
Restore Uploads
↓
Start Application
↓
Smoke Test
```

---

# 95. Build Strategy

Build menggunakan:

```bash
pnpm build
```

Output:

```text
.output/
```

---

# 96. Development Commands

Install:

```bash
pnpm install
```

---

Development:

```bash
pnpm dev
```

---

Migration:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

Seed:

```bash
pnpm seed
```

---

Testing:

```bash
pnpm test
```

---

E2E:

```bash
pnpm test:e2e
```

---

Build:

```bash
pnpm build
```

---

Preview:

```bash
pnpm preview
```

---

# 97. First-Time Setup Guide

## Step 1

Clone repository.

---

## Step 2

Install dependency.

```bash
pnpm install
```

---

## Step 3

Copy environment.

```bash
cp .env.example .env
```

---

## Step 4

Generate migration.

```bash
pnpm drizzle-kit generate
```

---

## Step 5

Apply migration.

```bash
pnpm drizzle-kit migrate
```

---

## Step 6

Seed database.

```bash
pnpm seed
```

---

## Step 7

Run development server.

```bash
pnpm dev
```

---

# 98. Production Build Verification

Setelah build:

Pastikan:

* [ ] Login berjalan.
* [ ] Dashboard berjalan.
* [ ] Upload berjalan.
* [ ] PDF berjalan.
* [ ] Excel berjalan.
* [ ] Session berjalan.

---

# 99. Go-Live Checklist

Infrastructure:

* [ ] Folder uploads tersedia.
* [ ] Folder backup tersedia.
* [ ] Database tersedia.

---

Application:

* [ ] Build sukses.
* [ ] Preview sukses.
* [ ] Seeder admin tersedia.

---

Security:

* [ ] Secret diubah.
* [ ] Password admin diganti.
* [ ] Viewer telah diuji.

---

Business:

* [ ] UAT ditandatangani.
* [ ] User training dilakukan.
* [ ] SOP penggunaan tersedia.

---

# 100. Definition of Done (DoD)

Proyek dianggap selesai apabila:

## Functional

* [ ] Semua Acceptance Criteria MVP terpenuhi.

---

## Technical

* [ ] Semua migration berhasil.
* [ ] Build production berhasil.
* [ ] Tidak ada error kritis.

---

## Quality

* [ ] Unit test lulus.
* [ ] Integration test lulus.
* [ ] E2E test lulus.
* [ ] UAT lulus.

---

## Documentation

* [ ] README tersedia.
* [ ] Implementation Plan lengkap.
* [ ] Environment Guide tersedia.
* [ ] Backup Guide tersedia.

---

# 101. Future Backlog

Fitur setelah MVP:

## Phase 2

* Email Notification
* Reminder Sample
* Reminder PQA

---

## Phase 3

* Import Excel
* Bulk Update
* Advanced Dashboard

---

## Phase 4

* PostgreSQL Migration
* Audit Log Lengkap
* API Integration

---

## Phase 5

* Mobile Responsive Enhancement
* Multi-language
* SSO Integration

---

# 102. Project Success Criteria

Proyek dianggap sukses apabila:

* Waktu pembuatan laporan bulanan berkurang secara signifikan.
* Data claim tidak lagi tersebar di Excel.
* Pengguna aktif menggunakan sistem.
* Dashboard menjadi sumber informasi utama.
* Stakeholder dapat memantau status claim secara real-time.

---

# Final Deliverables

Dokumen ini menjadi acuan resmi implementasi MVP QC Market Quality Tracker.

Deliverables akhir:

* [ ] Source code Nuxt 4.
* [ ] SQLite database & migration.
* [ ] Better Auth integration.
* [ ] Claims Module.
* [ ] Samples Module.
* [ ] PQA Module.
* [ ] Dashboard.
* [ ] Reports & Excel Export.
* [ ] Claim Summary PDF Export.
* [ ] Testing Suite.
* [ ] Deployment Guide.
* [ ] User Acceptance Sign-Off.

---

# End of Document

Dengan selesainya Part 1–4, Implementation Plan ini dapat digunakan sebagai blueprint development dari tahap setup proyek hingga aplikasi QC Market Quality Tracker siap dijalankan di local server dan digunakan oleh tim QRCC.

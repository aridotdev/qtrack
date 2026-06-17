# Frontend — QC Market Quality Tracker

**Stack:** Nuxt 4 + Nuxt UI
**Layout:** Public (Login) · Default (semua halaman lain + sidebar navigasi)

---

## Halaman & Elemen

---

### 1. Login `/login`

**Elemen:**
- Input email
- Input password
- Tombol Login

**Flow user:**
1. User buka aplikasi → diarahkan ke `/login`
2. Isi email dan password → klik Login
3. Jika berhasil → masuk ke `/dashboard`
4. Jika gagal → tampil pesan error di form

---

### 2. Dashboard `/dashboard`

**Elemen:**
- Filter: Date Range, Product, Model
- KPI Cards: Total Claim · Open · Waiting PQA · Closed
- Chart Trend: jumlah claim 12 bulan terakhir
- Chart Top Defect: 5 jenis defect terbanyak
- Tabel 10 claim terbaru

**Flow user:**
1. User buka dashboard → data langsung tampil
2. User ubah filter → data otomatis berubah tanpa reload
3. User klik baris claim di tabel → masuk ke detail claim

---

### 3. Claims `/claims`

**Elemen:**
- Search bar
- Filter: Status, Product, Model, Date Range
- Tabel claim (Claim Code · Product · Model · Defect · Status · Tanggal)
- Badge status per baris
- Tombol Tambah Claim (Admin & QRCC)
- Tombol aksi per baris: Edit · Hapus

**Flow user:**
1. User buka halaman → tabel tampil dengan pagination
2. User cari / filter → hasil berubah real-time
3. User klik Tambah → form claim terbuka (modal atau halaman baru)
4. User isi form → submit → claim muncul di tabel
5. User klik baris → masuk ke detail claim
6. User klik Edit → form terisi data lama → simpan → tabel diperbarui
7. User klik Hapus → konfirmasi → claim dihapus

---

### 4. Detail Claim `/claims/[id]`

**Elemen:**
- Info claim: Claim Code, Product, Model, Defect, Source, Description
- Badge status + tombol ubah status (quick update)
- Timeline status (riwayat perubahan status)
- Section Sample terkait (link ke sample)
- Section PQA Summary terkait
- Section Attachment (daftar file + tombol upload)
- Tombol Export PDF

**Flow user:**
1. User buka halaman → semua info dan section langsung tampil
2. User ubah status → status diperbarui, timeline bertambah
3. User upload attachment → file muncul di daftar
4. User klik Export PDF → file PDF terunduh

---

### 5. Samples `/samples`

**Elemen:**
- Filter: Status, Claim terkait
- Tabel sample (Sample Code · Claim · Receiver · Status · Tanggal)
- Badge status + badge OVERDUE jika >7 hari tanpa update
- Tombol Tambah Sample
- Tombol aksi per baris: Edit

**Flow user:**
1. User buka halaman → tabel tampil
2. User klik Tambah → form terbuka (isi receiver, tanggal kirim, minimal 1 part)
3. User tambah/edit/hapus part di Sample Parts Editor
4. User submit → sample muncul di tabel
5. User klik Edit → form muncul dengan data lama → simpan → tabel diperbarui

---

### 6. PQA Summary `/pqa`

**Elemen:**
- Filter: Status Implementasi, CS Shared
- Tabel PQA (Claim · Sample · Root Cause · Status · CS Shared)
- Badge status implementasi + CS shared
- Tombol Tambah PQA
- Tombol Mark as Shared per baris
- Tombol aksi: Edit

**Flow user:**
1. User buka halaman → tabel tampil
2. User klik Tambah → form terbuka (pilih claim, sample; isi root cause, rekomendasi)
3. User submit → PQA muncul di tabel
4. User klik Mark as Shared → status CS Shared berubah ke SHARED, waktu tercatat otomatis
5. User klik Edit → form muncul → simpan

---

### 7. Reports `/reports`

**Elemen:**
- Pilih bulan & tahun
- Tombol Generate Laporan
- Form Notes (input teks bebas)
- Tombol Finalize
- Tombol Export Excel
- Riwayat laporan bulan sebelumnya

**Flow user:**
1. User pilih bulan & tahun → klik Generate
2. Sistem membuat laporan otomatis dari data bulan tersebut
3. User tambah/edit notes → simpan
4. User klik Finalize → laporan dikunci
5. User klik Export Excel → file Excel terunduh

---

### 8. Master Data `/master`

> Hanya Admin yang bisa mengakses halaman ini.

**Elemen:**
- Tab navigasi: Products · Models · Defect Types · Users
- Tiap tab: tabel data + tombol Tambah + tombol Edit/Hapus per baris

**Flow user:**
1. Admin buka halaman → tab Products aktif
2. Admin pindah tab untuk kelola data lain
3. Admin tambah / edit / hapus item di tiap tab
4. Untuk Users: Admin buat user baru dengan password sementara → user login → ganti password

---

### 9. Profile `/profile`

**Elemen:**
- Tampilan: Nama, Email, Role (read-only)
- Form edit nama
- Form ganti password (password lama · password baru · konfirmasi)
- Tombol Simpan

**Flow user:**
1. User buka halaman → data profil tampil
2. User edit nama → simpan → nama diperbarui
3. User ganti password → isi form → simpan → notifikasi sukses

---

## Navigasi Sidebar

| Menu | Admin | QRCC | Viewer |
|------|-------|------|--------|
| Dashboard | ✓ | ✓ | ✓ |
| Claims | ✓ | ✓ | read-only |
| Samples | ✓ | ✓ | — |
| PQA Summary | ✓ | ✓ | — |
| Reports | ✓ | ✓ | read-only |
| Master Data | ✓ | — | — |
| Profile | ✓ | ✓ | ✓ |
| Logout | ✓ | ✓ | ✓ |

---

## Standar UI (berlaku di semua halaman)

- **Tabel:** wajib ada pagination, search, sort, filter, loading state (skeleton), dan empty state
- **Form:** validasi Zod sebelum submit; tampil pesan error per field
- **Notifikasi:** toast sukses / error / warning setelah setiap aksi
- **Loading:** gunakan skeleton saat data sedang dimuat
- **Aksi destruktif** (hapus, finalize): selalu minta konfirmasi terlebih dahulu

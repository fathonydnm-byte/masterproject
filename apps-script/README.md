# 🌿 Master Project Tracker — Panduan Setup

Template dashboard project tracker aesthetic untuk Google Sheets, dengan:

- ✅ Checkbox per to-do yang otomatis menghitung progress
- 🌱 "Tanaman" yang makin subur (emoji) sesuai % to-do selesai per project, sampai 🌸 mekar penuh di 100% — ikonnya **bisa diganti bebas langsung dari sheet Config**, tanpa sentuh kode
- 🔗 To-do bisa diklik langsung sebagai hyperlink ke folder resource/bukti (Google Drive, dsb.), lewat kolom **Link** tersendiri
- 📅 **Deadline diisi per to-do** (bukan per project) — tiap to-do punya kolom Deadline & Sisa Waktu sendiri
- ⏳ Countdown otomatis ("Xh Yj lagi") per to-do, plus ringkasan "deadline terdekat" di judul tiap project
- ↕️ Project yang punya to-do dengan sisa waktu paling sedikit otomatis naik ke paling atas

---

## 1. Instalasi (sekali saja, ±5 menit)

1. Buka spreadsheet **MASTER PROJECT** Anda di Google Sheets.
2. Klik menu **Extensions (Ekstensi) > Apps Script**.
3. Akan terbuka editor kode. Hapus semua isi default di file `Code.gs`.
4. Buka file [`Code.gs`](./Code.gs) di folder ini, copy **seluruh isinya**, lalu paste ke editor Apps Script.
5. Simpan project (ikon 💾 atau `Ctrl/Cmd + S`). Beri nama project bebas, misal "Master Project Tracker".
6. Di toolbar atas editor Apps Script, pastikan fungsi yang dipilih adalah **`renderDashboard`**, lalu klik tombol **▶ Run**.
7. Google akan minta izin akses (**Authorization required**) — ini normal karena script perlu mengakses spreadsheet Anda sendiri:
   - Klik **Review permissions**
   - Pilih akun Google Anda
   - Akan muncul peringatan "Google hasn't verified this app" — klik **Advanced** > **Go to (nama project) (unsafe)** — ini aman karena ini adalah script milik Anda sendiri, bukan aplikasi pihak ketiga.
   - Klik **Allow**.
8. Setelah selesai jalan tanpa error (lihat log di bawah, harus kosong/selesai), **kembali ke tab spreadsheet Anda dan refresh halaman (F5)**.
9. Menu baru **"🌿 Master Project"** akan muncul di menu bar spreadsheet, dan sheet `⚙️ Config` serta `🌿 Dashboard` akan otomatis terbentuk lengkap dengan data contoh.

Selesai! Sekarang Anda tinggal edit sheet `⚙️ Config` untuk isi nama project, lalu isi to-do & deadline langsung di sheet Dashboard.

---

## 2. Cara Pakai Sehari-hari

### Mengisi/mengubah daftar project
Buka sheet **`⚙️ Config`**:

| No | Nama Project | Catatan |
|----|---------------|---------|
| 1  | Project A     | (opsional, bebas diisi apa saja) |

- Ganti `Nama Project` sesuai project asli Anda. Kolom `Catatan` bebas, tidak dipakai untuk perhitungan apa pun.
- Tersedia **8 slot project**. Kalau butuh lebih banyak, tinggal ubah angka `MAX_PROJECTS` di baris atas `Code.gs` (lihat bagian Kustomisasi).
- Setiap kali Anda edit sheet Config (ganti nama/tambah project), **Dashboard otomatis menyesuaikan** — data to-do yang sudah Anda isi di Dashboard tidak akan hilang.
- Config sheet ini **tidak lagi punya kolom Deadline** — deadline sekarang diisi per to-do langsung di Dashboard (lihat di bawah).

### Mengisi to-do per project
Buka sheet **`🌿 Dashboard`**. Baris ke-4 (selalu kelihatan, ikut ter-freeze di atas) berisi label kolom supaya tidak pernah ambigu kolom mana untuk apa:

| No | To-Do | Selesai | 🔗 Link | 📅 Deadline | ⏳ Sisa Waktu |
|----|-------|---------|---------|-------------|----------------|

Setiap project punya blok berisi:

- **Baris judul** (hijau): nama project, status "tanaman" + %, dan **ringkasan deadline terdekat** dari to-do di project itu.
- **10 baris to-do** di bawahnya, dari kiri ke kanan:
  - **No** — nomor urut 1–10, otomatis, hanya penanda urutan/kapasitas
  - **To-Do** — ketik deskripsi tugasnya
  - **Selesai** — checkbox, klik untuk tandai selesai
  - **🔗 Link** — paste URL Google Drive folder/file bukti pengerjaan
  - **📅 Deadline** — klik cell lalu pilih tanggal dari date-picker Sheets (boleh juga ketik tanggal+jam kalau mau jam spesifik; kalau cuma tanggal, otomatis dianggap berlaku sampai jam 23:59 hari itu)
  - **⏳ Sisa Waktu** — otomatis terisi begitu Deadline diisi, live, tidak perlu diisi manual

Begitu kolom **🔗 Link** diisi, teks to-do di sebelahnya **otomatis berubah jadi hyperlink biru** (klik teksnya = buka link). Kalau kolom Link dikosongkan lagi, teks kembali jadi teks biasa.

Countdown **⏳ Sisa Waktu** dan ringkasan **deadline terdekat** di judul project langsung live begitu Deadline diisi (formula, bukan script) — tidak ada jeda/render ulang sama sekali. Yang BELUM langsung berubah saat itu juga adalah **urutan blok project** (lihat Auto-sort di bawah) — supaya Anda bisa isi banyak deadline berturut-turut dengan mulus tanpa sheet "freeze" tiap satu diisi.

### Progress "tanaman" & countdown
Keduanya **hidup otomatis** (formula, bukan script) — begitu Anda centang checkbox, emoji tanaman & persentase langsung berubah tanpa perlu refresh apa pun. Tahapannya:

| % Selesai | Tampilan |
|-----------|----------|
| Belum ada to-do diisi sama sekali | 📋 Belum ada to-do |
| 0% (ada to-do, belum ada yang dicentang) | 🌰 0% |
| >0% – 24% | 🌱 |
| 25% – 49% | 🌿 |
| 50% – 74% | 🍀 |
| 75% – 99% | 🌳 |
| 100% | 🌸🌸🌸 100% Mekar! |

Ganti checklist yang sudah tercentang otomatis membuat teks to-do-nya **tercoret**, dan kalau kolom Link diisi teks to-do tetap tampil sebagai **hyperlink biru** (walau sudah dicoret) supaya tetap bisa diklik.

### Auto-sort berdasarkan deadline
Urutan **blok project** (bukan countdown-nya, yang sudah live) disegarkan saat file **dibuka**, atau saat Anda klik menu **🌿 Master Project > 🔄 Refresh & Sort Dashboard** — sengaja tidak otomatis setiap satu Deadline diisi, supaya mengisi banyak to-do/deadline sekaligus tetap mulus tanpa sheet berhenti sesaat tiap kali. Saat disegarkan, seluruh blok project akan disusun ulang — project yang punya **to-do dengan sisa waktu paling sedikit** otomatis pindah ke paling atas. Urutan ditentukan dari to-do TERDEKAT di masing-masing project (bukan rata-rata), dan project tanpa deadline sama sekali ditaruh paling bawah. Urutan to-do **di dalam** satu project tidak ikut diacak — tetap sesuai urutan yang Anda ketik/susun sendiri. Data to-do & checklist yang sudah diisi tetap aman, hanya posisi bloknya yang berpindah.

### Menu tersedia
Klik menu **🌿 Master Project** di menu bar spreadsheet:

- **🔄 Refresh & Sort Dashboard** — susun ulang urutan project & sinkronkan dari Config (aman, tidak menghapus data).
- **🚀 Build Ulang dari Nol** — **menghapus semua** teks to-do/link/checklist di Dashboard dan membangunnya kosong lagi dari Config (akan minta konfirmasi dulu). Pakai ini kalau ingin mulai bersih total.
- **🧹 Uncheck Semua To-Do** — uncheck semua checkbox sekaligus (misal untuk memulai siklus baru), teks & link tidak ikut terhapus.

---

## 3. Batasan yang Perlu Diketahui

- Google Sheets **tidak bisa animasi real-time** (misal jam yang ticking tiap detik) tanpa panel terpisah. Countdown & progress di template ini **auto-update otomatis** setiap kali Anda membuka file, mengklik checkbox, atau melakukan perubahan apa pun di sheet (dan setidaknya sekali per menit sesuai pengaturan recalculation Google Sheets) — cukup untuk mengingatkan sisa waktu setiap kali dibuka, hanya bukan angka yang berjalan sendiri detik demi detik.
- Nama project di sheet Config **sebaiknya unik** — dipakai sebagai kunci untuk mencocokkan data to-do saat sinkronisasi/urut ulang.
- Jangan edit struktur baris/kolom di sheet Dashboard secara manual (insert/delete row, merge/unmerge) — biarkan script yang mengatur. Anda bebas mengedit isi checkbox, teks to-do, dan kolom link.

---

## 4. Kustomisasi

Semua bisa diubah di bagian atas `Code.gs`:

```js
const MAX_PROJECTS = 8;   // jumlah maksimum project
const MAX_TODOS    = 10;  // jumlah maksimum to-do per project
```

```js
const THEME = {
  bannerBg:   '#3f5e4a',  // warna header utama
  headerBg:   '#8a9a5b',  // warna header tiap blok project
  bandLight:  '#f3f6ec',  // warna latar baris to-do
  ...
};
```

**Ganti emoji/ikon tahapan tanaman — TANPA sentuh kode sama sekali.** Buka sheet **`⚙️ Config`**, geser ke kolom **E-F**, ada tabel **"🎨 Pengaturan Ikon Progress"**:

| Tahap | Ikon / Teks |
|-------|-------------|
| Belum ada to-do sama sekali | 📋 Belum ada to-do |
| 0% (ada to-do, belum ada yang selesai) | 🌰 |
| 1% – 24% selesai | 🌱 |
| 25% – 49% selesai | 🌿 |
| 50% – 74% selesai | 🍀 |
| 75% – 99% selesai | 🌳 |
| 100% selesai (semua tercentang) | 🌸🌸🌸 100% Mekar! |

Tinggal klik sel di kolom **Ikon / Teks** dan ganti isinya apa saja sesuai selera (boleh emoji lain sama sekali — 🔥/🚀/⭐/dst — atau bahkan teks biasa). Semua judul project di Dashboard mengambil nilainya langsung dari tabel ini lewat formula, jadi:

- **Perubahan langsung terlihat seketika**, tidak perlu klik Refresh atau Run apa pun.
- **Tidak akan pernah ditimpa ulang** oleh Refresh & Sort Dashboard maupun Build Ulang dari Nol — tabel ini murni milik Anda, script hanya membuatnya sekali di awal kalau belum ada, sesudah itu tidak disentuh lagi.

⚠️ Kalau ganti emoji, pilih yang sudah lama ada di Unicode (bukan emoji baru rilis 1–2 tahun terakhir) — beberapa emoji baru belum didukung penuh oleh semua font/OS dan bisa tampil sebagai kotak kosong (persis bug 🪴 yang diperbaiki di versi ini). Cara amannya: coba dulu satu emoji di sebuah cell kosong biasa di Sheets, kalau tampil normal berarti aman dipakai.

Untuk perubahan lain di atas (`MAX_PROJECTS`, `MAX_TODOS`, `THEME`) yang memang perlu edit `Code.gs`, klik **▶ Run** pada fungsi `renderDashboard` sekali lagi (atau pakai menu **🔄 Refresh & Sort Dashboard**) agar diterapkan.

Kalau menambah `MAX_PROJECTS`, ingat juga menambah baris di sheet Config secara manual (isi kolom No & Nama Project) untuk slot tambahan tersebut.

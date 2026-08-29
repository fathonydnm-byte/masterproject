# 🌿 Master Project Tracker — Panduan Setup

Template dashboard project tracker aesthetic untuk Google Sheets, dengan:

- ✅ Checkbox per to-do yang otomatis menghitung progress
- 🌱 "Tanaman" yang makin subur (emoji) sesuai % to-do selesai per project, sampai 🌸 mekar penuh di 100%
- 🔗 To-do bisa diklik langsung sebagai hyperlink ke folder resource/bukti (Google Drive, dsb.)
- ⏳ Countdown deadline otomatis ("X hari Y jam lagi") per project
- ↕️ Project dengan sisa waktu paling sedikit otomatis naik ke paling atas

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

Selesai! Sekarang Anda tinggal edit sheet `⚙️ Config` untuk isi project & deadline asli Anda.

---

## 2. Cara Pakai Sehari-hari

### Mengisi/mengubah project & deadline
Buka sheet **`⚙️ Config`**:

| No | Nama Project | Deadline (Tanggal) | Deadline (Jam) | Catatan |
|----|---------------|---------------------|------------------|---------|
| 1  | Project A     | 2026-09-05          | (kosongkan = default 23:59) | |

- Ganti `Nama Project` sesuai project asli Anda.
- Isi `Deadline (Tanggal)` — wajib diisi agar countdown & auto-sort berfungsi.
- `Deadline (Jam)` boleh dikosongkan (otomatis dianggap jam 23:59).
- Tersedia **8 slot project**. Kalau butuh lebih banyak, tinggal ubah angka `MAX_PROJECTS` di baris atas `Code.gs` (lihat bagian Kustomisasi).
- Setiap kali Anda edit sheet Config, **Dashboard otomatis menyesuaikan** (nama, deadline, urutan) — data to-do yang sudah Anda isi di Dashboard tidak akan hilang.

### Mengisi to-do per project
Buka sheet **`🌿 Dashboard`**. Setiap project punya blok berisi:

- **Baris judul** (hijau): nama project, status "tanaman" + %, dan countdown deadline.
- **10 baris to-do** di bawahnya, dari kiri ke kanan:
  - Kolom **No.** — nomor urut 1–10, otomatis, hanya penanda urutan/kapasitas
  - Kolom **teks to-do** (ketik deskripsi tugasnya)
  - Kolom **checkbox** (klik untuk tandai selesai)
  - Kolom **Link** (paste URL Google Drive folder/file bukti pengerjaan)

Begitu kolom Link diisi, teks to-do di sebelahnya **otomatis berubah jadi hyperlink** (klik teksnya = buka link). Kalau kolom Link dikosongkan lagi, teks kembali jadi teks biasa.

### Progress "tanaman" & countdown
Keduanya **hidup otomatis** (formula, bukan script) — begitu Anda centang checkbox, emoji tanaman & persentase langsung berubah tanpa perlu refresh apa pun. Tahapannya:

| % Selesai | Tampilan |
|-----------|----------|
| 0% (belum ada to-do dicentang) | 🌰 0% |
| >0% – 24% | 🌱 |
| 25% – 49% | 🌿 |
| 50% – 74% | 🪴 |
| 75% – 99% | 🌳 |
| 100% | 🌸🌸🌸 100% Mekar! |

### Auto-sort berdasarkan deadline
Setiap kali file **dibuka**, atau Anda klik menu **🌿 Master Project > 🔄 Refresh & Sort Dashboard**, seluruh blok project akan disusun ulang — project dengan **sisa waktu paling sedikit otomatis pindah ke paling atas**. Data to-do & checklist yang sudah diisi tetap aman, hanya posisi bloknya yang berpindah.

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

Setelah mengubah, klik **▶ Run** pada fungsi `renderDashboard` sekali lagi (atau pakai menu **🚀 Build Ulang dari Nol**) agar perubahan diterapkan.

Kalau menambah `MAX_PROJECTS`, ingat juga menambah baris di sheet Config secara manual (isi kolom No, Nama Project, Deadline) untuk slot tambahan tersebut.

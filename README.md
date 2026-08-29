# Master Project — Project Tracker Dashboard 🌿

Dashboard project tracker aesthetic berbasis Google Sheets + Google Apps Script.

Spreadsheet target: [MASTER PROJECT](https://docs.google.com/spreadsheets/d/1wpTqVM5mbfC5aaKC49gnJomoO9Q7Y6qVyfi4fYYcXas/edit)

## Fitur

- List project ke bawah, masing-masing dengan daftar to-do bercheckbox, bernomor urut.
- Progress tiap project divisualisasikan sebagai "tanaman" (emoji) yang makin subur — dari 🌰 sampai 🌸 mekar penuh di 100%, dihitung otomatis dari checkbox yang dicentang.
- Setiap to-do bisa diklik sebagai hyperlink ke folder resource/bukti (Google Drive, dsb.) lewat kolom Link tersendiri.
- Deadline & countdown diisi per to-do (kolom Deadline + Sisa Waktu sendiri-sendiri), auto-update live setiap kali sheet dibuka/diedit.
- Project yang punya to-do dengan sisa waktu paling sedikit otomatis naik ke paling atas dashboard.

## Lokasi kode

Seluruh source code Apps Script dan panduan setup ada di [`apps-script/`](./apps-script):

- [`apps-script/Code.gs`](./apps-script/Code.gs) — kode Apps Script lengkap
- [`apps-script/README.md`](./apps-script/README.md) — panduan instalasi & pemakaian langkah demi langkah

Mulai dari situ untuk memasang dashboard ke spreadsheet Anda.

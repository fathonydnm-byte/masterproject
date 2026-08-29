# Master Project — Project Tracker Dashboard 🌿

Dashboard project tracker aesthetic berbasis Google Sheets + Google Apps Script.

Spreadsheet target: [MASTER PROJECT](https://docs.google.com/spreadsheets/d/1wpTqVM5mbfC5aaKC49gnJomoO9Q7Y6qVyfi4fYYcXas/edit)

## Fitur

- List project ke bawah, masing-masing dengan daftar to-do bercheckbox.
- Progress tiap project divisualisasikan sebagai "tanaman" (emoji) yang makin subur — dari 🌰 sampai 🌸 mekar penuh di 100%, dihitung otomatis dari checkbox yang dicentang.
- Setiap to-do bisa diklik sebagai hyperlink ke folder resource/bukti (Google Drive, dsb.) begitu link diisi.
- Countdown deadline otomatis per project ("X hari Y jam lagi"), auto-update setiap kali sheet dibuka/diedit.
- Project dengan sisa waktu paling sedikit otomatis naik ke paling atas dashboard.

## Lokasi kode

Seluruh source code Apps Script dan panduan setup ada di [`apps-script/`](./apps-script):

- [`apps-script/Code.gs`](./apps-script/Code.gs) — kode Apps Script lengkap
- [`apps-script/README.md`](./apps-script/README.md) — panduan instalasi & pemakaian langkah demi langkah

Mulai dari situ untuk memasang dashboard ke spreadsheet Anda.

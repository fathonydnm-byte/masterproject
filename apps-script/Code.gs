/**
 * ========================================================================
 * 🌿 MASTER PROJECT TRACKER — Apps Script Engine
 * ========================================================================
 * Dibuat khusus untuk spreadsheet "MASTER PROJECT".
 *
 * CARA PAKAI (lihat README.md untuk panduan lengkap bergambar):
 *   1. Buka spreadsheet Anda di Google Sheets.
 *   2. Extensions > Apps Script.
 *   3. Hapus isi default "Code.gs", paste seluruh isi file ini.
 *   4. Simpan (Ctrl/Cmd+S), lalu jalankan fungsi `renderDashboard` sekali
 *      dari toolbar Apps Script (tombol ▶ Run) untuk memberi izin akses.
 *   5. Kembali ke spreadsheet, refresh halaman. Menu "🌿 Master Project"
 *      akan muncul di menu bar dan dashboard akan otomatis terbentuk.
 *
 * FILOSOFI DESAIN:
 *   - Deadline & countdown ada di level TIAP TO-DO (bukan per project).
 *     Progress "tanaman" & ringkasan deadline terdekat per project dihitung
 *     via FORMULA sheet (bukan script) → selalu live setiap kali Sheets
 *     recalculate (buka file, edit apa saja, atau sekali per menit).
 *   - Script hanya bertanggung jawab untuk: membangun struktur blok
 *     project, menyusun ulang urutan BLOK PROJECT berdasarkan to-do
 *     dengan deadline paling dekat di project itu, dan menempelkan
 *     hyperlink + strikethrough ke teks to-do.
 *   - Setiap render TIDAK menghapus data Anda — teks to-do, link, deadline,
 *     dan status checklist yang sudah ada akan dibaca dulu lalu ditulis
 *     ulang di posisi barunya (preserve-by-name).
 * ========================================================================
 */

// ------------------------------------------------------------------------
// KONFIGURASI DASAR — silakan sesuaikan angka ini kalau perlu
// ------------------------------------------------------------------------
const CONFIG_SHEET_NAME = '⚙️ Config';
const DASH_SHEET_NAME   = '🌿 Dashboard';

const MAX_PROJECTS = 8;   // jumlah maksimum project (slot) di Config
const MAX_TODOS    = 10;  // jumlah maksimum to-do per project

const FIRST_BLOCK_ROW = 5;             // baris pertama blok project di Dashboard
const BLOCK_HEIGHT    = MAX_TODOS + 2; // 1 header + N to-do + 1 spacer

// Kolom di sheet Dashboard — semua kolom tampil (tidak ada yang disembunyikan)
// (baris to-do)  A=No · B=To-Do · C=Selesai(checkbox) · D=Link · E=Deadline · F=Sisa Waktu
// (baris header) A:B=nama project (merge) · C=plant/% · D:E=merge (deadline terdekat) · F=(kosong)
const COL_NUM       = 1; // A — nomor urut to-do / bagian merge nama project
const COL_TODO      = 2; // B — teks to-do (jadi hyperlink kalau ada link)
const COL_CHECK     = 3; // C — checkbox (baris to-do) / plant % (header)
const COL_LINK      = 4; // D — URL folder/bukti (baris to-do)
const COL_DEADLINE  = 5; // E — deadline to-do ini (tanggal, opsional jam)
const COL_COUNTDOWN = 6; // F — sisa waktu to-do ini (live formula)

// Kolom di sheet Config — daftar project (A-C)
const CFG_COL_NO   = 1;
const CFG_COL_NAME = 2;
const CFG_COL_NOTE = 3;

// Kolom di sheet Config — tabel Pengaturan Ikon Progress (E-F), terpisah
// dari daftar project supaya lebar kolom tidak saling bentrok.
const ICON_COL_LABEL = 5; // E
const ICON_COL_VALUE = 6; // F
const ICON_FIRST_ROW = 3; // baris pertama tabel ikon (setelah judul & header)

// Urutan tahap HARUS selaras dengan urutan baris di tabel Pengaturan Ikon.
// `default` hanya dipakai sekali saat tabel ini pertama kali dibuat — sesudah
// itu nilainya 100% milik Anda, boleh diedit bebas di sheet Config kapan pun,
// dan TIDAK PERNAH ditimpa ulang oleh script (lihat ensureIconSettings_).
const ICON_STAGES = [
  { key: 'empty', label: 'Belum ada to-do sama sekali', default: '📋 Belum ada to-do' },
  { key: 'zero',  label: '0% (ada to-do, belum ada yang selesai)', default: '🌰' },
  { key: 'p1',    label: '1% – 24% selesai', default: '🌱' },
  { key: 'p25',   label: '25% – 49% selesai', default: '🌿' },
  { key: 'p50',   label: '50% – 74% selesai', default: '🍀' },
  { key: 'p75',   label: '75% – 99% selesai', default: '🌳' },
  { key: 'full',  label: '100% selesai (semua tercentang)', default: '🌸🌸🌸 100% Mekar!' },
];
const ICON_TABLE_TITLE = '🎨 Pengaturan Ikon Progress (edit bebas, tidak akan ditimpa ulang)';

// Tema warna — Earthy Green & Cream
const THEME = {
  bannerBg:     '#3f5e4a',
  bannerText:   '#faf7ef',
  headerBg:     '#8a9a5b',
  headerText:   '#ffffff',
  bandLight:    '#f3f6ec',
  bandLightAlt: '#e8efdc',
  spacerBg:     '#dfe7d3',
  cream:        '#faf7ef',
  textDark:     '#33402e',
  border:       '#c8d3b8',
};

// ------------------------------------------------------------------------
// MENU & ENTRY POINTS
// ------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌿 Master Project')
    .addItem('🔄 Refresh & Sort Dashboard', 'renderDashboard')
    .addItem('🚀 Build Ulang dari Nol (hapus semua isi)', 'confirmHardReset')
    .addSeparator()
    .addItem('🧹 Uncheck Semua To-Do', 'resetAllCheckboxes')
    .addToUi();

  // Setiap kali file dibuka, urutan project langsung disegarkan
  // berdasarkan to-do dengan sisa waktu paling dekat di tiap project.
  renderDashboard();
}

/**
 * Dipicu otomatis oleh Google Sheets setiap ada perubahan cell (simple
 * trigger, tidak perlu otorisasi tambahan). Dipakai untuk:
 *   - Sinkron ulang Dashboard saat daftar project di Config diubah.
 *   - Menempelkan hyperlink + strikethrough saat teks/link/checkbox diedit.
 *   (Mengubah Deadline TIDAK memicu render ulang penuh — lihat catatan di
 *    dalam blok DASH_SHEET_NAME di bawah.)
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    if (sheetName === CONFIG_SHEET_NAME) {
      renderDashboard();
      return;
    }

    if (sheetName === DASH_SHEET_NAME) {
      // Catatan: mengubah Deadline SENGAJA tidak memicu render ulang penuh
      // di sini (dulu begitu, tapi bikin sheet "freeze" sesaat tiap kali
      // satu deadline diisi). Countdown per to-do & ringkasan "deadline
      // terdekat" di header project tetap live lewat FORMULA, jadi langsung
      // ter-update sendiri tanpa script. Urutan BLOK project (siapa naik ke
      // atas) baru disegarkan saat file dibuka lagi, atau lewat menu
      // 🔄 Refresh & Sort Dashboard — supaya Anda bisa isi banyak deadline
      // berturut-turut dengan mulus, baru urutkan ulang saat sudah selesai.
      const startRow = e.range.getRow();
      const numRows = e.range.getNumRows();

      // Loop semua baris yang tersentuh (menangani juga paste banyak baris
      // sekaligus), lalu terapkan ulang style to-do (hyperlink + strikethrough)
      // untuk setiap baris to-do yang kena — karena teks, link, atau checkbox.
      for (let row = startRow; row < startRow + numRows; row++) {
        if (row < FIRST_BLOCK_ROW) continue;
        const offset = (row - FIRST_BLOCK_ROW) % BLOCK_HEIGHT;
        const isTodoRow = offset >= 1 && offset <= MAX_TODOS;
        if (!isTodoRow) continue;
        styleTodoRow_(sheet, row);
      }
    }
  } catch (err) {
    console.error('onEdit error: ' + err);
  }
}

// ------------------------------------------------------------------------
// FUNGSI UTAMA: renderDashboard
// ------------------------------------------------------------------------
/**
 * Fungsi inti — aman dipanggil kapan saja (menu, onOpen, onEdit).
 * 1. Baca daftar project dari Config (nama saja).
 * 2. Baca data to-do (teks, checklist, link, deadline) yang sudah ada di
 *    Dashboard saat ini (preserve).
 * 3. Urutkan project berdasarkan to-do dengan deadline PALING DEKAT di
 *    masing-masing project (tercepat di atas; project tanpa deadline sama
 *    sekali ditaruh paling bawah).
 * 4. Tulis ulang seluruh isi Dashboard dengan urutan baru.
 */
function renderDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = getOrCreateConfigSheet_(ss);
  const dashSheet = getOrCreateDashSheet_(ss);
  ensureConfigHeader_(configSheet);
  ensureIconSettings_(configSheet);

  const configProjects = readConfigProjects_(configSheet);
  const preserved = readExistingDashboardData_(dashSheet);
  const isFirstBuild = Object.keys(preserved).length === 0 && isDashboardBodyEmpty_(dashSheet);

  // Pengaman anti data-hilang: kalau Config tiba-tiba tidak punya nama
  // project SAMA SEKALI padahal Dashboard masih menyimpan to-do (misal
  // header/isi Config tidak sengaja terhapus/ter-merge), batalkan render
  // daripada menulis ulang Dashboard jadi kosong total. Kalau memang mau
  // menghapus semua project dengan sengaja, gunakan menu
  // 🚀 Build Ulang dari Nol yang sudah minta konfirmasi eksplisit.
  if (configProjects.length === 0 && Object.keys(preserved).length > 0) {
    SpreadsheetApp.getUi().alert(
      '⚠️ Render dibatalkan — cek sheet Config',
      'Sheet Config tidak terbaca punya nama project sama sekali, padahal Dashboard masih menyimpan ' +
        'data to-do. Supaya data tidak hilang, render dibatalkan.\n\n' +
        'Cek sheet ⚙️ Config: pastikan header baris 1 (No / Nama Project / Catatan) dan nama-nama ' +
        'project di kolom B masih ada & tidak ter-merge/ter-hapus. Setelah diperbaiki, jalankan lagi ' +
        'menu 🔄 Refresh & Sort Dashboard.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const projects = configProjects.map((p) => {
    const todos = preserved[p.name] || null;
    return { name: p.name, todos, nearest: nearestDeadline_(todos) };
  });

  projects.sort((a, b) => {
    const av = a.nearest ? a.nearest.getTime() : Infinity;
    const bv = b.nearest ? b.nearest.getTime() : Infinity;
    return av - bv;
  });

  ensureHeaderBanner_(dashSheet);
  clearDashboardBody_(dashSheet);

  projects.forEach((proj, idx) => {
    const startRow = FIRST_BLOCK_ROW + idx * BLOCK_HEIGHT;
    let todos = proj.todos;
    if (!todos && isFirstBuild && idx === 0) {
      todos = sampleTodos_();
    }
    writeProjectBlock_(dashSheet, startRow, proj.name, todos || []);
  });

  SpreadsheetApp.flush();
}

function nearestDeadline_(todos) {
  if (!todos) return null;
  let min = null;
  todos.forEach((t) => {
    if (!t.deadline) return;
    const eff = effectiveDeadline_(t.deadline);
    if (!min || eff.getTime() < min.getTime()) min = eff;
  });
  return min;
}

/**
 * Kalau to-do cuma diisi TANGGAL (jam masih 00:00:00), deadline dianggap
 * berlaku sampai akhir hari itu (23:59:59). Kalau user memang mengetik jam
 * spesifik, jam itu yang dipakai apa adanya.
 */
function effectiveDeadline_(dateVal) {
  if (!(dateVal instanceof Date)) return null;
  const d = new Date(dateVal.getTime());
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    d.setHours(23, 59, 59, 0);
  }
  return d;
}

// ------------------------------------------------------------------------
// CONFIG SHEET
// ------------------------------------------------------------------------
function getOrCreateConfigSheet_(ss) {
  let sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (sheet) return sheet;

  sheet = ss.insertSheet(CONFIG_SHEET_NAME);
  sheet.getRange(1, 1, 1, 3).setValues([['No', 'Nama Project', 'Catatan']]);
  sheet.getRange(1, 1, 1, 3)
    .setBackground(THEME.bannerBg)
    .setFontColor(THEME.bannerText)
    .setFontWeight('bold');

  const sample = [
    [1, 'Project A', 'Contoh: ganti dengan nama project asli Anda. Deadline diisi per to-do di sheet Dashboard.'],
    [2, 'Project B', ''],
    [3, 'Project C', ''],
  ];
  sheet.getRange(2, 1, sample.length, 3).setValues(sample);

  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 380);
  sheet.setFrozenRows(1);

  const remaining = MAX_PROJECTS - sample.length;
  if (remaining > 0) {
    const nums = [];
    for (let i = 0; i < remaining; i++) nums.push([sample.length + i + 1]);
    sheet.getRange(2 + sample.length, 1, remaining, 1).setValues(nums);
  }

  return sheet;
}

/**
 * Pengaman self-healing: kalau header baris 1 (No / Nama Project / Catatan)
 * ternyata hilang/berubah (misal tidak sengaja ter-merge/terhapus/tertimpa),
 * tulis ulang HANYA baris 1 ini. Baris 2 ke bawah (data nama project Anda)
 * TIDAK PERNAH disentuh oleh fungsi ini, jadi aman dipanggil di setiap
 * renderDashboard() tanpa risiko menghapus data.
 */
function ensureConfigHeader_(sheet) {
  const expected = ['No', 'Nama Project', 'Catatan'];
  const current = sheet.getRange(1, 1, 1, 3).getValues()[0].map((v) => v.toString());
  const matches = expected.every((v, i) => current[i] === v);
  if (matches) return;

  sheet.getRange(1, 1, 1, 3).breakApart().setValues([expected]);
  sheet.getRange(1, 1, 1, 3)
    .setBackground(THEME.bannerBg)
    .setFontColor(THEME.bannerText)
    .setFontWeight('bold');
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 380);
  sheet.setFrozenRows(1);
}

/**
 * Menulis tabel "Pengaturan Ikon Progress" di sheet Config (kolom E-F) kalau
 * belum ada — sekali dibuat, isinya murni milik Anda dan TIDAK PERNAH ditimpa
 * ulang oleh fungsi ini di render-render berikutnya (dicek lewat judul tabel
 * di baris 1). Inilah yang membuat ganti-ganti emoji langsung dari sheet ini
 * bisa "nempel" seterusnya, bukan cuma sampai refresh berikutnya.
 */
function ensureIconSettings_(sheet) {
  const existingTitle = sheet.getRange(1, ICON_COL_LABEL).getValue().toString();
  if (existingTitle === ICON_TABLE_TITLE) return;

  sheet.getRange(1, ICON_COL_LABEL, 1, 2).breakApart().merge()
    .setValue(ICON_TABLE_TITLE)
    .setBackground(THEME.bannerBg)
    .setFontColor(THEME.bannerText)
    .setFontWeight('bold')
    .setWrap(true);

  sheet.getRange(2, ICON_COL_LABEL, 1, 2)
    .setValues([['Tahap', 'Ikon / Teks']])
    .setFontWeight('bold')
    .setBackground(THEME.bandLightAlt);

  const rows = ICON_STAGES.map((s) => [s.label, s.default]);
  sheet.getRange(ICON_FIRST_ROW, ICON_COL_LABEL, rows.length, 2).setValues(rows);
  sheet.getRange(ICON_FIRST_ROW, ICON_COL_VALUE, rows.length, 1).setHorizontalAlignment('center');

  sheet.setColumnWidth(ICON_COL_LABEL, 260);
  sheet.setColumnWidth(ICON_COL_VALUE, 220);
}

/** Referensi cross-sheet ke sel ikon tahap tertentu, dipakai di buildPlantFormula_. */
function iconCellRef_(stageKey) {
  const idx = ICON_STAGES.findIndex((s) => s.key === stageKey);
  const row = ICON_FIRST_ROW + idx;
  return `'${CONFIG_SHEET_NAME}'!$${colLetter_(ICON_COL_VALUE)}$${row}`;
}

function readConfigProjects_(sheet) {
  const range = sheet.getRange(2, CFG_COL_NAME, MAX_PROJECTS, 1);
  const values = range.getValues();

  const projects = [];
  values.forEach((row) => {
    const name = (row[0] || '').toString().trim();
    if (name) projects.push({ name });
  });
  return projects;
}

// ------------------------------------------------------------------------
// DASHBOARD SHEET — SETUP
// ------------------------------------------------------------------------
function getOrCreateDashSheet_(ss) {
  let sheet = ss.getSheetByName(DASH_SHEET_NAME);
  if (sheet) return sheet;

  sheet = ss.insertSheet(DASH_SHEET_NAME);
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  sheet.setColumnWidth(COL_NUM, 40);
  sheet.setColumnWidth(COL_TODO, 380);
  sheet.setColumnWidth(COL_CHECK, 110);
  sheet.setColumnWidth(COL_LINK, 200);
  sheet.setColumnWidth(COL_DEADLINE, 110);
  sheet.setColumnWidth(COL_COUNTDOWN, 170);

  const lastRow = FIRST_BLOCK_ROW + MAX_PROJECTS * BLOCK_HEIGHT;
  sheet.getRange(FIRST_BLOCK_ROW, COL_DEADLINE, lastRow - FIRST_BLOCK_ROW, 1).setNumberFormat('yyyy-mm-dd');

  sheet.setFrozenRows(4);
  sheet.setTabColor(THEME.headerBg);

  return sheet;
}

function ensureHeaderBanner_(sheet) {
  // breakApart() sebelum merge() sebagai pengaman terhadap sisa merge lama
  // (lihat catatan di writeProjectBlock_).
  sheet.getRange(1, 1, 1, 6).breakApart().merge()
    .setValue('🌿 MASTER PROJECT TRACKER')
    .setBackground(THEME.bannerBg)
    .setFontColor(THEME.bannerText)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 42);

  sheet.getRange(2, 1, 1, 6).breakApart().merge()
    .setValue('Klik checkbox untuk update progress • Klik teks to-do untuk membuka link • Isi Deadline per to-do untuk hitung mundur otomatis')
    .setBackground(THEME.cream)
    .setFontColor(THEME.textDark)
    .setFontStyle('italic')
    .setHorizontalAlignment('center');

  const lastRow = FIRST_BLOCK_ROW + MAX_PROJECTS * BLOCK_HEIGHT - 1;
  const chkAll = `${colLetter_(COL_CHECK)}${FIRST_BLOCK_ROW + 1}:${colLetter_(COL_CHECK)}${lastRow}`;
  const txtAll = `${colLetter_(COL_TODO)}${FIRST_BLOCK_ROW + 1}:${colLetter_(COL_TODO)}${lastRow}`;
  const summaryFormula =
    `="📊 "&COUNTIFS(${chkAll},TRUE,${txtAll},"<>")&" dari "&COUNTIF(${txtAll},"<>")&` +
    `" to-do selesai ("&IF(COUNTIF(${txtAll},"<>")=0,0,ROUND(COUNTIFS(${chkAll},TRUE,${txtAll},"<>")/COUNTIF(${txtAll},"<>")*100,0))&"%)"`;

  sheet.getRange(3, 1, 1, 6).breakApart().merge()
    .setFormula(localizeFormula_(summaryFormula))
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // Baris label kolom — selalu kelihatan (baris 1-4 di-freeze), supaya
  // kolom Link/Deadline/dsb. tidak pernah ambigu.
  const labels = ['No', 'To-Do', 'Selesai', '🔗 Link', '📅 Deadline', '⏳ Sisa Waktu'];
  sheet.getRange(4, 1, 1, 6)
    .breakApart()
    .setValues([labels])
    .setBackground(THEME.bandLightAlt)
    .setFontColor(THEME.textDark)
    .setFontWeight('bold')
    .setFontSize(9)
    .setHorizontalAlignment('center');
}

function isDashboardBodyEmpty_(sheet) {
  const lastRow = FIRST_BLOCK_ROW + MAX_PROJECTS * BLOCK_HEIGHT;
  if (sheet.getLastRow() < FIRST_BLOCK_ROW) return true;
  const values = sheet.getRange(FIRST_BLOCK_ROW, 1, Math.max(1, lastRow - FIRST_BLOCK_ROW), 2).getValues();
  return values.every((r) => !r[0] && !r[1]);
}

function clearDashboardBody_(sheet) {
  const totalRows = MAX_PROJECTS * BLOCK_HEIGHT;
  const range = sheet.getRange(FIRST_BLOCK_ROW, 1, totalRows, 6);

  // Pecah SETIAP area merge satu per satu (bukan cuma breakApart() borongan
  // di range gabungan) — ini yang benar-benar reliable melepas semua merge
  // lama sebelum ditulis ulang, mencegah error "harus memilih semua sel
  // dalam rentang penggabungan" saat merge() baru dipanggil nanti.
  range.getMergedRanges().forEach((r) => r.breakApart());
  range.breakApart();
  range.clearContent();
  range.clearFormat();
  range.clearDataValidations();
  range.setBackground(null);
  sheet.getRange(FIRST_BLOCK_ROW, COL_DEADLINE, totalRows, 1).setNumberFormat('yyyy-mm-dd');
}

// ------------------------------------------------------------------------
// PRESERVE DATA LAMA SEBELUM DITULIS ULANG
// ------------------------------------------------------------------------
function readExistingDashboardData_(sheet) {
  const result = {};
  const lastRowInSheet = sheet.getLastRow();
  if (lastRowInSheet < FIRST_BLOCK_ROW) return result;

  for (let i = 0; i < MAX_PROJECTS; i++) {
    const startRow = FIRST_BLOCK_ROW + i * BLOCK_HEIGHT;
    if (startRow > lastRowInSheet) break;

    const rawName = sheet.getRange(startRow, COL_NUM).getValue().toString();
    const name = rawName.replace(/^🌿\s*/, '').trim();
    if (!name) continue;

    const todoRange = sheet.getRange(startRow + 1, COL_TODO, MAX_TODOS, COL_DEADLINE - COL_TODO + 1);
    const values = todoRange.getValues();
    const todos = values.map((row) => ({
      text: (row[0] || '').toString(),
      checked: row[1] === true,
      link: (row[2] || '').toString(),
      deadline: row[3] instanceof Date ? row[3] : null,
    }));
    result[name] = todos;
  }
  return result;
}

function sampleTodos_() {
  const addDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };
  return [
    { checked: true, text: '✏️ Contoh to-do sudah selesai (klik untuk buka link)', link: 'https://drive.google.com', deadline: addDays(2) },
    { checked: false, text: '📁 Contoh to-do belum selesai — isi Link & Deadline di kolom sebelah kanan', link: '', deadline: addDays(5) },
    { checked: false, text: 'Hapus/timpa contoh ini dengan to-do Anda sendiri', link: '', deadline: null },
  ];
}

// ------------------------------------------------------------------------
// MENULIS SATU BLOK PROJECT
// ------------------------------------------------------------------------
function writeProjectBlock_(sheet, startRow, projName, todos) {
  const headerRow = startRow;
  const firstTodoRow = startRow + 1;
  const lastTodoRow = startRow + MAX_TODOS;
  const spacerRow = startRow + MAX_TODOS + 1;

  // --- Header row: nama project · plant/% · ringkasan deadline terdekat ---
  // breakApart() dipanggil tepat sebelum tiap merge() sebagai pengaman —
  // breakApart() borongan di clearDashboardBody_ kadang tidak konsisten
  // melepas SEMUA area merge sekaligus dalam satu panggilan, dan merge()
  // akan gagal (#ERROR "harus memilih semua sel dalam rentang penggabungan")
  // kalau target range tumpang tindih sebagian dengan merge lama.
  sheet.getRange(headerRow, COL_NUM, 1, 2).breakApart().merge()
    .setValue('🌿 ' + projName)
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerText)
    .setFontWeight('bold')
    .setFontSize(12)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(headerRow, 32);

  sheet.getRange(headerRow, COL_CHECK)
    .setFormula(localizeFormula_(buildPlantFormula_(firstTodoRow, lastTodoRow)))
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.getRange(headerRow, COL_LINK, 1, 3).breakApart().merge()
    .setFormula(localizeFormula_(buildNearestDeadlineFormula_(firstTodoRow, lastTodoRow)))
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // --- Baris to-do: No · To-Do · Selesai · Link · Deadline · Sisa Waktu ---
  const bandColor = THEME.bandLight;
  for (let i = 0; i < MAX_TODOS; i++) {
    const row = firstTodoRow + i;
    const data = todos[i] || { checked: false, text: '', link: '', deadline: null };

    sheet.getRange(row, COL_NUM)
      .setValue(i + 1)
      .setFontWeight('bold')
      .setFontColor(THEME.border)
      .setHorizontalAlignment('center');

    const checkCell = sheet.getRange(row, COL_CHECK);
    checkCell.insertCheckboxes();
    checkCell.setValue(data.checked === true).setHorizontalAlignment('center');

    const todoCell = sheet.getRange(row, COL_TODO);
    sheet.getRange(row, COL_LINK).setValue(data.link || '');

    const deadlineCell = sheet.getRange(row, COL_DEADLINE);
    if (data.deadline) {
      deadlineCell.setValue(data.deadline);
    } else {
      deadlineCell.clearContent();
    }
    deadlineCell.setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');

    sheet.getRange(row, COL_COUNTDOWN)
      .setFormula(localizeFormula_(buildRowCountdownFormula_(row)))
      .setFontColor(THEME.textDark)
      .setHorizontalAlignment('center');

    if (data.text) {
      todoCell.setValue(data.text);
    } else {
      todoCell.clearContent();
    }

    sheet.getRange(row, 1, 1, 6).setBackground(bandColor);
    styleTodoRow_(sheet, row);
  }

  // --- Baris spacer ---
  sheet.getRange(spacerRow, 1, 1, 6).setBackground(THEME.spacerBg);
  sheet.setRowHeight(spacerRow, 10);
}

// ------------------------------------------------------------------------
// LOKALISASI FORMULA
// ------------------------------------------------------------------------
/**
 * Spreadsheet dengan locale non-Inggris (termasuk Indonesia) memakai koma ","
 * sebagai desimal dan titik-koma ";" sebagai pemisah argumen fungsi — bukan
 * koma seperti yang kita tulis di kode. Kalau tidak dikonversi, formula
 * berisi banyak fungsi (IFS/COUNTIFS) akan tampil sebagai #ERROR!.
 * Semua formula di file ini ditulis dengan gaya AS (koma & titik desimal)
 * lalu dikonversi otomatis lewat localizeFormula_() sebelum ditulis ke sheet.
 */
function usesPeriodDecimal_() {
  const locale = (SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetLocale() || 'en_US').toLowerCase();
  const periodDecimalPrefixes = ['en', 'ja', 'ko', 'zh', 'th'];
  return periodDecimalPrefixes.some((p) => locale.startsWith(p));
}

function localizeFormula_(usFormula) {
  if (usesPeriodDecimal_()) return usFormula;
  let out = usFormula.split(',').join(';'); // pemisah argumen: , -> ;
  out = out.replace(/(\d)\.(\d)/g, '$1,$2'); // desimal: . -> ,
  return out;
}

function colLetter_(colIndex) {
  return String.fromCharCode(64 + colIndex);
}

// ------------------------------------------------------------------------
// PEMBANGUN FORMULA (countdown per to-do, ringkasan deadline, plant growth)
// ------------------------------------------------------------------------
/** Ekspresi nilai deadline "efektif": tanggal polos dianggap sampai 23:59:59. */
function deadlineExpr_(cellRef) {
  return `IF(${cellRef}=INT(${cellRef}),${cellRef}+TIME(23,59,59),${cellRef})`;
}

function buildRowCountdownFormula_(row) {
  const cell = `${colLetter_(COL_DEADLINE)}${row}`;
  const eff = deadlineExpr_(cell);
  return (
    `=IF(${cell}="","",` +
    `IF(${eff}<=NOW(),"⏰ Lewat",` +
    `FLOOR(${eff}-NOW())&"h "&FLOOR(MOD((${eff}-NOW())*24,24))&"j lagi"))`
  );
}

function buildNearestDeadlineFormula_(firstTodoRow, lastTodoRow) {
  const rng = `${colLetter_(COL_DEADLINE)}${firstTodoRow}:${colLetter_(COL_DEADLINE)}${lastTodoRow}`;
  const adjusted = `(${rng}+IF(${rng}=INT(${rng}),TIME(23,59,59),0))`;
  const nearest = `MIN(FILTER(${adjusted},${rng}<>""))`;
  return (
    `=IFERROR(` +
    `IF(${nearest}<=NOW(),"⏰ Ada to-do lewat deadline",` +
    `"⏳ Terdekat: "&FLOOR(${nearest}-NOW())&" hari lagi"),` +
    `"🗓️ Belum ada deadline")`
  );
}

function buildPlantFormula_(firstTodoRow, lastTodoRow) {
  const chk = `${colLetter_(COL_CHECK)}${firstTodoRow}:${colLetter_(COL_CHECK)}${lastTodoRow}`;
  const txt = `${colLetter_(COL_TODO)}${firstTodoRow}:${colLetter_(COL_TODO)}${lastTodoRow}`;
  const pct = `COUNTIFS(${chk},TRUE,${txt},"<>")/COUNTIF(${txt},"<>")`;
  const doneEqTotal = `COUNTIFS(${chk},TRUE,${txt},"<>")=COUNTIF(${txt},"<>")`;

  // Ikon tiap tahap TIDAK di-hardcode di sini — formula mengambil isinya
  // langsung dari sheet Config (tabel "🎨 Pengaturan Ikon Progress", kolom F)
  // lewat referensi cross-sheet. Jadi ganti emoji cukup edit sel di Config,
  // tidak perlu sentuh kode, dan tidak akan pernah ditimpa ulang saat
  // Dashboard di-refresh/di-build ulang (lihat ensureIconSettings_).
  return (
    `=IFS(` +
    `COUNTIF(${txt},"<>")=0,${iconCellRef_('empty')},` +
    `${doneEqTotal},${iconCellRef_('full')},` +
    `${pct}>=0.75,${iconCellRef_('p75')}&" "&TEXT(${pct},"0%"),` +
    `${pct}>=0.5,${iconCellRef_('p50')}&" "&TEXT(${pct},"0%"),` +
    `${pct}>=0.25,${iconCellRef_('p25')}&" "&TEXT(${pct},"0%"),` +
    `${pct}>0,${iconCellRef_('p1')}&" "&TEXT(${pct},"0%"),` +
    `TRUE,${iconCellRef_('zero')}&" 0%")`
  );
}

// ------------------------------------------------------------------------
// STYLING BARIS TO-DO (dipanggil dari writeProjectBlock_ maupun onEdit)
// ------------------------------------------------------------------------
/**
 * Menerapkan dua hal berdasarkan isi baris to-do saat ini:
 *   1. Hyperlink pada teks to-do kalau kolom Link diisi (warna biru garis
 *      bawah bawaan Sheets untuk link SENGAJA tidak ditimpa, supaya tetap
 *      kelihatan sebagai link yang bisa diklik).
 *   2. Coret (strikethrough) otomatis begitu checkbox dicentang — berlaku
 *      juga untuk teks yang jadi hyperlink (link tetap bisa diklik + coret).
 */
function styleTodoRow_(sheet, row) {
  const todoCell = sheet.getRange(row, COL_TODO);
  const text = todoCell.getValue().toString();
  if (!text) return;

  const link = sheet.getRange(row, COL_LINK).getValue().toString().trim();
  const checked = sheet.getRange(row, COL_CHECK).getValue() === true;

  if (link) {
    const rich = SpreadsheetApp.newRichTextValue().setText(text).setLinkUrl(link).build();
    todoCell.setRichTextValue(rich);
  } else {
    todoCell.setFontColor(checked ? '#7c8a6e' : THEME.textDark);
  }

  todoCell.setFontLine(checked ? 'line-through' : 'none');
}

// ------------------------------------------------------------------------
// UTILITAS MENU
// ------------------------------------------------------------------------
function resetAllCheckboxes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DASH_SHEET_NAME);
  if (!sheet) return;

  for (let i = 0; i < MAX_PROJECTS; i++) {
    const startRow = FIRST_BLOCK_ROW + i * BLOCK_HEIGHT;
    const range = sheet.getRange(startRow + 1, COL_CHECK, MAX_TODOS, 1);
    if (range.getValues().flat().some((v) => v !== '' && v !== null)) {
      range.setValue(false);
    }
  }
  SpreadsheetApp.getUi().alert('Semua checkbox to-do sudah di-uncheck ✅');
}

function confirmHardReset() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    '🚀 Build Ulang dari Nol',
    'Ini akan MENGHAPUS semua teks to-do, link, deadline, dan status checklist yang sudah ada di ' +
      'Dashboard, lalu membangunnya ulang kosong berdasarkan daftar project di Config. Yakin lanjut?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DASH_SHEET_NAME);
  if (sheet) {
    ss.deleteSheet(sheet);
  }
  renderDashboard();
  ui.alert('Dashboard sudah dibangun ulang dari nol 🌱');
}

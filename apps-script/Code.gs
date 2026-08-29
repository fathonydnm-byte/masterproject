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
 *   - Countdown deadline & progress "tanaman" dihitung via FORMULA sheet
 *     (bukan script) → selalu live setiap kali Sheets recalculate
 *     (buka file, edit apa saja, atau sekali per menit), tidak rapuh
 *     walau script gagal jalan.
 *   - Script hanya bertanggung jawab untuk: membangun struktur blok
 *     project, menyusun ulang urutan project berdasarkan deadline
 *     terdekat, dan menempelkan hyperlink ke teks to-do.
 *   - Setiap render TIDAK menghapus data Anda — teks to-do, link, dan
 *     status checklist yang sudah ada akan dibaca dulu lalu ditulis
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

const FIRST_BLOCK_ROW = 5;           // baris pertama blok project di Dashboard
const BLOCK_HEIGHT    = MAX_TODOS + 2; // 1 header + N to-do + 1 spacer

// Kolom di sheet Dashboard
const COL_CHECK    = 1; // A — checkbox
const COL_TODO     = 2; // B — teks to-do (jadi hyperlink kalau ada link)
const COL_LINK     = 3; // C — URL folder/bukti (input manual)
const COL_INFO     = 4; // D — plant % (header) / kosong (baris to-do)
const COL_DEADLINE = 6; // F — helper tanggal deadline (hidden)

// Kolom di sheet Config
const CFG_COL_NO       = 1;
const CFG_COL_NAME     = 2;
const CFG_COL_DATE     = 3;
const CFG_COL_TIME     = 4;
const CFG_COL_NOTE     = 5;

// Tema warna — Earthy Green & Cream
const THEME = {
  bannerBg:   '#3f5e4a',
  bannerText: '#faf7ef',
  headerBg:   '#8a9a5b',
  headerText: '#ffffff',
  bandLight:  '#f3f6ec',
  bandLightAlt: '#e8efdc',
  spacerBg:   '#dfe7d3',
  cream:      '#faf7ef',
  textDark:   '#33402e',
  border:     '#c8d3b8',
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
  // berdasarkan sisa waktu deadline paling dekat.
  renderDashboard();
}

/**
 * Dipicu otomatis oleh Google Sheets setiap ada perubahan cell (simple
 * trigger, tidak perlu otorisasi tambahan). Dipakai untuk:
 *   - Sinkron ulang Dashboard saat data di Config diubah (nama/deadline).
 *   - Menempelkan hyperlink ke teks to-do saat kolom Link diisi/diubah.
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
      const row = e.range.getRow();
      const col = e.range.getColumn();
      if (row < FIRST_BLOCK_ROW) return;

      const offset = (row - FIRST_BLOCK_ROW) % BLOCK_HEIGHT;
      const isTodoRow = offset >= 1 && offset <= MAX_TODOS;
      if (!isTodoRow) return;

      if (col === COL_LINK || col === COL_TODO) {
        applyHyperlinkStyle_(sheet, row);
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
 * 1. Baca daftar project dari Config (nama + deadline).
 * 2. Baca data to-do yang sudah ada di Dashboard saat ini (preserve).
 * 3. Urutkan project berdasarkan sisa waktu deadline (tercepat di atas).
 * 4. Tulis ulang seluruh isi Dashboard dengan urutan baru.
 */
function renderDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = getOrCreateConfigSheet_(ss);
  const dashSheet = getOrCreateDashSheet_(ss);

  const projects = readConfigProjects_(configSheet);
  const preserved = readExistingDashboardData_(dashSheet);
  const isFirstBuild = Object.keys(preserved).length === 0 && isDashboardBodyEmpty_(dashSheet);

  projects.sort((a, b) => {
    const av = a.deadline ? a.deadline.getTime() : Infinity;
    const bv = b.deadline ? b.deadline.getTime() : Infinity;
    return av - bv;
  });

  ensureHeaderBanner_(dashSheet);
  clearDashboardBody_(dashSheet);

  projects.forEach((proj, idx) => {
    const startRow = FIRST_BLOCK_ROW + idx * BLOCK_HEIGHT;
    let todos = preserved[proj.name];
    if (!todos && isFirstBuild && idx === 0) {
      todos = sampleTodos_();
    }
    writeProjectBlock_(dashSheet, startRow, proj, todos || []);
  });

  SpreadsheetApp.flush();
}

// ------------------------------------------------------------------------
// CONFIG SHEET
// ------------------------------------------------------------------------
function getOrCreateConfigSheet_(ss) {
  let sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (sheet) return sheet;

  sheet = ss.insertSheet(CONFIG_SHEET_NAME);
  sheet.getRange(1, 1, 1, 5).setValues([
    ['No', 'Nama Project', 'Deadline (Tanggal)', 'Deadline (Jam) — opsional', 'Catatan'],
  ]);
  sheet.getRange(1, 1, 1, 5)
    .setBackground(THEME.bannerBg)
    .setFontColor(THEME.bannerText)
    .setFontWeight('bold');

  const today = new Date();
  const addDays = (n) => {
    const d = new Date(today.getTime());
    d.setDate(d.getDate() + n);
    return d;
  };

  const sample = [
    [1, 'Project A', addDays(5), '', 'Contoh: ganti dengan nama project asli Anda'],
    [2, 'Project B', addDays(12), '', ''],
    [3, 'Project C', addDays(30), '', ''],
  ];
  sheet.getRange(2, 1, sample.length, 5).setValues(sample);
  sheet.getRange(2, 3, MAX_PROJECTS, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, 4, MAX_PROJECTS, 1).setNumberFormat('HH:mm');

  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 280);
  sheet.setFrozenRows(1);

  const remaining = MAX_PROJECTS - sample.length;
  if (remaining > 0) {
    const nums = [];
    for (let i = 0; i < remaining; i++) nums.push([sample.length + i + 1]);
    sheet.getRange(2 + sample.length, 1, remaining, 1).setValues(nums);
  }

  return sheet;
}

function readConfigProjects_(sheet) {
  const numRows = MAX_PROJECTS;
  const range = sheet.getRange(2, CFG_COL_NAME, numRows, CFG_COL_NOTE - CFG_COL_NAME + 1);
  const values = range.getValues();

  const projects = [];
  values.forEach((row) => {
    const name = (row[0] || '').toString().trim();
    if (!name) return;
    const dateVal = row[1];
    const timeVal = row[2];
    const deadline = combineDateAndTime_(dateVal, timeVal);
    projects.push({ name, deadline });
  });
  return projects;
}

function combineDateAndTime_(dateVal, timeVal) {
  if (!(dateVal instanceof Date)) return null;
  const d = new Date(dateVal.getTime());
  if (timeVal instanceof Date) {
    d.setHours(timeVal.getHours(), timeVal.getMinutes(), timeVal.getSeconds(), 0);
  } else {
    d.setHours(23, 59, 59, 0);
  }
  return d;
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

  sheet.setColumnWidth(COL_CHECK, 40);
  sheet.setColumnWidth(COL_TODO, 420);
  sheet.setColumnWidth(COL_LINK, 220);
  sheet.setColumnWidth(COL_INFO, 220);
  sheet.setColumnWidth(5, 20);
  sheet.setColumnWidth(COL_DEADLINE, 140);
  sheet.hideColumns(5, 2);
  sheet.setFrozenRows(4);
  sheet.setTabColor(THEME.headerBg);

  return sheet;
}

function ensureHeaderBanner_(sheet) {
  sheet.getRange(1, 1, 1, 4).merge()
    .setValue('🌿 MASTER PROJECT TRACKER')
    .setBackground(THEME.bannerBg)
    .setFontColor(THEME.bannerText)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 42);

  sheet.getRange(2, 1, 1, 4).merge()
    .setValue('Klik checkbox untuk update progress • Klik teks to-do untuk membuka link resource/bukti')
    .setBackground(THEME.cream)
    .setFontColor(THEME.textDark)
    .setFontStyle('italic')
    .setHorizontalAlignment('center');

  const lastRow = FIRST_BLOCK_ROW + MAX_PROJECTS * BLOCK_HEIGHT - 1;
  const chkAll = `A${FIRST_BLOCK_ROW + 1}:A${lastRow}`;
  const txtAll = `B${FIRST_BLOCK_ROW + 1}:B${lastRow}`;
  const summaryFormula =
    `="📊 "&COUNTIFS(${chkAll},TRUE,${txtAll},"<>")&" dari "&COUNTIF(${txtAll},"<>")&` +
    `" to-do selesai ("&IF(COUNTIF(${txtAll},"<>")=0,0,ROUND(COUNTIFS(${chkAll},TRUE,${txtAll},"<>")/COUNTIF(${txtAll},"<>")*100,0))&"%)"`;

  sheet.getRange(3, 1, 1, 4).merge()
    .setFormula(summaryFormula)
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.getRange(4, 1, 1, 4).merge().setBackground(THEME.cream);
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
  range.breakApart();
  range.clearContent();
  range.clearFormat();
  range.clearDataValidations();
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

    const rawName = sheet.getRange(startRow, COL_CHECK).getValue().toString();
    const name = rawName.replace(/^🌿\s*/, '').trim();
    if (!name) continue;

    const todoRange = sheet.getRange(startRow + 1, COL_CHECK, MAX_TODOS, COL_LINK);
    const values = todoRange.getValues();
    const todos = values.map((row) => ({
      checked: row[0] === true,
      text: (row[1] || '').toString(),
      link: (row[2] || '').toString(),
    }));
    result[name] = todos;
  }
  return result;
}

function sampleTodos_() {
  return [
    { checked: true, text: '✏️ Contoh to-do sudah selesai (klik untuk buka link)', link: 'https://drive.google.com' },
    { checked: false, text: '📁 Contoh to-do belum selesai — isi link folder di kolom sebelah kanan', link: '' },
    { checked: false, text: 'Hapus/timpa contoh ini dengan to-do Anda sendiri', link: '' },
  ];
}

// ------------------------------------------------------------------------
// MENULIS SATU BLOK PROJECT
// ------------------------------------------------------------------------
function writeProjectBlock_(sheet, startRow, proj, todos) {
  const headerRow = startRow;
  const firstTodoRow = startRow + 1;
  const lastTodoRow = startRow + MAX_TODOS;
  const spacerRow = startRow + MAX_TODOS + 1;

  // --- Header row: nama project, countdown, plant/% ---
  sheet.getRange(headerRow, COL_CHECK, 1, 2).merge()
    .setValue('🌿 ' + proj.name)
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerText)
    .setFontWeight('bold')
    .setFontSize(12)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(headerRow, 32);

  const deadlineCell = sheet.getRange(headerRow, COL_DEADLINE);
  if (proj.deadline) {
    deadlineCell.setValue(proj.deadline).setNumberFormat('yyyy-mm-dd HH:mm');
  } else {
    deadlineCell.clearContent();
  }

  sheet.getRange(headerRow, COL_INFO)
    .setFormula(buildCountdownFormula_(headerRow))
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // --- Kolom D dipakai untuk countdown (di atas), jadi plant/% kita taruh
  //     menempel di kanan dalam baris to-do pertama sebagai ringkasan blok.
  sheet.getRange(headerRow, COL_LINK)
    .setFormula(buildPlantFormula_(firstTodoRow, lastTodoRow))
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // --- Baris to-do ---
  const bandColor = THEME.bandLight;
  for (let i = 0; i < MAX_TODOS; i++) {
    const row = firstTodoRow + i;
    const data = todos[i] || { checked: false, text: '', link: '' };

    const checkCell = sheet.getRange(row, COL_CHECK);
    checkCell.insertCheckboxes();
    checkCell.setValue(data.checked === true);

    const todoCell = sheet.getRange(row, COL_TODO);
    const linkCell = sheet.getRange(row, COL_LINK);
    linkCell.setValue(data.link || '');

    if (data.text) {
      if (data.link) {
        const rich = SpreadsheetApp.newRichTextValue().setText(data.text).setLinkUrl(data.link).build();
        todoCell.setRichTextValue(rich);
      } else {
        todoCell.setValue(data.text);
      }
    } else {
      todoCell.clearContent();
    }

    sheet.getRange(row, 1, 1, 4).setBackground(bandColor);
    if (data.checked) {
      todoCell.setFontLine('line-through').setFontColor('#7c8a6e');
    } else {
      todoCell.setFontLine('none').setFontColor(THEME.textDark);
    }
  }

  // --- Baris spacer ---
  sheet.getRange(spacerRow, 1, 1, 6).setBackground(THEME.spacerBg);
  sheet.setRowHeight(spacerRow, 10);
}

// ------------------------------------------------------------------------
// PEMBANGUN FORMULA (countdown & plant growth)
// ------------------------------------------------------------------------
function buildCountdownFormula_(headerRow) {
  const dl = `F${headerRow}`;
  return (
    `=IF(${dl}="","🗓️ Set deadline di Config",` +
    `IF(${dl}<=NOW(),"⏰ LEWAT DEADLINE",` +
    `FLOOR(${dl}-NOW())&" hari "&FLOOR(MOD((${dl}-NOW())*24,24))&" jam lagi"))`
  );
}

function buildPlantFormula_(firstTodoRow, lastTodoRow) {
  const chk = `A${firstTodoRow}:A${lastTodoRow}`;
  const txt = `B${firstTodoRow}:B${lastTodoRow}`;
  const pct = `COUNTIFS(${chk},TRUE,${txt},"<>")/COUNTIF(${txt},"<>")`;
  const doneEqTotal = `COUNTIFS(${chk},TRUE,${txt},"<>")=COUNTIF(${txt},"<>")`;

  return (
    `=IFS(` +
    `COUNTIF(${txt},"<>")=0,"🪴 Belum ada to-do",` +
    `${doneEqTotal},"🌸🌸🌸 100% Mekar!",` +
    `${pct}>=0.75,"🌳 "&TEXT(${pct},"0%"),` +
    `${pct}>=0.5,"🪴 "&TEXT(${pct},"0%"),` +
    `${pct}>=0.25,"🌿 "&TEXT(${pct},"0%"),` +
    `${pct}>0,"🌱 "&TEXT(${pct},"0%"),` +
    `TRUE,"🌰 0%")`
  );
}

// ------------------------------------------------------------------------
// HYPERLINK STYLING (dipanggil dari onEdit)
// ------------------------------------------------------------------------
function applyHyperlinkStyle_(sheet, row) {
  const textCell = sheet.getRange(row, COL_TODO);
  const linkCell = sheet.getRange(row, COL_LINK);
  const text = textCell.getValue().toString();
  const link = linkCell.getValue().toString().trim();

  if (!text) return;

  if (link) {
    const rich = SpreadsheetApp.newRichTextValue().setText(text).setLinkUrl(link).build();
    textCell.setRichTextValue(rich);
  } else {
    const rich = SpreadsheetApp.newRichTextValue().setText(text).build();
    textCell.setRichTextValue(rich);
  }
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
    'Ini akan MENGHAPUS semua teks to-do, link, dan status checklist yang sudah ada di Dashboard, ' +
      'lalu membangunnya ulang kosong berdasarkan daftar project di Config. Yakin lanjut?',
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

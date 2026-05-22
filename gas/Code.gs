// ============================================================
//  イベント申し込みサイト — Google Apps Script
//  スプレッドシートID を SPREADSHEET_ID に設定してください
// ============================================================
const SPREADSHEET_ID = '179mePemkq-8gJ6ca-63khxhuAVE7nnflGcR-7qtmT7w';

const SHEET_EVENTS = 'イベント';       // イベント一覧シート名
const SHEET_REGISTRATIONS = '申込データ'; // 申込データシート名

// ── GET リクエスト（イベント一覧返却） ──────────────────────
function doGet(e) {
  try {
    const events = getEvents();
    return jsonResponse({ status: 'ok', events });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ── POST リクエスト（申し込み受付） ─────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.action !== 'register') {
      return jsonResponse({ status: 'error', message: '不正なリクエストです' });
    }

    const { eventId, eventTitle, eventDate, eventTime, eventLocation, name, attendanceType, note } = payload;

    // 必須チェック
    if (!name || !eventId || !attendanceType) {
      return jsonResponse({ status: 'error', message: '必須項目が不足しています' });
    }

    // 申込データに保存
    saveRegistration({ eventId, eventTitle, eventDate, eventTime, eventLocation, name, attendanceType, note });

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    console.error(err);
    return jsonResponse({ status: 'error', message: 'サーバーエラーが発生しました' });
  }
}

// ── イベント一覧を取得 ────────────────────────────────────
function getEvents() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);

  if (!sheet) throw new Error(`シート「${SHEET_EVENTS}」が見つかりません`);

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const headers = rows[0]; // 1行目：ヘッダー
  const now     = new Date();

  const events = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rowToObj(headers, rows[i]);

    // タイトルが空の行はスキップ
    if (!row.タイトル) continue;

    // 非公開はスキップ
    if (row.公開 === false || row.公開 === 'FALSE' || row.公開 === '非公開') continue;

    // 時刻を安全にフォーマット（Sheetsの時刻セルはDateオブジェクトで渡される）
    let timeStr = '';
    if (row.時刻) {
      try {
        timeStr = Utilities.formatDate(new Date(row.時刻), 'Asia/Tokyo', 'HH:mm');
      } catch(e) {}
    }

    // 終了済みイベントはスキップ（日付＋時刻で判定）
    if (row.日付) {
      const eventEnd = new Date(row.日付);
      if (timeStr) {
        const [h, m] = timeStr.split(':');
        eventEnd.setHours(parseInt(h), parseInt(m), 0, 0);
      } else {
        eventEnd.setHours(23, 59, 59, 999);
      }
      if (eventEnd < now) continue;
    }

    events.push({
      id:          String(row.ID),
      title:       row.タイトル || '',
      date:        row.日付 ? Utilities.formatDate(new Date(row.日付), 'Asia/Tokyo', 'yyyy-MM-dd') : '',
      time:        timeStr,
      location:    row.場所 || '',
      description: row.説明 || '',
    });
  }

  // 日時昇順ソート
  events.sort((a, b) => {
    const da = `${a.date}T${a.time || '00:00'}`;
    const db = `${b.date}T${b.time || '00:00'}`;
    return da > db ? 1 : -1;
  });

  return events;
}

// ── 申し込みを保存 ────────────────────────────────────────
function saveRegistration({ eventId, eventTitle, eventDate, eventTime, eventLocation, name, attendanceType, note }) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(SHEET_REGISTRATIONS);

  // シートがなければ作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_REGISTRATIONS);
    sheet.appendRow(['申込日時', 'イベントID', 'イベント名', 'お名前', '参加方法', '備考']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  sheet.appendRow([now, eventId, eventTitle, name, attendanceType || '', note || '']);
}

// ── ユーティリティ ────────────────────────────────────────
function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function jsonResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Google Apps Script Web App の URL をここに設定してください
// 設定前はサンプルデータで動作します
const GAS_URL = 'https://script.google.com/macros/s/AKfycbylrZUkwas48Hl1kEneh7ARpUqp9mAyE5g4WiI5XIVE8c2EVhCHS6F92RJpagLdF7zifw/exec';

// ── サンプルデータ（GAS_URL 未設定時のプレビュー用） ────────
const SAMPLE_EVENTS = [
  {
    id: '1',
    title: '春の親睦バーベキュー大会',
    date: '2026-06-14',
    time: '11:00',
    location: '○○公園 バーベキューエリア',
    description: '毎年恒例の春のバーベキュー！食材・飲み物はこちらで用意します。お気軽にご参加ください。',
  },
  {
    id: '2',
    title: 'ボードゲームナイト',
    date: '2026-06-28',
    time: '18:30',
    location: 'コミュニティセンター 3F 会議室',
    description: '各自おすすめのボードゲームを持ち寄って遊びましょう。初心者歓迎です！',
  },
  {
    id: '3',
    title: '夏祭り準備ミーティング',
    date: '2026-07-05',
    time: '20:00',
    location: 'オンライン（Zoom）',
    description: '7月末の夏祭りに向けた準備の打ち合わせです。役割分担・予算確認を行います。',
  },
];

// ── 要素取得 ──────────────────────────────────────────────
const eventList     = document.getElementById('event-list');
const loadingEl     = document.getElementById('loading');
const errorEl       = document.getElementById('error-state');
const emptyEl       = document.getElementById('empty-state');
const overlay       = document.getElementById('modal-overlay');
const modalTitle    = document.getElementById('modal-title');
const modalDate     = document.getElementById('modal-date');
const modalLocation = document.getElementById('modal-location');
const form          = document.getElementById('registration-form');
const submitBtn     = document.getElementById('submit-btn');
const submitLabel   = document.getElementById('submit-label');
const submitLoading = document.getElementById('submit-loading');
const formMessage   = document.getElementById('form-message');
const successPanel  = document.getElementById('success-panel');

// ── イベント一覧の読み込み ────────────────────────────────
async function loadEvents() {
  // GAS_URL 未設定時はサンプルデータを表示
  if (GAS_URL === 'YOUR_GAS_WEB_APP_URL') {
    loadingEl.classList.add('hidden');
    renderEvents(SAMPLE_EVENTS);
    return;
  }

  try {
    const res  = await fetch(`${GAS_URL}?action=events`);
    const data = await res.json();

    loadingEl.classList.add('hidden');

    if (!data.events || data.events.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    renderEvents(data.events);
  } catch (e) {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    console.error('イベント読み込みエラー:', e);
  }
}

function renderEvents(events) {
  eventList.innerHTML = '';

  // 終了済みイベントをフロントでも除外（サンプルデータ用）
  const now = new Date();
  const upcoming = events.filter(ev => {
    if (!ev.date) return true;
    const dt = new Date(`${ev.date}T${ev.time || '23:59'}:00`);
    return dt >= now;
  });

  if (upcoming.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  upcoming.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <span class="event-card-date">&#128197; ${formatDateTime(ev.date, ev.time)}</span>
      <h3 class="event-card-title">${escape(ev.title)}</h3>
      ${ev.location ? `<p class="event-card-location">&#128205; ${escape(ev.location)}</p>` : ''}
      ${ev.description ? `<p class="event-card-desc">${escape(ev.description)}</p>` : ''}
      <div class="event-card-footer">
        <span></span>
        <button class="btn-apply" data-id="${ev.id}" data-title="${escape(ev.title)}"
          data-date="${escape(formatDateTime(ev.date, ev.time))}" data-location="${escape(ev.location || '')}">
          申し込む
        </button>
      </div>
    `;
    eventList.appendChild(card);
  });

  // 申し込みボタンのイベント登録
  eventList.querySelectorAll('.btn-apply').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset));
  });
}

// ── モーダル ──────────────────────────────────────────────
function openModal({ id, title, date, location }) {
  document.getElementById('field-event-id').value    = id;
  document.getElementById('field-event-title').value = title;
  modalTitle.textContent    = title;
  modalDate.textContent     = date ? `&#128197; ${date}` : '';
  modalLocation.textContent = location ? `&#128205; ${location}` : '';
  modalDate.innerHTML       = date     ? `&#128197; ${date}`     : '';
  modalLocation.innerHTML   = location ? `&#128205; ${location}` : '';

  form.reset();
  clearErrors();
  formMessage.classList.add('hidden');
  successPanel.classList.add('hidden');
  form.classList.remove('hidden');

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('field-name').focus();
}

function closeModal() {
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('back-btn').addEventListener('click', closeModal);

overlay.addEventListener('click', e => {
  if (e.target === overlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── フォーム送信 ──────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate()) return;

  setSubmitting(true);
  formMessage.classList.add('hidden');

  const payload = {
    action:     'register',
    eventId:    document.getElementById('field-event-id').value,
    eventTitle: document.getElementById('field-event-title').value,
    name:       document.getElementById('field-name').value.trim(),
    email:      document.getElementById('field-email').value.trim(),
    note:       document.getElementById('field-note').value.trim(),
  };

  try {
    const res  = await fetch(GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.status === 'ok') {
      form.classList.add('hidden');
      successPanel.classList.remove('hidden');
    } else {
      showFormError(data.message || '送信に失敗しました。もう一度お試しください。');
    }
  } catch (err) {
    showFormError('通信エラーが発生しました。インターネット接続を確認してください。');
    console.error('送信エラー:', err);
  } finally {
    setSubmitting(false);
  }
});

// ── バリデーション ────────────────────────────────────────
function validate() {
  clearErrors();
  let ok = true;

  const name  = document.getElementById('field-name');
  const email = document.getElementById('field-email');

  if (!name.value.trim()) {
    showFieldError(name, 'error-name', 'お名前を入力してください');
    ok = false;
  }

  if (!email.value.trim()) {
    showFieldError(email, 'error-email', 'メールアドレスを入力してください');
    ok = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    showFieldError(email, 'error-email', 'メールアドレスの形式が正しくありません');
    ok = false;
  }

  return ok;
}

function showFieldError(input, errorId, msg) {
  input.classList.add('invalid');
  document.getElementById(errorId).textContent = msg;
}

function clearErrors() {
  document.querySelectorAll('.form-input, .form-textarea').forEach(el => el.classList.remove('invalid'));
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
}

function showFormError(msg) {
  formMessage.className = 'form-message error';
  formMessage.textContent = msg;
  formMessage.classList.remove('hidden');
}

// ── UI ヘルパー ───────────────────────────────────────────
function setSubmitting(loading) {
  submitBtn.disabled = loading;
  submitLabel.classList.toggle('hidden', loading);
  submitLoading.classList.toggle('hidden', !loading);
}

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T${timeStr || '00:00'}:00`);
  if (isNaN(d)) return dateStr;
  const datePart = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  if (!timeStr) return datePart;
  const timePart = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}〜`;
}

function escape(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ── 起動 ─────────────────────────────────────────────────
loadEvents();

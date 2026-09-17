(() => {
  const SUPABASE_URL = 'https://xejdhnwqqaamujkebvne.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  const SESSION_KEY = 'athomeCarcareAdminSession';

  const STATUSES = ['접수', '확정', '완료', '취소'];
  let allRows = [];
  let currentTab = '접수';

  const escHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));

  const showToast = (message) => {
    if (typeof window.toast === 'function') window.toast(message);
    else console.log(message);
  };

  const apiHeaders = (token = null, extra = {}) => ({
    apikey: SUPABASE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  });

  const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

  const whenText = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('ko-KR', {
      month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  // datetime-local 입력값으로 쓸 수 있는 문자열
  const toLocalInput = (iso) => {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  // 고객이 적은 희망 날짜/시간을 확정 입력칸의 기본값으로
  const preferredToLocalInput = (row) => {
    if (row.scheduled_at) return toLocalInput(row.scheduled_at);
    if (row.preferred_date) {
      const time = row.preferred_time ? String(row.preferred_time).slice(0, 5) : '14:00';
      return `${row.preferred_date}T${time}`;
    }
    return toLocalInput(null);
  };

  function injectStyles() {
    if (document.querySelector('#supabaseIntegrationStyles')) return;
    const style = document.createElement('style');
    style.id = 'supabaseIntegrationStyles';
    style.textContent = `
      .db-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#e7f8f3;color:#087c68;font-weight:900;font-size:12px;margin-bottom:12px}
      .admin-auth-card{margin:0 32px 22px;background:#fff;border:1px solid #dfe9e7;border-radius:22px;padding:22px;box-shadow:0 12px 36px rgba(18,64,58,.10)}
      .admin-auth-card h2{margin:0 0 8px}.admin-auth-card p{color:#647789;margin:0 0 16px}.admin-auth-row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}
      .admin-auth-row label{display:flex;flex-direction:column;gap:6px;font-weight:800;font-size:13px;flex:1;min-width:180px}.admin-auth-row input{border:1px solid #cfdcda;border-radius:13px;padding:12px 13px}
      .admin-session-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border-radius:14px;background:#effaf7;margin-bottom:16px}.admin-session-bar b{color:#087c68}
      .reservation-list{display:grid;gap:12px}
      .reservation-item{border:1px solid #dfe9e7;border-radius:16px;padding:15px;background:#fbfdfd}
      .reservation-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .reservation-item h3{margin:0 0 5px;font-size:17px}
      .reservation-meta{display:flex;gap:8px;flex-wrap:wrap;color:#647789;font-size:12px;margin:8px 0}
      .reservation-item p{margin:8px 0;line-height:1.55}
      .reservation-empty{padding:22px;text-align:center;color:#647789;border:1px dashed #cfdcda;border-radius:14px}
      .booking-db-note{display:block;margin-top:8px;color:#087c68;font-weight:800;font-size:12px}

      .res-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
      .res-tab{border:1px solid #cfdcda;background:#fff;color:#4a5f5b;border-radius:999px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer}
      .res-tab.active{background:#087c68;border-color:#087c68;color:#fff}
      .res-badge{flex:0 0 auto;font-size:12px;font-weight:900;padding:4px 10px;border-radius:999px;background:#e7f8f3;color:#05594b;white-space:nowrap}
      .reservation-item[data-status="확정"] .res-badge{background:#fdf0dc;color:#8a5200}
      .reservation-item[data-status="완료"] .res-badge{background:#ececec;color:#4a4a4a}
      .reservation-item[data-status="취소"] .res-badge{background:#fbe3e3;color:#8d2b2b}
      .res-actions{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #e9f0ee}
      .res-when{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#647789}
      .res-when input{border:1px solid #cfdcda;border-radius:11px;padding:9px 10px;font-size:13px}
      .res-actions button{border:0;border-radius:11px;padding:10px 15px;font-weight:800;font-size:13px;cursor:pointer}
      .res-go{background:#087c68;color:#fff}
      .res-sub{background:#eef4f3;color:#4a5f5b}
      .res-highlight{color:#087c68;font-weight:900}
      @media(max-width:760px){
        .admin-auth-card{margin-left:16px;margin-right:16px}
        .admin-auth-row{display:grid;grid-template-columns:1fr}
        .reservation-top{flex-direction:column}
        .res-actions{flex-direction:column;align-items:stretch}
        .res-actions button{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  /* ========== 고객 예약 접수 ========== */

  function enhanceBookingForm() {
    const form = document.querySelector('#bookingForm');
    if (!form || form.dataset.supabaseReady) return;
    form.dataset.supabaseReady = '1';

    const apartmentLabel = form.querySelector('input[name="apartment"]')?.closest('label');
    if (apartmentLabel && !form.querySelector('[name="customerName"]')) {
      apartmentLabel.insertAdjacentHTML('beforebegin', '<label>예약자 이름<input name="customerName" placeholder="예: 홍길동" autocomplete="name" required></label>');
    }

    const memoLabel = form.querySelector('textarea[name="memo"]')?.closest('label');
    if (memoLabel && !form.querySelector('[name="preferredDate"]')) {
      memoLabel.insertAdjacentHTML('beforebegin', '<label>희망 날짜<input name="preferredDate" type="date"></label><label>희망 시간<input name="preferredTime" type="time"></label>');
    }

    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = '예약 접수하기';
    const note = document.createElement('small');
    note.className = 'booking-db-note span-2';
    note.textContent = '예약 내용은 앳홈 카케어 예약 DB에 안전하게 접수됩니다.';
    submit?.insertAdjacentElement('afterend', note);

    form.addEventListener('submit', submitBookingToSupabase, true);
  }

  function normalizeService(service) {
    if (service === '월 2회') return '월2회';
    if (service === '월 4회') return '월4회';
    if (service === '일일 외부세차' || service === '외부+내부세차') return '일일세차';
    return '기타';
  }

  async function submitBookingToSupabase(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    const original = submit?.textContent;
    if (submit) { submit.disabled = true; submit.textContent = '접수 중...'; }

    const exactService = String(fd.get('service') || '기타 상담');
    const memo = String(fd.get('memo') || '').trim();
    const payload = {
      customer_name: String(fd.get('customerName') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      apartment: String(fd.get('apartment') || '').trim(),
      car_model: String(fd.get('car') || '').trim(),
      service_type: normalizeService(exactService),
      preferred_date: fd.get('preferredDate') || null,
      preferred_time: fd.get('preferredTime') || null,
      memo: `[희망 서비스: ${exactService}]${memo ? `\n${memo}` : ''}`,
      status: '접수'
    };

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/reservations`, {
        method: 'POST',
        headers: apiHeaders(null, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(await response.text());

      const result = document.querySelector('#bookingResult');
      if (result) {
        result.classList.remove('hidden');
        result.innerHTML = `<strong>예약이 접수되었습니다. ✅</strong><p>${escHtml(payload.customer_name)}님, ${escHtml(payload.apartment)} · ${escHtml(payload.car_model)} 예약을 확인 후 연락드리겠습니다.</p><div class="actions"><a class="secondary-btn button-link" href="tel:01083918999">☎ 010-8391-8999</a></div>`;
      }
      form.reset();
      showToast('예약이 접수되었습니다. 곧 연락드리겠습니다.');
    } catch (error) {
      console.error('Supabase 예약 저장 실패', error);
      showToast('예약 접수에 실패했습니다. 잠시 후 다시 시도하거나 전화로 문의해주세요.');
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = original || '예약 접수하기'; }
    }
  }

  /* ========== 세션 ========== */

  // ── 세션 저장소: localStorage → 탭을 닫아도 유지 ──────────────
  function loadStoredSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  // ── 토큰 만료 여부 확인 (만료 5분 전부터 갱신 시도) ────────────
  function isTokenExpired(session) {
    if (!session || !session.expires_at) return true;
    // expires_at 은 Unix 초 단위
    return Date.now() / 1000 > session.expires_at - 300;
  }

  // ── refresh_token 으로 새 access_token 발급 ─────────────────────
  async function refreshSession(session) {
    if (!session?.refresh_token) throw new Error('refresh_token 없음');
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.error_description || '토큰 갱신 실패');
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user_id: data.user?.id || session.user_id,
      email: data.user?.email || session.email
    };
    saveSession(next);
    return next;
  }

  // ── 세션 반환 — 만료 직전이면 자동 갱신, 실패하면 로그인으로 ──
  async function getValidSession() {
    let session = loadStoredSession();
    if (!session) return null;
    if (isTokenExpired(session)) {
      try { session = await refreshSession(session); }
      catch { handleExpired(); return null; }
    }
    return session;
  }

  // ── 만료/갱신 실패 시 로그인 화면으로 ──────────────────────────
  function handleExpired() {
    clearSession();
    allRows = [];
    const card = document.querySelector('#supabaseAdminAuth');
    if (!card) return;
    card.querySelector('#adminLoggedIn').classList.add('hidden');
    card.querySelector('#adminLoggedOut').classList.remove('hidden');
    const message = card.querySelector('#adminLoginMessage');
    if (message) {
      message.textContent = '로그인 시간이 만료되었습니다. 다시 로그인해주세요.';
      message.style.color = '#c94141';
    }
    setProtectedVisible(false);
  }

  async function signIn(email, password) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.error_description || '로그인 실패');
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user_id: data.user?.id,
      email: data.user?.email || email
    };
  }

  async function isAdmin(session) {
    if (!session?.access_token || !session?.user_id) return false;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(session.user_id)}`, {
      headers: apiHeaders(session.access_token)
    });
    if (!response.ok) return false;
    const rows = await response.json();
    return Array.isArray(rows) && rows.length > 0;
  }

  function setProtectedVisible(visible) {
    document.querySelectorAll('#admin > .admin-protected').forEach((el) => el.classList.toggle('hidden', !visible));
  }

  /* ========== 관리자 화면 ========== */

  function setupAdminUI() {
    const admin = document.querySelector('#admin');
    if (!admin || admin.querySelector('#supabaseAdminAuth')) return;

    Array.from(admin.children).forEach((child) => {
      if (child.id === 'supabaseAdminAuth') return;
      if (!child.classList.contains('page-title')) child.classList.add('admin-protected', 'hidden');
    });

    const card = document.createElement('article');
    card.id = 'supabaseAdminAuth';
    card.className = 'admin-auth-card';
    card.innerHTML = `
      <span class="db-badge">● Supabase 연결됨</span>
      <div id="adminLoggedOut">
        <h2>관리자 로그인</h2><p>예약내역과 예약상태 관리를 위해 로그인하세요.</p>
        <form id="adminLoginForm" class="admin-auth-row">
          <label>이메일<input type="email" name="email" value="tran0004@gmail.com" autocomplete="username" required></label>
          <label>비밀번호<input type="password" name="password" autocomplete="current-password" required></label>
          <button class="primary-btn" type="submit">로그인</button>
        </form>
        <p id="adminLoginMessage" style="margin-top:10px"></p>
      </div>
      <div id="adminLoggedIn" class="hidden">
        <div class="admin-session-bar"><div>관리자 <b id="adminEmail"></b> 로그인됨</div><div><button id="reloadReservations" class="secondary-btn">예약 새로고침</button> <button id="adminLogout" class="danger-btn">로그아웃</button></div></div>
        <h2>예약 관리</h2>
        <p id="todaySummary">고객이 앱에서 접수한 예약이 이곳에 표시됩니다.</p>
        <div id="reservationTabs" class="res-tabs"></div>
        <div id="reservationList" class="reservation-list"><div class="reservation-empty">예약내역을 불러오는 중...</div></div>
      </div>`;

    const anchor = admin.querySelector('.page-title');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    else admin.prepend(card);

    card.querySelector('#adminLoginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button');
      const message = card.querySelector('#adminLoginMessage');
      button.disabled = true; button.textContent = '로그인 중...'; message.textContent = '';
      try {
        const session = await signIn(form.email.value.trim(), form.password.value);
        if (!(await isAdmin(session))) throw new Error('이 계정에는 관리자 권한이 없습니다.');
        saveSession(session);
        form.password.value = '';
        await showAdminSession(session);
      } catch (error) {
        clearSession();
        message.textContent = error.message || '로그인에 실패했습니다.';
        message.style.color = '#c94141';
      } finally {
        button.disabled = false; button.textContent = '로그인';
      }
    });

    card.querySelector('#reloadReservations').addEventListener('click', async () => {
      const session = await getValidSession();
      if (session) loadReservations(session);
    });

    card.querySelector('#adminLogout').addEventListener('click', async () => {
      const session = await getValidSession();
      if (session?.access_token) {
        fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: apiHeaders(session.access_token) }).catch(() => {});
      }
      clearSession();
      allRows = [];
      card.querySelector('#adminLoggedIn').classList.add('hidden');
      card.querySelector('#adminLoggedOut').classList.remove('hidden');
      setProtectedVisible(false);
      showToast('관리자 로그아웃되었습니다.');
    });

    // 상태 탭
    card.querySelector('#reservationTabs').addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]');
      if (!tab) return;
      currentTab = tab.dataset.tab;
      renderReservations();
    });

    // 상태 변경 버튼
    card.querySelector('#reservationList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-act]');
      if (!button) return;
      const id = button.dataset.id;
      const input = document.querySelector(`#reservationList [data-when="${id}"]`);
      const iso = input && input.value ? new Date(input.value).toISOString() : null;
      changeStatus(id, button.dataset.act, iso, button);
    });

    // 페이지 로드 시 저장된 세션으로 자동 로그인 유지
    getValidSession().then(async (session) => {
      if (!session) return;
      const ok = await isAdmin(session).catch(() => false);
      if (ok) showAdminSession(session);
      else clearSession();
    });
  }

  async function showAdminSession(session) {
    const card = document.querySelector('#supabaseAdminAuth');
    if (!card) return;
    card.querySelector('#adminLoggedOut').classList.add('hidden');
    card.querySelector('#adminLoggedIn').classList.remove('hidden');
    card.querySelector('#adminEmail').textContent = session.email || '관리자';
    setProtectedVisible(true);
    await loadReservations(session);
  }

  /* ========== 예약 목록 ========== */

  async function loadReservations(sessionArg) {
    const list = document.querySelector('#reservationList');
    if (!list) return;
    const session = await getValidSession();
    if (!session) return;
    list.innerHTML = '<div class="reservation-empty">예약내역을 불러오는 중...</div>';
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/reservations?select=*&order=created_at.desc&limit=200`, {
        headers: apiHeaders(session.access_token)
      });
      if (response.status === 401 || response.status === 403) return handleExpired();
      if (!response.ok) throw new Error(await response.text());
      allRows = await response.json();
      renderReservations();
    } catch (error) {
      console.error('예약목록 불러오기 실패', error);
      list.innerHTML = '<div class="reservation-empty">예약내역을 불러오지 못했습니다. 새로고침하거나 다시 로그인해주세요.</div>';
    }
  }

  function countByStatus() {
    const counts = { 접수: 0, 확정: 0, 완료: 0, 취소: 0 };
    allRows.forEach((row) => { if (counts[row.status] != null) counts[row.status] += 1; });
    return counts;
  }

  function todayLine() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000);
    const today = allRows.filter((row) => {
      if (row.status !== '확정' || !row.scheduled_at) return false;
      const d = new Date(row.scheduled_at);
      return d >= start && d < end;
    });
    if (!today.length) return '오늘 확정된 방문 일정은 없습니다.';
    const names = today
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
      .map((row) => `${whenText(row.scheduled_at).replace(/^.*?\) /, '')} ${row.apartment}`)
      .join(' · ');
    return `오늘 방문 <span class="res-highlight">${today.length}건</span> — ${escHtml(names)}`;
  }

  function actionsMarkup(row) {
    const whenInput = `<label class="res-when">방문 예정<input type="datetime-local" data-when="${escHtml(row.id)}" value="${escHtml(preferredToLocalInput(row))}"></label>`;

    if (row.status === '접수') {
      return whenInput +
        `<button class="res-go" data-act="확정" data-id="${escHtml(row.id)}">확정하기</button>` +
        `<button class="res-sub" data-act="취소" data-id="${escHtml(row.id)}">취소</button>`;
    }
    if (row.status === '확정') {
      return whenInput +
        `<button class="res-go" data-act="완료" data-id="${escHtml(row.id)}">완료 처리</button>` +
        `<button class="res-sub" data-act="접수" data-id="${escHtml(row.id)}">접수로 되돌리기</button>`;
    }
    return `<button class="res-sub" data-act="접수" data-id="${escHtml(row.id)}">접수로 되돌리기</button>`;
  }

  function rowMarkup(row) {
    const created = row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : '';
    const preferred = [row.preferred_date, row.preferred_time ? String(row.preferred_time).slice(0, 5) : ''].filter(Boolean).join(' ');

    return `<article class="reservation-item" data-status="${escHtml(row.status)}">
      <div class="reservation-top">
        <div>
          <h3>${escHtml(row.customer_name)} · ${escHtml(row.car_model)}</h3>
          <a href="tel:${digitsOnly(row.phone)}">${escHtml(row.phone)}</a>
        </div>
        <span class="res-badge">${escHtml(row.status)}</span>
      </div>
      <div class="reservation-meta">
        <span>📍 ${escHtml(row.apartment)}</span>
        <span>🚗 ${escHtml(row.service_type)}</span>
        ${preferred ? `<span>희망 ${escHtml(preferred)}</span>` : ''}
        ${row.scheduled_at ? `<span>🗓 확정 ${escHtml(whenText(row.scheduled_at))}</span>` : ''}
        ${row.done_at ? `<span>✅ 완료 ${escHtml(whenText(row.done_at))}</span>` : ''}
        <span>접수 ${escHtml(created)}</span>
      </div>
      ${row.memo ? `<p>${escHtml(row.memo).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="res-actions">${actionsMarkup(row)}</div>
    </article>`;
  }

  function renderReservations() {
    const tabsEl = document.querySelector('#reservationTabs');
    const listEl = document.querySelector('#reservationList');
    const summaryEl = document.querySelector('#todaySummary');
    if (!tabsEl || !listEl) return;

    const counts = countByStatus();
    tabsEl.innerHTML = [...STATUSES, '전체'].map((name) => {
      const n = name === '전체' ? allRows.length : counts[name];
      return `<button class="res-tab ${name === currentTab ? 'active' : ''}" data-tab="${name}">${name} ${n}</button>`;
    }).join('');

    if (summaryEl) summaryEl.innerHTML = todayLine();

    let rows = currentTab === '전체' ? allRows : allRows.filter((row) => row.status === currentTab);

    // 확정 건은 방문 예정 시각이 빠른 순으로
    if (currentTab === '확정') {
      rows = rows.slice().sort((a, b) => {
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return new Date(a.scheduled_at) - new Date(b.scheduled_at);
      });
    }

    listEl.innerHTML = rows.length
      ? rows.map(rowMarkup).join('')
      : `<div class="reservation-empty">${escHtml(currentTab)} 상태인 예약이 없습니다.</div>`;
  }

  async function changeStatus(id, status, scheduledIso, button) {
    const session = await getValidSession();
    if (!session) return;

    if (status === '확정' && !scheduledIso) {
      showToast('방문 예정 일시를 먼저 선택해주세요.');
      return;
    }

    const patch = { status, updated_at: new Date().toISOString() };
    if (status === '확정') patch.scheduled_at = scheduledIso;
    if (status === '완료') patch.done_at = new Date().toISOString();
    if (status === '접수') { patch.scheduled_at = null; patch.done_at = null; }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = '처리 중...';

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: apiHeaders(session.access_token, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify(patch)
      });
      if (response.status === 401 || response.status === 403) return handleExpired();
      if (!response.ok) throw new Error(await response.text());

      const row = allRows.find((r) => String(r.id) === String(id));
      if (row) Object.assign(row, patch);
      showToast(`${status} 처리했습니다.`);
      renderReservations();
    } catch (error) {
      console.error(error);
      showToast('상태 변경에 실패했습니다.');
      button.disabled = false;
      button.textContent = original;
    }
  }

  injectStyles();
  enhanceBookingForm();
  setupAdminUI();
})();

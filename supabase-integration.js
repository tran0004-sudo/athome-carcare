(() => {
  const SUPABASE_URL = 'https://xejdhnwqqaamujkebvne.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  const SESSION_KEY = 'athomeCarcareAdminSession';

  const escHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));

  const showToast = (message) => {
    if (typeof window.toast === 'function') window.toast(message);
    else console.log(message);
  };

  const apiHeaders = (token = SUPABASE_KEY, extra = {}) => ({
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    ...extra
  });

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
      .reservation-list{display:grid;gap:12px}.reservation-item{border:1px solid #dfe9e7;border-radius:16px;padding:15px;background:#fbfdfd}.reservation-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.reservation-item h3{margin:0 0 5px;font-size:17px}.reservation-meta{display:flex;gap:8px;flex-wrap:wrap;color:#647789;font-size:12px;margin:8px 0}.reservation-item p{margin:8px 0;line-height:1.55}.reservation-item select{border:1px solid #b8d8d1;border-radius:10px;padding:8px 10px;background:#fff;color:#087c68;font-weight:900}.reservation-empty{padding:22px;text-align:center;color:#647789;border:1px dashed #cfdcda;border-radius:14px}
      .booking-db-note{display:block;margin-top:8px;color:#087c68;font-weight:800;font-size:12px}
      @media(max-width:760px){.admin-auth-card{margin-left:16px;margin-right:16px}.admin-auth-row{display:grid;grid-template-columns:1fr}.reservation-top{flex-direction:column}.reservation-item select{width:100%}}
    `;
    document.head.appendChild(style);
  }

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
      status: '예약접수'
    };

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/reservations`, {
        method: 'POST',
        headers: apiHeaders(SUPABASE_KEY, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        }),
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(await response.text());

      const result = document.querySelector('#bookingResult');
      if (result) {
        result.classList.remove('hidden');
        result.innerHTML = `<strong>예약이 접수되었습니다. ✅</strong><p>${escHtml(payload.customer_name)}님, ${escHtml(payload.apartment)} · ${escHtml(payload.car_model)} 예약을 확인 후 연락드리겠습니다.</p><div class="actions"><a class="secondary-btn button-link" href="tel:01083918999">☎ 010-8391-8999</a></div>`;
      }
      form.reset();
      showToast('예약이 Supabase DB에 정상 접수되었습니다.');
    } catch (error) {
      console.error('Supabase 예약 저장 실패', error);
      showToast('예약 접수에 실패했습니다. 잠시 후 다시 시도하거나 전화로 문의해주세요.');
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = original || '예약 접수하기'; }
    }
  }

  function loadStoredSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function saveSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
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

  function setupAdminUI() {
    const admin = document.querySelector('#admin');
    if (!admin || admin.querySelector('#supabaseAdminAuth')) return;

    Array.from(admin.children).forEach((child) => {
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
        <h2>예약 관리</h2><p>고객이 앱에서 접수한 예약이 이곳에 표시됩니다.</p>
        <div id="reservationList" class="reservation-list"><div class="reservation-empty">예약내역을 불러오는 중...</div></div>
      </div>`;
    admin.querySelector('.page-title')?.insertAdjacentElement('afterend', card);

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

    card.querySelector('#reloadReservations').addEventListener('click', () => {
      const session = loadStoredSession();
      if (session) loadReservations(session);
    });

    card.querySelector('#adminLogout').addEventListener('click', async () => {
      const session = loadStoredSession();
      if (session?.access_token) {
        fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: apiHeaders(session.access_token) }).catch(() => {});
      }
      clearSession();
      card.querySelector('#adminLoggedIn').classList.add('hidden');
      card.querySelector('#adminLoggedOut').classList.remove('hidden');
      setProtectedVisible(false);
      showToast('관리자 로그아웃되었습니다.');
    });

    card.querySelector('#reservationList').addEventListener('change', async (event) => {
      const select = event.target.closest('[data-reservation-status]');
      if (!select) return;
      const session = loadStoredSession();
      if (!session) return;
      select.disabled = true;
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/reservations?id=eq.${encodeURIComponent(select.dataset.reservationStatus)}`, {
          method: 'PATCH',
          headers: apiHeaders(session.access_token, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({ status: select.value, updated_at: new Date().toISOString() })
        });
        if (!response.ok) throw new Error(await response.text());
        showToast(`예약상태를 '${select.value}'로 변경했습니다.`);
      } catch (error) {
        console.error(error);
        showToast('예약상태 변경에 실패했습니다.');
        await loadReservations(session);
      } finally {
        select.disabled = false;
      }
    });

    const saved = loadStoredSession();
    if (saved) {
      isAdmin(saved).then((ok) => ok ? showAdminSession(saved) : clearSession()).catch(() => clearSession());
    }
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

  async function loadReservations(session) {
    const list = document.querySelector('#reservationList');
    if (!list) return;
    list.innerHTML = '<div class="reservation-empty">예약내역을 불러오는 중...</div>';
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/reservations?select=*&order=created_at.desc&limit=100`, {
        headers: apiHeaders(session.access_token)
      });
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      if (!rows.length) {
        list.innerHTML = '<div class="reservation-empty">아직 접수된 예약이 없습니다.</div>';
        return;
      }
      const statuses = ['예약접수', '방문예정', '작업중', '완료', '취소'];
      list.innerHTML = rows.map((row) => {
        const date = row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : '';
        const preferred = [row.preferred_date, row.preferred_time].filter(Boolean).join(' ');
        return `<article class="reservation-item"><div class="reservation-top"><div><h3>${escHtml(row.customer_name)} · ${escHtml(row.car_model)}</h3><a href="tel:${escHtml(String(row.phone).replace(/\D/g, ''))}">${escHtml(row.phone)}</a></div><select data-reservation-status="${escHtml(row.id)}" aria-label="예약상태">${statuses.map((status) => `<option ${row.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div><div class="reservation-meta"><span>📍 ${escHtml(row.apartment)}</span><span>🚗 ${escHtml(row.service_type)}</span>${preferred ? `<span>🗓 ${escHtml(preferred)}</span>` : ''}<span>접수 ${escHtml(date)}</span></div>${row.memo ? `<p>${escHtml(row.memo).replace(/\n/g, '<br>')}</p>` : ''}</article>`;
      }).join('');
    } catch (error) {
      console.error('예약목록 불러오기 실패', error);
      list.innerHTML = '<div class="reservation-empty">예약내역을 불러오지 못했습니다. 다시 로그인하거나 새로고침해주세요.</div>';
    }
  }

  injectStyles();
  enhanceBookingForm();
  setupAdminUI();
})();

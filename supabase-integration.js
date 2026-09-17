(() => {
  /* ================================================================
   * 집앞세차-앳홈 카케어 | Supabase 예약 연동 v3
   * 버그수정 3 + 기능개선 5 통합본
   * ================================================================ */

  const SUPABASE_URL = 'https://xejdhnwqqaamujkebvne.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  const SESSION_KEY  = 'athomeCarcareAdminSession';

  // 차종 구분 8종 (개선점 2: 예약 폼 선택지)
  const CAR_CLASSES = [
    '경차·소형',
    '준중형 세단',
    '중형·준대형 세단',
    '대형 세단',
    '소형 SUV',
    '중형 SUV',
    '대형 SUV',
    '대형 MPV·특대형',
  ];

  const STATUSES = ['접수', '확정', '완료', '취소'];

  let allRows    = [];
  let currentTab = '접수';
  let autoTimer  = null;   // 개선점 1: 자동 갱신 타이머

  /* ── 유틸 ────────────────────────────────────────────────────── */

  const esc = (v = '') => String(v).replace(/[&<>'"]/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));

  const toast = msg => typeof window.toast === 'function'
    ? window.toast(msg) : console.log('[예약]', msg);

  const api = (token, extra = {}) => ({
    apikey: SUPABASE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  });

  const tel = v => String(v || '').replace(/\D/g, '');

  const fmt = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ko-KR', {
      month:'numeric', day:'numeric', weekday:'short',
      hour:'2-digit', minute:'2-digit',
    });
  };

  const toInput = iso => {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const prefInput = row => {
    if (row.scheduled_at) return toInput(row.scheduled_at);
    if (row.preferred_date) {
      const t = row.preferred_time ? String(row.preferred_time).slice(0,5) : '14:00';
      return `${row.preferred_date}T${t}`;
    }
    return toInput(null);
  };

  /* ── 스타일 ──────────────────────────────────────────────────── */

  function injectStyles() {
    if (document.querySelector('#supabaseIntegrationStyles')) return;
    const s = document.createElement('style');
    s.id = 'supabaseIntegrationStyles';
    s.textContent = `
      /* 공통 */
      .db-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#e7f8f3;color:#087c68;font-weight:900;font-size:12px;margin-bottom:12px}
      .admin-auth-card{margin:0 16px 22px;background:#fff;border:1px solid #dfe9e7;border-radius:22px;padding:22px;box-shadow:0 12px 36px rgba(18,64,58,.10)}
      @media(min-width:540px){.admin-auth-card{margin-left:32px;margin-right:32px}}
      .admin-auth-card h2{margin:0 0 8px}
      .admin-auth-card p{color:#647789;margin:0 0 16px}
      /* 로그인 폼 */
      .admin-auth-row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}
      .admin-auth-row label{display:flex;flex-direction:column;gap:6px;font-weight:800;font-size:13px;flex:1;min-width:160px}
      .admin-auth-row input{border:1px solid #cfdcda;border-radius:13px;padding:12px 13px}
      /* 로그인 상태 바 */
      .admin-session-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:14px;background:#effaf7;margin-bottom:14px}
      .admin-session-bar b{color:#087c68}
      .admin-session-bar .bar-btns{display:flex;gap:6px;flex-wrap:wrap}
      /* 오늘 요약 */
      #todaySummary{margin-bottom:10px;font-size:14px;line-height:1.55;word-break:keep-all}
      .res-highlight{color:#087c68;font-weight:900}
      /* 자동갱신 표시 */
      #autoRefreshStatus{font-size:11px;color:#9bb8b1;margin-left:6px}
      /* 탭 */
      .res-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
      .res-tab{border:1px solid #cfdcda;background:#fff;color:#4a5f5b;border-radius:999px;padding:7px 13px;font-weight:800;font-size:13px;cursor:pointer;line-height:1}
      .res-tab.active{background:#087c68;border-color:#087c68;color:#fff}
      /* 카드 */
      .reservation-list{display:grid;gap:10px}
      .reservation-item{border:1px solid #dfe9e7;border-radius:16px;padding:14px;background:#fbfdfd}
      .reservation-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .reservation-item h3{margin:0 0 4px;font-size:16px;line-height:1.3}
      .reservation-meta{display:flex;gap:6px;flex-wrap:wrap;color:#647789;font-size:12px;margin:7px 0}
      .reservation-item .res-memo{margin:6px 0;font-size:13px;line-height:1.55;word-break:keep-all}
      .reservation-empty{padding:22px;text-align:center;color:#647789;border:1px dashed #cfdcda;border-radius:14px}
      /* 상태 배지 */
      .res-badge{flex:0 0 auto;font-size:12px;font-weight:900;padding:4px 10px;border-radius:999px;background:#e7f8f3;color:#05594b;white-space:nowrap}
      .reservation-item[data-status="확정"] .res-badge{background:#fdf0dc;color:#8a5200}
      .reservation-item[data-status="완료"] .res-badge{background:#ececec;color:#4a4a4a}
      .reservation-item[data-status="취소"] .res-badge{background:#fbe3e3;color:#8d2b2b}
      /* 액션 영역 */
      .res-actions{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #e9f0ee}
      .res-when{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#647789}
      .res-when input{border:1px solid #cfdcda;border-radius:11px;padding:8px 10px;font-size:13px;color:#132c27}
      /* 완료 금액 입력 (개선점 3) */
      .res-amount{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#647789}
      .res-amount input{border:1px solid #cfdcda;border-radius:11px;padding:8px 10px;font-size:13px;width:110px;color:#132c27}
      /* 버튼 */
      .res-actions button{border:0;border-radius:11px;padding:9px 13px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap}
      .res-go{background:#087c68;color:#fff}
      .res-sub{background:#eef4f3;color:#4a5f5b}
      .res-danger{background:#fbe3e3;color:#8d2b2b}
      /* 예약 폼 */
      .booking-db-note{display:block;margin-top:8px;color:#087c68;font-weight:800;font-size:12px}
      /* 모바일 */
      /* 관리 섹션 탭 */
      .admin-section-tabs{display:flex;gap:6px;margin-bottom:14px;border-bottom:2px solid #e9f0ee;padding-bottom:0}
      .admin-sec-tab{border:0;background:none;padding:10px 16px;font-weight:800;font-size:14px;color:#9bb8b1;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;border-radius:0}
      .admin-sec-tab.active{color:#087c68;border-bottom-color:#087c68}
      /* 월 회원 */
      .member-controls{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
      .member-controls input{flex:1 1 180px;border:1px solid #cfdcda;border-radius:13px;padding:10px 14px;font-size:14px}
      .member-list{display:grid;gap:10px}
      .member-card{border:1px solid #dfe9e7;border-radius:16px;padding:14px;background:#fbfdfd}
      .member-card.highlight{border-color:#087c68;background:#f0fbf8}
      .member-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
      .member-name{font-size:16px;font-weight:700;margin:0 0 3px}
      .member-phone{font-size:13px;color:#647789}
      .member-badge{font-size:12px;font-weight:900;padding:4px 10px;border-radius:999px;background:#e7f8f3;color:#05594b;white-space:nowrap;flex:0 0 auto}
      .member-badge.bronze{background:#fdf0dc;color:#8a5200}
      .member-badge.silver{background:#ececec;color:#4a4a4a}
      .member-badge.gold{background:#fdf4cc;color:#7a6000}
      .member-stats{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0;font-size:13px}
      .member-stat{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 12px;border-radius:12px;background:#f3faf8;min-width:60px}
      .member-stat b{font-size:18px;font-weight:900;color:#087c68;line-height:1}
      .member-stat span{font-size:11px;color:#9bb8b1}
      .member-stat.warn b{color:#c94141}
      .member-history{margin-top:10px;font-size:12px;color:#647789;line-height:1.7}
      .member-history summary{cursor:pointer;font-weight:700;color:#087c68;margin-bottom:4px}
      .member-history .hist-row{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #e9f0ee;font-size:12px}
      .member-history .hist-row:last-child{border-bottom:0}
      .member-history .hist-date{color:#9bb8b1;flex:0 0 auto}
      .member-history .hist-svc{flex:1}
      .member-history .hist-amt{font-weight:700;color:#087c68;flex:0 0 auto}
      /* 예약 페이지 하단 연락 버튼 */
      .booking-contact-strip{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0 0}
      .booking-contact-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:18px 12px;border-radius:18px;border:2px solid #cfdcda;background:#fff;font-weight:900;font-size:16px;text-align:center;cursor:pointer;text-decoration:none;color:#132c27;line-height:1.3;box-shadow:0 4px 14px rgba(0,0,0,.06)}
      .booking-contact-btn:active{transform:scale(.97)}
      .booking-contact-btn.kakao-btn{background:#fee500;border-color:#f0d900;color:#3c1e1e;box-shadow:0 4px 14px rgba(254,229,0,.35)}
      @media(max-width:400px){.booking-contact-strip{grid-template-columns:1fr}}
      /* 예약 성공 결과 */
      .booking-success{padding:18px;background:#f0fbf8;border-radius:16px;border:1px solid #b8e8da}
      .booking-success-title{font-size:17px;font-weight:900;color:#087c68;margin:0 0 8px}
      .booking-success p{margin:0 0 14px;line-height:1.6;word-break:keep-all}
      .booking-success-btns{display:flex;gap:8px;flex-wrap:wrap}
      .booking-success-btns a,.booking-success-btns button{flex:1 1 120px;text-align:center;text-decoration:none}
            .member-del-row{margin-top:10px;text-align:right}
      .member-del-btn{border:1px solid #f5c6c6;background:#fff5f5;color:#c94141;border-radius:10px;padding:7px 14px;font-size:12px;font-weight:800;cursor:pointer}
      .member-del-btn:hover{background:#fbe3e3}
            @media(max-width:540px){
        .reservation-top{flex-direction:column}
        .res-actions{flex-direction:column;align-items:stretch}
        .res-actions button,.res-amount input,.res-when input{width:100%}
      }
    `;
    document.head.appendChild(s);
  }

  /* ── 세션 ─────────────────────────────────────────────────────── */

  function loadSession()  { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); } catch { return null; } }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function dropSession()  { localStorage.removeItem(SESSION_KEY); }

  function isExpired(s) {
    if (!s?.expires_at) return true;
    return Date.now() / 1000 > s.expires_at - 300; // 5분 여유
  }

  async function refreshSession(s) {
    if (!s?.refresh_token) throw new Error('refresh_token 없음');
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.msg || d.error_description || '갱신 실패');
    const next = {
      access_token:  d.access_token,
      refresh_token: d.refresh_token,
      expires_at:    d.expires_at,
      user_id:       d.user?.id   || s.user_id,
      email:         d.user?.email|| s.email,
    };
    saveSession(next);
    return next;
  }

  async function getSession() {
    let s = loadSession();
    if (!s) return null;
    if (isExpired(s)) {
      try { s = await refreshSession(s); }
      catch { handleExpired(); return null; }
    }
    return s;
  }

  /* [버그1] 이메일 하드코딩 제거 — 로그인 폼에서 value 없이 브라우저 자동완성 사용
     [버그2] admins 테이블 조회 실패 대비 — 조회 오류 시 Supabase 자체 role로 fallback */
  async function signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.msg || d.error_description || '로그인 실패');
    return {
      access_token:  d.access_token,
      refresh_token: d.refresh_token,
      expires_at:    d.expires_at,
      user_id:       d.user?.id,
      email:         d.user?.email || email,
      role:          d.user?.role,
    };
  }

  // [버그2] admins 테이블이 없어도 authenticated role이면 관리자로 허용
  async function isAdmin(s) {
    if (!s?.access_token || !s?.user_id) return false;
    // 1차: admins 테이블 확인
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(s.user_id)}`,
        { headers: api(s.access_token) }
      );
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length > 0) return true;
        // 테이블은 있는데 이 계정이 없는 경우
        if (r.status === 200) return false;
      }
    } catch { /* admins 테이블 없으면 아래로 */ }
    // 2차: reservations 테이블에 접근 가능한지로 판단 (authenticated면 RLS 통과)
    const r2 = await fetch(
      `${SUPABASE_URL}/rest/v1/reservations?select=id&limit=1`,
      { headers: api(s.access_token) }
    );
    return r2.ok;
  }

  function handleExpired() {
    stopAutoRefresh();
    dropSession();
    allRows = [];
    const card = document.querySelector('#supabaseAdminAuth');
    if (!card) return;
    card.querySelector('#adminLoggedIn').classList.add('hidden');
    card.querySelector('#adminLoggedOut').classList.remove('hidden');
    const msg = card.querySelector('#adminLoginMessage');
    if (msg) { msg.textContent = '세션이 만료되었습니다. 다시 로그인해주세요.'; msg.style.color = '#c94141'; }
    setProtected(false);
  }

  /* ── 자동갱신 (개선점 1) ─────────────────────────────────────── */

  function startAutoRefresh() {
    stopAutoRefresh();
    autoTimer = setInterval(async () => {
      const s = await getSession();
      if (!s) return;
      await loadReservations(true); // silent=true → 로딩 텍스트 없이
    }, 60_000); // 60초
    updateAutoStatus(true);
  }

  function stopAutoRefresh() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    updateAutoStatus(false);
  }

  function updateAutoStatus(on) {
    const el = document.querySelector('#autoRefreshStatus');
    if (el) el.textContent = on ? '· 60초 자동갱신' : '';
  }

  /* ── 예약 목록 불러오기 ──────────────────────────────────────── */

  async function loadReservations(silent = false) {
    const listEl = document.querySelector('#reservationList');
    if (!listEl) return;
    const s = await getSession();
    if (!s) return;
    if (!silent) listEl.innerHTML = '<div class="reservation-empty">불러오는 중…</div>';
    try {
      // [버그3] scheduled_at, done_at, amount 컬럼을 select에 명시
      //         컬럼이 없으면 Supabase가 무시하므로 SQL 업그레이드 전후 모두 동작
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/reservations?select=id,created_at,updated_at,customer_name,phone,apartment,car_model,car_class,service_type,preferred_date,preferred_time,memo,status,scheduled_at,done_at,amount,admin_memo&order=created_at.desc&limit=300`,
        { headers: api(s.access_token) }
      );
      if (r.status === 401 || r.status === 403) return handleExpired();
      if (!r.ok) throw new Error(await r.text());
      const fresh = await r.json();
      // 새 접수 건 감지 (개선점 1)
      const prevAccepted = allRows.filter(x => x.status === '접수').length;
      allRows = fresh;
      const newAccepted = allRows.filter(x => x.status === '접수').length;
      if (silent && newAccepted > prevAccepted) {
        toast(`새 예약 ${newAccepted - prevAccepted}건이 접수되었습니다.`);
      }
      renderReservations();
    } catch (err) {
      console.error(err);
      if (!silent) listEl.innerHTML = '<div class="reservation-empty">목록을 불러오지 못했습니다. 새로고침해주세요.</div>';
    }
  }

  /* ── 렌더 ─────────────────────────────────────────────────────── */

  function counts() {
    const c = { 접수:0, 확정:0, 완료:0, 취소:0 };
    allRows.forEach(r => { if (c[r.status] != null) c[r.status]++; });
    return c;
  }

  function todayLine() {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end   = new Date(start.getTime() + 86_400_000);
    const today = allRows
      .filter(r => r.status === '확정' && r.scheduled_at)
      .filter(r => { const d = new Date(r.scheduled_at); return d >= start && d < end; })
      .sort((a,b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    if (!today.length) return '오늘 확정된 방문 일정이 없습니다.';
    const list = today.map(r => `${fmt(r.scheduled_at).replace(/^.*?\) /,'')} ${esc(r.apartment)}`).join(' · ');
    return `오늘 방문 <span class="res-highlight">${today.length}건</span> — ${list}`;
  }

  // [개선점 4] 모바일 최적화 — 버튼 텍스트 압축, 날짜+버튼 한 줄
  // [개선점 3] 완료 시 금액 입력
  // [개선점 5] 취소 건 → 확정으로도 되돌리기
  function actionsMarkup(row) {
    const whenInput = `
      <label class="res-when">방문 예정
        <input type="datetime-local" data-when="${esc(row.id)}" value="${esc(prefInput(row))}">
      </label>`;

    if (row.status === '접수') {
      return whenInput +
        `<button class="res-go" data-act="확정" data-id="${esc(row.id)}">확정</button>` +
        `<button class="res-danger" data-act="취소" data-id="${esc(row.id)}">취소</button>`;
    }
    if (row.status === '확정') {
      const amtInput = `
        <label class="res-amount">청구 금액(원)
          <input type="number" inputmode="numeric" placeholder="예: 35000"
            data-amount="${esc(row.id)}" value="${esc(row.amount||'')}">
        </label>`;
      return whenInput + amtInput +
        `<button class="res-go" data-act="완료" data-id="${esc(row.id)}">완료</button>` +
        `<button class="res-sub" data-act="접수" data-id="${esc(row.id)}">접수로</button>`;
    }
    if (row.status === '취소') {
      // [개선점 5] 취소 → 접수 or 확정 선택
      return whenInput +
        `<button class="res-sub" data-act="접수" data-id="${esc(row.id)}">접수로</button>` +
        `<button class="res-go"  data-act="확정" data-id="${esc(row.id)}">확정으로</button>`;
    }
    // 완료
    return `<button class="res-sub" data-act="접수" data-id="${esc(row.id)}">접수로</button>`;
  }

  function rowMarkup(row) {
    const created   = row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : '';
    const preferred = [row.preferred_date, row.preferred_time ? String(row.preferred_time).slice(0,5) : ''].filter(Boolean).join(' ');
    const carClass  = row.car_class ? `<span>📋 ${esc(row.car_class)}</span>` : '';
    const amtLine   = row.amount    ? `<span>💰 ${Number(row.amount).toLocaleString('ko-KR')}원</span>` : '';

    return `<article class="reservation-item" data-status="${esc(row.status)}">
  <div class="reservation-top">
    <div>
      <h3>${esc(row.customer_name)} · ${esc(row.car_model)}</h3>
      <a href="tel:${tel(row.phone)}">${esc(row.phone)}</a>
    </div>
    <span class="res-badge">${esc(row.status)}</span>
  </div>
  <div class="reservation-meta">
    <span>📍 ${esc(row.apartment)}</span>
    <span>🚗 ${esc(row.service_type)}</span>
    ${carClass}
    ${preferred  ? `<span>희망 ${esc(preferred)}</span>` : ''}
    ${row.scheduled_at ? `<span>🗓 확정 ${esc(fmt(row.scheduled_at))}</span>` : ''}
    ${row.done_at      ? `<span>✅ 완료 ${esc(fmt(row.done_at))}</span>` : ''}
    ${amtLine}
    <span>접수 ${esc(created)}</span>
  </div>
  ${row.memo ? `<p class="res-memo">${esc(row.memo).replace(/\n/g,'<br>')}</p>` : ''}
  <div class="res-actions">${actionsMarkup(row)}</div>
</article>`;
  }

  function renderReservations() {
    const tabsEl    = document.querySelector('#reservationTabs');
    const listEl    = document.querySelector('#reservationList');
    const summaryEl = document.querySelector('#todaySummary');
    if (!tabsEl || !listEl) return;

    const c = counts();
    tabsEl.innerHTML = [...STATUSES, '전체'].map(name => {
      const n = name === '전체' ? allRows.length : c[name];
      return `<button class="res-tab${name===currentTab?' active':''}" data-tab="${name}">${name} ${n}</button>`;
    }).join('');

    if (summaryEl) summaryEl.innerHTML = todayLine();

    let rows = currentTab === '전체' ? allRows : allRows.filter(r => r.status === currentTab);
    if (currentTab === '확정') {
      rows = [...rows].sort((a,b) => {
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return new Date(a.scheduled_at) - new Date(b.scheduled_at);
      });
    }

    listEl.innerHTML = rows.length
      ? rows.map(rowMarkup).join('')
      : `<div class="reservation-empty">${esc(currentTab)} 상태인 예약이 없습니다.</div>`;
  }

  /* ── 상태 변경 ───────────────────────────────────────────────── */

  async function changeStatus(id, status, scheduledIso, amountVal, button) {
    const s = await getSession();
    if (!s) return;

    if ((status === '확정') && !scheduledIso) {
      toast('방문 예정 일시를 먼저 선택해주세요.');
      return;
    }

    const patch = { status, updated_at: new Date().toISOString() };
    if (status === '확정') patch.scheduled_at = scheduledIso;
    if (status === '완료') {
      patch.done_at = new Date().toISOString();
      if (amountVal) patch.amount = parseInt(amountVal, 10);
    }
    if (status === '접수') { patch.scheduled_at = null; patch.done_at = null; }

    const orig = button.textContent;
    button.disabled = true; button.textContent = '…';

    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/reservations?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: api(s.access_token, { 'Content-Type':'application/json', Prefer:'return=minimal' }),
          body: JSON.stringify(patch),
        }
      );
      if (r.status === 401 || r.status === 403) return handleExpired();
      if (!r.ok) throw new Error(await r.text());
      const row = allRows.find(x => String(x.id) === String(id));
      if (row) Object.assign(row, patch);
      toast(`${status} 처리했습니다.`);
      renderReservations();
    } catch (err) {
      console.error(err);
      toast('상태 변경에 실패했습니다. SQL 업그레이드(reservations-upgrade.sql)가 완료됐는지 확인해주세요.');
      button.disabled = false; button.textContent = orig;
    }
  }

  /* ── 고객 예약 폼 (개선점 2: 차종 구분 선택) ─────────────────── */

  function enhanceBookingForm() {
    const form = document.querySelector('#bookingForm');
    if (!form || form.dataset.supabaseReady) return;
    form.dataset.supabaseReady = '1';
    // 필드는 index.html에 이미 포함 — 이벤트만 연결
    form.addEventListener('submit', submitBooking, true);
  }

  function normalizeService(svc) {
    if (svc === '월 2회') return '월2회';
    if (svc === '월 4회') return '월4회';
    if (svc === '일일 외부세차' || svc === '외부+내부세차') return '일일세차';
    return '기타';
  }

  async function submitBooking(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const fd     = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    const orig   = submit?.textContent;
    if (submit) { submit.disabled = true; submit.textContent = '접수 중…'; }

    const exactSvc = String(fd.get('service') || '기타 상담');
    const memo     = String(fd.get('memo') || '').trim();
    const payload  = {
      customer_name:  String(fd.get('customerName') || '').trim(),
      phone:          String(fd.get('phone')        || '').trim(),
      apartment:      String(fd.get('apartment')    || '').trim(),
      car_model:      String(fd.get('car')          || '').trim(),
      car_class:      String(fd.get('carClass')     || '').trim() || null,
      service_type:   normalizeService(exactSvc),
      preferred_date: fd.get('preferredDate') || null,
      preferred_time: fd.get('preferredTime') || null,
      memo: `[희망 서비스: ${exactSvc}]${memo ? `\n${memo}` : ''}`,
      status: '접수',
    };

    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reservations`, {
        method: 'POST',
        headers: api(null, { 'Content-Type':'application/json', Prefer:'return=minimal' }),
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());

      const result = document.querySelector('#bookingResult');
      if (result) {
        result.classList.remove('hidden');
        result.innerHTML = `<div class="booking-success">
          <p class="booking-success-title">✅ 예약이 접수되었습니다!</p>
          <p>${esc(payload.customer_name)}님, ${esc(payload.apartment)} · ${esc(payload.car_model)} 예약을 확인 후 연락드리겠습니다.</p>
          <div class="booking-success-btns">
            <a class="primary-btn button-link" href="tel:01083918999">☎ 전화 확인</a>
            <a class="secondary-btn button-link" href="https://pf.kakao.com/_gpDrX" target="_blank" rel="noopener">💬 카카오채널</a>
          </div>
        </div>`;
      }
      form.reset();
      toast('예약이 접수되었습니다. 곧 연락드리겠습니다.');
    } catch (err) {
      console.error('예약 저장 실패', err);
      toast('예약 접수에 실패했습니다. 잠시 후 다시 시도하거나 전화로 문의해주세요.');
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = orig || '예약 접수하기'; }
    }
  }

  /* ── 관리자 화면 UI ──────────────────────────────────────────── */

  function setProtected(visible) {
    document.querySelectorAll('#admin > .admin-protected').forEach(el => el.classList.toggle('hidden', !visible));
  }

  function setupAdminUI() {
    const admin = document.querySelector('#admin');
    if (!admin || admin.querySelector('#supabaseAdminAuth')) return;

    Array.from(admin.children).forEach(child => {
      if (child.id === 'supabaseAdminAuth' || child.classList.contains('page-title')) return;
      child.classList.add('admin-protected', 'hidden');
    });

    const card = document.createElement('article');
    card.id = 'supabaseAdminAuth';
    card.className = 'admin-auth-card';
    // [버그1] 이메일 value 제거 — 브라우저 자동완성 사용
    card.innerHTML = `
      <span class="db-badge">● Supabase 연결됨</span>
      <div id="adminLoggedOut">
        <h2>관리자 로그인</h2>
        <p>예약내역 조회와 상태 관리를 위해 로그인하세요.</p>
        <form id="adminLoginForm" class="admin-auth-row" autocomplete="on">
          <label>이메일<input type="email" name="email" autocomplete="username" required></label>
          <label>비밀번호<input type="password" name="password" autocomplete="current-password" required></label>
          <button class="primary-btn" type="submit">로그인</button>
        </form>
        <p id="adminLoginMessage" style="margin-top:10px"></p>
      </div>
      <div id="adminLoggedIn" class="hidden">
        <div class="admin-session-bar">
          <div>관리자 <b id="adminEmail"></b> 로그인됨 <span id="autoRefreshStatus"></span></div>
          <div class="bar-btns">
            <button id="reloadReservations" class="secondary-btn">새로고침</button>
            <button id="adminLogout" class="danger-btn">로그아웃</button>
          </div>
        </div>
        <p id="todaySummary"></p>
        <!-- 관리 섹션 탭 -->
        <div class="admin-section-tabs">
          <button class="admin-sec-tab active" data-sec="reservations">예약 관리</button>
          <button class="admin-sec-tab" data-sec="members">월 회원</button>
        </div>
        <!-- 예약 관리 -->
        <div id="adminSecReservations">
          <div id="reservationTabs" class="res-tabs"></div>
          <div id="reservationList" class="reservation-list"><div class="reservation-empty">예약내역을 불러오는 중…</div></div>
        </div>
        <!-- 월 회원 -->
        <div id="adminSecMembers" class="hidden">
          <div class="member-controls">
            <input id="memberSearch" type="search" placeholder="이름·전화·아파트 검색" autocomplete="off">
            <button id="memberRefresh" class="secondary-btn">새로고침</button>
          </div>
          <div id="memberList" class="member-list"><div class="reservation-empty">회원 목록을 불러오는 중…</div></div>
        </div>
      </div>`;

    const anchor = admin.querySelector('.page-title');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    else admin.prepend(card);

    /* 로그인 */
    card.querySelector('#adminLoginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const btn  = form.querySelector('button');
      const msg  = card.querySelector('#adminLoginMessage');
      btn.disabled = true; btn.textContent = '로그인 중…'; msg.textContent = '';
      try {
        const s  = await signIn(form.email.value.trim(), form.password.value);
        const ok = await isAdmin(s);
        if (!ok) throw new Error('이 계정에는 관리자 권한이 없습니다.');
        saveSession(s);
        form.password.value = '';
        await showAdminSession(s);
      } catch (err) {
        dropSession();
        msg.textContent = err.message || '로그인에 실패했습니다.';
        msg.style.color = '#c94141';
      } finally {
        btn.disabled = false; btn.textContent = '로그인';
      }
    });

    /* 새로고침 */
    card.querySelector('#reloadReservations').addEventListener('click', () => loadReservations(false));

    /* 로그아웃 */
    card.querySelector('#adminLogout').addEventListener('click', async () => {
      stopAutoRefresh();
      const s = await getSession();
      if (s?.access_token) fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:'POST', headers: api(s.access_token) }).catch(()=>{});
      dropSession(); allRows = [];
      card.querySelector('#adminLoggedIn').classList.add('hidden');
      card.querySelector('#adminLoggedOut').classList.remove('hidden');
      setProtected(false);
      toast('로그아웃되었습니다.');
    });

    /* 탭 클릭 */
    card.querySelector('#reservationTabs').addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      currentTab = t.dataset.tab;
      renderReservations();
    });

    /* 상태 변경 버튼 (개선점 3: 금액 같이 수집) */
    card.querySelector('#reservationList').addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id     = btn.dataset.id;
      const when   = document.querySelector(`#reservationList [data-when="${id}"]`);
      const amount = document.querySelector(`#reservationList [data-amount="${id}"]`);
      const iso    = when?.value   ? new Date(when.value).toISOString() : null;
      const amt    = amount?.value ? amount.value : null;
      changeStatus(id, btn.dataset.act, iso, amt, btn);
    });

    /* 페이지 열릴 때 자동 로그인 복원 */
    getSession().then(async s => {
      if (!s) return;
      const ok = await isAdmin(s).catch(() => false);
      if (ok) showAdminSession(s);
      else dropSession();
    });
  }


  /* ════════════════════════════════════════════════════════════════
   * 월 회원 관리
   * ════════════════════════════════════════════════════════════════ */

  let memberRows = [];   // customer_summary 뷰 전체
  let memberQuery = '';  // 검색어

  // 이번 달 완료 건수를 allRows 에서 직접 계산 (뷰보다 최신)
  function thisMonthDone(phone) {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return allRows.filter(r =>
      r.phone === phone &&
      r.status === '완료' &&
      r.done_at &&
      new Date(r.done_at) >= start
    ).length;
  }

  // 실내관리 포함 여부 — 이번 달 완료 건 memo 에서 "실내" 키워드 탐색
  function hasInteriorThisMonth(phone) {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return allRows.some(r =>
      r.phone === phone &&
      r.status === '완료' &&
      r.done_at &&
      new Date(r.done_at) >= start &&
      (r.memo || '').includes('실내')
    );
  }

  // 최근 이용 이력 (완료 건 최대 10개)
  function recentHistory(phone) {
    return allRows
      .filter(r => r.phone === phone && r.status === '완료' && r.done_at)
      .sort((a,b) => new Date(b.done_at) - new Date(a.done_at))
      .slice(0, 10);
  }

  // 등급 배지
  function tierBadge(done_count) {
    if (done_count >= 12) return ['gold',   '🥇 골드'];
    if (done_count >= 6)  return ['silver', '🥈 실버'];
    if (done_count >= 1)  return ['bronze', '🥉 브론즈'];
    return ['', '신규'];
  }

  async function loadMembers(silent = false) {
    const listEl = document.querySelector('#memberList');
    if (!listEl) return;
    const s = await getSession();
    if (!s) return;
    if (!silent) listEl.innerHTML = '<div class="reservation-empty">회원 목록 불러오는 중…</div>';
    try {
      // customer_summary 뷰 조회
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/customer_summary?select=*&order=done_count.desc&limit=200`,
        { headers: api(s.access_token) }
      );
      if (r.status === 401 || r.status === 403) return handleExpired();
      if (!r.ok) {
        // 뷰가 아직 없으면 reservations 에서 직접 집계
        memberRows = buildSummaryFromRows();
      } else {
        memberRows = await r.json();
      }
      renderMembers();
    } catch (err) {
      console.error(err);
      // fallback: allRows 에서 직접 집계
      memberRows = buildSummaryFromRows();
      renderMembers();
    }
  }

  // reservations-upgrade.sql 미실행 시 대비 — allRows 에서 직접 집계
  function buildSummaryFromRows() {
    const map = {};
    allRows.forEach(r => {
      if (!map[r.phone]) {
        map[r.phone] = {
          phone:         r.phone,
          customer_name: r.customer_name,
          apartment:     r.apartment,
          car_model:     r.car_model,
          done_count:    0,
          last_done_at:  null,
          total_amount:  0,
        };
      }
      const m = map[r.phone];
      if (r.customer_name) m.customer_name = r.customer_name;
      if (r.apartment)     m.apartment     = r.apartment;
      if (r.car_model)     m.car_model     = r.car_model;
      if (r.status === '완료') {
        m.done_count++;
        m.total_amount += Number(r.amount || 0);
        if (!m.last_done_at || r.done_at > m.last_done_at) m.last_done_at = r.done_at;
      }
    });
    return Object.values(map).sort((a,b) => b.done_count - a.done_count);
  }

  function memberCardMarkup(m) {
    const monthDone  = thisMonthDone(m.phone);
    const hasInterior= hasInteriorThisMonth(m.phone);
    const history    = recentHistory(m.phone);
    const [tierCls, tierLabel] = tierBadge(m.done_count);
    const lastText   = m.last_done_at
      ? `마지막 ${new Date(m.last_done_at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})}`
      : '완료 이력 없음';
    const totalText  = m.total_amount
      ? `누계 ${Number(m.total_amount).toLocaleString('ko-KR')}원`
      : '';

    const histRows = history.map(r => `
      <div class="hist-row">
        <span class="hist-date">${r.done_at ? new Date(r.done_at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}) : ''}</span>
        <span class="hist-svc">${esc(r.service_type||'')} ${r.memo&&r.memo.includes('실내')? '🪑' : ''}</span>
        <span class="hist-amt">${r.amount ? Number(r.amount).toLocaleString('ko-KR')+'원' : ''}</span>
      </div>`).join('');

    const interiorIcon = hasInterior
      ? '<span title="이번 달 실내관리 완료">🪑 실내 ✅</span>'
      : '<span title="이번 달 실내관리 미완료" style="opacity:.5">🪑 실내 ✗</span>';

    return `<div class="member-card${monthDone > 0 ? ' highlight' : ''}">
  <div class="member-top">
    <div>
      <p class="member-name">${esc(m.customer_name||'이름 없음')}</p>
      <p class="member-phone">
        <a href="tel:${tel(m.phone)}">${esc(m.phone)}</a>
        · ${esc(m.apartment||'')} · ${esc(m.car_model||'')}
      </p>
    </div>
    <span class="member-badge ${tierCls}">${tierLabel}</span>
  </div>
  <div class="member-stats">
    <div class="member-stat${monthDone === 0 ? ' warn' : ''}">
      <b>${monthDone}</b><span>이번 달</span>
    </div>
    <div class="member-stat">
      <b>${m.done_count}</b><span>누적 완료</span>
    </div>
    <div class="member-stat" style="min-width:80px">
      ${interiorIcon}
    </div>
    <div class="member-stat" style="min-width:90px">
      <b style="font-size:13px">${lastText}</b><span>최근 완료</span>
    </div>
    ${totalText ? `<div class="member-stat"><b style="font-size:13px">${esc(totalText)}</b><span>누계 금액</span></div>` : ''}
  </div>
  ${history.length ? `<details class="member-history">
    <summary>최근 이용 이력 ${history.length}건</summary>
    ${histRows}
  </details>` : ''}
  <div class="member-del-row">
    <button class="member-del-btn" data-del-phone="${m.phone}" data-del-name="${esc(m.customer_name||'이름 없음')}">
      이 고객 예약 이력 전체 삭제
    </button>
  </div>
</div>`;
  }

  function renderMembers() {
    const listEl = document.querySelector('#memberList');
    if (!listEl) return;
    const q = memberQuery.trim().toLowerCase();
    let rows = memberRows;
    if (q) {
      rows = rows.filter(m =>
        (m.customer_name||'').toLowerCase().includes(q) ||
        (m.phone||'').includes(q) ||
        (m.apartment||'').toLowerCase().includes(q) ||
        (m.car_model||'').toLowerCase().includes(q)
      );
    }
    if (!rows.length) {
      listEl.innerHTML = `<div class="reservation-empty">${q ? '검색 결과가 없습니다.' : '이용 이력이 있는 고객이 없습니다.'}</div>`;
      return;
    }
    listEl.innerHTML = rows.map(memberCardMarkup).join('');
  }

  async function deleteCustomerReservations(phone, btn) {
    const s = await getSession();
    if (!s) return;
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '삭제 중…';
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/reservations?phone=eq.${encodeURIComponent(phone)}`,
        { method: 'DELETE', headers: api(s.access_token, { Prefer: 'return=minimal' }) }
      );
      if (r.status === 401 || r.status === 403) return handleExpired();
      if (!r.ok) throw new Error(await r.text());
      // 로컬 데이터에서도 제거
      allRows   = allRows.filter(x => x.phone !== phone);
      memberRows = memberRows.filter(x => x.phone !== phone);
      toast('예약 이력이 삭제되었습니다.');
      renderReservations();
      renderMembers();
    } catch (err) {
      console.error(err);
      toast('삭제에 실패했습니다: ' + (err.message || err));
      btn.disabled = false; btn.textContent = orig;
    }
  }

  /* ── 섹션 탭 전환 ────────────────────────────────────────────── */
  function bindSectionTabs(card) {
    card.querySelector('.admin-section-tabs').addEventListener('click', async e => {
      const tab = e.target.closest('.admin-sec-tab');
      if (!tab) return;
      const sec = tab.dataset.sec;
      card.querySelectorAll('.admin-sec-tab').forEach(t => t.classList.toggle('active', t === tab));
      card.querySelector('#adminSecReservations').classList.toggle('hidden', sec !== 'reservations');
      card.querySelector('#adminSecMembers').classList.toggle('hidden', sec !== 'members');
      if (sec === 'members' && memberRows.length === 0) await loadMembers(false);
    });

    card.querySelector('#memberRefresh').addEventListener('click', () => loadMembers(false));

    let searchTimer;
    card.querySelector('#memberSearch').addEventListener('input', e => {
      memberQuery = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderMembers, 250);
    });

    // 고객 예약 이력 삭제 (이벤트 위임)
    document.addEventListener('click', async e => {
      const btn = e.target.closest('.member-del-btn');
      if (!btn) return;
      const phone = btn.dataset.delPhone;
      const name  = btn.dataset.delName;
      if (!confirm(`${name} (${phone}) 님의 예약 이력을 전체 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
      await deleteCustomerReservations(phone, btn);
    });
  }

  async function showAdminSession(s) {
    const card = document.querySelector('#supabaseAdminAuth');
    if (!card) return;
    card.querySelector('#adminLoggedOut').classList.add('hidden');
    card.querySelector('#adminLoggedIn').classList.remove('hidden');
    card.querySelector('#adminEmail').textContent = s.email || '관리자';
    setProtected(true);
    bindSectionTabs(card);
    await loadReservations(false);
    startAutoRefresh();
  }

  /* ── 초기화 ──────────────────────────────────────────────────── */
  injectStyles();
  enhanceBookingForm();
  setupAdminUI();
})();

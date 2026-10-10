/* ATHOME CARCARE — verified-member dashboard.
 * No reservation data is read without a phone-verified Supabase Auth session.
 * Read-only RPC; never query reservations from the browser with an arbitrary phone.
 */
(function () {
  'use strict';
  const PROJECT = 'https://xejdhnwqqaamujkebvne.supabase.co';
  // Supabase publishable (public browser) API key, not a service-role secret.
  const API_KEY = 'sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  const STORAGE_KEY = 'ahcVerifiedMemberSessionV1';
  const TZ = 'Asia/Seoul';
  let phoneAwaitingCode = '';
  let busy = false;

  function elem(id) { return document.getElementById(id); }
  function show(el, visible) { if (el) el.hidden = !visible; }
  function text(el, value) { if (el) el.textContent = value; }
  function make(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = String(value);
    return el;
  }
  function status(message, error) {
    const el = elem('memberStatus');
    text(el, message || '');
    if (el) el.dataset.type = error ? 'error' : 'info';
  }
  function normalizePhone(input) {
    const digits = String(input || '').replace(/\D/g, '');
    if (/^010\d{8}$/.test(digits)) return '+82' + digits.slice(1);
    if (/^8210\d{8}$/.test(digits)) return '+' + digits;
    return null;
  }
  function service(s) {
    return ({ '월2회':'월 2회 정기관리', '월4회':'월 4회 정기관리', '일일세차':'일일세차', '기타':'기타 상담' })[s] || (s || '세차');
  }
  function formatDate(iso, withTime) {
    if (!iso) return '미정';
    const dt = new Date(iso);
    if (!Number.isFinite(dt.getTime())) return '미정';
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone:TZ, year:'numeric', month:'long', day:'numeric', weekday:'short',
      ...(withTime ? {hour:'2-digit',minute:'2-digit',hour12:false} : {})
    }).format(dt);
  }
  function readSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      return session && session.access_token && session.refresh_token ? session : null;
    } catch (_) { return null; }
  }
  function saveSession(s) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      access_token:s.access_token, refresh_token:s.refresh_token,
      expires_at:Date.now() + Number(s.expires_in || 3600)*1000
    }));
  }
  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEY);
    phoneAwaitingCode = '';
  }
  async function fetchJson(path, options) {
    const r = await fetch(PROJECT + path, {
      ...options,
      headers:{
        apikey:API_KEY,
        'Content-Type':'application/json',
        ...(options && options.headers ? options.headers : {})
      }
    });
    const raw = await r.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
    if (!r.ok) {
      const e = new Error((data && (data.msg || data.message || data.error_description || data.error)) || '요청을 처리하지 못했습니다.');
      e.status = r.status;
      throw e;
    }
    return data;
  }
  async function activeToken() {
    let s = readSession();
    if (!s) return null;
    if (Number(s.expires_at) > Date.now() + 60000) return s.access_token;
    try {
      const refreshed = await fetchJson('/auth/v1/token?grant_type=refresh_token', {
        method:'POST', body:JSON.stringify({refresh_token:s.refresh_token})
      });
      if (!refreshed.access_token || !refreshed.refresh_token) throw new Error('세션 갱신 실패');
      saveSession(refreshed);
      return refreshed.access_token;
    } catch (_) {
      clearSession();
      return null;
    }
  }
  function view(mode) {
    show(elem('memberLoginCard'), mode === 'login');
    show(elem('memberCodeCard'), mode === 'verify');
    show(elem('memberDashboard'), mode === 'dashboard');
  }
  function setLoading(value) {
    busy = value;
    for (const id of ['memberSendCode','memberVerifyCode','memberReload']) {
      const el = elem(id);
      if (el) el.disabled = value;
    }
  }
  function cardRow(data, type) {
    const li = make('li','member-timeline-item');
    const dot = make('span', 'member-timeline-dot ' + (type === 'done' ? 'complete' : type));
    dot.setAttribute('aria-hidden','true');
    const body = make('div','member-timeline-body');
    const name = make('strong','',service(data.service));
    const detail = make('small','', (data.carModel ? data.carModel + ' · ' : '') + formatDate(data.date || data.completedAt || data.requestedAt, type !== 'pending'));
    body.append(name,detail);
    li.append(dot,body);
    return li;
  }
  function renderList(id, items, type, emptyMessage) {
    const list = elem(id);
    if (!list) return;
    list.replaceChildren();
    if (!Array.isArray(items) || !items.length) {
      list.append(make('li','member-empty',emptyMessage));
      return;
    }
    items.forEach(row => list.append(cardRow(row,type)));
  }
  function render(data) {
    const member = data && data.member;
    const upcoming = data && data.nextVisit;
    text(elem('memberPlan'), member ? service(member.service) : '확인된 월세차 이용 내역 없음');
    text(elem('memberPlanStatus'), member
      ? ({'접수':'최근 월세차 신청 접수', '확정':'최근 월세차 예약 확정', '완료':'최근 월세차 이용 기록'})[member.status] || '최근 월세차 신청'
      : '월세차 신청 후 확인할 수 있어요');
    text(elem('memberPlanDate'), member
      ? '최근 신청 ' + formatDate(member.requestedAt,false)
      : '회원 가입만으로 정기회원 계약이 시작되지는 않습니다.');
    text(elem('memberNextDate'), upcoming ? formatDate(upcoming.date,true) : '확정된 다음 방문 일정이 없습니다');
    text(elem('memberNextService'), upcoming
      ? service(upcoming.service) + (upcoming.carModel ? ' · ' + upcoming.carModel : '')
      : '예약 확정 후 날짜가 이곳에 표시됩니다.');
    text(elem('memberMonthCompleted'), Number(data.monthCompleted || 0) + '회');
    text(elem('memberTotalCompleted'), Number(data.totalCompleted || 0) + '회');
    renderList('memberUpcoming',data.upcoming,'scheduled','확정된 향후 예약이 없습니다.');
    renderList('memberPending',data.pending,'pending','접수 대기 중인 예약이 없습니다.');
    renderList('memberHistory',data.history,'done','완료 처리된 관리 이력이 아직 없습니다.');
    show(elem('memberNoRecords'), !data.hasRecords);
  }
  async function loadDashboard() {
    if (busy) return;
    setLoading(true);
    status('관리 일정을 안전하게 불러오는 중입니다.');
    try {
      const token = await activeToken();
      if (!token) {
        view('login');
        status('인증이 만료되었습니다. 다시 로그인해 주세요.');
        return;
      }
      const data = await fetchJson('/rest/v1/rpc/get_my_carcare_dashboard',{
        method:'POST', body:'{}',headers:{Authorization:'Bearer ' + token}
      });
      render(data || {});
      view('dashboard');
      status('');
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        clearSession();
        view('login');
        status('인증을 다시 진행해 주세요.', true);
      } else {
        view('dashboard');
        status('관리 이력을 불러오지 못했습니다. 다시 시도해 주세요.',true);
      }
    } finally { setLoading(false); }
  }
  async function sendCode(event) {
    event.preventDefault();
    if (busy) return;
    const phone = normalizePhone(elem('memberPhone').value);
    if (!phone) { status('010으로 시작하는 휴대폰 번호 11자리를 입력해 주세요.',true); return; }
    setLoading(true);
    status('인증 문자를 요청하고 있습니다.');
    try {
      await fetchJson('/auth/v1/otp',{method:'POST',body:JSON.stringify({phone, channel:'sms', create_user:true})});
      phoneAwaitingCode = phone;
      view('verify');
      text(elem('memberPhoneHint'),'입력하신 번호로 발송된 인증번호를 입력해 주세요.');
      status('인증번호를 발송했습니다. 수신까지 잠시 걸릴 수 있습니다.');
      elem('memberCode').focus();
    } catch (e) {
      // Do not reveal whether this phone has existing bookings.
      status(e.status === 429
        ? '인증 요청이 많습니다. 잠시 후 다시 시도해 주세요.'
        : '문자 발송을 완료하지 못했습니다. 문자 인증 서비스 설정 또는 휴대폰 번호를 확인해 주세요.',true);
    } finally { setLoading(false); }
  }
  async function verifyCode(event) {
    event.preventDefault();
    if (busy || !phoneAwaitingCode) return;
    const token = (elem('memberCode').value || '').trim();
    if (!/^\d{6,8}$/.test(token)) {status('문자로 받은 인증번호를 입력해 주세요.',true);return;}
    setLoading(true);
    status('본인인증 확인 중입니다.');
    try {
      const result = await fetchJson('/auth/v1/verify',{
        method:'POST',body:JSON.stringify({phone:phoneAwaitingCode,token,type:'sms'})
      });
      if (!result.access_token || !result.refresh_token) throw new Error('인증 정보 없음');
      saveSession(result);
      phoneAwaitingCode = '';
      setLoading(false);
      await loadDashboard();
    } catch (e) {
      status('인증번호가 올바르지 않거나 유효시간이 지났습니다. 다시 확인해 주세요.',true);
      setLoading(false);
    }
  }
  async function signOut() {
    const s = readSession();
    clearSession();
    view('login');
    text(elem('memberCode'),'');
    status('로그아웃했습니다. 이 기기에서는 다시 본인인증이 필요합니다.');
    if (s) {
      try { await fetchJson('/auth/v1/logout',{method:'POST',headers:{Authorization:'Bearer ' + s.access_token},body:'{}'}); }
      catch (_) { /* Local session already cleared; remote invalidation is best-effort. */ }
    }
  }
  function init() {
    if (!elem('memberLoginForm')) return;
    elem('memberLoginForm').addEventListener('submit', sendCode);
    elem('memberCodeForm').addEventListener('submit',verifyCode);
    elem('memberBack').addEventListener('click',function(){phoneAwaitingCode='';view('login');status('');});
    elem('memberReload').addEventListener('click',loadDashboard);
    elem('memberLogout').addEventListener('click',signOut);
    view('login');
    if (readSession()) loadDashboard();
    document.addEventListener('click',function(e) {
      const go = e.target.closest('[data-go="mypage"]');
      if (go && readSession()) loadDashboard();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
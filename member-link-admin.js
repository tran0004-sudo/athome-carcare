/* 사장님 전용: 카카오 로그인 고객의 휴대폰 번호 연결 요청 승인.
   기존 관리자 로그인 세션을 재사용하며, 권한은 Supabase(is_owner)가 다시 확인합니다. */
(function () {
  'use strict';
  const URL = 'https://xejdhnwqqaamujkebvne.supabase.co';
  const KEY = 'sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  const AUTH_KEY = 'athomeCarcareAdminSession';
  let rows = [], busy = false;
  const $ = id => document.getElementById(id);
  const node = (tag, klass, value) => {
    const el = document.createElement(tag);
    if (klass) el.className = klass;
    if (value !== undefined) el.textContent = String(value);
    return el;
  };
  const fmtPhone = p => String(p || '').replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
  const fmtDate = v => {
    const d = new Date(v);
    return Number.isFinite(d.getTime())
      ? new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false}).format(d)
      : '';
  };
  function note(message, error) {
    const el = $('linkAdminMessage');
    if (el) { el.textContent = message; el.dataset.error = error ? '1' : '0'; }
  }
  async function token() {
    let s;
    try { s = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (_) { return null; }
    if (!s || !s.access_token) return null;
    if (s.expires_at && Date.now() / 1000 < s.expires_at - 60) return s.access_token;
    if (!s.refresh_token) return null;
    const r = await fetch(URL + '/auth/v1/token?grant_type=refresh_token', {
      method:'POST', headers:{apikey:KEY, 'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:s.refresh_token})
    });
    if (!r.ok) return null;
    const d = await r.json();
    s = {...s, access_token:d.access_token, refresh_token:d.refresh_token, expires_at:d.expires_at};
    localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    return s.access_token;
  }
  async function rpc(name, body) {
    const t = await token();
    if (!t) throw Error('관리자로 로그인한 후 이용해 주세요.');
    const r = await fetch(URL + '/rest/v1/rpc/' + name, {
      method:'POST', body:JSON.stringify(body || {}),
      headers:{apikey:KEY, Authorization:'Bearer ' + t, 'Content-Type':'application/json'}
    });
    const raw = await r.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
    if (!r.ok) throw Error(r.status === 403 || (data && data.code === '42501')
      ? '관리자 권한이 필요합니다. (DB 설정 1단계 확인)'
      : ((data && (data.message || data.hint)) || '처리하지 못했습니다 (' + r.status + ')'));
    return data;
  }
  function render() {
    const list = $('linkAdminList');
    if (!list) return;
    list.replaceChildren();
    if (!rows.length) { list.append(node('p', 'vip-ledger-help', '연결 요청이 없습니다.')); return; }
    for (const row of rows) {
      const card = node('article', 'link-admin-card');
      card.dataset.status = row.status;
      const head = node('div', 'link-admin-head');
      head.append(node('strong', '', row.nickname + ' · ' + fmtPhone(row.phone)),
        node('span', 'link-admin-badge', ({pending:'승인 대기', approved:'연결됨', rejected:'거절'})[row.status] || row.status));
      const meta = node('p', 'link-admin-meta',
        '요청 ' + fmtDate(row.requestedAt) +
        ' · ' + (row.hasReservation ? '이 번호의 예약 기록 있음' : '이 번호의 예약 기록 없음') +
        (row.contractName ? ' · 월세차 계약: ' + row.contractName : ''));
      const actions = node('div', 'link-admin-actions');
      if (row.status !== 'approved') {
        const ok = node('button', 'link-admin-ok', '승인'); ok.type = 'button';
        ok.addEventListener('click', () => decide(row, 'approved'));
        actions.append(ok);
      }
      if (row.status !== 'rejected') {
        const no = node('button', 'link-admin-no', row.status === 'approved' ? '연결 해제' : '거절'); no.type = 'button';
        no.addEventListener('click', () => decide(row, 'rejected'));
        actions.append(no);
      }
      card.append(head, meta, actions);
      list.append(card);
    }
  }
  async function decide(row, status) {
    if (busy) return;
    if (status === 'approved' && !row.hasReservation && !row.contractName &&
        !confirm('이 번호의 예약·계약 기록이 없습니다. 그래도 승인할까요?')) return;
    busy = true;
    try {
      await rpc('admin_set_phone_link', {p_user_id:row.userId, p_status:status});
      note(status === 'approved' ? '승인했습니다. 고객이 새로고침하면 일정이 보입니다.' : '처리했습니다.');
      busy = false;
      await load();
    } catch (e) { note(e.message, true); busy = false; }
  }
  async function load() {
    if (busy) return;
    busy = true; note('연결 요청을 불러오는 중입니다.');
    try {
      rows = await rpc('admin_list_phone_links') || [];
      render();
      const pending = rows.filter(r => r.status === 'pending').length;
      note(pending ? '승인 대기 ' + pending + '건이 있습니다.' : '승인 대기 요청이 없습니다.');
    } catch (e) { note(e.message, true); }
    finally { busy = false; }
  }
  function initialize() {
    const root = $('adminSecMembers');
    if (!root || root.querySelector('#memberLinkAdminRoot')) return;
    const section = node('section', 'vip-ledger-root');
    section.id = 'memberLinkAdminRoot';
    const refresh = node('button', '', '요청 새로고침'); refresh.type = 'button';
    refresh.addEventListener('click', load);
    const controls = node('div', 'vip-ledger-controls'); controls.append(refresh);
    const message = node('p', 'vip-ledger-message'); message.id = 'linkAdminMessage'; message.setAttribute('role', 'status');
    const list = node('div', 'link-admin-list'); list.id = 'linkAdminList';
    section.append(node('h3', '', '카카오 회원 · 번호 연결 요청'),
      node('p', 'vip-ledger-help', '고객이 카카오 로그인 후 입력한 번호가 예약·계약 기록과 맞는지 확인하고 승인하세요. 승인된 번호의 기록만 고객에게 보입니다.'),
      controls, message, list);
    root.prepend(section);
    document.addEventListener('click', e => {
      if (e.target.closest('[data-sec="members"]')) setTimeout(load, 150);
    });
  }
  const observer = new MutationObserver(() => { if ($('adminSecMembers')) { initialize(); observer.disconnect(); } });
  const start = () => { initialize(); if (!$('adminSecMembers')) observer.observe(document.body, {childList:true, subtree:true}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

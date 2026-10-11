/* 관리자 · 일정 달력
   확정된 방문 일정(월회원 + 비회원)을 월 달력으로 보여 줍니다.
   - 날짜: 확정 방문 일시(scheduled_at). 없으면 고객 희망일을 '희망일'로 표시
   - 월회원 구분: 운영 중인 월세차 계약 번호이거나 서비스가 월2회/월4회인 예약
   읽기 전용이며, 상태 변경은 기존 '예약 관리' 탭에서 합니다. */
(function () {
  'use strict';
  var URL_ = 'https://xejdhnwqqaamujkebvne.supabase.co';
  var KEY = 'sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  var AUTH_KEY = 'athomeCarcareAdminSession';
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var state = { y: 0, m: 0, sel: '', rows: [], members: new Set(), showDone: false, loaded: false, busy: false };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function digits(v) { var s = String(v || '').replace(/\D/g, ''); if (/^8210\d{8}$/.test(s)) s = '0' + s.slice(2); return s; }
  function kstParts(iso) {
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
    var g = function (k) { return (p.find(function (x) { return x.type === k; }) || {}).value || ''; };
    var h = g('hour') === '24' ? '00' : g('hour');
    return { day: g('year') + '-' + g('month') + '-' + g('day'), time: h + ':' + g('minute') };
  }
  function ymd(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function todayKst() { return kstParts(new Date().toISOString()).day; }

  async function token() {
    var s; try { s = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (_) { return null; }
    if (!s || !s.access_token) return null;
    if (s.expires_at && Date.now() / 1000 < s.expires_at - 60) return s.access_token;
    if (!s.refresh_token) return null;
    var r = await fetch(URL_ + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!r.ok) return null;
    var d = await r.json();
    s.access_token = d.access_token; s.refresh_token = d.refresh_token; s.expires_at = d.expires_at;
    localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    return s.access_token;
  }
  async function api(path) {
    var t = await token();
    if (!t) throw new Error('관리자로 로그인한 후 이용해 주세요.');
    var r = await fetch(URL_ + '/rest/v1/' + path, { headers: { apikey: KEY, Authorization: 'Bearer ' + t } });
    var d = await r.json().catch(function () { return []; });
    if (!r.ok) throw new Error((d && d.message) || ('불러오기 실패 (' + r.status + ')'));
    return d;
  }

  function injectStyle() {
    if (document.getElementById('admCalStyle')) return;
    var st = document.createElement('style'); st.id = 'admCalStyle';
    st.textContent = [
      '.adm-cal{padding:6px 2px 18px;}',
      '.adm-cal-head{display:flex;align-items:center;gap:8px;margin:4px 0 10px;}',
      '.adm-cal-head h3{flex:1;margin:0;text-align:center;font-size:19px;color:#14302B;}',
      '.adm-cal-head button,.adm-cal-tools button{min-height:40px;min-width:40px;padding:0 12px;border:1.5px solid #D5E2DA;background:#fff;border-radius:10px;font-weight:800;color:#1F7A55;font-family:inherit;cursor:pointer;}',
      '.adm-cal-tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 10px;font-size:13px;color:#4F6B5D;}',
      '.adm-cal-tools label{display:inline-flex;align-items:center;gap:6px;cursor:pointer;}',
      '.adm-cal-sum{margin-left:auto;font-weight:700;}',
      '.adm-cal-legend{display:flex;gap:12px;font-size:12.5px;color:#4F6B5D;margin:0 0 8px;}',
      '.adm-cal-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px;}',
      '.adm-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;}',
      '.adm-cal-wd{text-align:center;font-size:12px;font-weight:800;color:#6B8074;padding:4px 0;}',
      '.adm-cal-wd.sun,.adm-cal-day.sun .n{color:#C0392B;} .adm-cal-wd.sat,.adm-cal-day.sat .n{color:#2B5FC0;}',
      '.adm-cal-day{min-height:78px;border:1px solid #E3EBE5;border-radius:10px;background:#fff;padding:4px;text-align:left;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;gap:2px;overflow:hidden;}',
      '.adm-cal-day.out{background:#F7F9F8;opacity:.55;}',
      '.adm-cal-day.today{border-color:#1F7A55;box-shadow:inset 0 0 0 1px #1F7A55;}',
      '.adm-cal-day.sel{background:#EEF7F1;border-color:#1F7A55;}',
      '.adm-cal-day .n{font-size:12.5px;font-weight:800;color:#33493F;}',
      '.adm-cal-chip{display:block;font-size:11px;line-height:1.35;padding:1px 4px;border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.adm-cal-chip.mem{background:#E3F2EA;color:#145B40;} .adm-cal-chip.guest{background:#FFF1DC;color:#8A5200;} .adm-cal-chip.done{background:#EEEEEE;color:#777;text-decoration:line-through;}',
      '.adm-cal-more{font-size:11px;color:#6B8074;font-weight:700;}',
      '.adm-cal-list{margin-top:14px;border-top:1px solid #E3EBE5;padding-top:12px;}',
      '.adm-cal-list h4{margin:0 0 8px;font-size:16px;color:#14302B;}',
      '.adm-cal-item{display:grid;grid-template-columns:62px 1fr;gap:10px;padding:10px 12px;border:1px solid #E3EBE5;border-radius:12px;margin-bottom:8px;background:#fff;}',
      '.adm-cal-item .t{font-size:16px;font-weight:800;color:#14302B;}',
      '.adm-cal-item .t small{display:block;font-size:11px;font-weight:700;color:#8A5200;}',
      '.adm-cal-item b{font-size:15px;color:#14302B;} .adm-cal-item p{margin:3px 0 0;font-size:13px;color:#4F6B5D;line-height:1.5;}',
      '.adm-cal-badge{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:800;vertical-align:1px;}',
      '.adm-cal-badge.mem{background:#1F7A55;color:#fff;} .adm-cal-badge.guest{background:#F2A93B;color:#fff;} .adm-cal-badge.done{background:#999;color:#fff;}',
      '.adm-cal-item a{color:#1F7A55;font-weight:700;}',
      '.adm-cal-empty{color:#6B8074;font-size:13.5px;padding:8px 2px;}',
      '.adm-cal-msg{font-size:13px;color:#8d2b2b;margin:6px 0;}',
      '@media(max-width:520px){.adm-cal-day{min-height:62px;padding:3px;} .adm-cal-chip{font-size:10px;padding:0 3px;} .adm-cal-chip .nm{display:none;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function itemsOf(row) {
    var isMember = state.members.has(digits(row.phone)) || row.service_type === '월2회' || row.service_type === '월4회';
    var when = null, tentative = false;
    if (row.scheduled_at) when = kstParts(row.scheduled_at);
    else if (row.preferred_date) { when = { day: row.preferred_date, time: (row.preferred_time || '').slice(0, 5) }; tentative = true; }
    if (!when) return null;
    return { row: row, day: when.day, time: when.time || '', tentative: tentative, member: isMember, done: row.status === '완료' };
  }

  function visible() {
    return state.rows.map(itemsOf).filter(function (x) { return x && (state.showDone || !x.done); })
      .sort(function (a, b) { return (a.day + a.time).localeCompare(b.day + b.time); });
  }

  function render() {
    var root = document.getElementById('adminSecCalendar'); if (!root) return;
    var items = visible();
    var byDay = {};
    items.forEach(function (it) { (byDay[it.day] = byDay[it.day] || []).push(it); });
    var y = state.y, m = state.m;
    var first = new Date(Date.UTC(y, m, 1)).getUTCDay();
    var days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var prevDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var today = todayKst();
    var monthKey = ymd(y, m, 1).slice(0, 7);
    var monthItems = items.filter(function (it) { return it.day.slice(0, 7) === monthKey && !it.done; });
    var memCount = monthItems.filter(function (it) { return it.member; }).length;

    var cells = '';
    for (var i = 0; i < 42; i++) {
      var d, cy = y, cm = m, out = false;
      if (i < first) { d = prevDays - first + 1 + i; cm = m - 1; out = true; }
      else if (i >= first + days) { d = i - first - days + 1; cm = m + 1; out = true; }
      else d = i - first + 1;
      if (cm < 0) { cm = 11; cy = y - 1; } if (cm > 11) { cm = 0; cy = y + 1; }
      var key = ymd(cy, cm, d);
      var list = byDay[key] || [];
      var chips = list.slice(0, 3).map(function (it) {
        var cls = it.done ? 'done' : (it.member ? 'mem' : 'guest');
        return '<span class="adm-cal-chip ' + cls + '">' + esc(it.time || '시간미정') + ' <span class="nm">' + esc(it.row.customer_name || '') + '</span></span>';
      }).join('');
      if (list.length > 3) chips += '<span class="adm-cal-more">+' + (list.length - 3) + '건</span>';
      var wd = i % 7;
      cells += '<button type="button" class="adm-cal-day' + (out ? ' out' : '') + (key === today ? ' today' : '') + (key === state.sel ? ' sel' : '') + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + '" data-day="' + key + '"><span class="n">' + d + '</span>' + chips + '</button>';
    }

    var sel = state.sel, selList = byDay[sel] || [];
    var selDate = new Date(sel + 'T12:00:00+09:00');
    var listHtml = '<div class="adm-cal-list"><h4>' + (sel ? (Number(sel.slice(5, 7)) + '월 ' + Number(sel.slice(8, 10)) + '일 (' + WD[selDate.getUTCDay()] + ') 일정 ' + selList.length + '건') : '') + '</h4>' +
      (selList.length ? selList.map(function (it) {
        var r = it.row, badge = it.done ? '<span class="adm-cal-badge done">완료</span>' : (it.member ? '<span class="adm-cal-badge mem">월회원</span>' : '<span class="adm-cal-badge guest">비회원</span>');
        var tel = digits(r.phone);
        return '<div class="adm-cal-item"><div class="t">' + esc(it.time || '미정') + (it.tentative ? '<small>희망일</small>' : '') + '</div><div>' +
          '<b>' + esc(r.customer_name || '이름 없음') + '</b>' + badge +
          '<p>' + esc([r.car_model, r.plate].filter(Boolean).join(' · ')) + ' · ' + esc(r.service_type || '') + '</p>' +
          '<p>' + esc([r.apartment, r.address].filter(Boolean).join(' ')) + '</p>' +
          (tel ? '<p><a href="tel:' + esc(tel) + '">' + esc(r.phone) + '</a></p>' : '') +
          '</div></div>';
      }).join('') : '<p class="adm-cal-empty">이 날은 확정된 일정이 없습니다.</p>') + '</div>';

    root.innerHTML = '<div class="adm-cal">' +
      '<div class="adm-cal-head"><button type="button" data-nav="-1" aria-label="이전 달">‹</button><h3>' + y + '년 ' + (m + 1) + '월</h3><button type="button" data-nav="1" aria-label="다음 달">›</button></div>' +
      '<div class="adm-cal-tools"><button type="button" data-nav="today">오늘</button><button type="button" data-nav="reload">새로고침</button>' +
      '<label><input type="checkbox" id="admCalDone"' + (state.showDone ? ' checked' : '') + '> 완료 건도 보기</label>' +
      '<span class="adm-cal-sum">이번 달 확정 ' + monthItems.length + '건 (월회원 ' + memCount + ' · 비회원 ' + (monthItems.length - memCount) + ')</span></div>' +
      '<div class="adm-cal-legend"><span><i style="background:#1F7A55"></i>월회원</span><span><i style="background:#F2A93B"></i>비회원</span><span><i style="background:#bbb"></i>완료</span></div>' +
      '<p class="adm-cal-msg" id="admCalMsg"></p>' +
      '<div class="adm-cal-grid">' + WD.map(function (w, i) { return '<div class="adm-cal-wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</div>'; }).join('') + cells + '</div>' +
      listHtml + '</div>';
  }

  async function load() {
    if (state.busy) return; state.busy = true;
    var root = document.getElementById('adminSecCalendar');
    if (root && !state.loaded) root.innerHTML = '<p class="adm-cal-empty">일정을 불러오는 중…</p>';
    try {
      var res = await Promise.all([
        api('reservations?select=id,customer_name,phone,apartment,address,car_model,plate,service_type,status,scheduled_at,preferred_date,preferred_time&status=in.(%ED%99%95%EC%A0%95,%EC%99%84%EB%A3%8C)&order=created_at.desc&limit=1000'),
        api('vip_contracts?select=phone,status&status=eq.active').catch(function () { return []; })
      ]);
      state.rows = res[0] || [];
      state.members = new Set((res[1] || []).map(function (c) { return digits(c.phone); }));
      state.loaded = true;
      render();
    } catch (e) {
      render();
      var msg = document.getElementById('admCalMsg'); if (msg) msg.textContent = e.message;
    } finally { state.busy = false; }
  }

  function bind() {
    var root = document.getElementById('adminSecCalendar');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = '1';
    root.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) {
        var v = nav.dataset.nav;
        if (v === 'reload') { load(); return; }
        if (v === 'today') { var t = todayKst(); state.y = +t.slice(0, 4); state.m = +t.slice(5, 7) - 1; state.sel = t; }
        else { state.m += Number(v); if (state.m < 0) { state.m = 11; state.y--; } if (state.m > 11) { state.m = 0; state.y++; } }
        render(); return;
      }
      var day = e.target.closest('[data-day]');
      if (day) {
        state.sel = day.dataset.day;
        var yy = +state.sel.slice(0, 4), mm = +state.sel.slice(5, 7) - 1;
        if (yy !== state.y || mm !== state.m) { state.y = yy; state.m = mm; }
        render();
      }
    });
    root.addEventListener('change', function (e) {
      if (e.target.id === 'admCalDone') { state.showDone = e.target.checked; render(); }
    });
  }

  window.renderAdminCalendar = function () {
    injectStyle();
    if (!state.y) { var t = todayKst(); state.y = +t.slice(0, 4); state.m = +t.slice(5, 7) - 1; state.sel = t; }
    bind();
    load();
  };
})();

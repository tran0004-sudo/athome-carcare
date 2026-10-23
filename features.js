/* 앳홈카케어 예약·회원·관리자 기능 (defer) — 원래 8개 파일을 같은 순서로 합침.
   각 부분은 따로 감싸 두어 한 곳 오류가 다른 기능을 멈추지 않습니다. */

/* ===== vip-refresh.js ===== */
try {
/* VIP-first progressive enhancement for the existing booking form.
   Keeps all existing field names, required validation, quote and Supabase submit handlers. */
(function () {
  'use strict';

  function initWizard() {
    var form = document.getElementById('bookingForm');
    if (!form || form.classList.contains('booking-wizard-ready')) return;
    var label = document.getElementById('wizardStepLabel');
    var title = document.getElementById('wizardStepTitle');
    var next = document.getElementById('wizardNext');
    var prev = document.getElementById('wizardPrev');
    if (!label || !title || !next || !prev) return;

    /* v2: 2단계 → 한 화면 예약. 모든 칸을 처음부터 보여 주고 '다음' 버튼은 없앱니다. */
    form.dataset.vipStep = '2';
    form.querySelectorAll('.wizard-hidden').forEach(function (el) { el.classList.remove('wizard-hidden'); });
    label.textContent = '간편 예약';
    title.textContent = '한 화면에서 바로 접수하세요';
    next.hidden = true; prev.hidden = true;
    var ctrls = next.closest('.booking-wizard-controls'); if (ctrls) ctrls.hidden = true;
    var bar = form.querySelector('.wizard-progress'); if (bar) bar.hidden = true;
    form.classList.add('booking-wizard-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWizard);
  } else {
    initWizard();
  }
})();

/* 홈 · 실제 관리 결과 슬라이더 */
(function () {
  'use strict';
  function init() {
    var track = document.getElementById('workTrack');
    if (!track || track.dataset.ready) return;
    track.dataset.ready = '1';
    var root = document.getElementById('workSlider');
    var slides = track.querySelectorAll('.work-slide');
    var dots = root.querySelectorAll('.work-dots button');
    var prev = root.querySelector('.work-nav.prev');
    var next = root.querySelector('.work-nav.next');
    var cur = 0, timer = null;
    function width() { return slides[0].offsetWidth + 14; }
    function go(i) {
      cur = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: cur * width(), behavior: 'smooth' });
    }
    function sync() {
      cur = Math.round(track.scrollLeft / width());
      dots.forEach(function (d, i) { d.classList.toggle('on', i === cur); d.setAttribute('aria-selected', i === cur ? 'true' : 'false'); });
      prev.disabled = cur === 0; next.disabled = cur === slides.length - 1;
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      stop();
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      timer = setInterval(function () { go(cur === slides.length - 1 ? 0 : cur + 1); }, 5000);
    }
    track.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
    prev.addEventListener('click', function () { go(cur - 1); play(); });
    next.addEventListener('click', function () { go(cur + 1); play(); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); play(); }); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    });
    ['touchstart', 'mouseenter', 'focusin'].forEach(function (ev) { root.addEventListener(ev, stop, { passive: true }); });
    ['touchend', 'mouseleave', 'focusout'].forEach(function (ev) { root.addEventListener(ev, play, { passive: true }); });
    window.addEventListener('resize', function () { go(cur); });
    sync(); play();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* 홈 히어로 · GV80 전후 슬라이더 (처음 한 번 살짝 움직여 사용법을 알려줌) */
(function () {
  'use strict';
  function init() {
    var wrap = document.getElementById('heroCompare');
    if (!wrap || wrap.dataset.ready) return;
    wrap.dataset.ready = '1';
    var input = wrap.querySelector('input');
    var after = wrap.querySelector('.after');
    var divider = wrap.querySelector('.divider');
    function set(v) { after.style.clipPath = 'inset(0 0 0 ' + v + '%)'; divider.style.left = v + '%'; }
    input.addEventListener('input', function () { set(input.value); });
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    var t0 = null, stopped = false;
    ['pointerdown', 'touchstart', 'input'].forEach(function (ev) { wrap.addEventListener(ev, function () { stopped = true; }, { passive: true, once: true }); });
    function step(ts) {
      if (stopped) return;
      if (t0 === null) t0 = ts;
      var p = (ts - t0) / 2400;
      if (p >= 1) { set(50); input.value = 50; return; }
      var v = 50 + Math.sin(p * Math.PI * 2) * 28 * (1 - p);
      set(v); input.value = v;
      requestAnimationFrame(step);
    }
    setTimeout(function () { requestAnimationFrame(step); }, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
} catch (e) { console.error('[vip-refresh.js]', e); }

/* ===== booking-simple.js ===== */
try {
/* 예약 폼 간소화 (v35)
   - 기존 입력 칸 이름(name)과 제출 로직은 그대로 두고, 화면만 줄이고 합칩니다.
   - 차종 구분: 자동 선택될 때는 숨김 / 방문 위치: 아파트+상세주소 통합
   - 희망 일정: 빠른 선택 버튼 / 옵션·쿠폰·추천인: 접기 / 이전 입력 정보 기억 */
(function () {
  'use strict';
  var KEY = 'athomeBookingProfile';
  var FIELDS = ['customerName', 'phone', 'apartment', 'plate'];

  function store(get, value) {
    try {
      if (get) return JSON.parse(localStorage.getItem(KEY) || '{}');
      if (value === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(value));
    } catch (e) {}
    return {};
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }

  function init() {
    var form = document.getElementById('bookingForm');
    if (!form || form.dataset.simple) return;
    form.dataset.simple = '1';
    var $ = function (sel) { return form.querySelector(sel); };

    /* 1) 방문 위치: 아파트명 + 상세 주소를 한 칸으로 */
    var apt = $('[name="apartment"]');
    var addr = $('[name="address"]');
    if (apt) {
      var aptLabel = apt.closest('label');
      aptLabel.firstChild.textContent = '방문 위치 ';
      var hint = document.createElement('small');
      hint.className = 'field-hint';
      hint.textContent = '아파트·동·주차 위치까지 적어 주세요';
      aptLabel.insertBefore(hint, apt);
      apt.placeholder = '예: 중산지구 ○○아파트 103동 지하 2층';
      aptLabel.classList.add('span-2');
    }
    if (addr) addr.closest('label').classList.add('bk-hide');

    /* 2) 차종 구분: 자동 선택이면 숨기고, 직접 입력(기타)일 때만 보여줌 */
    var cls = $('#carClassSelect');
    var clsLabel = cls && cls.closest('label');
    function syncClass() {
      if (!clsLabel) return;
      var auto = cls.disabled && cls.value;
      var none = !$('#carBrandSelect').value;
      clsLabel.classList.toggle('bk-hide', !!auto || none);
    }
    ['#carBrandSelect', '#carModelSelect', '#carCustomInput'].forEach(function (s) {
      var el = $(s);
      if (el) { el.addEventListener('change', function () { setTimeout(syncClass, 0); }); el.addEventListener('input', function () { setTimeout(syncClass, 0); }); }
    });
    syncClass();

    /* 3) 희망 일정: 한 달 달력 카드 + 전자시계식 시간 입력 */
    var date = $('[name="preferredDate"]');
    var time = $('[name="preferredTime"]');
    if (date && time) {
      var dateLabel = date.closest('label');
      var timeLabel = time.closest('label');
      var WD = ['일', '월', '화', '수', '목', '금', '토'];
      var RANGE = 30;
      var today0 = new Date(); today0.setHours(0, 0, 0, 0);
      var last = new Date(today0); last.setDate(last.getDate() + RANGE);
      var start = new Date(today0); start.setDate(start.getDate() - start.getDay());
      var end = new Date(last); end.setDate(end.getDate() + (6 - end.getDay()));
      var cells = WD.map(function (w, i) { return '<span class="bk-wd' + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : '') + '">' + w + '</span>'; }).join('');
      for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        var off = d < today0 || d > last;
        var diff = Math.round((d - today0) / 864e5);
        var tag = diff === 0 ? '오늘' : diff === 1 ? '내일' : (d.getDate() === 1 ? (d.getMonth() + 1) + '월' : '');
        cells += '<button type="button" data-date="' + ymd(d) + '"' + (off ? ' disabled' : '') +
          ' class="' + (d.getDay() === 0 ? 'is-sun' : d.getDay() === 6 ? 'is-sat' : '') + '"' +
          ' aria-label="' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WD[d.getDay()] + '요일">' +
          '<b>' + d.getDate() + '</b><em>' + tag + '</em></button>';
      }
      var m1 = today0.getMonth() + 1, m2 = last.getMonth() + 1;
      var wrap = document.createElement('div');
      wrap.className = 'span-2 bk-when';
      wrap.setAttribute('data-vip-step', '2');
      wrap.innerHTML =
        '<span class="opt-title">희망 일정 <small class="field-hint">비워 두시면 연락드려 정해요 (선택)</small></span>' +
        '<div class="bk-sub"><b>날짜</b><span class="bk-month">' + today0.getFullYear() + '년 ' + m1 + '월' + (m2 !== m1 ? ' ~ ' + m2 + '월' : '') + '</span></div>' +
        '<div class="bk-cal" role="group" aria-label="희망 날짜">' + cells + '</div>' +
        '<div class="bk-sub"><b>시간</b><button type="button" class="bk-clear">시간 지우기</button></div>' +
        '<div class="bk-clock" role="group" aria-label="희망 시간">' +
          '<button type="button" class="bk-ampm" data-k="ampm" aria-label="오전/오후 바꾸기">오전</button>' +
          '<div class="bk-unit"><button type="button" data-k="h" data-v="1" aria-label="시 올리기">▲</button><output class="bk-dig" data-u="h">--</output><button type="button" data-k="h" data-v="-1" aria-label="시 내리기">▼</button></div>' +
          '<span class="bk-colon">:</span>' +
          '<div class="bk-unit"><button type="button" data-k="m" data-v="10" aria-label="분 올리기">▲</button><output class="bk-dig" data-u="m">--</output><button type="button" data-k="m" data-v="-10" aria-label="분 내리기">▼</button></div>' +
        '</div>' +
        '<p class="bk-when-sum" aria-live="polite"></p>';
      dateLabel.parentNode.insertBefore(wrap, dateLabel);
      var keep = document.createElement('div'); keep.hidden = true;
      keep.appendChild(dateLabel); keep.appendChild(timeLabel); wrap.appendChild(keep);
      dateLabel.removeAttribute('data-vip-step'); timeLabel.removeAttribute('data-vip-step');

      var cal = wrap.querySelector('.bk-cal');
      var clock = wrap.querySelector('.bk-clock');
      var sum = wrap.querySelector('.bk-when-sum');
      var hEl = clock.querySelector('[data-u="h"]'), mEl = clock.querySelector('[data-u="m"]'), apEl = clock.querySelector('.bk-ampm');

      function getHM() { if (!time.value) return null; var p = time.value.split(':'); return [parseInt(p[0], 10), parseInt(p[1], 10)]; }
      function setHM(h, m) { time.value = h == null ? '' : pad(h) + ':' + pad(m); fire(time, 'change'); }
      function ko(h, m) { return (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + '시' + (m ? ' ' + m + '분' : ''); }
      function step(k, v) {
        var hm = getHM();
        if (!hm) { setHM(10, 0); return; }              /* 처음 누르면 오전 10:00부터 시작 */
        var h = hm[0], m = hm[1];
        if (k === 'h') h = (h + v + 24) % 24;
        else if (k === 'm') m = (m + v + 60) % 60;
        else if (k === 'ampm') h = (h + 12) % 24;
        setHM(h, m);
      }
      function sync() {
        var dv = date.value, hm = getHM();
        Array.prototype.forEach.call(cal.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.date === dv ? 'true' : 'false'); });
        clock.classList.toggle('is-empty', !hm);
        hEl.textContent = hm ? pad((hm[0] % 12) || 12) : '--';
        mEl.textContent = hm ? pad(hm[1]) : '--';
        apEl.textContent = hm ? (hm[0] < 12 ? '오전' : '오후') : '오전';
        var warn = '';
        if (dv && hm && dv === ymd(new Date())) {
          var now = new Date(), want = new Date(); want.setHours(hm[0], hm[1], 0, 0);
          if (want - now < 60 * 60 * 1000) warn = '<br><span class="bk-warn">⚠ 오늘은 지금부터 1시간 뒤 이후로 골라 주세요.</span>';
        }
        if (dv) {
          var p = dv.split('-'), dd = new Date(+p[0], +p[1] - 1, +p[2]);
          sum.innerHTML = '📅 <b>' + (dd.getMonth() + 1) + '월 ' + dd.getDate() + '일 (' + WD[dd.getDay()] + ')' + (hm ? ' ' + ko(hm[0], hm[1]) : '') + '</b> 방문 희망' + (hm ? '' : ' · 시간은 협의') + warn;
        } else if (hm) {
          sum.innerHTML = '🕑 <b>' + ko(hm[0], hm[1]) + '</b> 희망 · 달력에서 날짜를 골라 주세요';
        } else {
          sum.textContent = '달력에서 날짜를 누르고, ▲▼로 시간을 맞춰 주세요.';
        }
      }
      cal.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b || b.disabled) return;
        date.value = date.value === b.dataset.date ? '' : b.dataset.date;
        fire(date, 'change');
      });
      /* ▲▼ 누르고 있으면 계속 바뀜 */
      var holdT = null, holdI = null;
      function stopHold() { clearTimeout(holdT); clearInterval(holdI); holdT = holdI = null; }
      clock.addEventListener('pointerdown', function (e) {
        var b = e.target.closest('button[data-k]'); if (!b) return;
        e.preventDefault();
        step(b.dataset.k, +b.dataset.v || 0);
        if (b.dataset.k === 'ampm') return;
        stopHold();
        holdT = setTimeout(function () { holdI = setInterval(function () { step(b.dataset.k, +b.dataset.v); }, 110); }, 450);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { clock.addEventListener(t, stopHold); });
      clock.addEventListener('keydown', function (e) {   /* 키보드 사용자: Enter/Space */
        var b = e.target.closest('button[data-k]');
        if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); step(b.dataset.k, +b.dataset.v || 0); }
      });
      wrap.querySelector('.bk-clear').addEventListener('click', function () { setHM(null); });
      date.addEventListener('change', sync); time.addEventListener('change', sync);
      form.addEventListener('reset', function () { setTimeout(sync, 0); });
      sync();
    }

    /* 4) 추가 옵션은 바로 보이게, 쿠폰·추천인만 접어 둠 */
    var opt = $('.opt-field:not(#promoField)');
    var promo = $('#promoField');
    var refInput = $('[name="referrer"]');
    var refLabel = refInput && refInput.closest('label');
    if (opt) opt.classList.add('bk-opts');
    if (promo && refLabel) {
      var more = document.createElement('details');
      more.className = 'span-2 bk-more';
      more.setAttribute('data-vip-step', '2');
      more.innerHTML = '<summary><span>쿠폰 · 추천인 <em>(선택)</em></span><b id="bkMoreCount"></b></summary><div class="bk-more-body"></div>';
      var body = more.querySelector('.bk-more-body');
      promo.parentNode.insertBefore(more, promo);
      body.appendChild(promo); body.appendChild(refLabel);
      var count = more.querySelector('#bkMoreCount');
      function updateCount() {
        var p = form.querySelector('[name="promo"]:checked');
        count.textContent = (p && p.value) ? '혜택 1' : '';
      }
      form.addEventListener('change', updateCount);
      form.addEventListener('reset', function () { setTimeout(function () { updateCount(); more.open = false; }, 0); });
      updateCount();
    }

    /* 5) 요청사항 칸 축소 */
    var memo = $('[name="memo"]');
    if (memo) { memo.rows = 2; memo.placeholder = '요청사항이 있으면 적어 주세요 (선택)'; }

    /* 6) 이전 입력 정보 기억 */
    var note = document.createElement('p');
    note.className = 'span-2 bk-saved';
    note.hidden = true;
    note.innerHTML = '이전에 입력하신 정보를 불러왔어요. <button type="button">지우기</button>';
    var head = $('.booking-wizard-head');
    if (head) head.parentNode.insertBefore(note, head.nextSibling);

    function fill() {
      var s = store(true), used = false;
      FIELDS.forEach(function (n) {
        var el = $('[name="' + n + '"]');
        if (el && !el.value && s[n]) { el.value = s[n]; used = true; }
      });
      var brand = $('#carBrandSelect'), model = $('#carModelSelect'), cust = $('#carCustomInput');
      if (brand && !brand.value && s.carBrand) {
        brand.value = s.carBrand;
        if (brand.value === s.carBrand) {
          fire(brand, 'change');
          if (s.carModel && model) {
            model.value = s.carModel;
            if (model.value === s.carModel) { fire(model, 'change'); used = true; }
          }
          if (s.carCustom && cust) { cust.value = s.carCustom; fire(cust, 'input'); }
        }
      }
      note.hidden = !used;
      setTimeout(syncClass, 0);
    }
    function save() {
      var s = {};
      FIELDS.forEach(function (n) {
        var el = $('[name="' + n + '"]');
        if (el && el.value.trim()) s[n] = el.value.trim();
      });
      var brand = $('#carBrandSelect'), model = $('#carModelSelect'), cust = $('#carCustomInput');
      if (brand && brand.value) s.carBrand = brand.value;
      if (model && model.value && model.selectedIndex > 0) s.carModel = model.value;
      if (cust && cust.value.trim()) s.carCustom = cust.value.trim();
      store(false, s);
    }
    var timer;
    form.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(save, 400); });
    form.addEventListener('change', function () { clearTimeout(timer); timer = setTimeout(save, 400); });
    note.querySelector('button').addEventListener('click', function () {
      store(false, null);
      clearTimeout(timer);
      FIELDS.forEach(function (n) { var el = $('[name="' + n + '"]'); if (el) el.value = ''; });
      var brand = $('#carBrandSelect');
      if (brand) { brand.value = ''; fire(brand, 'change'); }
      note.hidden = true;
    });
    form.addEventListener('reset', function () { setTimeout(fill, 50); });
    /* app.js의 차량 목록이 채워진 뒤에 불러오도록 한 박자 늦춤 */
    setTimeout(fill, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  else setTimeout(init, 0);
})();
} catch (e) { console.error('[booking-simple.js]', e); }

/* ===== booking-lookup.js ===== */
try {
/* 비회원 예약 확인 — 휴대폰 번호 + 차량번호가 모두 맞을 때만 상태를 보여 줍니다. */
(function () {
  'use strict';
  var URL_ = 'https://xejdhnwqqaamujkebvne.supabase.co';
  var KEY = 'sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  var STATUS = {
    '접수': ['접수됨', '확인 후 연락드릴 예정이에요.'],
    '확정': ['방문 확정', '확정된 일정에 방문드립니다.'],
    '완료': ['세차 완료', '이용해 주셔서 감사합니다.'],
    '취소': ['취소됨', '다시 예약하시려면 새로 접수해 주세요.']
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + (d.getHours() < 12 ? '오전 ' : '오후 ') + ((d.getHours() % 12) || 12) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function wish(r) {
    if (!r.preferredDate) return '';
    var p = r.preferredDate.split('-');
    return Number(p[1]) + '월 ' + Number(p[2]) + '일' + (r.preferredTime ? ' ' + r.preferredTime.slice(0, 5) : '');
  }
  function card(r) {
    var st = STATUS[r.status] || [r.status || '확인 중', ''];
    var when = r.status === '확정' && r.scheduledAt ? '방문 일정 ' + fmt(r.scheduledAt)
      : r.status === '완료' && r.doneAt ? '완료 ' + fmt(r.doneAt)
      : wish(r) ? '희망 일정 ' + wish(r) : '';
    return '<div class="gl-item" data-st="' + esc(r.status) + '"><div class="gl-top"><b>' + esc(st[0]) + '</b><span>' + esc(fmt(r.createdAt)) + ' 접수</span></div>' +
      '<p>' + esc(r.service || '') + (r.car ? ' · ' + esc(r.car) : '') + '</p>' + (when ? '<p class="gl-when">' + esc(when) + '</p>' : '') +
      (st[1] ? '<p class="gl-sub">' + esc(st[1]) + '</p>' : '') + '</div>';
  }
  async function lookup(phone, plate) {
    var r = await fetch(URL_ + '/rest/v1/rpc/lookup_guest_reservations', {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_phone: phone, p_plate: plate })
    });
    if (!r.ok) throw new Error('lookup failed ' + r.status);
    return r.json();
  }
  function init() {
    var slot = document.getElementById('guestLookupSlot');
    if (!slot || document.getElementById('guestLookup')) return;
    var box = document.createElement('section');
    box.id = 'guestLookup'; box.className = 'mypage-panel guest-lookup-card';
    box.innerHTML = '<h2>비회원 예약 확인</h2>' +
      '<form class="gl-form" novalidate><p>예약할 때 입력한 휴대폰 번호와 차량번호를 넣어 주세요. 로그인은 필요 없어요.</p>' +
      '<input name="glPhone" type="tel" aria-label="휴대폰 번호" inputmode="tel" autocomplete="off" placeholder="휴대폰 번호 010-0000-0000" required>' +
      '<input name="glPlate" aria-label="차량 번호" autocomplete="off" placeholder="차량번호 예: 12가 3456" required>' +
      '<button type="submit" class="primary-btn">예약 확인하기</button><div class="gl-result" role="status" aria-live="polite"></div></form>';
    slot.appendChild(box);
    var form = box.querySelector('form'), out = box.querySelector('.gl-result'), btn = form.querySelector('button');
    /* 예약 폼에 기억된 번호·차량번호가 있으면 미리 채움 */
    try {
      var saved = JSON.parse(localStorage.getItem('athomeBookingProfile') || '{}');
      if (saved.phone) form.glPhone.value = saved.phone;
      if (saved.plate) form.glPlate.value = saved.plate;
    } catch (e) {}
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var phone = form.glPhone.value.trim(), plate = form.glPlate.value.trim();
      if (!/^(\+?82|0)1\d[\s\-]?\d{3,4}[\s\-]?\d{4}$/.test(phone) || plate.replace(/[\s\-]/g, '').length < 4) {
        out.innerHTML = '<p class="gl-msg">휴대폰 번호와 차량번호를 정확히 입력해 주세요.</p>'; return;
      }
      btn.disabled = true; btn.textContent = '확인 중…';
      try {
        var rows = await lookup(phone, plate);
        if (rows && !Array.isArray(rows) && rows.error === 'rate_limited') {
          out.innerHTML = '<p class="gl-msg">확인 시도가 너무 많아 잠시 막아 두었어요. 1시간 뒤 다시 시도하시거나 카카오채널로 문의해 주세요.</p>'; return;
        }
        if (!Array.isArray(rows)) rows = [];
        out.innerHTML = rows.length ? rows.map(card).join('')
          : '<p class="gl-msg">일치하는 예약을 찾지 못했어요. 예약할 때 입력한 번호와 차량번호가 맞는지 확인하시고, 계속 안 보이면 카카오채널로 문의해 주세요.</p>';
      } catch (err) {
        out.innerHTML = '<p class="gl-msg">지금은 확인할 수 없어요. 잠시 후 다시 시도하거나 카카오채널로 문의해 주세요.</p>';
      } finally { btn.disabled = false; btn.textContent = '예약 확인하기'; }
    });
    /* 월회원으로 로그인해 일정 화면이 보이면 비회원 확인 칸은 숨김 */
    var dash = document.getElementById('memberDashboard');
    var split = document.getElementById('memberSplit');
    function sync() {
      var logged = !!(dash && !dash.hidden && getComputedStyle(dash).display !== 'none');
      box.hidden = !!logged; if (split) split.hidden = !!logged;
    }
    var mp = document.getElementById('mypage');
    if (mp) new MutationObserver(function () { setTimeout(sync, 0); }).observe(mp, { attributes: true, subtree: true, attributeFilter: ['hidden', 'style', 'class'] });
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
} catch (e) { console.error('[booking-lookup.js]', e); }

/* ===== member-dashboard.js ===== */
try {
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
    text(elem('homeMemberHeader'),'월회원 내 일정');
    text(elem('homeMemberSummary'),'카카오 로그인 후 다음 세차 예정일과 관리 이력을 간편하게 확인하세요.');
    // Erase private dashboard widgets on expired sessions or sign-out.
    const ids = ['memberNextLabel','memberPlanLabel','memberNextDate','memberNextService','memberPlan','memberPlanStatus','memberPlanDate',
      'memberMonthCompleted','memberTotalCompleted'];
    ids.forEach(id => text(elem(id),''));
    ['memberUpcoming','memberPending','memberHistory','memberContractList'].forEach(id => {
      const node = elem(id);
      if (node) node.replaceChildren();
    });
    show(elem('memberExistingVisit'),false);
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
      e.code = data && (data.error_code || data.code);
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
    show(elem('memberLinkCard'), mode === 'link');
    show(elem('memberDashboard'), mode === 'dashboard');
  }
  function setLoading(value) {
    busy = value;
    for (const id of ['memberSendCode','memberVerifyCode','memberReload','memberKakaoLogin','memberLinkSubmit','memberLinkRefresh']) {
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
    text(elem('memberNextLabel'),'다음 세차 예정일');
    text(elem('memberPlanLabel'),'최근 월세차 신청');
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
    const homeTitle = elem('homeMemberHeader');
    const homeInfo = elem('homeMemberSummary');
    text(homeTitle, upcoming ? '다음 방문: ' + formatDate(upcoming.date,false) : '월회원 내 일정');
    text(homeInfo, upcoming
      ? service(upcoming.service) + ' · 본인 확인이 완료된 관리 일정입니다.'
      : '본인 확인 완료 · 예약 및 관리 이력을 내 예약에서 확인하세요.');
  }

  function nextCycleStart(c) {
    if (!c || !c.cycleEnd) return '';
    const d=new Date(String(c.cycleEnd)+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1);
    const v=d.toISOString().slice(0,10);
    return v<=String(c.expiresOn||'') ? v : '';
  }
  function isExhausted(c) { return c && c.status==='active' && Number(c.remainingVisits)<=0; }
  function makeContractCard(c,nextVisit) {
    const article=make('article','member-contract-card');
    article.dataset.status=c.status;
    const top=make('div','member-contract-head');
    top.append(make('strong','',((c.carModel||'내 차량')+' · 월 '+c.monthlyVisits+'회')),
      make('span','',({'active':'이용 중',upcoming:'시작 예정',paused:'일시중지',cancelled:'계약 종료',expired:'계약 만료'})[c.status]||c.status));
    article.append(top);
    const metrics=make('div','member-contract-metrics');
    function metric(label,value,sub) {
      const box=make('div');
      box.append(make('small','',label),make('b','',value));
      if (sub) box.append(make('small','member-metric-sub',sub));
      return box;
    }
    const closed=c.status==='expired'||c.status==='cancelled';
    metrics.append(metric('이번 달 사용', closed ? '이용 불가' : c.usedVisits+' / '+c.monthlyVisits+'회',
        closed ? '' : (isExhausted(c) ? '모두 사용' : '남은 '+c.remainingVisits+'회')));
    // 다 쓴 경우에는 다음 날짜 칸을 표시하지 않음 (확정된 방문이 있으면 그것만 표시)
    if (nextVisit && nextVisit.date) metrics.append(metric('다음 방문',formatDate(nextVisit.date,true),'확정'));
    else if (!isExhausted(c) && !closed) metrics.append(metric('다음 권장일',c.nextRecommendedOn?formatDate(c.nextRecommendedOn,false):'미정','확정 일정 아님'));
    metrics.append(metric('만료일',formatDate(c.expiresOn,false)));
    article.append(metrics);
    article.append(make('p','member-contract-cycle','이용주기 '+formatDate(c.cycleStart,false)+' ~ '+formatDate(c.cycleEnd,false)));
    return article;
  }
  function renderContracts(payload,existing) {
    const list=elem('memberContractList');
    if (!list) return;
    list.replaceChildren();
    const records=Array.isArray(payload?.contracts)?payload.contracts:[];
    show(elem('memberExistingVisit'),records.some(c=>c && c.status==='active' && Number(c.remainingVisits)>0));
    const btn=elem('memberExistingVisit');
    let quota=document.getElementById('memberQuotaNote');
    const full=records.find(c=>c && c.status==='active' && Number(c.remainingVisits)<=0);
    const hasLeft=records.some(c=>c && c.status==='active' && Number(c.remainingVisits)>0);
    if (btn && full && !hasLeft) {
      if (!quota) { quota=document.createElement('p'); quota.id='memberQuotaNote'; quota.className='member-quota-note'; btn.insertAdjacentElement('afterend',quota); }
      const d=new Date(String(full.cycleEnd)+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1);
      const next=d.toISOString().slice(0,10);
      quota.textContent='이번 이용주기 월 '+full.monthlyVisits+'회를 모두 사용했어요.'+(next<=full.expiresOn?' '+formatDate(next,false)+'부터 다시 예약할 수 있어요.':'')+' 추가 세차는 다시 예약을 해 주세요.';
      quota.hidden=false;
    } else if (quota) { quota.hidden=true; }
    if (!records.length) {
      list.append(make('div','member-contract-empty',
        '등록된 월세차 계약이 없습니다. 관리자에게 계약 등록을 요청해 주세요. 예약 신청 기록과 유효한 월세차 계약은 별개입니다.'));
      return;
    }
    records.forEach(c=>{if(c)list.append(makeContractCard(c,existing&&existing.nextVisit));});
    // 계약 회원: 겹치는 요약 카드·설명·빈 목록 숨김
    const dash=elem('memberDashboard');
    const hasContract=records.some(c=>c&&(c.status==='active'||c.status==='upcoming'||c.status==='paused'));
    if (dash) dash.classList.toggle('has-contract',hasContract);
    if (hasContract) {
      const hideIfEmpty=(id,arr)=>{const sec=elem(id)&&elem(id).closest('section'); if(sec) sec.hidden=!(Array.isArray(arr)&&arr.length);};
      hideIfEmpty('memberPending',existing&&existing.pending);
      hideIfEmpty('memberHistory',existing&&existing.history);
      // 다음 방문 1건은 카드에 이미 표시 → 2건 이상일 때만 목록 노출
      const up=(existing&&existing.upcoming)||[]; const upSec=elem('memberUpcoming')&&elem('memberUpcoming').closest('section'); if(upSec) upSec.hidden=up.length<2;
    }
    const preferred=records.find(c=>c && c.status==='active') || records.find(c=>c && c.status==='upcoming') || records[0];
    if (!preferred) return;
    text(elem('memberPlanLabel'),'실제 월세차 계약');
    text(elem('memberPlan'),'월 '+preferred.monthlyVisits+'회 정기관리');
    text(elem('memberPlanStatus'),
      '현재 이용주기 잔여 '+preferred.remainingVisits+'회 · '+
      ({active:'운영 중',upcoming:'시작 예정',paused:'일시중지',cancelled:'종료',expired:'만료'}[preferred.status]||'확인 중'));
    text(elem('memberPlanDate'),'만료일 '+formatDate(preferred.expiresOn,false));
    // Actual confirmed booking is always higher priority than a predicted cadence date.
    // 계약 회원은 '이번 달 완료' 대신 '이번 이용주기 사용'(실제 차감)을 보여 줌
    const monthEl=elem('memberMonthCompleted');
    if (monthEl && preferred.status==='active') {
      const card=monthEl.closest('article');
      const lab=card && card.querySelector('.member-kpi-label'); if (lab) lab.textContent='이번 이용주기 사용';
      monthEl.textContent=preferred.usedVisits+' / '+preferred.monthlyVisits+'회';
      const sm=card && card.querySelector('small'); if (sm) sm.textContent='월세차 계약에서 차감된 세차';
    }
    if (!existing?.nextVisit && isExhausted(preferred)) {
      const next=nextCycleStart(preferred);
      text(elem('memberNextLabel'),'다음 이용 가능일');
      text(elem('memberNextDate'),next?formatDate(next,false):'계약 만료');
      text(elem('memberNextService'),'이번 이용주기 월 '+preferred.monthlyVisits+'회를 모두 사용했어요.');
      text(elem('homeMemberHeader'),next?'다음 이용 가능일: '+formatDate(next,false):'이번 이용주기 횟수를 모두 사용했어요');
      text(elem('homeMemberSummary'),'추가 세차는 다시 예약을 해 주세요.');
    } else if (!existing?.nextVisit && preferred.status==='active' && preferred.nextRecommendedOn) {
      text(elem('memberNextLabel'),'다음 정기관리 권장일');
      text(elem('memberNextDate'),formatDate(preferred.nextRecommendedOn,false));
      text(elem('memberNextService'),'권장 '+preferred.intervalDays+'일 간격 · 아직 확정된 방문 예약은 아닙니다.');
      text(elem('homeMemberHeader'),'다음 관리 권장일: '+formatDate(preferred.nextRecommendedOn,false));
      text(elem('homeMemberSummary'),'관리 기준일로 계산한 날짜입니다. 실제 방문 일정은 예약 확정 후 안내됩니다.');
    }
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
      const link = await fetchJson('/rest/v1/rpc/get_my_link_status',{
        method:'POST',body:'{}',headers:{Authorization:'Bearer '+token}
      });
      if (!link || link.status !== 'approved') {
        renderLink(link || {status:'none'});
        view('link');
        status('');
        return;
      }
      const [data, contracts] = await Promise.all([
        fetchJson('/rest/v1/rpc/get_my_carcare_dashboard',{
          method:'POST',body:'{}',headers:{Authorization:'Bearer '+token}
        }),
        fetchJson('/rest/v1/rpc/get_my_vip_contracts',{
          method:'POST',body:'{}',headers:{Authorization:'Bearer '+token}
        })
      ]);
      render(data || {});
      renderContracts(contracts || {},data || {});
      view('dashboard');
      status('');
    } catch (e) {
      if (e.status === 401) {
        clearSession();
        view('login');
        status('로그인이 만료되었습니다. 카카오로 다시 로그인해 주세요.', true);
      } else if (e.status === 403) {
        view('dashboard');
        status('회원 정보를 불러올 권한 확인에 실패했습니다. 잠시 후 다시 시도하거나 카카오채널로 문의해 주세요.', true);
      } else {
        view('dashboard');
        status('관리 이력을 불러오지 못했습니다. 다시 시도해 주세요.',true);
      }
    } finally { setLoading(false); }
  }
  function redirectUrl() {
    return location.origin + location.pathname.replace(/index\.html$/, '');
  }
  function startKakao() {
    if (busy) return;
    status('카카오 로그인 화면으로 이동합니다.');
    location.href = PROJECT + '/auth/v1/authorize?provider=kakao&scopes=' +
      encodeURIComponent('profile_nickname') + '&redirect_to=' + encodeURIComponent(redirectUrl());
  }
  function renderLink(link) {
    const st = link && link.status;
    const form = elem('memberLinkForm');
    const actions = elem('memberLinkActions');
    const intro = elem('memberLinkIntro');
    const pending = st === 'pending';
    show(form, !pending);
    show(actions, pending);
    if (pending) {
      text(intro, '연결 요청을 접수했어요' + (link.phoneTail ? ' (번호 끝자리 ' + link.phoneTail + ')' : '') +
        '. 확인 중입니다. 영업시간 내에 처리해 드리며, 급하시면 카카오채널로 문의해 주세요. 처리 후 아래 버튼을 눌러 주세요.');
    } else if (st === 'rejected') {
      text(intro, '요청이 승인되지 않았어요. 예약에 사용한 번호가 맞는지 확인하고 다시 요청하거나, 전화·카카오톡으로 문의해 주세요.');
    } else {
      text(intro, '카카오 로그인은 본인 확인용입니다. 계약 때 알려 주신 번호를 입력하면 사장님이 확인 후 연결해 드려요. 연결은 처음 한 번만 하면 됩니다.');
    }
  }
  async function submitLink(event) {
    event.preventDefault();
    if (busy) return;
    const phone = normalizePhone(elem('memberLinkPhone').value);
    if (!phone) { status('010으로 시작하는 휴대폰 번호 11자리를 입력해 주세요.',true); return; }
    const token = await activeToken();
    if (!token) { view('login'); status('로그인이 만료되었습니다. 다시 로그인해 주세요.',true); return; }
    setLoading(true);
    status('연결 요청을 보내는 중입니다.');
    try {
      const result = await fetchJson('/rest/v1/rpc/request_phone_link',{
        method:'POST',body:JSON.stringify({p_phone:phone}),headers:{Authorization:'Bearer '+token}
      });
      setLoading(false);
      if (result && result.status === 'approved') { await loadDashboard(); return; }
      renderLink(result || {status:'pending'});
      status('연결 요청을 접수했습니다. 사장님 확인 후 내 일정이 표시됩니다.');
    } catch (e) {
      status(e.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
        : '요청을 보내지 못했습니다. 번호를 확인하고 잠시 후 다시 시도해 주세요.',true);
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
        : (e.code === 'phone_provider_disabled' || e.code === 'sms_send_failed')
          ? '문자 본인인증을 준비 중입니다. 일정 확인은 010-8391-8999 또는 카카오톡으로 문의해 주세요.'
          : '문자 발송을 완료하지 못했습니다. 휴대폰 번호를 확인하고 잠시 후 다시 시도해 주세요.',true);
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
    if (elem('memberCode')) elem('memberCode').value = '';
    text(elem('homeMemberHeader'),'월회원 내 일정');
    text(elem('homeMemberSummary'),'카카오 로그인 후 다음 세차 예정일과 관리 이력을 간편하게 확인하세요.');
    status('로그아웃했습니다. 이 기기에서는 다시 본인인증이 필요합니다.');
    if (s) {
      try { await fetchJson('/auth/v1/logout',{method:'POST',headers:{Authorization:'Bearer ' + s.access_token},body:'{}'}); }
      catch (_) { /* Local session already cleared; remote invalidation is best-effort. */ }
    }
  }
  // 카카오 로그인 후 돌아오면 주소 뒤 #access_token=... 으로 세션이 전달됩니다.
  let oauthErrorText = '';
  function oauthErrorMessage(t) {
    const raw = String(t || '').replace(/\+/g, ' ');
    if (/exchange|invalid_client|client.?secret|KOE010|unauthorized_client/i.test(raw)) return '카카오 로그인 설정 오류(비밀키 불일치)로 로그인할 수 없습니다. 사장님께 알려 주세요. (' + raw.slice(0, 80) + ')';
    if (/bad_oauth_state|state parameter/i.test(raw)) return '로그인 시간이 지났거나 다른 창에서 진행되었습니다. 이 화면에서 카카오 로그인을 한 번 더 눌러 주세요.';
    if (/redirect/i.test(raw)) return '카카오 로그인 주소 설정 오류입니다. 사장님께 알려 주세요. (' + raw.slice(0, 80) + ')';
    if (/email/i.test(raw)) return '카카오 계정의 이메일 제공에 동의해 주셔야 로그인할 수 있어요. 다시 로그인하면서 이메일 항목에 체크해 주세요.';
    if (/provider is not enabled|Unsupported provider/i.test(raw)) return '카카오 로그인이 아직 켜져 있지 않습니다. 사장님께 문의해 주세요.';
    if (/access_denied|cancel/i.test(raw)) return '카카오 로그인이 취소되었습니다. 다시 시도해 주세요.';
    return '카카오 로그인을 완료하지 못했습니다. 다시 시도해 주세요.' + (raw ? ' (' + raw.slice(0, 120) + ')' : '');
  }
  function captureOAuthReturn() {
    const raw = (location.hash || '').replace(/^#/, '');
    const query = new URLSearchParams(location.search);
    if (!/(^|&)(access_token|error)=/.test(raw) && !query.get('error')) return '';
    const q = new URLSearchParams(raw);
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
    if (q.get('access_token') && q.get('refresh_token')) {
      saveSession({access_token:q.get('access_token'), refresh_token:q.get('refresh_token'), expires_in:q.get('expires_in')});
      return 'ok';
    }
    oauthErrorText = [q.get('error') || query.get('error'), q.get('error_code') || query.get('error_code'), q.get('error_description') || query.get('error_description')].filter(Boolean).join(': ');
    return 'error';
  }
  const oauthResult = captureOAuthReturn();
  function init() {
    if (!elem('memberLoginForm')) return;
    elem('memberLoginForm').addEventListener('submit', sendCode);
    if (elem('memberKakaoLogin')) elem('memberKakaoLogin').addEventListener('click', startKakao);
    if (elem('memberLinkForm')) elem('memberLinkForm').addEventListener('submit', submitLink);
    if (elem('memberLinkRefresh')) elem('memberLinkRefresh').addEventListener('click', loadDashboard);
    if (elem('memberLinkLogout')) elem('memberLinkLogout').addEventListener('click', signOut);
    elem('memberCodeForm').addEventListener('submit',verifyCode);
    elem('memberBack').addEventListener('click',function(){phoneAwaitingCode='';view('login');status('');});
    elem('memberReload').addEventListener('click',loadDashboard);
    elem('memberLogout').addEventListener('click',signOut);
    view('login');
    if (oauthResult === 'error') status(oauthErrorMessage(oauthErrorText), true);
    if (readSession()) loadDashboard();
    if (oauthResult) window.addEventListener('load', function () {
      setTimeout(function () {
        const go = document.querySelector('[data-go="mypage"]');
        if (go && oauthResult === 'ok') go.click();
        else if (typeof window.go === 'function') window.go('mypage');
      }, 120);
    });
    document.addEventListener('click',function(e) {
      const go = e.target.closest('[data-go="mypage"]');
      if (go && readSession()) loadDashboard();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
} catch (e) { console.error('[member-dashboard.js]', e); }

/* ===== vip-contract-admin.js ===== */
try {
/* Owner-only VIP contract ledger management.
   Existing admin login is reused. Supabase RLS independently enforces ownership.
   No contract is created for an ordinary customer reservation automatically. */
(function () {
  'use strict';
  const URL='https://xejdhnwqqaamujkebvne.supabase.co';
  const KEY='sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  const AUTH_KEY='athomeCarcareAdminSession';
  let contracts=[], links=[], jobs=[], selectedId=null, busy=false;
  const $=id=>document.getElementById(id);
  const node=(tag,klass,value)=>{
    const el=document.createElement(tag);
    if(klass)el.className=klass;
    if(value!==undefined)el.textContent=String(value);
    return el;
  };
  const phone = v => {
    let s=String(v||'').replace(/\D/g,'');
    if(/^8210\d{8}$/.test(s))s='0'+s.slice(2);
    return s;
  };
  function seoulDay(value) {
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',
      year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const part=key=>parts.find(p=>p.type===key)?.value||'';
    return part('year')+'-'+part('month')+'-'+part('day');
  }
  function note(message,error=false) {
    const el=$('vipAdminMessage');
    if(el){el.textContent=message;el.dataset.error=error?'1':'0';}
  }
  async function session() {
    let s;
    try{s=JSON.parse(localStorage.getItem(AUTH_KEY)||'null');}catch(_){return null;}
    if(!s||!s.access_token)return null;
    if(s.expires_at && Date.now()/1000<s.expires_at-60)return s.access_token;
    if(!s.refresh_token)return null;
    const r=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:s.refresh_token})
    });
    if(!r.ok)return null;
    const d=await r.json();
    s={...s,access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at};
    localStorage.setItem(AUTH_KEY,JSON.stringify(s));
    return s.access_token;
  }
  /* DB에 아직 apartment 칸이 없을 때(22번 SQL 실행 전)에도 계약 저장이 되도록 한 번 다시 시도 */
  async function apiSave(path,options){
    try{return await api(path,options);}
    catch(e){
      if(!/apartment/i.test(e.message||'')||!options.body)throw e;
      const b=JSON.parse(options.body);delete b.apartment;
      const r=await api(path,{...options,body:JSON.stringify(b)});
      setTimeout(()=>note('저장했지만 아파트명은 아직 저장되지 않았어요. Supabase에서 22번 SQL을 실행해 주세요.',true),0);
      return r;
    }
  }
  async function api(path,options={}) {
    const token=await session();
    if(!token)throw Error('관리자로 로그인한 후 이용해 주세요.');
    const r=await fetch(URL+'/rest/v1/'+path,{
      ...options,
      headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json',
        ...(options.headers||{})}
    });
    if(r.status===204)return null;
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.message||data.details||'처리 실패 ('+r.status+')');
    return data;
  }
  function choose(id) {
    selectedId=id;
    const c=contracts.find(x=>x.id===id);
    const f=$('vipContractForm');
    f.elements.namedItem('contractId').value=c?.id||'';
    f.elements.namedItem('phone').value=c?.phone||'';
    f.elements.namedItem('customerName').value=c?.customer_name||'';
    f.elements.namedItem('carModel').value=c?.car_model||'';
    f.elements.namedItem('apartment').value=c?.apartment||'';
    f.elements.namedItem('monthlyVisits').value=c?.monthly_visits||'2';
    f.elements.namedItem('startsOn').value=c?.starts_on||'';
    f.elements.namedItem('expiresOn').value=c?.expires_on||'';
    f.elements.namedItem('anchorOn').value=c?.anchor_on||'';
    f.elements.namedItem('status').value=c?.status||'active';
    f.elements.namedItem('note').value=c?.note||'';
    $('vipContractFormTitle').textContent=c?'계약 수정':'새 월세차 계약 등록';
    renderList();
    renderDetail();
  }
  async function load() {
    if(busy)return;
    busy=true;note('월세차 계약 정보를 불러오는 중입니다.');
    try{
      const [c,l,r]=await Promise.all([
        api('vip_contracts?select=*&order=created_at.desc&limit=200'),
        api('vip_visit_links?select=contract_id,reservation_id&limit=1000'),
        api('reservations?select=id,phone,status,done_at,scheduled_at,service_type,car_model,customer_name&status=in.(%ED%99%95%EC%A0%95,%EC%99%84%EB%A3%8C)&order=created_at.desc&limit=400')
      ]);
      contracts=c||[];links=l||[];jobs=r||[];
      renderAptSummary();
      if(!contracts.some(v=>v.id===selectedId))selectedId=contracts[0]?.id||null;
      choose(selectedId);
      note('세차 일정을 등록하고, 세차 후 \'완료 · 1회 차감\'을 누르면 잔여 횟수가 줄어듭니다.');
    }catch(e){note(e.message,true);}
    finally{busy=false;}
  }
  /* 아파트별 월회원 현황 — 지금 이용 중인 월세차 계약만, 아파트명이 글자까지 같은 것끼리 */
  const APT_GOAL=5;
  function renderAptSummary() {
    const out=$('vipAptSummary');if(!out)return;
    const today=seoulDay(Date.now());
    const groups=new Map();
    for(const c of contracts){
      const name=(c.apartment||'').trim();
      if(c.status!=='active'||!(c.starts_on<=today&&today<=c.expires_on))continue;
      const key=name||'(아파트명 미입력)';
      if(!groups.has(key))groups.set(key,new Map());
      groups.get(key).set(c.phone,c);   // 같은 번호는 1대로
    }
    const dl=$('vipAptList');
    if(dl){dl.replaceChildren();[...new Set(contracts.map(c=>(c.apartment||'').trim()).filter(Boolean))].sort().forEach(n=>{const o=document.createElement('option');o.value=n;dl.append(o);});}
    out.replaceChildren();
    const head=node('div','vip-apt-head');
    head.append(node('strong','','아파트별 월회원 현황'),node('small','','이용 중인 월세차 계약 기준 · 아파트명이 똑같은 것끼리 · '+APT_GOAL+'대 이상이면 차량당 5,000원 할인'));
    out.append(head);
    if(!groups.size){out.append(node('p','vip-ledger-empty','이용 중인 월세차 계약이 없습니다.'));return;}
    const rows=[...groups.entries()].sort((a,b)=>(a[0]==='(아파트명 미입력)')-(b[0]==='(아파트명 미입력)')||b[1].size-a[1].size||a[0].localeCompare(b[0],'ko'));
    const list=node('div','vip-apt-list');
    for(const [name,members] of rows){
      const n=members.size, done=n>=APT_GOAL, missing=name==='(아파트명 미입력)';
      const d=document.createElement('details');d.className='vip-apt-row'+(done?' done':'')+(missing?' missing':'');
      const sum=document.createElement('summary');
      sum.append(node('b','',name),node('span','vip-apt-count',n+'대'),
        node('em','vip-apt-state',missing?'계약에 아파트명을 넣어 주세요':done?'할인 대상':'할인까지 '+(APT_GOAL-n)+'대'));
      const bar=node('i','vip-apt-bar');bar.style.setProperty('--p',Math.min(100,n/APT_GOAL*100)+'%');sum.append(bar);
      d.append(sum);
      const ul=node('ul','vip-apt-members');
      for(const c of members.values())ul.append(node('li','',c.customer_name+' · '+(c.car_model||'차량')+' · 월 '+c.monthly_visits+'회 · ~'+c.expires_on));
      d.append(ul);list.append(d);
    }
    out.append(list);
  }
  function renderList() {
    const out=$('vipContractList');if(!out)return;
    out.replaceChildren();
    if(!contracts.length){out.append(node('p','vip-ledger-empty','등록된 월세차 계약이 없습니다. 아래에서 새 계약을 등록하세요.'));return;}
    for(const c of contracts) {
      const button=node('button','vip-ledger-row'+(c.id===selectedId?' selected':''));
      button.type='button';
      const b=node('strong','',c.customer_name+' · 월 '+c.monthly_visits+'회');
      const small=node('small','',(c.apartment?c.apartment+' · ':'')+c.phone+' · '+c.starts_on+' ~ '+c.expires_on+' · '+({'active':'운영','paused':'일시중지','cancelled':'종료'}[c.status]||c.status));
      button.append(b,small);
      button.addEventListener('click',()=>choose(c.id));
      out.append(button);
    }
  }
  function renderDetail() {
    const out=$('vipLinkArea'); if(!out)return;
    out.replaceChildren();
    const c=contracts.find(x=>x.id===selectedId);
    if(!c){out.append(node('p','vip-ledger-empty','계약 등록 후 완료된 세차와 연결할 수 있습니다.'));return;}
    const stat=node('div','vip-ledger-stats','계약 현황 계산 중…');
    const tools=node('div','vip-ledger-tools');
    const pv=node('button','','👀 고객 화면 미리보기');pv.type='button';
    const ext=node('button','','➕ 연장 (새 계약 만들기)');ext.type='button';
    tools.append(pv,ext);
    const panel=node('div','vip-ledger-panel');panel.hidden=true;
    pv.addEventListener('click',()=>togglePanel(panel,'preview',()=>renderPreview(panel,c)));
    ext.addEventListener('click',()=>togglePanel(panel,'extend',()=>renderExtend(panel,c)));
    out.append(stat,tools,panel);
    api('rpc/vip_contract_snapshot',{method:'POST',body:JSON.stringify({p_contract_id:c.id})})
      .then(d=>{
        if(selectedId!==c.id)return;
        const st=({active:'이용 중',upcoming:'시작 예정',paused:'일시중지',cancelled:'종료',expired:'만료'})[d.status]||d.status;
        stat.textContent=st+' · 현재 이용주기 '+d.cycleStart+' ~ '+d.cycleEnd+
          ' · '+d.usedVisits+'/'+d.monthlyVisits+'회 사용, 잔여 '+d.remainingVisits+
          '회 · 만료 '+d.expiresOn+' · 권장 관리일 '+(d.nextRecommendedOn||'없음');
        const dateInput=$('vipSchedDate');
        if(dateInput && !dateInput.dataset.touched && d.nextRecommendedOn) dateInput.value=d.nextRecommendedOn;
      })
      .catch(e=>{stat.textContent=e.message;});
    out.append(...scheduleSection(c));
    const title=node('h4','','완료된 세차 직접 연결');
    const caption=node('p','vip-ledger-help','고객이 앱으로 예약해 이미 완료 처리된 세차가 있을 때만 사용하세요. 위 일정에서 완료를 누르면 자동으로 연결됩니다.');
    const wrap=node('div','vip-ledger-link-row');
    const sel=node('select');sel.id='vipCompletedJob';
    const occupied=new Set(links.map(v=>v.reservation_id));
    const eligible=jobs.filter(j=>phone(j.phone)===c.phone && j.status==='완료' && j.done_at &&
      seoulDay(j.done_at)>=c.starts_on &&
      seoulDay(j.done_at)<=c.expires_on && !occupied.has(j.id));
    const intro=node('option','',eligible.length?'완료된 세차를 선택하세요':'연결 가능한 완료 세차 없음');intro.value='';sel.append(intro);
    for(const j of eligible) {
      const o=node('option','',new Date(j.done_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(j.car_model||'차량')+' · '+j.service_type);
      o.value=j.id;sel.append(o);
    }
    const add=node('button','','이용 1회 연결');add.type='button';add.disabled=!eligible.length;
    add.addEventListener('click',()=>linkVisit(c.id,sel.value));
    wrap.append(sel,add);
    const linkTitle=node('h4','','현재 연결된 방문');
    const ul=node('ul','vip-ledger-connected');
    const attached=links.filter(l=>l.contract_id===c.id);
    if(!attached.length)ul.append(node('li','','연결된 세차 기록이 없습니다.'));
    for (const l of attached){
      const j=jobs.find(r=>r.id===l.reservation_id && r.done_at);
      const li=node('li','',j?new Date(j.done_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(j.car_model||'차량'):(l.reservation_id.slice(0,8)+'…'));
      const remove=node('button','','연결 해제');remove.type='button';
      remove.addEventListener('click',()=>unlinkVisit(l.reservation_id));
      li.append(remove);ul.append(li);
    }
    out.append(title,caption,wrap,linkTitle,ul);
  }
  const KST_DAY = ['일','월','화','수','목','금','토'];
  function kstLabel(iso) {
    const d=new Date(iso);
    const p=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
    const g=k=>p.find(x=>x.type===k)?.value||'';
    const wd=KST_DAY[new Date(seoulDay(iso)+'T12:00:00+09:00').getUTCDay()];
    return g('month')+'월 '+g('day')+'일 ('+wd+') '+g('hour')+':'+g('minute');
  }
  /* 이용주기 계산 (서버 vip_contract_snapshot 과 동일: 계약 시작일 기준 한 달) */
  function addMonths(day,n){
    const [y,m,d]=day.split('-').map(Number);
    const t=new Date(Date.UTC(y,m-1+n,1));
    const last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();
    t.setUTCDate(Math.min(d,last));
    return t.toISOString().slice(0,10);
  }
  function prevDay(day){const t=new Date(day+'T00:00:00Z');t.setUTCDate(t.getUTCDate()-1);return t.toISOString().slice(0,10);}
  function nextDay(day){const t=new Date(day+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+1);return t.toISOString().slice(0,10);}
  function cycleOf(c,day){
    const [ay,am]=day.split('-').map(Number), [sy,sm]=c.starts_on.split('-').map(Number);
    let months=(ay-sy)*12+(am-sm);
    let start=addMonths(c.starts_on,months);
    if(start>day){months-=1;start=addMonths(c.starts_on,months);}
    let end=prevDay(addMonths(c.starts_on,months+1));
    if(end>c.expires_on)end=c.expires_on;
    return {start,end};
  }
  function usage(c,day){
    const cy=cycleOf(c,day);
    const inCy=d=>d>=cy.start&&d<=cy.end;
    const linked=new Set(links.filter(l=>l.contract_id===c.id).map(l=>l.reservation_id));
    const used=jobs.filter(j=>linked.has(j.id)&&j.status==='완료'&&j.done_at&&inCy(seoulDay(j.done_at))).length;
    const planned=jobs.filter(j=>phone(j.phone)===c.phone&&j.status==='확정'&&j.scheduled_at&&inCy(seoulDay(j.scheduled_at))).length;
    return {...cy,used,planned,left:Math.max(0,c.monthly_visits-used-planned)};
  }
  function korDate(day,withTime){
    if(!day)return '';
    const iso=String(day).length<=10?String(day)+'T12:00:00+09:00':String(day);
    const d=new Date(iso);
    const p=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
    const g=k=>p.find(x=>x.type===k)?.value||'';
    return g('year')+'년 '+g('month')+' '+g('day')+'일 '+g('weekday')+(withTime?' '+g('hour')+':'+g('minute'):'');
  }
  function togglePanel(panel,kind,build){
    if(!panel.hidden && panel.dataset.kind===kind){panel.hidden=true;return;}
    panel.dataset.kind=kind;panel.hidden=false;panel.replaceChildren();build();
  }
  /* 고객 '내 예약' 카드와 같은 모양으로 미리보기 */
  async function renderPreview(panel,c){
    panel.append(node('p','vip-ledger-help','이 고객이 \'내 예약\'에서 보는 화면입니다. (관리자 화면에서만 보이는 미리보기)'));
    const box=node('div','vip-preview');panel.append(box);
    box.textContent='불러오는 중…';
    try{
      const d=await api('rpc/vip_contract_snapshot',{method:'POST',body:JSON.stringify({p_contract_id:c.id})});
      box.replaceChildren();
      const card=node('article','member-contract-card');card.dataset.status=d.status;
      const head=node('div','member-contract-head');
      head.append(node('strong','',(d.carModel||'내 차량')+' · 월 '+d.monthlyVisits+'회'),
        node('span','',({active:'이용 중',upcoming:'시작 예정',paused:'일시중지',cancelled:'계약 종료',expired:'계약 만료'})[d.status]||d.status));
      card.append(head);
      const m=node('div','member-contract-metrics');
      const metric=(label,value,sub)=>{const b=node('div');b.append(node('small','',label),node('b','',value));if(sub)b.append(node('small','member-metric-sub',sub));return b;};
      const closed=d.status==='expired'||d.status==='cancelled';
      const full=d.status==='active'&&Number(d.remainingVisits)<=0;
      m.append(metric('이번 달 사용',closed?'이용 불가':d.usedVisits+' / '+d.monthlyVisits+'회',closed?'':(full?'모두 사용':'남은 '+d.remainingVisits+'회')));
      const upcoming=jobs.filter(j=>phone(j.phone)===c.phone&&j.status==='확정'&&j.scheduled_at&&new Date(j.scheduled_at)>=new Date())
        .sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
      if(upcoming[0])m.append(metric('다음 방문',korDate(upcoming[0].scheduled_at,true),'확정'));
      else if(!full&&!closed)m.append(metric('다음 권장일',d.nextRecommendedOn?korDate(d.nextRecommendedOn):'미정','확정 일정 아님'));
      m.append(metric('만료일',korDate(d.expiresOn)));
      card.append(m,node('p','member-contract-cycle','이용주기 '+korDate(d.cycleStart)+' ~ '+korDate(d.cycleEnd)));
      box.append(card);
      if(full){
        const nx=nextDay(d.cycleEnd);
        box.append(node('p','member-quota-note','이번 이용주기 월 '+d.monthlyVisits+'회를 모두 사용했어요.'+(nx<=d.expiresOn?' '+korDate(nx)+'부터 다시 예약할 수 있어요.':'')+' 추가 세차는 다시 예약을 해 주세요.'));
      }
      if(upcoming.length>1)box.append(node('p','vip-ledger-help','다가오는 세차 일정 '+upcoming.length+'건이 목록으로 함께 보입니다.'));
    }catch(e){box.textContent='미리보기를 불러오지 못했습니다: '+e.message;}
  }
  function overlaps(phoneNo,start,end,exceptId){
    return contracts.find(x=>x.phone===phoneNo&&x.id!==exceptId&&x.status!=='cancelled'&&!(end<x.starts_on||start>x.expires_on));
  }
  /* 연장 = 기존 계약 다음 날부터 새 계약 */
  function renderExtend(panel,c){
    panel.append(node('p','vip-ledger-help','기존 계약은 그대로 두고, 만료일 다음 날부터 새 계약을 만듭니다. 지난 차감 기록과 섞이지 않습니다.'));
    const grid=node('div','vip-extend-grid');
    const mk=(label,el)=>{const w=node('label','',label);w.append(el);grid.append(w);return el;};
    const start=mk('새 계약 시작일',node('input'));start.type='date';start.value=nextDay(c.expires_on);
    const months=mk('기간',node('select'));
    for(const n of [1,2,3,6,12]){const o=node('option','',n+'개월');o.value=String(n);months.append(o);}
    months.value='2';
    const visits=mk('월 이용 횟수',node('select'));
    for(const n of [2,4]){const o=node('option','','월 '+n+'회');o.value=String(n);visits.append(o);}
    visits.value=String(c.monthly_visits);
    panel.append(grid);
    const sum=node('p','vip-extend-sum');panel.append(sum);
    const calc=()=>{const e=prevDay(addMonths(start.value,Number(months.value)));sum.textContent=start.value?('새 계약: '+start.value+' ~ '+e+' · 월 '+visits.value+'회'):'시작일을 선택해 주세요.';return e;};
    [start,months,visits].forEach(el=>el.addEventListener('input',calc));calc();
    const go=node('button','vip-ledger-save','새 계약 만들기');go.type='button';panel.append(go);
    go.addEventListener('click',async()=>{
      const s0=start.value,e0=calc();
      if(!s0)return note('시작일을 선택해 주세요.',true);
      const hit=overlaps(c.phone,s0,e0,null);
      if(hit)return note('기간이 겹치는 계약이 있습니다 ('+hit.starts_on+' ~ '+hit.expires_on+'). 시작일을 '+nextDay(hit.expires_on)+' 이후로 해 주세요.',true);
      if(!confirm(c.customer_name+' 님 새 계약을 만들까요?\n'+s0+' ~ '+e0+' · 월 '+visits.value+'회'))return;
      if(busy)return;busy=true;
      try{
        const saved=await apiSave('vip_contracts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
          phone:c.phone,customer_name:c.customer_name,car_model:c.car_model||'',apartment:c.apartment||'',monthly_visits:Number(visits.value),
          starts_on:s0,expires_on:e0,anchor_on:s0,status:'active',note:'연장 계약 (이전: '+c.starts_on+' ~ '+c.expires_on+')'})});
        if(Array.isArray(saved)&&saved[0]?.id)selectedId=saved[0].id;
        busy=false;await load();note('새 계약을 만들었습니다: '+s0+' ~ '+e0+'. 이전 계약은 만료일까지 그대로 유지됩니다.');
      }catch(err){busy=false;note('연장 실패: '+err.message,true);}
    });
  }
  function hyphen(p){return p.length===11?p.slice(0,3)+'-'+p.slice(3,7)+'-'+p.slice(7):p;}
  function scheduleSection(c) {
    const title=node('h4','','세차 일정');
    const caption=node('p','vip-ledger-help','세차할 날을 지정해 두세요. 고객 \'내 예약\'에 다음 방문일로 표시되고, 세차 후 \'완료 · 1회 차감\'을 누르면 잔여 횟수가 자동으로 줄어듭니다.');
    const row=node('div','vip-ledger-link-row vip-sched-row');
    const date=node('input');date.type='date';date.id='vipSchedDate';
    date.min=c.starts_on;date.max=c.expires_on;
    const today=seoulDay(Date.now());
    date.value=today<c.starts_on?c.starts_on:(today>c.expires_on?c.expires_on:today);
    date.addEventListener('input',()=>{date.dataset.touched='1';});
    const nowU=usage(c,date.value);
    if(nowU.left===0 && nextDay(nowU.end)<=c.expires_on){date.value=nextDay(nowU.end);date.dataset.touched='1';}
    const time=node('select');time.id='vipSchedTime';
    for(let h=9;h<=23;h++){const v=String(h).padStart(2,'0')+':00';const o=node('option','',v);o.value=v;time.append(o);}
    time.value='14:00';
    const add=node('button','','일정 등록');add.type='button';
    add.disabled=c.status!=='active';
    add.addEventListener('click',()=>scheduleVisit(c,date.value,time.value));
    row.append(date,time,add);
    const ul=node('ul','vip-ledger-connected vip-sched-list');
    const planned=jobs.filter(j=>phone(j.phone)===c.phone && j.status==='확정' && j.scheduled_at)
      .sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
    if(!planned.length)ul.append(node('li','','등록된 세차 일정이 없습니다.'));
    for(const j of planned){
      const li=node('li','');
      li.append(node('span','vip-sched-when',kstLabel(j.scheduled_at)+' · '+(j.car_model||'차량')));
      const done=node('button','vip-sched-done','완료 · 1회 차감');done.type='button';
      done.addEventListener('click',()=>completeVisit(c,j));
      const cancel=node('button','vip-sched-cancel','일정 취소');cancel.type='button';
      cancel.addEventListener('click',()=>cancelVisit(j));
      li.append(done,cancel);ul.append(li);
    }
    const u=usage(c,seoulDay(Date.now())<c.starts_on?c.starts_on:seoulDay(Date.now()));
    const quota=node('p','vip-sched-quota'+(u.left===0?' full':''),
      '이번 이용주기('+u.start+' ~ '+u.end+') · 완료 '+u.used+'회 · 예약 '+u.planned+'회 · '+
      (u.left===0?'월 '+c.monthly_visits+'회를 모두 사용·예약해 더 등록할 수 없습니다':'남은 등록 가능 '+u.left+'회'));
    return [title,caption,quota,row,ul];
  }
  async function scheduleVisit(c,day,hm) {
    if(!day)return note('세차 날짜를 선택해 주세요.',true);
    if(day<c.starts_on||day>c.expires_on)return note('계약 기간('+c.starts_on+' ~ '+c.expires_on+') 안의 날짜를 선택해 주세요.',true);
    const u=usage(c,day);
    if(u.left===0){
      return note('이 이용주기('+u.start+' ~ '+u.end+')는 월 '+c.monthly_visits+'회를 모두 사용·예약했습니다 (완료 '+u.used+'회, 예약 '+u.planned+'회). '+
        (nextDay(u.end)<=c.expires_on?nextDay(u.end)+' 이후 날짜로 등록해 주세요.':'계약 만료 전 마지막 주기입니다.'),true);
    }
    if(busy)return;busy=true;note('세차 일정을 등록하는 중입니다.');
    try{
      const ph=hyphen(c.phone);
      let apt='월세차 정기관리', addr=null, plate=null;
      try{
        const last=await api('reservations?select=apartment,address,plate&or=(phone.eq.'+c.phone+',phone.eq.'+ph+')&order=created_at.desc&limit=1');
        if(last&&last[0]){apt=last[0].apartment||apt;addr=last[0].address||null;plate=last[0].plate||null;}
      }catch(_){}
      const payload={customer_name:c.customer_name,phone:ph,apartment:apt,address:addr,plate:plate,
        car_model:c.car_model||'',service_type:c.monthly_visits===4?'월4회':'월2회',
        status:'확정',scheduled_at:day+'T'+hm+':00+09:00',preferred_date:day,preferred_time:hm,
        memo:'[월세차 계약 일정 · 관리자 등록]'};
      const made=await api('reservations',{method:'POST',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});
      const row=Array.isArray(made)?made[0]:null;
      if(row && row.status!=='확정'){
        await api('reservations?id=eq.'+encodeURIComponent(row.id),{method:'PATCH',body:JSON.stringify({status:'확정',scheduled_at:payload.scheduled_at}),headers:{Prefer:'return=minimal'}});
      }
      busy=false;await load();note(day+' '+hm+' 세차 일정을 등록했습니다. 고객 \'내 예약\'에 다음 방문일로 표시됩니다.');
    }catch(e){busy=false;note('일정 등록 실패: '+e.message,true);}
  }
  async function completeVisit(c,j) {
    const when=new Date(j.scheduled_at);
    const doneAt=(when.getTime()<=Date.now()?when:new Date()).toISOString();
    const day=seoulDay(doneAt);
    if(day<c.starts_on||day>c.expires_on)return note('완료일('+day+')이 계약 기간 밖이라 차감할 수 없습니다. 계약 기간을 확인해 주세요.',true);
    const u=usage(c,day);
    if(u.used>=c.monthly_visits)return note('이 이용주기('+u.start+' ~ '+u.end+')는 이미 월 '+c.monthly_visits+'회를 모두 차감했습니다. 추가 세차는 일반 예약(유료)으로 처리해 주세요.',true);
    if(!confirm(kstLabel(j.scheduled_at)+' 세차를 완료 처리하고 이용 횟수 1회를 차감할까요?'))return;
    if(busy)return;busy=true;note('완료 처리 중입니다.');
    try{
      await api('reservations?id=eq.'+encodeURIComponent(j.id),{method:'PATCH',body:JSON.stringify({status:'완료',done_at:doneAt}),headers:{Prefer:'return=minimal'}});
      try{
        await api('vip_visit_links',{method:'POST',body:JSON.stringify({contract_id:c.id,reservation_id:j.id}),headers:{Prefer:'return=minimal'}});
      }catch(linkErr){busy=false;await load();return note('완료는 처리됐지만 차감 연결에 실패했습니다: '+linkErr.message+' · 아래 \'완료된 세차 직접 연결\'에서 다시 연결해 주세요.',true);}
      busy=false;await load();note('완료 처리하고 1회 차감했습니다. 고객 화면 잔여 횟수에도 반영됩니다.');
    }catch(e){busy=false;note('완료 처리 실패: '+e.message,true);}
  }
  async function cancelVisit(j) {
    if(!confirm(kstLabel(j.scheduled_at)+' 세차 일정을 취소할까요? (횟수는 차감되지 않습니다)'))return;
    if(busy)return;busy=true;
    try{
      await api('reservations?id=eq.'+encodeURIComponent(j.id),{method:'PATCH',body:JSON.stringify({status:'취소'}),headers:{Prefer:'return=minimal'}});
      busy=false;await load();note('세차 일정을 취소했습니다.');
    }catch(e){busy=false;note('취소 실패: '+e.message,true);}
  }
  async function linkVisit(contractId,reservationId) {
    if(!reservationId)return note('완료된 세차를 선택해 주세요.',true);
    if(busy)return;busy=true;
    try{
      await api('vip_visit_links',{method:'POST',body:JSON.stringify({contract_id:contractId,reservation_id:reservationId}),headers:{Prefer:'return=minimal'}});
      busy=false;await load();note('연결되었습니다. 회원 잔여 횟수가 갱신됩니다.');
    }catch(e){busy=false;note(e.message,true);}
  }
  async function unlinkVisit(reservationId) {
    if(!confirm('이 완료 기록을 월세차 이용 횟수에서 제외하시겠습니까?'))return;
    if(busy)return;busy=true;
    try {
      await api('vip_visit_links?reservation_id=eq.'+encodeURIComponent(reservationId),{method:'DELETE'});
      busy=false;await load();note('연결이 해제되었습니다.');
    }catch(e){busy=false;note(e.message,true);}
  }
  async function save(e) {
    e.preventDefault();if(busy)return;
    const f=e.currentTarget;
    const data=Object.fromEntries(new FormData(f));
    const id=data.contractId;delete data.contractId;
    const payload={
      phone:phone(data.phone),customer_name:(data.customerName||'').trim(),
      car_model:(data.carModel||'').trim(),apartment:(data.apartment||'').trim().slice(0,80),monthly_visits:Number(data.monthlyVisits),
      starts_on:data.startsOn,expires_on:data.expiresOn,anchor_on:data.anchorOn,
      status:data.status,note:(data.note||'').trim()
    };
    if(!/^010\d{8}$/.test(payload.phone))return note('010 휴대폰 11자리를 확인해 주세요.',true);
    const clash=payload.status!=='cancelled'&&overlaps(payload.phone,payload.starts_on,payload.expires_on,id||null);
    if(clash)return note('같은 번호의 다른 계약('+clash.starts_on+' ~ '+clash.expires_on+')과 기간이 겹칩니다. 연장은 \'연장 (새 계약 만들기)\'를 이용해 주세요.',true);
    if(!payload.starts_on||!payload.expires_on||!payload.anchor_on||
      payload.starts_on>payload.expires_on || payload.anchor_on<payload.starts_on||
      payload.anchor_on>payload.expires_on)return note('시작·만료·관리 기준일을 확인해 주세요.',true);
    busy=true;note('계약 저장 중입니다.');
    try{
      const path='vip_contracts'+(id?'?id=eq.'+encodeURIComponent(id):'');
      const saved=await apiSave(path,{method:id?'PATCH':'POST',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});
      if(!id && Array.isArray(saved) && saved[0]?.id) selectedId=saved[0].id;
      busy=false;
      await load();
      note('계약이 저장되었습니다. 실제 완료 세차를 연결하면 잔여 횟수에 반영됩니다.');
    }catch(e){busy=false;note(e.message,true);}
  }
  function initialize() {
    const root=$('adminSecMembers');
    if(!root || root.querySelector('#vipContractsRoot'))return;
    const section=node('section','vip-ledger-root');
    section.id='vipContractsRoot';
    const title=node('h3','','월세차 계약 · 월별 횟수 관리');
    const hint=node('p','vip-ledger-help','월세차 계약 기간, 월 2·4회 이용권, 관리 기준일을 등록하세요. 기존 고객 목록은 아래 그대로 유지됩니다.');
    const controls=node('div','vip-ledger-controls');
    const refresh=node('button','','계약 새로고침');refresh.type='button';refresh.addEventListener('click',load);
    const fresh=node('button','','+ 새 계약');fresh.type='button';fresh.addEventListener('click',()=>choose(null));
    controls.append(refresh,fresh);
    const content=node('div','vip-ledger-grid');
    const list=node('div','vip-ledger-list');list.id='vipContractList';
    const detail=node('div','vip-ledger-editor');
    const heading=node('h4','','새 월세차 계약 등록');heading.id='vipContractFormTitle';
    const form=document.createElement('form');form.id='vipContractForm';
    const fields=[
      ['hidden','contractId',''],
      ['tel','phone','고객 연락처 (010-0000-0000)','required'],
      ['text','customerName','고객 이름','required'],
      ['text','carModel','차량 모델'],
      ['text','apartment','아파트명 (같은 아파트 할인 기준 · 글자까지 똑같이)'],
      ['date','startsOn','계약 시작일','required'],
      ['date','expiresOn','계약 만료일','required'],
      ['date','anchorOn','관리 기준일 · 첫 권장일','required']
    ];
    for(const [type,name,label,required] of fields) {
      const control=node('input');control.type=type;control.name=name;
      if(required)control.required=true;
      if(type==='hidden'){form.append(control);continue;}
      const wrap=node('label','',label);wrap.append(control);form.append(wrap);
    }
    const aptInput=form.querySelector('[name="apartment"]');
    if(aptInput){aptInput.setAttribute('list','vipAptList');aptInput.maxLength=80;aptInput.placeholder='목록에서 고르면 같은 아파트로 정확히 묶여요';}
    const aptList=document.createElement('datalist');aptList.id='vipAptList';form.append(aptList);
    const visitLabel=node('label','','월 이용 횟수');
    const plan=node('select');plan.name='monthlyVisits';
    for(const n of [2,4]){const opt=node('option','','월 '+n+'회');opt.value=String(n);plan.append(opt);}
    visitLabel.append(plan);form.append(visitLabel);
    const statusLabel=node('label','','계약 상태');const statusField=node('select');statusField.name='status';
    for(const [value,label] of [['active','운영'],['paused','일시중지'],['cancelled','종료']]){
      const opt=node('option','',label);opt.value=value;statusField.append(opt);
    }
    statusLabel.append(statusField);form.append(statusLabel);
    const memoLabel=node('label','','관리자 메모 (회원에게 비공개)');
    const memo=node('textarea');memo.name='note';memo.rows=2;memoLabel.append(memo);form.append(memoLabel);
    const submit=node('button','vip-ledger-save','계약 저장');submit.type='submit';form.append(submit);
    form.addEventListener('submit',save);
    const connected=node('div','vip-ledger-connections');connected.id='vipLinkArea';
    detail.append(heading,form,connected);
    content.append(list,detail);
    const message=node('p','vip-ledger-message');message.id='vipAdminMessage';message.setAttribute('role','status');
    const apt=node('div','vip-apt-summary');apt.id='vipAptSummary';
    section.append(title,hint,controls,message,apt,content);
    root.prepend(section);
    // Only load when the owner has opened the admin area, not when public users visit.
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-sec="members"]'))setTimeout(load,100);
    });
    const refreshButton=$('memberRefresh');
    if(refreshButton)refreshButton.addEventListener('click',load);
  }
  const observer=new MutationObserver(()=>{
    if($('adminSecMembers')){initialize();observer.disconnect();}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{
    initialize();if(!$('adminSecMembers'))observer.observe(document.body,{childList:true,subtree:true});
  });
  else{initialize();if(!$('adminSecMembers'))observer.observe(document.body,{childList:true,subtree:true});}
})();
} catch (e) { console.error('[vip-contract-admin.js]', e); }

/* ===== admin-calendar.js ===== */
try {
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
} catch (e) { console.error('[admin-calendar.js]', e); }

/* ===== member-link-admin.js ===== */
try {
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
} catch (e) { console.error('[member-link-admin.js]', e); }

/* ===== dual-access.js ===== */
try {
/* Guest booking / new monthly membership / existing VIP visit request.
   Pure presentation and booking-form intent; server still verifies every VIP contract manually. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  function form(){return $('bookingForm');}
  function openBooking() {
    if(typeof window.go==='function')window.go('booking');
    else {
      document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='booking'));
    }
  }
  function serviceChange(value) {
    const el=form()?.querySelector('[name="service"]');
    if(!el)return;
    el.value=value;
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function setMode(mode,opts) {
    const f=form();
    if(!f)return;
    if(!['guest','monthly','existing'].includes(mode)) mode='guest';
    if (f.dataset.vipStep==='2') $('wizardPrev')?.click();
    f.dataset.bookingMode=mode;
    const bookingButtons=document.querySelectorAll('[data-booking-choice]');
    bookingButtons.forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.bookingChoice===mode)));
    const t=$('bookingModeText');
    if(mode==='guest') {
      if(t){t.dataset.kind='guest';t.textContent='비회원도 로그인·회원가입 없이 예약할 수 있습니다. 예약 정보는 일정 확인 연락에 사용됩니다.';}
      if(!opts?.keepService)serviceChange('일일 외부세차');
    } else if(mode==='monthly') {
      if(t){t.dataset.kind='monthly';t.textContent='월 2회 또는 월 4회 정기관리 신규 신청입니다. 접수 후 관리자가 계약 조건과 일정을 확인합니다.';}
      if(!opts?.keepService)serviceChange('월 2회');
    } else {
      if(t){t.dataset.kind='existing';t.textContent='기존 월세차 방문 요청입니다. 계약 잔여 횟수와 예약 가능 일정은 관리자 확인 후 적용되며, 제출만으로 횟수가 차감되지 않습니다.';}
      if(!opts?.keepService)serviceChange('기타 상담');
      const memo=f.elements.namedItem('memo');
      if(memo && !memo.value.trim())memo.placeholder='원하시는 방문 날짜·시간과 정기관리 요청사항을 남겨주세요.';
    }
    const result=$('bookingResult');
    if(result){result.classList.add('hidden');result.replaceChildren();}
  }
  function init() {
    const f=form();if(!f)return;
    // Keep one-off booking as the safe default for unrecognized deep links or no JavaScript.
    setMode('guest');
    document.addEventListener('click',function(e){
      let modeButton=e.target.closest('[data-booking-mode]');
      // 예약 폼 자신도 data-booking-mode 속성을 가지므로, 폼 안의 다른 버튼(다음 단계 등)을 눌러도
      // 폼이 "모드 버튼"으로 잘못 인식되어 1단계로 되돌아갔습니다. 폼 자신은 제외합니다.
      if(modeButton===f) modeButton=null;
      if(modeButton) {
        e.preventDefault();
        const mode=modeButton.dataset.bookingMode;
        if(mode==='existing') {
          // Existing-visit actions appear only inside the authenticated member dashboard.
          if(!modeButton.closest('#memberDashboard')) {
            if(typeof window.go==='function')window.go('mypage');
            return;
          }
        }
        openBooking();
        setMode(mode);
        return;
      }
      const join=e.target.closest('[data-vip-start]');
      if(join){setMode('monthly',{keepService:true});return;}
      const plain=e.target.closest('[data-go="booking"]');
      if(plain && !plain.closest('#memberDashboard')){
        setMode('guest');
        // 세차 3단계 카드의 "예약하기" 버튼: 고른 단계를 희망 서비스로 미리 선택
        if(plain.dataset.pickService)serviceChange(plain.dataset.pickService);
      }
    });
    f.querySelector('[name="service"]')?.addEventListener('change',function(e){
      if(f.dataset.bookingMode==='existing' && e.target.value!=='기타 상담'){
        setMode(/^월 [24]회$/.test(e.target.value)?'monthly':'guest',{keepService:true});
      }
      if(f.dataset.bookingMode==='guest' && /^월 [24]회$/.test(e.target.value)){
        setMode('monthly',{keepService:true});
      }
      if(f.dataset.bookingMode==='monthly' && !/^월 [24]회$/.test(e.target.value)){
        setMode('guest',{keepService:true});
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
} catch (e) { console.error('[dual-access.js]', e); }

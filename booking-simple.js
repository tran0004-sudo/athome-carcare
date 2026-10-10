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

    /* 3) 희망 일정 빠른 선택 */
    var date = $('[name="preferredDate"]');
    var time = $('[name="preferredTime"]');
    if (date && time) {
      date.min = ymd(new Date());
      var dateLabel = date.closest('label');
      var timeLabel = time.closest('label');
      var wrap = document.createElement('div');
      wrap.className = 'span-2 bk-when';
      wrap.setAttribute('data-vip-step', '2');
      wrap.innerHTML =
        '<span class="opt-title">희망 일정 <small class="field-hint">정하지 않으셔도 됩니다 (선택)</small></span>' +
        '<div class="bk-chips" data-group="date" role="group" aria-label="희망 날짜">' +
        '<button type="button" data-d="today">오늘</button><button type="button" data-d="tomorrow">내일</button>' +
        '<button type="button" data-d="weekend">주말</button><button type="button" data-d="custom">직접</button></div>' +
        '<div class="bk-chips" data-group="time" role="group" aria-label="희망 시간대">' +
        '<button type="button" data-t="10:00">오전</button><button type="button" data-t="14:00">오후</button>' +
        '<button type="button" data-t="18:00">저녁</button><button type="button" data-t="custom">직접</button></div>' +
        '<div class="bk-custom"></div>';
      dateLabel.parentNode.insertBefore(wrap, dateLabel);
      var custom = wrap.querySelector('.bk-custom');
      custom.appendChild(dateLabel);
      custom.appendChild(timeLabel);
      dateLabel.removeAttribute('data-vip-step');
      timeLabel.removeAttribute('data-vip-step');
      custom.hidden = true;

      var dChips = wrap.querySelector('[data-group="date"]');
      var tChips = wrap.querySelector('[data-group="time"]');
      function mark(group, btn) {
        Array.prototype.forEach.call(group.children, function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      }
      function resetChips() {
        mark(dChips, null); mark(tChips, null); custom.hidden = true;
      }
      dChips.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var now = new Date(), d = new Date(now), kind = b.dataset.d;
        if (b.getAttribute('aria-pressed') === 'true') { date.value = ''; mark(dChips, null); fire(date, 'change'); return; }
        if (kind === 'custom') { custom.hidden = false; mark(dChips, b); date.focus(); return; }
        if (kind === 'tomorrow') d.setDate(d.getDate() + 1);
        if (kind === 'weekend') { var w = now.getDay(); if (w >= 1 && w <= 5) d.setDate(d.getDate() + (6 - w)); }
        date.value = ymd(d); mark(dChips, b); fire(date, 'change');
      });
      tChips.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.getAttribute('aria-pressed') === 'true') { time.value = ''; mark(tChips, null); fire(time, 'change'); return; }
        if (b.dataset.t === 'custom') { custom.hidden = false; mark(tChips, b); time.focus(); return; }
        time.value = b.dataset.t; mark(tChips, b); fire(time, 'change');
      });
      form.addEventListener('reset', function () { setTimeout(resetChips, 0); });
    }

    /* 4) 옵션·쿠폰·추천인은 접어 둠 */
    var opt = $('.opt-field:not(#promoField)');
    var promo = $('#promoField');
    var refInput = $('[name="referrer"]');
    var refLabel = refInput && refInput.closest('label');
    if (opt && promo && refLabel) {
      var more = document.createElement('details');
      more.className = 'span-2 bk-more';
      more.setAttribute('data-vip-step', '2');
      more.innerHTML = '<summary><span>추가 옵션 · 쿠폰 · 추천인 <em>(선택)</em></span><b id="bkMoreCount"></b></summary><div class="bk-more-body"></div>';
      var body = more.querySelector('.bk-more-body');
      opt.parentNode.insertBefore(more, opt);
      body.appendChild(opt); body.appendChild(promo); body.appendChild(refLabel);
      var count = more.querySelector('#bkMoreCount');
      function updateCount() {
        var n = form.querySelectorAll('[name="options"]:checked').length;
        var p = form.querySelector('[name="promo"]:checked');
        var parts = [];
        if (n) parts.push('옵션 ' + n);
        if (p && p.value) parts.push('혜택 1');
        count.textContent = parts.join(' · ');
      }
      form.addEventListener('change', function (e) {
        if (e.target.name === 'options' && e.target.checked) more.open = true;
        updateCount();
      });
      form.addEventListener('reset', function () { setTimeout(function () { updateCount(); more.open = false; }, 0); });
      /* 쿠폰 번호를 바로 입력하는 경우 대비: 쿠폰 확인 결과가 보이면 펼침 */
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

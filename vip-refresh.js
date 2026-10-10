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

    function setStep(step, focusHeading) {
      var n = step === 2 ? 2 : 1;
      form.dataset.vipStep = String(n);
      form.querySelectorAll('[data-vip-step]').forEach(function (el) {
        var current = el.getAttribute('data-vip-step');
        el.classList.toggle('wizard-hidden', current !== 'both' && current !== String(n));
      });
      label.textContent = 'STEP ' + n + ' / 2';
      title.textContent = n === 1 ? '차량과 관리 주기를 선택해 주세요' : '방문 위치와 연락처를 알려주세요';
      prev.hidden = n === 1;
      next.hidden = n === 2;
      if (focusHeading && title) {
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll:true });
        document.getElementById('booking').scrollIntoView({ behavior:'smooth', block:'start' });
      }
    }

    function checkFirstStep() {
      // 폼 자신도 data-vip-step 속성을 가지므로, 폼 전체가 1단계로 잡히지 않게 자기 자신은 제외합니다.
      var inputs = [];
      Array.prototype.forEach.call(form.querySelectorAll('[data-vip-step="1"]'), function (box) {
        if (box === form) return;
        if (box.matches('input,select,textarea')) inputs.push(box);
        Array.prototype.forEach.call(box.querySelectorAll('input,select,textarea'), function (el) { inputs.push(el); });
      });
      for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        if (input.disabled || input.closest('.hidden') || input.classList.contains('hidden')) continue;
        if (!input.checkValidity()) {
          input.reportValidity();
          input.focus();
          return false;
        }
      }
      return true;
    }

    form.classList.add('booking-wizard-ready');
    next.addEventListener('click', function () {
      if (checkFirstStep()) setStep(2, true);
    });
    prev.addEventListener('click', function () { setStep(1, true); });
    form.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && form.dataset.vipStep === '1' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        if (checkFirstStep()) setStep(2, true);
      }
    });
    setStep(1, false);
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

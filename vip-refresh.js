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
      var inputs = form.querySelectorAll('[data-vip-step="1"] input, [data-vip-step="1"] select, [data-vip-step="1"] textarea');
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

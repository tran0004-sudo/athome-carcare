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
    var sec = document.getElementById('booking');
    var anchor = sec && sec.querySelector('.booking-path-selector');
    if (!anchor || document.getElementById('guestLookup')) return;
    var box = document.createElement('details');
    box.id = 'guestLookup'; box.className = 'guest-lookup';
    box.innerHTML = '<summary><span>이미 예약하셨나요? <em>예약 확인</em></span></summary>' +
      '<form class="gl-form" novalidate><p>예약할 때 입력한 휴대폰 번호와 차량번호를 넣어 주세요. 로그인은 필요 없어요.</p>' +
      '<input name="glPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="휴대폰 번호 010-0000-0000" required>' +
      '<input name="glPlate" autocomplete="off" placeholder="차량번호 예: 12가 3456" required>' +
      '<button type="submit" class="primary-btn">예약 확인하기</button><div class="gl-result" role="status" aria-live="polite"></div></form>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    var form = box.querySelector('form'), out = box.querySelector('.gl-result'), btn = form.querySelector('button');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var phone = form.glPhone.value.trim(), plate = form.glPlate.value.trim();
      if (!/^(\+?82|0)1\d[\s\-]?\d{3,4}[\s\-]?\d{4}$/.test(phone) || plate.replace(/[\s\-]/g, '').length < 4) {
        out.innerHTML = '<p class="gl-msg">휴대폰 번호와 차량번호를 정확히 입력해 주세요.</p>'; return;
      }
      btn.disabled = true; btn.textContent = '확인 중…';
      try {
        var rows = await lookup(phone, plate);
        out.innerHTML = rows.length ? rows.map(card).join('')
          : '<p class="gl-msg">일치하는 예약을 찾지 못했어요. 예약할 때 입력한 번호와 차량번호가 맞는지 확인하시고, 계속 안 보이면 카카오채널로 문의해 주세요.</p>';
      } catch (err) {
        out.innerHTML = '<p class="gl-msg">지금은 확인할 수 없어요. 잠시 후 다시 시도하거나 카카오채널로 문의해 주세요.</p>';
      } finally { btn.disabled = false; btn.textContent = '예약 확인하기'; }
    });
    /* 내 관리 화면에서 넘어오는 링크 */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-open-lookup]'); if (!a) return;
      var go = document.querySelector('.bottom-nav [data-go="booking"]'); if (go) go.click();
      box.open = true; setTimeout(function () { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

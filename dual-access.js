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
      if(t){t.dataset.kind='existing';t.textContent='기존 VIP 방문 요청입니다. 계약 잔여 횟수와 예약 가능 일정은 관리자 확인 후 적용되며, 제출만으로 횟수가 차감되지 않습니다.';}
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
      if(plain && !plain.closest('#memberDashboard')){setMode('guest');}
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

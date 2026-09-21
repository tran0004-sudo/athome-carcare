const STORAGE_KEY = 'athomeCarCareDataV2';
const CONTENT_URL = './data/content.json';
const SECTION_RESTORE_KEY = 'athomeClassicSectionsRestore20260917-plate';

let publishedState = null;
let state = null;
let deferredPrompt = null;

const deepClone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s = '') => String(s).replace(/[&<>'"]/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[c]));

const DEFAULT_PROMOS = [
  { id: 'first4', auto: 'first', text: '첫 달 월 4회 ', highlight: '10,000원 할인', amount: 10000, services: ['월 4회'] },
  { id: 'first2', auto: 'first', text: '첫 달 월 2회 ', highlight: '5,000원 할인', amount: 5000, services: ['월 2회'] },
  { id: 'refer', text: '가족·지인 소개 시 ', highlight: '외부세차 1회', amount: 0, gift: '외부세차 1회 제공', services: [] },
  { id: 'apt5', auto: 'apt5', text: '같은 아파트 5대 이상 ', highlight: '차량당 5,000원 할인', amount: 5000, services: ['월 2회', '월 4회'] },
  { id: 'loyal', auto: 'loyal', text: '꾸준히 이용 시 ', highlight: '3개월마다 외부세차 1회', amount: 0, gift: '3개월마다 외부세차 1회', services: ['월 2회', '월 4회'] },
  { id: 'review', text: '리뷰 작성 시 ', highlight: '3,000원 할인 · 실외 전체 왁스 · 트렁크 청소 중 택 1 쿠폰', amount: 3000, services: [] },
];

function normalize(data = {}) {
  const base = publishedState || {
    settings: { phone: '010-8391-8999', kakaoUrl: 'https://pf.kakao.com/_gpDrX', area: '경산 중산지구 · 사월동 · 시지 · 신매동 · 대구 전지역' },
    promos: deepClone(DEFAULT_PROMOS),
    gallery: [], reviews: [], tips: [], inquiries: []
  };
  return {
    settings: { ...base.settings, ...(data.settings || {}) },
    promos: Array.isArray(data.promos) && data.promos.length ? data.promos : deepClone(base.promos || DEFAULT_PROMOS),
    gallery: Array.isArray(data.gallery) ? data.gallery : deepClone(base.gallery || []),
    reviews: Array.isArray(data.reviews) ? data.reviews : deepClone(base.reviews || []),
    tips: Array.isArray(data.tips) ? data.tips : deepClone(base.tips || []),
    inquiries: Array.isArray(data.inquiries) ? data.inquiries : []
  };
}

async function loadPublished() {
  try {
    const response = await fetch(`${CONTENT_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    publishedState = normalize(await response.json());
  } catch (error) {
    console.warn('공개 콘텐츠 파일을 불러오지 못했습니다.', error);
    publishedState = normalize({});
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : deepClone(publishedState);
  } catch (error) {
    return deepClone(publishedState);
  }
}

function restorePublishedSectionsOnce() {
  try {
    if (localStorage.getItem(SECTION_RESTORE_KEY) === '1') return;
    state.gallery = deepClone(publishedState.gallery || []);
    state.reviews = deepClone(publishedState.reviews || []);
    state.tips = deepClone(publishedState.tips || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(SECTION_RESTORE_KEY, '1');
  } catch (error) {
    console.warn('기존 콘텐츠 복원 중 오류가 발생했습니다.', error);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2300);
}

function digits(phone = '') {
  return String(phone).replace(/\D/g, '');
}

function comparisonMarkup(item) {
  return `<article class="comparison-card" data-id="${esc(item.id)}">
    <h3>${esc(item.title)}</h3>
    <div class="compare">
      <img src="${esc(item.before)}" alt="${esc(item.title)} 세차 전">
      <img class="after" src="${esc(item.after)}" alt="${esc(item.title)} 세차 후">
      <div class="divider"></div>
      <span class="compare-label before">세차 전</span>
      <span class="compare-label after-label">세차 후</span>
      <input type="range" min="0" max="100" value="50" aria-label="세차 전후 비교 슬라이더">
    </div>
    <p>${esc(item.note || '')}</p>
  </article>`;
}

function reviewMarkup(review) {
  const stars = '★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)));
  return `<article class="review-card">
    <div class="stars" aria-label="별점 ${esc(review.rating)}점">${stars}</div>
    <blockquote>"${esc(review.text)}"</blockquote>
    <footer>${esc(review.author)}${review.car ? ' · ' + esc(review.car) : ''}</footer>
  </article>`;
}

function tipMarkup(tip) {
  return `<article class="tip-card">
    <div class="tip-cover">${esc(tip.icon || '✨')}</div>
    <div class="tip-body">
      <span class="tip-tag">${esc(tip.category)}</span>
      <h3>${esc(tip.title)}</h3>
      <p>${esc(tip.body)}</p>
      <button class="tip-more" data-tip="${esc(tip.id)}">자세히 보기 →</button>
    </div>
  </article>`;
}

function bindComparisons(scope = document) {
  scope.querySelectorAll('.compare input').forEach((input) => {
    input.addEventListener('input', (event) => {
      const wrap = event.target.closest('.compare');
      const value = event.target.value;
      wrap.querySelector('.after').style.clipPath = `inset(0 0 0 ${value}%)`;
      wrap.querySelector('.divider').style.left = `${value}%`;
    });
  });
}

function renderTips(category = '전체') {
  const categories = ['전체', ...new Set(state.tips.map((tip) => tip.category))];
  document.querySelector('#tipFilters').innerHTML = categories.map((name) =>
    `<button class="chip ${name === category ? 'active' : ''}" data-filter="${esc(name)}">${esc(name)}</button>`
  ).join('');

  const list = category === '전체' ? state.tips : state.tips.filter((tip) => tip.category === category);
  document.querySelector('#tipList').innerHTML = list.length
    ? list.map(tipMarkup).join('')
    : '<p class="empty-state">해당 카테고리에 글이 없습니다.</p>';
}

function renderSettings() {
  const form = document.querySelector('#settingsForm');
  if (form) {
    form.phone.value = state.settings.phone || '010-8391-8999';
    if (form.kakaoUrl) form.kakaoUrl.value = state.settings.kakaoUrl || '';
    if (form.area) form.area.value = state.settings.area || '';
  }
  const phone = state.settings.phone || '010-8391-8999';
  document.querySelectorAll('[data-phone-text]').forEach((el) => { el.textContent = phone; });
  document.querySelectorAll('[data-call]').forEach((el) => { el.href = `tel:${digits(phone)}`; });
  document.querySelectorAll('[data-sms]').forEach((el) => { el.href = `sms:${digits(phone)}`; });
  const kakaoUrl = state.settings.kakaoUrl || '';
  document.querySelectorAll('[data-kakao-link]').forEach((el) => {
    el.classList.toggle('hidden', !kakaoUrl);
    if (kakaoUrl) el.href = kakaoUrl;
  });
}

let autoBenefits = { first: false, apt5: false, loyal: false };
let myCoupons = [];
let selectedBenefit = '';

function promoLabel(promo) {
  return `${promo.text || ''}${promo.highlight || ''}`.trim();
}

function renderPromos() {
  const el = document.querySelector('#promoList');
  if (!el) return;
  const promos = state.promos || DEFAULT_PROMOS;
  el.innerHTML = promos.map((promo) =>
    `<li>${esc(promo.text || '')}<b>${esc(promo.highlight || '')}</b></li>`).join('');
}

function render() {
  document.querySelector('#homeComparisons').innerHTML = state.gallery.slice(0, 3).map(comparisonMarkup).join('');
  document.querySelector('#galleryList').innerHTML = state.gallery.length
    ? state.gallery.map(comparisonMarkup).join('')
    : '<p class="empty-state">등록된 세차 전후 사진이 없습니다.</p>';

  document.querySelector('#homeReviews').innerHTML = state.reviews.slice(0, 4).map(reviewMarkup).join('');
  document.querySelector('#reviewList').innerHTML = state.reviews.length
    ? state.reviews.map(reviewMarkup).join('')
    : '<p class="empty-state">등록된 후기가 없습니다.</p>';

  document.querySelector('#homeTips').innerHTML = state.tips.slice(0, 4).map(tipMarkup).join('');
  renderTips('전체');
  renderPromos();
  renderSettings();
  bindComparisons();
}

function go(id) {
  document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === id));
  document.querySelectorAll('.bottom-nav button').forEach((button) => button.classList.toggle('active', button.dataset.go === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function compressFile(file) {
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = data;
  });
  const max = 1200;
  let width = img.width;
  let height = img.height;
  if (Math.max(width, height) > max) {
    const scale = max / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const goButton = event.target.closest('[data-go]');
    if (goButton) { go(goButton.dataset.go); return; }

    const filter = event.target.closest('[data-filter]');
    if (filter) { renderTips(filter.dataset.filter); return; }

    const tipButton = event.target.closest('.tip-more');
    if (tipButton) {
      const tip = state.tips.find((item) => item.id === tipButton.dataset.tip);
      if (tip) alert(`${tip.title}\n\n${tip.body}`);
    }
  });

  // 고객 후기 폼
  const reviewForm = document.querySelector('#reviewForm');
  if (reviewForm) reviewForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    state.reviews.unshift({
      id: uid('r'), author: fd.get('author'), car: fd.get('car'),
      rating: Number(fd.get('rating')), text: fd.get('text')
    });
    const phone = String(fd.get('phone') || '').trim();
    const gift = String(fd.get('reviewGift') || 'cash');
    save(); event.currentTarget.reset(); render();
    if (phone.replace(/\D/g, '').length >= 9 && typeof window.requestReviewCoupon === 'function') {
      window.requestReviewCoupon(phone, gift).then((result) => {
        if (!result?.ok) { toast('후기가 등록되었습니다.'); return; }
        toast(result.duplicated
          ? `이미 발급된 리뷰 쿠폰이 있습니다 — ${result.label} (${result.code})`
          : `후기 감사합니다! ${result.label} 쿠폰(${result.code})이 발급되었습니다. 예약할 때 번호를 입력하세요.`);
      });
      return;
    }
    toast('후기가 등록되었습니다.');
  });

  // 예약 폼 — supabase-integration.js 가 먼저 처리하므로 여기선 조용히 패스
  // (stopImmediatePropagation 으로 이미 차단됨)

  // 파트너 폼
  const partnerForm = document.querySelector('#partnerForm');
  if (partnerForm) partnerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const message = `[집앞세차-앳홈 카케어 입점문의]\n성함: ${fd.get('name')}\n연락처: ${fd.get('phone')}\n희망 지역: ${fd.get('area')}\n세차 경력: ${fd.get('career')}\n보유 장비·차량: ${fd.get('equipment') || '없음'}\n문의사항: ${fd.get('memo') || '없음'}`;
    const box = document.querySelector('#partnerResult');
    if (box) {
      box.classList.remove('hidden');
      box.innerHTML = `<pre>${esc(message)}</pre><div class="actions">
        <button class="secondary-btn" id="copyPartner">문의내용 복사</button>
        <a class="secondary-btn button-link" href="tel:${digits(state.settings.phone)}">전화하기</a>
        <a class="primary-btn button-link" href="sms:${digits(state.settings.phone)}">문자 보내기</a>
        <a class="primary-btn button-link" href="${state.settings.kakaoUrl || 'https://pf.kakao.com/_gpDrX'}" target="_blank" rel="noopener">카카오채널 열기</a>
      </div>`;
      document.querySelector('#copyPartner').onclick = () =>
        navigator.clipboard?.writeText(message)
          .then(() => toast('입점문의 내용을 복사했습니다.'))
          .catch(() => toast('복사 기능을 사용할 수 없습니다.'));
    }
    toast('입점문의 내용이 준비되었습니다.');
  });

  // 운영 정보 저장
  const settingsForm = document.querySelector('#settingsForm');
  if (settingsForm) settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    state.settings = { phone: fd.get('phone'), kakaoUrl: fd.get('kakaoUrl'), area: fd.get('area') };
    save(); renderSettings();
    toast('업체 설정을 저장했습니다.');
  });

  // 세차 전·후 사진 추가 (관리자 화면에 galleryForm 이 있을 때만)
  const galleryForm = document.querySelector('#galleryForm');
  if (galleryForm) galleryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const before = form.before.files[0];
    const after = form.after.files[0];
    if (!before || !after) return;
    try {
      const [beforeData, afterData] = await Promise.all([compressFile(before), compressFile(after)]);
      state.gallery.unshift({
        id: uid('g'), title: form.title.value,
        note: form.note ? form.note.value : '', before: beforeData, after: afterData
      });
      save(); form.reset(); render();
      toast('세차 전후 사진을 등록했습니다.');
    } catch (error) {
      console.error(error);
      toast('이미지 등록 중 오류가 발생했습니다.');
    }
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const btn = document.querySelector('#installBtn');
    if (btn) btn.classList.remove('hidden');
  });

  const installBtn = document.querySelector('#installBtn');
  if (installBtn) installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });
}


/* ── 제조사 · 모델 선택 + 차종 구분 자동 지정 ─────────────────── */
const CAR_DB = [
  ['현대', [['캐스퍼','경차·소형'], ['아반떼','준중형 세단'], ['쏘나타','중형·준대형 세단'], ['그랜저','중형·준대형 세단'], ['아이오닉5','중형 SUV'], ['아이오닉6','중형·준대형 세단'], ['아이오닉9','대형 SUV'], ['베뉴','소형 SUV'], ['코나','소형 SUV'], ['투싼','중형 SUV'], ['싼타페','중형 SUV'], ['넥쏘','중형 SUV'], ['팰리세이드','대형 SUV'], ['스타리아','대형 MPV·특대형'], ['포터','화물·탑차'], ['포터 일렉트릭','화물·탑차']]],
  ['기아', [['모닝','경차·소형'], ['레이','경차·소형'], ['K3','준중형 세단'], ['K5','중형·준대형 세단'], ['K8','중형·준대형 세단'], ['K9','대형 세단'], ['스팅어','중형·준대형 세단'], ['EV3','소형 SUV'], ['셀토스','소형 SUV'], ['니로','소형 SUV'], ['EV6','중형 SUV'], ['스포티지','중형 SUV'], ['쏘렌토','중형 SUV'], ['EV9','대형 SUV'], ['모하비','대형 SUV'], ['카니발','대형 MPV·특대형'], ['봉고','화물·탑차'], ['봉고 EV','화물·탑차']]],
  ['제네시스', [['G70','준중형 세단'], ['G80','중형·준대형 세단'], ['G90','대형 세단'], ['GV60','소형 SUV'], ['GV70','중형 SUV'], ['GV80','대형 SUV']]],
  ['KG모빌리티(쌍용)', [['티볼리','소형 SUV'], ['코란도','소형 SUV'], ['액티언','중형 SUV'], ['토레스','중형 SUV'], ['렉스턴','대형 SUV'], ['렉스턴 스포츠','대형 SUV']]],
  ['르노코리아', [['SM6','중형·준대형 세단'], ['XM3·아르카나','소형 SUV'], ['캡처','소형 SUV'], ['QM6','중형 SUV'], ['그랑 콜레오스','중형 SUV']]],
  ['쉐보레', [['스파크','경차·소형'], ['말리부','중형·준대형 세단'], ['트랙스 크로스오버','소형 SUV'], ['트레일블레이저','소형 SUV'], ['이쿼녹스','중형 SUV'], ['트래버스','대형 SUV'], ['콜로라도','대형 MPV·특대형'], ['타호','수입 대형·프리미엄']]],
  ['메르세데스-벤츠', [['A클래스','준중형 세단'], ['CLA','준중형 세단'], ['C클래스','중형·준대형 세단'], ['E클래스','중형·준대형 세단'], ['CLS','중형·준대형 세단'], ['EQE','중형·준대형 세단'], ['S클래스','대형 세단'], ['EQS','대형 세단'], ['마이바흐','대형 세단'], ['GLA','소형 SUV'], ['GLB','중형 SUV'], ['GLC','중형 SUV'], ['EQA','소형 SUV'], ['GLE','대형 SUV'], ['GLS','수입 대형·프리미엄'], ['V클래스','대형 MPV·특대형']]],
  ['BMW', [['1시리즈','준중형 세단'], ['2시리즈','준중형 세단'], ['3시리즈','준중형 세단'], ['4시리즈','중형·준대형 세단'], ['5시리즈','중형·준대형 세단'], ['6시리즈','중형·준대형 세단'], ['i4','중형·준대형 세단'], ['i5','중형·준대형 세단'], ['7시리즈','대형 세단'], ['8시리즈','대형 세단'], ['i7','대형 세단'], ['X1','소형 SUV'], ['X2','소형 SUV'], ['X3','중형 SUV'], ['X4','중형 SUV'], ['X5','대형 SUV'], ['X6','대형 SUV'], ['iX','대형 SUV'], ['X7','수입 대형·프리미엄']]],
  ['아우디', [['A3','준중형 세단'], ['A4','준중형 세단'], ['A5','중형·준대형 세단'], ['A6','중형·준대형 세단'], ['A7','중형·준대형 세단'], ['e-트론 GT','중형·준대형 세단'], ['A8','대형 세단'], ['Q2','소형 SUV'], ['Q3','소형 SUV'], ['Q4 e-트론','중형 SUV'], ['Q5','중형 SUV'], ['Q7','대형 SUV'], ['Q8','대형 SUV']]],
  ['폭스바겐', [['폴로','경차·소형'], ['골프','준중형 세단'], ['제타','준중형 세단'], ['파사트','중형·준대형 세단'], ['아테온','중형·준대형 세단'], ['티록','소형 SUV'], ['티구안','중형 SUV'], ['ID.4','중형 SUV'], ['투아렉','대형 SUV']]],
  ['볼보', [['S60','중형·준대형 세단'], ['S90','중형·준대형 세단'], ['V60','중형·준대형 세단'], ['EX30','소형 SUV'], ['XC40','소형 SUV'], ['XC60','중형 SUV'], ['XC90','대형 SUV'], ['EX90','대형 SUV']]],
  ['테슬라', [['모델3','중형·준대형 세단'], ['모델Y','중형 SUV'], ['모델S','대형 세단'], ['모델X','대형 SUV']]],
  ['렉서스', [['IS','준중형 세단'], ['ES','중형·준대형 세단'], ['LS','대형 세단'], ['UX','소형 SUV'], ['NX','중형 SUV'], ['RX','대형 SUV'], ['LM','대형 MPV·특대형']]],
  ['토요타', [['코롤라','준중형 세단'], ['프리우스','준중형 세단'], ['캠리','중형·준대형 세단'], ['크라운','중형·준대형 세단'], ['RAV4','중형 SUV'], ['하이랜더','대형 SUV'], ['시에나','대형 MPV·특대형'], ['알파드','대형 MPV·특대형']]],
  ['혼다', [['시빅','준중형 세단'], ['어코드','중형·준대형 세단'], ['CR-V','중형 SUV'], ['파일럿','대형 SUV'], ['오딧세이','대형 MPV·특대형']]],
  ['포르쉐', [['911','중형·준대형 세단'], ['타이칸','중형·준대형 세단'], ['파나메라','대형 세단'], ['마칸','중형 SUV'], ['카이엔','대형 SUV']]],
  ['MINI', [['쿠퍼','경차·소형'], ['클럽맨','준중형 세단'], ['컨트리맨','소형 SUV']]],
  ['랜드로버', [['레인지로버 이보크','소형 SUV'], ['디스커버리 스포츠','중형 SUV'], ['레인지로버 벨라','중형 SUV'], ['디스커버리','대형 SUV'], ['디펜더','대형 SUV'], ['레인지로버 스포츠','대형 SUV'], ['레인지로버','수입 대형·프리미엄']]],
  ['지프', [['레니게이드','소형 SUV'], ['컴패스','중형 SUV'], ['랭글러','중형 SUV'], ['체로키','중형 SUV'], ['그랜드 체로키','대형 SUV']]],
  ['포드', [['머스탱','중형·준대형 세단'], ['브롱코','대형 SUV'], ['익스플로러','대형 SUV'], ['익스페디션','수입 대형·프리미엄'], ['F-150','대형 MPV·특대형']]],
  ['링컨', [['노틸러스','중형 SUV'], ['에비에이터','대형 SUV'], ['내비게이터','수입 대형·프리미엄']]],
  ['캐딜락', [['CT4','준중형 세단'], ['CT5','중형·준대형 세단'], ['CT6','대형 세단'], ['XT4','소형 SUV'], ['XT5','중형 SUV'], ['XT6','대형 SUV'], ['에스컬레이드','수입 대형·프리미엄']]],
  ['마세라티', [['기블리','중형·준대형 세단'], ['콰트로포르테','대형 세단'], ['그레칼레','중형 SUV'], ['르반떼','대형 SUV']]],
  ['푸조', [['208','경차·소형'], ['308','준중형 세단'], ['2008','소형 SUV'], ['3008','중형 SUV'], ['5008','대형 SUV']]],
  ['BYD', [['돌핀','경차·소형'], ['아토3','소형 SUV'], ['씰','중형·준대형 세단']]],
  ['폴스타', [['폴스타2','중형·준대형 세단'], ['폴스타4','중형 SUV']]],
];


/* ── 예상 금액 계산 ───────────────────────────────────────────── */
const PRICE_TABLE = {
  '경차·소형':        { '월 4회': 60000, '월 2회': 45000, '일일 외부세차': 20000, '외부+내부세차': 35000 },
  '준중형 세단':      { '월 4회': 65000, '월 2회': 49000, '일일 외부세차': 25000, '외부+내부세차': 38000 },
  '중형·준대형 세단': { '월 4회': 69000, '월 2회': 55000, '일일 외부세차': 28000, '외부+내부세차': 40000 },
  '대형 세단':        { '월 4회': 75000, '월 2회': 59000, '일일 외부세차': 32000, '외부+내부세차': 45000 },
  '소형 SUV':         { '월 4회': 69000, '월 2회': 55000, '일일 외부세차': 28000, '외부+내부세차': 40000 },
  '중형 SUV':         { '월 4회': 75000, '월 2회': 59000, '일일 외부세차': 32000, '외부+내부세차': 45000 },
  '대형 SUV':         { '월 4회': 89000, '월 2회': 69000, '일일 외부세차': 34000, '외부+내부세차': 48000 },
  '대형 MPV·특대형':  { '월 4회': 99000, '월 2회': 79000, '일일 외부세차': 35000, '외부+내부세차': 50000 },
  '수입 대형·프리미엄': { '월 4회': 109000, '월 2회': 89000, '일일 외부세차': 40000, '외부+내부세차': 55000 },
  '화물·탑차':        { '월 4회': 110000, '월 2회': 85000, '일일 외부세차': 45000, '외부+내부세차': 60000 },
};
/* 추가 옵션 — 차량 크기별 [소형, 중형, 대형] */
const OPTION_PRICES = {
  '휠 철분·집중세정':   [10000, 12000, 15000],
  '고급 왁스·실런트':   [20000, 25000, 30000],
  '실내 진공·먼지관리': [15000, 18000, 22000],
  '실내 집중세차':      [30000, 35000, 45000],
  '트렁크 청소':        [10000, 10000, 15000],
  '벌레·타르 제거':     [10000, 12000, 15000],
};
const SIZE_OF_CLASS = {
  '경차·소형': 0, '준중형 세단': 0,
  '중형·준대형 세단': 1, '대형 세단': 1, '소형 SUV': 1, '중형 SUV': 1,
  '대형 SUV': 2, '대형 MPV·특대형': 2, '수입 대형·프리미엄': 2, '화물·탑차': 2,
};
const SIZE_LABEL = ['소형', '중형', '대형'];
/* 화물·탑차는 캡 실내가 좁아 실내 옵션만 중형 요금 적용 */
const INTERIOR_OPTIONS = new Set(['실내 진공·먼지관리', '실내 집중세차']);
function optionSize(name, cls) {
  if (cls === '화물·탑차' && INTERIOR_OPTIONS.has(name)) return 1;
  return SIZE_OF_CLASS[cls] ?? 0;
}
function optionPrice(name, cls) {
  const tiers = OPTION_PRICES[name];
  if (!tiers) return 0;
  return tiers[optionSize(name, cls)];
}
const won = (n) => `${n.toLocaleString('ko-KR')}원`;

function buildQuote(form) {
  const cls = form.querySelector('#carClassHidden')?.value || form.querySelector('#carClassSelect')?.value || '';
  const svc = form.querySelector('[name="service"]')?.value || '';
  const car = form.querySelector('#carHidden')?.value || '';
  const options = Array.from(form.querySelectorAll('[name="options"]:checked')).map((el) => el.value);

  const picked = form.querySelector('[name="promo"]:checked');
  const key = picked ? picked.value : '';
  const promos = [];
  if (key.startsWith('promo:')) {
    const promo = (state.promos || DEFAULT_PROMOS).find((item) => item.id === key.slice(6));
    if (promo) promos.push({ label: promoLabel(promo), amount: promo.amount || 0, gift: promo.gift || '' });
  } else if (key.startsWith('coupon:')) {
    const coupon = (window.__myCoupons || []).find((item) => item.code === key.slice(7));
    if (coupon) promos.push({ label: `${coupon.label} (${coupon.code})`, amount: coupon.amount || 0, gift: coupon.gift || '' });
  }

  const base = PRICE_TABLE[cls] ? PRICE_TABLE[cls][svc] : undefined;
  const lines = [];
  if (base) lines.push([`${svc} (${cls})`, base]);
  options.forEach((name) => lines.push([name, optionPrice(name, cls)]));
  promos.forEach((promo) => lines.push([promo.label, -(promo.amount || 0), promo.gift || (promo.amount ? '' : '혜택 제공')]));

  const monthly = svc === '월 2회' || svc === '월 4회';
  const total = Math.max(0, lines.reduce((sum, [, price]) => sum + price, 0));
  const ready = Boolean(base);
  const discount = promos.reduce((sum, promo) => sum + (promo.amount || 0), 0);
  return { car, cls, svc, lines, total, monthly, ready, options, promos, discount };
}

function refreshOptionChips(form) {
  const cls = form.querySelector('#carClassHidden')?.value || form.querySelector('#carClassSelect')?.value || '';
  const known = cls in SIZE_OF_CLASS;
  form.querySelectorAll('[name="options"]').forEach((box) => {
    const chip = box.closest('label');
    // 화물·탑차는 트렁크가 없어 트렁크 청소 옵션 숨김 (적재함은 별도 견적)
    const hide = cls === '화물·탑차' && box.value === '트렁크 청소';
    if (chip) chip.classList.toggle('hidden', hide);
    if (hide) box.checked = false;
    const small = chip?.querySelector('small');
    if (!small || !OPTION_PRICES[box.value]) return;
    small.textContent = known
      ? `+${won(optionPrice(box.value, cls))} (${SIZE_LABEL[optionSize(box.value, cls)]})`
      : `+${won(OPTION_PRICES[box.value][0])}~`;
  });
}

function renderQuote(form) {
  refreshOptionChips(form);
  const linesEl = form.querySelector('#quoteLines');
  const totalEl = form.querySelector('#quoteTotal');
  const labelEl = form.querySelector('#quoteTotalLabel');
  const carEl   = form.querySelector('#quoteCar');
  if (!linesEl || !totalEl) return;

  const q = buildQuote(form);
  carEl.textContent = q.car ? `${q.car}${q.cls ? ` · ${q.cls}` : ''}` : '차량을 선택해주세요';
  labelEl.textContent = q.monthly ? '합계 (월 기준)' : '합계';

  if (!q.lines.length) {
    linesEl.innerHTML = '<li class="quote-empty">차종 구분과 희망 서비스를 선택하면 금액이 계산됩니다.</li>';
    totalEl.textContent = '-';
    return;
  }
  linesEl.innerHTML = q.lines
    .map(([name, price, gift]) => {
      const value = gift && !price ? gift : `${price < 0 ? '-' : ''}${won(Math.abs(price))}`;
      return `<li class="${price < 0 || gift ? 'quote-discount' : ''}"><span>${esc(name)}</span><b>${esc(value)}</b></li>`;
    })
    .join('');
  totalEl.textContent = q.ready ? won(q.total) : `${won(q.total)} + 세차 요금 상담`;
}

function bindBookingExtras() {
  const form = document.querySelector('#bookingForm');
  if (!form || form.dataset.extrasReady) return;
  form.dataset.extrasReady = '1';

  const brandSel  = form.querySelector('#carBrandSelect');
  const modelSel  = form.querySelector('#carModelSelect');
  const customWrap = form.querySelector('#carCustomWrap');
  const customInput = form.querySelector('#carCustomInput');
  const hiddenCar = form.querySelector('#carHidden');
  const classSel  = form.querySelector('#carClassSelect');
  const hint      = form.querySelector('#carClassHint');
  if (!brandSel || !modelSel || !hiddenCar || !classSel) return;

  brandSel.innerHTML = '<option value="">제조사를 선택하세요</option>'
    + CAR_DB.map(([brand]) => `<option value="${brand}">${brand}</option>`).join('')
    + '<option value="기타">기타 (직접 입력)</option>';

  const ETC = '기타 (직접 입력)';

  function fillModels() {
    const entry = CAR_DB.find(([brand]) => brand === brandSel.value);
    if (!brandSel.value) {
      modelSel.innerHTML = '<option value="">제조사를 먼저 선택하세요</option>';
    } else if (!entry) {
      modelSel.innerHTML = `<option value="${ETC}">${ETC}</option>`;
      modelSel.value = ETC;
    } else {
      modelSel.innerHTML = '<option value="">모델을 선택하세요</option>'
        + entry[1].map(([model, cls]) => `<option value="${model}" data-class="${cls}">${model}</option>`).join('')
        + `<option value="${ETC}">${ETC}</option>`;
    }
    syncCar();
  }

  const classHidden = form.querySelector('#carClassHidden');

  function setCarClass(value, locked) {
    classSel.value = value;
    classSel.disabled = locked;
    if (classHidden) classHidden.value = value;
  }

  function syncCar() {
    const brand = brandSel.value;
    const model = modelSel.value;
    const isEtc = !brand || model === ETC || (brand === '기타');
    customWrap.classList.toggle('hidden', !isEtc || !brand);
    customInput.required = isEtc && !!brand;

    if (isEtc) {
      const typed = (customInput.value || '').trim();
      hiddenCar.value = typed ? (brand && brand !== '기타' ? `${brand} ${typed}` : typed) : '';
      setCarClass(classSel.value, false);
      if (hint) hint.textContent = '차종 구분을 직접 선택해주세요';
      return;
    }
    hiddenCar.value = model ? `${brand} ${model}` : '';

    const picked = modelSel.selectedOptions[0];
    const cls = picked ? picked.dataset.class || '' : '';
    setCarClass(cls, Boolean(cls));
    if (hint) hint.textContent = cls ? `자동 선택: ${cls}` : '모델을 고르면 자동으로 선택됩니다';
  }

  classSel.addEventListener('change', () => {
    if (classHidden) classHidden.value = classSel.value;
  });
  brandSel.addEventListener('change', fillModels);
  modelSel.addEventListener('change', syncCar);
  customInput.addEventListener('input', syncCar);

  const svcSel = form.querySelector('[name="service"]');
  const promoField = form.querySelector('#promoField');
  const promoGrid = form.querySelector('#promoGrid');

  function benefitChoices() {
    const svc = svcSel ? svcSel.value : '';
    const list = (state.promos || DEFAULT_PROMOS)
      .filter((promo) => promo.auto && autoBenefits[promo.auto])
      .filter((promo) => !promo.services || !promo.services.length || promo.services.includes(svc))
      .map((promo) => ({
        key: `promo:${promo.id}`,
        label: promoLabel(promo),
        amount: promo.amount || 0,
        gift: promo.gift || '',
        auto: true,
      }));
    const coupons = myCoupons
      .filter((coupon) => !Array.isArray(coupon.services) || !coupon.services.length || coupon.services.includes(svc))
      .map((coupon) => ({
      key: `coupon:${coupon.code}`,
      label: `${coupon.label} (${coupon.code})`,
      amount: coupon.amount || 0,
      gift: coupon.gift || '',
      auto: false,
    }));
    return [...list, ...coupons];
  }

  function renderPromoOptions() {
    if (!promoGrid) return;
    const choices = benefitChoices();
    if (!choices.some((choice) => choice.key === selectedBenefit)) selectedBenefit = '';
    const rows = [{ key: '', label: '혜택 사용 안 함', amount: 0, gift: '', auto: false }, ...choices];
    promoGrid.innerHTML = rows.map((row) => {
      const badge = row.key === ''
        ? ''
        : `<small>${row.amount ? `-${row.amount.toLocaleString('ko-KR')}원` : (row.gift || '혜택 제공')}${row.auto ? ' <em class="auto-mark">자동 확인</em>' : ''}</small>`;
      return `<label class="opt-chip promo-chip"><input type="radio" name="promo" value="${esc(row.key)}"${row.key === selectedBenefit ? ' checked' : ''}><span>${esc(row.label)}${badge}</span></label>`;
    }).join('');
  }

  promoGrid?.addEventListener('change', (event) => {
    const picked = event.target.closest('[name="promo"]');
    if (picked) { selectedBenefit = picked.value; renderQuote(form); }
  });

  form.querySelector('#couponCode')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      form.querySelector('#couponCheck')?.click();
    }
  });

  form.querySelector('#couponCheck')?.addEventListener('click', async () => {
    const input = form.querySelector('#couponCode');
    const msg = form.querySelector('#couponMsg');
    const code = (input.value || '').trim().toUpperCase();
    if (!code) return;
    msg.textContent = '확인 중…';
    msg.className = 'coupon-msg';
    const result = await (window.checkCoupon ? window.checkCoupon(code) : Promise.resolve(null));
    if (!result) { msg.textContent = '쿠폰 확인 기능을 사용할 수 없습니다. 전화로 문의해주세요.'; return; }
    if (!result.valid) { msg.textContent = result.reason || '사용할 수 없는 쿠폰입니다.'; msg.className = 'coupon-msg bad'; return; }
    if (!myCoupons.some((coupon) => coupon.code === result.code)) myCoupons.push(result);
    window.__myCoupons = myCoupons;
    const svcNow = svcSel ? svcSel.value : '';
    const usable = !Array.isArray(result.services) || !result.services.length || result.services.includes(svcNow);
    if (!usable) {
      msg.textContent = `이 쿠폰은 ${result.services.join(' · ')}에만 사용할 수 있습니다. 희망 서비스를 바꿔주세요.`;
      msg.className = 'coupon-msg bad';
      renderPromoOptions();
      return;
    }
    selectedBenefit = `coupon:${result.code}`;
    msg.textContent = `${result.label} 쿠폰이 적용되었습니다.`;
    msg.className = 'coupon-msg good';
    input.value = '';
    renderPromoOptions();
    renderQuote(form);
  });

  window.addEventListener('coupons:update', (event) => {
    myCoupons = Array.isArray(event.detail) ? event.detail : [];
    window.__myCoupons = myCoupons;
    renderPromoOptions();
    renderQuote(form);
  });

  window.addEventListener('benefits:update', (event) => {
    autoBenefits = { ...autoBenefits, ...(event.detail || {}) };
    renderPromoOptions();
    renderQuote(form);
  });

  const refreshQuote = () => renderQuote(form);
  if (svcSel) svcSel.addEventListener('change', () => { renderPromoOptions(); renderQuote(form); });
  form.addEventListener('change', refreshQuote);
  form.addEventListener('input', refreshQuote);

  form.addEventListener('reset', () => setTimeout(() => {
    fillModels();
    if (hint) hint.textContent = '모델을 고르면 자동으로 선택됩니다';
  }, 0));

  fillModels();
  renderPromoOptions();
  renderQuote(form);
}

async function init() {
  await loadPublished();
  state = loadLocal();
  restorePublishedSectionsOnce();
  bindEvents();
  render();
  bindBookingExtras();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () =>
      navigator.serviceWorker.register('./service-worker.js').catch(console.warn)
    );
  }
}

init();

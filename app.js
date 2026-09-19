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

function normalize(data = {}) {
  const base = publishedState || {
    settings: { phone: '010-8391-8999', area: '경산 중산지구 · 사월동 · 시지 · 신매동 · 대구 전지역' },
    gallery: [], reviews: [], tips: [], inquiries: []
  };
  return {
    settings: { ...base.settings, ...(data.settings || {}) },
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
    if (form.area) form.area.value = state.settings.area || '';
  }
  const phone = state.settings.phone || '010-8391-8999';
  document.querySelectorAll('[data-phone-text]').forEach((el) => { el.textContent = phone; });
  document.querySelectorAll('[data-call]').forEach((el) => { el.href = `tel:${digits(phone)}`; });
  document.querySelectorAll('[data-sms]').forEach((el) => { el.href = `sms:${digits(phone)}`; });
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
    save(); event.currentTarget.reset(); render();
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
    state.settings = { phone: fd.get('phone'), area: fd.get('area') };
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
  ['현대', [['캐스퍼','경차·소형'], ['아반떼','준중형 세단'], ['쏘나타','중형·준대형 세단'], ['그랜저','중형·준대형 세단'], ['아이오닉5','중형 SUV'], ['아이오닉6','중형·준대형 세단'], ['아이오닉9','대형 SUV'], ['베뉴','소형 SUV'], ['코나','소형 SUV'], ['투싼','중형 SUV'], ['싼타페','중형 SUV'], ['넥쏘','중형 SUV'], ['팰리세이드','대형 SUV'], ['스타리아','대형 MPV·특대형'], ['포터','대형 MPV·특대형']]],
  ['기아', [['모닝','경차·소형'], ['레이','경차·소형'], ['K3','준중형 세단'], ['K5','중형·준대형 세단'], ['K8','중형·준대형 세단'], ['K9','대형 세단'], ['스팅어','중형·준대형 세단'], ['EV3','소형 SUV'], ['셀토스','소형 SUV'], ['니로','소형 SUV'], ['EV6','중형 SUV'], ['스포티지','중형 SUV'], ['쏘렌토','중형 SUV'], ['EV9','대형 SUV'], ['모하비','대형 SUV'], ['카니발','대형 MPV·특대형'], ['봉고','대형 MPV·특대형']]],
  ['제네시스', [['G70','준중형 세단'], ['G80','중형·준대형 세단'], ['G90','대형 세단'], ['GV60','소형 SUV'], ['GV70','중형 SUV'], ['GV80','대형 SUV']]],
  ['KG모빌리티(쌍용)', [['티볼리','소형 SUV'], ['코란도','소형 SUV'], ['액티언','중형 SUV'], ['토레스','중형 SUV'], ['렉스턴','대형 SUV'], ['렉스턴 스포츠','대형 SUV']]],
  ['르노코리아', [['SM6','중형·준대형 세단'], ['XM3·아르카나','소형 SUV'], ['캡처','소형 SUV'], ['QM6','중형 SUV'], ['그랑 콜레오스','중형 SUV']]],
  ['쉐보레', [['스파크','경차·소형'], ['말리부','중형·준대형 세단'], ['트랙스 크로스오버','소형 SUV'], ['트레일블레이저','소형 SUV'], ['이쿼녹스','중형 SUV'], ['트래버스','대형 SUV'], ['콜로라도','대형 MPV·특대형'], ['타호','대형 MPV·특대형']]],
  ['메르세데스-벤츠', [['A클래스','준중형 세단'], ['CLA','준중형 세단'], ['C클래스','중형·준대형 세단'], ['E클래스','중형·준대형 세단'], ['CLS','중형·준대형 세단'], ['EQE','중형·준대형 세단'], ['S클래스','대형 세단'], ['EQS','대형 세단'], ['마이바흐','대형 세단'], ['GLA','소형 SUV'], ['GLB','중형 SUV'], ['GLC','중형 SUV'], ['EQA','소형 SUV'], ['GLE','대형 SUV'], ['GLS','대형 MPV·특대형'], ['V클래스','대형 MPV·특대형']]],
  ['BMW', [['1시리즈','준중형 세단'], ['2시리즈','준중형 세단'], ['3시리즈','준중형 세단'], ['4시리즈','중형·준대형 세단'], ['5시리즈','중형·준대형 세단'], ['6시리즈','중형·준대형 세단'], ['i4','중형·준대형 세단'], ['i5','중형·준대형 세단'], ['7시리즈','대형 세단'], ['8시리즈','대형 세단'], ['i7','대형 세단'], ['X1','소형 SUV'], ['X2','소형 SUV'], ['X3','중형 SUV'], ['X4','중형 SUV'], ['X5','대형 SUV'], ['X6','대형 SUV'], ['iX','대형 SUV'], ['X7','대형 MPV·특대형']]],
  ['아우디', [['A3','준중형 세단'], ['A4','준중형 세단'], ['A5','중형·준대형 세단'], ['A6','중형·준대형 세단'], ['A7','중형·준대형 세단'], ['e-트론 GT','중형·준대형 세단'], ['A8','대형 세단'], ['Q2','소형 SUV'], ['Q3','소형 SUV'], ['Q4 e-트론','중형 SUV'], ['Q5','중형 SUV'], ['Q7','대형 SUV'], ['Q8','대형 SUV']]],
  ['폭스바겐', [['폴로','경차·소형'], ['골프','준중형 세단'], ['제타','준중형 세단'], ['파사트','중형·준대형 세단'], ['아테온','중형·준대형 세단'], ['티록','소형 SUV'], ['티구안','중형 SUV'], ['ID.4','중형 SUV'], ['투아렉','대형 SUV']]],
  ['볼보', [['S60','중형·준대형 세단'], ['S90','중형·준대형 세단'], ['V60','중형·준대형 세단'], ['EX30','소형 SUV'], ['XC40','소형 SUV'], ['XC60','중형 SUV'], ['XC90','대형 SUV'], ['EX90','대형 SUV']]],
  ['테슬라', [['모델3','중형·준대형 세단'], ['모델Y','중형 SUV'], ['모델S','대형 세단'], ['모델X','대형 SUV']]],
  ['렉서스', [['IS','준중형 세단'], ['ES','중형·준대형 세단'], ['LS','대형 세단'], ['UX','소형 SUV'], ['NX','중형 SUV'], ['RX','대형 SUV'], ['LM','대형 MPV·특대형']]],
  ['토요타', [['코롤라','준중형 세단'], ['프리우스','준중형 세단'], ['캠리','중형·준대형 세단'], ['크라운','중형·준대형 세단'], ['RAV4','중형 SUV'], ['하이랜더','대형 SUV'], ['시에나','대형 MPV·특대형'], ['알파드','대형 MPV·특대형']]],
  ['혼다', [['시빅','준중형 세단'], ['어코드','중형·준대형 세단'], ['CR-V','중형 SUV'], ['파일럿','대형 SUV'], ['오딧세이','대형 MPV·특대형']]],
  ['포르쉐', [['911','중형·준대형 세단'], ['타이칸','중형·준대형 세단'], ['파나메라','대형 세단'], ['마칸','중형 SUV'], ['카이엔','대형 SUV']]],
  ['MINI', [['쿠퍼','경차·소형'], ['클럽맨','준중형 세단'], ['컨트리맨','소형 SUV']]],
  ['랜드로버', [['레인지로버 이보크','소형 SUV'], ['디스커버리 스포츠','중형 SUV'], ['레인지로버 벨라','중형 SUV'], ['디스커버리','대형 SUV'], ['디펜더','대형 SUV'], ['레인지로버 스포츠','대형 SUV'], ['레인지로버','대형 MPV·특대형']]],
  ['지프', [['레니게이드','소형 SUV'], ['컴패스','중형 SUV'], ['랭글러','중형 SUV'], ['체로키','중형 SUV'], ['그랜드 체로키','대형 SUV']]],
  ['포드', [['머스탱','중형·준대형 세단'], ['브롱코','대형 SUV'], ['익스플로러','대형 SUV'], ['익스페디션','대형 MPV·특대형'], ['F-150','대형 MPV·특대형']]],
  ['링컨', [['노틸러스','중형 SUV'], ['에비에이터','대형 SUV'], ['내비게이터','대형 MPV·특대형']]],
  ['캐딜락', [['CT4','준중형 세단'], ['CT5','중형·준대형 세단'], ['CT6','대형 세단'], ['XT4','소형 SUV'], ['XT5','중형 SUV'], ['XT6','대형 SUV'], ['에스컬레이드','대형 MPV·특대형']]],
  ['마세라티', [['기블리','중형·준대형 세단'], ['콰트로포르테','대형 세단'], ['그레칼레','중형 SUV'], ['르반떼','대형 SUV']]],
  ['푸조', [['208','경차·소형'], ['308','준중형 세단'], ['2008','소형 SUV'], ['3008','중형 SUV'], ['5008','대형 SUV']]],
  ['BYD', [['돌핀','경차·소형'], ['아토3','소형 SUV'], ['씰','중형·준대형 세단']]],
  ['폴스타', [['폴스타2','중형·준대형 세단'], ['폴스타4','중형 SUV']]],
];

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

  function syncCar() {
    const brand = brandSel.value;
    const model = modelSel.value;
    const isEtc = !brand || model === ETC || (brand === '기타');
    customWrap.classList.toggle('hidden', !isEtc || !brand);
    customInput.required = isEtc && !!brand;

    if (isEtc) {
      const typed = (customInput.value || '').trim();
      hiddenCar.value = typed ? (brand && brand !== '기타' ? `${brand} ${typed}` : typed) : '';
      if (hint) hint.textContent = '차종 구분을 직접 선택해주세요';
      return;
    }
    hiddenCar.value = model ? `${brand} ${model}` : '';

    const picked = modelSel.selectedOptions[0];
    const cls = picked ? picked.dataset.class || '' : '';
    if (classSel.dataset.manual !== '1') {
      classSel.value = cls;
      if (hint) hint.textContent = cls ? `자동 선택: ${cls} (다르면 직접 바꾸세요)` : '모델을 고르면 자동으로 선택됩니다';
    }
  }

  classSel.addEventListener('change', () => {
    classSel.dataset.manual = classSel.value ? '1' : '';
    if (hint) hint.textContent = classSel.value ? '직접 선택한 구분이 적용됩니다' : '모델을 고르면 자동으로 선택됩니다';
  });
  brandSel.addEventListener('change', fillModels);
  modelSel.addEventListener('change', syncCar);
  customInput.addEventListener('input', syncCar);

  form.addEventListener('reset', () => setTimeout(() => {
    classSel.dataset.manual = '';
    fillModels();
    if (hint) hint.textContent = '모델을 고르면 자동으로 선택됩니다';
  }, 0));

  fillModels();
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

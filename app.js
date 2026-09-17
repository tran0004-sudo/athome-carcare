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
    settings: { phone: '010-8391-8999', kakaoUrl: '', area: '경산 중산지구 · 사월동 · 시지 · 신매동 · 대구 전지역' },
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
    form.kakaoUrl.value = state.settings.kakaoUrl || '';
    if (form.area) form.area.value = state.settings.area || '';
  }
  const phone = state.settings.phone || '010-8391-8999';
  document.querySelectorAll('[data-phone-text]').forEach((el) => { el.textContent = phone; });
  document.querySelectorAll('[data-call]').forEach((el) => { el.href = `tel:${digits(phone)}`; });
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

    const kakaoButton = event.target.closest('[data-kakao]');
    if (kakaoButton) {
      if (state.settings.kakaoUrl) window.open(state.settings.kakaoUrl, '_blank', 'noopener');
      else toast('카카오채널 주소는 관리 화면에서 설정할 수 있습니다.');
      return;
    }

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
        <button class="primary-btn" id="openPartnerKakao">카카오채널 열기</button>
      </div>`;
      document.querySelector('#copyPartner').onclick = () =>
        navigator.clipboard?.writeText(message)
          .then(() => toast('입점문의 내용을 복사했습니다.'))
          .catch(() => toast('복사 기능을 사용할 수 없습니다.'));
      document.querySelector('#openPartnerKakao').onclick = () => {
        if (state.settings.kakaoUrl) window.open(state.settings.kakaoUrl, '_blank', 'noopener');
        else toast('카카오채널 주소는 관리 화면에서 설정해주세요.');
      };
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

async function init() {
  await loadPublished();
  state = loadLocal();
  restorePublishedSectionsOnce();
  bindEvents();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () =>
      navigator.serviceWorker.register('./service-worker.js').catch(console.warn)
    );
  }
}

init();

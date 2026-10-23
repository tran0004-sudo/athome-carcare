/* ============================================================
   앳홈카케어 요금 — 요금은 이 파일 한 곳에서만 고칩니다.
   ------------------------------------------------------------
   여기 숫자를 바꾸면 아래가 모두 따라 바뀝니다.
     · 예약 화면 예상 금액, 추가 옵션 칩, 월세차 절약 계산 (app.js)
     · 요금 탭 차종별 목록·추가 옵션·관리 안내 금액 (index.html)
     · 요금 페이지 표 (price.html)
     · 검색엔진용 HTML 기본값·"28,000원부터" 문구
       (GitHub Actions "sync-prices"가 자동으로 다시 씀)
   ※ 차종별 전체 요금표 이미지(assets/info/price-table.jpg)는
     그림이라 따로 새로 만들어 올려야 합니다.

   화면에 숫자를 넣을 때는 HTML에 data-p(무엇) · data-pf(모양)를 붙입니다.
     data-p="경차|월 4회"                 차종 | 상품
     data-p="from:경차"                   차종의 가장 싼 일일세차
     data-p="save4:중형 SUV"              월 4회로 아끼는 금액 (save2: 월 2회)
     data-p="opt:발수코팅"                옵션 (소형 기준, 또는 sizes/range 모양)
     data-p="opt:발수코팅|1"              옵션 크기별 (0 소형 · 1 중형 · 2 대형)
     data-p="optc:월세차 고급 업그레이드|경차"  옵션을 그 차종 크기로
     data-p="resin:보통"                  송진 단계별 (resin = 전체 단계)
     data-p="glassbundle:"                전체 유리 유막+발수 묶음가 (sizes / sizeswon, 또는 glassbundle:0 크기별)
     data-p="plusreg:경차"                고급을 따로 할 때 금액 (기본 + 왁스 + 가죽시트 코팅 정가)
     data-p="plussave:경차"               고급 세차로 아끼는 금액  (premsave: 프리미엄)
     data-p="premreg:경차"               프리미엄을 따로 할 때 금액 (위 금액 + 유막·발수 정가)
     data-p="rate:고급 세차"              그 상품의 옵션 할인율 (20%)
   data-pf: won(28,000원) · man(2.8만원) · mans(2.8만)
            앞에 + 를 붙이면 +, 뒤에 ~ 를 붙이면 ~ 가 붙습니다.
            opt 전용: sizes(소형 2만 · 중형 2.5만 · 대형 3만)
                      sizeswon(소형 20,000원 · …) · +range(+20,000~30,000원)
            resin 전용: levels(가벼움 1만 · 보통 2만 · 심함 별도)
                        levelswon(가벼움 10,000원 · 보통 20,000원 · 심함 현장 견적)
   ============================================================ */
(function (root) {
  'use strict';

  /* 차종별 기본 요금 (원) */
  var TABLE = {
    '경차':        { '월 4회': 80000,  '월 2회': 58000,  '일일 외부세차': 28000, '외부+내부세차': 46000, '고급 세차': 58000 },
    '소형 세단':   { '월 4회': 81000,  '월 2회': 59000,  '일일 외부세차': 30000, '외부+내부세차': 47000, '고급 세차': 63000 },
    '중형 세단':   { '월 4회': 82000,  '월 2회': 61000,  '일일 외부세차': 33000, '외부+내부세차': 48000, '고급 세차': 71000 },
    '대형 세단':   { '월 4회': 84000,  '월 2회': 65000,  '일일 외부세차': 37000, '외부+내부세차': 52000, '고급 세차': 75000 },
    '소형 SUV':    { '월 4회': 85000,  '월 2회': 67000,  '일일 외부세차': 33000, '외부+내부세차': 54000, '고급 세차': 71000 },
    '중형 SUV':    { '월 4회': 87000,  '월 2회': 69000,  '일일 외부세차': 37000, '외부+내부세차': 57000, '고급 세차': 75000 },
    '대형 SUV':    { '월 4회': 91000,  '월 2회': 74000,  '일일 외부세차': 39000, '외부+내부세차': 65000, '고급 세차': 83000 },
    '프리미엄 SUV': { '월 4회': 105000, '월 2회': 84000,  '일일 외부세차': 45000, '외부+내부세차': 70000, '고급 세차': 90000 },
    '미니밴':      { '월 4회': 120000, '월 2회': 102000, '일일 외부세차': 49000, '외부+내부세차': 75000, '고급 세차': 90000 },
    /* 승합 — 좌석이 많아 시트·레일 청소가 힘들고 차체가 큰 만큼 미니밴보다 높게 */
    '승합 9인승':  { '월 4회': 130000, '월 2회': 112000, '일일 외부세차': 52000, '외부+내부세차': 85000, '고급 세차': 100000 },
    '승합 11·12인승': { '월 4회': 145000, '월 2회': 125000, '일일 외부세차': 55000, '외부+내부세차': 100000, '고급 세차': 115000 }
  };

  /* 추가 옵션 — 차량 크기별 [소형, 중형, 대형] (원) */
  var OPTIONS = {
    '휠 철분·집중세정':       [10000, 12000, 15000],
    '고급 왁스코팅':          [20000, 25000, 30000],
    '가죽시트 코팅':          [15000, 18000, 22000],   // 고급·프리미엄 세차에는 포함
    '월세차 고급 업그레이드': [20000, 25000, 30000],   // 월세차 매달 1회 고급 세차 업그레이드
    '실내 집중세차':          [15000, 18000, 22000],
    '트렁크 청소':            [10000, 10000, 15000],
    '벌레·타르·스티커 제거':  [10000, 12000, 15000],
    '유리 유막제거':          [15000, 18000, 22000],
    '발수코팅':               [20000, 25000, 30000],
    '유리 유막제거 (전체)':   [35000, 45000, 55000],   // 전면·옆·뒷유리 (선루프 제외)
    '발수코팅 (전체)':        [45000, 55000, 65000],   // 전면·옆·뒷유리 (선루프 제외)
    '엔진룸 클리닝':          [20000, 25000, 30000],
    '송진 제거':              [10000, 10000, 10000]    // 예상 금액은 가벼움 기준 — 단계별 요금은 아래 RESIN
  };

  /* 상위 상품을 고르면 추가 옵션 할인 (할인한 금액은 1,000원 단위로 내림)
     숫자만 바꾸면 예약 화면·카드 문구가 모두 따라 바뀝니다. 0 이면 할인 없음. */
  var OPTION_DISCOUNT = { '고급 세차': 0.1, '프리미엄 세차': 0.15, '월 2회': 0.1, '월 4회': 0.1 };
  /* 프리미엄에 포함된 전면 유막제거·발수코팅 할인율 — 고급 세차 할인율과 같게 둬야
     "프리미엄 ≤ 고급 + 같은 옵션" 과 "프리미엄 > 기본 + 같은 옵션" 순서가 지켜집니다. */
  var PREMIUM_GLASS_RATE = 0.1;
  /* 할인하지 않는 옵션 (현장 견적이거나 월세차 전용 업그레이드) */
  var NO_DISCOUNT = ['송진 제거', '월세차 고급 업그레이드', '프리미엄 전체 유리 업그레이드'];

  /* 전체 유리: 유막제거(전체) + 발수코팅(전체)를 함께 고르면 묶음가 [소형, 중형, 대형] (원)
     묶음가에는 상품 할인(고급·월세차·프리미엄)을 중복 적용하지 않습니다. */
  var GLASS_FULL = ['유리 유막제거 (전체)', '발수코팅 (전체)'];
  var GLASS_FULL_BUNDLE = [70000, 85000, 100000];
  /* 전면 ↔ 전체 짝 (둘 중 하나만 고를 수 있음) */
  var GLASS_PAIRS = { '유리 유막제거': '유리 유막제거 (전체)', '발수코팅': '발수코팅 (전체)' };

  /* 고급 세차에 포함된 옵션 — "따로 하면" 비교용 (기본 세차 + 이 옵션들 정가) */
  var PLUS_ADDS = ['고급 왁스코팅', '가죽시트 코팅'];

  /* 프리미엄 세차 = 고급 세차 + 아래 옵션들을 프리미엄 할인율로 묶은 요금 (자동 계산) */
  var PREMIUM_ADDS = ['유리 유막제거', '발수코팅'];

  /* 송진 제거 단계별 (원) — 심함은 현장 견적 */
  var RESIN = { '가벼움': 10000, '보통': 20000 };

  /* 차종 → 옵션 크기 (0 소형 · 1 중형 · 2 대형) */
  var SIZE_OF_CLASS = {
    '경차': 0, '소형 세단': 0,
    '중형 세단': 1, '대형 세단': 1, '소형 SUV': 1, '중형 SUV': 1,
    '대형 SUV': 2, '프리미엄 SUV': 2, '미니밴': 2, '승합 9인승': 2, '승합 11·12인승': 2
  };
  var SIZE_LABEL = ['소형', '중형', '대형'];

  function floor1000(n) { return Math.floor(n / 1000) * 1000; }

  /* 프리미엄 전체 유리 업그레이드 = 전체 묶음가 − 전면 유막·발수 정가 */
  OPTIONS['프리미엄 전체 유리 업그레이드'] = [0, 1, 2].map(function (k) {
    var diff = GLASS_FULL_BUNDLE[k] - (OPTIONS['유리 유막제거'][k] + OPTIONS['발수코팅'][k]);
    return diff;   // 묶음가에서 이미 할인됐으므로 차액 그대로 (중복 할인 없음)
  });

  /* 옵션 할인율 (상품 기준) */
  function optionRate(name, svc) {
    if (NO_DISCOUNT.indexOf(name) >= 0) return 0;
    return OPTION_DISCOUNT[svc] || 0;
  }
  /* 차종·상품에 맞는 옵션 요금 (할인 적용) */
  function optionFor(name, cls, svc) {
    var t = OPTIONS[name]; if (!t) return NaN;
    var base = t[SIZE_OF_CLASS[cls] != null ? SIZE_OF_CLASS[cls] : 0];
    var rate = optionRate(name, svc);
    return rate ? floor1000(base * (1 - rate)) : base;
  }

  /* 전체 유리 묶음가 (차종·상품 할인 반영) */
  function glassBundleFor(cls, svc) {
    var k = SIZE_OF_CLASS[cls] != null ? SIZE_OF_CLASS[cls] : 0;
    return GLASS_FULL_BUNDLE[k];   // 묶음가 자체가 할인가 — 상품 할인은 중복 적용하지 않음
  }

  /* 프리미엄 세차 요금을 차종마다 채움 (고급 세차 + 유막제거·발수코팅을 프리미엄 할인율로)
     "따로 하면" 비교용 금액 (모두 정가):
       PLUS_REGULAR    = 기본 세차(외부+내부) + 고급 왁스코팅 + 가죽시트 코팅
       PREMIUM_REGULAR = PLUS_REGULAR + 유리 유막제거 + 발수코팅 */
  var PLUS_REGULAR = {}, PREMIUM_REGULAR = {};
  function sumOpts(names, sz) { return names.reduce(function (sum, name) { return sum + OPTIONS[name][sz]; }, 0); }
  Object.keys(TABLE).forEach(function (cls) {
    var sz = SIZE_OF_CLASS[cls];
    var adds = sumOpts(PREMIUM_ADDS, sz);
    PLUS_REGULAR[cls] = TABLE[cls]['외부+내부세차'] + sumOpts(PLUS_ADDS, sz);
    PREMIUM_REGULAR[cls] = PLUS_REGULAR[cls] + adds;
    TABLE[cls]['프리미엄 세차'] = TABLE[cls]['고급 세차'] + floor1000(adds * (1 - PREMIUM_GLASS_RATE));
  });

  /* ── 계산 ─────────────────────────────────────────────── */
  function dailyFrom(cls) {
    var p = TABLE[cls]; if (!p) return NaN;
    return Math.min(p['일일 외부세차'], p['외부+내부세차'], p['고급 세차']);
  }
  function monthlySave(cls, times) {
    var p = TABLE[cls]; if (!p) return NaN;
    var daily = times === 4 ? p['일일 외부세차'] * 3 + p['외부+내부세차'] : p['일일 외부세차'] + p['외부+내부세차'];
    return daily - p[times === 4 ? '월 4회' : '월 2회'];
  }

  /* ── 모양 ─────────────────────────────────────────────── */
  function comma(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function man(n) { return String(Math.round(n / 1000) / 10).replace(/\.0$/, ''); }
  function fmt(n, pf) {
    pf = pf || 'won';
    var plus = pf.charAt(0) === '+'; if (plus) pf = pf.slice(1);
    var tilde = pf.slice(-1) === '~'; if (tilde) pf = pf.slice(0, -1);
    var s = pf === 'man' ? man(n) + '만원' : pf === 'mans' ? man(n) + '만' : comma(n) + '원';
    return (plus ? '+' : '') + s + (tilde ? '~' : '');
  }

  /* data-p · data-pf → 글자. 알 수 없는 키면 null (화면 글자를 그대로 둠) */
  function text(key, pf) {
    if (!key) return null;
    var i = key.indexOf(':'), kind = i < 0 ? 'cls' : key.slice(0, i), rest = i < 0 ? key : key.slice(i + 1);
    var parts = rest.split('|'), v;
    if (kind === 'cls') { v = TABLE[parts[0]] && TABLE[parts[0]][parts[1]]; return v == null ? null : fmt(v, pf); }
    if (kind === 'optsum') {   /* data-p="optsum:유리 유막제거+발수코팅" — 여러 옵션 합계 (sizes 모양) */
      var names2 = rest.split('+'), sums = [0, 1, 2].map(function (k) {
        return names2.reduce(function (acc, n) { return acc + (OPTIONS[n] ? OPTIONS[n][k] : NaN); }, 0);
      });
      if (sums.some(isNaN)) return null;
      return SIZE_LABEL.map(function (l, k) { return l + ' ' + fmt(sums[k], 'mans'); }).join(' · ');
    }
    if (kind === 'glassbundle') {   /* data-p="glassbundle:" sizes 모양 · "glassbundle:1" 크기별 */
      if (parts[0] !== '') return GLASS_FULL_BUNDLE[+parts[0]] == null ? null : fmt(GLASS_FULL_BUNDLE[+parts[0]], pf || 'mans');
      return SIZE_LABEL.map(function (l, k) { return l + ' ' + fmt(GLASS_FULL_BUNDLE[k], pf === 'sizeswon' ? 'won' : 'mans'); }).join(' · ');
    }
    if (kind === 'plusreg') { v = PLUS_REGULAR[parts[0]]; return v == null ? null : fmt(v, pf); }
    if (kind === 'plussave') { v = PLUS_REGULAR[parts[0]] - (TABLE[parts[0]] || {})['고급 세차']; return isNaN(v) ? null : fmt(v, pf); }
    if (kind === 'premsave') { v = PREMIUM_REGULAR[parts[0]] - (TABLE[parts[0]] || {})['프리미엄 세차']; return isNaN(v) ? null : fmt(v, pf); }
    if (kind === 'premreg') { v = PREMIUM_REGULAR[parts[0]]; return v == null ? null : fmt(v, pf); }
    if (kind === 'rate') { v = parts[0] === '프리미엄 포함 유리' ? PREMIUM_GLASS_RATE : OPTION_DISCOUNT[parts[0]]; return v == null ? null : Math.round(v * 100) + '%'; }
    if (kind === 'from') { v = dailyFrom(parts[0]); return isNaN(v) ? null : fmt(v, pf || 'man~'); }
    if (kind === 'save4' || kind === 'save2') { v = monthlySave(parts[0], kind === 'save4' ? 4 : 2); return isNaN(v) ? null : fmt(v, pf); }
    if (kind === 'opt') {
      var t = OPTIONS[parts[0]]; if (!t) return null;
      if (parts.length > 1) return t[+parts[1]] == null ? null : fmt(t[+parts[1]], pf || 'mans');
      if (pf === 'sizes') return SIZE_LABEL.map(function (l, k) { return l + ' ' + fmt(t[k], 'mans'); }).join(' · ');
      if (pf === 'sizeswon') return SIZE_LABEL.map(function (l, k) { return l + ' ' + fmt(t[k], 'won'); }).join(' · ');
      if (pf === '+range' || pf === 'range') {
        var lo = Math.min.apply(null, t), hi = Math.max.apply(null, t);
        return (pf === '+range' ? '+' : '') + (lo === hi ? fmt(lo, 'won') : comma(lo) + '~' + comma(hi) + '원');
      }
      return fmt(Math.min.apply(null, t), pf);
    }
    if (kind === 'optc') {
      var o = OPTIONS[parts[0]], sz = SIZE_OF_CLASS[parts[1]];
      return o && sz != null ? fmt(o[sz], pf) : null;
    }
    if (kind === 'resin') {
      if (parts[0]) return RESIN[parts[0]] == null ? null : fmt(RESIN[parts[0]], pf);
      var names = Object.keys(RESIN);
      if (pf === 'levelswon') return names.map(function (n) { return n + ' ' + fmt(RESIN[n], 'won'); }).join(' · ') + ' · 심함 현장 견적';
      return names.map(function (n) { return n + ' ' + fmt(RESIN[n], 'mans'); }).join(' · ') + ' · 심함 별도';
    }
    return null;
  }

  /* 화면 안의 data-p 를 모두 현재 요금으로 채움 */
  function render(scope) {
    var els = (scope || document).querySelectorAll('[data-p]');
    for (var k = 0; k < els.length; k++) {
      var s = text(els[k].getAttribute('data-p'), els[k].getAttribute('data-pf'));
      if (s != null && els[k].textContent !== s) els[k].textContent = s;
    }
  }

  var api = {
    TABLE: TABLE, OPTIONS: OPTIONS, RESIN: RESIN,
    GLASS_FULL: GLASS_FULL, GLASS_FULL_BUNDLE: GLASS_FULL_BUNDLE, GLASS_PAIRS: GLASS_PAIRS, glassBundleFor: glassBundleFor,
    PREMIUM_ADDS: PREMIUM_ADDS, PREMIUM_REGULAR: PREMIUM_REGULAR, PLUS_ADDS: PLUS_ADDS, PLUS_REGULAR: PLUS_REGULAR,
    OPTION_DISCOUNT: OPTION_DISCOUNT, PREMIUM_GLASS_RATE: PREMIUM_GLASS_RATE, NO_DISCOUNT: NO_DISCOUNT, optionRate: optionRate, optionFor: optionFor,
    SIZE_OF_CLASS: SIZE_OF_CLASS, SIZE_LABEL: SIZE_LABEL,
    dailyFrom: dailyFrom, monthlySave: monthlySave, fmt: fmt, text: text, render: render
  };
  root.AHC_PRICES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { render(document); });
    else render(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);

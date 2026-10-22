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
    '미니밴':      { '월 4회': 120000, '월 2회': 102000, '일일 외부세차': 49000, '외부+내부세차': 75000, '고급 세차': 90000 }
  };

  /* 추가 옵션 — 차량 크기별 [소형, 중형, 대형] (원) */
  var OPTIONS = {
    '휠 철분·집중세정':       [10000, 12000, 15000],
    '고급 왁스코팅':          [20000, 25000, 30000],
    '월세차 고급 업그레이드': [20000, 25000, 30000],   // 월세차 매달 1회 고급 세차 업그레이드
    '실내 집중세차':          [15000, 18000, 22000],
    '트렁크 청소':            [10000, 10000, 15000],
    '벌레·타르·스티커 제거':  [10000, 12000, 15000],
    '유리 유막제거':          [15000, 18000, 22000],
    '발수코팅':               [20000, 25000, 30000],
    '엔진룸 클리닝':          [20000, 25000, 30000],
    '송진 제거':              [10000, 10000, 10000]    // 예상 금액은 가벼움 기준 — 단계별 요금은 아래 RESIN
  };

  /* 프리미엄 세차 = 고급 세차 + 아래 옵션들 (차량 크기별 옵션 요금을 더해 자동 계산)
     묶음 할인을 주려면 PREMIUM_DISCOUNT 에 차종 공통 할인 금액(원)을 넣으세요. 0 이면 합계 그대로. */
  var PREMIUM_ADDS = ['유리 유막제거', '발수코팅'];
  var PREMIUM_DISCOUNT = 0;

  /* 송진 제거 단계별 (원) — 심함은 현장 견적 */
  var RESIN = { '가벼움': 10000, '보통': 20000 };

  /* 차종 → 옵션 크기 (0 소형 · 1 중형 · 2 대형) */
  var SIZE_OF_CLASS = {
    '경차': 0, '소형 세단': 0,
    '중형 세단': 1, '대형 세단': 1, '소형 SUV': 1, '중형 SUV': 1,
    '대형 SUV': 2, '프리미엄 SUV': 2, '미니밴': 2
  };
  var SIZE_LABEL = ['소형', '중형', '대형'];

  /* 프리미엄 세차 요금을 차종마다 채움 (고급 세차 + 유막제거 + 발수코팅 − 묶음 할인) */
  Object.keys(TABLE).forEach(function (cls) {
    var sz = SIZE_OF_CLASS[cls];
    var adds = PREMIUM_ADDS.reduce(function (sum, name) { return sum + OPTIONS[name][sz]; }, 0);
    TABLE[cls]['프리미엄 세차'] = TABLE[cls]['고급 세차'] + adds - PREMIUM_DISCOUNT;
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
    PREMIUM_ADDS: PREMIUM_ADDS, PREMIUM_DISCOUNT: PREMIUM_DISCOUNT,
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

#!/usr/bin/env node
/* 요금 동기화 — prices.js 값으로 HTML의 기본 글자(검색엔진·느린 로딩용)를 다시 씁니다.
   사용:  node scripts/sync-prices.js          → 파일을 고침
          node scripts/sync-prices.js --check  → 다른 곳이 있으면 목록을 보여주고 실패
   GitHub Actions(sync-prices.yml)가 prices.js가 바뀔 때마다 자동 실행합니다. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = undefined;
const P = require(path.join(ROOT, 'prices.js'));
const CHECK = process.argv.includes('--check');
const FILES = ['index.html', 'price.html'];

const won = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const minDaily = Math.min(...Object.keys(P.TABLE).map((c) => P.dailyFrom(c)));

let problems = [];
let changed = 0;

for (const file of FILES) {
  const fp = path.join(ROOT, file);
  const before = fs.readFileSync(fp, 'utf8');
  let after = before;

  // 1) data-p 가 붙은 요소의 글자 (안에 다른 태그가 없는 요소만)
  after = after.replace(/(<(\w+)\b[^>]*\bdata-p="([^"]*)"[^>]*>)([^<]*)(<\/\2>)/g, (all, open, tag, key, inner, close) => {
    const pfm = open.match(/\bdata-pf="([^"]*)"/);
    const want = P.text(key, pfm ? pfm[1] : null);
    if (want == null) { problems.push(`${file}: 알 수 없는 요금 키 data-p="${key}"`); return all; }
    if (inner !== want) problems.push(`${file}: ${key} — "${inner}" → "${want}"`);
    return open + want + close;
  });

  // 2) 검색엔진용 "최저가" 문구
  after = after.replace(/"priceRange":"₩[\d,]+~"/g, (m) => {
    const want = `"priceRange":"₩${won(minDaily)}~"`;
    if (m !== want) problems.push(`${file}: priceRange ${m} → ${want}`);
    return want;
  });
  after = after.replace(/외부세차 ([\d,]+)원부터/g, (m, n) => {
    const want = `외부세차 ${won(minDaily)}원부터`;
    if (m !== want) problems.push(`${file}: "${m}" → "${want}"`);
    return want;
  });

  if (after !== before) {
    changed++;
    if (!CHECK) fs.writeFileSync(fp, after);
  }
}

if (CHECK) {
  if (problems.length) {
    console.error('요금이 prices.js와 다른 곳:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  console.log('요금 일치 — 모든 화면이 prices.js와 같습니다.');
} else {
  console.log(changed ? `요금 동기화: ${changed}개 파일 갱신 (${problems.length}곳)` : '요금 동기화: 바꿀 곳 없음');
  if (problems.some((p) => p.includes('알 수 없는'))) process.exit(1);
}

#!/usr/bin/env node
/* 서비스워커 미리 저장 목록 맞추기
   index.html이 실제로 불러오는 css·js·manifest·아이콘의 ?v= 버전을 service-worker.js 목록에 그대로 반영합니다.
   목록이 바뀌면 캐시 이름 번호도 1 올려서, 설치된 앱이 옛 캐시를 지우고 새로 받게 합니다.
   사용:  node scripts/sync-sw.js          → 고침
          node scripts/sync-sw.js --check  → 다르면 목록을 보여주고 실패 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const swPath = path.join(ROOT, 'service-worker.js');
const sw = fs.readFileSync(swPath, 'utf8');

// index.html이 부르는 버전 붙은 파일들: 경로 → 전체 주소
const used = new Map();
for (const m of html.matchAll(/(?:href|src)="([^"?#]+\.(?:css|js|webmanifest|png))\?v=([^"]+)"/g)) {
  used.set(m[1], `${m[1]}?v=${m[2]}`);
}

const start = sw.indexOf('const ASSETS = [');
const end = sw.indexOf('];', start);
if (start < 0 || end < 0) { console.error('service-worker.js에서 ASSETS 목록을 찾지 못했습니다.'); process.exit(1); }
const list = sw.slice(start, end);

const changes = [];
const fixed = list.replace(/'\.\/([^'?]+)\?v=([^']+)'/g, (all, file, ver) => {
  const want = used.get(file);
  if (!want) return all;                      // 화면이 안 쓰는 파일(예: 다른 페이지 전용)은 그대로
  if (`${file}?v=${ver}` === want) return all;
  changes.push(`${file}?v=${ver} → ${want}`);
  return `'./${want}'`;
});

// 화면이 부르는 css·js 중 목록에 없는 것
const missing = [...used.keys()].filter((f) => /\.(css|js)$/.test(f) && !list.includes(`./${f}?`));

if (CHECK) {
  if (changes.length || missing.length) {
    console.error('서비스워커 목록이 화면과 다릅니다:\n  ' + [...changes, ...missing.map((f) => `목록에 없음: ${f}`)].join('\n  '));
    process.exit(1);
  }
  console.log('서비스워커 목록 일치');
  process.exit(0);
}

let out = sw.slice(0, start) + fixed + sw.slice(end);
if (missing.length) {
  out = out.replace("const ASSETS = [", "const ASSETS = [\n  " + missing.map((f) => `'./${used.get(f)}'`).join(', ') + ',');
}
if (out !== sw) {
  out = out.replace(/const CACHE = 'athome-carcare-v(\d+)';/, (m, n) => `const CACHE = 'athome-carcare-v${Number(n) + 1}';`);
  fs.writeFileSync(swPath, out);
  console.log('서비스워커 목록 갱신:\n  ' + [...changes, ...missing.map((f) => `추가: ${f}`)].join('\n  '));
} else {
  console.log('서비스워커 목록: 바꿀 곳 없음');
}

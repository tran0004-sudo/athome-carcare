#!/usr/bin/env node
/* sitemap.xml의 <lastmod>를 각 페이지 파일이 마지막으로 바뀐 날짜(git 기록)로 맞춥니다.
   사용:  node scripts/sync-sitemap.js          → 고침
          node scripts/sync-sitemap.js --check  → 다르면 보여주고 실패 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const fp = path.join(ROOT, 'sitemap.xml');
const xml = fs.readFileSync(fp, 'utf8');
const BASE = 'https://tran0004-sudo.github.io/athome-carcare/';

const changes = [];
const out = xml.replace(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g, (all, loc, old) => {
  const rel = loc.startsWith(BASE) ? loc.slice(BASE.length) : '';
  const file = rel === '' ? 'index.html' : rel;
  if (!fs.existsSync(path.join(ROOT, file))) return all;
  let date = '';
  try { date = execSync(`git log -1 --format=%cs -- "${file}"`, { cwd: ROOT }).toString().trim(); } catch (e) { /* git 없음 */ }
  if (!date || date === old) return all;
  changes.push(`${file}: ${old} → ${date}`);
  return `<url><loc>${loc}</loc><lastmod>${date}</lastmod>`;
});

if (CHECK) {
  if (changes.length) { console.error('sitemap 날짜가 다릅니다:\n  ' + changes.join('\n  ')); process.exit(1); }
  console.log('sitemap 날짜 일치');
} else if (changes.length) {
  fs.writeFileSync(fp, out);
  console.log('sitemap 날짜 갱신:\n  ' + changes.join('\n  '));
} else {
  console.log('sitemap: 바꿀 곳 없음');
}

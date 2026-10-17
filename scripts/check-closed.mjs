// '좌표를 못 찾은' 식당의 폐업 의심 여부를 점검한다 — 읽기 전용(Firestore 쓰기 없음)
//   node scripts/check-closed.mjs data/candidates/backfill-coords-2026-10-10.json          조회 + 분류
//   node scripts/check-closed.mjs --reclassify data/candidates/closed-check-날짜.json       저장된 원본 결과로 분류만 다시(재조회 없음)
// 1) 카카오 키워드 검색을 이름 변형으로 재시도(서울 범위)  2) 구글 장소 검색의 business_status 조회(키가 있을 때)
// 구글 결과는 영업 상태 판단에만 쓰고 좌표·평점은 저장하지 않는다. 원본 결과를 파일에 남겨 재조회 없이 재분류할 수 있다.
import fs from 'fs';
import { normName } from './lib/evidence.mjs';
import { sameName, hasGeocoder, KAKAO, ENV } from './lib/geocode.mjs';

const RECLASS = process.argv.includes('--reclassify');
const file = process.argv.filter(a => !a.startsWith('--'))[2];
if (!file) { console.error('사용법: node scripts/check-closed.mjs [--reclassify] <json>'); process.exit(1); }

const AREA = /(성수|대치|개포|강남|한남|청담|압구정|역삼|논현|신사|홍대|합정|망원|이태원|잠실|서울숲|도곡|삼성|선릉|양재|서초|반포|용산|마포|종로|명동|가로수길|연남|건대|여의도)/;
const parts = name => {                                   // 지점 토큰과 핵심 상호 분리
  const clean = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const t = clean.split(' ');
  const last = t[t.length - 1];
  const hasBranch = t.length > 1 && (/점$/.test(last) || AREA.test(last));
  return { core: hasBranch ? t.slice(0, -1).join(' ') : clean, branch: hasBranch ? last.replace(/점$/, '') : '' };
};
// 같은 매장인가: 상호 일치 + (지점이 있으면 결과에 그 지점명이 들어 있어야 함)
const samePlace = (title, address, name) => {
  const { core, branch } = parts(name);
  if (!sameName(title, core) && !sameName(title, name)) return false;
  return !branch || normName(title + ' ' + address).includes(normName(branch));
};
const coreHit = (title, name) => sameName(title, parts(name).core);   // 브랜드는 같지만 지점이 다를 수 있음

function classify(r) {
  const g = (r.google || []);
  const gSame = g.find(x => samePlace(x.name, x.address, r.name));
  const kSame = (r.kakao || []).find(x => samePlace(x.title, x.address, r.name));
  if (gSame?.business === 'CLOSED_PERMANENTLY') return ['폐업(구글 영구 폐업)', gSame.name + ' | ' + gSame.address];
  if (gSame?.business === 'CLOSED_TEMPORARILY') return ['임시 휴업(구글)', gSame.name + ' | ' + gSame.address];
  if (kSame || gSame) return ['영업 중(같은 매장 확인)', kSame ? kSame.title + ' | ' + kSame.address : gSame.name + ' | ' + gSame.address];
  const other = (r.kakao || []).find(x => coreHit(x.title, r.name)) || g.find(x => coreHit(x.name, r.name));
  if (other) return ['해당 지점 미확인(다른 지점만 검색됨)', (other.title || other.name) + ' | ' + other.address];
  const near = g[0] || (r.kakao || [])[0];
  return ['폐업 의심(검색 결과 없음)', near ? `유사 후보: ${near.title || near.name}` : ''];
}

let data;
if (RECLASS) data = JSON.parse(fs.readFileSync(file, 'utf8'));
else {
  const none = JSON.parse(fs.readFileSync(file, 'utf8')).none;
  if (!hasGeocoder()) { console.error('좌표 조회 키 없음'); process.exit(1); }
  const G = ENV.GOOGLE_PLACES_KEY || '';          // 구글 키: .env.local 의 값 (출력·저장 안 함)
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const variants = name => {
    const { core } = parts(name); const noParen = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const eng = (name.match(/\(([A-Za-z0-9 .'&-]{3,})\)/) || name.match(/\s([A-Za-z][A-Za-z0-9 .'&-]{2,})$/) || [])[1];
    return [...new Set([name.trim(), noParen, noParen.replace(/\s+/g, ''), core, eng].filter(Boolean))].filter(x => normName(x).length >= 2);
  };
  data = [];
  for (const r of none) {
    const rec = { id: r.id, name: r.name, kakao: [], google: [] };
    if (KAKAO) for (const v of variants(r.name)) {
      try {
        const j = await (await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(v)}&size=5&rect=126.76,37.41,127.18,37.70`, { headers: { Authorization: `KakaoAK ${KAKAO}` } })).json();
        for (const d of j.documents || []) rec.kakao.push({ variant: v, title: d.place_name, address: d.road_address_name || d.address_name });
      } catch { /* 건너뜀 */ }
      await sleep(80);
    }
    if (G) try {
      const j = await (await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(r.name.replace(/\([^)]*\)/g, '') + ' 서울')}&language=ko&key=${G}`)).json();
      rec.google = (j.results || []).slice(0, 5).map(p => ({ name: p.name, address: p.formatted_address, business: p.business_status || '' }));   // 좌표·평점은 저장하지 않는다
    } catch { /* 건너뜀 */ }
    await sleep(120);
    data.push(rec);
  }
}
for (const r of data) [r.verdict, r.evidence] = classify(r);
const out = RECLASS ? file : `data/candidates/closed-check-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`대상 ${data.length}건`); console.log(JSON.stringify(data.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] || 0) + 1), a), {}), null, 2)); console.log('→', out);

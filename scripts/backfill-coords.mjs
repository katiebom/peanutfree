// 좌표가 없는 reviews 문서에 위도/경도를 채운다 — 기본은 미리보기(쓰기 없음)
//   node scripts/backfill-coords.mjs            → 조회만 하고 data/candidates/backfill-coords-날짜.json 에 결과 저장
//   node scripts/backfill-coords.mjs --apply    → '확실한' 매칭만 lat/lng(+빈 주소) 반영
// 확실한 매칭 = 상호가 일치하고, 기존 주소에 구/동 정보가 있으면 조회 결과 주소와도 같은 구/동. 애매하면 반영하지 않고 목록으로만 남긴다.
import admin from 'firebase-admin';
import fs from 'fs';
import { searchPlaces, sameName, exactName, hasGeocoder } from './lib/geocode.mjs';

const APPLY = process.argv.includes('--apply');
if (!hasGeocoder()) { console.error('좌표 조회 키가 없음: .env.local 에 KAKAO_REST_KEY 또는 NAVER_SEARCH_* 필요'); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const docs = (await db.collection('reviews').get()).docs.filter(d => { const x = d.data(); return x.lat == null || x.lng == null; });

// 주소에서 '구/군' 과 '동/읍/면' 토큰 추출 (예: 강남구, 개포동)
const areaTokens = a => (String(a || '').match(/[가-힣]+(?:구|군)(?![가-힣])|[가-힣]+(?:동|읍|면)(?![가-힣])/g) || []);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const out = { confident: [], ambiguous: [], none: [] };
for (const d of docs) {
  const x = d.data();
  const name = x.ko?.name || x.name || '';
  const have = areaTokens(x.address);
  const gu = have.find(t => /구$|군$/.test(t)) || '';
  const hits = (await searchPlaces(`${name} ${gu}`.trim())).filter(h => sameName(h.title, name));
  const row = { id: d.id, name, address: x.address || '', status: x.status };
  // 기존 주소가 있으면 같은 구/동인 후보만, 없으면 상호가 완전히 같은 후보가 하나뿐일 때만 확실
  let pick = null;
  if (have.length) {
    const same = hits.filter(h => areaTokens(h.address).some(t => have.includes(t)));
    if (same.length) pick = same.find(h => exactName(h.title, name)) || same[0];
  } else {
    const exact = hits.filter(h => exactName(h.title, name));
    if (exact.length === 1 && hits.length === 1) pick = exact[0];
  }
  if (pick) out.confident.push({ ...row, found: pick.title, foundAddress: pick.address, lat: pick.lat, lng: pick.lng });
  else if (hits.length) out.ambiguous.push({ ...row, candidates: hits.slice(0, 3).map(h => `${h.title} | ${h.address}`) });
  else out.none.push(row);
  await sleep(150);
}

const file = `data/candidates/backfill-coords-${new Date().toISOString().slice(0, 10)}.json`;
fs.mkdirSync('data/candidates', { recursive: true });
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`좌표 없는 문서 ${docs.length}건 | 확실 ${out.confident.length} | 애매 ${out.ambiguous.length} | 못 찾음 ${out.none.length}\n→ ${file}`);
if (!APPLY) { console.log('(미리보기) 쓰기 없음. 결과 확인 후 --apply'); process.exit(0); }

for (let i = 0; i < out.confident.length; i += 400) {
  const batch = db.batch();
  for (const c of out.confident.slice(i, i + 400)) {
    const upd = { lat: c.lat, lng: c.lng };
    if (!c.address) upd.address = c.foundAddress;           // 기존 주소는 덮어쓰지 않는다
    batch.update(db.collection('reviews').doc(c.id), upd);
  }
  await batch.commit();
}
console.log(`반영 완료: ${out.confident.length}건 (lat/lng)`);

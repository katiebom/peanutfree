// 검증 완료된 월간 데이터를 reviews(개별 매장) / brands(체인)에 'pending' 으로 올린다.
// 관리자 화면에서 승인해야 일반 사용자에게 보인다.
//   node scripts/apply-reviews.mjs data/verified/2026-11.json           → dry-run (기본, 쓰기 없음)
//   node scripts/apply-reviews.mjs data/verified/2026-11.json --apply   → pending 으로 업로드
// 좌표 조회: 네이버 지역 검색 API(NAVER_SEARCH_*) 우선, 없으면 카카오 로컬 검색(KAKAO_REST_KEY). 좌표는 WGS84 로 어느 쪽이든 동일하게 쓰인다.
// (앱 지도는 네이버지만 좌표 조회에는 제공자가 상관없다) 키가 없으면 좌표 없이 올리고 표시한다. 공용 모듈: scripts/lib/geocode.mjs
// 입력 형식: docs/ops/monthly-update.md
import admin from 'firebase-admin';
import fs from 'fs';
import { validateItem, normName, TIER_TO_RISK } from './lib/evidence.mjs';
import { geocode, hasGeocoder } from './lib/geocode.mjs';
import { loadLedger, saveLedger, keyOf, fingerprint, claudeDecision, appliedAlready } from './lib/ledger.mjs';

const file = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!file || file.startsWith('--')) { console.error('사용법: node scripts/apply-reviews.mjs <verified.json> [--apply]'); process.exit(1); }

const items = JSON.parse(fs.readFileSync(file, 'utf8')).restaurants || [];
const errors = items.flatMap((r, i) => validateItem(r, { allowUnknown: false }).map(m => `[${i}] ${r.name || '(이름없음)'}: ${m}`));
if (errors.length) { console.error(`검증 실패 ${errors.length}건 — 반영 중단 (아무것도 쓰지 않음)\n` + errors.join('\n')); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const [revSnap, brandSnap] = await Promise.all([db.collection('reviews').get(), db.collection('brands').get()]);
const have = {
  restaurant: new Map(revSnap.docs.map(d => [normName(d.data().ko?.name), d.id])),
  brand: new Map(brandSnap.docs.map(d => [normName(d.data().ko?.name), d.id])),
};

const reviewText = r => [`땅콩 사용: ${r.whyFlagged || '-'}`, `주문 시: ${r.recommendedAction || '-'}`, r.cautionOrExclusion && `주의: ${r.cautionOrExclusion}`].filter(Boolean).join('\n');
const meta = r => ({
  sourceUrl: r.sourceUrl || '', sourceKind: r.sourceKind || '', sourceQuote: r.sourceQuote || '', confidence: r.confidence,
  peanutRiskTier: r.peanutRiskTier, addedBy: 'monthly-pipeline', lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const L = loadLedger();
const plan = { create: [], dup: [], noCoord: [], applied: [], waitClaude: [], claudeRejected: [] };
for (const r of items) {
  r.fp = r.fp || fingerprint({ ...r, proposedTier: r.peanutRiskTier });
  if (appliedAlready(L, r)) { plan.applied.push(r.name); continue; }                       // 같은 내용으로 이미 올림
  if (r.needsClaudeReview) {                                                              // 🟢·🔴 은 Claude 확인 결정이 있어야 올린다
    const d = claudeDecision(L, r);
    if (!d) { plan.waitClaude.push(r.name); continue; }
    if (d.decision === 'reject') { plan.claudeRejected.push(r.name); continue; }
  }
  const route = r.route === 'brand' ? 'brand' : 'restaurant';
  const dupId = have[route].get(normName(r.name));
  if (dupId) { plan.dup.push(`${r.name} (${route}:${dupId})`); continue; }
  const risk = TIER_TO_RISK[r.peanutRiskTier];
  const ko = { name: r.name, cat: r.cuisineType };
  let doc;
  if (route === 'brand') {
    doc = { id: `pf-${String(r.geminiId || normName(r.name)).toLowerCase()}`, img: '🍽️', risk, src: r.sourceKind === 'official' ? 'official' : 'admin',
      ko: { ...ko, reason: r.whyFlagged || '', tags: [], note: [r.recommendedAction, r.cautionOrExclusion].filter(Boolean).join(' / ') }, status: 'pending', ...meta(r) };
    doc.en = doc.ko; // 번역 오류 방지: 영어 필드는 한국어 원문 그대로
  } else {
    const loc = await geocode(r.name, r.district);
    if (!loc) plan.noCoord.push(r.name);
    doc = { risk, address: loc?.address || r.address || '', lat: loc?.lat ?? null, lng: loc?.lng ?? null, rating: null, author: '관리자',
      src: r.sourceKind === 'official' ? 'official' : 'admin', cuisineType: r.cuisineType,
      ko: { ...ko, tags: [], review: reviewText(r) }, status: 'pending', submittedBy: 'monthly-pipeline', ...meta(r) };
    doc.en = doc.ko;
  }
  const ref = db.collection(route === 'brand' ? 'brands' : 'reviews').doc();
  if (route === 'brand') doc.id = ref.id; // 앱 목록은 {id: d.id, ...d.data()} 로 만들어 data.id 가 문서 ID 를 덮어쓴다 — 둘이 다르면 승인(updateDoc)이 not-found 로 실패
  plan.create.push({ route, doc, ref, key: keyOf(r), fp: r.fp, tier: r.peanutRiskTier });
}

const count = k => plan.create.filter(c => c.route === k).length;
console.log(`입력 ${items.length}건 | reviews ${count('restaurant')} | brands ${count('brand')} | 중복 제외 ${plan.dup.length}`);
plan.create.forEach(c => console.log(`  + [${c.route}] ${c.doc.ko.name}  ${c.doc.risk}  ${c.doc.lat ? '📍' : '좌표없음'}`));
if (plan.applied.length) console.log(`이미 반영됨(건너뜀) ${plan.applied.length}건`);
if (plan.waitClaude.length) console.log(`Claude 확인 대기 ${plan.waitClaude.length}건(반영 안 함): ${plan.waitClaude.join(', ')}`);
if (plan.claudeRejected.length) console.log(`Claude 확인에서 반려 ${plan.claudeRejected.length}건: ${plan.claudeRejected.join(', ')}`);
if (plan.dup.length) console.log('중복(기존에 있음):\n  ' + plan.dup.join('\n  '));
if (plan.noCoord.length) console.log(`좌표 못 찾음 ${plan.noCoord.length}건${hasGeocoder() ? '' : ' (NAVER_SEARCH_* / KAKAO_REST_KEY 모두 없음)'} — 지도에는 안 보이고 목록에만 표시됨`);
if (!APPLY) { console.log('\n(dry-run) 쓰기 없음. 확인 후 --apply 로 pending 업로드'); process.exit(0); }

const ts = admin.firestore.FieldValue.serverTimestamp();
const batch = db.batch();
plan.create.forEach(c => batch.set(c.ref, { ...c.doc, createdAt: ts }));
await batch.commit();
const today = new Date().toISOString().slice(0, 10);
for (const c of plan.create) {      // 장부에 반영 기록 — 같은 내용은 다음에 다시 올리지 않는다
  const e = L.entries[c.key] || (L.entries[c.key] = { key: c.key, name: c.doc.ko.name });
  e.applied = { id: c.ref.id, collection: c.route === 'brand' ? 'brands' : 'reviews', status: 'pending', tier: c.tier, fp: c.fp, on: today };
}
saveLedger(L);
console.log(`업로드 완료: ${plan.create.length}건 (status=pending) → 앱 관리자 화면에서 승인하세요`);

// [보조] 사용자 지도 추가용 restaurants 컬렉션 반영. 월간 파이프라인은 scripts/apply-reviews.mjs 를 쓴다
//   node scripts/apply-restaurants.mjs data/verified/2026-11.json          → dry-run (기본, 쓰기 없음)
//   node scripts/apply-restaurants.mjs data/verified/2026-11.json --apply  → 실제 반영
// 입력 형식은 docs/ops/monthly-update.md 참고. 규칙을 우회하는 admin SDK 로 쓰므로 검증을 여기서 한 번 더 한다.
import admin from 'firebase-admin';
import fs from 'fs';

const file = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!file || file.startsWith('--')) { console.error('사용법: node scripts/apply-restaurants.mjs <verified.json> [--apply]'); process.exit(1); }

import { validateItem } from './lib/evidence.mjs';

const input = JSON.parse(fs.readFileSync(file, 'utf8'));
const all = input.restaurants || [];
// 체인 브랜드(route=brand)는 brands 컬렉션(ko/en 구조)이라 이 스크립트 대상이 아니다
const items = all.filter(r => r.route !== 'brand');
if (all.length !== items.length) console.log(`brand 경로 ${all.length - items.length}건은 건너뜀 (brands 반영은 별도 처리)`);

// 검증: 하나라도 실패하면 아무것도 쓰지 않는다
const errors = items.flatMap((r, i) => validateItem(r).map(m => `[${i}] ${r.name || '(이름없음)'}: ${m}`));
if (errors.length) { console.error(`검증 실패 ${errors.length}건 — 반영 중단\n` + errors.join('\n')); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const col = db.collection('restaurants');
const existing = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const keyOf = r => r.placeId || `${r.name}|${r.branch || ''}`.replace(/\s+/g, '');
const byKey = new Map(existing.map(e => [keyOf(e), e]));

const FIELDS = ['name', 'branch', 'district', 'address', 'cuisineType', 'peanutRiskTier', 'allergyGuidanceLikelihood', 'whyFlagged',
  'recommendedAction', 'peanutHandlingBasis', 'recommendedSaferItems', 'cautionOrExclusion', 'confidence', 'isVerified',
  'placeId', 'sourceUrl', 'sourceKind', 'sourceQuote'];
const plan = { create: [], update: [], same: 0, downgradeWarn: [] };
for (const r of items) {
  const data = Object.fromEntries(FIELDS.filter(f => r[f] !== undefined).map(f => [f, r[f]]));
  data.isVerified = r.isVerified === true;
  const cur = byKey.get(keyOf(r));
  if (!cur) { plan.create.push({ data }); continue; }
  const diff = Object.keys(data).filter(k => JSON.stringify(data[k]) !== JSON.stringify(cur[k]) && !(data[k] === '' && cur[k] === undefined));
  if (!diff.length) { plan.same++; continue; }
  // 운영자가 확정(isVerified)한 문서의 위험도 변경은 반드시 눈으로 확인
  if (cur.isVerified && diff.includes('peanutRiskTier')) plan.downgradeWarn.push(`${cur.name}: ${cur.peanutRiskTier} → ${data.peanutRiskTier}`);
  plan.update.push({ id: cur.id, name: cur.name, diff: diff.map(k => `${k}: ${JSON.stringify(cur[k])} → ${JSON.stringify(data[k])}`), data });
}

console.log(`입력 ${items.length}건 | 신규 ${plan.create.length} | 변경 ${plan.update.length} | 동일 ${plan.same}`);
plan.create.forEach(c => console.log(`  + ${c.data.name} ${c.data.branch || ''} [${c.data.peanutRiskTier}/${c.data.confidence}]`));
plan.update.forEach(u => { console.log(`  ~ ${u.name}`); u.diff.forEach(d => console.log(`      ${d}`)); });
if (plan.downgradeWarn.length) console.log('⚠️ 확정(isVerified) 문서의 위험도 변경:\n  ' + plan.downgradeWarn.join('\n  '));
if (input.notice) console.log(`공지: "${input.notice.title}"`);

if (!APPLY) { console.log('\n(dry-run) 쓰기 없음. 확인 후 --apply 로 반영'); process.exit(0); }

const ts = admin.firestore.FieldValue.serverTimestamp();
const month = (input.month || new Date().toISOString().slice(0, 7));
const writes = [
  ...plan.create.map(c => ({ ref: col.doc(), data: { ...c.data, sourceType: 'monthly-crawl', createdBy: 'monthly-update', createdAt: ts, lastCheckedAt: ts } })),
  ...plan.update.map(u => ({ ref: col.doc(u.id), data: { ...u.data, lastCheckedAt: ts }, merge: true })),
];
for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  writes.slice(i, i + 400).forEach(w => (w.merge ? batch.set(w.ref, w.data, { merge: true }) : batch.set(w.ref, w.data)));
  await batch.commit();
}
if (input.notice) {
  await db.collection('notices').doc(`notice_${month}`).set({
    title: input.notice.title, body: input.notice.body, active: true, createdAt: ts,
  });
}
console.log(`반영 완료: 식당 ${writes.length}건${input.notice ? ' + 공지 1건' : ''}`);

// 장부 조회·기록 CLI
//   node scripts/ledger.mjs status                         단계별 현황
//   node scripts/ledger.mjs pending                        Claude 확인 대기 목록
//   node scripts/ledger.mjs review "<이름>" approve|reject ["메모"] [--brand]   Claude 확인 결과 기록
//   node scripts/ledger.mjs sync                           Firestore 의 관리자 승인/반려 결과를 장부에 반영
import fs from 'fs';
import { loadLedger, saveLedger, keyOf, fingerprint } from './lib/ledger.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const L = loadLedger();
const E = Object.values(L.entries);

if (cmd === 'status') {
  const n = f => E.filter(f).length;
  console.log(`장부 ${E.length}건 | 기계 검증 통과 ${n(e => e.check?.result === 'pass')} / 불일치·무관 ${n(e => /fail-(quote|relevance)/.test(e.check?.result || ''))} / 접속 실패 ${n(e => e.check?.result === 'fail-fetch')} / 미검증 ${n(e => !e.check)}`);
  console.log(`Claude 확인 완료 ${n(e => e.claude)} | 앱 반영 ${n(e => e.applied)} (관리자 승인 ${n(e => e.applied?.status === 'approved')}, 대기 ${n(e => e.applied?.status === 'pending')}, 반려 ${n(e => e.applied?.status === 'rejected')})`);
} else if (cmd === 'pending') {
  const f = fs.readdirSync('data/verified').filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().pop();
  const items = f ? JSON.parse(fs.readFileSync(`data/verified/${f}`, 'utf8')).restaurants : [];
  const wait = items.filter(i => i.needsClaudeReview && !(L.entries[keyOf(i)]?.claude?.fp === i.fp));
  console.log(`Claude 확인 대기 ${wait.length}건 (${f || '검증 파일 없음'})`);
  wait.forEach(i => console.log(`  · ${i.name} [${i.peanutRiskTier}] ${i.sourceUrl}\n    "${i.sourceQuote.slice(0, 100)}"`));
} else if (cmd === 'review') {
  // review "<이름>" approve|reject ["메모"] [--brand] [--tier low|transparent|medium|high] [--why "반영할 설명"]
  const flag = n => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : null; };
  const skip = new Set([flag('--tier'), flag('--why')].filter(Boolean));
  const [name, decision, note] = rest.filter(a => !a.startsWith('--') && !skip.has(a));
  if (!name || !['approve', 'reject'].includes(decision)) { console.error('사용법: review "<이름>" approve|reject ["메모"] [--brand] [--tier 등급] [--why "설명"]'); process.exit(1); }
  const route = rest.includes('--brand') ? 'brand' : 'restaurant';
  const f = fs.readdirSync('data/verified').filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().pop();
  const item = JSON.parse(fs.readFileSync(`data/verified/${f}`, 'utf8')).restaurants.find(i => keyOf(i) === keyOf({ route, name }));
  if (!item) { console.error('검증 파일에서 항목을 찾지 못함:', name); process.exit(1); }
  const e = L.entries[keyOf(item)] || (L.entries[keyOf(item)] = { key: keyOf(item), name: item.name });
  e.claude = { decision, note: note || '', on: new Date().toISOString().slice(0, 10), fp: item.fp, tierOverride: flag('--tier') || undefined, whyOverride: flag('--why') || undefined };
  saveLedger(L); console.log(`기록: ${item.name} → ${decision}${e.claude.tierOverride ? ` (등급 ${item.peanutRiskTier}→${e.claude.tierOverride})` : ''}`);
} else if (cmd === 'sync') {
  const admin = (await import('firebase-admin')).default;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
  const db = admin.firestore();
  let changed = 0;
  for (const e of E.filter(e => e.applied?.id)) {
    const s = await db.collection(e.applied.collection).doc(e.applied.id).get();
    const st = s.exists ? s.data().status : 'deleted';
    if (st !== e.applied.status) { e.applied.status = st; changed++; }
  }
  saveLedger(L); console.log(`관리자 결정 동기화: 변경 ${changed}건`);
} else { console.log('명령: status | pending | review | sync'); }

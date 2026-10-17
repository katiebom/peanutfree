// 처리 장부 — 같은 입력을 단계마다 다시 처리하지 않기 위한 기록. 파일: data/ledger.json (로컬 상태, git 제외)
// 키 = route|정규화한 이름, 지문(fp) = 근거·등급이 바뀌었는지 보는 해시. 지문이 같으면 이미 끝낸 단계는 건너뛴다.
import fs from 'fs';
import crypto from 'crypto';
import { normName } from './evidence.mjs';

export const LEDGER_PATH = 'data/ledger.json';
export const CHECK_TTL_DAYS = 90;      // 기계 검증 통과 후 이 기간은 다시 열지 않는다(링크 변질 점검은 이 주기로)
export const MAX_FETCH_TRIES = 3;      // 접속 실패 재시도 상한
const DAY = 86400000;

export const keyOf = c => `${c.route === 'brand' ? 'brand' : 'restaurant'}|${normName(c.name)}`;
export const fingerprint = c => crypto.createHash('sha1')
  .update(JSON.stringify([c.sourceUrl || '', c.sourceQuote || '', c.verifiedTier || c.proposedTier || c.peanutRiskTier || '', c.whyFlagged || '']))
  .digest('hex').slice(0, 12);

export function loadLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch { return { entries: {} }; }
}
export function saveLedger(l) {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(l, null, 2));
}
export const entryOf = (l, c) => l.entries[keyOf(c)];

/** 가져오기 시 호출: 'new' | 'changed' | 'unchanged' 를 돌려주고 장부에 본 기록을 남긴다 */
export function observe(l, c, today = new Date().toISOString().slice(0, 10)) {
  const k = keyOf(c), fp = fingerprint(c), e = l.entries[k];
  if (!e) { l.entries[k] = { key: k, name: c.name, firstSeen: today, lastSeen: today, fp }; return 'new'; }
  e.lastSeen = today;
  if (e.fp !== fp) { e.fp = fp; return 'changed'; }
  return 'unchanged';
}

/** 기계 검증을 다시 해야 하는가 (이미 한 결과가 있으면 그 결과를 쓴다) */
export function checkPlan(l, c, now = Date.now()) {
  const e = entryOf(l, c), fp = fingerprint(c), ck = e?.check;
  if (!ck || ck.fp !== fp) return { run: true, why: ck ? '내용 변경' : '신규' };
  if (ck.result === 'pass') return (now - Date.parse(ck.on) > CHECK_TTL_DAYS * DAY) ? { run: true, why: `${CHECK_TTL_DAYS}일 경과 재점검` } : { run: false, cached: ck };
  if (ck.result === 'fail-fetch' && (ck.tries || 1) < MAX_FETCH_TRIES) return { run: true, why: `접속 실패 재시도(${ck.tries || 1}/${MAX_FETCH_TRIES})` };
  return { run: false, cached: ck };   // 인용 불일치·무관은 Gemini 가 행을 고치기 전까지 다시 열지 않는다
}
export function recordCheck(l, c, result, reason, today = new Date().toISOString().slice(0, 10)) {
  const e = entryOf(l, c); if (!e) return;
  const fp = fingerprint(c);
  e.check = { result, reason: reason || '', on: today, fp, tries: e.check?.fp === fp && result === 'fail-fetch' ? (e.check.tries || 1) + 1 : 1 };
}
export function claudeDecision(l, item) { const e = l.entries[keyOf(item)]; return e?.claude && e.claude.fp === item.fp ? e.claude : null; }
export function appliedAlready(l, item) { const e = l.entries[keyOf(item)]; return !!(e?.applied && e.applied.fp === item.fp); }

// 기계 검증: Gemini 가 '확인'으로 표시한 행의 출처 URL 을 실제로 열어 원문 인용이 페이지에 그대로 있는지 확인한다.
//   node scripts/check-sources.mjs data/candidates/gemini-2026-10-10.json
// 출력: data/verified/<날짜>.json (통과분, apply-reviews.mjs 입력 형식) + <날짜>.report.md (전체 결과, Claude 검토 대상 표시)
// LLM 토큰을 쓰지 않는다. Firestore 에는 쓰지 않는다.
import fs from 'fs';
import path from 'path';
import { validateItem } from './lib/evidence.mjs';
import { loadLedger, saveLedger, observe, checkPlan, recordCheck, fingerprint, claudeDecision } from './lib/ledger.mjs';

const file = process.argv[2];
const FORCE = process.argv.includes('--force');                        // 장부를 무시하고 전부 다시 연다
const INCLUDE_UNVERIFIED = process.argv.includes('--include-unverified');   // Gemini 검증 열이 비어 있는 행도 기계 검증한다(링크·인용이 있을 때만)
if (!file) { console.error('사용법: node scripts/check-sources.mjs <candidates.json>'); process.exit(1); }
const { candidates } = JSON.parse(fs.readFileSync(file, 'utf8'));
const date = path.basename(file).match(/\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().slice(0, 10);

// 비교용 정규화: 태그·공백·문장부호 제거
const squash = t => t.toLowerCase().replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;|&#34;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[\s·・,.:;!?'"“”‘’…()\[\]{}\-–—~*]+/g, '');

async function getText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (PeanutFreeSourceCheck)', 'Accept-Language': 'ko' } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    const head = new TextDecoder('latin1').decode(buf.slice(0, 2048));
    const cs = ((res.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || head.match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let text;
    try { text = new TextDecoder(cs).decode(buf); } catch { text = new TextDecoder('utf-8').decode(buf); }
    return { text };
  } catch (e) { return { error: e.name === 'AbortError' ? '시간 초과' : String(e.message || e).slice(0, 80) }; }
  finally { clearTimeout(timer); }
}

// 공식 사이트가 아닌 것으로 알려진 도메인(블로그·위키·뉴스·정보 집계 사이트 등) — '공식'으로 적혀 있어도 media 로 내린다
const NON_OFFICIAL = /(namu\.wiki|tistory\.com|blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|brunch\.co\.kr|reddit\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|alddak\.kr|kurly\.com|polle\.com|chosun\.com|ilyoweekly\.co\.kr|greened\.kr|busan\.com|wikipedia\.org|mangoplate|diningcode)/i;
// 인용문이 땅콩·알레르기와 아무 관련이 없으면(소스 이용료, 향토음식 소개 등) 등급 근거가 될 수 없다
const RELEVANT = /땅콩|견과|피넛|너트|알레르기|알러지|peanut|allerg|nut/i;

// 근거 유형 → 확신도. 인용문이 페이지에 실제로 있음을 스크립트가 확인했을 때만 부여한다
const CONF = { official: 'high', staff: 'medium', media: 'low', community: 'low' };
const L = loadLedger();
const rows = [];
for (const c of candidates) {
  observe(L, c);
  const base = { geminiId: c.geminiId, name: c.name };
  if (c.verifyStatus !== '확인' && !(INCLUDE_UNVERIFIED && !c.verifyStatus)) { rows.push({ ...base, result: 'skip', reason: `Gemini 검증 결과: ${c.verifyStatus || '비어있음'}` }); continue; }
  if (c.nameParts) { rows.push({ ...base, result: 'skip', reason: '여러 브랜드가 묶인 행 — 분리 필요' }); continue; }
  if (!c.sourceUrl || !c.sourceQuote) { rows.push({ ...base, result: 'skip', reason: '출처 URL 또는 원문 인용 없음' }); continue; }
  const plan = FORCE ? { run: true } : checkPlan(L, c);
  if (!plan.run) {                       // 같은 내용으로 이미 검증함 — 이전 결과를 그대로 쓴다
    const ck = plan.cached;
    rows.push({ ...base, result: ck.result, reason: ck.result === 'pass' ? '' : `${ck.reason} (이전 결과 재사용)`, url: c.sourceUrl, cand: c, cached: true });
    continue;
  }
  const got = await getText(c.sourceUrl);
  if (got.error) { recordCheck(L, c, 'fail-fetch', got.error); rows.push({ ...base, result: 'fail-fetch', reason: got.error, url: c.sourceUrl }); continue; }
  const found = squash(got.text).includes(squash(c.sourceQuote));
  if (found && !RELEVANT.test(c.sourceQuote)) { recordCheck(L, c, 'fail-relevance', '인용문에 땅콩·견과·알레르기 언급이 없음'); rows.push({ ...base, result: 'fail-relevance', reason: '인용문에 땅콩·견과·알레르기 언급이 없음 — 주장과 무관한 문장', url: c.sourceUrl }); continue; }
  recordCheck(L, c, found ? 'pass' : 'fail-quote', found ? '' : '원문 인용이 페이지 본문에 없음');
  rows.push({ ...base, result: found ? 'pass' : 'fail-quote', reason: found ? '' : '원문 인용이 페이지 본문에 없음 (JS 로 그려지는 페이지면 오탐일 수 있어 사람 확인 필요)', url: c.sourceUrl, cand: c });
  await new Promise(r => setTimeout(r, 400));
}
saveLedger(L);

// 통과분 → apply-reviews 입력. 등급은 Gemini 검증 후 등급(없으면 제안 등급). 안전·위험 쪽 주장은 Claude 확인 대상으로 표시
const kindOf = c => (c.sourceKind === 'official' && NON_OFFICIAL.test(new URL(c.sourceUrl).hostname) ? 'media' : c.sourceKind);
const passed = rows.filter(r => r.result === 'pass' && (r.cand.verifiedTier || r.cand.proposedTier) !== 'unknown').map(r => {
  const c = r.cand;
  let tier = c.verifiedTier || c.proposedTier;   // unknown 은 근거를 못 찾은 행이라 반영 대상이 아니다
  const cd = claudeDecision(L, { ...c, fp: fingerprint(c) });      // Claude 확인 결정: 반려/등급·설명 덮어쓰기
  if (cd?.decision === 'reject') return null;
  if (cd?.tierOverride) tier = cd.tierOverride;
  return {
    route: c.route, name: c.name, district: c.district, cuisineType: c.cuisineType, peanutRiskTier: tier,
    confidence: CONF[kindOf(c)] || 'low', sourceKind: kindOf(c), sourceKindNote: kindOf(c) !== c.sourceKind ? `출처 유형 ${c.sourceKind}→${kindOf(c)} 로 내림(공식 도메인 아님)` : undefined, sourceUrl: c.sourceUrl, sourceQuote: c.sourceQuote,
    whyFlagged: cd?.whyOverride || c.whyFlagged, recommendedAction: c.recommendedAction, cautionOrExclusion: c.cautionOrExclusion, geminiId: c.geminiId,
    fp: fingerprint(c),
    needsClaudeReview: !cd && (tier === 'low' || tier === 'high'),
    claudeReviewed: cd ? cd.decision + (cd.tierOverride ? `(등급→${cd.tierOverride})` : '') : undefined,
  };
}).filter(Boolean);
// 근거 요건(등급별)에 못 미치는 행은 여기서 미리 빼서 보고서에 남긴다 — 반영 단계에서 전체가 막히지 않도록
const tierFail = [];
for (let i = passed.length - 1; i >= 0; i--) {
  const errs = validateItem(passed[i]);
  if (errs.length) { tierFail.push({ name: passed[i].name, why: errs.join(' / ') }); passed.splice(i, 1); }
}
fs.mkdirSync('data/verified', { recursive: true });
fs.writeFileSync(`data/verified/${date}.json`, JSON.stringify({ restaurants: passed }, null, 2));

const count = k => rows.filter(r => r.result === k).length;
const nTierFail = tierFail.length;
const cachedN = rows.filter(r => r.cached).length;
const lines = [`# 출처 기계 검증 ${date}`, '', `이전 결과 재사용(다시 열지 않음): ${cachedN}건`, `통과 ${count('pass') - nTierFail} (등급 요건 미달로 제외 ${nTierFail}) / 인용 무관 ${count('fail-relevance')} / 인용 불일치 ${count('fail-quote')} / 접속 실패 ${count('fail-fetch')} / 제외 ${count('skip')}`,
  `Claude 확인 대상(🟢·🔴 통과분): ${passed.filter(p => p.needsClaudeReview).length}건`, ''];
if (tierFail.length) lines.push('## 등급 근거 요건 미달 (출처는 확인됐지만 그 등급을 줄 수 없음)', ...tierFail.map(t => `- ${t.name}: ${t.why}`), '');
for (const [k, title] of [['fail-relevance', '인용 무관(주장을 뒷받침하지 않음)'], ['fail-quote', '인용 불일치'], ['fail-fetch', '접속 실패'], ['skip', '제외']]) {
  const g = rows.filter(r => r.result === k);
  if (g.length) lines.push(`## ${title}`, ...g.map(r => `- ${r.geminiId} ${r.name}: ${r.reason}${r.url ? ` (${r.url})` : ''}`), '');
}
fs.writeFileSync(`data/verified/${date}.report.md`, lines.join('\n'));
console.log(lines.slice(0, 4).join('\n') + `\n→ data/verified/${date}.json , ${date}.report.md`);

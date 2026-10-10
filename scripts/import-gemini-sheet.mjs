// Gemini 가 만든 시트 탭('4단계_안심분류_DB', '후보')을 후보 JSON 으로 변환 — Firestore 에는 쓰지 않는다
//   node scripts/import-gemini-sheet.mjs --xlsx data/inbox/peanutfree.xlsx
//   node scripts/import-gemini-sheet.mjs --sheet <spreadsheetId> [--tabs "탭1,탭2"]   (Sheets API + 시트를 서비스계정에 공유한 경우)
// 출력: data/candidates/gemini-YYYY-MM-DD.json  → check-sources.mjs(기계 검증) → data/verified/ → apply-reviews.mjs
// 출처 URL·원문 인용이 없는 행은 이후 검증 단계에서 반드시 걸러진다(의도된 동작).
import fs from 'fs';
import { createRequire } from 'module';
import { loadLedger, saveLedger, observe, keyOf } from './lib/ledger.mjs';

const require = createRequire(import.meta.url);
const arg = f => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : null);
const XLSX_PATH = arg('--xlsx');
const SHEET_ID = arg('--sheet');
const TABS = (arg('--tabs') || '4단계_안심분류_DB,후보').split(',').map(t => t.trim()).filter(Boolean);
if (!XLSX_PATH && !SHEET_ID) { console.error('--xlsx <파일> 또는 --sheet <id> 필요'); process.exit(1); }
// 탭마다 열 이름이 조금 다르다(Gemini 가 만든 '후보' 탭 등) — 표준 이름으로 맞춘다
const ALIAS = { '브랜드 / 식당명': '식당명', '지역 / 상권': '세부지역', '음식 카테고리': '카테고리', '안전 등급': '안심 등급', '출처 원문 인용': '원문 인용' };

const tabRows = {};
if (XLSX_PATH) {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(XLSX_PATH);
  for (const t of TABS) if (wb.Sheets[t]) tabRows[t] = XLSX.utils.sheet_to_json(wb.Sheets[t], { header: 1, defval: '' });
} else {
  const { GoogleAuth } = require('google-auth-library');
  const key = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
  const client = await new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] }).getClient();
  for (const t of TABS) {
    try { tabRows[t] = (await client.request({ url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(t)}` })).data.values || []; }
    catch { console.error(`탭 읽기 실패(건너뜀): ${t}`); }
  }
}
if (!Object.keys(tabRows).length) { console.error('읽을 수 있는 탭이 없음'); process.exit(1); }

// 허용 cuisineType 18종 (firestore.rules / scripts/lib/evidence.mjs 와 동기화)
const CUISINE_RULES = [
  [/파인다이닝/, '파인다이닝'], [/인도|커리/, '인도'], [/베트남|동남아|쌀국수/, '동남아시아'], [/멕시칸/, '멕시칸'],
  [/피자/, '피자'], [/버거/, '버거'], [/치킨/, '치킨'], [/샌드위치|토스트/, '샌드위치'], [/샐러드|비건|포케/, '샐러드/비건'],
  [/카페|베이커리|디저트|도넛|프레즐|아이스크림|빵/, '카페/베이커리'], [/이탈리안/, '이탈리안'], [/일식|돈카츠/, '일식'],
  [/중식|훠궈|마라|딤섬|만두/, '중식'], [/한식|분식|국밥|곰탕|냉면|죽|김밥|밀면|갈비|두부|솥밥|백반|낙지|도시락|떡볶이|스트리트/, '한식'],
  [/양식|스테이크|브런치|호텔|패밀리/, '양식'],
];
const cuisineOf = t => (CUISINE_RULES.find(([re]) => re.test(t)) || [null, '기타'])[1];
const TIER_OF = label => (label.includes('🔴') ? 'high' : label.includes('🟡') ? 'medium' : label.includes('🔵') ? 'transparent' : label.includes('🟢') ? 'low' : 'unknown');
const KIND = { '공식 성분표': 'official', '매장 직원 확인': 'staff', '언론·블로그': 'media', '커뮤니티': 'community' };
const urlOf = v => (/^https?:\/\//.test(v) ? v : '');

const candidates = [];
for (const [tab, rows] of Object.entries(tabRows)) {
  const [head, ...body] = rows;
  if (!head) continue;
  const col = {};
  head.forEach((h, i) => { const n = String(h).trim(); col[ALIAS[n] || n] = i; });
  const missing = ['식당명', '안심 등급'].filter(n => !(n in col));
  if (missing.length) { console.error(`[${tab}] 헤더 누락: ${missing.join(', ')} — 탭 건너뜀`); continue; }
  const get = (r, k) => (k in col ? String(r[col[k]] ?? '').trim() : '');
  body.filter(r => get(r, '식당명')).forEach((r, idx) => {
    const name = get(r, '식당명');
    const parts = name.split(/\s*\/\s*/).filter(Boolean);
    // 체인 여부 열이 없는 탭은 지역이 '전국'이면 체인으로 본다
    const chain = get(r, '체인 여부') ? get(r, '체인 여부') === 'O' : /전국/.test(get(r, '세부지역') + get(r, '지역'));
    candidates.push({
      geminiId: get(r, '식당 ID') || `GM-${tab === '후보' ? 'CAND' : 'TAB'}-${String(idx + 1).padStart(3, '0')}`,
      sourceTab: tab,
      route: chain ? 'brand' : 'restaurant',                              // 체인=brands, 개별 매장=reviews
      name,
      nameParts: parts.length > 1 ? parts : undefined,                    // 여러 브랜드가 한 행 — 검증 단계에서 분리
      district: get(r, '세부지역'),
      region: get(r, '지역'),
      cuisineType: cuisineOf(`${get(r, '카테고리')} ${name}`),
      cuisineRaw: get(r, '카테고리'),
      proposedTier: TIER_OF(get(r, '안심 등급')),                          // Gemini 판정(미검증)
      peanutRiskTier: 'unknown',                                           // 검증 전 반영값
      whyFlagged: get(r, '땅콩/견과류 사용 상세'),
      recommendedAction: get(r, '현장 문의 및 응대 가이드'),
      cautionOrExclusion: get(r, '주의사항'),
      geminiSource: get(r, '데이터 출처'),                                  // 문구일 뿐 — 근거로 인정하지 않음
      sourceUrl: urlOf(get(r, '출처 URL')),
      sourceQuote: get(r, '원문 인용'),
      sourceKind: KIND[get(r, '출처 유형')] || '',
      verifyStatus: get(r, '검증 결과'),
      verifyNote: get(r, '검증 메모'),
      checkedOn: get(r, '확인일'),
      verifiedTier: get(r, '검증 후 등급') ? TIER_OF(get(r, '검증 후 등급')) : '',
      status: 'needs-qa',
    });
  });
}

// 같은 식당이 여러 탭/행에 있으면 근거(URL+인용)가 있는 행 하나만 남긴다 — 그래야 장부의 지문이 매번 바뀌지 않는다
const best = new Map();
const rank = c => (c.sourceUrl && c.sourceQuote ? 2 : 0) + (c.verifyStatus === '확인' ? 1 : 0);
for (const c of candidates) { const k = keyOf(c); if (!best.has(k) || rank(c) > rank(best.get(k))) best.set(k, c); }
const droppedDup = candidates.length - best.size;
candidates.splice(0, candidates.length, ...best.values());

// 장부와 대조: 새 행 / 내용이 바뀐 행 / 이미 본 행(변화 없음) — 이후 단계는 변화 없는 행을 다시 처리하지 않는다
const ledger = loadLedger();
candidates.forEach(c => { c.delta = observe(ledger, c); });
saveLedger(ledger);

const tally = (key) => candidates.reduce((a, c) => { const k = key(c) || '(비어있음)'; a[k] = (a[k] || 0) + 1; return a; }, {});
const stat = {
  total: candidates.length,
  byTab: tally(c => c.sourceTab),
  droppedDuplicateRows: droppedDup,                   // 같은 식당의 중복 행(근거 약한 쪽)을 제외한 수
  byDelta: tally(c => c.delta),                       // new / changed / unchanged
  byRoute: tally(c => c.route),
  byProposedTier: tally(c => c.proposedTier),
  byVerifyStatus: tally(c => c.verifyStatus),
  multiBrandRows: candidates.filter(c => c.nameParts).length,
  cuisineFallbackEtc: candidates.filter(c => c.cuisineType === '기타').map(c => c.name),
  withoutUrlSource: candidates.filter(c => !c.sourceUrl).length,
};
const out = `data/candidates/gemini-${new Date().toISOString().slice(0, 10)}.json`;
fs.mkdirSync('data/candidates', { recursive: true });
fs.writeFileSync(out, JSON.stringify({ importedFrom: XLSX_PATH || `sheet:${SHEET_ID}`, stat, candidates }, null, 2));
console.log(out, JSON.stringify(stat, null, 2));

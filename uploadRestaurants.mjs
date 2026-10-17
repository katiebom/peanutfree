// uploadRestaurants.mjs
// 사용법:
//   node uploadRestaurants.mjs             → 실제 업로드
//   node uploadRestaurants.mjs --dry-run   → 미리보기만 (업로드 없음)

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp }    from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

const require = createRequire(import.meta.url);
const XLSX    = require('xlsx');

// ── 경로 설정 ─────────────────────────────────────────────
const __dir   = path.dirname(fileURLToPath(import.meta.url));
const DL      = path.resolve(__dir, '..'); // Downloads 폴더
const DRY_RUN = process.argv.includes('--dry-run');

// ── Firebase ──────────────────────────────────────────────
const app = initializeApp({
  apiKey:            'AIzaSyCfbHfW7k_irS0oCttFe9ijGtUNHmvHkkk',
  authDomain:        'peanutfree1.firebaseapp.com',
  projectId:         'peanutfree1',
  storageBucket:     'peanutfree1.firebasestorage.app',
  messagingSenderId: '507912396290',
  appId:             '1:507912396290:web:0b107c326ac511e9c1d11b',
});
const db = getFirestore(app);

// ── CuisineType 매핑 ──────────────────────────────────────
const CUISINE_MAP = [
  // Chinese
  [/^chinese/i,                         '중식'],
  [/^noodles|^dumplings/i,              '중식'],
  // Japanese
  [/^japanese|^sushi|^ramen|^udon|^kushiage|^kaiseki/i, '일식'],
  // Korean
  [/^korean|bulgogi|kimchi|kalguksu|samgyetang|naengmyeon|galbi|gukbap|dwaeji|mandu|gamjatang/i, '한식'],
  [/fried chicken.*korean|korean.*fried chicken/i,       '한식'],
  // Italian / Mediterranean / French
  [/^italian|^pizza|^pasta|mediterranean|^french|european/i, '이탈리안'],
  // Indian
  [/^indian|nepali/i,                   '인도'],
  // Southeast Asian
  [/^thai|vietnamese|southeast|indonesian|malaysian/i,   '동남아시아'],
  // Mexican
  [/^mexican|tex.?mex|burrito|taco/i,   '멕시칸'],
  // Middle Eastern
  [/^middle.?east|arabic|turkish|lebanese|halal/i,       '중동'],
  // Western / Grill
  [/^contemporary|^modern|^fusion|^grill|^bbq|barbecue|^steak|^burger|^western/i, '양식'],
  [/meats.and.grills|roast.chicken/i,                    '양식'],
];

// 한국어 카테고리 → cuisineType
const KO_CATEGORY_MAP = {
  한식: '한식', 중식: '중식', 일식: '일식', 양식: '양식',
  이탈리안: '이탈리안', 멕시칸: '멕시칸', 인도: '인도',
  동남아시아: '동남아시아', 중동: '중동',
  버거: '양식', 브런치: '기타', 비건: '기타',
  샐러드: '기타', 다이닝: '기타',
};

function mapCuisine(raw = '') {
  const s = raw.trim();
  for (const [re, type] of CUISINE_MAP) {
    if (re.test(s)) return type;
  }
  return '기타'; // buffet, cafe, bakery, market, vegan, dessert …
}

function mapKoCuisine(cat = '') {
  return KO_CATEGORY_MAP[cat.trim()] ?? '기타';
}

// chain 이름으로 cuisine 추론 (family_safe 파일 — cuisine 컬럼 없음)
function guessFromChain(name = '') {
  const n = name.toLowerCase();
  if (/딘타이펑|din tai fung/i.test(n))                return '중식';
  if (/india|curry|카레|인도/i.test(n))                 return '인도';
  if (/thai|타이|pho|베트남|쌀국수/i.test(n))           return '동남아시아';
  if (/sushi|스시|ramen|라멘|udon|우동|일식/i.test(n))  return '일식';
  if (/pizza|pasta|이탈리안|bistro|brasserie/i.test(n)) return '이탈리안';
  if (/갈비|삼겹|불고기|국밥|설렁탕|냉면|한식/i.test(n)) return '한식';
  return '기타';
}

// ── XLSX 파일 → 객체 배열 ─────────────────────────────────
function readSheet(filePath, sheetName) {
  const wb = XLSX.readFile(filePath, { codepage: 65001 });
  const ws = sheetName
    ? (wb.Sheets[sheetName] ?? wb.Sheets[wb.SheetNames[0]])
    : wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error(`시트 없음: "${sheetName}" in ${path.basename(filePath)}`);
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function str(v) { return String(v ?? '').trim(); }

// ── 1) seoul_peanut_allergy_100_db ────────────────────────
//  columns: id, name, district, cuisine, peanut_risk_tier,
//           allergy_guidance_likelihood, why_flagged,
//           recommended_action, confidence
function parseRiskDB(rows) {
  return rows.map(r => ({
    _key:                     str(r.name).toLowerCase(),
    name:                     str(r.name),
    branch:                   '',
    district:                 str(r.district),
    cuisineType:              mapCuisine(str(r.cuisine)),
    peanutRiskTier:           str(r.peanut_risk_tier).toLowerCase() || 'medium',
    allergyGuidanceLikelihood: str(r.allergy_guidance_likelihood).toLowerCase(),
    whyFlagged:               str(r.why_flagged),
    recommendedAction:        str(r.recommended_action),
    peanutHandlingBasis:      '',
    recommendedSaferItems:    '',
    cautionOrExclusion:       '',
    confidence:               str(r.confidence).toLowerCase(),
    isVerified:               false,
  })).filter(r => r.name);
}

// ── 2) seoul_family_peanut_safer_100 ─────────────────────
//  columns: chain, branch, district, family_friendly_signal,
//           peanut_handling_basis, confidence_tier,
//           recommended_safer_items, caution_or_exclusion
function parseFamilySafe(rows) {
  return rows.map(r => {
    const chain  = str(r.chain);
    const branch = str(r.branch);
    return {
      _key:                     `${chain.toLowerCase()}|${branch.toLowerCase()}`,
      name:                     chain,
      branch,
      district:                 str(r.district),
      cuisineType:              guessFromChain(chain),
      peanutRiskTier:           'low',   // "safer" 리스트 전체 low
      allergyGuidanceLikelihood: str(r.confidence_tier).toLowerCase(),
      whyFlagged:               '',
      recommendedAction:        '',
      peanutHandlingBasis:      str(r.peanut_handling_basis),
      recommendedSaferItems:    str(r.recommended_safer_items),
      cautionOrExclusion:       str(r.caution_or_exclusion),
      confidence:               str(r.confidence_tier).toLowerCase(),
      isVerified:               false,
    };
  }).filter(r => r.name);
}

// ── 3) 식당리스트.csv ─────────────────────────────────────
//  columns: 지역, 카테고리, 식당명, 특징, 프랜차이즈여부
function parseLocalList(rows) {
  return rows.map(r => ({
    _key:                     str(r['식당명']).toLowerCase(),
    name:                     str(r['식당명']),
    branch:                   '',
    district:                 str(r['지역']),
    cuisineType:              mapKoCuisine(str(r['카테고리'])),
    peanutRiskTier:           'medium',
    allergyGuidanceLikelihood: '',
    whyFlagged:               '',
    recommendedAction:        str(r['특징']),
    peanutHandlingBasis:      '',
    recommendedSaferItems:    '',
    cautionOrExclusion:       '',
    confidence:               'medium',
    isVerified:               false,
  })).filter(r => r.name);
}

// ── 소스 내 중복 제거 (_key 기준 선착순) ──────────────────
function dedupeByKey(arr) {
  const seen = new Set();
  return arr.filter(r => {
    if (seen.has(r._key)) return false;
    seen.add(r._key);
    return true;
  });
}

// ── Firestore 기존 이름 수집 ──────────────────────────────
async function collectExistingNames(colName, nameFields) {
  try {
    const snap = await getDocs(collection(db, colName));
    const names = new Set();
    snap.docs.forEach(d => {
      const data = d.data();
      for (const f of nameFields) {
        const v = (data[f] || '').toLowerCase().trim();
        if (v) names.add(v);
      }
    });
    console.log(`  ${colName.padEnd(14)} ${snap.size}개 기존 문서 확인`);
    return names;
  } catch (e) {
    if (e.code === 'permission-denied') {
      console.log(`  ${colName.padEnd(14)} 읽기 권한 없음 → 신규 컬렉션으로 간주`);
      return new Set();
    }
    throw e;
  }
}

// ════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════

console.log('━'.repeat(56));
console.log('  PeanutFree — Firestore restaurants 업로드');
console.log('━'.repeat(56));
console.log('\n📂  파일 파싱 중...\n');

// 파일 읽기
const riskRows   = readSheet(path.join(DL, 'seoul_peanut_allergy_100_db.xlsx'),    'Seoul_100_DB');
const familyRows = readSheet(path.join(DL, 'seoul_family_peanut_safer_100.xlsx'),  'Seoul 100 List');
const localRows  = readSheet(path.join(DL, '식당리스트.csv'));

const fromRisk   = parseRiskDB(riskRows);
const fromFamily = parseFamilySafe(familyRows);
const fromLocal  = parseLocalList(localRows);

// 소스 내 dedup 후 병합 (risk → family → local 우선순위)
const merged  = dedupeByKey([...fromRisk, ...fromFamily, ...fromLocal]);

console.log(`  seoul_peanut_allergy_100_db  : ${fromRisk.length}행`);
console.log(`  seoul_family_peanut_safer_100: ${fromFamily.length}행`);
console.log(`  식당리스트                   : ${fromLocal.length}행`);
console.log(`  소스 내 중복 제거 후          : ${merged.length}개\n`);

// Firestore 기존 식당명 수집
console.log('🔍  Firestore 중복 확인 중...\n');
const existRestaurants = await collectExistingNames('restaurants', ['name']);
const existReviews     = await collectExistingNames('reviews',     ['name', 'ko.name']);

// 중복 판정 — name 기준 (family_safe는 chain name으로 비교)
const existingNames = new Set([...existRestaurants, ...existReviews]);

const toUpload = merged.filter(r => !existingNames.has(r.name.toLowerCase()));
const skipped  = merged.length - toUpload.length;

console.log(`\n${'━'.repeat(56)}`);
console.log(`  총 ${toUpload.length}개 업로드 예정, ${skipped}개 중복 skip`);
console.log(`${'━'.repeat(56)}\n`);

// ── DRY RUN ───────────────────────────────────────────────
if (DRY_RUN) {
  const PREVIEW = 30;
  console.log(`📋  미리보기 (최대 ${PREVIEW}개)\n`);
  console.log('  #   [cuisineType] [risk  ] [src] 이름 (지점) — 지역');
  console.log('  ' + '─'.repeat(72));

  toUpload.slice(0, PREVIEW).forEach((r, i) => {
    const src = r.peanutHandlingBasis ? 'fam' : r.district.match(/[가-힣]/) ? 'loc' : 'rsk';
    const branch = r.branch ? ` (${r.branch})` : '';
    console.log(
      `  ${String(i + 1).padStart(3)}. [${r.cuisineType.padEnd(6)}] [${r.peanutRiskTier.padEnd(6)}] [${src}] ${r.name}${branch} — ${r.district}`
    );
  });
  if (toUpload.length > PREVIEW) {
    console.log(`  ... 외 ${toUpload.length - PREVIEW}개`);
  }

  console.log('\n⚠️   --dry-run: 실제 업로드를 하지 않았습니다.');
  console.log('     업로드하려면: node uploadRestaurants.mjs\n');
  process.exit(0);
}

// ── 실제 업로드 (10개씩 병렬 배치) ───────────────────────
console.log('⬆️   Firestore 업로드 중...\n');
const BATCH_SIZE = 10;
let uploaded = 0;

for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
  const chunk = toUpload.slice(i, i + BATCH_SIZE);
  await Promise.all(
    chunk.map(r =>
      addDoc(collection(db, 'restaurants'), {
        name:                      r.name,
        branch:                    r.branch,
        district:                  r.district,
        cuisineType:               r.cuisineType,
        peanutRiskTier:            r.peanutRiskTier,
        allergyGuidanceLikelihood: r.allergyGuidanceLikelihood,
        whyFlagged:                r.whyFlagged,
        recommendedAction:         r.recommendedAction,
        peanutHandlingBasis:       r.peanutHandlingBasis,
        recommendedSaferItems:     r.recommendedSaferItems,
        cautionOrExclusion:        r.cautionOrExclusion,
        confidence:                r.confidence,
        isVerified:                false,
        createdAt:                 serverTimestamp(),
      })
    )
  );
  uploaded += chunk.length;
  process.stdout.write(`\r  진행: ${uploaded} / ${toUpload.length}개`);
}

console.log(`\n\n${'━'.repeat(56)}`);
console.log(`  업로드 완료: ${uploaded}개`);
if (skipped > 0) console.log(`  중복 skip  : ${skipped}개`);
console.log(`${'━'.repeat(56)}\n`);
process.exit(0);

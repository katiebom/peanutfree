// seedCafes.mjs
// 사용법:
//   node seedCafes.mjs             → 실제 업로드
//   node seedCafes.mjs --dry-run   → 미리보기만 (업로드 없음)

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';

const app = initializeApp({
  apiKey:            'AIzaSyCfbHfW7k_irS0oCttFe9ijGtUNHmvHkkk',
  authDomain:        'peanutfree1.firebaseapp.com',
  projectId:         'peanutfree1',
  storageBucket:     'peanutfree1.firebasestorage.app',
  messagingSenderId: '507912396290',
  appId:             '1:507912396290:web:0b107c326ac511e9c1d11b',
});
const db = getFirestore(app);
const DRY_RUN = process.argv.includes('--dry-run');

// ── 카페/프랜차이즈 시드 데이터 ──────────────────────────
const CAFES = [
  {
    name: '스타벅스',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'medium',
    allergyGuidanceLikelihood: 'high',
    whyFlagged: '일부 음료·푸드에 견과류 성분 포함. 스타벅스 앱 및 매장에서 알레르기 정보 확인 가능',
    recommendedAction: '주문 전 매장 직원에게 땅콩 알레르기 고지. 스타벅스 앱 "영양 정보"에서 성분 확인 가능',
    recommendedSaferItems: '아메리카노, 카페라떼 등 기본 에스프레소 음료 (시럽·견과류 토핑 제외)',
    cautionOrExclusion: '견과류 토핑 프라푸치노, 너트 포함 스낵·샌드위치, 일부 케이크류',
    peanutHandlingBasis: '공식 알레르기 정보 앱/홈페이지 제공. 매장 내 교차오염 가능성 있음',
    confidence: 'high',
    isVerified: true,
  },
  {
    name: '투썸플레이스',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'medium',
    allergyGuidanceLikelihood: 'medium',
    whyFlagged: '케이크·베이커리·음료에 견과류 성분 다수 포함. 제품별 성분 확인 필요',
    recommendedAction: '주문 전 직원에게 땅콩 알레르기 고지. 투썸 홈페이지 또는 앱에서 성분 확인 권장',
    recommendedSaferItems: '아메리카노, 기본 커피 음료 (시럽·토핑 없음)',
    cautionOrExclusion: '견과류 포함 케이크(녹차·초코 포함 일부), 누가 크림 음료, 페이스트리',
    peanutHandlingBasis: '홈페이지에서 알레르기 정보 일부 공개. 매장 교차오염 가능성 있음',
    confidence: 'medium',
    isVerified: true,
  },
  {
    name: '이디야',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'low',
    allergyGuidanceLikelihood: 'medium',
    whyFlagged: '일부 음료·케이크류에 견과류 포함 가능성. 제품별 성분 확인 권장',
    recommendedAction: '기본 커피 음료 위주 주문. 매장 직원에게 알레르기 고지',
    recommendedSaferItems: '아메리카노, 카페라떼 등 기본 커피 음료',
    cautionOrExclusion: '견과류 포함 케이크류, 그래놀라 음료',
    peanutHandlingBasis: '대형 프랜차이즈로 성분정보 일부 공개. 매장별 차이 있을 수 있음',
    confidence: 'medium',
    isVerified: false,
  },
  {
    name: '메가커피',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'low',
    allergyGuidanceLikelihood: 'medium',
    whyFlagged: '일부 시즌 음료·케이크에 견과류 포함 가능. 공식 알레르기 정보 접근성 낮음',
    recommendedAction: '기본 커피 음료 위주 주문. 케이크·디저트 주문 시 직원에게 성분 확인 요청',
    recommendedSaferItems: '아메리카노, 카페라떼, 아이스 아메리카노 (토핑 제외)',
    cautionOrExclusion: '견과류 포함 케이크, 쿠키, 프라페 일부',
    peanutHandlingBasis: '공식 알레르기 정보 공개 미흡. 직접 매장 확인 권장',
    confidence: 'low',
    isVerified: false,
  },
  {
    name: '컴포즈커피',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'low',
    allergyGuidanceLikelihood: 'medium',
    whyFlagged: '저가 프랜차이즈. 일부 음료 및 간식류에 견과류 포함 가능. 공식 정보 제한적',
    recommendedAction: '기본 커피 음료 위주 주문. 스낵·디저트 주문 시 직원에게 성분 확인 요청',
    recommendedSaferItems: '아메리카노, 카페라떼 등 기본 음료',
    cautionOrExclusion: '견과류 포함 스낵류, 그래놀라 음료, 일부 케이크',
    peanutHandlingBasis: '공식 알레르기 정보 제한적. 직접 확인 권장',
    confidence: 'low',
    isVerified: false,
  },
  {
    name: '폴바셋',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'medium',
    allergyGuidanceLikelihood: 'high',
    whyFlagged: '고급 카페로 베이커리·디저트에 견과류 다수 사용. 매장 직원이 성분 안내 가능',
    recommendedAction: '주문 전 직원에게 상세히 알레르기 고지. 베이커리 성분 반드시 확인',
    recommendedSaferItems: '블랙 커피, 기본 에스프레소 음료, 플레인 라떼 (토핑·시럽 제외)',
    cautionOrExclusion: '크루아상, 케이크, 쿠키, 견과류 포함 시그니처 음료',
    peanutHandlingBasis: '스페셜티 카페로 직원 알레르기 교육 수준 높음. 교차오염 주의',
    confidence: 'medium',
    isVerified: false,
  },
  {
    name: '블루보틀',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'low',
    allergyGuidanceLikelihood: 'high',
    whyFlagged: '스페셜티 카페. 일부 푸드 메뉴에 견과류 포함 가능. 투명한 성분 정보 제공',
    recommendedAction: '직원에게 땅콩 알레르기 고지. 메뉴 성분 문의 시 직원이 안내 가능',
    recommendedSaferItems: '블랙 커피, 기본 라떼류',
    cautionOrExclusion: '견과류 포함 페이스트리, 쿠키류',
    peanutHandlingBasis: '글로벌 스페셜티 브랜드로 성분 투명성 높음. 직원에게 확인 가능',
    confidence: 'high',
    isVerified: false,
  },
  {
    name: '할리스',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'medium',
    allergyGuidanceLikelihood: 'medium',
    whyFlagged: '케이크·베이커리에 견과류 성분 다수. 시즌 음료 일부에도 포함',
    recommendedAction: '매장 직원에게 땅콩 알레르기 고지. 메뉴 성분 확인 후 주문',
    recommendedSaferItems: '아메리카노, 기본 라떼 (시럽·토핑 제외)',
    cautionOrExclusion: '견과류 포함 케이크, 프라페 일부, 시즌 한정 음료',
    peanutHandlingBasis: '홈페이지 성분정보 일부 제공. 매장 교차오염 가능성 있음',
    confidence: 'medium',
    isVerified: false,
  },
  {
    name: '공차',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'low',
    allergyGuidanceLikelihood: 'medium',
    whyFlagged: '버블티 전문점. 푸딩·크림 토핑 일부에 견과류 포함 가능성',
    recommendedAction: '토핑 선택 시 성분 확인 필수. 직원에게 땅콩 알레르기 고지',
    recommendedSaferItems: '기본 차 음료, 타피오카 펄 (개별 성분 확인 후)',
    cautionOrExclusion: '견과류 포함 가능한 크런치 토핑류, 일부 디저트 메뉴',
    peanutHandlingBasis: '음료 중심 브랜드로 견과류 위험 상대적으로 낮으나 토핑 확인 필요',
    confidence: 'medium',
    isVerified: false,
  },
  {
    name: '빽다방',
    branch: '',
    district: '전국',
    cuisineType: '카페',
    peanutRiskTier: 'low',
    allergyGuidanceLikelihood: 'low',
    whyFlagged: '저가 프랜차이즈. 공식 알레르기 정보 공개 미흡. 간식류 성분 확인 어려움',
    recommendedAction: '기본 커피 음료 위주 주문. 빙수·케이크류 자제. 직원에게 알레르기 고지',
    recommendedSaferItems: '아메리카노, 기본 커피 음료',
    cautionOrExclusion: '빙수류, 견과류 포함 가능한 케이크·달콤한 음료',
    peanutHandlingBasis: '공식 성분정보 공개 미흡. 직접 매장 확인 필요',
    confidence: 'low',
    isVerified: false,
  },
];

// ════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════

console.log('━'.repeat(52));
console.log('  PeanutFree — 카페/프랜차이즈 시드 업로드');
console.log('━'.repeat(52));

// Firestore 기존 이름 확인
console.log('\n🔍  중복 확인 중...\n');
let existingNames = new Set();
try {
  const snap = await getDocs(collection(db, 'restaurants'));
  snap.docs.forEach(d => {
    const name = (d.data().name || '').toLowerCase().trim();
    if (name) existingNames.add(name);
  });
  console.log(`  restaurants: 기존 ${snap.size}개 확인`);
} catch (e) {
  if (e.code === 'permission-denied') {
    console.log('  restaurants: 읽기 권한 없음 → 신규 컬렉션으로 간주');
  } else {
    throw e;
  }
}

const toUpload = CAFES.filter(c => !existingNames.has(c.name.toLowerCase()));
const skipped  = CAFES.length - toUpload.length;

console.log(`\n${'━'.repeat(52)}`);
console.log(`  총 ${CAFES.length}개 중 ${toUpload.length}개 업로드 예정, ${skipped}개 중복 skip`);
console.log(`${'━'.repeat(52)}\n`);

if (DRY_RUN) {
  console.log('📋  미리보기\n');
  toUpload.forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.peanutRiskTier.padEnd(6)}] ${c.name} — ${c.district}`);
    console.log(`     > ${c.recommendedAction}`);
  });
  console.log('\n⚠️   --dry-run: 실제 업로드를 하지 않았습니다.');
  console.log('     업로드하려면: node seedCafes.mjs\n');
  process.exit(0);
}

if (toUpload.length === 0) {
  console.log('✅  모두 이미 업로드됨. 종료합니다.\n');
  process.exit(0);
}

console.log('⬆️   Firestore 업로드 중...\n');
let uploaded = 0;
for (const cafe of toUpload) {
  await addDoc(collection(db, 'restaurants'), {
    ...cafe,
    createdAt: serverTimestamp(),
  });
  uploaded++;
  process.stdout.write(`\r  진행: ${uploaded} / ${toUpload.length}개`);
}

console.log(`\n\n${'━'.repeat(52)}`);
console.log(`  업로드 완료: ${uploaded}개`);
if (skipped > 0) console.log(`  중복 skip  : ${skipped}개`);
console.log(`${'━'.repeat(52)}\n`);
process.exit(0);

#!/usr/bin/env node
// Firestore 보안 규칙 단위 테스트 — Firebase Rules API `projects.test` 만 호출한다.
// 배포(rulesets.create / releases.*)는 절대 호출하지 않는다. Firestore/Auth 에 쓰지 않는다.
//
// 실행:  node scripts/test-firestore-rules.mjs            (프로젝트 루트에서)
//        RULES_VERBOSE=1 node scripts/test-firestore-rules.mjs   (실패 케이스 debugMessages 전체)
//
// 필요 권한: serviceAccountKey.json 의 서비스 계정에 `firebaserules.rulesets.test`
//   (예: "Firebase Rules Viewer" 역할 roles/firebaserules.viewer). 키는 런타임에 읽기만 한다.
//
// 앱 페이로드 출처 (필드 집합을 그대로 복제):
//   brands/foods  src/components/UserSubmitModal.js → src/firebase/dbService.js addBrand/addFood
//   reviews       src/screens/RestaurantScreen.js submitReview → dbService.addReview
//                 src/screens/AdminScreen.js 제보 반영 → dbService.addReviewFromAdmin
//   restaurants   src/screens/RestaurantScreen.js saveFromPlaces → dbService.addRestaurant
//   userReports   src/components/ReportModal.js → dbService.addUserReport
//   users         src/firebase/authService.js signUp

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(ROOT, 'package.json'));
const { GoogleAuth } = require('google-auth-library');

const PROJECT = 'peanutfree1';
const ENDPOINT = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`;
const VERBOSE = !!process.env.RULES_VERBOSE;

const T = '2026-09-13T01:02:03.456Z';        // request.time 와 serverTimestamp() 가 같은 값
const T_OTHER = '2020-01-01T00:00:00Z';      // 클라이언트가 임의로 넣은 시각
const DB = '/databases/(default)/documents';

// ── 역할 ─────────────────────────────────────────────────────
// 규칙의 exists() 호출은 admins/{uid} 조회 하나뿐이므로, 호출자 역할로 결과를 고정한다.
const ROLES = {
  ADMIN: { auth: { uid: 'ADMIN', token: {} }, admin: true },
  A: { auth: { uid: 'A', token: {} }, admin: false },
  B: { auth: { uid: 'B', token: {} }, admin: false },
  UNAUTH: { auth: null, admin: false },
};

function tc(name, expectation, who, method, path, { existing, incoming } = {}) {
  const role = ROLES[who];
  const request = { auth: role.auth, path: `${DB}/${path}`, method, time: T };
  if (incoming) request.resource = { data: incoming };
  const c = {
    expectation,
    request,
    functionMocks: [
      { function: 'exists', args: [{ anyValue: {} }], result: { value: role.admin } },
    ],
  };
  if (existing) c.resource = { data: existing };
  return { name, case: c };
}

// ── 실제 클라이언트 페이로드 ─────────────────────────────────
const brandPayload = (uid, over = {}) => ({
  img: '🍫', risk: 'caution', src: 'user',
  submittedBy: uid, submitterName: '익명',
  ko: { name: '테스트', cat: '과자', reason: '이유', tags: [], note: null },
  en: { name: '테스트', cat: '과자', reason: '이유', tags: [], note: null },
  status: 'pending', likes: [], createdAt: T,
  ...over,
});
const foodPayload = (uid, over = {}) => brandPayload(uid, { brand: '제조사', ...over });

const reviewPayload = (uid, over = {}) => ({
  risk: 'safe', address: '서울 강남구', rating: 5, author: '익명', date: '2026.09.13',
  lat: 37.5, lng: 127.0, cuisineType: '한식',
  ko: { name: '식당', cat: '기타', tags: [], review: '좋음' },
  en: { name: '식당', cat: '기타', tags: [], review: '좋음' },
  submittedBy: uid, createdAt: T, status: 'pending',
  ...over,
});
// AdminScreen 제보 반영 경로 (cuisineType 은 inferCuisineForReview 결과)
const adminReviewPayload = (uid) => ({
  ko: { name: '식당', cat: '식당', review: '' },
  en: { name: '식당', cat: 'Restaurant', review: '' },
  risk: 'danger', author: '익명', date: '2026-09-13', address: '서울',
  lat: 37.5, lng: 127.0,
  cuisineType: '기타', submittedBy: uid, createdAt: T, status: 'approved',
});

const restaurantPayload = (uid, over = {}) => ({
  name: '새 식당', branch: '', district: '강남구', address: '서울 강남구 1',
  cuisineType: '한식', peanutRiskTier: 'unknown',
  allergyGuidanceLikelihood: '', whyFlagged: '', recommendedAction: '',
  peanutHandlingBasis: '', recommendedSaferItems: '', cautionOrExclusion: '',
  confidence: 'low', isVerified: false,
  placeId: 'ChIJxxxx', googleRating: 4.3, googleRatingCount: null,
  createdBy: uid, createdAt: T,
  ...over,
});

const userReportPayload = (uid) => ({
  targetType: 'brand', targetId: 'b1', targetName: '브랜드', targetImg: '',
  experienceType: 'ate_safe', experienceTypes: ['ate_safe'],
  risk: 'safe', scope: 'all', menuItem: '', note: '', address: '',
  hasLocation: false, lat: null, lng: null,
  userId: uid, userNickname: '익명', createdAt: T,
});

const userProfile = (uid) => ({
  uid, email: 'a@example.com', nickname: 'n', role: 'member',
  trustScore: 0, reportCount: 0, reviewCount: 0, createdAt: T,
});

const approved = (over = {}) => brandPayload('C', { status: 'approved', likes: [], risk: 'caution', ...over });
const pendingByA = (over = {}) => brandPayload('A', { status: 'pending', ...over });

// ── 케이스 ──────────────────────────────────────────────────
const cases = [];
const add = (...a) => cases.push(tc(...a));

// 1. 승인 문서 읽기: 로그인 필수
for (const col of ['brands', 'foods', 'reviews']) {
  add(`1 ${col} get approved unauth`, 'DENY', 'UNAUTH', 'get', `${col}/x`, { existing: approved() });
  add(`1 ${col} get approved A`, 'ALLOW', 'A', 'get', `${col}/x`, { existing: approved() });
  add(`1 ${col} list approved unauth`, 'DENY', 'UNAUTH', 'list', `${col}/x`, { existing: approved() });
}

// 2. pending 본인/타인/관리자
add('2 brands get pending B', 'DENY', 'B', 'get', 'brands/x', { existing: pendingByA() });
add('2 brands get pending A(submitter)', 'ALLOW', 'A', 'get', 'brands/x', { existing: pendingByA() });
add('2 brands get pending ADMIN', 'ALLOW', 'ADMIN', 'get', 'brands/x', { existing: pendingByA() });
add('2 brands get rejected A(submitter)', 'ALLOW', 'A', 'get', 'brands/x', { existing: pendingByA({ status: 'rejected' }) });
add('2 brands get pending unauth', 'DENY', 'UNAUTH', 'get', 'brands/x', { existing: pendingByA() });

// 3. 브랜드/식품 생성
for (const [col, p] of [['brands', brandPayload], ['foods', foodPayload]]) {
  add(`3 ${col} create client payload A`, 'ALLOW', 'A', 'create', `${col}/x`, { incoming: p('A') });
  add(`3 ${col} create status approved A`, 'DENY', 'A', 'create', `${col}/x`, { incoming: p('A', { status: 'approved' }) });
  add(`3 ${col} create submittedBy B by A`, 'DENY', 'A', 'create', `${col}/x`, { incoming: p('B') });
  add(`3 ${col} create unauth`, 'DENY', 'UNAUTH', 'create', `${col}/x`, { incoming: p('A') });
  add(`3 ${col} create pre-liked A`, 'DENY', 'A', 'create', `${col}/x`, { incoming: p('A', { likes: ['A'] }) });
  add(`3 ${col} create bad risk A`, 'DENY', 'A', 'create', `${col}/x`, { incoming: p('A', { risk: 'nearby' }) });
  add(`3 ${col} create forged createdAt A`, 'DENY', 'A', 'create', `${col}/x`, { incoming: p('A', { createdAt: T_OTHER }) });
}

// 4. 좋아요 추가
add('4 like add [A] by A', 'ALLOW', 'A', 'update', 'brands/x', { existing: approved(), incoming: approved({ likes: ['A'] }) });
add('4 like add [A,B] by A', 'DENY', 'A', 'update', 'brands/x', { existing: approved(), incoming: approved({ likes: ['A', 'B'] }) });
add('4 like [A] + risk safe by A', 'DENY', 'A', 'update', 'brands/x', { existing: approved(), incoming: approved({ likes: ['A'], risk: 'safe' }) });
add('4 like add [A,A] by A', 'DENY', 'A', 'update', 'brands/x', { existing: approved(), incoming: approved({ likes: ['A', 'A'] }) });
add('4 like add unauth', 'DENY', 'UNAUTH', 'update', 'brands/x', { existing: approved(), incoming: approved({ likes: ['A'] }) });
add('4 foods like add [A] by A', 'ALLOW', 'A', 'update', 'foods/x', { existing: approved(), incoming: approved({ likes: ['A'] }) });

// 5. 좋아요 제거 / likes 필드 없음
add('5 like remove self by A', 'ALLOW', 'A', 'update', 'brands/x', { existing: approved({ likes: ['A', 'B'] }), incoming: approved({ likes: ['B'] }) });
add('5 like remove other by A', 'DENY', 'A', 'update', 'brands/x', { existing: approved({ likes: ['A', 'B'] }), incoming: approved({ likes: ['A'] }) });
{
  const noLikes = approved(); delete noLikes.likes;
  add('5 like add on doc without likes by A', 'ALLOW', 'A', 'update', 'brands/x', { existing: noLikes, incoming: { ...noLikes, likes: ['A'] } });
}

// 6. pending 문서 수정/삭제
add('6 pending likes change by A', 'DENY', 'A', 'update', 'brands/x', { existing: pendingByA(), incoming: pendingByA({ likes: ['A'] }) });
add('6 pending approve by ADMIN', 'ALLOW', 'ADMIN', 'update', 'brands/x', { existing: pendingByA(), incoming: pendingByA({ status: 'approved', reviewedAt: T }) });
add('6 pending approve by A(submitter)', 'DENY', 'A', 'update', 'brands/x', { existing: pendingByA(), incoming: pendingByA({ status: 'approved' }) });
add('6 pending risk by ADMIN', 'ALLOW', 'ADMIN', 'update', 'brands/x', { existing: pendingByA(), incoming: pendingByA({ risk: 'danger' }) });
add('6 delete by ADMIN', 'ALLOW', 'ADMIN', 'delete', 'brands/x', { existing: pendingByA() });
add('6 delete by A', 'DENY', 'A', 'delete', 'brands/x', { existing: pendingByA() });
add('6 foods delete by A', 'DENY', 'A', 'delete', 'foods/x', { existing: pendingByA() });

// 7. 리뷰 생성
add('7 reviews create client payload A', 'ALLOW', 'A', 'create', 'reviews/x', { incoming: reviewPayload('A') });
add('7 reviews create cuisine 카페 A', 'DENY', 'A', 'create', 'reviews/x', { incoming: reviewPayload('A', { cuisineType: '카페' }) });
add('7 reviews create cuisine missing A', 'DENY', 'A', 'create', 'reviews/x', { incoming: (() => { const p = reviewPayload('A'); delete p.cuisineType; return p; })() });
add('7 reviews create approved by A', 'DENY', 'A', 'create', 'reviews/x', { incoming: reviewPayload('A', { status: 'approved' }) });
add('7 reviews create submittedBy B by A', 'DENY', 'A', 'create', 'reviews/x', { incoming: reviewPayload('B') });
add('7 reviews create unauth', 'DENY', 'UNAUTH', 'create', 'reviews/x', { incoming: reviewPayload('A') });
add('7 reviews create approved by ADMIN (admin path)', 'ALLOW', 'ADMIN', 'create', 'reviews/x', { incoming: adminReviewPayload('ADMIN') });
add('7 reviews create pending by ADMIN (addReview)', 'ALLOW', 'ADMIN', 'create', 'reviews/x', { incoming: reviewPayload('ADMIN') });
add('7 reviews create published by A (1.0.2 shape)', 'DENY', 'A', 'create', 'reviews/x', { incoming: reviewPayload('A', { status: 'published' }) });

// 8. 리뷰 읽기
const reviewApproved = reviewPayload('C', { status: 'approved' });
add('8 reviews get approved A', 'ALLOW', 'A', 'get', 'reviews/x', { existing: reviewApproved });
add('8 reviews get approved unauth', 'DENY', 'UNAUTH', 'get', 'reviews/x', { existing: reviewApproved });
add('8 reviews get published(legacy) ADMIN', 'ALLOW', 'ADMIN', 'get', 'reviews/x', { existing: reviewPayload('C', { status: 'published' }) });
add('8 reviews list pending ADMIN', 'ALLOW', 'ADMIN', 'list', 'reviews/x', { existing: reviewPayload('B') });
add('8 reviews list pending A(not submitter)', 'DENY', 'A', 'list', 'reviews/x', { existing: reviewPayload('B') });
add('8 reviews list own pending A (계정삭제 쿼리)', 'ALLOW', 'A', 'list', 'reviews/x', { existing: reviewPayload('A') });
{
  const legacy = reviewPayload('C'); delete legacy.status; delete legacy.submittedBy;
  add('8 reviews get no-status legacy ADMIN', 'ALLOW', 'ADMIN', 'get', 'reviews/x', { existing: legacy });
  add('8 reviews get no-status legacy A', 'DENY', 'A', 'get', 'reviews/x', { existing: legacy });
}
add('8 reviews update by A', 'DENY', 'A', 'update', 'reviews/x', { existing: reviewPayload('A'), incoming: reviewPayload('A', { status: 'approved' }) });
add('8 reviews update cuisine by ADMIN', 'ALLOW', 'ADMIN', 'update', 'reviews/x', { existing: reviewApproved, incoming: { ...reviewApproved, cuisineType: '중식' } });

// 9. 리뷰 삭제
add('9 reviews delete own A', 'ALLOW', 'A', 'delete', 'reviews/x', { existing: reviewPayload('A', { status: 'approved' }) });
add('9 reviews delete by B', 'DENY', 'B', 'delete', 'reviews/x', { existing: reviewPayload('A') });
{
  const noSub = reviewPayload('A'); delete noSub.submittedBy;
  add('9 reviews delete no submittedBy by A', 'DENY', 'A', 'delete', 'reviews/x', { existing: noSub });
  add('9 reviews delete no submittedBy by ADMIN', 'ALLOW', 'ADMIN', 'delete', 'reviews/x', { existing: noSub });
}

// 10. userReports
add('10 userReports create A', 'ALLOW', 'A', 'create', 'userReports/x', { incoming: userReportPayload('A') });
add('10 userReports create userId B by A', 'DENY', 'A', 'create', 'userReports/x', { incoming: userReportPayload('B') });
add('10 userReports create unauth', 'DENY', 'UNAUTH', 'create', 'userReports/x', { incoming: userReportPayload('A') });
add('10 userReports delete own A', 'ALLOW', 'A', 'delete', 'userReports/x', { existing: userReportPayload('A') });
add('10 userReports delete other B', 'DENY', 'B', 'delete', 'userReports/x', { existing: userReportPayload('A') });
add('10 userReports delete by ADMIN', 'ALLOW', 'ADMIN', 'delete', 'userReports/x', { existing: userReportPayload('A') });
add('10 userReports get A', 'ALLOW', 'A', 'get', 'userReports/x', { existing: userReportPayload('B') });
add('10 userReports list A', 'ALLOW', 'A', 'list', 'userReports/x', { existing: userReportPayload('B') });
add('10 userReports get unauth', 'DENY', 'UNAUTH', 'get', 'userReports/x', { existing: userReportPayload('A') });
add('10 userReports update own A', 'DENY', 'A', 'update', 'userReports/x', { existing: userReportPayload('A'), incoming: { ...userReportPayload('A'), risk: 'danger' } });

// 11. restaurants
add('11 restaurants create places payload A', 'ALLOW', 'A', 'create', 'restaurants/x', { incoming: restaurantPayload('A') });
add('11 restaurants create tier low A', 'DENY', 'A', 'create', 'restaurants/x', { incoming: restaurantPayload('A', { peanutRiskTier: 'low' }) });
add('11 restaurants create extra field A', 'DENY', 'A', 'create', 'restaurants/x', { incoming: restaurantPayload('A', { status: 'approved' }) });
add('11 restaurants create createdBy B by A', 'DENY', 'A', 'create', 'restaurants/x', { incoming: restaurantPayload('B') });
add('11 restaurants create verified A', 'DENY', 'A', 'create', 'restaurants/x', { incoming: restaurantPayload('A', { isVerified: true }) });
add('11 restaurants create whyFlagged A', 'DENY', 'A', 'create', 'restaurants/x', { incoming: restaurantPayload('A', { whyFlagged: '안전' }) });
add('11 restaurants create unauth', 'DENY', 'UNAUTH', 'create', 'restaurants/x', { incoming: restaurantPayload('A') });
add('11 restaurants get A', 'ALLOW', 'A', 'get', 'restaurants/x', { existing: restaurantPayload('C') });
add('11 restaurants list unauth', 'DENY', 'UNAUTH', 'list', 'restaurants/x', { existing: restaurantPayload('C') });
add('11 restaurants update A', 'DENY', 'A', 'update', 'restaurants/x', { existing: restaurantPayload('A'), incoming: restaurantPayload('A', { peanutRiskTier: 'low' }) });

// 12. admins
add('12 admins get own A', 'ALLOW', 'A', 'get', 'admins/A', { existing: {} });
add('12 admins get A by B', 'DENY', 'B', 'get', 'admins/A', { existing: {} });
add('12 admins list A', 'DENY', 'A', 'list', 'admins/B', { existing: {} });
add('12 admins create by ADMIN', 'DENY', 'ADMIN', 'create', 'admins/B', { incoming: { x: 1 } });
add('12 admins update by ADMIN', 'DENY', 'ADMIN', 'update', 'admins/ADMIN', { existing: {}, incoming: { x: 1 } });
add('12 admins delete by ADMIN', 'DENY', 'ADMIN', 'delete', 'admins/ADMIN', { existing: {} });

// 13. users
add('13 users get own A', 'ALLOW', 'A', 'get', 'users/A', { existing: userProfile('A') });
add('13 users create own A (signUp)', 'ALLOW', 'A', 'create', 'users/A', { incoming: userProfile('A') });
add('13 users update own A (ProfileSetup)', 'ALLOW', 'A', 'update', 'users/A', { existing: userProfile('A'), incoming: { ...userProfile('A'), profileComplete: true, updatedAt: T } });
add('13 users delete own A', 'ALLOW', 'A', 'delete', 'users/A', { existing: userProfile('A') });
add('13 users get A by B', 'DENY', 'B', 'get', 'users/A', { existing: userProfile('A') });
add('13 users update A by B', 'DENY', 'B', 'update', 'users/A', { existing: userProfile('A'), incoming: userProfile('A') });
add('13 users get A unauth', 'DENY', 'UNAUTH', 'get', 'users/A', { existing: userProfile('A') });

// 14. inviteCodes / requests
add('14 inviteCodes list A', 'ALLOW', 'A', 'list', 'inviteCodes/x', { existing: { code: 'ABC', active: true } });
add('14 inviteCodes create A', 'DENY', 'A', 'create', 'inviteCodes/x', { incoming: { code: 'ABC', active: true } });
add('14 inviteCodes create ADMIN', 'DENY', 'ADMIN', 'create', 'inviteCodes/x', { incoming: { code: 'ABC', active: true } });
add('14 requests create A', 'ALLOW', 'A', 'create', 'requests/x', { incoming: { name: 'n', status: 'pending', createdAt: T } });
add('14 requests get A', 'DENY', 'A', 'get', 'requests/x', { existing: { status: 'pending' } });
add('14 requests list ADMIN', 'ALLOW', 'ADMIN', 'list', 'requests/x', { existing: { status: 'pending' } });
add('14 requests delete ADMIN', 'DENY', 'ADMIN', 'delete', 'requests/x', { existing: { status: 'pending' } });

// 15. 규칙 없는 컬렉션은 기본 거부 (favorites 는 앱에서 미사용)
add('15 favorites create A', 'DENY', 'A', 'create', 'favorites/x', { incoming: { userId: 'A', itemId: 'i', itemType: 'brand', createdAt: T } });

// 16. feedback (앱 안 의견)
add('16 feedback create A', 'ALLOW', 'A', 'create', 'feedback/x', { incoming: { createdBy: 'A', message: '검색이 안 돼요', where: 'restaurant', kind: 'bug', contact: '', appVersion: '1.0.4', platform: 'android 34', createdAt: T } });
add('16 feedback create A 빈 메시지', 'ALLOW', 'A', 'create', 'feedback/x', { incoming: { createdBy: 'A', message: '', where: null, kind: 'good', contact: '', appVersion: '1.0.4', platform: 'android 34', createdAt: T } });
add('16 feedback create 남의 uid', 'DENY', 'A', 'create', 'feedback/x', { incoming: { createdBy: 'B', message: 'x', createdAt: T } });
add('16 feedback create 비로그인', 'DENY', 'UNAUTH', 'create', 'feedback/x', { incoming: { createdBy: 'A', message: 'x', createdAt: T } });
add('16 feedback get A', 'DENY', 'A', 'get', 'feedback/x', { existing: { createdBy: 'A', message: 'x' } });
add('16 feedback list ADMIN', 'ALLOW', 'ADMIN', 'list', 'feedback/x', { existing: { createdBy: 'A', message: 'x' } });
add('16 feedback delete ADMIN', 'DENY', 'ADMIN', 'delete', 'feedback/x', { existing: { createdBy: 'A', message: 'x' } });

// ── 실행 ────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--list')) {
    cases.forEach(c => console.log(`${c.case.expectation.padEnd(5)} ${c.name}`));
    console.log(`${cases.length} cases`);
    return;
  }
  const key = JSON.parse(readFileSync(resolve(ROOT, 'serviceAccountKey.json'), 'utf8'));
  const auth = new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const token = (await (await auth.getClient()).getAccessToken()).token;
  const content = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: { files: [{ name: 'firestore.rules', content }] },
      testSuite: { testCases: cases.map(c => c.case) },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, JSON.stringify(json.error || json, null, 2));
    if (res.status === 403) {
      console.error(`\n→ 서비스 계정에 firebaserules.rulesets.test 권한이 없습니다 (예: roles/firebaserules.viewer 부여 필요).`);
    }
    process.exit(2);
  }

  const lines = content.split('\n');
  if (json.issues?.length) {
    console.log(`컴파일 issues ${json.issues.length}건:`);
    for (const i of json.issues) {
      const p = i.sourcePosition || {};
      console.log(`  [${i.severity}] ${p.line}:${p.column} ${i.description}`);
    }
  } else {
    console.log('컴파일 issues: 없음');
  }

  const results = json.testResults || [];
  let pass = 0;
  results.forEach((r, idx) => {
    const { name, case: c } = cases[idx];
    if (r.state === 'SUCCESS') { pass++; if (VERBOSE) console.log(`  ok   ${name}`); return; }
    const pos = r.errorPosition ? ` @${r.errorPosition.line}:${r.errorPosition.column} \`${(lines[r.errorPosition.line - 1] || '').trim()}\`` : '';
    console.log(`  FAIL ${name} (expected ${c.expectation})${pos}`);
    for (const m of r.debugMessages || []) console.log(`       debug: ${m}`);
    if (VERBOSE) for (const f of r.functionCalls || []) console.log(`       call: ${JSON.stringify(f)}`);
  });
  console.log(`\n${pass}/${cases.length} 통과`);
  process.exit(pass === cases.length && results.length === cases.length && !json.issues?.some(i => i.severity === 'ERROR') ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });

// src/firebase/dbService.js
// ─────────────────────────────────────────────────────────────
// Firestore DB 읽기/쓰기 함수 모음
// ─────────────────────────────────────────────────────────────
import {
  collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from './config';

// ── 검수(모더레이션) 상태 ─────────────────────────────────────
// 사용자 제보(brands/foods/reviews)는 'pending'으로 저장되고 관리자 승인 후
// 'approved'가 되어야 일반 사용자에게 보인다.
// Firestore 보안 규칙은 필터가 아니므로, 일반 사용자 쿼리는 반드시
// where('status','==','approved')를 포함해야 규칙상 허용된다.
export const STATUS_APPROVED = 'approved';
export const STATUS_PENDING = 'pending';
export const STATUS_REJECTED = 'rejected';
export const MODERATED_COLLECTIONS = ['brands', 'foods', 'reviews'];

function approvedQuery(collectionName) {
  return query(collection(db, collectionName), where('status', '==', STATUS_APPROVED));
}

function sortByCreatedDesc(docs) {
  return docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// ── 브랜드 ──────────────────────────────────────────────────

/** 모든 브랜드 불러오기 */
export async function fetchBrands() {
  const snap = await getDocs(approvedQuery('brands'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** 브랜드 실시간 구독 (앱 켜져 있는 동안 자동 업데이트) */
export function subscribeBrands(callback, onError) {
  return onSnapshot(
    approvedQuery('brands'),
    snap => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err => {
      console.error('subscribeBrands error:', err);
      if (onError) onError(err);
    }
  );
}

// ── 식품/과자 ────────────────────────────────────────────────

export async function fetchFoods() {
  const snap = await getDocs(approvedQuery('foods'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeFoods(callback, onError) {
  return onSnapshot(
    approvedQuery('foods'),
    snap => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err => {
      console.error('subscribeFoods error:', err);
      if (onError) onError(err);
    }
  );
}

/** 바코드로 식품 검색 (승인된 항목만) */
export async function fetchFoodByBarcode(barcode) {
  // status + barcode 두 개의 등호 조건은 단일 필드 인덱스 병합으로 처리되어 복합 인덱스가 필요 없다.
  const q = query(
    collection(db, 'foods'),
    where('status', '==', STATUS_APPROVED),
    where('barcode', '==', barcode),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ── 식당 리뷰 ────────────────────────────────────────────────

// where(status) + orderBy(createdAt) 조합은 복합 인덱스가 필요하므로
// where 만으로 조회하고 정렬은 클라이언트에서 한다.
export async function fetchReviews() {
  const snap = await getDocs(approvedQuery('reviews'));
  return sortByCreatedDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

export function subscribeReviews(callback, onError) {
  return onSnapshot(
    approvedQuery('reviews'),
    snap => { callback(sortByCreatedDesc(snap.docs.map(d => ({ id: d.id, ...d.data() })))); },
    err => {
      console.warn('[subscribeReviews] code:', err.code);
      if (onError) onError(err);
    }
  );
}

/** 새 리뷰 추가 — 검수 대기(pending)로 저장. uid 는 submittedBy 에 기록 */
export async function addReview(reviewData, uid) {
  if (!uid) throw new Error('addReview: uid required');
  return await addDoc(collection(db, 'reviews'), {
    ...reviewData,
    submittedBy: uid,
    createdAt: serverTimestamp(),
    status: STATUS_PENDING,
  });
}

/** restaurants 컬렉션에 항목 추가 (Google Places 등 외부 소스) */
export async function addRestaurant(data, uid) {
  if (!uid) throw new Error('addRestaurant: uid required');
  return await addDoc(collection(db, 'restaurants'), {
    ...data,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}

/** restaurants 컬렉션 실시간 구독 */
export function subscribeRestaurants(callback, onError) {
  return onSnapshot(
    collection(db, 'restaurants'),
    snap => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err => {
      // console.warn 사용: Expo LogBox 토스트 억제, 콘솔에는 전체 내용 출력
      console.warn('[subscribeRestaurants] code:', err.code, '| message:', err.message);
      if (onError) onError(err);
    }
  );
}

/** 리뷰 필드 수정 (관리자용) */
export async function updateReview(id, data) {
  await updateDoc(doc(db, 'reviews', id), data);
}

/** 리뷰 삭제 (관리자용) */
export async function deleteReview(id) {
  await deleteDoc(doc(db, 'reviews', id));
}

// ── 초대 요청 ────────────────────────────────────────────────

export async function fetchRequests() {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addRequest(reqData) {
  return await addDoc(collection(db, 'requests'), {
    ...reqData,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function updateRequestStatus(id, status) {
  await updateDoc(doc(db, 'requests', id), { status });
}

// ── 초대 코드 검증 ───────────────────────────────────────────

export async function validateInviteCode(code) {
  const q = query(
    collection(db, 'inviteCodes'),
    where('code', '==', code.toUpperCase()),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/** 사용자 브랜드 제보 — 검수 대기(pending)로 저장 */
export async function addBrand(data, uid) {
  if (!uid) throw new Error('addBrand: uid required');
  return await addDoc(collection(db, 'brands'), {
    ...data,
    submittedBy: uid,
    status: STATUS_PENDING,
    likes: [],
    createdAt: serverTimestamp(),
  });
}

/** 사용자 식품 제보 — 검수 대기(pending)로 저장 */
export async function addFood(data, uid) {
  if (!uid) throw new Error('addFood: uid required');
  return await addDoc(collection(db, 'foods'), {
    ...data,
    submittedBy: uid,
    status: STATUS_PENDING,
    likes: [],
    createdAt: serverTimestamp(),
  });
}

/** 좋아요 토글 (brands 또는 foods 컬렉션) */
export async function toggleLike(collectionName, docId, uid) {
  const ref = doc(db, collectionName, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const likes = snap.data().likes || [];
  const isLiked = likes.includes(uid);
  await updateDoc(ref, {
    likes: isLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

// ── 어드민 검증 ──────────────────────────────────────────────

/** Firestore admins 컬렉션에서 서버 사이드로 어드민 여부 확인 */
export async function checkIsAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

// ── 검수 (관리자용) ──────────────────────────────────────────

/** 검수 대기 항목 구독 (brands | foods | reviews). 관리자만 규칙상 허용 */
export function subscribePending(collectionName, callback, onError) {
  const q = query(collection(db, collectionName), where('status', '==', STATUS_PENDING));
  return onSnapshot(
    q,
    snap => { callback(sortByCreatedDesc(snap.docs.map(d => ({ id: d.id, _collection: collectionName, ...d.data() })))); },
    err => {
      console.warn(`[subscribePending:${collectionName}] code:`, err.code);
      if (onError) onError(err);
    }
  );
}

function assertModerated(collectionName) {
  if (!MODERATED_COLLECTIONS.includes(collectionName)) {
    throw new Error(`not a moderated collection: ${collectionName}`);
  }
}

/** 검수 상태 변경 (approved | rejected | pending) */
export async function setModerationStatus(collectionName, id, status) {
  assertModerated(collectionName);
  if (![STATUS_APPROVED, STATUS_REJECTED, STATUS_PENDING].includes(status)) {
    throw new Error(`invalid status: ${status}`);
  }
  await updateDoc(doc(db, collectionName, id), {
    status,
    reviewedAt: serverTimestamp(),
  });
}

/** 검수 중 위험도 변경 */
export async function setModerationRisk(collectionName, id, risk) {
  assertModerated(collectionName);
  if (!['safe', 'caution', 'danger', 'info'].includes(risk)) {
    throw new Error(`invalid risk: ${risk}`);
  }
  await updateDoc(doc(db, collectionName, id), { risk });
}

// ── 즐겨찾기 (Firestore 동기화 버전) ────────────────────────
// ⚠️ 현재 미사용: 즐겨찾기는 MyScreen 에서 AsyncStorage(기기 로컬)로 관리한다.

export async function fetchFavorites(userId) {
  const q = query(collection(db, 'favorites'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addFavorite(userId, itemId, itemType) {
  return await addDoc(collection(db, 'favorites'), {
    userId, itemId, itemType,
    createdAt: serverTimestamp(),
  });
}

export async function removeFavorite(favoriteDocId) {
  await deleteDoc(doc(db, 'favorites', favoriteDocId));
}

// ── 사용자 기록 ──────────────────────────────────────────

export async function addUserReport(reportData) {
  return await addDoc(collection(db, 'userReports'), {
    ...reportData,
    createdAt: serverTimestamp(),
  });
}

export function subscribeUserReports(targetId, callback) {
  const q = query(collection(db, 'userReports'), where('targetId', '==', targetId));
  return onSnapshot(q,
    snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(docs);
    },
    () => callback([])
  );
}

export function subscribeMapReports(callback) {
  const q = query(collection(db, 'userReports'), where('hasLocation', '==', true));
  return onSnapshot(q,
    snap => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err => console.error('subscribeMapReports error:', err)
  );
}

// ── 유저 프로필 ──────────────────────────────────────────────

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

// ── 계정 삭제 시 사용자 데이터 정리 ─────────────────────────
/**
 * 본인 Firestore 데이터를 삭제한다. 인증이 살아 있는 동안(deleteUser 전)에 호출.
 * - users/{uid} 문서 삭제
 * - 본인 userReports 삭제 (규칙: 작성자 삭제 허용)
 * - 본인이 쓴 reviews 삭제 (submittedBy 기록된 1.0.3 이후 리뷰만 식별 가능.
 *   새 규칙 배포 전에는 권한 거부 → 결과에 실패 건수로 남는다)
 * - 승인된 brands/foods 의 likes 배열에서 본인 uid 제거 (새 규칙 배포 전에는 거부될 수 있음)
 * 반환: { deleted: {...}, failed: {...} }
 */
export async function deleteUserData(uid) {
  if (!uid) throw new Error('deleteUserData: uid required');
  const result = { deleted: {}, failed: {} };
  const bump = (bucket, key) => { result[bucket][key] = (result[bucket][key] || 0) + 1; };

  async function deleteByQuery(key, q) {
    let snap;
    try { snap = await getDocs(q); } catch { bump('failed', key); return; }
    await Promise.all(snap.docs.map(d =>
      deleteDoc(d.ref).then(() => bump('deleted', key)).catch(() => bump('failed', key))
    ));
  }

  await deleteByQuery('userReports', query(collection(db, 'userReports'), where('userId', '==', uid)));
  await deleteByQuery('reviews', query(collection(db, 'reviews'), where('submittedBy', '==', uid)));

  for (const name of ['brands', 'foods']) {
    try {
      // array-contains + status 조합의 인덱스 요구를 피하려고 승인 문서를 받아 클라이언트에서 거른다 (수십 건 규모)
      const snap = await getDocs(approvedQuery(name));
      const mine = snap.docs.filter(d => (d.data().likes || []).includes(uid));
      await Promise.all(mine.map(d =>
        updateDoc(d.ref, { likes: arrayRemove(uid) })
          .then(() => bump('deleted', `${name}.likes`))
          .catch(() => bump('failed', `${name}.likes`))
      ));
    } catch {
      bump('failed', `${name}.likes`);
    }
  }

  // 프로필 문서는 마지막에 삭제 (앞 단계 실패와 무관하게 반드시 시도)
  await deleteDoc(doc(db, 'users', uid));
  bump('deleted', 'users');
  return result;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

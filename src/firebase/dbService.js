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

// ── 브랜드 ──────────────────────────────────────────────────

/** 모든 브랜드 불러오기 */
export async function fetchBrands() {
  const snap = await getDocs(collection(db, 'brands'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** 브랜드 실시간 구독 (앱 켜져 있는 동안 자동 업데이트) */
export function subscribeBrands(callback, onError) {
  return onSnapshot(
    collection(db, 'brands'),
    snap => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err => {
      console.error('subscribeBrands error:', err);
      if (onError) onError(err);
    }
  );
}

// ── 식품/과자 ────────────────────────────────────────────────

export async function fetchFoods() {
  const snap = await getDocs(collection(db, 'foods'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeFoods(callback, onError) {
  return onSnapshot(
    collection(db, 'foods'),
    snap => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err => {
      console.error('subscribeFoods error:', err);
      if (onError) onError(err);
    }
  );
}

/** 바코드로 식품 검색 */
export async function fetchFoodByBarcode(barcode) {
  const q = query(collection(db, 'foods'), where('barcode', '==', barcode));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ── 식당 리뷰 ────────────────────────────────────────────────

export async function fetchReviews() {
  const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeReviews(callback) {
  const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** 새 리뷰 추가 */
export async function addReview(reviewData) {
  return await addDoc(collection(db, 'reviews'), {
    ...reviewData,
    createdAt: serverTimestamp(),
    status: 'published',
  });
}

/** restaurants 컬렉션에 항목 추가 (Google Places 등 외부 소스) */
export async function addRestaurant(data) {
  return await addDoc(collection(db, 'restaurants'), {
    ...data,
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

/** 사용자 브랜드 제보 */
export async function addBrand(data) {
  return await addDoc(collection(db, 'brands'), {
    ...data,
    likes: [],
    createdAt: serverTimestamp(),
  });
}

/** 사용자 식품 제보 */
export async function addFood(data) {
  return await addDoc(collection(db, 'foods'), {
    ...data,
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

// ── 즐겨찾기 (Firestore 동기화 버전) ────────────────────────

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

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

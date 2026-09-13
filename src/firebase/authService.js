import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { deleteUserData } from './dbService';

export async function signUp(email, password, nickname) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: nickname });
  await sendEmailVerification(user);
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email,
    nickname,
    role: 'member',
    trustScore: 0,
    reportCount: 0,
    reviewCount: 0,
    createdAt: serverTimestamp(),
  });
  return user;
}

export async function signIn(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function logout() {
  await signOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── 계정 삭제 ────────────────────────────────────────────────

// Firebase 는 최근 로그인(약 5분) 이후에만 deleteUser 를 허용한다. 여유를 두고 4분.
const RECENT_LOGIN_MS = 4 * 60 * 1000;

/** 재인증 없이 deleteUser 가 통과할 가능성이 높은지 */
export function hasRecentLogin() {
  const last = auth.currentUser?.metadata?.lastSignInTime;
  if (!last) return false;
  const t = new Date(last).getTime();
  return Number.isFinite(t) && Date.now() - t < RECENT_LOGIN_MS;
}

/** 이메일/비밀번호로 재인증 */
export async function reauthenticate(password) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('not signed in');
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

/**
 * 계정 즉시 삭제: 본인 Firestore 데이터 정리 → Firebase Auth 계정 삭제.
 * auth/requires-recent-login 이면 그대로 throw — 호출 측에서 reauthenticate 후 재시도.
 * 데이터 정리는 멱등이라 재시도해도 안전하다.
 * 반환: deleteUserData 결과 ({ deleted, failed })
 */
export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  const result = await deleteUserData(user.uid);
  await deleteUser(user);
  return result;
}

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

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
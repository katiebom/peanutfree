import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCfbHfW7k_irS0oCttFe9ijGtUNHmvHkkk",
  authDomain: "peanutfree1.firebaseapp.com",
  projectId: "peanutfree1",
  storageBucket: "peanutfree1.firebasestorage.app",
  messagingSenderId: "507912396290",
  appId: "1:507912396290:web:0b107c326ac511e9c1d11b"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
export default app;
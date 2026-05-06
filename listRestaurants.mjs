// listRestaurants.mjs
// 사용법: node listRestaurants.mjs
//         node listRestaurants.mjs --no-cuisine   (미설정 항목만)

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCfbHfW7k_irS0oCttFe9ijGtUNHmvHkkk',
  authDomain: 'peanutfree1.firebaseapp.com',
  projectId: 'peanutfree1',
  storageBucket: 'peanutfree1.firebasestorage.app',
  messagingSenderId: '507912396290',
  appId: '1:507912396290:web:0b107c326ac511e9c1d11b',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const onlyMissing = process.argv.includes('--no-cuisine');

const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));

const rows = snap.docs.map(d => {
  const data = d.data();
  return {
    id:          d.id,
    name:        data.ko?.name || data.name || '(이름없음)',
    cuisineType: data.cuisineType || '',
  };
});

const filtered = onlyMissing ? rows.filter(r => !r.cuisineType) : rows;

const header = '식당ID                          | 식당이름                    | cuisineType';
const line   = '-'.repeat(header.length);

console.log(header);
console.log(line);

filtered.forEach(r => {
  const id   = r.id.padEnd(32);
  const name = r.name.substring(0, 24).padEnd(26);
  const ct   = r.cuisineType || '(미설정)';
  console.log(`${id} | ${name} | ${ct}`);
});

console.log(line);
console.log(`총 ${filtered.length}개 출력 / 전체 ${rows.length}개`);
if (!onlyMissing) {
  const missing = rows.filter(r => !r.cuisineType).length;
  if (missing > 0) console.log(`⚠  cuisineType 미설정: ${missing}개  (--no-cuisine 옵션으로 미설정만 볼 수 있습니다)`);
}

process.exit(0);

// updateGoogleRatings.mjs
// Firebase restaurants 컬렉션의 기존 식당에 구글 평점/리뷰수 일괄 업데이트
// 실행: node updateGoogleRatings.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import https from 'https';

const firebaseConfig = {
  apiKey: "AIzaSyCfbHfW7k_irS0oCttFe9ijGtUNHmvHkkk",
  authDomain: "peanutfree1.firebaseapp.com",
  projectId: "peanutfree1",
  storageBucket: "peanutfree1.firebasestorage.app",
  messagingSenderId: "507912396290",
  appId: "1:507912396290:web:0b107c326ac511e9c1d11b"
};

const GOOGLE_PLACES_KEY = 'REDACTED_API_KEY';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function searchGooglePlaces(query) {
  const q = encodeURIComponent(query);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&language=ko&key=${GOOGLE_PLACES_KEY}`;
  const data = await httpsGet(url);
  if (data.status !== 'OK' || !data.results?.length) return null;
  const p = data.results[0];
  return {
    rating: p.rating ?? null,
    userRatingsTotal: p.user_ratings_total ?? null,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const snap = await getDocs(collection(db, 'restaurants'));
  const all = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

  // googleRating이 없는 식당만 처리
  const targets = all.filter(r => r.googleRating == null);
  console.log(`전체 ${all.length}개 중 평점 없는 식당: ${targets.length}개`);

  let updated = 0;
  let failed = 0;

  for (const r of targets) {
    const searchQuery = [r.name, r.branch, r.district].filter(Boolean).join(' ');
    process.stdout.write(`  [${updated + failed + 1}/${targets.length}] "${searchQuery}" 검색 중... `);

    try {
      const result = await searchGooglePlaces(searchQuery);
      if (result && result.rating != null) {
        await updateDoc(doc(db, 'restaurants', r.docId), {
          googleRating: result.rating,
          googleRatingCount: result.userRatingsTotal,
        });
        console.log(`✅ ${result.rating} (${result.userRatingsTotal ?? '?'}명)`);
        updated++;
      } else {
        console.log('❌ 결과 없음');
        failed++;
      }
    } catch (e) {
      console.log(`❌ 오류: ${e.message}`);
      failed++;
    }

    // API 한도 초과 방지 (200ms 간격)
    await sleep(200);
  }

  console.log(`\n완료: ${updated}개 업데이트, ${failed}개 실패`);
  process.exit(0);
}

main().catch(e => {
  console.error('오류:', e);
  process.exit(1);
});

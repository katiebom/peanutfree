// src/firebase/seedData.js
// ─────────────────────────────────────────────────────────────
// 초기 데이터를 Firestore에 업로드하는 스크립트
// 최초 1회만 실행하면 됩니다
//
// 실행 방법:
//   node src/firebase/seedData.js
// ─────────────────────────────────────────────────────────────
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, writeBatch } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCfbHfW7k_irS0oCttFe9ijGtUNHmvHkkk",
  authDomain: "peanutfree1.firebaseapp.com",
  projectId: "peanutfree1",
  storageBucket: "peanutfree1.firebasestorage.app",
  messagingSenderId: "507912396290",
  appId: "1:507912396290:web:0b107c326ac511e9c1d11b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BRANDS = [
  { id:"outback", img:"🥩", risk:"info", src:"user",
    ko:{ name:"아웃백", cat:"패밀리레스토랑", reason:"알레르기 정보 잘 안내. 메뉴별 확인 필요", tags:["알레르기 표기 있음"], note:"세이프알레르기 카페 추천" },
    en:{ name:"Outback", cat:"Family Restaurant", reason:"Allergy info well provided.", tags:["Allergy info available"], note:"Recommended by allergy community" } },
  { id:"kyochon", img:"🍗", risk:"safe", src:"user",
    ko:{ name:"교촌치킨", cat:"치킨", reason:"커뮤니티 확인 — 땅콩류 없음", tags:["땅콩류 없음"], note:null },
    en:{ name:"Kyochon Chicken", cat:"Fried Chicken", reason:"Community confirmed — no peanuts", tags:["No peanuts"], note:null } },
  { id:"bbq", img:"🍗", risk:"danger", src:"user",
    ko:{ name:"BBQ 치킨", cat:"치킨", reason:"거의 전 메뉴 땅콩 사용", tags:["전 메뉴 거의 위험"], note:"미국 BBQ에서 판매 거부할 정도" },
    en:{ name:"BBQ Chicken", cat:"Fried Chicken", reason:"Almost all items contain peanuts.", tags:["Nearly all items dangerous"], note:"US locations reportedly refuse peanut allergy customers" } },
  { id:"fiveguys", img:"🍔", risk:"danger", src:"user",
    ko:{ name:"파이브가이즈", cat:"패스트푸드", reason:"매장 내 땅콩 상시 비치", tags:["교차오염 위험"], note:null },
    en:{ name:"Five Guys", cat:"Fast Food", reason:"Peanuts always present in-store", tags:["Airborne risk"], note:null } },
  // 나머지 브랜드는 database.js에서 복사해서 추가하세요
];

const FOODS = [
  { id:"f1", img:"🥜", risk:"danger", brand:"해태/Haitai", barcode:"8801111000001",
    ko:{ name:"맛동산", cat:"과자", tags:["땅콩 주재료"], note:"대표 땅콩 과자" },
    en:{ name:"Matdongsan", cat:"Snack", tags:["Main ingredient: peanut"], note:"Classic peanut snack" } },
  { id:"f40", img:"🍤", risk:"safe", brand:"농심/Nongshim", barcode:"8801111000040",
    ko:{ name:"새우깡", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Shrimp Crackers", cat:"Snack", tags:["No peanuts"], note:null } },
  // 나머지 식품도 추가하세요
];

const INVITE_CODES = [
  { code: "PEANUT2024", active: true },
  { code: "SAFE0001", active: true },
];

async function seed() {
  console.log('🌱 Firestore 데이터 업로드 시작...');

  // 브랜드 업로드
  const brandBatch = writeBatch(db);
  BRANDS.forEach(b => {
    brandBatch.set(doc(db, 'brands', b.id), b);
  });
  await brandBatch.commit();
  console.log(`✅ 브랜드 ${BRANDS.length}개 업로드 완료`);

  // 식품 업로드
  const foodBatch = writeBatch(db);
  FOODS.forEach(f => {
    foodBatch.set(doc(db, 'foods', f.id), f);
  });
  await foodBatch.commit();
  console.log(`✅ 식품 ${FOODS.length}개 업로드 완료`);

  // 초대 코드 업로드
  const codeBatch = writeBatch(db);
  INVITE_CODES.forEach((c, i) => {
    codeBatch.set(doc(db, 'inviteCodes', `code_${i}`), c);
  });
  await codeBatch.commit();
  console.log(`✅ 초대 코드 ${INVITE_CODES.length}개 업로드 완료`);

  console.log('🎉 모든 데이터 업로드 완료!');
  process.exit(0);
}

seed().catch(e => {
  console.error('❌ 오류:', e);
  process.exit(1);
});

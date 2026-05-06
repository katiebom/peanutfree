// seedData_full.js — 전체 데이터 Firestore 업로드
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
  { id:"starbucks", img:"☕", risk:"info", src:"user",
    ko:{ name:"스타벅스", cat:"카페", reason:"앱·키오스크에서 성분 정보 잘 제공", tags:["앱/키오스크 확인 가능"], note:"정보 제공이 잘 된다는 의미" },
    en:{ name:"Starbucks", cat:"Cafe", reason:"Ingredients available via app/kiosk.", tags:["Check app/kiosk"], note:"Means info is provided, not all items are safe" } },
  { id:"kyochon", img:"🍗", risk:"safe", src:"user",
    ko:{ name:"교촌치킨", cat:"치킨", reason:"커뮤니티 확인 - 땅콩류 없음", tags:["땅콩류 없음"], note:null },
    en:{ name:"Kyochon Chicken", cat:"Fried Chicken", reason:"Community confirmed - no peanuts", tags:["No peanuts"], note:null } },
  { id:"zikobar", img:"🍗", risk:"safe", src:"user",
    ko:{ name:"지코바", cat:"치킨", reason:"커뮤니티 확인 - 땅콩류 없음", tags:["땅콩류 없음"], note:null },
    en:{ name:"Zikobar", cat:"Fried Chicken", reason:"Community confirmed - no peanuts", tags:["No peanuts"], note:null } },
  { id:"burgerking", img:"🍔", risk:"info", src:"user",
    ko:{ name:"버거킹", cat:"패스트푸드", reason:"알레르기 표기 잘 됨. 메뉴별 직접 확인 필요", tags:["알레르기 표기 있음"], note:null },
    en:{ name:"Burger King", cat:"Fast Food", reason:"Good allergy labeling. Verify each item.", tags:["Allergy info available"], note:null } },
  { id:"subway", img:"🥖", risk:"safe", src:"admin",
    ko:{ name:"써브웨이", cat:"샌드위치", reason:"기본 재료 땅콩 없음. 쿠키 등 주의", tags:["재료 선택 가능","디저트 별도 확인"], note:null },
    en:{ name:"Subway", cat:"Sandwich", reason:"Base ingredients peanut-free. Caution with desserts.", tags:["Customizable","Check desserts"], note:null } },
  { id:"dominos", img:"🍕", risk:"safe", src:"official",
    ko:{ name:"도미노피자", cat:"피자", reason:"피자 재료 땅콩류 미사용", tags:["땅콩류 미사용"], note:null },
    en:{ name:"Dominos Pizza", cat:"Pizza", reason:"Pizza ingredients do not contain peanuts", tags:["No peanuts used"], note:null } },
  { id:"mcdonalds", img:"🍔", risk:"info", src:"user", officialAllergyUrl:"https://www.mcdonalds.co.kr/kor/menu/allergyInfo.do",
    ko:{ name:"맥도날드", cat:"패스트푸드", reason:"공식 알레르기 정보 제공. 메뉴별 확인 필수", tags:["공식 알레르기 정보 있음"], note:null },
    en:{ name:"McDonalds", cat:"Fast Food", reason:"Official allergy info provided. Must verify per item.", tags:["Official allergy page"], note:null } },
  { id:"gomtang", img:"🍲", risk:"safe", src:"user",
    ko:{ name:"곰탕/설렁탕 (일반)", cat:"한식", reason:"단순 재료, 땅콩류 거의 없음", tags:["단순 재료"], note:null },
    en:{ name:"Gomtang/Seolleongtang", cat:"Korean Food", reason:"Simple ingredients, generally no peanuts", tags:["Simple ingredients"], note:null } },
  { id:"pajuok", img:"🍲", risk:"safe", src:"user",
    ko:{ name:"파주옥", cat:"한식", reason:"땅콩 없음 확인", tags:["땅콩 없음"], note:null },
    en:{ name:"Pajuok", cat:"Korean Food", reason:"Confirmed no peanuts", tags:["No peanuts"], note:null } },
  { id:"shabu", img:"🫕", risk:"caution", src:"user",
    ko:{ name:"샤브샤브 (일반)", cat:"한식", reason:"기본 육수는 안전, 땅콩 소스 제공하는 곳 있음", tags:["땅콩 소스 주의","소스 제거 요청 가능"], note:"소스 제거 요청하면 됨" },
    en:{ name:"Shabu-shabu", cat:"Korean Food", reason:"Base broth is safe, but some places serve peanut sauce.", tags:["Caution: peanut sauce","Can request no sauce"], note:"Request no peanut sauce" } },
  { id:"galbi", img:"🥩", risk:"caution", src:"user",
    ko:{ name:"양념갈비 (일반)", cat:"한식", reason:"갈비 양념에 간혹 땅콩 포함", tags:["양념 확인 필수"], note:null },
    en:{ name:"Marinated Galbi", cat:"Korean Food", reason:"Marinade sometimes contains peanuts", tags:["Check marinade"], note:null } },
  { id:"bbq", img:"🍗", risk:"danger", src:"user",
    ko:{ name:"BBQ 치킨", cat:"치킨", reason:"거의 전 메뉴 땅콩 사용. 브랜드 자체 회피 권장", tags:["전 메뉴 거의 위험","브랜드 회피 권장"], note:"미국 BBQ에서 판매 거부할 정도" },
    en:{ name:"BBQ Chicken", cat:"Fried Chicken", reason:"Almost all items contain peanuts. Avoid entirely.", tags:["Nearly all items dangerous","Avoid brand"], note:"US locations reportedly refuse peanut allergy customers" } },
  { id:"noran", img:"🍗", risk:"danger", src:"user",
    ko:{ name:"노란통닭", cat:"치킨", reason:"땅콩 들어가는 치킨으로 명시", tags:["땅콩 함유"], note:null },
    en:{ name:"Noran Tongdak", cat:"Fried Chicken", reason:"Explicitly stated to contain peanuts", tags:["Contains peanuts"], note:null } },
  { id:"sinsun", img:"🍲", risk:"danger", src:"user",
    ko:{ name:"신선설농탕", cat:"한식", reason:"땅콩 성분 포함. 일반 설렁탕과 다름", tags:["땅콩 함유","일반 설렁탕과 다름"], note:"일반 곰탕과 혼동 주의" },
    en:{ name:"Sinsun Seolleongtang", cat:"Korean Food", reason:"Contains peanuts. Different from regular seolleongtang.", tags:["Contains peanuts","Different from regular"], note:"Do not confuse with regular gomtang" } },
  { id:"fiveguys", img:"🍔", risk:"danger", src:"user",
    ko:{ name:"파이브가이즈", cat:"패스트푸드", reason:"매장 내 땅콩 상시 비치, 공기 중 교차오염", tags:["땅콩 상시 비치","교차오염 위험"], note:null },
    en:{ name:"Five Guys", cat:"Fast Food", reason:"Peanuts always present in-store, airborne exposure risk", tags:["Peanuts always present","Airborne risk"], note:null } },
  { id:"momstouch", img:"🍔", risk:"danger", src:"user",
    ko:{ name:"맘스터치", cat:"치킨/버거", reason:"소스 및 일부 메뉴에 땅콩류 포함", tags:["소스 주의"], note:null },
    en:{ name:"Moms Touch", cat:"Chicken/Burger", reason:"Sauce and some items contain peanuts", tags:["Caution with sauces"], note:null } },

  // ── 정보/확인 필요 (database.js에는 있으나 기존 seed에서 누락된 브랜드) ──
  { id:"lotteria", img:"🍔", risk:"info", src:"user",
    ko:{ name:"롯데리아", cat:"패스트푸드", reason:"키오스크·앱에서 알레르기 성분 확인 가능. 메뉴별 개별 확인 필요", tags:["성분 확인 가능"], note:null },
    en:{ name:"Lotteria", cat:"Fast Food", reason:"Allergy info via kiosk/app. Verify each menu item.", tags:["Check ingredients"], note:null } },
  { id:"kfc", img:"🍗", risk:"info", src:"user",
    ko:{ name:"KFC", cat:"패스트푸드", reason:"공식 홈페이지에서 알레르기 정보 제공. 메뉴별 확인 필요", tags:["알레르기 정보 있음"], note:null },
    en:{ name:"KFC", cat:"Fast Food", reason:"Allergy info on official website. Verify each item.", tags:["Allergy info available"], note:null } },
  { id:"papajohns", img:"🍕", risk:"info", src:"user",
    ko:{ name:"파파존스", cat:"피자", reason:"홈페이지에 알레르기 유발 성분 공개. 피자 재료 개별 확인", tags:["알레르기 정보 공개"], note:null },
    en:{ name:"Papa Johns", cat:"Pizza", reason:"Allergen info on website. Verify toppings individually.", tags:["Allergen info public"], note:null } },
  { id:"pizzahut", img:"🍕", risk:"info", src:"user",
    ko:{ name:"피자헛", cat:"피자", reason:"홈페이지·앱에서 알레르기 정보 제공. 일부 토핑 주의", tags:["성분 확인 가능"], note:null },
    en:{ name:"Pizza Hut", cat:"Pizza", reason:"Allergy info via website/app. Caution with some toppings.", tags:["Check ingredients"], note:null } },
  { id:"ediya", img:"☕", risk:"info", src:"user",
    ko:{ name:"이디야", cat:"카페", reason:"일부 메뉴 성분표 제공. 시럽/파우더 성분 확인 권장", tags:["성분 확인 권장"], note:null },
    en:{ name:"Ediya Coffee", cat:"Café", reason:"Ingredient info for some items. Verify syrups/powders.", tags:["Verify syrups"], note:null } },
  { id:"twosome", img:"☕", risk:"info", src:"user",
    ko:{ name:"투썸플레이스", cat:"카페", reason:"케이크·베이커리 일부 견과류 함유. 음료 성분 확인 가능", tags:["베이커리 주의","음료 확인 가능"], note:null },
    en:{ name:"A Twosome Place", cat:"Café", reason:"Some cakes/pastries contain nuts. Beverages verifiable.", tags:["Caution with pastries"], note:null } },
  { id:"hollys", img:"☕", risk:"info", src:"user",
    ko:{ name:"할리스", cat:"카페", reason:"일부 메뉴 알레르기 정보 제공. 견과류 시럽 함유 메뉴 주의", tags:["일부 알레르기 정보"], note:null },
    en:{ name:"Hollys Coffee", cat:"Café", reason:"Allergy info for some items. Caution with nut syrups.", tags:["Partial allergy info"], note:null } },
  { id:"gongcha", img:"🧋", risk:"info", src:"user",
    ko:{ name:"공차", cat:"음료", reason:"토핑 및 파우더 내 견과류 포함 여부 공지. 주문 전 확인", tags:["토핑 성분 확인"], note:null },
    en:{ name:"Gong Cha", cat:"Beverage", reason:"Notify about nuts in toppings/powders. Check before ordering.", tags:["Check toppings"], note:null } },
  { id:"dintaifung", img:"🥟", risk:"info", src:"admin",
    ko:{ name:"딘타이펑", cat:"중식", reason:"전 메뉴 알레르기 유발 물질 가이드 비치. 주문 시 성분 재확인 가능", tags:["알레르기 가이드 비치","전 메뉴 표기"], note:null },
    en:{ name:"Din Tai Fung", cat:"Chinese", reason:"Full allergen guide at table. Staff re-verify on request.", tags:["Full allergen guide"], note:null } },
  { id:"shakeshack", img:"🍔", risk:"info", src:"admin",
    ko:{ name:"쉐이크쉑", cat:"패스트푸드", reason:"너트 알레르기 대응 주방 가이드 보유. 메뉴판 알레르기 안내", tags:["너트 알레르기 매뉴얼"], note:null },
    en:{ name:"Shake Shack", cat:"Fast Food", reason:"Kitchen guide for nut allergy. Allergy info on menu.", tags:["Nut allergy guide"], note:null } },
  { id:"salady", img:"🥗", risk:"info", src:"admin",
    ko:{ name:"샐러디", cat:"샐러드", reason:"홈페이지·매장 전 메뉴 알레르기 표 비치. 드레싱 땅콩 별도 확인", tags:["전 메뉴 알레르기 표 비치"], note:null },
    en:{ name:"Salady", cat:"Salad", reason:"Full allergy chart in-store and online. Check dressing separately.", tags:["Full allergy chart"], note:null } },
];

const FOODS = [
  { id:"f1", img:"🥜", risk:"danger", brand:"해태/Haitai", barcode:"8801111000001",
    ko:{ name:"맛동산", cat:"과자", tags:["땅콩 주재료"], note:"대표 땅콩 과자" },
    en:{ name:"Matdongsan", cat:"Snack", tags:["Main ingredient: peanut"], note:"Classic peanut snack" } },
  { id:"f2", img:"🥜", risk:"danger", brand:"크라운/Crown", barcode:"8801111000002",
    ko:{ name:"땅콩강정", cat:"강정", tags:["땅콩 주재료"], note:null },
    en:{ name:"Peanut Gangjeong", cat:"Candy", tags:["Main ingredient: peanut"], note:null } },
  { id:"f3", img:"🦑", risk:"danger", brand:"오리온/Orion", barcode:"8801111000003",
    ko:{ name:"오징어땅콩", cat:"과자", tags:["땅콩 주재료"], note:null },
    en:{ name:"Ojingeo Ttangkong", cat:"Snack", tags:["Main ingredient: peanut"], note:null } },
  { id:"f4", img:"🍬", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000004",
    ko:{ name:"카라멜콘땅콩", cat:"과자", tags:["땅콩 주재료"], note:null },
    en:{ name:"Caramel Corn Peanut", cat:"Snack", tags:["Main ingredient: peanut"], note:null } },
  { id:"f5", img:"🍫", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000005",
    ko:{ name:"롯데 초코파이", cat:"파이", tags:["땅콩 함유"], note:"오리온 초코파이는 안전" },
    en:{ name:"Lotte Choco Pie", cat:"Pie", tags:["Contains peanut"], note:"Orion Choco Pie is safe instead" } },
  { id:"f6", img:"🍬", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000006",
    ko:{ name:"빼빼로 (전 맛)", cat:"초콜릿", tags:["전 맛 땅콩 함유"], note:"포키로 대체 가능" },
    en:{ name:"Pepero (all flavors)", cat:"Chocolate", tags:["All flavors contain peanut"], note:"Try Pocky as alternative" } },
  { id:"f7", img:"🍪", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000007",
    ko:{ name:"칸쵸", cat:"과자", tags:["땅콩 추가됨"], note:"어느 순간부터 땅콩 추가" },
    en:{ name:"Kancho", cat:"Snack", tags:["Peanut added to recipe"], note:"Peanut added at some point" } },
  { id:"f8", img:"🍫", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000008",
    ko:{ name:"몽쉘", cat:"케이크", tags:["땅콩 함유"], note:null },
    en:{ name:"Mon Cher", cat:"Cake", tags:["Contains peanut"], note:null } },
  { id:"f9", img:"🍫", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000009",
    ko:{ name:"크런키", cat:"초콜릿", tags:["땅콩 함유"], note:null },
    en:{ name:"Crunky", cat:"Chocolate", tags:["Contains peanut"], note:null } },
  { id:"f10", img:"🥣", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000010",
    ko:{ name:"씨리얼초코", cat:"시리얼", tags:["땅콩 함유"], note:null },
    en:{ name:"Cereal Choco", cat:"Cereal", tags:["Contains peanut"], note:null } },
  { id:"f11", img:"🍪", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000011",
    ko:{ name:"빈츠 오리지날/초코", cat:"비스킷", tags:["오리지날/초코 위험"], note:"말차맛은 안전" },
    en:{ name:"Binch Original/Choco", cat:"Biscuit", tags:["Original/Choco dangerous"], note:"Matcha flavor is safe" } },
  { id:"f12", img:"🍫", risk:"danger", brand:"해태/Haitai", barcode:"8801111000012",
    ko:{ name:"홈런볼 초코맛", cat:"과자", tags:["땅콩 함유"], note:null },
    en:{ name:"Home Run Ball Choco", cat:"Snack", tags:["Contains peanut"], note:null } },
  { id:"f13", img:"🍉", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000013",
    ko:{ name:"수박바 (일반)", cat:"아이스크림", tags:["초코씨 땅콩 함유"], note:"씨없는 버전은 안전" },
    en:{ name:"Watermelon Bar (regular)", cat:"Ice Cream", tags:["Choco seeds contain peanut"], note:"Seedless version is safe" } },
  { id:"f14", img:"🍦", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000014",
    ko:{ name:"월드콘", cat:"아이스크림", tags:["땅콩 함유"], note:null },
    en:{ name:"World Cone", cat:"Ice Cream", tags:["Contains peanut"], note:null } },
  { id:"f15", img:"🍦", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000015",
    ko:{ name:"누가바", cat:"아이스크림", tags:["땅콩 함유"], note:null },
    en:{ name:"Nougat Bar", cat:"Ice Cream", tags:["Contains peanut"], note:null } },
  { id:"f16", img:"🍫", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000016",
    ko:{ name:"자유시간", cat:"초콜릿", tags:["땅콩 함유"], note:null },
    en:{ name:"Free Time", cat:"Chocolate", tags:["Contains peanut"], note:null } },
  { id:"f17", img:"🍪", risk:"danger", brand:"오리온/Orion", barcode:"8801111000017",
    ko:{ name:"마가렛트", cat:"비스킷", tags:["땅콩 함유"], note:null },
    en:{ name:"Marguerite", cat:"Biscuit", tags:["Contains peanut"], note:null } },
  { id:"f18", img:"🍫", risk:"danger", brand:"크라운/Crown", barcode:"8801111000018",
    ko:{ name:"쿠키속초코짱", cat:"과자", tags:["땅콩 함유"], note:null },
    en:{ name:"Cookie Choco Jjang", cat:"Snack", tags:["Contains peanut"], note:null } },
  { id:"f19", img:"🍗", risk:"danger", brand:"시판/Commercial", barcode:"8801111000019",
    ko:{ name:"로만 닭강정", cat:"간식", tags:["땅콩 함유"], note:null },
    en:{ name:"Roman Dak Gangjeong", cat:"Snack", tags:["Contains peanut"], note:null } },
  { id:"f20", img:"🥞", risk:"danger", brand:"시판/Commercial", barcode:"8801111000020",
    ko:{ name:"호떡 (시판)", cat:"간식", tags:["속재료 땅콩 함유"], note:null },
    en:{ name:"Hotteok (commercial)", cat:"Snack", tags:["Filling contains peanut"], note:null } },
  { id:"f21", img:"🍪", risk:"danger", brand:"국희/Gukhee", barcode:"8801111000021",
    ko:{ name:"국희 땅콩샌드", cat:"과자", tags:["땅콩 주재료"], note:null },
    en:{ name:"Gukhee Peanut Sand", cat:"Snack", tags:["Main ingredient: peanut"], note:null } },
  { id:"f22", img:"🍫", risk:"danger", brand:"ABC/ABC", barcode:"8801111000022",
    ko:{ name:"ABC 초콜릿", cat:"초콜릿", tags:["땅콩 함유"], note:null },
    en:{ name:"ABC Chocolate", cat:"Chocolate", tags:["Contains peanut"], note:null } },
  { id:"f23", img:"🍫", risk:"danger", brand:"오리온/Orion", barcode:"8801111000023",
    ko:{ name:"초코파이 (오리온 구버전)", cat:"파이", tags:["일부 버전 땅콩 함유"], note:"현재 오리온 초코파이는 안전" },
    en:{ name:"Choco Pie (old Orion)", cat:"Pie", tags:["Some versions contain peanut"], note:"Current Orion Choco Pie is safe" } },
  { id:"f30", img:"🫙", risk:"caution", brand:"순창/Sunchang", barcode:"8801111000030",
    ko:{ name:"순창 쌈장", cat:"소스", tags:["순창 특히 주의"], note:"사계절 쌈장은 안전" },
    en:{ name:"Sunchang Ssamjang", cat:"Sauce", tags:["Especially caution Sunchang"], note:"Sagye-jeol brand is safe" } },
  { id:"f31", img:"🍲", risk:"caution", brand:"식당/Restaurant", barcode:null,
    ko:{ name:"고깃집 된장찌개", cat:"한식", reason:"일부 된장에 땅콩류 포함 가능", tags:["된장 확인 필요"], note:"집된장은 대체로 안전" },
    en:{ name:"BBQ Restaurant Doenjang Stew", cat:"Korean Food", tags:["Check doenjang"], note:"Home-made doenjang generally safe" } },
  { id:"f32", img:"🍗", risk:"caution", brand:"치킨집/Chicken", barcode:null,
    ko:{ name:"양념치킨 (일반)", cat:"치킨", tags:["땅콩 뿌리는 곳 있음"], note:"주문 시 땅콩 제거 요청" },
    en:{ name:"Seasoned Chicken", cat:"Chicken", tags:["Some places sprinkle peanuts"], note:"Request no peanuts when ordering" } },
  { id:"f40", img:"🍤", risk:"safe", brand:"농심/Nongshim", barcode:"8801111000040",
    ko:{ name:"새우깡", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Shrimp Crackers", cat:"Snack", tags:["No peanuts"], note:null } },
  { id:"f41", img:"🍟", risk:"safe", brand:"해태/Haitai", barcode:"8801111000041",
    ko:{ name:"허니버터칩", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Honey Butter Chip", cat:"Snack", tags:["No peanuts"], note:null } },
  { id:"f42", img:"🥔", risk:"safe", brand:"오리온/Orion", barcode:"8801111000042",
    ko:{ name:"포카칩", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Poca Chip", cat:"Snack", tags:["No peanuts"], note:null } },
  { id:"f43", img:"🐠", risk:"safe", brand:"오리온/Orion", barcode:"8801111000043",
    ko:{ name:"고래밥", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Whale Snack", cat:"Snack", tags:["No peanuts"], note:null } },
  { id:"f44", img:"🍌", risk:"safe", brand:"농심/Nongshim", barcode:"8801111000044",
    ko:{ name:"바나나킥", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Banana Kick", cat:"Snack", tags:["No peanuts"], note:null } },
  { id:"f45", img:"🌽", risk:"safe", brand:"농심/Nongshim", barcode:"8801111000045",
    ko:{ name:"꼬깔콘", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Kkokkalkon", cat:"Snack", tags:["No peanuts"], note:null } },
  { id:"f46", img:"🍫", risk:"safe", brand:"오리온/Orion", barcode:"8801111000046",
    ko:{ name:"오리온 초코파이", cat:"파이", tags:["땅콩류 없음"], note:"롯데 초코파이와 다름 - 오리온이 안전" },
    en:{ name:"Orion Choco Pie", cat:"Pie", tags:["No peanuts"], note:"Different from Lotte brand - Orion is safe" } },
  { id:"f47", img:"🍵", risk:"safe", brand:"롯데/Lotte", barcode:"8801111000047",
    ko:{ name:"빈츠 말차맛", cat:"비스킷", tags:["말차맛만 안전"], note:"오리지날/초코는 위험" },
    en:{ name:"Binch Matcha", cat:"Biscuit", tags:["Only matcha is safe"], note:"Original/Choco flavors are dangerous" } },
  { id:"f48", img:"🍉", risk:"safe", brand:"롯데/Lotte", barcode:"8801111000048",
    ko:{ name:"수박바 씨없는 제로", cat:"아이스크림", tags:["땅콩류 없음"], note:"일반 수박바와 다름" },
    en:{ name:"Watermelon Bar Zero (seedless)", cat:"Ice Cream", tags:["No peanuts"], note:"Different from regular watermelon bar" } },
  { id:"f49", img:"🫙", risk:"safe", brand:"사계절/Sagye", barcode:"8801111000049",
    ko:{ name:"사계절 쌈장", cat:"소스", tags:["땅콩 없음"], note:"순창 대신 추천" },
    en:{ name:"Sagye-jeol Ssamjang", cat:"Sauce", tags:["No peanuts"], note:"Recommended instead of Sunchang" } },
  { id:"f50", img:"🍪", risk:"safe", brand:"롯데/Lotte", barcode:"8801111000050",
    ko:{ name:"칙촉", cat:"쿠키", tags:["땅콩류 없음"], note:null },
    en:{ name:"Chic Choc", cat:"Cookie", tags:["No peanuts"], note:null } },
  { id:"f51", img:"🍩", risk:"safe", brand:"해태/Haitai", barcode:"8801111000051",
    ko:{ name:"꿀꽈배기", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Honey Twist Snack", cat:"Snack", tags:["No peanuts"], note:null } },
];

const INVITE_CODES = [
  { code: "PEANUT2024", active: true },
  { code: "SAFE0001", active: true },
];

async function seed() {
  console.log('Firestore 데이터 업로드 시작...');

  // 브랜드 업로드
  const brandBatch = writeBatch(db);
  BRANDS.forEach(b => {
    brandBatch.set(doc(db, 'brands', b.id), b);
  });
  await brandBatch.commit();
  console.log(`브랜드 ${BRANDS.length}개 업로드 완료`);

  // 식품 업로드 (Firestore 배치는 500개 제한, 여기선 분할)
  const foodBatch1 = writeBatch(db);
  FOODS.slice(0, 20).forEach(f => {
    foodBatch1.set(doc(db, 'foods', f.id), f);
  });
  await foodBatch1.commit();

  const foodBatch2 = writeBatch(db);
  FOODS.slice(20).forEach(f => {
    foodBatch2.set(doc(db, 'foods', f.id), f);
  });
  await foodBatch2.commit();
  console.log(`식품 ${FOODS.length}개 업로드 완료`);

  // 초대 코드
  const codeBatch = writeBatch(db);
  INVITE_CODES.forEach((c, i) => {
    codeBatch.set(doc(db, 'inviteCodes', `code_${i}`), c);
  });
  await codeBatch.commit();
  console.log(`초대 코드 ${INVITE_CODES.length}개 업로드 완료`);

  console.log('모든 데이터 업로드 완료!');
  process.exit(0);
}

seed().catch(e => {
  console.error('오류:', e);
  process.exit(1);
});

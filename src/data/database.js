// src/data/database.js

export const BRANDS = [
  { id:"outback", img:"🥩", risk:"info", src:"user",
    ko:{ name:"아웃백", cat:"패밀리레스토랑", reason:"알레르기 정보 잘 안내. 메뉴별 확인 필요", tags:["알레르기 표기 있음"], note:"세이프알레르기 카페 추천" },
    en:{ name:"Outback", cat:"Family Restaurant", reason:"Allergy info well provided. Check each item.", tags:["Allergy info available"], note:"Recommended by allergy community" } },
  { id:"starbucks", img:"☕", risk:"info", src:"user",
    ko:{ name:"스타벅스", cat:"카페", reason:"앱·키오스크에서 성분 정보 잘 제공", tags:["앱/키오스크 확인 가능"], note:"정보 제공이 잘 된다는 의미" },
    en:{ name:"Starbucks", cat:"Café", reason:"Ingredients available via app/kiosk.", tags:["Check app/kiosk"], note:"Means info is provided, not all items are safe" } },
  { id:"kyochon", img:"🍗", risk:"safe", src:"user",
    ko:{ name:"교촌치킨", cat:"치킨", reason:"커뮤니티 확인 — 땅콩류 없음", tags:["땅콩류 없음"], note:null },
    en:{ name:"Kyochon Chicken", cat:"Fried Chicken", reason:"Community confirmed — no peanuts", tags:["No peanuts"], note:null } },
  { id:"zikobar", img:"🍗", risk:"safe", src:"user",
    ko:{ name:"지코바", cat:"치킨", reason:"커뮤니티 확인 — 땅콩류 없음", tags:["땅콩류 없음"], note:null },
    en:{ name:"Zikobar", cat:"Fried Chicken", reason:"Community confirmed — no peanuts", tags:["No peanuts"], note:null } },
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

  // ── 정보/확인 필요 ──
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

export const FOODS = [
  { id:"f1", img:"🥜", risk:"danger", brand:"해태/Haitai", barcode:"8801111000001",
    ko:{ name:"맛동산", cat:"과자", tags:["땅콩 주재료"], note:"대표 땅콩 과자" },
    en:{ name:"Matdongsan", cat:"Snack", tags:["Main ingredient: peanut"], note:"Classic peanut snack" } },
  { id:"f2", img:"🥜", risk:"danger", brand:"크라운/Crown", barcode:"8801111000002",
    ko:{ name:"땅콩강정", cat:"강정", tags:["땅콩 주재료"], note:null },
    en:{ name:"Peanut Gangjeong", cat:"Candy", tags:["Main ingredient: peanut"], note:null } },
  { id:"f3", img:"🦑", risk:"danger", brand:"오리온/Orion", barcode:"8801111000003",
    ko:{ name:"오징어땅콩", cat:"과자", tags:["땅콩 주재료"], note:null },
    en:{ name:"Ojingeo Ttangkong", cat:"Snack", tags:["Main ingredient: peanut"], note:null } },
  { id:"f5", img:"🍫", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000005",
    ko:{ name:"롯데 초코파이", cat:"파이", tags:["땅콩 함유"], note:"오리온 초코파이는 안전" },
    en:{ name:"Lotte Choco Pie", cat:"Pie", tags:["Contains peanut"], note:"Orion Choco Pie is safe instead" } },
  { id:"f6", img:"🍬", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000006",
    ko:{ name:"빼빼로 (전 맛)", cat:"초콜릿", tags:["전 맛 땅콩 함유"], note:"포키로 대체 가능" },
    en:{ name:"Pepero (all flavors)", cat:"Chocolate", tags:["All flavors contain peanut"], note:"Try Pocky as alternative" } },
  { id:"f7", img:"🍪", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000007",
    ko:{ name:"롯데 칸쵸", cat:"과자", tags:["땅콩 추가됨"], note:"어느 순간부터 땅콩 추가" },
    en:{ name:"Lotte Kancho", cat:"Snack", tags:["Peanut added to recipe"], note:"Peanut added at some point" } },
  { id:"f11", img:"🍪", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000011",
    ko:{ name:"빈츠 오리지날·초코", cat:"비스킷", tags:["오리지날·초코 위험"], note:"말차맛은 안전" },
    en:{ name:"Binch Original/Choco", cat:"Biscuit", tags:["Original/Choco dangerous"], note:"Matcha flavor is safe" } },
  { id:"f13", img:"🍉", risk:"danger", brand:"롯데/Lotte", barcode:"8801111000013",
    ko:{ name:"롯데 수박바 (일반)", cat:"아이스크림", tags:["초코씨 땅콩 함유"], note:"씨없는 버전은 안전" },
    en:{ name:"Lotte Watermelon Bar", cat:"Ice Cream", tags:["Choco seeds contain peanut"], note:"Seedless version is safe" } },
  { id:"f30", img:"🫙", risk:"caution", brand:"순창/Sunchang", barcode:"8801111000030",
    ko:{ name:"순창 쌈장", cat:"소스", tags:["순창 특히 주의"], note:"사계절 쌈장은 안전" },
    en:{ name:"Sunchang Ssamjang", cat:"Sauce", tags:["Especially caution Sunchang"], note:"Sagye-jeol brand is safe" } },
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
  { id:"f44", img:"🍌", risk:"safe", brand:"농심/Nongshim", barcode:"8801111000044",
    ko:{ name:"바나나킥", cat:"과자", tags:["땅콩류 없음"], note:null },
    en:{ name:"Banana Kick", cat:"Snack", tags:["No peanuts"], note:null } },
  { id:"f46", img:"🍫", risk:"safe", brand:"오리온/Orion", barcode:"8801111000046",
    ko:{ name:"오리온 초코파이", cat:"파이", tags:["땅콩류 없음"], note:"롯데 초코파이와 다름 — 오리온이 안전" },
    en:{ name:"Orion Choco Pie", cat:"Pie", tags:["No peanuts"], note:"Different from Lotte brand — Orion is safe" } },
  { id:"f47", img:"🍵", risk:"safe", brand:"롯데/Lotte", barcode:"8801111000047",
    ko:{ name:"빈츠 말차맛", cat:"비스킷", tags:["말차맛만 안전"], note:"오리지날·초코는 위험" },
    en:{ name:"Binch Matcha", cat:"Biscuit", tags:["Only matcha is safe"], note:"Original/Choco flavors are dangerous" } },
  { id:"f49", img:"🫙", risk:"safe", brand:"사계절/Sagye", barcode:"8801111000049",
    ko:{ name:"사계절 쌈장", cat:"소스", tags:["땅콩 없음"], note:"순창 대신 추천" },
    en:{ name:"Sagye-jeol Ssamjang", cat:"Sauce", tags:["No peanuts"], note:"Recommended instead of Sunchang" } },
];

// ── 식당 리뷰 (엑셀 기반 큐레이션 데이터) ─────────────────────
// src: admin = 관리자 검증, user = 커뮤니티 확인
export const REVIEWS = [

  // ── 성수 ──────────────────────────────────────────────────
  { id:"r_localit", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5442, lng:127.0551,
    ko:{ name:"로컬릿", cat:"비건/샐러드", tags:["전 성분 기재","견과류 완벽 제외 가능"], review:"메뉴판 전 성분 기재. 견과류 완벽 제외 가능. 알레르기 대응 우수." },
    en:{ name:"Localit", cat:"Vegan/Salad", tags:["Full ingredients listed","Can exclude nuts"], review:"Full ingredient labeling. Can fully exclude nuts." } },

  { id:"r_chickpeas_ss", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5438, lng:127.0561,
    ko:{ name:"칙피스 성수", cat:"비건/샐러드", tags:["지중해식","토핑 구분 엄격"], review:"지중해식 샐러드. 견과류 포함 메뉴가 명확히 구분되어 안전." },
    en:{ name:"Chickpeas Seongsu", cat:"Vegan/Salad", tags:["Mediterranean","Strict topping separation"], review:"Mediterranean salad. Nut items clearly separated." } },

  { id:"r_eatsalad_ss", risk:"caution", src:"admin", address:"서울 성동구 성수동", lat:37.5447, lng:127.0558,
    ko:{ name:"잇샐러드 성수", cat:"샐러드", tags:["땅콩 제외 요청 필수"], review:"주문 시 땅콩 등 특정 재료 제외 옵션. 찹 샐러드라 재료가 섞이므로 반드시 요청 필요." },
    en:{ name:"Eat Salad Seongsu", cat:"Salad", tags:["Must request peanut exclusion"], review:"Can exclude peanuts but must request — chopped style mixes ingredients." } },

  { id:"r_alavo_ss", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5436, lng:127.0549,
    ko:{ name:"알라보 성수", cat:"비건/샐러드", tags:["아보카도 기반","재료 변경 유연"], review:"아보카도 기반 메뉴. 재료 변경에 유연하게 대응." },
    en:{ name:"Alavo Seongsu", cat:"Vegan/Salad", tags:["Avocado base","Flexible customization"], review:"Avocado-based. Flexible ingredient modifications." } },

  { id:"r_seongsu_darak", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5452, lng:127.0563,
    ko:{ name:"성수다락", cat:"양식", tags:["성분 확인 용이"], review:"오므라이스/파스타 위주. 성분 확인이 용이하고 알레르기 대응 가능." },
    en:{ name:"Seongsu Darak", cat:"Western", tags:["Easy ingredient check"], review:"Omurice/pasta focused. Easy ingredient verification." } },

  { id:"r_kuna", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5440, lng:127.0570,
    ko:{ name:"쿠나 (KUNA)", cat:"양식", tags:["셰프 직접 성분 체크"], review:"뇨끼/파스타 전문. 셰프가 직접 성분 체크해주는 알레르기 대응." },
    en:{ name:"KUNA", cat:"Western", tags:["Chef checks ingredients"], review:"Gnocchi/pasta. Chef personally verifies ingredients." } },

  { id:"r_elena_young", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5448, lng:127.0543,
    ko:{ name:"엘레나영", cat:"양식", tags:["예약 시 알레르기 맞춤 조리"], review:"1:1 예약 시 알레르기 정보 전달하면 맞춤 조리 제공." },
    en:{ name:"Elena Young", cat:"Western", tags:["Custom allergy cooking on reservation"], review:"Allergy info at reservation → customized cooking." } },

  { id:"r_maison_pg", risk:"info", src:"admin", address:"서울 성동구 성수동", lat:37.5455, lng:127.0548,
    ko:{ name:"메종 파이프그라운드", cat:"양식", tags:["재료 고지 상세"], review:"옥수수 피자 등 시그니처 메뉴 성분 안내 상세. 방문 전 확인 권장." },
    en:{ name:"Maison Pipeground", cat:"Western", tags:["Detailed ingredient info"], review:"Detailed info for signature items. Verify before visiting." } },

  { id:"r_soba_ss", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5432, lng:127.0558,
    ko:{ name:"소바식당", cat:"일식", tags:["견과류 노출 적음"], review:"메밀/육수 중심 구성. 견과류 노출이 적어 비교적 안전." },
    en:{ name:"Soba Restaurant", cat:"Japanese", tags:["Low nut exposure"], review:"Soba/broth-focused. Low nut exposure risk." } },

  { id:"r_karinji", risk:"info", src:"admin", address:"서울 성동구 성수동", lat:37.5441, lng:127.0575,
    ko:{ name:"카린지", cat:"일식", tags:["소스 성분 확인 가능"], review:"카레/돈까스 전문. 소스 성분 확인 요청 시 친절히 대응." },
    en:{ name:"Karinji", cat:"Japanese", tags:["Can verify sauce ingredients"], review:"Curry/katsu. Friendly allergy response on request." } },

  { id:"r_chyori", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5450, lng:127.0537,
    ko:{ name:"쵸리상경", cat:"한식/솥밥", tags:["원재료 중심","고명 제외 가능"], review:"원재료 중심 솥밥. 고명 제외 가능. 땅콩 사용 없음." },
    en:{ name:"Chyorisanggyeong", cat:"Korean Rice Pot", tags:["Whole ingredients","Can remove toppings"], review:"Whole-ingredient rice pot. Can remove toppings. No peanuts." } },

  { id:"r_grandma_recipe", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5435, lng:127.0570,
    ko:{ name:"할머니의 레시피", cat:"한식", tags:["가정식","자극적 소스 배제"], review:"가정식 백반. 자극적 소스 없이 원재료 위주 조리. 안전한 한식." },
    en:{ name:"Grandma's Recipe", cat:"Korean", tags:["Home-style","No strong sauces"], review:"Home-style Korean. Simple ingredients, minimal sauces." } },

  { id:"r_gordon_ss", risk:"info", src:"admin", address:"서울 성동구 성수동", lat:37.5444, lng:127.0555,
    ko:{ name:"고든램지 스트리트버거", cat:"햄버거", tags:["성분표 비치","알레르기 가이드"], review:"상세 성분표 비치 및 알레르기 가이드 운영. 메뉴별 확인 권장." },
    en:{ name:"Gordon Ramsay Street Burger", cat:"Burger", tags:["Allergy guide available"], review:"Detailed allergy guide. Verify menu items." } },

  { id:"r_tachibana", risk:"info", src:"admin", address:"서울 성동구 성수동", lat:37.5437, lng:127.0564,
    ko:{ name:"타치바나", cat:"일식", tags:["카레 성분 공개"], review:"일본식 카레/우동. 카레 베이스 견과류 여부를 투명하게 공개." },
    en:{ name:"Tachibana", cat:"Japanese", tags:["Transparent curry ingredients"], review:"Japanese curry/udon. Transparent about nut use." } },

  { id:"r_lefrique", risk:"caution", src:"admin", address:"서울 성동구 성수동", lat:37.5443, lng:127.0567,
    ko:{ name:"르프리크", cat:"햄버거", tags:["튀김유 확인 필요"], review:"내슈빌 핫치킨 버거. 땅콩 기름 대신 채종유 사용 여부 확인. 코울슬로 체크 필수." },
    en:{ name:"Le Frique", cat:"Burger", tags:["Verify frying oil"], review:"Nashville hot chicken. Verify oil type. Check coleslaw." } },

  { id:"r_offline_shop", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5449, lng:127.0553,
    ko:{ name:"더 오프라인 샵", cat:"양식", tags:["셰프 직접 서빙","알레르기 꼼꼼 체크"], review:"셰프가 직접 서빙하며 알레르기 정보를 꼼꼼히 체크." },
    en:{ name:"The Offline Shop", cat:"Western", tags:["Chef serves directly"], review:"Chef serves and carefully checks allergy info." } },

  { id:"r_zesty", risk:"info", src:"admin", address:"서울 성동구 성수동", lat:37.5446, lng:127.0545,
    ko:{ name:"제스티살룬", cat:"햄버거", tags:["소스 제외 요청 가능"], review:"수제버거. 주재료 명확. 소스 제외 요청 가능." },
    en:{ name:"Zesty Saloon", cat:"Burger", tags:["Can remove sauces"], review:"Craft burger. Clear main ingredients. Can request no sauce." } },

  { id:"r_nanpo", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5454, lng:127.0560,
    ko:{ name:"난포", cat:"한식", tags:["견과류 안 쓰는 메뉴 주력"], review:"강된장, 쌈밥 등 견과류를 쓰지 않는 메뉴가 주력." },
    en:{ name:"Nanpo", cat:"Korean", tags:["Nut-free main menu"], review:"Doenjang/ssambap focus — mains do not use nuts." } },

  { id:"r_gou", risk:"safe", src:"admin", address:"서울 성동구 성수동", lat:37.5434, lng:127.0555,
    ko:{ name:"고우성수", cat:"한식/솥밥", tags:["고명 제거 가능"], review:"솥밥 종류별 들어가는 고명(견과류) 제거 가능." },
    en:{ name:"Gou Seongsu", cat:"Korean Rice Pot", tags:["Can remove nut garnish"], review:"Nut garnishes can be removed per variety." } },

  { id:"r_parco", risk:"info", src:"admin", address:"서울 성동구 성수동", lat:37.5439, lng:127.0573,
    ko:{ name:"파르코 (Parco)", cat:"피자", tags:["도우·치즈 중심","소스 확인"], review:"화덕피자. 도우와 치즈 중심이라 소스만 체크하면 비교적 안전." },
    en:{ name:"Parco", cat:"Pizza", tags:["Dough/cheese base","Check sauce"], review:"Wood-fired pizza. Dough/cheese safe — verify sauce only." } },

  { id:"r_fingertips", risk:"info", src:"admin", address:"서울 성동구 성수동", lat:37.5453, lng:127.0544,
    ko:{ name:"핑거팁스", cat:"햄버거", tags:["전 성분 관리"], review:"수제버거. 번(빵)과 패티의 전 성분을 관리함." },
    en:{ name:"Fingertips", cat:"Burger", tags:["Full ingredient management"], review:"Craft burger. Full ingredient management for bun and patty." } },

  // ── 한남 ──────────────────────────────────────────────────
  { id:"r_mosu", risk:"safe", src:"admin", address:"서울 용산구 한남동", lat:37.5355, lng:126.9981,
    ko:{ name:"모수 서울", cat:"파인다이닝", tags:["예약 시 알레르기 최우선"], review:"예약 시 알레르기 정보를 최우선으로 반영. 파인다이닝 알레르기 대응 최우수." },
    en:{ name:"Mosu Seoul", cat:"Fine Dining", tags:["Allergy first at reservation"], review:"Allergy info is top priority at reservation." } },

  { id:"r_muoki", risk:"safe", src:"admin", address:"서울 용산구 한남동", lat:37.5348, lng:126.9991,
    ko:{ name:"무오키", cat:"파인다이닝", tags:["알레르기 사전 체크 시스템"], review:"알레르기 유발 물질 사전 체크 시스템 운영." },
    en:{ name:"Muoki", cat:"Fine Dining", tags:["Pre-visit allergy check"], review:"Pre-visit allergy screening system." } },

  { id:"r_alla_prima", risk:"safe", src:"admin", address:"서울 용산구 한남동", lat:37.5341, lng:126.9979,
    ko:{ name:"알라 프리마", cat:"파인다이닝", tags:["맞춤 코스 구성"], review:"고객별 맞춤 코스 구성. 알레르기 정보 기반 메뉴 조정." },
    en:{ name:"Alla Prima", cat:"Fine Dining", tags:["Custom course for allergies"], review:"Personalized course based on allergy info." } },

  { id:"r_borgo", risk:"safe", src:"admin", address:"서울 용산구 한남동", lat:37.5338, lng:126.9988,
    ko:{ name:"보르고 한남", cat:"이탈리안", tags:["셰프와 직접 소통"], review:"정통 이탈리안. 셰프와 직접 소통. 알레르기 배려 탁월." },
    en:{ name:"Borgo Hannam", cat:"Italian", tags:["Direct chef communication"], review:"Authentic Italian. Direct chef communication." } },

  { id:"r_drrobin", risk:"safe", src:"admin", address:"서울 용산구 한남동", lat:37.5351, lng:126.9998,
    ko:{ name:"닥터로빈 한남점", cat:"건강식", tags:["노슈가/노버터","전 메뉴 성분 관리"], review:"노슈가·노버터 건강식. 전 메뉴 성분 관리 철저. 땅콩 없음 확인." },
    en:{ name:"Dr. Robin Hannam", cat:"Health Food", tags:["No sugar/butter","Full ingredient mgmt"], review:"No sugar/butter health food. Strict ingredient management." } },

  { id:"r_maxim_plante", risk:"info", src:"admin", address:"서울 용산구 한남동", lat:37.5343, lng:126.9972,
    ko:{ name:"맥심플랜트", cat:"카페/베이커리", tags:["성분 고지 상세"], review:"베이커리/음료 성분 고지 상세. 메뉴별 알레르기 확인 가능." },
    en:{ name:"Maxim Plante", cat:"Café/Bakery", tags:["Detailed ingredient info"], review:"Detailed info for all bakery items and drinks." } },

  { id:"r_vera_napoli", risk:"info", src:"admin", address:"서울 용산구 한남동", lat:37.5358, lng:126.9993,
    ko:{ name:"베라 나폴리", cat:"피자", tags:["SPC 알레르기 관리"], review:"SPC 그룹사 알레르기 관리 시스템 적용." },
    en:{ name:"Vera Napoli", cat:"Pizza", tags:["SPC allergy system"], review:"SPC group-wide allergy management applied." } },

  // ── 망원 ──────────────────────────────────────────────────
  { id:"r_diner_jacky", risk:"safe", src:"admin", address:"서울 마포구 망원동", lat:37.5557, lng:126.9098,
    ko:{ name:"다이너재키", cat:"비건", tags:["연어/채소 중심","견과류 구분"], review:"연어/채소 중심 비건 식당. 견과류 사용 여부 구분 제공." },
    en:{ name:"Diner Jacky", cat:"Vegan", tags:["Salmon/veggie focus","Nuts separated"], review:"Vegan. Nut usage clearly distinguished." } },

  { id:"r_around_green", risk:"safe", src:"admin", address:"서울 마포구 망원동", lat:37.5552, lng:126.9108,
    ko:{ name:"어라운드 그린", cat:"비건", tags:["순수 채식","재료 문의 상세"], review:"순수 채식 식당. 재료 문의 시 상세하게 응대." },
    en:{ name:"Around Green", cat:"Vegan", tags:["Pure plant-based","Detailed ingredient response"], review:"Pure plant-based. Detailed response to ingredient inquiries." } },

  { id:"r_gardner", risk:"info", src:"admin", address:"서울 마포구 망원동", lat:37.5560, lng:126.9092,
    ko:{ name:"가드너 아드리아", cat:"이탈리안", tags:["사전 요청 시 소스 조정"], review:"이탈리안. 사전 요청 시 소스 조정 가능." },
    en:{ name:"Gardner Adria", cat:"Italian", tags:["Sauce adjustable on request"], review:"Italian. Sauce adjustable if requested in advance." } },

  { id:"r_heki", risk:"safe", src:"admin", address:"서울 마포구 망원동", lat:37.5548, lng:126.9102,
    ko:{ name:"헤키", cat:"일식", tags:["튀김유·소스 안전 확인"], review:"돈카츠 전문. 튀김유 및 소스의 땅콩 성분 안전 확인 가능." },
    en:{ name:"Heki", cat:"Japanese", tags:["Oil and sauce confirmed safe"], review:"Katsu. Frying oil and sauce confirmed peanut-free." } },

  // ── 강남 ──────────────────────────────────────────────────
  { id:"r_gangnam_gyoja", risk:"safe", src:"admin", address:"서울 강남구 강남대로", lat:37.4991, lng:127.0259,
    ko:{ name:"강남교자", cat:"한식", tags:["견과류 사용 매우 적음"], review:"칼국수와 만두 위주. 견과류 사용이 매우 적어 안전." },
    en:{ name:"Gangnam Gyoja", cat:"Korean", tags:["Very low nut usage"], review:"Noodle and dumpling. Very low nut usage." } },

  { id:"r_gatten_sushi", risk:"safe", src:"admin", address:"서울 강남구 강남대로", lat:37.4983, lng:127.0278,
    ko:{ name:"갓덴스시 강남점", cat:"일식/스시", tags:["견과류 교차오염 위험 낮음"], review:"스시 전문점. 견과류 교차오염 위험이 가장 낮은 편." },
    en:{ name:"Gatten Sushi Gangnam", cat:"Japanese/Sushi", tags:["Very low cross-contamination"], review:"Sushi specialist. Very low cross-contamination risk." } },

  { id:"r_umihak", risk:"safe", src:"admin", address:"서울 강남구 강남대로", lat:37.4975, lng:127.0285,
    ko:{ name:"우미학", cat:"한식", tags:["소스 제외 시 매우 안전"], review:"차돌박이 구이. 소스 제외 시 매우 안전." },
    en:{ name:"Umihak", cat:"Korean", tags:["Very safe without sauce"], review:"Chadolbaegi grill. Very safe without sauce." } },

  { id:"r_jeongdon", risk:"info", src:"admin", address:"서울 강남구 강남대로", lat:37.4988, lng:127.0270,
    ko:{ name:"정돈 강남점", cat:"일식", tags:["소스 성분 확인 가능"], review:"프리미엄 돈카츠. 튀김유 및 소스 성분 확인 요청 시 응대." },
    en:{ name:"Jeongdon Gangnam", cat:"Japanese", tags:["Can verify sauce ingredients"], review:"Premium katsu. Can verify frying oil and sauce." } },

  { id:"r_sushi_maiou", risk:"safe", src:"admin", address:"서울 강남구 강남대로", lat:37.4985, lng:127.0262,
    ko:{ name:"스시마이우 강남역점", cat:"일식/스시", tags:["견과류 없는 메뉴 선택 용이"], review:"회전초밥. 견과류 없는 메뉴 선택이 용이함." },
    en:{ name:"Sushi Maiou Gangnam", cat:"Japanese/Sushi", tags:["Easy nut-free selection"], review:"Conveyor sushi. Easy to choose nut-free items." } },

  { id:"r_ttamttam", risk:"caution", src:"admin", address:"서울 강남구 강남대로", lat:37.4969, lng:127.0279,
    ko:{ name:"땀땀 강남점", cat:"베트남식", tags:["땅콩 토핑 제외 요청 필수"], review:"베트남 쌀국수. 땅콩 토핑 제외 요청 가능. 반드시 명확히 요청 필요." },
    en:{ name:"Ttamttam Gangnam", cat:"Vietnamese", tags:["Must request no peanut topping"], review:"Vietnamese pho. Can exclude peanut toppings — must request clearly." } },

  { id:"r_songthai", risk:"caution", src:"admin", address:"서울 강남구 역삼동", lat:37.4994, lng:127.0308,
    ko:{ name:"쏭타이 역삼점", cat:"태국식", tags:["견과류 제외 협조적"], review:"태국 요리. 견과류 제외 요청에 매우 협조적." },
    en:{ name:"Songthai Yeoksam", cat:"Thai", tags:["Very cooperative for nut exclusion"], review:"Thai cuisine. Very cooperative with nut exclusion requests." } },

  { id:"r_nai_soi", risk:"caution", src:"admin", address:"서울 강남구 강남대로", lat:37.4980, lng:127.0289,
    ko:{ name:"나이소이 강남점", cat:"태국식", tags:["땅콩 가루 제외 가능"], review:"태국 국수 전문점. 고명으로 올라가는 땅콩 가루 제외 가능." },
    en:{ name:"Nai Soi Gangnam", cat:"Thai", tags:["Can exclude peanut powder"], review:"Thai noodles. Can exclude peanut powder garnish." } },

  { id:"r_muchacho", risk:"caution", src:"admin", address:"서울 강남구 강남대로", lat:37.4973, lng:127.0274,
    ko:{ name:"무차초", cat:"멕시칸", tags:["땅콩 가루 고명 제외 요청"], review:"멕시칸 퓨전. 땅콩 가루 고명 제외 요청 가능." },
    en:{ name:"Muchacho", cat:"Mexican", tags:["Can remove peanut powder garnish"], review:"Mexican fusion. Can request removal of peanut powder garnish." } },

  { id:"r_gamseong_taco", risk:"info", src:"admin", address:"서울 강남구 강남대로", lat:37.4966, lng:127.0281,
    ko:{ name:"감성타코 강남역점", cat:"멕시칸", tags:["재료 제외 요청 가능"], review:"파히타 조리 시 특정 재료 제외 요청 가능." },
    en:{ name:"Gamseong Taco Gangnam", cat:"Mexican", tags:["Can remove specific ingredients"], review:"Can request ingredient removal during fajita cooking." } },

  { id:"r_miz_container", risk:"info", src:"admin", address:"서울 강남구 강남대로", lat:37.4977, lng:127.0267,
    ko:{ name:"미즈컨테이너 강남역점", cat:"카페/샐러드", tags:["주요 메뉴 재료 확인 가능"], review:"샐러드·파스타 등 주요 메뉴 재료 확인 가능." },
    en:{ name:"Miz Container Gangnam", cat:"Café/Salad", tags:["Can verify main menu ingredients"], review:"Can verify ingredients for salad and pasta items." } },

  { id:"r_mayu_mala", risk:"caution", src:"admin", address:"서울 강남구 강남대로", lat:37.4960, lng:127.0275,
    ko:{ name:"마유유 마라탕", cat:"중식/마라탕", tags:["땅콩 소스 셀프 조절"], review:"땅콩 소스 셀프 바 형태. 소스 미포함 요청 시 조절 가능." },
    en:{ name:"Mayu Malatang", cat:"Chinese/Malatang", tags:["Self-service peanut sauce — can skip"], review:"Self-serve peanut sauce bar — can be skipped entirely." } },

  { id:"r_lawa_mala", risk:"caution", src:"admin", address:"서울 강남구 강남대로", lat:37.4963, lng:127.0283,
    ko:{ name:"라와마라탕 강남직영점", cat:"중식/마라탕", tags:["땅콩 소스 0단계 선택 가능"], review:'"땅콩 소스 0단계" 선택 시 국물 베이스까지 체크 가능. 직영점으로 청결도 높음.' },
    en:{ name:"Lawa Malatang Gangnam", cat:"Chinese/Malatang", tags:["Zero peanut sauce option"], review:'"0 peanut sauce" option with broth verification. Official store.' } },

  // ── 전국 체인 (공통) ──────────────────────────────────────
  { id:"r_din_tai_fung", risk:"info", src:"admin", address:"서울 강남구 (전국 체인)", lat:37.5118, lng:127.1028,
    ko:{ name:"딘타이펑", cat:"중식", tags:["알레르기 가이드 비치","전 메뉴 표기"], review:"전 메뉴 알레르기 유발 물질 가이드 비치. 주문 시 성분 재확인 가능." },
    en:{ name:"Din Tai Fung", cat:"Chinese", tags:["Full allergen guide","Staff re-verify on request"], review:"Full allergen guide for all menus. Staff re-verify on request." } },

  { id:"r_shake_shack", risk:"info", src:"admin", address:"서울 강남구 (전국 체인)", lat:37.4996, lng:127.0292,
    ko:{ name:"쉐이크쉑", cat:"패스트푸드", tags:["너트 알레르기 매뉴얼"], review:"너트 알레르기 대응 주방 가이드 보유. 메뉴판 하단 알레르기 안내." },
    en:{ name:"Shake Shack", cat:"Fast Food", tags:["Nut allergy kitchen guide"], review:"Kitchen guide for nut allergy. Allergy info on menu." } },

  { id:"r_barda_kim", risk:"info", src:"admin", address:"서울 강남구 (전국 체인)", lat:37.4982, lng:127.0254,
    ko:{ name:"바르다 김선생", cat:"한식", tags:["키오스크 성분 안내","재료 제외 옵션"], review:"키오스크 내 알레르기 성분 안내. 특정 재료 제외 옵션 잘 되어 있음." },
    en:{ name:"Barda Kimseonsaeng", cat:"Korean", tags:["Kiosk allergy info","Exclusion options"], review:"Kiosk allergy labeling. Good ingredient exclusion options." } },

  { id:"r_salady", risk:"info", src:"admin", address:"서울 강남구 (전국 체인)", lat:37.4971, lng:127.0265,
    ko:{ name:"샐러디", cat:"샐러드", tags:["전 메뉴 알레르기 표 비치"], review:"홈페이지·매장 전 메뉴 알레르기 표 비치. 드레싱 땅콩 성분 별도 체크 필요." },
    en:{ name:"Salady", cat:"Salad", tags:["Full allergy chart available"], review:"Full allergy chart in-store and online. Verify dressing separately." } },

  { id:"r_crystal_jade", risk:"caution", src:"admin", address:"서울 강남구 (전국 체인)", lat:37.5114, lng:127.1023,
    ko:{ name:"크리스탈 제이드", cat:"중식", tags:["알레르기 가이드 운영","견과류 메뉴 많음"], review:"프리미엄 중식. 알레르기 가이드 운영. 견과류 메뉴 많으므로 주의." },
    en:{ name:"Crystal Jade", cat:"Chinese", tags:["Allergy guide","Many nut menu items"], review:"Premium Chinese. Allergy guide available but many nut items." } },

  { id:"r_on_the_border", risk:"info", src:"admin", address:"서울 강남구 (전국 체인)", lat:37.5009, lng:127.0244,
    ko:{ name:"온더보더", cat:"멕시칸", tags:["소스 성분 확인 가능","조리 변경 가능"], review:"메뉴별 알레르기 성분표 요청 시 제공. 특정 재료 제외 조리 비교적 용이." },
    en:{ name:"On The Border", cat:"Mexican", tags:["Allergy sheet on request","Can modify cooking"], review:"Allergy sheet on request. Relatively easy dish modification." } },
];

export const REQUESTS = [
  { id:1, name:"장민지", email:"minji@email.com", reason:"7살 아이 알러지 심함", date:"2024.03.01", status:"pending" },
  { id:2, name:"이수현", email:"suhyun@email.com", reason:"성인 본인 알러지", date:"2024.03.01", status:"pending" },
];

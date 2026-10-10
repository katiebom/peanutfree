// seedRestaurants.js
// 엑셀 파일 식당 데이터 → Kakao API 좌표 조회 → Firebase reviews 컬렉션 저장
// 실행: node seedRestaurants.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const https = require('https');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Admin SDK shims for web-SDK-style calls
const collection = (db, col) => db.collection(col);
const addDoc = (ref, data) => ref.add(data);
const getDocs = (ref) => ref.get();
const query = (ref, ...constraints) => constraints.reduce((r, c) => c(r), ref);
const where = (field, op, val) => (ref) => ref.where(field, op, val);

const KAKAO_KEY = process.env.KAKAO_REST_KEY || '';   // .env.local 의 값을 환경변수로 넘겨 실행

// ── 식당 데이터 (엑셀 기반) ──────────────────────────────────
// risk: safe=땅콩 없음 확인, info=성분 확인 가능, caution=요청 필요
const RESTAURANTS = [
  // ── 성수 ──
  { searchQuery: '로컬릿 성수', risk: 'safe',
    ko: { name: '로컬릿', cat: '비건/샐러드', tags: ['전 성분 기재', '견과류 완벽 제외 가능'], review: '메뉴판 전 성분 기재, 견과류 완벽 제외 가능. 알레르기 대응 우수.' },
    en: { name: 'Localit', cat: 'Vegan/Salad', tags: ['Full ingredients listed', 'Can exclude nuts'], review: 'Full ingredient labeling, can fully exclude nuts.' } },

  { searchQuery: '칙피스 성수', risk: 'safe',
    ko: { name: '칙피스 성수', cat: '비건/샐러드', tags: ['지중해식', '토핑 구분 엄격'], review: '지중해식 샐러드. 견과류 포함 메뉴가 명확히 구분되어 안전.' },
    en: { name: 'Chickpeas Seongsu', cat: 'Vegan/Salad', tags: ['Mediterranean', 'Strict topping separation'], review: 'Mediterranean salad. Nut items clearly separated.' } },

  { searchQuery: '잇샐러드 성수', risk: 'caution',
    ko: { name: '잇샐러드 성수', cat: '샐러드', tags: ['땅콩 제외 요청 필수'], review: '주문 시 땅콩 등 특정 재료 제외 옵션. 찹 샐러드라 재료가 섞이므로 반드시 요청 필요.' },
    en: { name: 'Eat Salad Seongsu', cat: 'Salad', tags: ['Must request peanut exclusion'], review: 'Can exclude peanuts but must request — chopped style mixes ingredients.' } },

  { searchQuery: '알라보 성수', risk: 'safe',
    ko: { name: '알라보 성수', cat: '비건/샐러드', tags: ['아보카도 기반', '재료 변경 유연'], review: '아보카도 기반 메뉴. 재료 변경에 유연하게 대응.' },
    en: { name: 'Alavo Seongsu', cat: 'Vegan/Salad', tags: ['Avocado base', 'Flexible customization'], review: 'Avocado-based. Flexible ingredient modifications.' } },

  { searchQuery: '성수다락', risk: 'safe',
    ko: { name: '성수다락', cat: '양식', tags: ['성분 확인 용이'], review: '오므라이스/파스타 위주. 성분 확인이 용이하고 알레르기 대응 가능.' },
    en: { name: 'Seongsu Darak', cat: 'Western', tags: ['Easy to check ingredients'], review: 'Omurice/pasta focused. Easy ingredient verification.' } },

  { searchQuery: '쿠나 성수 KUNA', risk: 'safe',
    ko: { name: '쿠나 (KUNA)', cat: '양식', tags: ['셰프 직접 성분 체크'], review: '뇨끼/파스타 전문. 셰프가 직접 성분 체크해주는 친절한 알레르기 대응.' },
    en: { name: 'KUNA', cat: 'Western', tags: ['Chef checks ingredients personally'], review: 'Gnocchi/pasta specialist. Chef personally verifies ingredients.' } },

  { searchQuery: '엘레나영 성수', risk: 'safe',
    ko: { name: '엘레나영', cat: '양식', tags: ['예약 시 알레르기 맞춤 조리'], review: '1:1 예약 시 알레르기 정보 전달하면 맞춤 조리 제공.' },
    en: { name: 'Elena Young', cat: 'Western', tags: ['Allergy-customized on reservation'], review: 'Allergy info provided at reservation → customized cooking.' } },

  { searchQuery: '메종 파이프그라운드 성수', risk: 'info',
    ko: { name: '메종 파이프그라운드', cat: '양식', tags: ['재료 고지 상세'], review: '옥수수 피자 등 시그니처 메뉴 성분 안내 상세. 방문 전 확인 권장.' },
    en: { name: 'Maison Pipeground', cat: 'Western', tags: ['Detailed ingredient info'], review: 'Detailed ingredient info for signature items. Verify before visiting.' } },

  { searchQuery: '소바식당 성수', risk: 'safe',
    ko: { name: '소바식당', cat: '일식', tags: ['견과류 노출 적음'], review: '메밀/육수 중심 구성. 견과류 노출이 적어 비교적 안전.' },
    en: { name: 'Soba Restaurant', cat: 'Japanese', tags: ['Low nut exposure'], review: 'Soba/broth-focused. Low nut exposure risk.' } },

  { searchQuery: '카린지 성수', risk: 'info',
    ko: { name: '카린지', cat: '일식', tags: ['소스 성분 확인 가능'], review: '카레/돈까스 전문. 소스 성분 확인 요청 시 친절히 대응.' },
    en: { name: 'Karinji', cat: 'Japanese', tags: ['Can verify sauce ingredients'], review: 'Curry/katsu specialist. Friendly allergy response on request.' } },

  { searchQuery: '쵸리상경 성수', risk: 'safe',
    ko: { name: '쵸리상경', cat: '한식/솥밥', tags: ['원재료 중심', '고명 제외 가능'], review: '원재료 중심 솥밥. 고명 제외 가능하고 땅콩 사용 없음.' },
    en: { name: 'Chyorisanggyeong', cat: 'Korean Rice Pot', tags: ['Whole ingredients', 'Can remove toppings'], review: 'Whole-ingredient rice pot. Can remove toppings. No peanut use.' } },

  { searchQuery: '할머니의 레시피 성수', risk: 'safe',
    ko: { name: '할머니의 레시피', cat: '한식', tags: ['가정식', '자극적 소스 배제'], review: '가정식 백반. 자극적 소스 없이 원재료 위주 조리. 안전한 한식.' },
    en: { name: "Grandma's Recipe", cat: 'Korean', tags: ['Home-style', 'No strong sauces'], review: 'Home-style Korean. Simple ingredients, minimal sauces.' } },

  { searchQuery: '고든램지 스트리트버거 성수', risk: 'info',
    ko: { name: '고든램지 스트리트버거', cat: '햄버거', tags: ['성분표 비치', '알레르기 가이드'], review: '상세 성분표 비치 및 알레르기 가이드 운영. 방문 전 메뉴별 확인 권장.' },
    en: { name: "Gordon Ramsay Street Burger", cat: 'Burger', tags: ['Allergy guide available'], review: 'Detailed allergy guide available. Verify menu items before ordering.' } },

  // 성수 추가 (Sheet2)
  { searchQuery: '타치바나 성수', risk: 'info',
    ko: { name: '타치바나', cat: '일식', tags: ['카레 성분 공개'], review: '일본식 카레/우동. 카레 베이스 견과류 여부를 투명하게 공개.' },
    en: { name: 'Tachibana', cat: 'Japanese', tags: ['Transparent curry ingredients'], review: 'Japanese curry/udon. Transparent about nut use in curry base.' } },

  { searchQuery: '르프리크 성수', risk: 'caution',
    ko: { name: '르프리크', cat: '햄버거', tags: ['튀김유 확인 필요'], review: '내슈빌 핫치킨 버거. 땅콩 기름 대신 채종유 사용 여부 확인. 코울슬로 체크 필수.' },
    en: { name: 'Le Frique', cat: 'Burger', tags: ['Must verify frying oil'], review: 'Nashville hot chicken. Verify oil type. Check coleslaw ingredients.' } },

  { searchQuery: '더오프라인샵 성수', risk: 'safe',
    ko: { name: '더 오프라인 샵', cat: '양식', tags: ['셰프 직접 서빙', '알레르기 꼼꼼 체크'], review: '셰프가 직접 서빙하며 알레르기 정보를 꼼꼼히 체크.' },
    en: { name: 'The Offline Shop', cat: 'Western', tags: ['Chef serves directly', 'Thorough allergy check'], review: 'Chef serves directly and carefully checks allergy info.' } },

  { searchQuery: '제스티살룬 성수', risk: 'info',
    ko: { name: '제스티살룬', cat: '햄버거', tags: ['소스 제외 요청 가능'], review: '수제버거. 새우 패티 등 주재료 명확, 소스 제외 요청 가능.' },
    en: { name: 'Zesty Saloon', cat: 'Burger', tags: ['Can remove sauces'], review: 'Craft burger. Clear main ingredients. Can request no sauce.' } },

  { searchQuery: '난포 성수', risk: 'safe',
    ko: { name: '난포', cat: '한식', tags: ['견과류 안 쓰는 메뉴 주력'], review: '강된장, 쌈밥 등 견과류를 쓰지 않는 메뉴가 주력.' },
    en: { name: 'Nanpo', cat: 'Korean', tags: ['Nut-free main menu'], review: 'Doenjang, ssambap focus — mains do not use nuts.' } },

  { searchQuery: '고우성수', risk: 'safe',
    ko: { name: '고우성수', cat: '한식/솥밥', tags: ['고명 제거 가능'], review: '솥밥 종류별 들어가는 고명(견과류) 제거 가능.' },
    en: { name: 'Gou Seongsu', cat: 'Korean Rice Pot', tags: ['Can remove nut garnish'], review: 'Nut garnishes can be removed per pot rice variety.' } },

  { searchQuery: '파르코 성수 화덕피자', risk: 'info',
    ko: { name: '파르코 (Parco)', cat: '피자', tags: ['도우·치즈 중심', '소스 확인'], review: '화덕피자. 도우와 치즈 중심이라 소스만 체크하면 비교적 안전.' },
    en: { name: 'Parco', cat: 'Pizza', tags: ['Dough/cheese focused', 'Check sauce'], review: 'Wood-fired pizza. Dough/cheese base is safe — just verify sauce.' } },

  { searchQuery: '핑거팁스 성수', risk: 'info',
    ko: { name: '핑거팁스', cat: '햄버거', tags: ['전 성분 관리'], review: '수제버거. 번(빵)과 패티의 전 성분을 관리함.' },
    en: { name: 'Fingertips', cat: 'Burger', tags: ['Full ingredient management'], review: 'Craft burger. Full ingredient management for bun and patty.' } },

  // ── 한남 ──
  { searchQuery: '모수 서울 한남', risk: 'safe',
    ko: { name: '모수 서울', cat: '파인다이닝', tags: ['예약 시 알레르기 최우선'], review: '예약 시 알레르기 정보를 최우선으로 반영. 파인다이닝 알레르기 대응 최우수.' },
    en: { name: 'Mosu Seoul', cat: 'Fine Dining', tags: ['Allergy info prioritized at reservation'], review: 'Allergy info is top priority at reservation. Excellent fine dining allergy care.' } },

  { searchQuery: '무오키 한남', risk: 'safe',
    ko: { name: '무오키', cat: '파인다이닝', tags: ['알레르기 사전 체크 시스템'], review: '알레르기 유발 물질 사전 체크 시스템 운영. 방문 전 알레르기 고지 가능.' },
    en: { name: 'Muoki', cat: 'Fine Dining', tags: ['Pre-visit allergy check system'], review: 'Pre-visit allergy screening system. Notify in advance.' } },

  { searchQuery: '알라 프리마 한남', risk: 'safe',
    ko: { name: '알라 프리마', cat: '파인다이닝', tags: ['맞춤 코스 구성'], review: '고객별 맞춤 코스 구성. 알레르기 정보 기반 메뉴 조정.' },
    en: { name: 'Alla Prima', cat: 'Fine Dining', tags: ['Custom course for allergies'], review: 'Personalized course based on allergy info.' } },

  { searchQuery: '보르고 한남', risk: 'safe',
    ko: { name: '보르고 한남', cat: '이탈리안', tags: ['셰프와 직접 소통'], review: '정통 이탈리안. 셰프와 직접 소통 가능하고 알레르기 배려 탁월.' },
    en: { name: 'Borgo Hannam', cat: 'Italian', tags: ['Direct chef communication'], review: 'Authentic Italian. Direct chef communication for allergy care.' } },

  { searchQuery: '닥터로빈 한남', risk: 'safe',
    ko: { name: '닥터로빈 한남점', cat: '건강식', tags: ['노슈가/노버터', '전 메뉴 성분 관리'], review: '노슈가·노버터 건강식. 전 메뉴 성분 관리 철저. 땅콩 없음 확인.' },
    en: { name: "Dr. Robin Hannam", cat: 'Health Food', tags: ['No sugar/butter', 'Full ingredient management'], review: 'No sugar/butter health food. Strict full-menu ingredient management.' } },

  { searchQuery: '맥심플랜트 한남', risk: 'info',
    ko: { name: '맥심플랜트', cat: '카페/베이커리', tags: ['성분 고지 상세'], review: '베이커리/음료 성분 고지 상세. 메뉴별 알레르기 확인 가능.' },
    en: { name: 'Maxim Plante', cat: 'Café/Bakery', tags: ['Detailed ingredient info'], review: 'Detailed ingredient info for all bakery items and drinks.' } },

  { searchQuery: '베라나폴리 한남', risk: 'info',
    ko: { name: '베라 나폴리', cat: '피자', tags: ['SPC 알레르기 관리'], review: 'SPC 그룹 운영. 그룹사 알레르기 관리 시스템 적용.' },
    en: { name: 'Vera Napoli', cat: 'Pizza', tags: ['SPC allergy management system'], review: 'SPC group operated. Group-wide allergy management applied.' } },

  // ── 망원 ──
  { searchQuery: '다이너재키 망원', risk: 'safe',
    ko: { name: '다이너재키', cat: '비건', tags: ['연어/채소 중심', '견과류 구분'], review: '연어/채소 중심 비건 식당. 견과류 사용 여부 구분하여 제공.' },
    en: { name: 'Diner Jacky', cat: 'Vegan', tags: ['Salmon/veggie focus', 'Nuts clearly separated'], review: 'Salmon/veggie vegan. Nut usage clearly distinguished.' } },

  { searchQuery: '어라운드 그린 망원', risk: 'safe',
    ko: { name: '어라운드 그린', cat: '비건', tags: ['순수 채식', '재료 문의 상세 응대'], review: '순수 채식 식당. 재료 문의 시 상세하게 응대.' },
    en: { name: 'Around Green', cat: 'Vegan', tags: ['Pure plant-based', 'Detailed ingredient response'], review: 'Pure plant-based. Detailed response to ingredient inquiries.' } },

  { searchQuery: '가드너 아드리아 망원', risk: 'info',
    ko: { name: '가드너 아드리아', cat: '이탈리안', tags: ['사전 요청 시 소스 조정'], review: '이탈리안. 사전 요청 시 소스 조정 가능. 알레르기 문의 응대.' },
    en: { name: 'Gardner Adria', cat: 'Italian', tags: ['Sauce adjustable on request'], review: 'Italian. Sauce adjustable if requested in advance.' } },

  { searchQuery: '헤키 망원 돈카츠', risk: 'safe',
    ko: { name: '헤키', cat: '일식', tags: ['튀김유·소스 안전 확인'], review: '돈카츠 전문. 튀김유 및 소스의 땅콩 성분 안전 확인 가능.' },
    en: { name: 'Heki', cat: 'Japanese', tags: ['Safe frying oil and sauce confirmed'], review: 'Katsu specialist. Frying oil and sauce confirmed peanut-free.' } },

  // ── 강남 (Sheet1 기반) ──
  { searchQuery: '강남교자 강남', risk: 'safe',
    ko: { name: '강남교자', cat: '한식', tags: ['견과류 사용 매우 적음'], review: '칼국수와 만두 위주. 견과류 사용이 매우 적어 안전.' },
    en: { name: 'Gangnam Gyoja', cat: 'Korean', tags: ['Very low nut usage'], review: 'Noodle and dumpling focus. Very low nut usage.' } },

  { searchQuery: '갓덴스시 강남', risk: 'safe',
    ko: { name: '갓덴스시 강남점', cat: '일식/스시', tags: ['견과류 오염 위험 낮음'], review: '스시 전문점. 견과류 교차오염 위험이 가장 낮은 편.' },
    en: { name: 'Gatten Sushi Gangnam', cat: 'Japanese/Sushi', tags: ['Very low nut contamination risk'], review: 'Sushi specialist. Very low cross-contamination risk for nuts.' } },

  { searchQuery: '우미학 강남', risk: 'safe',
    ko: { name: '우미학', cat: '한식', tags: ['소스 제외 시 안전'], review: '차돌박이 구이. 소스 제외 시 매우 안전한 한식.' },
    en: { name: 'Umihak', cat: 'Korean', tags: ['Very safe without sauce'], review: 'Chadolbaegi grill. Very safe without sauce.' } },

  { searchQuery: '정돈 강남', risk: 'info',
    ko: { name: '정돈 강남점', cat: '일식', tags: ['소스 성분 확인 가능'], review: '프리미엄 돈카츠. 튀김유 및 소스 성분 확인 요청 시 응대.' },
    en: { name: 'Jeongdon Gangnam', cat: 'Japanese', tags: ['Can verify sauce ingredients'], review: 'Premium katsu. Can verify frying oil and sauce ingredients.' } },

  { searchQuery: '스시마이우 강남역', risk: 'safe',
    ko: { name: '스시마이우 강남역점', cat: '일식/스시', tags: ['견과류 없는 메뉴 선택 용이'], review: '회전초밥. 견과류 없는 메뉴 선택이 용이함.' },
    en: { name: 'Sushi Maiou Gangnam', cat: 'Japanese/Sushi', tags: ['Easy to find nut-free menu'], review: 'Conveyor sushi. Easy to choose nut-free items.' } },

  { searchQuery: '땀땀 강남', risk: 'caution',
    ko: { name: '땀땀 강남점', cat: '베트남식', tags: ['땅콩 토핑 제외 요청 필수'], review: '베트남 쌀국수. 땅콩 토핑 제외 요청 가능. 주방 소통 가능하나 반드시 요청 필요.' },
    en: { name: 'Ttamttam Gangnam', cat: 'Vietnamese', tags: ['Must request no peanut topping'], review: 'Vietnamese pho. Can exclude peanut toppings but must request clearly.' } },

  { searchQuery: '쏭타이 역삼', risk: 'caution',
    ko: { name: '쏭타이 역삼점', cat: '태국식', tags: ['견과류 제외 협조적'], review: '태국 요리. 주문 시 견과류 제외 요청에 매우 협조적.' },
    en: { name: 'Songthai Yeoksam', cat: 'Thai', tags: ['Very cooperative for nut exclusion'], review: 'Thai cuisine. Very cooperative with nut exclusion requests.' } },

  { searchQuery: '나이소이 강남', risk: 'caution',
    ko: { name: '나이소이 강남점', cat: '태국식', tags: ['땅콩 가루 제외 가능'], review: '태국 국수 전문점. 고명으로 올라가는 땅콩 가루 제외 가능.' },
    en: { name: 'Nai Soi Gangnam', cat: 'Thai', tags: ['Can exclude peanut powder topping'], review: 'Thai noodles. Can exclude peanut powder garnish.' } },

  { searchQuery: '무차초 강남', risk: 'caution',
    ko: { name: '무차초', cat: '멕시칸', tags: ['땅콩 가루 고명 제외 요청'], review: '멕시칸 퓨전. 땅콩 가루 고명 제외 요청 가능.' },
    en: { name: 'Muchacho', cat: 'Mexican', tags: ['Can remove peanut powder garnish'], review: 'Mexican fusion. Can request removal of peanut powder garnish.' } },

  { searchQuery: '감성타코 강남역', risk: 'info',
    ko: { name: '감성타코 강남역점', cat: '멕시칸', tags: ['재료 제외 요청 가능'], review: '파히타 조리 시 특정 재료 제외 요청 가능.' },
    en: { name: 'Gamseong Taco Gangnam', cat: 'Mexican', tags: ['Can remove specific ingredients'], review: 'Can request ingredient removal during fajita cooking.' } },

  { searchQuery: '미즈컨테이너 강남역', risk: 'info',
    ko: { name: '미즈컨테이너 강남역점', cat: '카페/샐러드', tags: ['주요 메뉴 재료 확인 가능'], review: '샐러드·파스타 등 주요 메뉴 재료 확인 가능.' },
    en: { name: 'Miz Container Gangnam', cat: 'Café/Salad', tags: ['Can verify main menu ingredients'], review: 'Can verify ingredients for salad and pasta items.' } },

  { searchQuery: '마유유 마라탕 강남', risk: 'caution',
    ko: { name: '마유유 마라탕', cat: '중식/마라탕', tags: ['땅콩 소스 셀프 조절 가능'], review: '땅콩 소스를 직접 제조해 먹는 셀프 바 형태. 소스 미포함 요청 시 조절 가능.' },
    en: { name: 'Mayu Malatang', cat: 'Chinese/Malatang', tags: ['Self-service peanut sauce — can skip'], review: 'Self-serve peanut sauce bar — can be skipped entirely.' } },

  { searchQuery: '라와마라탕 강남', risk: 'caution',
    ko: { name: '라와마라탕 강남직영점', cat: '중식/마라탕', tags: ['땅콩 소스 0단계 선택'], review: '"땅콩 소스 0단계" 선택 시 국물 베이스까지 체크 가능. 직영점으로 청결도 높음.' },
    en: { name: 'Lawa Malatang Gangnam', cat: 'Chinese/Malatang', tags: ['Zero peanut sauce option'], review: '"0 peanut sauce" option available with broth verification. Official store.' } },

  // ── 전국 체인 (공통) ──
  { searchQuery: '딘타이펑 강남', risk: 'info',
    ko: { name: '딘타이펑', cat: '중식', tags: ['알레르기 유발 물질 가이드 비치', '전 메뉴 표기'], review: '전 메뉴 알레르기 유발 물질 가이드 비치. 주문 시 성분 재확인 가능.' },
    en: { name: 'Din Tai Fung', cat: 'Chinese', tags: ['Full allergen guide at table'], review: 'Full allergen guide for all menus. Staff will re-verify on request.' } },

  { searchQuery: '쉐이크쉑 강남', risk: 'info',
    ko: { name: '쉐이크쉑', cat: '패스트푸드', tags: ['너트 알레르기 전용 매뉴얼'], review: '너트 알레르기 대응 주방 가이드 보유. 메뉴판 하단 알레르기 안내.' },
    en: { name: 'Shake Shack', cat: 'Fast Food', tags: ['Nut allergy kitchen guide'], review: 'Kitchen guide for nut allergy. Allergy info on menu.' } },

  { searchQuery: '바르다김선생 강남', risk: 'info',
    ko: { name: '바르다 김선생', cat: '한식', tags: ['키오스크 성분 안내', '재료 제외 옵션'], review: '키오스크 내 알레르기 성분 안내. 특정 재료 제외 옵션 잘 되어 있음.' },
    en: { name: 'Barda Kimseonsaeng', cat: 'Korean', tags: ['Kiosk allergy info', 'Ingredient exclusion options'], review: 'Kiosk allergy labeling. Good ingredient exclusion options.' } },

  { searchQuery: '샐러디 강남', risk: 'info',
    ko: { name: '샐러디', cat: '샐러드', tags: ['전 메뉴 알레르기 표 비치'], review: '홈페이지 및 매장에 전 메뉴 알레르기 표 비치. 드레싱 땅콩 성분 별도 체크 필요.' },
    en: { name: 'Salady', cat: 'Salad', tags: ['Full allergy chart available'], review: 'Full allergy chart available in-store and online. Verify dressing separately.' } },

  { searchQuery: '크리스탈제이드 강남', risk: 'caution',
    ko: { name: '크리스탈 제이드', cat: '중식', tags: ['알레르기 가이드 운영', '견과류 메뉴 많음'], review: '프리미엄 중식. 알레르기 가이드 운영하나 견과류 메뉴 많으므로 주의.' },
    en: { name: 'Crystal Jade', cat: 'Chinese', tags: ['Allergy guide available', 'Many nut menu items'], review: 'Premium Chinese. Allergy guide available but many nut-containing items.' } },

  { searchQuery: '온더보더 강남', risk: 'info',
    ko: { name: '온더보더', cat: '멕시칸', tags: ['소스 성분 확인 가능', '조리 변경 가능'], review: '메뉴별 알레르기 성분표 요청 시 제공. 특정 재료 제외 조리 비교적 용이.' },
    en: { name: 'On The Border', cat: 'Mexican', tags: ['Allergy sheet on request', 'Can modify cooking'], review: 'Allergy sheet provided on request. Relatively easy to modify dishes.' } },

  // ── 청담 ──
  { searchQuery: '밍글스 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '밍글스', cat: '모던 한식', tags: ['예약 시 사전 고지 가능', '알레르기 맞춤 조리', '방문 전 확인 권장'], review: '미쉐린 2스타 레스토랑으로 예약 단계에서 알레르기 정보를 전달하면 대체 식재료로 세심한 코스 구성이 가능합니다.' },
    en: { name: 'Mingles', cat: 'Modern Korean', tags: ['Pre-notification available', 'Customized cooking', 'Check before visit'], review: 'A 2-star Michelin restaurant that can adjust courses with alternative ingredients if allergy info is provided during booking.' } },

  { searchQuery: '정식당 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '정식당', cat: '뉴 코리안', tags: ['알레르기 정보 상세 제공', '예약 시 사전 고지 가능', '메뉴별 확인 필수'], review: '섬세한 서비스로 유명하며, 견과류 알레르기를 고지할 경우 소스 하나하나까지 체크하여 서빙합니다.' },
    en: { name: 'Jungsik', cat: 'New Korean', tags: ['Detailed allergy info', 'Pre-notification available', 'Must check per menu'], review: 'Known for meticulous service, they check every sauce and ingredient if a nut allergy is disclosed.' } },

  { searchQuery: '권숙수 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '권숙수', cat: '전통 한식', tags: ['알레르기 맞춤 조리', '전 성분 기재', '방문 전 확인 권장'], review: '한식 특성상 잣이나 호두가 고명으로 쓰일 수 있으나, 예약 시 요청하면 철저히 배제해 줍니다.' },
    en: { name: 'Kwonsooksoo', cat: 'Traditional Korean', tags: ['Customized cooking', 'Full ingredient list', 'Check before visit'], review: 'Nuts like pine nuts or walnuts may be used as garnish, but can be strictly excluded upon request during booking.' } },

  { searchQuery: '울프강 스테이크하우스 청담동', risk: 'caution', cuisineType: '양식',
    ko: { name: '울프강 스테이크하우스', cat: '스테이크', tags: ['견과류 일부 메뉴 포함', '소스 제외 요청 필요', '메뉴별 확인 필수'], review: '고기 자체는 안전하나 사이드 메뉴나 디저트, 소스에 견과류가 포함될 수 있어 서버 확인이 필수입니다.' },
    en: { name: "Wolfgang's Steakhouse", cat: 'Steakhouse', tags: ['Nuts in some dishes', 'Request sauce exclusion', 'Must check per menu'], review: 'Steaks are generally safe, but sides, desserts, or sauces may contain nuts; confirm with the server.' } },

  { searchQuery: '레스토랑 온 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '레스토랑 온', cat: '프렌치', tags: ['예약 시 사전 고지 가능', '알레르기 맞춤 조리', '방문 전 확인 권장'], review: '정통 프렌치 기법을 사용하며, 견과류 알레르기 환자를 위해 베이스 소스부터 별도로 준비해 줍니다.' },
    en: { name: 'Restaurant Ohn', cat: 'French', tags: ['Pre-notification available', 'Customized cooking', 'Check before visit'], review: 'Uses authentic French techniques and can prepare base sauces separately for nut allergy guests.' } },

  { searchQuery: '뜨락 청담동', risk: 'caution', cuisineType: '한식',
    ko: { name: '뜨락', cat: '소고기 구이', tags: ['땅콩류 없음', '메뉴별 확인 필수', '소스 제외 요청 필요'], review: '고기 위주의 식단은 안전하지만, 밑반찬 중 견과류 조림이 나올 수 있으니 주의가 필요합니다.' },
    en: { name: 'Ttrak', cat: 'Korean BBQ', tags: ['No peanuts', 'Must check per menu', 'Request sauce exclusion'], review: 'The meat dishes are safe, but some side dishes might include braised nuts, so caution is advised.' } },

  { searchQuery: '페어링룸 청담동', risk: 'caution', cuisineType: '양식',
    ko: { name: '페어링룸', cat: '퓨전 이탈리안', tags: ['견과류 일부 메뉴 포함', '메뉴별 확인 필수', '알레르기 맞춤 조리'], review: '독특한 퓨전 요리가 많아 페스토나 가루 형태의 견과류가 들어갈 수 있으므로 주문 전 필히 고지해야 합니다.' },
    en: { name: 'Pairing Room', cat: 'Fusion Italian', tags: ['Nuts in some dishes', 'Must check per menu', 'Customized cooking'], review: 'Fusion dishes often use pesto or nut powders; informing the staff before ordering is essential.' } },

  { searchQuery: '피양옥 청담동', risk: 'safe', cuisineType: '한식',
    ko: { name: '피양옥', cat: '평양냉면', tags: ['땅콩류 없음', '전 성분 기재', '방문 전 확인 권장'], review: '냉면과 어복쟁반은 견과류를 거의 사용하지 않는 메뉴지만, 만두소 등의 재료를 재확인하는 것이 좋습니다.' },
    en: { name: 'Piyangok', cat: 'Pyeongyang Naengmyeon', tags: ['No peanuts', 'Full ingredient list', 'Check before visit'], review: 'Noodles and meat platters rarely use nuts, but it\'s good to double-check ingredients like dumpling fillings.' } },

  { searchQuery: '스시효 청담동', risk: 'safe', cuisineType: '일식',
    ko: { name: '스시효', cat: '초밥/오마카세', tags: ['땅콩류 없음', '알레르기 맞춤 조리', '예약 시 사전 고지 가능'], review: '정통 일식 스시는 견과류 사용이 매우 드물며, 디저트 외에는 견과류 위험이 거의 없습니다.' },
    en: { name: 'Sushi Hyo', cat: 'Sushi/Omakase', tags: ['No peanuts', 'Customized cooking', 'Pre-notification available'], review: 'Authentic sushi rarely uses nuts; the risk is minimal except for certain desserts.' } },

  { searchQuery: '보트르메종 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '보트르메종', cat: '프렌치', tags: ['예약 시 사전 고지 가능', '알레르기 맞춤 조리', '방문 전 확인 권장'], review: '정교한 소스를 사용하는 프렌치 다이닝으로, 견과류 오일 사용 여부를 주방에서 철저히 관리합니다.' },
    en: { name: 'Votre Maison', cat: 'French', tags: ['Pre-notification available', 'Customized cooking', 'Check before visit'], review: 'A fine dining place with complex sauces; the kitchen strictly manages the use of nut-based oils.' } },

  { searchQuery: '정식카페 청담동', risk: 'caution', cuisineType: '카페',
    ko: { name: '정식카페', cat: '브런치/카페', tags: ['견과류 일부 메뉴 포함', '디저트 주의', '메뉴별 확인 필수'], review: '브런치 메뉴는 대체로 안전하나, 베이커리와 디저트류에 견과류가 다량 포함되어 있습니다.' },
    en: { name: 'Jungsik Cafe', cat: 'Brunch/Cafe', tags: ['Nuts in some dishes', 'Watch out for desserts', 'Must check per menu'], review: 'Brunch is generally safe, but many bakery and dessert items contain significant amounts of nuts.' } },

  { searchQuery: '스케줄 청담 청담동', risk: 'caution', cuisineType: '양식',
    ko: { name: '스케줄 청담', cat: '이탈리안/브런치', tags: ['메뉴별 확인 필수', '소스 제외 요청 필요', '방문 전 확인 권장'], review: '리조또나 파스타 소스에 견과류가 들어가는 경우가 있어 주문 시 반드시 "땅콩/견과류 제외"를 요청해야 합니다.' },
    en: { name: 'Schedule Cheongdam', cat: 'Italian/Brunch', tags: ['Must check per menu', 'Request sauce exclusion', 'Check before visit'], review: 'Some risottos or pasta sauces contain nuts; you must request "no nuts" when ordering.' } },

  { searchQuery: '청담안 청담동', risk: 'info', cuisineType: '기타',
    ko: { name: '청담안', cat: '요리주점', tags: ['메뉴별 확인 필수', '방문 전 확인 권장', '견과류 일부 메뉴 포함'], review: '안주류 중 견과류가 포함된 것이 많으므로, 조리 전 주방에 확인을 요청하는 프로세스가 필요합니다.' },
    en: { name: 'Cheongdaman', cat: 'Gastropub', tags: ['Must check per menu', 'Check before visit', 'Nuts in some dishes'], review: 'Many appetizers contain nuts; it is necessary to ask the kitchen to verify ingredients before cooking.' } },

  { searchQuery: '톡톡 청담동', risk: 'info', cuisineType: '양식',
    ko: { name: '톡톡', cat: '이탈리안 퓨전', tags: ['알레르기 맞춤 조리', '예약 시 사전 고지 가능', '전 성분 기재'], review: '식재료 이해도가 높은 셰프가 상주하여 알레르기에 유연하게 대처해 주는 편입니다.' },
    en: { name: 'Toc Toc', cat: 'Italian Fusion', tags: ['Customized cooking', 'Pre-notification available', 'Full ingredient list'], review: 'The chefs have a high understanding of ingredients and are flexible in handling allergy requests.' } },

  { searchQuery: '팔레드신 청담동', risk: 'danger', cuisineType: '중식',
    ko: { name: '팔레드신', cat: '모던 중식', tags: ['땅콩 기름 사용', '견과류 일부 메뉴 포함', '메뉴별 확인 필수'], review: '중식 특성상 땅콩 기름이나 캐슈넛을 사용하는 요리가 매우 많아 교차 오염 위험이 큽니다.' },
    en: { name: 'Palais de Chine', cat: 'Modern Chinese', tags: ['Uses peanut oil', 'Nuts in some dishes', 'Must check per menu'], review: 'As with most Chinese cuisine, many dishes use peanut oil or cashews, posing a high risk of cross-contamination.' } },

  { searchQuery: '벨라비타 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '벨라비타 청담', cat: '프렌치/브런치 파인다이닝', tags: ['사전 고지 권장', '코스형 메뉴', '방문 전 확인 권장'], review: '청담권 파인다이닝/브런치 코스 업장으로 확인됩니다. 디저트·빵류 비중이 있어 견과류 사용 가능성을 배제하기 어려우므로 예약 시 알레르기 전달이 필요합니다.' },
    en: { name: 'Bellavita Cheongdam', cat: 'French/brunch fine dining', tags: ['Advance notice advised', 'Course menu', 'Check before visit'], review: 'Bellavita is confirmed as an upscale dining venue in Cheongdam. Since bread and dessert elements are common, nut exposure cannot be ruled out without direct confirmation.' } },

  { searchQuery: '오리지널 넘버스 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '오리지널 넘버스', cat: '컨템포러리 코스', tags: ['사전 고지 권장', '코스형 메뉴', '방문 전 확인 권장'], review: '청담동 코스 다이닝으로 확인되며 런치·디너 테이스팅 코스로 운영됩니다. 메뉴 변동성이 있으므로 견과류 알레르기는 방문 전 직접 확인이 필요합니다.' },
    en: { name: 'Original Numbers', cat: 'Contemporary tasting course', tags: ['Advance notice advised', 'Course menu', 'Check before visit'], review: 'A confirmed Cheongdam tasting-course restaurant. Because menu elements can change, nut-allergy handling should be checked directly before dining.' } },

  { searchQuery: '몽중헌 청담점 청담동', risk: 'caution', cuisineType: '중식',
    ko: { name: '몽중헌 청담점', cat: '딤섬/중식 다이닝', tags: ['메뉴별 확인 필수', '소스 확인 필요', '사전 고지 권장'], review: '딤섬·탕수육·북경오리 등 다양한 중식 메뉴를 운영하는 청담점입니다. 중식은 소스·토핑 편차가 커서 땅콩/견과류 직접 사용 여부를 메뉴별로 확인해야 합니다.' },
    en: { name: 'Mongjungheon Cheongdam', cat: 'Dim sum / Chinese dining', tags: ['Menu-by-menu check', 'Sauce check needed', 'Advance notice advised'], review: 'This branch serves dim sum and broader Chinese dishes. Because Chinese sauces and garnishes vary, nut exposure should be checked item by item.' } },

  { searchQuery: '비스트로 드 욘트빌 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '비스트로 드 욘트빌', cat: '프렌치 비스트로', tags: ['사전 고지 권장', '메뉴 변동 가능', '방문 전 확인 권장'], review: '청담 프렌치 비스트로로 확인되며 코스/단품 선택이 섞인 구조입니다. 공식 알레르기 표시는 확인되지 않아 예약 시 알레르기 전달 후 메뉴 확인이 필요합니다.' },
    en: { name: 'Bistrot de Yountville', cat: 'French bistro', tags: ['Advance notice advised', 'Menu may vary', 'Check before visit'], review: 'A confirmed French bistro in Cheongdam with changing menu selections. No clear official nut-allergen sheet found; pre-confirmation is advisable.' } },

  { searchQuery: 'JS가든 청담동', risk: 'caution', cuisineType: '중식',
    ko: { name: 'JS가든 청담', cat: '차이니즈 파인다이닝', tags: ['메뉴별 확인 필수', '소스 확인 필요', '사전 고지 권장'], review: '청담 고급 중식당으로 찹쌀탕수육·북경오리 등 다품목 운영입니다. 중식은 소스·토핑 변수가 커 메뉴별 확인이 필요합니다.' },
    en: { name: 'JS Garden Cheongdam', cat: 'Chinese fine dining', tags: ['Menu-by-menu check', 'Sauce check needed', 'Advance notice advised'], review: 'An upscale Chinese dining venue in Cheongdam. The main issue is variable sauces and garnishes, so each dish should be checked individually.' } },

  { searchQuery: '익스퀴진 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '익스퀴진', cat: '컨템포러리 파인다이닝', tags: ['사전 고지 권장', '코스형 메뉴', '방문 전 확인 권장'], review: '청담 파인다이닝 리스트에 지속적으로 포함되는 업장입니다. 코스 다이닝 특성상 견과류 미사용을 일반화할 수 없어 사전 문의가 필요합니다.' },
    en: { name: 'Exquisine', cat: 'Contemporary fine dining', tags: ['Advance notice advised', 'Course menu', 'Check before visit'], review: 'Consistently listed among Cheongdam fine-dining venues. Course menus change, so nut safety should be confirmed directly with the restaurant.' } },

  { searchQuery: '쵸이닷 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '쵸이닷', cat: '컨템포러리 파인다이닝', tags: ['사전 고지 권장', '코스형 메뉴', '방문 전 확인 권장'], review: '청담 파인다이닝 순위권 업장으로 확인됩니다. 코스 중심 레스토랑이어서 알레르기 대응 가능성이 있지만 땅콩/견과류 완전 배제는 사전 확인이 필요합니다.' },
    en: { name: 'Choi Dot', cat: 'Contemporary fine dining', tags: ['Advance notice advised', 'Course menu', 'Check before visit'], review: 'Listed among Cheongdam fine-dining venues. May accommodate ingredient restrictions, but complete nut exclusion should be checked in advance.' } },

  { searchQuery: '트리드 청담동', risk: 'info', cuisineType: '파인다이닝',
    ko: { name: '트리드', cat: '컨템포러리 다이닝', tags: ['사전 고지 권장', '코스형 메뉴', '방문 전 확인 권장'], review: '청담 코스요리/파인다이닝 리스트에 포함되는 업장입니다. 공식 알레르기 공개자료를 찾지 못해 보수적으로 info로 분류합니다.' },
    en: { name: 'Trid', cat: 'Contemporary dining', tags: ['Advance notice advised', 'Course menu', 'Check before visit'], review: 'Appears in Cheongdam fine-dining and course-meal listings, but no clear official nut-allergen sheet was found.' } },

  { searchQuery: '스타벅스 청담스타점 청담동', risk: 'info', cuisineType: '카페',
    ko: { name: '스타벅스 청담스타점', cat: '커피/카페', tags: ['표시 변동 이슈', '포장 표시 재확인', '방문 전 확인 권장'], review: '스타벅스는 과거 푸드 알레르기 표시 불일치 지적이 있어 음료보다 푸드류는 포장지 재확인이 안전합니다.' },
    en: { name: 'Starbucks Cheongdam Star', cat: 'Coffee / cafe', tags: ['Label inconsistency issue', 'Recheck package label', 'Check before visit'], review: 'Starbucks Korea has faced criticism over inconsistent allergen labeling on some food items; packaged food should be rechecked carefully.' } },

  { searchQuery: '라미띠에 청담동', risk: 'danger', cuisineType: '파인다이닝',
    ko: { name: '라미띠에', cat: '프렌치 파인다이닝', tags: ['견과류 사용 확인', '빵류 주의', '경고용'], review: '외부 소개 글에서 식전 빵에 견과류가 들어간다는 언급이 확인됩니다. 심한 견과류 알레르기라면 기본 제공 빵과 디저트까지 포함해 강하게 주의해야 합니다.' },
    en: { name: "L'Amitie", cat: 'French fine dining', tags: ['Nuts confirmed', 'Watch bread service', 'Warning'], review: 'A public review explicitly mentions nut-containing bread served before the meal. A clear warning sign for severe tree-nut allergy.' } },

  { searchQuery: '쉐이크쉑 청담 청담동', risk: 'caution', cuisineType: '양식',
    ko: { name: '쉐이크쉑 청담', cat: '버거', tags: ['메뉴별 확인 필수', '쉐이크류 주의', '교차접촉 주의'], review: '청담점 존재는 공식적으로 확인됩니다. 버거·쉐이크·디저트류는 토핑/한정메뉴 변수와 교차접촉 가능성이 있어 주문 전 원재료 확인이 필요합니다.' },
    en: { name: 'Shake Shack Cheongdam', cat: 'Burgers', tags: ['Menu-by-menu check', 'Watch shakes', 'Cross-contact caution'], review: "The Cheongdam location is officially listed. Because burgers, shakes, and seasonal items can vary and cross-contact is possible, ingredients should be checked before ordering." } },

  // ── 대치 ──
  { searchQuery: '아웃백스테이크하우스 대치동', risk: 'info', cuisineType: '양식',
    ko: { name: '아웃백 스테이크하우스 대치점', cat: '스테이크', tags: ['알레르기 정보 상세 제공', '메뉴별 확인 필수', '소스 제외 요청 필요'], review: '본사 차원의 알레르기 가이드라인이 있어 서버에게 문의하면 정확한 성분 확인이 가능합니다.' },
    en: { name: 'Outback Steakhouse Daechi', cat: 'Steakhouse', tags: ['Detailed allergy info', 'Must check per menu', 'Request sauce exclusion'], review: 'Corporate allergy guidelines in place; staff can provide accurate ingredient information upon request.' } },

  { searchQuery: '본죽 대치동', risk: 'safe', cuisineType: '한식',
    ko: { name: '본죽 대치점', cat: '죽', tags: ['땅콩류 없음', '알레르기 맞춤 조리', '방문 전 확인 권장'], review: '견과류가 들어가는 죽(잣죽 등)은 별도 조리 용기를 사용하며, 고명 제외를 요청하기 쉽습니다.' },
    en: { name: 'Bonjuk Daechi', cat: 'Porridge', tags: ['No peanuts', 'Customized cooking', 'Check before visit'], review: 'Nuts are limited to specific dishes like pine nut porridge; you can easily request to exclude garnishes.' } },

  { searchQuery: '밀란국수 대치동', risk: 'caution', cuisineType: '한식',
    ko: { name: '밀란국수 대치점', cat: '국수/샤브샤브', tags: ['메뉴별 확인 필수', '견과류 일부 메뉴 포함', '땅콩류 없음'], review: '샤브샤브와 국수는 안전하나, 여름철 콩국수에 견과류를 섞는 경우가 있어 확인이 필요합니다.' },
    en: { name: 'Milan Guksu Daechi', cat: 'Noodles/Shabu-shabu', tags: ['Must check per menu', 'Nuts in some dishes', 'No peanuts'], review: 'Shabu-shabu and noodles are safe, but check for nuts in seasonal dishes like cold soybean noodles.' } },

  { searchQuery: '서브웨이 대치동', risk: 'caution', cuisineType: '기타',
    ko: { name: '서브웨이 대치점', cat: '샌드위치', tags: ['알레르기 정보 상세 제공', '쿠키 주의', '교차 오염 위험'], review: '샌드위치 재료는 투명하게 공개되나, 견과류가 든 쿠키를 같은 오븐이나 집기로 취급할 수 있습니다.' },
    en: { name: 'Subway Daechi', cat: 'Sandwich', tags: ['Detailed allergy info', 'Watch out for cookies', 'Cross-contamination risk'], review: 'Ingredients are transparent, but cookies containing nuts are handled nearby, posing a potential risk.' } },

  { searchQuery: '바르다김선생 대치동', risk: 'safe', cuisineType: '한식',
    ko: { name: '바르다김선생 대치점', cat: '김밥/분식', tags: ['땅콩류 없음', '전 성분 기재', '방문 전 확인 권장'], review: '식재료 관리가 엄격하며, 김밥 소스 등에 견과류가 들어가지 않아 비교적 안전한 선택지입니다.' },
    en: { name: 'Barada Kimseonsaeng Daechi', cat: 'Gimbap/Snack', tags: ['No peanuts', 'Full ingredient list', 'Check before visit'], review: 'Strict ingredient management; their gimbap and sauces generally do not contain nuts.' } },

  { searchQuery: '마켓오네이처 대치동', risk: 'caution', cuisineType: '샐러드/비건',
    ko: { name: '마켓오네이처 대치점', cat: '샐러드/브런치', tags: ['견과류 일부 메뉴 포함', '소스 제외 요청 필요', '메뉴별 확인 필수'], review: '그래놀라나 드레싱에 견과류가 기본 포함되는 경우가 많아 주문 시 제외를 꼭 말해야 합니다.' },
    en: { name: 'Market O Nature Daechi', cat: 'Salad/Brunch', tags: ['Nuts in some dishes', 'Request sauce exclusion', 'Must check per menu'], review: 'Granola and dressings often contain nuts by default; ensure you request their exclusion when ordering.' } },

  { searchQuery: '중앙해장 대치동', risk: 'safe', cuisineType: '한식',
    ko: { name: '중앙해장', cat: '해장국/곱창전골', tags: ['땅콩류 없음', '메뉴별 확인 필수', '방문 전 확인 권장'], review: '내장탕과 전골 위주로 견과류 사용이 거의 없지만, 양념장에 포함 여부를 한 번 더 확인하세요.' },
    en: { name: 'Jungang Haejang', cat: 'Hangover Soup', tags: ['No peanuts', 'Must check per menu', 'Check before visit'], review: 'Nuts are rarely used in their soups and hot pots, but verify the ingredients in the dipping sauces.' } },

  { searchQuery: '파이어벨 대치동', risk: 'caution', cuisineType: '양식',
    ko: { name: '파이어벨', cat: '수제버거', tags: ['견과류 일부 메뉴 포함', '메뉴별 확인 필수', '땅콩류 없음'], review: '버거 번에 견과류 토핑이 있거나 소스에 섞여 있을 수 있으므로 알레르기 여부를 미리 고지해야 합니다.' },
    en: { name: 'Firebell', cat: 'Handmade Burger', tags: ['Nuts in some dishes', 'Must check per menu', 'No peanuts'], review: 'Buns may have nut toppings or sauces might contain them; inform the staff about your allergy in advance.' } },

  { searchQuery: '창고43 대치동', risk: 'safe', cuisineType: '한식',
    ko: { name: '창고43', cat: '소고기 구이', tags: ['땅콩류 없음', '전 성분 기재', '방문 전 확인 권장'], review: '구이 메뉴는 견과류로부터 매우 안전하며, 반찬류만 주의하면 가족 외식에 적합합니다.' },
    en: { name: 'Changgo 43', cat: 'Korean BBQ', tags: ['No peanuts', 'Full ingredient list', 'Check before visit'], review: 'Grilled menu items are very safe from nuts; just watch out for side dishes for a safe family meal.' } },

  { searchQuery: '투뿔등심 대치동', risk: 'safe', cuisineType: '한식',
    ko: { name: '투뿔등심 대치점', cat: '소고기 구이', tags: ['땅콩류 없음', '알레르기 맞춤 조리', '방문 전 확인 권장'], review: '프리미엄 고기 전문점으로 견과류 사용이 제한적이며 요청 시 반찬 구성을 조절해 줍니다.' },
    en: { name: 'Two Plus Deungsim Daechi', cat: 'Korean BBQ', tags: ['No peanuts', 'Customized cooking', 'Check before visit'], review: 'A premium BBQ spot with limited nut usage; they can adjust side dishes upon request.' } },

  { searchQuery: '남소관우육도면 대치동', risk: 'danger', cuisineType: '중식',
    ko: { name: '남소관우육도면', cat: '우육면/딤섬', tags: ['땅콩류 포함 가능성 높음', '메뉴별 확인 필수', '소스 주의'], review: '우육면 육수나 탄탄면, 딤섬 소스에 땅콩이 들어가는 경우가 많아 위험도가 높습니다.' },
    en: { name: 'Namsogwan', cat: 'Beef Noodles/Dim Sum', tags: ['High chance of nuts', 'Must check per menu', 'Watch out for sauces'], review: 'High risk as peanuts are often used in beef noodle broth, tantanmen, and dim sum dipping sauces.' } },

  { searchQuery: '스타벅스 대치동', risk: 'info', cuisineType: '카페',
    ko: { name: '스타벅스 대치점', cat: '커피/베이커리', tags: ['알레르기 정보 상세 제공', '교차 오염 위험', '디저트 주의'], review: '앱이나 카운터에서 성분표 확인이 가능하나, 제조 음료의 경우 블렌더 공유로 인한 교차 오염을 주의해야 합니다.' },
    en: { name: 'Starbucks Daechi', cat: 'Coffee/Bakery', tags: ['Detailed allergy info', 'Cross-contamination risk', 'Watch out for desserts'], review: 'Ingredient lists available via app or counter, but be wary of shared blenders for handmade drinks.' } },

  { searchQuery: '홍콩반점0410 대치동', risk: 'danger', cuisineType: '중식',
    ko: { name: '홍콩반점0410 대치점', cat: '짜장/짬뽕', tags: ['땅콩 기름 사용', '메뉴별 확인 필수', '교차 오염 위험'], review: '일부 메뉴에 땅콩 가루가 올라가거나 조리 과정에서 견과류 기름이 사용될 수 있어 위험합니다.' },
    en: { name: 'Hong Kong Banjum Daechi', cat: 'Chinese Noodles', tags: ['Uses peanut oil', 'Must check per menu', 'Cross-contamination risk'], review: 'Risky as some dishes have peanut powder toppings or may use nut-based oils during cooking.' } },

  { searchQuery: '서리재 대치동', risk: 'safe', cuisineType: '한식',
    ko: { name: '서리재', cat: '직화구이', tags: ['땅콩류 없음', '전 성분 기재', '방문 전 확인 권장'], review: '깔끔한 한식당으로 견과류를 거의 쓰지 않으나, 쌈장이나 밑반찬류를 확인하면 안전합니다.' },
    en: { name: 'Seorijae', cat: 'Grilled Meat', tags: ['No peanuts', 'Full ingredient list', 'Check before visit'], review: 'A clean Korean restaurant that rarely uses nuts; check the ssamjang and side dishes just to be safe.' } },

  { searchQuery: '공차 대치동', risk: 'caution', cuisineType: '카페',
    ko: { name: '공차 대치점', cat: '밀크티', tags: ['메뉴별 확인 필수', '교차 오염 위험', '알레르기 정보 상세 제공'], review: '토핑이나 파우더 중 견과류 성분이 포함된 것이 있으니 제조 전 세척된 기구 사용을 요청해야 합니다.' },
    en: { name: 'Gong Cha Daechi', cat: 'Milk Tea', tags: ['Must check per menu', 'Cross-contamination risk', 'Detailed allergy info'], review: 'Some toppings or powders contain nuts; request the use of clean utensils before preparation.' } },

  { searchQuery: '샐러디 대치점 대치동', risk: 'caution', cuisineType: '샐러드/비건',
    ko: { name: '샐러디 대치점', cat: '샐러드/랩', tags: ['견과류 토핑 존재', '드레싱 확인 필요', '토핑 제외 가능'], review: '샐러디 공식 알레르기표에는 견과류 토핑과 잣·호두가 들어가는 드레싱/메뉴가 있어 주문 시 견과류·해당 드레싱 제외 요청이 필요합니다.' },
    en: { name: 'Salady Daechi', cat: 'Salads / wraps', tags: ['Nut toppings exist', 'Check dressings', 'Can remove toppings'], review: "Salady's official allergy guide shows nut topping options and some dressings involving pine nut or walnut, so custom exclusion is necessary." } },

  { searchQuery: '폴 바셋 대치역점 대치동', risk: 'caution', cuisineType: '카페',
    ko: { name: '폴 바셋 대치역점', cat: '커피/카페', tags: ['베이커리 주의', '메뉴별 확인 필수', '방문 전 확인 권장'], review: '폴 바셋 푸드 메뉴는 베이커리·케이크류 비중이 있어 견과류 사용 가능성이 높으므로 음료 중심 이용 또는 포장 라벨 확인이 안전합니다.' },
    en: { name: 'Paul Bassett Daechi Station', cat: 'Coffee / cafe', tags: ['Watch bakery items', 'Menu-by-menu check', 'Check before visit'], review: 'Paul Bassett offers many bakery and cake items, so nut exposure is possible; drinks are safer than pastries unless labels are checked.' } },

  { searchQuery: '스타벅스 대치은마사거리점 대치동', risk: 'info', cuisineType: '카페',
    ko: { name: '스타벅스 대치은마사거리점', cat: '커피/카페', tags: ['표시 변동 이슈', '포장 표시 재확인', '방문 전 확인 권장'], review: '스타벅스는 일부 푸드의 알레르기 표기 불일치 이슈가 있어 푸드보다는 단순 음료 위주로 이용하고 포장 표기를 재확인하는 편이 낫습니다.' },
    en: { name: 'Starbucks Daechi Eunma Sageori', cat: 'Coffee / cafe', tags: ['Label inconsistency issue', 'Recheck package label', 'Check before visit'], review: 'Starbucks Korea has had inconsistent allergen labeling issues on some food items; simple drinks are generally safer unless food labels are rechecked.' } },

  { searchQuery: '스타벅스 한티역점 대치동', risk: 'info', cuisineType: '카페',
    ko: { name: '스타벅스 한티역점', cat: '커피/카페', tags: ['표시 변동 이슈', '포장 표시 재확인', '방문 전 확인 권장'], review: '대치 학원가 생활권 매장으로 확인됩니다. 스타벅스 푸드류는 표시 일치성 이슈가 있었기 때문에 견과류 알레르기라면 푸드 구매 전 포장지 확인이 필요합니다.' },
    en: { name: 'Starbucks Hanti Station', cat: 'Coffee / cafe', tags: ['Label inconsistency issue', 'Recheck package label', 'Check before visit'], review: 'Confirmed in the Daechi/Hanti area. For nut allergy, Starbucks food should be checked against the package label due to past labeling inconsistency.' } },

  { searchQuery: '맥도날드 한티역점 대치동', risk: 'caution', cuisineType: '양식',
    ko: { name: '맥도날드 한티역점', cat: '버거', tags: ['공식 알레르기표 제공', '메뉴별 확인 필수', '치킨류 주의'], review: '맥도날드 코리아는 공식 알레르기표를 제공하므로 메뉴 선별이 가능하지만 치킨·디저트·한정 메뉴는 성분표를 반드시 다시 확인해야 합니다.' },
    en: { name: "McDonald's Hanti Station", cat: 'Burgers', tags: ['Official allergen chart', 'Menu-by-menu check', 'Watch chicken items'], review: "McDonald's Korea provides an official allergen list, which helps, but chicken, dessert, and limited items should still be checked individually." } },

  { searchQuery: '맥도날드 대치점 대치동', risk: 'caution', cuisineType: '양식',
    ko: { name: '맥도날드 대치점', cat: '버거', tags: ['공식 알레르기표 제공', '메뉴별 확인 필수', '치킨류 주의'], review: '공식 알레르기표 기반으로 땅콩/견과류 비노출 메뉴를 고르기 쉬운 편이지만 주문 시 최신 성분표를 다시 보는 것이 안전합니다.' },
    en: { name: "McDonald's Daechi", cat: 'Burgers', tags: ['Official allergen chart', 'Menu-by-menu check', 'Watch chicken items'], review: "McDonald's Korea's official allergen chart makes screening easier, but the latest ingredient listing should still be checked at ordering." } },

  { searchQuery: '롯데리아 한티역점 대치동', risk: 'danger', cuisineType: '양식',
    ko: { name: '롯데리아 한티역점', cat: '버거/패스트푸드', tags: ['땅콩 포함 메뉴 존재', '치킨류 주의', '경고용'], review: '롯데리아 공식 영양성분표에는 치킨버거·치킨다리·화이어윙 등 여러 치킨류에 땅콩이 표기되어 있어 중증 땅콩 알레르기라면 보수적으로 피하는 편이 안전합니다.' },
    en: { name: 'Lotteria Hanti Station', cat: 'Burgers / fast food', tags: ['Peanut-containing items exist', 'Watch chicken items', 'Warning'], review: "Lotteria's official allergen table explicitly lists peanut on several chicken items, making this a high-caution venue for severe peanut allergy." } },

  { searchQuery: '아임크레페 대치동', risk: 'caution', cuisineType: '카페',
    ko: { name: '아임크레페', cat: '크레페', tags: ['누텔라 제외 요청 필요', '메뉴별 확인 필수', '견과류 일부 메뉴 포함'], review: '견과류 알레르기가 있으면 누텔라를 빼달라고 요청해야 한다는 언급이 확인됩니다. 달콤한 크레페류는 메뉴별로 견과류 확인이 필수입니다.' },
    en: { name: "I'm Crepe", cat: 'Crepes', tags: ['Ask to remove Nutella', 'Menu-by-menu check', 'Some nut-containing items'], review: 'A local review specifically notes customers with nut allergy should request Nutella removal. Sweet crepes need item-by-item screening.' } },

  { searchQuery: '본죽비빔밥 대치은마점 대치동', risk: 'info', cuisineType: '한식',
    ko: { name: '본죽&비빔밥 대치은마점', cat: '죽/비빔밥', tags: ['공식 알레르기표 제공', '메뉴별 확인 필수', '방문 전 확인 권장'], review: '본죽은 공식 알레르기표를 제공하지만 일부 메뉴·부재료에 잣, 호두, 땅콩 간접 노출 항목이 있어 안전 메뉴를 표 기준으로 골라야 합니다.' },
    en: { name: 'Bonjuk & Bibimbap Daechi Eunma', cat: 'Porridge / bibimbap', tags: ['Official allergen chart', 'Menu-by-menu check', 'Check before visit'], review: 'Bonjuk publishes allergen information, but some items and add-ons show pine nut, walnut, or indirect peanut exposure, so item selection matters.' } },

  { searchQuery: '모스버거 대치역점 대치동', risk: 'info', cuisineType: '양식',
    ko: { name: '모스버거 대치역점', cat: '버거', tags: ['메뉴별 확인 필수', '소스 확인 필요', '방문 전 확인 권장'], review: '국내 공식 알레르기표를 바로 확인하기 어려워 소스·사이드 포함 전체 구성 확인이 필요합니다.' },
    en: { name: 'MOS Burger Daechi Station', cat: 'Burgers', tags: ['Menu-by-menu check', 'Check sauces', 'Check before visit'], review: 'A clearly accessible Korea allergen matrix is not obvious, so full ingredient confirmation is recommended before ordering.' } },

  { searchQuery: '육판장 대치동', risk: 'info', cuisineType: '한식',
    ko: { name: '육판장', cat: '집밥/찌개', tags: ['한식 위주', '소스 별도 확인', '방문 전 확인 권장'], review: '부대찌개·된장찌개·육회비빔밥 등 기본 메뉴상 견과류 노출은 높지 않아 보이나 양념장과 반찬은 방문 전 확인이 필요합니다.' },
    en: { name: 'Yukpanjang', cat: 'Korean homestyle / stews', tags: ['Mostly Korean dishes', 'Check sauces separately', 'Check before visit'], review: 'Core dishes do not obviously center on nuts, but seasonings and side dishes should still be checked.' } },

  { searchQuery: '철따라자연산 대치동', risk: 'info', cuisineType: '한식',
    ko: { name: '철따라자연산', cat: '횟집', tags: ['생선회 위주', '양념 확인 필요', '방문 전 확인 권장'], review: '회 자체는 비교적 단순하지만 무침·양념·기본찬 구성은 식당마다 달라 견과류나 참기름류 포함 여부를 확인해야 합니다.' },
    en: { name: 'Cheolttara Jayeonsan', cat: 'Sashimi / seafood', tags: ['Mostly raw fish', 'Check seasonings', 'Check before visit'], review: 'The sashimi itself is simple, but side dishes and seasoned items can vary and should be checked.' } },

  { searchQuery: '희앤락 대치동', risk: 'caution', cuisineType: '중식',
    ko: { name: '희앤락', cat: '양갈비/양꼬치', tags: ['양념 확인 필요', '소스 별도 요청', '메뉴별 확인 필수'], review: '꼬치류는 시즈닝·찍어먹는 소스 변수 때문에 견과류 알레르기라면 양념 없는 구이와 소스 분리를 요청하는 편이 낫습니다.' },
    en: { name: 'Hee & Rak', cat: 'Lamb ribs / skewers', tags: ['Check marinades', 'Ask for sauce separately', 'Menu-by-menu check'], review: 'With skewers and dipping sauces, the main risk is seasoning variability, so plain grilled options are safer.' } },

  // ── 개포 ──
  { searchQuery: '리북풍운 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '리북풍운', cat: '이북음식', tags: ['땅콩류 없음', '방문 전 확인 권장', '전 성분 기재'], review: '슴슴한 이북식 요리들로 견과류 사용이 거의 없습니다. 만두나 어복쟁반 모두 안전한 편입니다.' },
    en: { name: 'Libuk Pungun', cat: 'North Korean Food', tags: ['No peanuts', 'Check before visit', 'Full ingredient list'], review: 'Mild North Korean-style dishes with minimal nut usage. Dumplings and meat platters are generally safe.' } },

  { searchQuery: '밀란국수 개포동', risk: 'caution', cuisineType: '한식',
    ko: { name: '밀란국수 개포점', cat: '들깨칼국수/샤브', tags: ['메뉴별 확인 필수', '견과류 일부 메뉴 포함', '방문 전 확인 권장'], review: '들깨 칼국수 등에 고소함을 더하기 위해 견과류가 섞일 수 있으므로 반드시 확인이 필요합니다.' },
    en: { name: 'Milan Guksu Gaepo', cat: 'Perilla Noodle/Shabu', tags: ['Must check per menu', 'Nuts in some dishes', 'Check before visit'], review: 'Nuts might be mixed in perilla noodles for extra savoriness; verification is necessary.' } },

  { searchQuery: '하영호신촌깻잎떡볶이 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '하영호신촌깻잎떡볶이', cat: '떡볶이/분식', tags: ['땅콩류 없음', '메뉴별 확인 필수', '방문 전 확인 권장'], review: '일반적인 떡볶이 양념에는 견과류가 들어가지 않지만, 튀김류의 반죽 배합을 확인하는 것이 좋습니다.' },
    en: { name: 'Shinchon Sesame Leaf Tteokbokki', cat: 'Tteokbokki/Snack', tags: ['No peanuts', 'Must check per menu', 'Check before visit'], review: 'Standard tteokbokki sauce doesn\'t use nuts, but it\'s good to check the batter for fried items.' } },

  { searchQuery: '개포동부산어묵 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '부산어묵 개포점', cat: '어묵/분식', tags: ['땅콩류 없음', '방문 전 확인 권장', '전 성분 기재'], review: '어묵과 떡볶이가 주메뉴이며 견과류 오염 위험이 매우 낮은 동네 맛집입니다.' },
    en: { name: 'Busan Eomuk Gaepo', cat: 'Fishcake/Snack', tags: ['No peanuts', 'Check before visit', 'Full ingredient list'], review: 'A local favorite specializing in fishcakes and tteokbokki with very low risk of nut contamination.' } },

  { searchQuery: '성수족발 개포점 개포동', risk: 'caution', cuisineType: '한식',
    ko: { name: '성수족발 개포점', cat: '족발', tags: ['메뉴별 확인 필수', '땅콩류 없음', '소스 제외 요청 필요'], review: '족발 삶는 물이나 막국수 양념에 땅콩이나 견과류가 들어갈 수 있으니 주문 전 확인하세요.' },
    en: { name: 'Seongsu Jokbal Gaepo', cat: 'Pork Trotters', tags: ['Must check per menu', 'No peanuts', 'Request sauce exclusion'], review: 'Peanuts may be in the pork boiling liquid or the noodles\' sauce; confirm before ordering.' } },

  { searchQuery: '밀밭 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '밀밭', cat: '칼국수/수제비', tags: ['땅콩류 없음', '메뉴별 확인 필수', '방문 전 확인 권장'], review: '전통적인 칼국수 집으로 견과류를 쓰지 않으나, 겉절이 양념 등에 잣이 들어가는지 확인이 필요합니다.' },
    en: { name: 'Milbat', cat: 'Kalguksu', tags: ['No peanuts', 'Must check per menu', 'Check before visit'], review: 'A traditional noodle house that doesn\'t use nuts, but check if pine nuts are in the fresh kimchi.' } },

  { searchQuery: '옥류헌 개포동', risk: 'info', cuisineType: '한식',
    ko: { name: '옥류헌', cat: '한정식', tags: ['알레르기 맞춤 조리', '전 성분 기재', '방문 전 확인 권장'], review: '한정식 코스 중 견과류가 든 메뉴가 포함될 수 있으나, 예약 시 미리 말하면 대체 가능합니다.' },
    en: { name: 'Okryuheon', cat: 'Korean Table D\'hote', tags: ['Customized cooking', 'Full ingredient list', 'Check before visit'], review: 'Nut-containing dishes may be part of the course; they can be replaced if requested during booking.' } },

  { searchQuery: '강남교자 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '강남교자 개포점', cat: '칼국수/만두', tags: ['땅콩류 없음', '전 성분 기재', '메뉴별 확인 필수'], review: '닭 육수 베이스의 칼국수로 견과류 위험이 거의 없으며 원재료 관리가 투명합니다.' },
    en: { name: 'Gangnam Gyoza Gaepo', cat: 'Kalguksu/Dumpling', tags: ['No peanuts', 'Full ingredient list', 'Must check per menu'], review: 'Chicken broth-based noodles with almost no nut risk; raw material management is transparent.' } },

  { searchQuery: '스시강 개포동', risk: 'safe', cuisineType: '일식',
    ko: { name: '스시강', cat: '초밥', tags: ['땅콩류 없음', '방문 전 확인 권장', '메뉴별 확인 필수'], review: '일식 초밥 전문점은 견과류로부터 안전한 편이지만, 샐러드 드레싱은 주의해야 합니다.' },
    en: { name: 'Sushi Kang', cat: 'Sushi', tags: ['No peanuts', 'Check before visit', 'Must check per menu'], review: 'Sushi restaurants are generally safe from nuts, but be cautious with salad dressings.' } },

  { searchQuery: '명우돈가 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '명우돈가', cat: '돼지고기 구이', tags: ['땅콩류 없음', '메뉴별 확인 필수', '방문 전 확인 권장'], review: '고기 구이는 안전하나 된장찌개나 소스에 견과류 가루를 섞는지 확인해 보는 것이 좋습니다.' },
    en: { name: 'Myeongwoo Donga', cat: 'Pork BBQ', tags: ['No peanuts', 'Must check per menu', 'Check before visit'], review: 'Grilled meat is safe, but verify if nut powder is mixed into the soybean stew or sauces.' } },

  { searchQuery: '개포한식 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '개포한식', cat: '백반', tags: ['땅콩류 없음', '방문 전 확인 권장', '메뉴별 확인 필수'], review: '가정식 백반집으로 매일 반찬이 바뀌므로 견과류 조림 유무를 식사 전 확인해야 합니다.' },
    en: { name: 'Gaepo Hansik', cat: 'Home-style Meal', tags: ['No peanuts', 'Check before visit', 'Must check per menu'], review: 'A home-style eatery where side dishes change daily; check for braised nuts before eating.' } },

  { searchQuery: '오부장치킨 개포동', risk: 'caution', cuisineType: '기타',
    ko: { name: '오부장치킨', cat: '치킨', tags: ['메뉴별 확인 필수', '땅콩 기름 사용 주의', '소스 제외 요청 필요'], review: '양념치킨 위에 땅콩 가루가 기본으로 올라가는 경우가 많으니 반드시 빼달라고 요청해야 합니다.' },
    en: { name: 'Oh Bujang Chicken', cat: 'Fried Chicken', tags: ['Must check per menu', 'Watch for peanut oil', 'Request sauce exclusion'], review: 'Peanut powder is often topped on seasoned chicken; you must explicitly ask to exclude it.' } },

  { searchQuery: '마실들 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '마실들', cat: '보쌈/칼국수', tags: ['땅콩류 없음', '방문 전 확인 권장', '메뉴별 확인 필수'], review: '보쌈 김치에 잣이 들어가는지 여부만 확인하면 전반적으로 견과류 위험이 낮은 식당입니다.' },
    en: { name: 'Masildeul', cat: 'Bossam/Noodles', tags: ['No peanuts', 'Check before visit', 'Must check per menu'], review: 'Generally a low-risk restaurant; just confirm if pine nuts are in the bossam kimchi.' } },

  { searchQuery: '개포동떡볶이 개포동', risk: 'safe', cuisineType: '한식',
    ko: { name: '개포동떡볶이', cat: '분식', tags: ['땅콩류 없음', '전 성분 기재', '방문 전 확인 권장'], review: '동네 분식집으로 견과류 오염 가능성이 적지만 튀김 반죽의 견과류 포함 여부는 물어보세요.' },
    en: { name: 'Gaepo-dong Tteokbokki', cat: 'Snack Food', tags: ['No peanuts', 'Full ingredient list', 'Check before visit'], review: 'A local snack bar with low risk, but ask if the fried batter contains any nut products.' } },

  { searchQuery: '반포식스 개포점 개포동', risk: 'danger', cuisineType: '기타',
    ko: { name: '반포식스 개포점', cat: '동남아 음식', tags: ['땅콩류 다량 사용', '교차 오염 위험', '소스 주의'], review: '팟타이나 나시고랭 등에 땅콩이 주재료로 쓰여 알레르기 환자에게 매우 위험할 수 있습니다.' },
    en: { name: 'Banpo 6 Gaepo', cat: 'SE Asian Food', tags: ['Heavy use of peanuts', 'Cross-contamination risk', 'Watch out for sauces'], review: 'Very risky as peanuts are key ingredients in Pad Thai and Nasi Goreng; proceed with extreme caution.' } },

  { searchQuery: '스타벅스 개포동점 개포동', risk: 'info', cuisineType: '카페',
    ko: { name: '스타벅스 개포동점', cat: '커피/카페', tags: ['표시 변동 이슈', '포장 표시 재확인', '방문 전 확인 권장'], review: '스타벅스 푸드류는 과거 알레르기 표기 불일치가 지적된 바 있어 음료보다 푸드 주문 시 포장지 재확인이 필요합니다.' },
    en: { name: 'Starbucks Gaepo-dong', cat: 'Coffee / cafe', tags: ['Label inconsistency issue', 'Recheck package label', 'Check before visit'], review: 'For food items, package-label recheck is recommended because Starbucks Korea has faced allergen-label inconsistency concerns.' } },

  { searchQuery: '써브웨이 포이사거리점 개포동', risk: 'caution', cuisineType: '양식',
    ko: { name: '써브웨이 포이사거리점', cat: '샌드위치', tags: ['소스 제외 요청 필요', '교차접촉 주의', '쿠키/디저트 분리'], review: '샌드위치 조립 과정상 교차접촉 우려가 있어 견과류 알레르기라면 단순 조합 주문과 쿠키·디저트류 회피가 안전합니다.' },
    en: { name: 'Subway Poi Sageori', cat: 'Sandwiches', tags: ['Ask to omit sauces', 'Cross-contact caution', 'Avoid cookies/desserts'], review: 'Because Subway uses an assembly line, simpler builds and avoiding dessert items are safer for nut-allergic diners.' } },

  { searchQuery: '샐러디 포이사거리점 개포동', risk: 'caution', cuisineType: '샐러드/비건',
    ko: { name: '샐러디 포이사거리점', cat: '샐러드/랩', tags: ['견과류 토핑 존재', '드레싱 확인 필요', '토핑 제외 가능'], review: '샐러디 공식 알레르기표에는 견과류 토핑 및 견과류 관련 드레싱 항목이 있습니다. 견과류·해당 드레싱 제외 요청이 전제되어야 합니다.' },
    en: { name: 'Salady Poi Sageori', cat: 'Salads / wraps', tags: ['Nut toppings exist', 'Check dressings', 'Can remove toppings'], review: "Salady's official allergy guide includes nut topping options and nut-related dressings, so exclusions must be requested clearly." } },

  { searchQuery: '본죽 개포동역점 개포동', risk: 'info', cuisineType: '한식',
    ko: { name: '본죽 개포동역점', cat: '죽', tags: ['공식 알레르기표 제공', '메뉴별 확인 필수', '방문 전 확인 권장'], review: '본죽은 공식 알레르기표가 있어 비교적 확인이 쉬우나 일부 메뉴·부재료에 잣/호두/간접 땅콩 노출이 있어 메뉴 선별이 중요합니다.' },
    en: { name: 'Bonjuk Gaepo-dong Station', cat: 'Porridge', tags: ['Official allergen chart', 'Menu-by-menu check', 'Check before visit'], review: 'Bonjuk publishes allergen information, but some items and side ingredients still involve pine nut, walnut, or indirect peanut exposure.' } },

  { searchQuery: '정가네부엌 개포동', risk: 'info', cuisineType: '한식',
    ko: { name: '정가네부엌', cat: '집밥', tags: ['동네 한식', '반찬 확인 필요', '방문 전 확인 권장'], review: '집밥형 한식은 본 메뉴보다 밑반찬 변수가 크므로 참깨·견과류 무침류 포함 여부를 확인하는 것이 좋습니다.' },
    en: { name: 'Jeonggane Bueok', cat: 'Homestyle Korean', tags: ['Local Korean food', 'Check side dishes', 'Check before visit'], review: 'The main issue is variable side dishes, so sesame- or nut-based banchan should be checked.' } },

  { searchQuery: '산월숯불갈비 개포동', risk: 'caution', cuisineType: '한식',
    ko: { name: '산월숯불갈비', cat: '갈비/고기집', tags: ['양념 확인 필요', '소스 별도 요청', '메뉴별 확인 필수'], review: '고기집은 고기 자체보다 양념갈비·쌈장·샐러드 드레싱이 변수이므로 양념과 토핑 분리를 요청해야 합니다.' },
    en: { name: 'Sanwol Charcoal Galbi', cat: 'Galbi / Korean BBQ', tags: ['Check marinades', 'Ask sauces separately', 'Menu-by-menu check'], review: 'In Korean BBQ places, marinades and sauces matter more than the meat itself, so plain grilled options are safer.' } },

  { searchQuery: '주성밥상 포이점 개포동', risk: 'info', cuisineType: '한식',
    ko: { name: '주성밥상 포이점', cat: '백반/집밥', tags: ['동네 한식', '반찬 확인 필요', '방문 전 확인 권장'], review: '기본 식사류는 비교적 단순해 보이나 반찬 구성은 매일 달라질 수 있어 확인이 필요합니다.' },
    en: { name: 'Juseong Bapsang Poi', cat: 'Set meals / homestyle Korean', tags: ['Local Korean food', 'Check side dishes', 'Check before visit'], review: 'Main dishes look relatively simple, but side dishes may vary by day and should be checked.' } },

  { searchQuery: '연이칼국수 개포동', risk: 'info', cuisineType: '한식',
    ko: { name: '연이칼국수', cat: '칼국수', tags: ['기본 메뉴 단순', '고명 확인 필요', '방문 전 확인 권장'], review: '칼국수·국물 메뉴는 상대적으로 단순하지만 겉절이·양념장·고명 사용은 별도 확인이 좋습니다.' },
    en: { name: 'Yeoni Kalguksu', cat: 'Knife-cut noodles', tags: ['Simple core menu', 'Check toppings', 'Check before visit'], review: 'The noodle soups are relatively simple, but toppings and condiments should still be checked.' } },

  { searchQuery: '원조아구찜해물탕 개포동', risk: 'caution', cuisineType: '한식',
    ko: { name: '원조 아구찜 해물탕', cat: '아구찜/해물탕', tags: ['양념 확인 필요', '메뉴별 확인 필수', '방문 전 확인 권장'], review: '해물탕류는 견과류 가능성은 낮지만 아구찜 양념과 토핑은 매장 레시피 차이가 있어 확인이 필요합니다.' },
    en: { name: 'Wonjo Agujjim Haemultang', cat: 'Braised monkfish / seafood hotpot', tags: ['Check seasoning', 'Menu-by-menu check', 'Check before visit'], review: 'The main risk is variable seasoning on braised dishes rather than the seafood itself.' } },

  { searchQuery: '신의주찹쌀순대국 개포점 개포동', risk: 'info', cuisineType: '한식',
    ko: { name: '신의주찹쌀순대국 개포점', cat: '순대국', tags: ['국밥류', '기본 메뉴 단순', '방문 전 확인 권장'], review: '순대국 계열은 기본 국물은 단순한 편이지만 다대기·반찬·양념장 확인은 필요합니다.' },
    en: { name: 'Shinuiju Glutinous Sundaeguk Gaepo', cat: 'Korean blood-sausage soup', tags: ['Soup rice', 'Simple core menu', 'Check before visit'], review: 'The core soup is relatively simple, but chili paste, sauces, and side dishes should still be checked.' } },

  { searchQuery: '하영각 개포동', risk: 'caution', cuisineType: '중식',
    ko: { name: '하영각', cat: '중식', tags: ['소스 확인 필요', '메뉴별 확인 필수', '사전 고지 권장'], review: '개포동 오래된 식당/맛집 리스트에 포함됩니다. 중식은 전분소스·볶음·토핑 변수로 인해 견과류 사용 여부를 일반화하기 어렵습니다.' },
    en: { name: 'Hayeonggak', cat: 'Chinese cuisine', tags: ['Check sauces', 'Menu-by-menu check', 'Advance notice advised'], review: 'Appears in Gaepo local listings. For Chinese food, sauce and garnish variability makes direct confirmation important.' } },

  { searchQuery: '원조닭한마리 개포동', risk: 'info', cuisineType: '한식',
    ko: { name: '원조닭한마리', cat: '닭한마리', tags: ['기본 메뉴 단순', '소스 별도 확인', '방문 전 확인 권장'], review: '닭한마리 본체는 단순하지만 찍어먹는 양념장과 반찬 확인이 필요합니다.' },
    en: { name: 'Wonjo Dakhanmari', cat: 'Whole chicken hotpot', tags: ['Simple core menu', 'Check dipping sauce', 'Check before visit'], review: 'The hotpot itself is simple, but dipping sauces and side dishes should be checked.' } },

  { searchQuery: '레몬그라스타이 개포점 개포동', risk: 'danger', cuisineType: '기타',
    ko: { name: '레몬그라스타이 개포점', cat: '태국 음식', tags: ['땅콩 사용 가능성 높음', '메뉴별 확인 필수', '경고용'], review: '태국 음식은 팟타이·샐러드·커리 등에서 땅콩/견과류 사용 빈도가 높아 중증 땅콩 알레르기에는 보수적으로 위험군으로 보는 편이 안전합니다.' },
    en: { name: 'Lemongrass Thai Gaepo', cat: 'Thai cuisine', tags: ['High peanut-use risk', 'Menu-by-menu check', 'Warning'], review: 'Thai cuisine commonly uses peanuts in pad thai, salads, and curries — a conservative danger classification for severe peanut allergy.' } },

  { searchQuery: '빨간오뎅부산어묵 개포동', risk: 'info', cuisineType: '기타',
    ko: { name: '빨간오뎅 부산어묵', cat: '분식/어묵', tags: ['기본 메뉴 단순', '양념 확인 필요', '방문 전 확인 권장'], review: '어묵·분식류는 견과류 직접 사용 가능성은 낮아 보이지만 소스와 튀김유 관련 확인은 필요합니다.' },
    en: { name: 'Red Odeng Busan Eomuk', cat: 'Korean street food / fish cake', tags: ['Simple core menu', 'Check sauces', 'Check before visit'], review: 'Direct nut use seems less likely, but sauces and shared frying environments should still be checked.' } },

  { searchQuery: '37.5시그니처 개포점 개포동', risk: 'caution', cuisineType: '양식',
    ko: { name: '37.5 시그니처 개포점', cat: '브런치', tags: ['팬케이크/디저트 주의', '메뉴별 확인 필수', '견과류 일부 메뉴 포함 가능'], review: '브런치 카페는 팬케이크·샐러드·디저트류에서 견과류 토핑 가능성이 있어 메뉴별 확인이 필요합니다.' },
    en: { name: '37.5 Signature Gaepo', cat: 'Brunch', tags: ['Watch pancakes/desserts', 'Menu-by-menu check', 'Some nut-containing items possible'], review: 'Brunch menus often involve nut toppings in pancakes, salads, or desserts, so each item needs checking.' } },

  // ── 압구정/도산 ──
  { searchQuery: '도산공원 가드너아드리아 압구정', risk: 'info', cuisineType: '양식',
    ko: { name: '가드너 아드리아', cat: '이탈리안', tags: ['알레르기 맞춤 조리', '전 성분 기재', '방문 전 확인 권장'], review: '해산물 중심 이탈리안. 페스토류의 잣·견과류 함유 여부를 직원이 명확히 인지하고 안내.' },
    en: { name: 'Gardner Adria', cat: 'Italian', tags: ['Customized cooking', 'Full ingredient list', 'Check before visit'], review: 'Seafood-focused Italian; staff are well-informed about pine nuts or walnuts in pesto sauces.' } },

  { searchQuery: '까반에피에트 압구정', risk: 'danger', cuisineType: '중식',
    ko: { name: '무탄 (MUTAN)', cat: '퓨전 중식', tags: ['땅콩 기름 사용', '견과류 다량 사용', '교차 오염 위험'], review: '시그니처 메뉴(유린기 등)에 견과류 가루 사용 및 땅콩 기름 조리 가능성 매우 높음. 회피 권장.' },
    en: { name: 'Mutan', cat: 'Fusion Chinese', tags: ['Uses peanut oil', 'Heavy use of nuts', 'Cross-contamination risk'], review: 'High risk — signature dishes feature nut toppings or are cooked in peanut oil.' } },

  // ── 연남/홍대 ──
  { searchQuery: '소이연남 한남', risk: 'danger', cuisineType: '기타',
    ko: { name: '소이연남', cat: '태국 음식', tags: ['테이블마다 땅콩 가루 비치', '교차 오염 위험 극심', '전 메뉴 위험'], review: '테이블마다 땅콩 가루가 기본 비치되고 솜탐·국수에 다량 사용. 공기 중 노출 위험 극심.' },
    en: { name: 'Soi Yeonnam', cat: 'Thai Food', tags: ['Peanut powder at every table', 'Extreme cross-contamination risk', 'All menus dangerous'], review: 'Peanut powder is a table staple and used heavily in most dishes. Extreme airborne exposure risk.' } },

  { searchQuery: '버거스 올마이티 홍대', risk: 'caution', cuisineType: '양식',
    ko: { name: '버거스올마이티', cat: '수제버거', tags: ['번 성분 확인 필요', '땅콩류 없음', '메뉴별 확인 필수'], review: '패티는 안전하나 브리오슈 번과 쉐이크에 견과류 포함 가능성 있어 주문 시 재확인 필요.' },
    en: { name: 'Burgers Almighty', cat: 'Handmade Burger', tags: ['Check bun ingredients', 'No peanuts', 'Must check per menu'], review: 'Patties are safe, but verify brioche bun and shake ingredients for potential nut traces.' } },

  { searchQuery: '툭툭누들타이 연남', risk: 'danger', cuisineType: '기타',
    ko: { name: '툭툭누들타이', cat: '태국 음식', tags: ['땅콩류 다량 사용', '교차 오염 위험', '회피 권장'], review: '볶음면·커리에 땅콩 성분 필수 사용. 동남아 식당 특성상 교차 오염 위험 높아 방문 자체 회피 권장.' },
    en: { name: 'Tuk Tuk Noodle Thai', cat: 'Thai Food', tags: ['Heavy use of nuts', 'Cross-contamination risk', 'Best to avoid'], review: 'Peanuts are essential in stir-fried noodles and curries. Best to avoid entirely.' } },

  { searchQuery: '연남동 갓잇 연남', risk: 'caution', cuisineType: '기타',
    ko: { name: '갓잇 (GOD EAT)', cat: '멕시칸', tags: ['소스 제외 요청 필요', '메뉴별 확인 필수', '견과류 일부 메뉴 포함'], review: '타코·파히타 자체는 안전하나 몰레 소스 등에 견과류 포함 가능. 기본 살사·사워크림 위주 선택 권장.' },
    en: { name: 'God Eat', cat: 'Mexican', tags: ['Request sauce exclusion', 'Must check per menu', 'Nuts in some dishes'], review: 'Tacos are generally safe, but mole sauce may contain nuts — stick to basic salsa or sour cream.' } },

  { searchQuery: '오이지 연남', risk: 'caution', cuisineType: '한식',
    ko: { name: '오이지', cat: '퓨전 한식', tags: ['연남동 핫플레이스', '외국인 SNS 인기', '전통주 바'], review: '최근 SNS를 통해 외국인들에게도 매우 유명해진 퓨전 한식당입니다. 퓨전 요리 특성상 고명으로 견과류가 올라갈 수 있으므로 주문 전 필히 확인이 필요합니다.' },
    en: { name: 'Oiji Yeonnam', cat: 'Fusion Korean', tags: ['Yeonnam hotspot', 'SNS famous', 'Traditional liquor bar'], review: 'Very popular among international tourists via social media. Being fusion, they might use nuts as garnish, so always confirm before ordering.' } },

  // ── 이태원/용산 ──
  { searchQuery: '할랄가이즈 이태원', risk: 'info', cuisineType: '기타',
    ko: { name: '할랄가이즈', cat: '중동 음식', tags: ['알레르기 정보 상세 제공', '소스 주의', '디저트 주의'], review: '글로벌 체인으로 성분 표기 있으나 화이트 소스·바클라바 등 디저트에 견과류 포함. 개별 확인 필수.' },
    en: { name: 'The Halal Guys', cat: 'Middle Eastern', tags: ['Detailed allergy info', 'Watch out for sauces', 'Check desserts'], review: 'Standardized ingredient info available, but watch for nuts in white sauce and desserts like baklava.' } },

  { searchQuery: '피자무쪼 이태원', risk: 'safe', cuisineType: '양식',
    ko: { name: '피자무쪼', cat: '나폴리 피자', tags: ['땅콩류 없음', '바질 페스토 잣 확인 필요', '방문 전 확인 권장'], review: '정통 화덕 피자는 밀가루·치즈·토마토 중심으로 안전. 바질 페스토(잣 포함) 토핑 여부만 확인.' },
    en: { name: 'Pizza Muzzo', cat: 'Neapolitan Pizza', tags: ['No peanuts', 'Check pine nuts in pesto', 'Check before visit'], review: 'Authentic wood-fired pizzas are safe. Only check for pine nuts if ordering basil pesto toppings.' } },

  { searchQuery: '잭슨피자 한남', risk: 'caution', cuisineType: '양식',
    ko: { name: '잭슨피자', cat: '미국식 피자', tags: ['메뉴별 확인 필수', '소스 제외 요청 필요', '땅콩류 없음'], review: '피자 도우·고기 토핑은 안전. 사이드 메뉴와 딥핑 소스 성분 반드시 확인 필요.' },
    en: { name: 'Jackson Pizza', cat: 'American Pizza', tags: ['Must check per menu', 'Request sauce exclusion', 'No peanuts'], review: 'Dough and meat toppings are safe. Must verify side dishes and dipping sauce ingredients.' } },


  { searchQuery: '몽탄 이태원', risk: 'safe', cuisineType: '한식',
    lat: 37.5415, lng: 126.9718,
    address: '서울 용산구 백범로99길 50',
    ko: { name: '몽탄', cat: '숯불 고기', tags: ['땅콩류 없음', '소스 개별 확인 필요', '반찬 확인 권장'], review: '숯불 고기 중심으로 땅콩 사용 거의 없음. 소스·반찬은 개별 확인 필요.' },
    en: { name: 'Mongtan', cat: 'Korean Charcoal BBQ', tags: ['No peanuts', 'Check sauces individually', 'Verify side dishes'], review: 'Charcoal-grilled meat focus with minimal nut use. Verify sauces and side dishes individually.' } },

  { searchQuery: '플랜트 이태원', risk: 'caution', cuisineType: '샐러드/비건',
    lat: 37.5345, lng: 126.9948,
    address: '서울 용산구 보광로 117',
    ko: { name: '플랜트 이태원', cat: '비건 레스토랑', tags: ['비건', '이태원', '알레르기 친화적', '견과류 일부 메뉴 포함', '제외 요청 가능'], review: '비건 레스토랑으로 알레르기 친화적이나 견과류 포함 메뉴 일부 존재. 주문 시 제외 요청 가능.' },
    en: { name: 'Plant Itaewon', cat: 'Vegan Restaurant', tags: ['Vegan', 'Itaewon', 'Allergy-friendly', 'Nuts in some dishes', 'Can exclude'], review: 'Allergy-friendly vegan restaurant. Some items contain nuts but exclusion is possible on request.' } },

  { searchQuery: '오리지널팬케이크하우스 이태원', risk: 'info', cuisineType: '양식',
    ko: { name: '오리지널팬케이크하우스', cat: '브런치', tags: ['글로벌 체인', '매뉴얼화된 서비스', '성분 확인 용이'], review: '미국 본사의 레시피를 따르는 체인점으로 성분 관리가 매뉴얼화되어 있습니다. 땅콩이 들어간 특정 팬케이크만 피하면 교차 오염 관리가 비교적 잘 되는 편입니다.' },
    en: { name: 'The Original Pancake House', cat: 'Brunch', tags: ['Global chain', 'Standardized service', 'Easy ingredient check'], review: 'Follows standardized US recipes. Avoid specific nutty pancakes and cross-contamination is managed better than at independent shops.' } },

  { searchQuery: '공기 한남', risk: 'caution', cuisineType: '한식',
    ko: { name: '공기 (Gongi)', cat: '모던 한식', tags: ['미쉐린 가이드', '깔끔한 조리 환경', '고급 한식'], review: '외국인 비즈니스 미팅이나 관광객들이 많이 찾는 고급 한식당입니다. 일반 식당보다 성분 고지에 민감하며 예약 시 미리 알레르기를 고지하면 안전한 식사가 가능합니다.' },
    en: { name: 'Gongi', cat: 'Modern Korean', tags: ['Michelin Guide', 'Clean kitchen', 'Fine Korean dining'], review: 'Upscale Korean dining popular with international foodies. More attentive to dietary restrictions; notify them during reservation for a safe experience.' } },

  { searchQuery: '다운타우너 한남', risk: 'caution', cuisineType: '양식',
    lat: 37.5348, lng: 126.9942,
    address: '서울 용산구 이태원로42길 28',
    ko: { name: '다운타우너 한남점', cat: '수제버거', tags: ['기본 버거 견과류 없음', '소스 확인 필요', '사이드 확인 필요'], review: '기본 패티·번에는 견과류 없음. 소스 및 사이드 메뉴는 개별 확인 필요.' },
    en: { name: 'Downtowner Hannam', cat: 'Burger', tags: ['Basic burger nut-free', 'Check sauces', 'Verify sides'], review: 'Basic patty and bun are nut-free. Sauces and side dishes need individual verification.' } },

  // ── 중구/약수 ──
  { searchQuery: '금돼지식당 약수', risk: 'safe', cuisineType: '한식',
    lat: 37.5561, lng: 127.0116,
    address: '서울 중구 다산로 149',
    ko: { name: '금돼지식당', cat: '삼겹살', tags: ['땅콩류 없음', '기본 반찬 확인 권장'], review: '삼겹살 전문점으로 견과류 사용 없음. 기본 반찬류는 확인 권장.' },
    en: { name: 'Geumdwaeji Sikdang', cat: 'Korean Pork BBQ', tags: ['No peanuts', 'Check basic side dishes'], review: 'Pork BBQ specialist with no nut use. Verify standard side dishes to be safe.' } },

  // ── 마포/홍대/합정 ──
  { searchQuery: '프릳츠 커피 도화점 마포', risk: 'caution', cuisineType: '카페',
    lat: 37.5413, lng: 126.9424,
    address: '서울 마포구 새창로2길 17',
    ko: { name: '프릳츠 커피 도화점', cat: '카페/베이커리', tags: ['음료 중심 안전', '베이커리 견과류 가능성', '마포'], review: '음료 위주 이용 시 안전. 베이커리는 견과류 포함 가능성 있어 개별 확인 필요.' },
    en: { name: 'Fritz Coffee Company Dohwa', cat: 'Cafe / Bakery', tags: ['Drinks safe', 'Bakery may contain nuts', 'Mapo'], review: 'Safe for drinks. Bakery items may contain nuts — verify individually before ordering.' } },

  { searchQuery: '땡스네이처카페 홍대', risk: 'caution', cuisineType: '카페',
    lat: 37.5536, lng: 126.9236,
    address: '서울 마포구 홍익로 10',
    ko: { name: '땡스네이처카페', cat: '카페/디저트', tags: ['음료 위주 권장', '디저트 견과류 가능성', '홍대'], review: '음료 위주 이용 권장. 일부 디저트에 견과류 포함 가능성 있음.' },
    en: { name: 'Thanks Nature Cafe', cat: 'Cafe', tags: ['Drinks recommended', 'Desserts may contain nuts', 'Hongdae'], review: 'Stick to drinks for safety. Some dessert items may contain nuts.' } },

  { searchQuery: '샐러디 홍대점', risk: 'safe', cuisineType: '샐러드/비건',
    lat: 37.5563, lng: 126.9237,
    address: '서울 마포구 양화로 161',
    ko: { name: '샐러디 홍대점', cat: '샐러드', tags: ['토핑 선택형', '견과류 제외 가능', '홍대'], review: '토핑 직접 선택. 견과류 토핑 제외 요청 가능. 드레싱 성분 확인 권장.' },
    en: { name: 'Salady Hongdae', cat: 'Salad', tags: ['Customizable toppings', 'Nuts can be excluded', 'Hongdae'], review: 'Choose your own toppings — simply skip nuts. Verify dressing ingredients.' } },

  { searchQuery: '어반플랜트 합정', risk: 'caution', cuisineType: '샐러드/비건',
    lat: 37.5492, lng: 126.9135,
    address: '서울 마포구 양화로6길 28',
    ko: { name: '어반플랜트 합정', cat: '비건 카페', tags: ['비건', '합정', '일부 견과류 사용 가능', '확인 요청 필요'], review: '비건 카페이나 일부 메뉴에 견과류 사용 가능. 주문 시 반드시 확인 요청 필요.' },
    en: { name: 'Urban Plant Hapjeong', cat: 'Vegan Cafe', tags: ['Vegan', 'Hapjeong', 'Some nut use possible', 'Must verify'], review: 'Vegan cafe but some items may use nuts — always ask before ordering.' } },

  { searchQuery: '구스토타코 홍대', risk: 'safe', cuisineType: '멕시칸',
    ko: { name: '구스토타코', cat: '멕시칸', tags: ['트립어드바이저 1위', '땅콩 거의 안 씀', '직접 만드는 또띠아'], review: '수년간 서울 내 외국인 선호 식당 상위권을 지킨 곳입니다. 멕시칸 요리 특성상 땅콩 사용이 거의 없으며, 외국인 고객의 알레르기 요구에 매우 익숙합니다.' },
    en: { name: 'Gusto Taco', cat: 'Mexican', tags: ['#1 on TripAdvisor', 'Peanut-free environment', 'Handmade tortillas'], review: 'Long-time favorite for foreigners. Mexican cuisine naturally avoids peanuts, and the owners are highly experienced with allergy inquiries from international guests.' } },

  { searchQuery: '트래블메이커 홍대', risk: 'caution', cuisineType: '양식',
    ko: { name: '트래블메이커', cat: '미국식 조식', tags: ['미국 정통 스타일', '영어 메뉴판', '브런치 중심'], review: '미국 다이너 스타일로 외국인들이 아침 식사를 위해 줄 서는 곳입니다. 팬케이크와 계란 요리 위주라 땅콩 위험은 낮지만 소스류나 시럽 성분 확인은 필요합니다.' },
    en: { name: 'Travel Maker', cat: 'American Breakfast', tags: ['Authentic US style', 'English menu', 'Brunch focused'], review: 'A classic American diner vibe where expats flock for breakfast. Low risk with pancakes/eggs, but always double-check syrups or shared griddle surfaces.' } },

  // ── 성수/성동 ──
  { searchQuery: '퍼셉션 성수', risk: 'caution', cuisineType: '카페',
    lat: 37.5446, lng: 127.0557,
    address: '서울 성동구 연무장길 33',
    ko: { name: '퍼셉션', cat: '카페', tags: ['커피 위주 안전', '디저트 개별 확인 필요', '성수'], review: '커피 위주 이용 시 안전. 디저트는 개별 성분 확인 필요.' },
    en: { name: 'Perception', cat: 'Cafe', tags: ['Coffee is safe', 'Check desserts individually', 'Seongsu'], review: 'Safe for coffee orders. Dessert items need individual ingredient verification.' } },

  { searchQuery: '그린랩 성수', risk: 'safe', cuisineType: '샐러드/비건',
    lat: 37.5452, lng: 127.0571,
    address: '서울 성동구 성수이로 97',
    ko: { name: '그린랩', cat: '샐러드/볼', tags: ['견과류 토핑 제거 가능', '건강식', '성수'], review: '샐러드·볼 중심 건강식. 견과류 토핑 제거 가능하여 알레르기 대응 용이.' },
    en: { name: 'Green Lab', cat: 'Salad / Healthy Bowl', tags: ['Nut toppings removable', 'Healthy food', 'Seongsu'], review: 'Salad and bowl focus. Nut toppings can be removed — easy allergy accommodation.' } },

  { searchQuery: '어나더사이드 성수', risk: 'caution', cuisineType: '카페',
    lat: 37.5449, lng: 127.0563,
    address: '서울 성동구 성수이로 82',
    ko: { name: '어나더사이드 성수점', cat: '카페', tags: ['커피 위주 안전', '디저트 확인 필요', '성수'], review: '커피 위주 이용 시 안전. 디저트는 성분 확인 필요. (강서점과 다른 지점)' },
    en: { name: 'Another Side Seongsu', cat: 'Cafe', tags: ['Coffee is safe', 'Check desserts', 'Seongsu'], review: 'Safe for coffee. Verify dessert items. (Different branch from Gangseo location)' } },

  { searchQuery: '미락식당 성수', risk: 'safe', cuisineType: '한식',
    lat: 37.5440, lng: 127.0550,
    address: '서울 성동구 아차산로 33',
    ko: { name: '미락식당', cat: '한식 백반', tags: ['땅콩류 없음', '가정식', '성수'], review: '한식 백반 스타일로 견과류 사용 거의 없음. 가정식 위주로 안심하고 이용 가능.' },
    en: { name: 'Mirak Sikdang', cat: 'Korean Home-style', tags: ['No peanuts', 'Home-style', 'Seongsu'], review: 'Home-style Korean meal with minimal nut use. Generally safe for allergy families.' } },

  // ── 강남/압구정 ──
  { searchQuery: '브런치빈 강남', risk: 'caution', cuisineType: '양식',
    lat: 37.4988, lng: 127.0275,
    address: '서울 강남구 강남대로 390',
    ko: { name: '브런치빈 강남', cat: '브런치', tags: ['브런치 중심', '견과류 일부 메뉴 포함', '메뉴 선택 필요'], review: '브런치 메뉴 중심. 일부 견과류 포함 메뉴 있어 주문 시 확인 필요.' },
    en: { name: 'Brunch Bean Gangnam', cat: 'Brunch', tags: ['Brunch focused', 'Nuts in some dishes', 'Choose carefully'], review: 'Brunch-focused menu. Some items contain nuts — check before ordering.' } },

  { searchQuery: '마마스 압구정', risk: 'caution', cuisineType: '양식',
    lat: 37.5266, lng: 127.0284,
    address: '서울 강남구 압구정로 165',
    ko: { name: '마마스 압구정', cat: '브런치/카페', tags: ['샌드위치·샐러드 중심', '견과류 일부 메뉴 존재', '압구정'], review: '샌드위치·샐러드 중심이나 일부 견과류 메뉴 존재. 주문 시 확인 필요.' },
    en: { name: 'Cafe Mamas Apgujeong', cat: 'Brunch / Cafe', tags: ['Sandwich & salad focus', 'Some nut items', 'Apgujeong'], review: 'Sandwich and salad focus but some nut-containing items exist. Verify before ordering.' } },

  { searchQuery: '테라로사 강남', risk: 'caution', cuisineType: '카페',
    lat: 37.5005, lng: 127.0260,
    address: '서울 강남구 테헤란로 152',
    ko: { name: '테라로사 강남점', cat: '카페', tags: ['커피 중심 안전', '베이커리 주의', '강남'], review: '커피 중심 이용 시 안전. 베이커리는 견과류 포함 가능성 있어 확인 필요.' },
    en: { name: 'Terarosa Coffee Gangnam', cat: 'Cafe', tags: ['Coffee is safe', 'Bakery caution', 'Gangnam'], review: 'Safe for coffee. Bakery items may contain nuts — verify before purchasing.' } },

  // ── 종로/강서 (GPT Spokin 후기 기반) ──
  { searchQuery: '이도림 카페 종로', risk: 'info', cuisineType: '카페',
    lat: 37.5799476, lng: 126.9710654,
    address: '서울 종로구 자하문로 43',
    ko: { name: '이도림', cat: '카페/비건 베이커리', tags: ['비건 옵션 명확 표기', '성분 확인 가능', '경복궁 근처', '알레르기 주의'], review: '다양한 알레르기 사용자 방문 후기 다수. 비건 옵션이 명확히 표시되어 성분 확인 후 이용 가능.' },
    en: { name: 'LEEDORIM', cat: 'Cafe / Vegan Bakery', tags: ['Vegan options labeled', 'Ingredient check available', 'Near Gyeongbokgung', 'Allergy-cautious'], review: 'Multiple allergy users have visited. Vegan options clearly labeled — verify individual items before ordering.' } },

  { searchQuery: '카페 어니언 안국', risk: 'caution', cuisineType: '카페',
    lat: 37.5776235, lng: 126.9865541,
    address: '서울 종로구 계동길 5',
    ko: { name: '카페 어니언 안국', cat: '카페/베이커리', tags: ['음료 위주 안전', '베이커리 견과류 주의', '성분 재확인 필요'], review: '다중 알레르기 사용자가 음료 위주로 무난한 경험. 베이커리에 견과류/호두 제품 있으므로 음료 중심 방문 권장.' },
    en: { name: 'Cafe Onion Anguk', cat: 'Cafe / Bakery', tags: ['Drinks relatively safe', 'Bakery may contain nuts', 'Must re-verify ingredients'], review: 'Multi-allergy users reported safe drink experiences. Bakery items may contain walnuts/nuts — stick to drinks or verify individually.' } },

  { searchQuery: '어나더사이드 강서', risk: 'caution', cuisineType: '카페',
    lat: 37.5541278, lng: 126.837073,
    address: '서울 강서구 강서로 318',
    ko: { name: '어나더사이드', cat: '카페/음료', tags: ['음료 중심 안전', '과일 에이드 추천', '땅콩·견과류 알레르기 후기 있음'], review: '땅콩·견과류 포함 다중 알레르기 사용자가 블랙베리 에이드를 긍정적으로 경험. 디저트보다 음료 중심 방문 추천.' },
    en: { name: 'Another Side', cat: 'Cafe / Beverage', tags: ['Drink-focused safe visit', 'Fruit ades recommended', 'Peanut/tree nut allergy reviews exist'], review: 'Multi-allergy user (peanut + tree nut) had positive blackberry ade experience. Approach drink-first for safest visit.' } },

  { searchQuery: '벽제갈비 더청담', risk: 'safe', cuisineType: '한식',
    lat: 37.5259741, lng: 127.047065,
    address: '서울 강남구 도산대로81길 25',
    ko: { name: '벽제갈비 더청담', cat: '한식/소고기 구이', tags: ['비양념 한우 안전', '조리사 확인 가능', '너트프리 사이드 요청 가능'], review: '땅콩·견과류 알레르기 사용자가 조리사 확인 후 너트프리 사이드와 비양념 한우를 안전하게 이용. 양념육은 피할 것.' },
    en: { name: 'Byeokje Galbi Cheongdam', cat: 'Korean BBQ', tags: ['Unseasoned beef is safe', 'Cook verification available', 'Nut-free sides on request'], review: 'Peanut/tree nut allergy user confirmed safe experience with unseasoned beef after kitchen check. Avoid marinated meats.' } },

  // ── 코엑스/삼성/한남/명동 ──
  { searchQuery: '플랜튜드 코엑스', risk: 'safe',
    lat: 37.5119, lng: 127.0589,
    address: '서울 강남구 영동대로 513 코엑스 지하 1층',
    cuisineType: '샐러드/비건',
    ko: { name: '플랜튜드 코엑스점', cat: '비건 레스토랑', tags: ['풀무원 운영', '전 성분 번호 표기', '교차오염 방지', '직원 주문 시 재확인'], review: '풀무원 운영으로 전 메뉴 알레르기 유발 물질이 번호로 상세 표기. 직원이 주문 시 재확인하는 시스템.' },
    en: { name: 'Plantude Coex', cat: 'Vegan Restaurant', tags: ['Pulmuone operated', 'Full allergen numbering', 'Cross-contamination prevention', 'Staff re-confirms order'], review: 'Pulmuone-operated. All menus have numbered allergen labeling. Staff re-confirms allergies at order.' } },

  { searchQuery: '허머스키친 파르나스몰', risk: 'caution',
    lat: 37.5091, lng: 127.0608,
    address: '서울 강남구 테헤란로 521 파르나스몰 지하 1층',
    cuisineType: '기타',
    ko: { name: '허머스키친 파르나스몰점', cat: '중동 음식', tags: ['참깨(타히니) 주 사용', '주방 직접 확인 가능', '견과류 교차 확인 필요'], review: '땅콩보다 참깨(타히니) 위주 사용. 견과류 포함 여부 문의 시 주방 직접 확인해주는 신뢰도 높은 대응.' },
    en: { name: 'Hummus Kitchen Parnas Mall', cat: 'Middle Eastern', tags: ['Tahini (sesame) based', 'Kitchen directly verifies', 'Cross-check nuts'], review: 'Tahini (sesame) is the main ingredient, not peanut. Staff directly checks kitchen on request.' } },

  { searchQuery: '몽크스부처 한남', risk: 'safe',
    lat: 37.5365, lng: 127.0003,
    address: '서울 용산구 이태원로 228-1',
    cuisineType: '기타',
    ko: { name: '몽크스부처', cat: '비건 파인다이닝', tags: ['예약 시 알레르기 사전 전달', '전용 코스 구성 가능', '너트프리 옵션', '상세 메뉴 안내'], review: '예약 시 알레르기 미리 전달하면 해당 성분 완전 배제한 맞춤 코스·메뉴 추천 가능.' },
    en: { name: "Monk's Butcher", cat: 'Vegan Fine Dining', tags: ['Pre-notify allergy at reservation', 'Custom allergy course available', 'Nut-free options', 'Detailed menu guidance'], review: 'Notify allergy at reservation → custom course fully excluding the ingredient.' } },

  { searchQuery: '왕비집 을지로', risk: 'safe',
    lat: 37.5647, lng: 126.9838,
    address: '서울 중구 명동7길 21 지하 1층',
    cuisineType: '한식',
    ko: { name: '왕비집 을지로점', cat: '한식/고기', tags: ['외국인 알레르기 대응 숙련', '생고기 위주 안전', '소스 성분 직원 인지'], review: '외국인 손님 많아 알레르기 문의에 익숙. 양념 없는 생고기 메뉴 위주 선택 시 안전.' },
    en: { name: 'Wangbijib Euljiro', cat: 'Korean BBQ', tags: ['Experienced with foreign allergy requests', 'Unmarinated meat is safe', 'Staff knows sauce ingredients'], review: 'Experienced with allergy inquiries. Unmarinated raw meat options are safe — staff clearly knows sauce contents.' } },
];

// ── Kakao 장소 검색 ──────────────────────────────────────────
function kakaoSearch(query) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(query);
    const options = {
      hostname: 'dapi.kakao.com',
      path: `/v2/local/search/keyword.json?query=${q}&size=1`,
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    };
    const req = https.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const doc = data.documents?.[0];
          if (doc) {
            resolve({ lat: parseFloat(doc.y), lng: parseFloat(doc.x), address: doc.road_address_name || doc.address_name });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Firebase 중복 확인 ────────────────────────────────────────
async function alreadyExists(name) {
  const q = query(collection(db, 'reviews'), where('ko.name', '==', name));
  const snap = await getDocs(q);
  return !snap.empty;
}


// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  console.log(`\n🥜 땅콩프리 식당 시딩 시작 (총 ${RESTAURANTS.length}개)\n`);
  let added = 0, skipped = 0, failed = 0;

  for (const r of RESTAURANTS) {
    // 중복 체크
    const exists = await alreadyExists(r.ko.name);
    if (exists) {
      console.log(`  ⏭  중복 건너뜀: ${r.ko.name}`);
      skipped++;
      continue;
    }

    // 좌표가 이미 있으면 카카오 API 생략, 없으면 검색
    let loc = null;
    if (r.lat && r.lng) {
      loc = { lat: r.lat, lng: r.lng, address: r.address || '' };
    } else {
      await sleep(200); // API rate limit
      loc = await kakaoSearch(r.searchQuery);
    }

    const doc = {
      risk: r.risk,
      address: loc?.address || '',
      lat: loc?.lat || null,
      lng: loc?.lng || null,
      rating: null,
      author: '관리자',
      src: 'admin',
      cuisineType: r.cuisineType || '기타',
      peanut_usage: r.peanut_usage || 'unknown',         // yes / no / unknown
      cross_contamination: r.cross_contamination || 'medium', // high / medium / low
      customization_possible: r.customization_possible ?? true, // true / false
      ko: r.ko,
      en: r.en,
      status: 'published',
    };

    try {
      await addDoc(collection(db, 'reviews'), doc);
      const locStr = loc ? `📍 ${loc.address.substring(0, 20)}` : '📍 좌표 없음';
      console.log(`  ✅ ${r.ko.name} [${r.risk}] ${locStr}`);
      added++;
    } catch (e) {
      console.log(`  ❌ 실패: ${r.ko.name} — ${e.message}`);
      failed++;
    }
  }

  console.log(`\n완료: 추가 ${added}개 / 중복 ${skipped}개 / 실패 ${failed}개\n`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

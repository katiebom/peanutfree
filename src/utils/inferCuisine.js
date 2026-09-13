// src/utils/inferCuisine.js
// 식당 음식 종류(cuisineType) 고정 목록 + 자유 텍스트(ko.cat / 이름)에서 추론하는 헬퍼.
// cuisineType 은 필터 칩·이모지·관리자 선택기에 쓰이는 고정 값이고, ko.cat 은 자유 텍스트 세부 분류다.
// ⚠️ 목록을 바꾸면 firestore.rules 의 reviews cuisineType 목록도 같이 바꿀 것.

export const CUISINE_FALLBACK = '기타';

export const CUISINE_TYPES = [
  '한식', '중식', '일식', '양식', '이탈리안', '피자', '버거', '샌드위치', '치킨',
  '멕시칸', '동남아시아', '인도', '중동', '파인다이닝', '샐러드/비건', '카페/베이커리',
  '주점', CUISINE_FALLBACK,
];

export const CUISINE_EMOJI = {
  한식: '🍚', 중식: '🥢', 일식: '🍣', 양식: '🥩', 이탈리안: '🍝',
  피자: '🍕', 버거: '🍔', 샌드위치: '🥪', 치킨: '🍗',
  멕시칸: '🌮', 동남아시아: '🍜', 인도: '🍛', 중동: '🧆',
  파인다이닝: '🥂', '샐러드/비건': '🥗', '카페/베이커리': '☕', 주점: '🍶',
  기타: '🍽️',
};

// 순서가 우선순위다 (위에서 먼저 맞는 규칙 채택).
const RULES = [
  [/피자|pizza/i, '피자'],
  [/버거|burger|햄버거|패스트푸드|쉐이크쉑/i, '버거'],
  [/샌드위치|서브웨이|subway/i, '샌드위치'],
  [/치킨/i, '치킨'],
  [/주점|술집|포차|이자카야/i, '주점'],
  [/비건|샐러드/i, '샐러드/비건'],
  [/파인다이닝/i, '파인다이닝'],
  [/카페|베이커리|\bcafe\b|\bbakery\b/i, '카페/베이커리'],
  [/일식|스시|초밥|라멘|돈까스/i, '일식'],
  [/중식|마라/i, '중식'],
  [/태국|베트남|동남아|쌀국수/i, '동남아시아'],
  [/멕시칸|타코/i, '멕시칸'],
  [/이탈리안|파스타/i, '이탈리안'],
  [/한식|국밥|백반|솥밥|분식|갈비|칼국수/i, '한식'],
  [/양식|스테이크|브런치/i, '양식'],
];

function matchText(text) {
  if (!text) return null;
  for (const [re, type] of RULES) {
    if (re.test(text)) return type;
  }
  return null;
}

/**
 * cuisineType 추론. ko.cat → 이름 → 추가 힌트(예: Google Places types) 순으로 보고,
 * 아무것도 안 맞으면 '기타'.
 * @param {{ cat?: string, name?: string, hints?: string[] }} input
 */
export function inferCuisine({ cat, name, hints } = {}) {
  return matchText(cat)
    || matchText(name)
    || matchText(Array.isArray(hints) ? hints.join(' ') : '')
    || CUISINE_FALLBACK;
}

/** 리뷰(식당) 문서에서 추론 */
export function inferCuisineForReview(item) {
  return inferCuisine({ cat: item?.ko?.cat, name: item?.ko?.name || item?.name });
}

export function isValidCuisine(value) {
  return CUISINE_TYPES.includes(value);
}

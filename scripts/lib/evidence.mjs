// 등급별 근거 요건 검증 — docs/ops/tier-definitions.md 와 동기화할 것. 반영 스크립트들이 공유한다.
// firestore.rules isValidCuisine / src/utils/inferCuisine.js CUISINE_TYPES 와도 동기화
export const CUISINES = ['한식', '중식', '일식', '양식', '이탈리안', '피자', '버거', '샌드위치', '치킨', '멕시칸', '동남아시아', '인도',
  '중동', '파인다이닝', '샐러드/비건', '카페/베이커리', '주점', '기타'];
export const TIERS = ['low', 'transparent', 'medium', 'high', 'unknown'];
export const SOURCE_KINDS = ['official', 'staff', 'media', 'community'];
export const CONF = ['high', 'medium', 'low'];
export const TIER_TO_RISK = { low: 'safe', transparent: 'info', medium: 'caution', high: 'danger', unknown: 'unknown' };

/** 항목 하나를 검증해 오류 문자열 배열을 돌려준다 (빈 배열이면 통과) */
export function validateItem(r, { allowUnknown = true } = {}) {
  const errs = [];
  const bad = m => errs.push(m);
  if (!r.name || r.name.length > 200) bad('name 누락/200자 초과');
  if (!CUISINES.includes(r.cuisineType)) bad(`cuisineType 허용 목록 밖: ${r.cuisineType}`);
  if (!TIERS.includes(r.peanutRiskTier)) bad(`peanutRiskTier 값 오류: ${r.peanutRiskTier}`);
  if (!CONF.includes(r.confidence)) bad(`confidence 값 오류: ${r.confidence}`);
  if (!allowUnknown && r.peanutRiskTier === 'unknown') bad('unknown 은 반영 대상이 아님 (근거를 찾지 못한 항목)');
  if (r.peanutRiskTier !== 'unknown') {
    if (!/^https?:\/\//.test(r.sourceUrl || '')) bad('sourceUrl(근거 URL) 필수');
    if (!r.sourceQuote || r.sourceQuote.length < 5) bad('sourceQuote(원문 인용) 필수');
    if (!SOURCE_KINDS.includes(r.sourceKind)) bad(`sourceKind 값 오류: ${r.sourceKind}`);
  }
  if (r.peanutRiskTier === 'low' && !(r.confidence === 'high' && r.sourceKind === 'official'))
    bad('low(미사용 확인) 는 sourceKind=official 이고 confidence=high 일 때만 허용');
  if (r.peanutRiskTier === 'transparent' && !(['official', 'staff'].includes(r.sourceKind) && ['high', 'medium'].includes(r.confidence)))
    bad('transparent(성분 투명) 는 sourceKind=official|staff 이고 confidence=medium 이상일 때만 허용');
  if (r.peanutRiskTier === 'high' && !(r.sourceKind === 'official' || r.corroboratedBy >= 2))
    bad('high(고위험) 는 sourceKind=official 이거나 corroboratedBy>=2(독립 근거 2건 이상)');
  if (r.nameParts) bad('nameParts: 여러 브랜드가 묶인 행은 브랜드별로 분리해야 함');
  return errs;
}

export const normName = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[\s·・/&-]+/g, '');

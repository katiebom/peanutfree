// 안심 등급 변환·표시 — docs/ops/tier-definitions.md 와 동기화할 것
// risk(brands/foods/reviews): safe | info | caution | danger | unknown
// peanutRiskTier(restaurants): low | transparent | medium | high | unknown

const TIER_TO_RISK = { low: 'safe', transparent: 'info', medium: 'caution', high: 'danger', unknown: 'unknown' };

/** restaurants.peanutRiskTier → risk. 알 수 없는 값은 'unknown' (과대 안전 표시 방지) */
export function tierToRisk(tier) {
  return TIER_TO_RISK[String(tier || '').toLowerCase()] || 'unknown';
}

export const RISK_COLOR = {
  safe: '#2D8A4E', info: '#4A7FBF', caution: '#D9622F', danger: '#C13A2D', unknown: '#8A8A8A', closed: '#555555', tempClosed: '#B07A1A', safeVerified: '#2D8A4E', infoVerified: '#4A7FBF',
};

/** 표시용 등급: 폐업·임시휴업이 확인된 식당은 안전 등급 대신 영업 상태를 보여준다 (숨기지 않고 표기) */
export function effectiveRisk(item) {
  if (item?.operatingStatus === 'closed') return 'closed';
  if (item?.operatingStatus === 'temporarily_closed') return 'tempClosed';
  if (item?.adminVerified && item?.risk === 'info') return 'infoVerified';       // 관리자가 직접 확인한 성분 투명 식당
  if (item?.adminVerified && item?.risk === 'safe') return 'safeVerified';   // 관리자가 직접 확인한 안전 식당은 '미검증'을 떼고 표시
  return item?.risk;
}

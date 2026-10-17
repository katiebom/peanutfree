// 약관·개인정보처리방침 링크와 동의 버전 (docs/ 가 GitHub Pages 로 게시됨)
import { Linking } from 'react-native';

const BASE = 'https://katiebom.github.io/peanutfree';

export const LEGAL_URLS = {
  terms: `${BASE}/terms.html`,
  privacy: `${BASE}/privacy-policy.html`,
};

// 문서 내용이 바뀌어 재동의가 필요하면 값을 올린다. (App.js CONSENT_KEY 도 함께 올릴 것)
export const CONSENT_VERSION = '2026-10';
// 알레르기 프로필(민감정보) 별도 동의 버전
export const SENSITIVE_CONSENT_VERSION = '2026-10';

export function openLegal(kind, lang) {
  const hash = lang === 'en' ? '#en' : '';
  return Linking.openURL(`${LEGAL_URLS[kind]}${hash}`).catch(() => {});
}

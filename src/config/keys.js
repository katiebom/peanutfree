// src/config/keys.js
// API 키는 .env.local에서 관리됩니다 (git에 포함되지 않음).
// EAS Build에서는 eas secret:create 명령으로 환경변수를 설정하세요:
//   eas secret:create --name NAVER_CLIENT_ID --value <값>
//   eas secret:create --name NAVER_CLIENT_SECRET --value <값>
//   eas secret:create --name GOOGLE_PLACES_KEY --value <값>
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const NAVER_CLIENT_ID     = extra.naverClientId     || '6t9ac331vy';
export const NAVER_CLIENT_SECRET = extra.naverClientSecret || '';
export const GOOGLE_PLACES_KEY   = extra.googlePlacesKey   || 'REDACTED_API_KEY';

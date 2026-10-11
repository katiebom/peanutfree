// src/config/keys.js
// API 키는 .env.local에서 관리됩니다 (git에 포함되지 않음). 코드에는 비밀값을 적지 않는다(NAVER_MAPS_CLIENT_ID 는 지도 SDK 로 화면에 노출되는 공개 값이라 예외).
// EAS Build에서는 eas secret:create 명령으로 환경변수를 설정하세요:
//   eas secret:create --name NAVER_CLIENT_ID --value <값>
//   eas secret:create --name NAVER_MAPS_CLIENT_ID --value <값>   (지도용, 없으면 코드 기본값)
//   eas secret:create --name NAVER_CLIENT_SECRET --value <값>
//   eas secret:create --name GOOGLE_PLACES_KEY --value <값>
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

// 검색 API(Open API)용 ID. 지도 SDK용 ID(NAVER_MAPS_CLIENT_ID)와 다른 애플리케이션일 수 있다.
export const NAVER_CLIENT_ID     = extra.naverClientId     || '';
// 지도 SDK(Dynamic Map)용 ID — 화면에 노출되는 공개 값이라 기본값을 코드에 둔다.
export const NAVER_MAPS_CLIENT_ID = extra.naverMapsClientId || '6t9ac331vy';
export const NAVER_CLIENT_SECRET = extra.naverClientSecret || '';
export const GOOGLE_PLACES_KEY   = extra.googlePlacesKey   || '';

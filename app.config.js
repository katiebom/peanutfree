// app.config.js — 동적 Expo 설정
// .env.local의 API 키를 extra로 주입합니다.
// EAS Build에서는 eas secret:create 로 환경변수를 설정하세요.
const base = require('./app.json');

module.exports = {
  ...base.expo,
  extra: {
    ...base.expo.extra,
    naverClientId: process.env.NAVER_CLIENT_ID || '',
    naverClientSecret: process.env.NAVER_CLIENT_SECRET || '',
    googlePlacesKey: process.env.GOOGLE_PLACES_KEY || '',
    eas: base.expo.extra?.eas,
  },
};

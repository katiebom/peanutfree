// src/utils/openMap.js
// 식당을 구글맵·네이버맵에서 연다. 평점은 앱에 저장하지 않고 지도 앱에서 최신값을 보게 한다.
import { Linking } from 'react-native';

const APP_ID = 'com.xavierj.peanutfree';

// 가게 이름만으로 찾으면 동명 매장으로 빠진다 — 구 단위 주소를 붙인다
function districtOf(address = '') {
  const m = address.match(/([가-힣]+구)/);
  return m ? m[1] : '';
}

export function googleMapsUrl({ name, address, placeId }) {
  const query = encodeURIComponent([name, address].filter(Boolean).join(' '));
  const pid = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : '';
  return `https://www.google.com/maps/search/?api=1&query=${query}${pid}`;
}

export function openGoogleMaps(place) {
  Linking.openURL(googleMapsUrl(place)).catch(() => {});
}

// Android 11+ 에서는 <queries> 선언 없이 canOpenURL('nmap://')이 항상 false라
// 앱이 깔려 있어도 웹으로 빠졌다. 바로 열어 보고 실패하면 웹으로 간다.
export async function openNaverMap({ name, address }) {
  const q = encodeURIComponent([name, districtOf(address)].filter(Boolean).join(' '));
  try {
    await Linking.openURL(`nmap://search?query=${q}&appname=${APP_ID}`);
  } catch {
    Linking.openURL(`https://map.naver.com/p/search/${q}`).catch(() => {});
  }
}

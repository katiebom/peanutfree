// 좌표 조회 공용 모듈 — 네이버 지역 검색(NAVER_SEARCH_*) 우선, 없으면 카카오 로컬(KAKAO_REST_KEY). .env.local 에서 키를 읽는다.
import fs from 'fs';
import { normName } from './evidence.mjs';

const env = { ...process.env };
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
export const ENV = env;
export const KAKAO = env.KAKAO_REST_KEY;
export const NAVER = env.NAVER_SEARCH_CLIENT_ID && env.NAVER_SEARCH_CLIENT_SECRET
  ? { 'X-Naver-Client-Id': env.NAVER_SEARCH_CLIENT_ID, 'X-Naver-Client-Secret': env.NAVER_SEARCH_CLIENT_SECRET } : null;
export const hasGeocoder = () => !!(NAVER || KAKAO);

const strip = t => String(t || '').replace(/<[^>]*>/g, '');
// 상호 일치: 완전히 같거나, 한쪽이 다른 쪽에 포함되되 짧은 쪽이 3자 이상이고 긴 쪽의 60% 이상일 때만(짧은 이름에 엉뚱하게 걸리는 것 방지)
export const sameName = (title, name) => {
  const a = normName(strip(title)), b = normName(name);
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 3 && l.includes(s) && s.length / l.length >= 0.6;
};
export const exactName = (title, name) => normName(strip(title)) === normName(name);

/** 후보 목록 [{ title, address, lat, lng }] — 제공자별 결과를 같은 모양으로 */
export async function searchPlaces(query) {
  const out = [];
  try {
    if (NAVER) {
      const res = await fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`, { headers: NAVER });
      for (const i of (await res.json()).items || []) if (i.mapx && i.mapy)
        out.push({ title: strip(i.title), address: i.roadAddress || i.address, lat: parseInt(i.mapy, 10) / 1e7, lng: parseInt(i.mapx, 10) / 1e7 });
    }
    if (!out.length && KAKAO) {
      const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`, { headers: { Authorization: `KakaoAK ${KAKAO}` } });
      for (const d of (await res.json()).documents || [])
        out.push({ title: d.place_name, address: d.road_address_name || d.address_name, lat: +d.y, lng: +d.x });
    }
  } catch { /* 조회 실패는 빈 결과 */ }
  return out;
}

/** 상호가 일치하는 첫 결과 (없으면 null) */
export async function geocode(name, district) {
  const hits = await searchPlaces(`${name} ${district || ''}`.trim());
  const hit = hits.find(h => sameName(h.title, name));
  return hit ? { lat: hit.lat, lng: hit.lng, address: hit.address } : null;
}

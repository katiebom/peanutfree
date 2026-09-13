// src/screens/MapScreen.js
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BRANDS as LOCAL_BRANDS } from '../data/database';
import { REVIEWS } from '../data/database';
import { subscribeBrands, subscribeMapReports, subscribeReviews, addUserReport } from '../firebase/dbService';
import { NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, GOOGLE_PLACES_KEY } from '../config/keys';
import { SC } from '../data/translations';

const RISK_OPTIONS = ['safe', 'caution', 'danger', 'info'];
const RISK_LABEL = { safe: '✓  안전', caution: '!  주의', danger: '✗  위험', info: 'ℹ  확인필요' };

// 프랜차이즈 체인이 아닌 일반 카테고리 브랜드는 검색 제외
function isSearchableBrand(name) {
  if (!name) return false;
  if (name.includes('(일반)')) return false; // 샤브샤브(일반), 양념갈비(일반) 등
  if (name.includes('/')) return false;      // 곰탕/설렁탕 등
  return true;
}

// ── Naver 헬퍼 ───────────────────────────────────────────────
const NAVER_HDR = () => ({
  'X-Naver-Client-Id': NAVER_CLIENT_ID,
  'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
});
function naverItem(item) {
  return {
    id: item.mapx + item.mapy,
    name: item.title.replace(/<[^>]*>/g, ''),
    address: item.roadAddress || item.address,
    category: item.category,
    lat: parseInt(item.mapy, 10) / 1e7,
    lng: parseInt(item.mapx, 10) / 1e7,
  };
}

// ── 네이버 브랜드 매장 검색 (전국, 최대 15개) ────────────────
async function fetchBrandStores(brandName) {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const q = encodeURIComponent(brandName);
    const results = [];
    for (let start = 1; start <= 3; start++) {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/local.json?query=${q}&display=5&start=${(start - 1) * 5 + 1}`,
        { headers: NAVER_HDR() }
      );
      const data = await res.json();
      if (data.errorCode) break;
      const items = (data.items || []).filter(i => i.mapy && i.mapx);
      results.push(...items.map(i => ({
        lat: parseInt(i.mapy, 10) / 1e7,
        lng: parseInt(i.mapx, 10) / 1e7,
        name: i.title.replace(/<[^>]*>/g, ''),
        address: i.roadAddress || i.address,
      })));
      if (items.length < 5) break;
    }
    return results;
  } catch {
    return [];
  }
}

// ── 네이버 장소 검색 (기록용) ────────────────────────────────
async function searchPlaces(query) {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET || !query.trim()) return [];
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${q}&display=5`,
      { headers: NAVER_HDR() }
    );
    const data = await res.json();
    return (data.items || []).filter(i => i.mapy && i.mapx).map(naverItem);
  } catch {
    return [];
  }
}

// ── 구글 근처 고평점 식당 검색 ───────────────────────────────
async function fetchNearbyHighRated(lat, lng) {
  if (!GOOGLE_PLACES_KEY) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1500&type=restaurant&key=${GOOGLE_PLACES_KEY}&language=ko`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return [];
    return data.results
      .filter(p => (p.rating || 0) >= 4.0 && p.geometry?.location)
      .slice(0, 20)
      .map(p => ({
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        name: p.name,
        address: p.vicinity,
        rating: p.rating,
        userRatingsTotal: p.user_ratings_total,
        placeId: p.place_id,
      }));
  } catch {
    return [];
  }
}

// ── 지도 기록 모달 (2단계: 검색 → 입력) ─────────────────────
function MapRecordFlow({ visible, onClose, user, initialPlace, brands = [] }) {
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [risk, setRisk] = useState('safe');
  const [menuItem, setMenuItem] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchDebounce = useRef(null);

  // 지도에서 마커를 탭해서 열린 경우 step 2로 바로 진입
  useEffect(() => {
    if (visible && initialPlace) {
      setSelected(initialPlace);
      setStep(2);
    } else if (!visible) {
      setStep(1); setQuery(''); setResults([]);
      setSelected(null); setRisk('safe'); setMenuItem(''); setNote('');
    }
  }, [visible, initialPlace]);

  // 자동 검색 (debounce 600ms) — 브랜드 DB + 네이버 통합
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      // 브랜드 DB에서 먼저 검색
      const ql = q.toLowerCase();
      const brandMatches = brands
        .filter(b => {
          const d = b.ko;
          return d && isSearchableBrand(d.name) &&
            ((d.name || '').toLowerCase().includes(ql) || (d.cat || '').toLowerCase().includes(ql));
        })
        .map(b => ({
          id: `brand_${b.id}`,
          name: b.ko.name,
          address: b.ko.cat || '브랜드',
          category: '브랜드',
          lat: null,
          lng: null,
          _isBrand: true,
          _risk: b.risk,
        }));
      const places = await searchPlaces(q);
      setResults([...brandMatches, ...places]);
      setSearching(false);
    }, 600);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [query, brands]);

  function reset() {
    setStep(1); setQuery(''); setResults([]);
    setSelected(null); setRisk('safe'); setMenuItem(''); setNote('');
  }

  function handleClose() { reset(); onClose(); }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const places = await searchPlaces(query);
    setResults(places);
    setSearching(false);
  }

  function handleSelect(place) {
    setSelected(place);
    setStep(2);
  }

  async function handleSubmit() {
    if (!user) { Alert.alert('로그인이 필요합니다.'); return; }
    setSubmitting(true);
    try {
      const hasLocation = selected.lat != null && selected.lng != null;
      await addUserReport({
        targetType: selected._isBrand ? 'brand' : 'restaurant',
        targetId: selected._isBrand ? selected.id.replace('brand_', '') : `map_${selected.id || Date.now()}`,
        targetName: selected.name,
        targetImg: '🍽️',
        risk,
        scope: menuItem.trim() ? 'specific' : 'all',
        menuItem: menuItem.trim(),
        note: note.trim(),
        hasLocation,
        lat: selected.lat,
        lng: selected.lng,
        address: selected.address || '',
        userId: user.uid,
        userNickname: user.displayName || '익명',
      });
      Alert.alert('기록 완료! 🙏', '소중한 경험을 공유해주셨습니다.\n지도에 마커로 표시됩니다.');
      reset();
      onClose();
    } catch {
      Alert.alert('오류', '기록 중 문제가 생겼어요. 다시 시도해주세요.');
    }
    setSubmitting(false);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={r.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* 헤더 */}
        <View style={r.header}>
          {step === 2 && (
            <TouchableOpacity onPress={() => setStep(1)} style={r.backBtn}>
              <Text style={r.backText}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={r.headerTitle}>
            {step === 1 ? '📍  식당 검색' : '📝  기록 입력'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={r.closeBtn}>
            <Text style={r.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* STEP 1: 식당 검색 */}
        {step === 1 && (
          <View style={{ flex: 1 }}>
            <View style={r.searchBar}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                placeholder="식당명 검색 (예: 스타벅스 강남)"
                placeholderTextColor="#BBB"
                style={r.searchInput}
                returnKeyType="search"
                autoFocus
              />
              {searching
                ? <ActivityIndicator size="small" color="#4A7FBF" style={{ marginRight: 10 }} />
                : null
              }
            </View>
            <Text style={r.hint}>2글자 이상 입력하면 자동 검색됩니다 · 예) "스타벅스 강남"</Text>

            {results.length === 0 && !searching && query.trim().length > 0 && (
              <View style={r.empty}>
                <Text style={r.emptyText}>검색 결과가 없어요</Text>
                <Text style={r.emptyHint}>아래 버튼으로 직접 이름을 입력해 기록할 수 있어요</Text>
              </View>
            )}

            <FlatList
              data={results}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const sc = item._isBrand ? SC[item._risk] || {} : {};
                return (
                  <TouchableOpacity style={r.resultCard} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                    <Text style={r.resultIcon}>{item._isBrand ? '🏪' : '🍽️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={r.resultName}>{item.name}</Text>
                      <Text style={r.resultAddr} numberOfLines={1}>{item.address}</Text>
                      {item._isBrand && (
                        <Text style={[r.resultCat, { color: sc.color || '#888', fontWeight: '700' }]}>
                          브랜드 DB
                        </Text>
                      )}
                      {!item._isBrand && item.category ? (
                        <Text style={r.resultCat} numberOfLines={1}>{item.category}</Text>
                      ) : null}
                    </View>
                    <Text style={r.resultArrow}>›</Text>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
              ListFooterComponent={() => query.trim().length >= 2 && !searching ? (
                <TouchableOpacity
                  style={r.directCard}
                  onPress={() => handleSelect({
                    id: `custom_${Date.now()}`,
                    name: query.trim(),
                    address: '위치 없음',
                    lat: null,
                    lng: null,
                  })}
                  activeOpacity={0.7}
                >
                  <Text style={r.directCardIcon}>✏️</Text>
                  <View style={r.directCardBody}>
                    <Text style={r.directCardName}>"{query.trim()}" 이름으로 직접 기록하기</Text>
                    <Text style={r.directCardHint}>목록에 없는 식당도 기록할 수 있어요 (위치 미포함)</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            />
          </View>
        )}

        {/* STEP 2: 기록 입력 */}
        {step === 2 && selected && (
          <ScrollView style={r.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* 선택된 식당 */}
            <View style={r.selectedCard}>
              <Text style={r.selectedIcon}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={r.selectedName}>{selected.name}</Text>
                <Text style={r.selectedAddr}>{selected.address}</Text>
              </View>
            </View>

            {/* 안전도 */}
            <Text style={r.sectionLabel}>안전도 판단 *</Text>
            <View style={r.riskRow}>
              {RISK_OPTIONS.map(rv => {
                const sc = SC[rv];
                const active = risk === rv;
                return (
                  <TouchableOpacity
                    key={rv}
                    onPress={() => setRisk(rv)}
                    style={[r.riskBtn, { borderColor: sc.color, backgroundColor: active ? sc.bg : 'white' }]}
                  >
                    <Text style={[r.riskBtnText, { color: sc.color, fontWeight: active ? '800' : '400' }]}>
                      {RISK_LABEL[rv]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 특정 메뉴 */}
            <Text style={r.sectionLabel}>특정 메뉴 (선택)</Text>
            <TextInput
              value={menuItem}
              onChangeText={setMenuItem}
              placeholder="예) 황금올리브, 불고기버거"
              placeholderTextColor="#CCC"
              style={r.input}
            />

            {/* 메모 */}
            <Text style={r.sectionLabel}>상세 메모 (선택)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="어떤 경험인지 자세히 써주시면 다른 분들께 큰 도움이 됩니다."
              placeholderTextColor="#CCC"
              multiline
              style={[r.input, r.inputMulti]}
            />

            {/* 제출 */}
            <TouchableOpacity
              style={[r.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="white" />
                : <Text style={r.submitBtnText}>지도에 기록 등록</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 네이버 지도 HTML 빌더 (MarkerClustering + 바텀시트 연동) ──
function buildMapHTML(markers, userLat, userLng) {
  const centerLat = userLat || 37.5665;
  const centerLng = userLng || 126.9780;

  const markersJSON = JSON.stringify(
    markers.map(m => ({
      lat: m.lat, lng: m.lng, risk: m.risk || 'info',
      label: (m.label || '').substring(0, 40),
      address: (m.address || '').substring(0, 60),
      detail: (m.detail || '').substring(0, 80),
      isUserReport: !!m.isUserReport,
    }))
  );

  const userMarkerJS = (userLat && userLng) ? `
    new naver.maps.Marker({
      position: new naver.maps.LatLng(${userLat}, ${userLng}),
      map: map,
      icon: {
        content: '<div style="width:18px;height:18px;border-radius:50%;background:#4A7FBF;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
        size: new naver.maps.Size(18, 18),
        anchor: new naver.maps.Point(9, 9),
      },
      zIndex: 1000,
    });
  ` : '';

  const locBtnHTML = (userLat && userLng)
    ? `<div id="loc-btn" onclick="map.setCenter(new naver.maps.LatLng(${userLat},${userLng}));map.setZoom(16)">📍</div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_CLIENT_ID}"></script>
  <script src="https://navermaps.github.io/maps.js.ncp/docs/marker-clustering.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; overflow:hidden; }
    .mk-dot {
      border-radius:50%;
      border:2.5px solid rgba(255,255,255,0.95);
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
      will-change: transform;
    }
    .mk-dot.selected {
      transform: scale(1.6);
      box-shadow:0 4px 12px rgba(0,0,0,0.45);
    }
    .cluster-mk {
      display:flex; align-items:center; justify-content:center;
      border-radius:50%; color:white; font-weight:900;
      border:3px solid rgba(255,255,255,0.9);
      box-shadow:0 3px 10px rgba(0,0,0,0.3);
    }
    #fab {
      position:absolute; bottom:28px; right:16px; z-index:999;
      width:52px; height:52px; background:#E8704A; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 14px rgba(232,112,74,0.5); cursor:pointer; font-size:22px;
    }
    #fab:active { transform:scale(0.92); background:#C5502F; }
    #loc-btn {
      position:absolute; bottom:90px; right:18px; z-index:999;
      width:40px; height:40px; background:white; border-radius:10px;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.2); cursor:pointer; font-size:18px;
    }
    #loc-btn:active { background:#F5F0EB; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="fab" onclick="sendMsg({type:'openRecord'})">✏️</div>
  ${locBtnHTML}
  <script>
    function sendMsg(obj) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }

    var RISK_FILL = {
      danger: '#C13A2D',
      caution: '#D9622F',
      info:   '#4A7FBF',
      safe:   '#2D8A4E',
      nearby: '#F5A623',
    };

    var map = new naver.maps.Map('map', {
      center: new naver.maps.LatLng(${centerLat}, ${centerLng}),
      zoom: 12,
      zoomControl: true,
      zoomControlOptions: {
        style: naver.maps.ZoomControlStyle.SMALL,
        position: naver.maps.Position.TOP_LEFT,
      },
      scaleControl: false,
      mapDataControl: false,
    });

    var selectedMk = null;
    var allMk = [];
    var mkData = ${markersJSON};

    naver.maps.Event.addListener(map, 'click', function() {
      if (selectedMk) {
        var el = selectedMk.getElement();
        if (el) { var dot = el.querySelector('.mk-dot'); if (dot) dot.classList.remove('selected'); }
        selectedMk = null;
      }
      sendMsg({ type: 'clearSheet' });
    });

    mkData.forEach(function(m, i) {
      var fill = RISK_FILL[m.risk] || RISK_FILL.info;
      var iconContent = m.isUserReport
        ? '<div class="mk-dot mk-user" style="width:22px;height:22px;background:' + fill + ';border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:22px;text-align:center;">✍</div>'
        : '<div class="mk-dot" style="width:18px;height:18px;background:' + fill + '"></div>';
      var iconSize = m.isUserReport ? new naver.maps.Size(22, 22) : new naver.maps.Size(18, 18);
      var iconAnchor = m.isUserReport ? new naver.maps.Point(11, 11) : new naver.maps.Point(9, 9);

      var marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(m.lat, m.lng),
        map: null,
        icon: {
          content: iconContent,
          size: iconSize,
          anchor: iconAnchor,
        },
      });

      naver.maps.Event.addListener(marker, 'click', function() {
        if (selectedMk && selectedMk !== marker) {
          var prevEl = selectedMk.getElement();
          if (prevEl) { var prevDot = prevEl.querySelector('.mk-dot'); if (prevDot) prevDot.classList.remove('selected'); }
        }
        var el = marker.getElement();
        if (el) { var dot = el.querySelector('.mk-dot'); if (dot) dot.classList.add('selected'); }
        selectedMk = marker;
        sendMsg({ type: 'markerTap', data: { label: m.label, address: m.address, detail: m.detail, risk: m.risk, lat: m.lat, lng: m.lng } });
      });

      allMk.push(marker);
    });

    function clusterIcon(sz, bg) {
      return {
        content: '<div class="cluster-mk" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + (sz < 44 ? 12 : 14) + 'px;background:' + bg + '"></div>',
        size: new naver.maps.Size(sz, sz),
        anchor: new naver.maps.Point(sz / 2, sz / 2),
      };
    }
    new MarkerClustering({
      minClusterSize: 2,
      maxZoom: 17,
      map: map,
      markers: allMk,
      disableClickZoom: false,
      gridSize: 90,
      icons: [clusterIcon(36, '#C13A2D'), clusterIcon(44, '#D9622F'), clusterIcon(52, '#E8704A')],
      indexGenerator: [10, 30, 100],
      stylingFunction: function(clusterMarker, count) {
        var el = clusterMarker.getElement();
        if (el) {
          var div = el.querySelector('.cluster-mk');
          if (div) div.textContent = count;
        }
      },
    });

    ${userMarkerJS}

    if (mkData.length > 0) {
      try {
        var bounds = new naver.maps.LatLngBounds();
        mkData.forEach(function(m) { bounds.extend(new naver.maps.LatLng(m.lat, m.lng)); });
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 60, left: 40 });
      } catch(e) {}
    }
  </script>
</body>
</html>`;
}

const RISK_KO = { safe: '안전', caution: '주의', danger: '위험', info: '확인필요', nearby: '근처맛집' };

// ── 지역/음식 종류별 맞춤 팁 ─────────────────────────────────
const REGION_TIPS = [
  {
    match: (data) => /연남|홍대|합정/i.test(data.address || '') || /비건|vegan/i.test(data.label || data.detail || ''),
    tip: '🌿 연남/홍대 비건 식당 주의: 비건 요리는 캐슈넛 크림·아몬드 밀크·땅콩 버터를 자주 사용합니다. 비건 = 안전이 아닙니다. 반드시 꼼꼼히 물어보세요.',
    tipEn: '🌿 Yeonnam/Hongdae Vegan Warning: Vegan dishes often use cashew cream, almond milk, or peanut butter. Vegan ≠ safe. Always ask carefully.',
  },
  {
    match: (data) => /이태원/i.test(data.address || '') && /커리|curry|할랄|halal|중동|인도/i.test(data.label || data.detail || ''),
    tip: '🫙 이태원 중동/인도 요리 주의: 소스 베이스에 이미 견과류 페이스트가 들어있을 수 있습니다. "Whole nuts"뿐 아니라 "Paste"·"Powder" 여부도 꼭 확인하세요.',
    tipEn: '🫙 Itaewon Middle Eastern/Indian: Nut paste may already be in the sauce base. Ask about "paste" and "powder" — not just whole nuts.',
  },
  {
    match: (data) => /청담/i.test(data.address || ''),
    tip: '🍽️ 청담 파인다이닝 팁: 예약 시 "Peanut/Nut Allergy"를 미리 전달하면 도구 세척부터 식재료 분리까지 철저히 준비해 줍니다.',
    tipEn: '🍽️ Cheongdam Fine Dining Tip: Mention "Peanut/Nut Allergy" at reservation — kitchens will clean utensils and separate ingredients from the start.',
  },
  {
    match: (data) => /압구정/i.test(data.address || '') && /카페|베이커리|cafe|bakery/i.test(data.label || data.detail || ''),
    tip: '🥐 압구정 베이커리 카페 주의: 오픈 키친에서 견과류 빵과 같은 집기를 공유하는 경우가 많습니다. 중증 알레르기라면 포장 제품 위주로 확인하세요.',
    tipEn: '🥐 Apgujeong Bakery Caution: Open kitchens often share tools between nut and non-nut items. Severe allergy? Stick to pre-packaged products.',
  },
  {
    match: (data) => /중식|chinese|태국|thai|동남아|베트남|vietnam|southeast/i.test(data.label || data.detail || (data.cuisineType || '')),
    tip: '🥜 중식·동남아 주의: \'Danger\'가 아니어도 땅콩 기름 사용이 많습니다. 조리유 종류도 반드시 확인하세요.',
    tipEn: '🥜 Chinese/SE Asian Caution: Even non-Danger spots often cook with peanut oil. Always ask about the cooking oil.',
  },
  {
    match: (data) => /카페|베이커리|bakery|cafe/i.test(data.label || data.detail || (data.cuisineType || '')),
    tip: '☕ 베이커리 카페 주의: 음료는 비교적 안전하지만 베이커리류는 견과류 포함 제품과 집기를 공유할 수 있습니다. 음료 중심으로 이용하세요.',
    tipEn: '☕ Bakery Cafe Caution: Drinks are relatively safe, but bakery items may share tools with nut-containing products. Stick to drinks when unsure.',
  },
];

function getRegionTip(sheetData, lang) {
  if (!sheetData) return null;
  const matched = REGION_TIPS.find(r => r.match(sheetData));
  if (!matched) return null;
  return lang === 'en' ? matched.tipEn : matched.tip;
}
const FILTERS = [
  { key: null,      label: '전체' },
  { key: 'safe',    label: '✓ 안전' },
  { key: 'caution', label: '! 주의' },
  { key: 'danger',  label: '✗ 위험' },
  { key: 'info',    label: 'ℹ 확인' },
  { key: 'nearby',  label: '⭐ 근처맛집' },
];
const SHEET_H = 250;

// ── 컴포넌트 ───────────────────────────────────────────────
export default function MapScreen({ lang, t, user }) {
  const [location, setLocation] = useState(null);
  const [locErr, setLocErr] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [reviews, setReviews] = useState(REVIEWS);
  const [mapReports, setMapReports] = useState([]);
  const [brands, setBrands] = useState(LOCAL_BRANDS);
  const [brandMarkers, setBrandMarkers] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [nearbyMarkers, setNearbyMarkers] = useState([]);
  const [showRecord, setShowRecord] = useState(false);
  const [recordInitial, setRecordInitial] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const webviewRef = useRef(null);
  const brandIdsRef = useRef('');

  function showSheet(data) {
    setSheetData(data);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }
  function hideSheet() {
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start(() => setSheetData(null));
  }

  function handleWebViewMessage(e) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'openRecord') {
        setRecordInitial(null);
        setShowRecord(true);
      } else if (msg.type === 'recordFor') {
        setRecordInitial({ name: msg.name, lat: msg.lat, lng: msg.lng, address: msg.address || '' });
        setShowRecord(true);
      } else if (msg.type === 'markerTap') {
        showSheet(msg.data);
      } else if (msg.type === 'clearSheet') {
        hideSheet();
      }
    } catch {}
  }

  // 위치 권한 + 현재 위치
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          setLocation(loc.coords);
        } else {
          setLocErr(true);
        }
      } catch {
        setLocErr(true);
      } finally {
        setMapReady(true);
      }
    })();
  }, []);

  // Firebase 리뷰 + 사용자 기록 + 브랜드 실시간 구독
  useEffect(() => {
    const u1 = subscribeReviews(data => {
      // Firebase + 로컬 병합 (Firebase 우선, 로컬은 중복 제외)
      const fbNames = new Set(data.map(r => r.ko?.name || r.name || ''));
      const localOnly = REVIEWS.filter(r => !fbNames.has(r.ko?.name || ''));
      const merged = [...data, ...localOnly];
      setReviews(merged.length > 0 ? merged : REVIEWS);
    });
    const u2 = subscribeMapReports(setMapReports);
    const u3 = subscribeBrands(data => { if (data.length > 0) setBrands(data); });
    return () => { u1(); u2(); u3(); };
  }, []);

  // 근처 고평점 식당 (구글 Places Nearby)
  useEffect(() => {
    if (!location) return;
    fetchNearbyHighRated(location.latitude, location.longitude).then(results => {
      setNearbyMarkers(results.map(p => ({
        lat: p.lat,
        lng: p.lng,
        risk: 'nearby',
        label: p.name,
        address: p.address,
        detail: `⭐ ${p.rating}${p.userRatingsTotal ? ` (${p.userRatingsTotal.toLocaleString()}명)` : ''} · Google Maps · 땅콩 정보 없음 — 방문 전 직접 확인하세요`,
      })));
    });
  }, [location]);

  // 네이버 API로 브랜드 매장 위치 조회 (전국) — brands 목록이 실제로 바뀔 때만 재조회
  useEffect(() => {
    if (!mapReady) return;
    const newIds = brands.map(b => b.id).sort().join(',');
    if (newIds === brandIdsRef.current) return;
    brandIdsRef.current = newIds;

    setLoadingBrands(true);
    Promise.all(
      brands.map(async brand => {
        const name = (brand.ko || {}).name;
        if (!isSearchableBrand(name)) return [];
        const stores = await fetchBrandStores(name);
        return stores.map(s => ({
          lat: s.lat,
          lng: s.lng,
          risk: brand.risk,
          label: name,
          detail: (brand.ko || {}).reason || '',
          address: s.address,
          isBrand: true,
        }));
      })
    ).then(results => {
      setBrandMarkers(results.flat());
      setLoadingBrands(false);
    });
  }, [mapReady, brands]);

  if (!mapReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E8704A" />
      </View>
    );
  }

  const isDefaultSeoul = rv =>
    Math.abs(rv.lat - 37.5665) < 0.001 && Math.abs(rv.lng - 126.9780) < 0.001;

  const allMarkers = [
    ...reviews.filter(rv => rv.lat && rv.lng && !isDefaultSeoul(rv)).map(rv => {
      const d = rv[lang] || rv.ko;
      return { lat: rv.lat, lng: rv.lng, risk: rv.risk, label: d?.name || '', detail: d?.review || '', address: rv.address || '' };
    }),
    ...brandMarkers,
    ...mapReports.filter(rv => rv.lat && rv.lng && !isDefaultSeoul(rv)).map(rv => ({
      lat: rv.lat, lng: rv.lng, risk: rv.risk,
      label: `${rv.targetImg || '📌'} ${rv.targetName}`,
      detail: rv.note || (rv.menuItem ? `메뉴: ${rv.menuItem}` : ''),
      address: rv.userNickname ? `📝 ${rv.userNickname}` : '',
      isUserReport: true,
    })),
    ...nearbyMarkers,
  ];

  const filteredMarkers = activeFilter ? allMarkers.filter(m => m.risk === activeFilter) : allMarkers;
  const html = buildMapHTML(filteredMarkers, location?.latitude, location?.longitude);
  const NEARBY_SC = { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', icon: '⭐' };
  const sheetSC = sheetData
    ? (sheetData.risk === 'nearby' ? NEARBY_SC : (SC[sheetData.risk] || SC.info))
    : null;
  const sheetY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [SHEET_H, 0] });

  return (
    <View style={styles.container}>
      {/* 상단 배너 */}
      <View style={styles.topBar}>
        <Text style={styles.warnText}>⚠️  {t.mapWarn}</Text>
        {loadingBrands && <ActivityIndicator size="small" color="#4A7FBF" />}
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={webviewRef}
          source={{ html, baseUrl: 'http://localhost' }}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          scalesPageToFit={false}
          onMessage={handleWebViewMessage}
          onError={e => console.log('WebView error:', JSON.stringify(e.nativeEvent))}
        />

        {/* 필터 칩 (플로팅) */}
        <View style={styles.filterOverlay} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pointerEvents="auto"
            contentContainerStyle={styles.filterContent}
          >
            {FILTERS.map(f => (
              <TouchableOpacity
                key={String(f.key)}
                style={[styles.chip, activeFilter === f.key && styles.chipActive]}
                onPress={() => setActiveFilter(f.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 바텀 시트 */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
          {sheetData && (
            <>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetRow}>
                <View style={[styles.badge, { backgroundColor: sheetSC?.bg }]}>
                  <Text style={[styles.badgeText, { color: sheetSC?.color }]}>
                    {sheetSC?.icon} {RISK_KO[sheetData.risk] || '정보'}
                  </Text>
                </View>
                <TouchableOpacity onPress={hideSheet} style={styles.sheetCloseBtn}>
                  <Text style={styles.sheetCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sheetName} numberOfLines={2}>{sheetData.label}</Text>
              {!!sheetData.address && (
                <Text style={styles.sheetAddr} numberOfLines={1}>📍 {sheetData.address}</Text>
              )}
              {!!sheetData.detail && (
                <Text style={styles.sheetDetail} numberOfLines={3}>{sheetData.detail}</Text>
              )}
              {!!getRegionTip(sheetData, lang) && (
                <View style={styles.tipBox}>
                  <Text style={styles.tipText}>{getRegionTip(sheetData, lang)}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.sheetBtn}
                onPress={() => {
                  hideSheet();
                  setRecordInitial({ name: sheetData.label, lat: sheetData.lat, lng: sheetData.lng, address: sheetData.address });
                  setShowRecord(true);
                }}
              >
                <Text style={styles.sheetBtnText}>📝 이 식당 기록하기</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {locErr && (
          <View style={styles.locErrBanner}>
            <Text style={styles.locErrText}>📍 {t.locationErr}</Text>
          </View>
        )}
      </View>

      <MapRecordFlow
        visible={showRecord}
        onClose={() => { setShowRecord(false); setRecordInitial(null); }}
        user={user}
        initialPlace={recordInitial}
        brands={brands}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF8E7', borderBottomWidth: 1, borderBottomColor: '#F5C842',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  warnText: { flex: 1, fontSize: 10, color: '#8B6914' },
  filterOverlay: {
    position: 'absolute', top: 10, left: 0, right: 0, zIndex: 10,
  },
  filterContent: {
    paddingHorizontal: 12, gap: 8,
  },
  chip: {
    backgroundColor: 'white', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
  },
  chipActive: { backgroundColor: '#E8704A' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#333' },
  chipTextActive: { color: 'white' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
    minHeight: SHEET_H,
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4,
    backgroundColor: '#DDD', borderRadius: 2, marginTop: 10, marginBottom: 14,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  sheetCloseBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F5F0EB', alignItems: 'center', justifyContent: 'center',
  },
  sheetCloseText: { fontSize: 12, color: '#666' },
  sheetName: { fontSize: 17, fontWeight: '900', color: '#1A1A1A', marginBottom: 6 },
  sheetAddr: { fontSize: 12, color: '#888', marginBottom: 6 },
  sheetDetail: { fontSize: 12, color: '#555', lineHeight: 18, marginBottom: 12 },
  tipBox: { backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#FFA000' },
  tipText: { fontSize: 12, color: '#5D4037', lineHeight: 18 },
  sheetBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  sheetBtnText: { color: 'white', fontSize: 13, fontWeight: '800' },
  locErrBanner: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: 'white', borderRadius: 10, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  locErrText: { fontSize: 12, color: '#C13A2D', textAlign: 'center' },
});

// ── MapRecordFlow 스타일 ───────────────────────────────────
const r = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: Platform.OS === 'ios' ? 56 : 24,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8', gap: 8,
  },
  backBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 18, color: '#555', lineHeight: 22 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '900' },
  closeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: '#666' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 14, marginBottom: 4,
  },
  searchInput: {
    flex: 1, backgroundColor: '#FAF8F5',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#EEE',
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#333',
  },
  searchBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 11,
    minWidth: 60, alignItems: 'center',
  },
  searchBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  hint: { fontSize: 11, color: '#BBB', paddingHorizontal: 14, marginBottom: 8 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, color: '#999', fontWeight: '700' },
  emptyHint: { fontSize: 12, color: '#CCC', marginTop: 4 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  resultIcon: { fontSize: 24 },
  resultName: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  resultAddr: { fontSize: 11, color: '#999', marginTop: 2 },
  resultCat: { fontSize: 10, color: '#BBB', marginTop: 1 },
  resultArrow: { fontSize: 20, color: '#CCC' },
  body: { flex: 1, padding: 20 },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FAF8F5', borderRadius: 12, padding: 14, marginBottom: 20,
  },
  selectedIcon: { fontSize: 28 },
  selectedName: { fontSize: 16, fontWeight: '900', color: '#1A1A1A' },
  selectedAddr: { fontSize: 11, color: '#999', marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 4 },
  riskRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  riskBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1.5,
  },
  riskBtnText: { fontSize: 13 },
  input: {
    backgroundColor: '#FAF8F5', borderRadius: 10, borderWidth: 1.5,
    borderColor: '#EEE', paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 13, color: '#333', marginBottom: 18,
  },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 4,
  },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  directCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF8F5', borderRadius: 12, padding: 14,
    marginTop: 8, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#E8704A', borderStyle: 'dashed',
  },
  directCardIcon: { fontSize: 22, flexShrink: 0 },
  directCardBody: { flex: 1 },
  directCardName: { fontSize: 13, fontWeight: '800', color: '#E8704A' },
  directCardHint: { fontSize: 11, color: '#BBB', marginTop: 2 },
});

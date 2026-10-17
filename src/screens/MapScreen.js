// src/screens/MapScreen.js
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BRANDS as LOCAL_BRANDS } from '../data/database';
import { REVIEWS } from '../data/database';
import { subscribeBrands, subscribeMapReports, subscribeReviews, addUserReport } from '../firebase/dbService';
import { NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_MAPS_CLIENT_ID, GOOGLE_PLACES_KEY } from '../config/keys';
import { SC } from '../data/translations';
import { effectiveRisk } from '../utils/risk';

const RISK_OPTIONS = ['safe', 'caution', 'danger', 'info'];
const RISK_LABEL = { safe: '✓  안전(미검증)', caution: '!  요주의', danger: '✗  고위험', info: 'ℹ  성분 확인 필요' };

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
  const q0 = query.trim();
  if (!q0) return [];
  if (GOOGLE_PLACES_KEY) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q0 + ' 한국')}&language=ko&key=${GOOGLE_PLACES_KEY}`
      );
      const data = await res.json();
      if (data.status === 'OK') {
        return (data.results || []).slice(0, 8).map(p => ({
          id: p.place_id,
          name: p.name,
          address: p.formatted_address,
          category: p.types?.[0] || '',
          lat: p.geometry?.location?.lat ?? null,
          lng: p.geometry?.location?.lng ?? null,
        }));
      }
    } catch { /* 네이버로 넘어간다 */ }
  }
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q0)}&display=5`,
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
function MapRecordFlow({ visible, onClose, user, initialPlace, brands = [], location = null }) {
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
      Alert.alert('기록 완료! 🙏', hasLocation
        ? '소중한 경험을 공유해주셨습니다.\n지도에 마커로 표시됩니다.'
        : '소중한 경험을 공유해주셨습니다.\n위치 정보가 없어 지도에는 표시되지 않아요. 관리자 확인 후 반영됩니다.');
      reset();
      onClose();
    } catch {
      Alert.alert('오류', '기록 중 문제가 생겼어요. 다시 시도해주세요.');
    }
    setSubmitting(false);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={r.wrap} behavior="padding">

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
                <View>
                  {location && (
                    <TouchableOpacity
                      style={r.directCard}
                      onPress={() => handleSelect({
                        id: `custom_${Date.now()}`,
                        name: query.trim(),
                        address: '현재 위치 기준',
                        lat: location.latitude,
                        lng: location.longitude,
                      })}
                      activeOpacity={0.7}
                    >
                      <Text style={r.directCardIcon}>📍</Text>
                      <View style={r.directCardBody}>
                        <Text style={r.directCardName}>"{query.trim()}" 현재 위치로 기록하기</Text>
                        <Text style={r.directCardHint}>지금 그 식당 근처에 계시다면 이 방법이 정확해요. 지도에 표시됩니다</Text>
                      </View>
                    </TouchableOpacity>
                  )}
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
                      <Text style={r.directCardName}>"{query.trim()}" 위치 없이 기록하기</Text>
                      <Text style={r.directCardHint}>지도에는 표시되지 않고, 관리자 확인 후 반영돼요</Text>
                    </View>
                  </TouchableOpacity>
                </View>
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

// ── 네이버 지도 HTML (한 번만 로드) ───────────────────────────
// 마커·사용자 위치는 로드 후 window.setMarkers / window.setUser 로 주입한다.
// 클러스터링은 외부 스크립트 없이 페이지 안에서 직접 처리한다(뷰포트 안 마커만 렌더).
function buildMapHTML(clientId) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
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
    .mk-dot.selected { transform: scale(1.6); box-shadow:0 4px 12px rgba(0,0,0,0.45); }
    .cluster-mk {
      display:flex; align-items:center; justify-content:center;
      border-radius:50%; background:#fff; color:#374151; font-weight:900;
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
      display:none; align-items:center; justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.2); cursor:pointer; font-size:18px;
    }
    #loc-btn:active { background:#F5F0EB; }
  </style>
  <script>
    function sendMsg(obj) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
    // SDK 가 콘솔에 남기는 인증 오류 사유를 RN 으로 전달(오류 화면에 표시)
    var _info = console.info;
    console.info = function() {
      try { sendMsg({ type: 'diag', text: Array.prototype.slice.call(arguments).map(function(a) { return typeof a === 'string' ? a : ''; }).join(' ').substring(0, 300) }); } catch (e) {}
      return _info && _info.apply(console, arguments);
    };
    window.addEventListener('error', function(e) { sendMsg({ type: 'diag', text: 'js: ' + (e.message || '') + ' ' + (e.filename || '') }); }, true);
    window.navermap_authFailure = function() { sendMsg({ type: 'error', reason: 'auth' }); };
  </script>
  <script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}"
          onerror="sendMsg({ type: 'error', reason: 'sdk' })"></script>
</head>
<body>
  <div id="map"></div>
  <div id="fab" onclick="sendMsg({type:'openRecord'})">✏️</div>
  <div id="loc-btn" onclick="goUser()">📍</div>
  <script>
    var RISK_FILL = {
      danger: '#C13A2D', caution: '#D9622F', info: '#4A7FBF', safe: '#2D8A4E',
      unknown: '#8A8A8A', closed: '#555555', tempClosed: '#B07A1A',
      safeVerified: '#2D8A4E', infoVerified: '#4A7FBF', nearby: '#F5A623',
    };
    var CLUSTER_GRID_PX = 80;     // 클러스터 셀 크기(화면 px 기준)
    var CLUSTER_MAX_ZOOM = 17;    // 이 줌부터는 개별 마커
    var map = null, items = [], singles = [], shownSingles = [], clusterMks = [];
    var selectedIdx = -1, userMk = null, userPos = null, ready = false;

    function init() {
      if (map) return;
      if (typeof naver === 'undefined' || !naver.maps) { sendMsg({ type: 'error', reason: 'sdk' }); return; }
      map = new naver.maps.Map('map', {
        center: new naver.maps.LatLng(37.5665, 126.9780),
        zoom: 12,
        zoomControl: true,
        zoomControlOptions: { style: naver.maps.ZoomControlStyle.SMALL, position: naver.maps.Position.TOP_LEFT },
        scaleControl: false,
        mapDataControl: false,
      });
      naver.maps.Event.addListener(map, 'click', function() { setSelected(-1); sendMsg({ type: 'clearSheet' }); });
      naver.maps.Event.addListener(map, 'idle', render);
      ready = true;
      sendMsg({ type: 'ready' });
    }
    window.addEventListener('load', init);
    // SDK 가 끝내 안 올라오면 RN 쪽에서 안내를 띄운다
    setTimeout(function() { if (!ready) sendMsg({ type: 'error', reason: 'timeout' }); }, 15000);

    function dotEl(idx) {
      var el = singles[idx] && singles[idx].getElement();
      return el ? el.querySelector('.mk-dot') : null;
    }
    function setSelected(idx) {
      var prev = dotEl(selectedIdx);
      if (prev) prev.classList.remove('selected');
      selectedIdx = idx;
      var cur = dotEl(idx);
      if (cur) cur.classList.add('selected');
    }

    function getSingle(idx) {
      if (singles[idx]) return singles[idx];
      var m = items[idx];
      var fill = RISK_FILL[m.risk] || RISK_FILL.info;
      var user = !!m.isUserReport;
      var content = user
        ? '<div class="mk-dot" style="width:22px;height:22px;background:' + fill + ';border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:22px;text-align:center;">✍</div>'
        : '<div class="mk-dot" style="width:18px;height:18px;background:' + fill + '"></div>';
      var sz = user ? 22 : 18;
      var mk = new naver.maps.Marker({
        position: new naver.maps.LatLng(m.lat, m.lng),
        map: null,
        icon: { content: content, size: new naver.maps.Size(sz, sz), anchor: new naver.maps.Point(sz / 2, sz / 2) },
      });
      naver.maps.Event.addListener(mk, 'click', function() {
        setSelected(idx);
        sendMsg({ type: 'markerTap', data: { label: m.label, address: m.address, detail: m.detail, risk: m.risk, lat: m.lat, lng: m.lng } });
      });
      singles[idx] = mk;
      return mk;
    }

    // 클러스터: 흰 원 + 안에 든 식당의 위험도 비율 링 (색은 개별 마커와 같은 RISK_FILL)
    function clusterRing(sz, idxs) {
      var tally = {}, order = [];
      idxs.forEach(function(i) {
        var c = RISK_FILL[items[i].risk] || RISK_FILL.info;
        if (!tally[c]) { tally[c] = 0; order.push(c); }
        tally[c]++;
      });
      var sw = 6, r = sz / 2 - sw / 2, C = 2 * Math.PI * r, off = 0, h = '';
      order.forEach(function(c) {
        var len = C * tally[c] / idxs.length;
        h += '<circle cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r + '" fill="none" stroke="' + c +
             '" stroke-width="' + sw + '" stroke-dasharray="' + len + ' ' + (C - len) +
             '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + sz / 2 + ' ' + sz / 2 + ')"/>';
        off += len;
      });
      return '<svg width="' + sz + '" height="' + sz + '" style="position:absolute;left:0;top:0">' + h + '</svg>';
    }

    function clusterMarker(lat, lng, idxs) {
      var count = idxs.length;
      var sz = count < 10 ? 40 : (count < 30 ? 48 : 56);
      var mk = new naver.maps.Marker({
        position: new naver.maps.LatLng(lat, lng),
        map: map,
        icon: {
          content: '<div class="cluster-mk" style="position:relative;width:' + sz + 'px;height:' + sz + 'px;font-size:' + (sz < 48 ? 12 : 14) + 'px">' +
                   clusterRing(sz, idxs) + '<span style="position:relative">' + count + '</span></div>',
          size: new naver.maps.Size(sz, sz),
          anchor: new naver.maps.Point(sz / 2, sz / 2),
        },
      });
      naver.maps.Event.addListener(mk, 'click', function() {
        map.morph(new naver.maps.LatLng(lat, lng), Math.min(map.getZoom() + 2, 19));
      });
      return mk;
    }

    function render() {
      if (!map) return;
      var z = map.getZoom();
      var b = map.getBounds();
      var sw = b.getSW(), ne = b.getNE();
      var padLat = (ne.lat() - sw.lat()) * 0.25, padLng = (ne.lng() - sw.lng()) * 0.25;
      var minLat = sw.lat() - padLat, maxLat = ne.lat() + padLat;
      var minLng = sw.lng() - padLng, maxLng = ne.lng() + padLng;

      shownSingles.forEach(function(i) { if (singles[i]) singles[i].setMap(null); });
      shownSingles = [];
      clusterMks.forEach(function(c) { c.setMap(null); });
      clusterMks = [];

      var cell = 360 / Math.pow(2, z) * (CLUSTER_GRID_PX / 256);
      var groups = {};
      for (var i = 0; i < items.length; i++) {
        var m = items[i];
        if (m.lat < minLat || m.lat > maxLat || m.lng < minLng || m.lng > maxLng) continue;
        var key = z >= CLUSTER_MAX_ZOOM ? ('s' + i) : (Math.floor(m.lng / cell) + '_' + Math.floor(m.lat / cell));
        (groups[key] = groups[key] || []).push(i);
      }
      Object.keys(groups).forEach(function(k) {
        var g = groups[k];
        if (g.length < 2) {
          getSingle(g[0]).setMap(map);
          shownSingles.push(g[0]);
        } else {
          var la = 0, lo = 0;
          g.forEach(function(i) { la += items[i].lat; lo += items[i].lng; });
          clusterMks.push(clusterMarker(la / g.length, lo / g.length, g));
        }
      });
      if (selectedIdx >= 0) { var d = dotEl(selectedIdx); if (d) d.classList.add('selected'); }
    }

    // RN → WebView
    window.setMarkers = function(arr) {
      singles.forEach(function(mk) { if (mk) mk.setMap(null); });
      singles = []; shownSingles = []; selectedIdx = -1;
      items = arr || [];
      render();
    };
    window.setUser = function(lat, lng, center) {
      if (!map) return;
      userPos = new naver.maps.LatLng(lat, lng);
      if (userMk) userMk.setPosition(userPos);
      else userMk = new naver.maps.Marker({
        position: userPos, map: map, zIndex: 1000,
        icon: {
          content: '<div style="width:18px;height:18px;border-radius:50%;background:#4A7FBF;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
          size: new naver.maps.Size(18, 18), anchor: new naver.maps.Point(9, 9),
        },
      });
      document.getElementById('loc-btn').style.display = 'flex';
      if (center) { map.setCenter(userPos); map.setZoom(15); }
    };
    window.goUser = function() { if (map && userPos) { map.setCenter(userPos); map.setZoom(16); } };
  </script>
</body>
</html>`;
}

const RISK_KO = { safe: '안전(미검증)', caution: '요주의', danger: '고위험', info: '성분 확인 필요', unknown: '미확인', closed: '폐업', tempClosed: '임시휴업', safeVerified: '안전(관리자 확인)', infoVerified: '성분 투명(관리자 확인)', nearby: '근처맛집' };

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
  { key: 'safe',    label: '✓ 안전(미검증)' },
  { key: 'info',    label: 'ℹ 성분 확인 필요' },
  { key: 'caution', label: '! 요주의' },
  { key: 'danger',  label: '✗ 고위험' },
  { key: 'nearby',  label: '⭐ 근처맛집' },
];
const SHEET_H = 250;
const BRAND_STORE_PINS = false;

// ── 컴포넌트 ───────────────────────────────────────────────
export default function MapScreen({ lang, t, user }) {
  const [location, setLocation] = useState(null);
  const [locErr, setLocErr] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [mapDiag, setMapDiag] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
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
  const [mapQuery, setMapQuery] = useState('');
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const webviewRef = useRef(null);
  const brandIdsRef = useRef('');
  const centeredRef = useRef(false);
  const nearbyAtRef = useRef(null);
  const mapHtml = useMemo(() => buildMapHTML(NAVER_MAPS_CLIENT_ID), []);

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
      } else if (msg.type === 'ready') {
        setMapError(null);
        setMapLoaded(true);
      } else if (msg.type === 'diag') {
        setMapDiag(d => (d ? d + '\n' : '') + msg.text);
      } else if (msg.type === 'error') {
        setMapError(msg.reason || 'unknown');
      }
    } catch {}
  }

  // 위치 권한 + 현재 위치 — 지도는 위치를 기다리지 않고 먼저 뜬다.
  // 마지막으로 알려진 위치로 먼저 이동하고, 최신 위치가 오면 갱신한다.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { if (alive) setLocErr(true); return; }
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (alive && last) setLocation(last.coords);
        const cur = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise(resolve => setTimeout(() => resolve(null), 8000)),
        ]);
        if (alive && cur) setLocation(cur.coords);
        else if (alive && !last) setLocErr(true);
      } catch {
        if (alive) setLocErr(true);
      }
    })();
    return () => { alive = false; };
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
    const prev = nearbyAtRef.current;
    if (prev && Math.abs(prev.lat - location.latitude) < 0.005 && Math.abs(prev.lng - location.longitude) < 0.005) return;
    nearbyAtRef.current = { lat: location.latitude, lng: location.longitude };
    fetchNearbyHighRated(location.latitude, location.longitude).then(results => {
      setNearbyMarkers(results.map(p => ({
        lat: p.lat,
        lng: p.lng,
        risk: 'nearby',
        label: p.name,
        address: p.address,
        detail: `Google Maps 일반 평점 ${p.rating}/5 (리뷰 ${(p.userRatingsTotal || 0).toLocaleString()}개) · 땅콩 안전과는 무관한 평점이에요. 땅콩 정보 없음 — 방문 전 직접 확인하세요`,
      })));
    });
  }, [location]);

  // 네이버 API로 브랜드 매장 위치 조회 (전국) — brands 목록이 실제로 바뀔 때만 재조회
  useEffect(() => {
    if (!BRAND_STORE_PINS) return;   // 네이버 검색 API 키 문제로 현재 꺼 둠 (요청 실패만 반복됨). 대안이 정해지면 true
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
  }, [brands]);

  // ── 지도 검색: 앱 DB(식당·브랜드)를 즉시 검색 ──────────────
  const normQ = t => String(t || '').toLowerCase().replace(/[\s·()\-/]+/g, '');
  const q = normQ(mapQuery);
  const tokens = mapQuery.toLowerCase().split(/\s+/).map(normQ).filter(Boolean); // 단어별 모두 포함 (예: '강남 피자')
  const searchResults = q.length < 1 ? [] : [
    ...reviews.map(rv => {
      const d = rv[lang] || rv.ko || {};
      return { key: `r_${rv.id || d.name}`, name: d.name || '', sub: rv.address || rv.cuisineType || '', risk: effectiveRisk(rv),
        lat: rv.lat, lng: rv.lng, detail: d.review || '', hay: normQ(`${d.name} ${rv.cuisineType} ${rv.address}`) };
    }),
    ...brands.filter(b => b.ko && isSearchableBrand(b.ko.name)).map(b => {
      const d = b[lang] || b.ko;
      const store = brandMarkers.find(m => normQ(m.label).includes(normQ(b.ko.name)));
      return { key: `b_${b.id}`, name: d.name, sub: `${d.cat || '브랜드'} · 전국`, risk: b.risk,
        lat: store?.lat ?? null, lng: store?.lng ?? null, detail: d.reason || '', hay: normQ(`${d.name} ${d.cat}`) };
    }),
  ].filter(r => r.name && tokens.length > 0 && tokens.every(t => r.hay.includes(t)))
   .sort((a, b) => (normQ(a.name).startsWith(q) ? 0 : 1) - (normQ(b.name).startsWith(q) ? 0 : 1))
   .slice(0, 8);

  function pickResult(r) {
    Keyboard.dismiss();
    setMapQuery('');
    if (r.lat != null && r.lng != null) {
      webviewRef.current?.injectJavaScript(`try{map.setCenter(new naver.maps.LatLng(${r.lat},${r.lng}));map.setZoom(17);}catch(e){} true;`);
    }
    showSheet({ label: r.name, address: r.sub, detail: r.lat == null ? `${r.detail ? r.detail + '\n' : ''}📍 위치 정보가 아직 없어요` : r.detail, risk: r.risk, lat: r.lat, lng: r.lng });
  }

  const isDefaultSeoul = rv =>
    Math.abs(rv.lat - 37.5665) < 0.001 && Math.abs(rv.lng - 126.9780) < 0.001;

  const allMarkers = [
    ...reviews.filter(rv => rv.lat && rv.lng && !isDefaultSeoul(rv)).map(rv => {
      const d = rv[lang] || rv.ko;
      return { lat: rv.lat, lng: rv.lng, risk: effectiveRisk(rv), label: d?.name || '', detail: d?.review || '', address: rv.address || '' };
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

  const filteredMarkers = activeFilter ? allMarkers.filter(m => m.risk === activeFilter || (activeFilter === 'safe' && m.risk === 'safeVerified') || (activeFilter === 'info' && m.risk === 'infoVerified')) : allMarkers;

  // 지도에는 마커 데이터만 주입한다(지도 자체는 다시 로드하지 않음)
  const markersPayload = JSON.stringify(filteredMarkers.map(m => ({
    lat: m.lat, lng: m.lng, risk: m.risk || 'info',
    label: (m.label || '').substring(0, 40),
    address: (m.address || '').substring(0, 60),
    detail: (m.detail || '').substring(0, 80),
    isUserReport: !!m.isUserReport,
  })));
  useEffect(() => {
    if (!mapLoaded) return;
    webviewRef.current?.injectJavaScript(`try{window.setMarkers(${markersPayload});}catch(e){} true;`);
  }, [mapLoaded, markersPayload]);

  useEffect(() => {
    if (!mapLoaded || !location) return;
    const center = !centeredRef.current;
    centeredRef.current = true;
    webviewRef.current?.injectJavaScript(`try{window.setUser(${location.latitude},${location.longitude},${center});}catch(e){} true;`);
  }, [mapLoaded, location]);

  function reloadMap() {
    centeredRef.current = false;
    setMapLoaded(false);
    setMapError(null);
    setMapDiag('');
    setReloadKey(k => k + 1);
  }
  const mapErrorText = mapError === 'auth'
    ? '지도 인증에 실패했어요. 잠시 후 다시 시도해 주세요.'
    : '지도를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
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
          key={reloadKey}
          source={{ html: mapHtml, baseUrl: 'https://localhost' }}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          scalesPageToFit={false}
          onMessage={handleWebViewMessage}
          onError={e => { console.log('WebView error:', JSON.stringify(e.nativeEvent)); setMapError('network'); }}
          onHttpError={e => console.log('WebView http error:', JSON.stringify(e.nativeEvent))}
        />

        {!mapLoaded && !mapError && (
          <View style={styles.mapOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#E8704A" />
          </View>
        )}
        {!!mapError && (
          <View style={styles.mapOverlay}>
            <Text style={styles.mapErrText}>{mapErrorText}</Text>
            {!!mapDiag && <Text style={styles.mapDiagText}>{mapDiag.substring(0, 400)}</Text>}
            <TouchableOpacity style={styles.mapRetryBtn} onPress={reloadMap} activeOpacity={0.8}>
              <Text style={styles.mapRetryText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 검색창 (플로팅) */}
        <View style={styles.searchWrap} pointerEvents="box-none">
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={mapQuery}
              onChangeText={setMapQuery}
              placeholder="식당·브랜드 검색 (예: 교촌, 성수 샐러드)"
              placeholderTextColor="#999"
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="식당 또는 브랜드 검색"
            />
            {mapQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setMapQuery(''); Keyboard.dismiss(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="검색어 지우기">
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {mapQuery.trim().length > 0 && (
            <View style={styles.resultBox}>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
                {searchResults.map(r => {
                  const sc = SC[r.risk] || SC.unknown;
                  return (
                    <TouchableOpacity key={r.key} style={styles.resultRow} onPress={() => pickResult(r)} activeOpacity={0.7}>
                      <View style={[styles.resultBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.resultBadgeText, { color: sc.color }]}>{sc.icon} {RISK_KO[r.risk] || '미확인'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                        {!!r.sub && <Text style={styles.resultSub} numberOfLines={1}>{r.sub}</Text>}
                      </View>
                      {r.lat == null && <Text style={styles.resultNoLoc}>위치 없음</Text>}
                    </TouchableOpacity>
                  );
                })}
                {searchResults.length === 0 && (
                  <Text style={styles.resultEmpty}>앱에 등록된 곳이 없어요</Text>
                )}
                {mapQuery.trim().length >= 2 && (
                  <TouchableOpacity
                    style={styles.resultReport}
                    onPress={() => { Keyboard.dismiss(); setRecordInitial(null); setShowRecord(true); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.resultReportText}>✏️ 찾는 곳이 없나요? 장소를 검색해서 직접 기록하기</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </View>

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
        location={location}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8F5', paddingHorizontal: 32 },
  mapErrText: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 21, marginBottom: 14 },
  mapDiagText: { fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 14 },
  mapRetryBtn: { backgroundColor: '#E8704A', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 22 },
  mapRetryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF8E7', borderBottomWidth: 1, borderBottomColor: '#F5C842',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  warnText: { flex: 1, fontSize: 10, color: '#8B6914' },
  filterOverlay: {
    position: 'absolute', top: 62, left: 0, right: 0, zIndex: 10,
  },
  searchWrap: { position: 'absolute', top: 10, left: 12, right: 12, zIndex: 30 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 14,
    paddingHorizontal: 12, height: 44, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 5, elevation: 5,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 14, color: '#222', paddingVertical: 0 },
  searchClear: { fontSize: 15, color: '#888', paddingHorizontal: 4 },
  resultBox: {
    marginTop: 6, backgroundColor: 'white', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 5, elevation: 6,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F2EEE9',
  },
  resultBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  resultBadgeText: { fontSize: 11, fontWeight: '800' },
  resultName: { fontSize: 14, fontWeight: '700', color: '#222' },
  resultSub: { fontSize: 11, color: '#888', marginTop: 1 },
  resultNoLoc: { fontSize: 10, color: '#AAA' },
  resultEmpty: { paddingHorizontal: 14, paddingVertical: 14, fontSize: 13, color: '#888' },
  resultReport: { paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FFF8F3' },
  resultReportText: { fontSize: 12.5, fontWeight: '700', color: '#E8704A' },
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

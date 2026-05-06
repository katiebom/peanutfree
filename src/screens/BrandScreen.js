// src/screens/BrandScreen.js
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BrandSheet } from '../components/BottomSheet';
import { Badge, SrcBadge, WarnBox } from '../components/Common';
import ReportModal from '../components/ReportModal';
import UserSubmitModal from '../components/UserSubmitModal';
import { BRANDS as LOCAL_BRANDS, REVIEWS as LOCAL_REVIEWS } from '../data/database';
import { SC } from '../data/translations';
import { subscribeBrands, subscribeRestaurants, toggleLike } from '../firebase/dbService';
import { GOOGLE_PLACES_KEY } from '../config/keys';

const RISK_ORDER = { danger: 0, caution: 1, info: 2, safe: 3 };

// ── 네이버 장소 검색 (기록 모달용) ────────────────────────
async function searchNaverPlaces(query) {
  if (!GOOGLE_PLACES_KEY || !query.trim()) return [];
  try {
    const q = encodeURIComponent(query.trim() + ' 한국');
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&language=ko&key=${GOOGLE_PLACES_KEY}`
    );
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
    return (data.results || []).slice(0, 5).map(p => ({
      id: p.place_id,
      name: p.name,
      address: p.formatted_address,
      category: p.types?.[0] || '',
    }));
  } catch {
    return [];
  }
}

const GROUP_LABELS = {
  danger:  { ko: 'X  피해야 할 브랜드',         en: 'X  Brands to Avoid' },
  caution: { ko: '!  주의가 필요한 브랜드',      en: '!  Use with Caution' },
  info:    { ko: 'i  알레르기 정보 제공 브랜드', en: 'i  Allergy Info Provided' },
  safe:    { ko: 'OK 안전한 브랜드',             en: 'OK Safe Brands' },
};

// ── 브랜드+식당 통합 검색 & 기록 모달 ────────────────────
function BrandRecordModal({ visible, onClose, brands, restaurants, lang, t, user }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [naverResults, setNaverResults] = useState([]);
  const [naverLoading, setNaverLoading] = useState(false);
  const naverDebounce = useRef(null);

  function handleClose() {
    setSearch('');
    setSelected(null);
    setNaverResults([]);
    onClose();
  }

  // 브랜드 + LOCAL_REVIEWS + Firebase restaurants 통합 목록
  const localReviewNames = new Set(LOCAL_REVIEWS.map(r => (r.ko?.name || '').toLowerCase()));
  const allItems = [
    ...brands.map(b => ({ ...b, _type: 'brand' })),
    ...LOCAL_REVIEWS.filter(r => r.ko?.name).map(r => ({
      ...r,
      img: r.img || '🍽️',
      _type: 'restaurant',
    })),
    ...restaurants
      .filter(r => r.name && !localReviewNames.has(r.name.toLowerCase()))
      .map(r => ({
        id: r.id,
        ko: { name: r.name + (r.branch ? ' ' + r.branch : ''), cat: r.cuisineType || '식당' },
        img: '🍽️',
        risk: r.peanutRiskTier === 'low' ? 'safe'
            : r.peanutRiskTier === 'high' ? 'danger'
            : r.peanutRiskTier === 'medium' ? 'caution' : 'info',
        _type: 'restaurant',
      })),
  ];

  // 네이버 API 자동 검색 (debounce 600ms)
  useEffect(() => {
    if (naverDebounce.current) clearTimeout(naverDebounce.current);
    const q = search.trim();
    if (q.length < 2) { setNaverResults([]); return; }
    naverDebounce.current = setTimeout(async () => {
      setNaverLoading(true);
      const raw = await searchNaverPlaces(q);
      // Firebase/로컬에 이미 있는 이름 제외
      const localNames = new Set(allItems.map(item => {
        const d = item[lang] || item.ko;
        return (d?.name || '').toLowerCase();
      }));
      setNaverResults(raw.filter(r => !localNames.has(r.name.toLowerCase())));
      setNaverLoading(false);
    }, 600);
    return () => { if (naverDebounce.current) clearTimeout(naverDebounce.current); };
  }, [search]);

  const filtered = allItems
    .filter(item => {
      const d = item[lang] || item.ko;
      if (!d) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (d.name || '').toLowerCase().includes(q) || (d.cat || '').toLowerCase().includes(q);
    })
    .sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9));

  // 선택 후 → ReportModal로 전환
  if (selected) {
    const d = selected[lang] || selected.ko;
    return (
      <ReportModal
        visible={true}
        onClose={handleClose}
        target={{
          type: selected._type === 'brand' ? 'brand' : 'restaurant',
          id: selected.id,
          name: d.name,
          img: selected.img || '🍽️',
        }}
        user={user}
      />
    );
  }

  const totalCount = filtered.length + naverResults.length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={ms.wrap}>
        {/* 헤더 */}
        <View style={ms.header}>
          <Text style={ms.headerTitle}>{t.brandRecordModalTitle}</Text>
          <TouchableOpacity onPress={handleClose} style={ms.closeBtn}>
            <Text style={ms.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 검색 */}
        <View style={ms.searchWrap}>
          <Text style={ms.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.brandSearchPh}
            placeholderTextColor="#BBB"
            style={ms.searchInput}
            autoFocus
          />
          {naverLoading && <ActivityIndicator size="small" color="#4A7FBF" style={{ marginRight: 8 }} />}
          {search.length > 0 && !naverLoading && (
            <TouchableOpacity onPress={() => { setSearch(''); setNaverResults([]); }}>
              <Text style={ms.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={ms.hint}>
          {search
            ? t.brandSearchResultsFmt.replace('{n}', totalCount)
            : t.brandSearchHint}
        </Text>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ms.list}
          showsVerticalScrollIndicator={false}
        >
          {/* Firebase/로컬 결과 */}
          {filtered.map(item => {
            const d = item[lang] || item.ko;
            if (!d) return null;
            const s = SC[item.risk] || {};
            return (
              <TouchableOpacity
                key={String(item.id)}
                style={[ms.card, { borderLeftColor: s.color, borderLeftWidth: 4 }]}
                onPress={() => setSelected(item)}
                activeOpacity={0.7}
              >
                <Text style={ms.cardImg}>{item.img || '🍽️'}</Text>
                <View style={ms.cardBody}>
                  <Text style={ms.cardName}>{d.name}</Text>
                  <Text style={ms.cardCat}>{d.cat}</Text>
                </View>
                <View style={ms.cardRight}>
                  <Badge risk={item.risk} t={t} />
                  <Text style={[ms.typeTag, { backgroundColor: item._type === 'brand' ? '#EBF3FF' : '#F0F7F0', color: item._type === 'brand' ? '#4A7FBF' : '#4A8F5A' }]}>
                    {item._type === 'brand' ? t.brandTypeTag : t.restTypeTag}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* 네이버 외부 검색 결과 */}
          {naverResults.length > 0 && (
            <View style={ms.sectionHeader}>
              <Text style={ms.sectionTitle}>{t.externalResults}</Text>
            </View>
          )}
          {naverResults.map(place => (
            <TouchableOpacity
              key={place.id}
              style={[ms.card, { borderLeftColor: '#4A7FBF', borderLeftWidth: 4 }]}
              onPress={() => setSelected({
                id: `naver_${place.id}`,
                ko: { name: place.name, cat: place.category ? place.category.split('>').pop().trim() : '식당' },
                img: '🍽️',
                risk: 'info',
                _type: 'restaurant',
              })}
              activeOpacity={0.7}
            >
              <Text style={ms.cardImg}>🍽️</Text>
              <View style={ms.cardBody}>
                <Text style={ms.cardName}>{place.name}</Text>
                <Text style={ms.cardCat} numberOfLines={1}>{place.address}</Text>
              </View>
              <View style={ms.cardRight}>
                <Text style={[ms.typeTag, { backgroundColor: '#EBF3FF', color: '#4A7FBF' }]}>{t.externalTag}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* 검색했는데 아무것도 없음 */}
          {search.trim().length > 0 && !naverLoading && totalCount === 0 && (
            <View style={ms.empty}>
              <Text style={ms.emptyText}>{t.noSearchResult}</Text>
              <Text style={ms.emptyHint}>{t.brandDirectLogHint}</Text>
            </View>
          )}

          {/* 직접 이름으로 기록하기 — 검색어가 있으면 항상 표시 */}
          {search.trim().length >= 2 && !naverLoading && (
            <TouchableOpacity
              style={ms.directCard}
              onPress={() => setSelected({
                id: `custom_${Date.now()}`,
                ko: { name: search.trim(), cat: '식당/브랜드' },
                en: { name: search.trim(), cat: 'Restaurant/Brand' },
                img: '🍽️',
                risk: 'info',
                _type: 'restaurant',
              })}
              activeOpacity={0.7}
            >
              <Text style={ms.directCardIcon}>✏️</Text>
              <View style={ms.directCardBody}>
                <Text style={ms.directCardName}>{t.brandDirectLogFmt.replace('{name}', search.trim())}</Text>
                <Text style={ms.directCardHint}>{t.brandDirectLogHint}</Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// Google Places API 텍스트 검색 (브랜드 탭용)
async function searchGooglePlaces(query) {
  if (!GOOGLE_PLACES_KEY || !query.trim()) return [];
  try {
    const q = encodeURIComponent(query.trim() + ' 서울');
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&language=ko&key=${GOOGLE_PLACES_KEY}`;
    console.log('[Places Brand] 검색 쿼리:', query + ' 서울');
    const res = await fetch(url);
    const data = await res.json();
    console.log('[Places Brand] 응답 상태:', data.status, '/ 결과 수:', data.results?.length ?? 0);
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places Brand] API 에러:', data.status, data.error_message || '(메시지 없음)');
      return [];
    }
    return (data.results || []).slice(0, 5).map(p => ({
      placeId: p.place_id,
      name: p.name,
      address: p.formatted_address,
      rating: p.rating,
    }));
  } catch (e) {
    console.error('[Places Brand] fetch 에러:', e.message || e);
    return [];
  }
}

// ── 검색 결과 없음 안내 ────────────────────────────────────
function NoResultsHelp({ searchQuery, matchingRestaurant, onNavigate, t }) {
  const q = encodeURIComponent(searchQuery);

  return (
    <View style={ns.wrap}>
      <Text style={ns.icon}>🔍</Text>
      <Text style={ns.title}>{t.noResultsTitleFmt.replace('{name}', searchQuery)}</Text>
      <Text style={ns.sub}>{t.noResultsSub}</Text>

      <TouchableOpacity
        style={ns.btn}
        onPress={() => Linking.openURL(`https://www.google.com/search?q=${q}+알레르기+성분`)}
      >
        <Text style={ns.btnText}>{t.googleAllergySearch}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[ns.btn, ns.btnGray]}
        onPress={() => Linking.openURL(`https://www.google.com/search?q=${q}+공식사이트+알레르기`)}
      >
        <Text style={[ns.btnText, { color: '#444' }]}>{t.officialSiteSearch}</Text>
      </TouchableOpacity>

      {matchingRestaurant && onNavigate && (
        <TouchableOpacity style={[ns.btn, ns.btnTeal, { marginTop: 8 }]} onPress={() => onNavigate(matchingRestaurant)}>
          <Text style={ns.btnText}>{t.restTabLink}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── 메인 화면 ─────────────────────────────────────────────
export default function BrandScreen({ lang, t, user, onNavigateToRestaurant }) {
  const [brands, setBrands] = useState(LOCAL_BRANDS);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showRecord, setShowRecord] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [placesResults, setPlacesResults] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const placesDebounce = useRef(null);

  async function handleLike(item) {
    if (!user) { Alert.alert('로그인 필요', '좋아요는 로그인 후 가능합니다.'); return; }
    if (!item._isFirebase) { Alert.alert('', '이 항목은 아직 좋아요를 지원하지 않아요.'); return; }
    try { await toggleLike('brands', item.id, user.uid); } catch { /* silent */ }
  }

  useEffect(() => {
    const unsubscribe = subscribeBrands(data => {
      if (data.length > 0) {
        const fbIds = new Set(data.map(b => b.id));
        setBrands([
          ...data.map(b => ({ ...b, _isFirebase: true })),
          ...LOCAL_BRANDS.filter(b => !fbIds.has(b.id)),
        ]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeRestaurants(
      data => setRestaurants(data),
      err => console.warn('[BrandScreen] subscribeRestaurants 실패:', err.code, err.message),
    );
    return () => unsubscribe();
  }, []);

  // Google Places 보조 검색 (Firebase 브랜드 결과 < 3 일 때 자동 실행)
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setPlacesResults([]); return; }
    if (placesDebounce.current) clearTimeout(placesDebounce.current);
    placesDebounce.current = setTimeout(async () => {
      setPlacesLoading(true);
      const results = await searchGooglePlaces(q);
      setPlacesResults(results);
      setPlacesLoading(false);
    }, 700);
    return () => { if (placesDebounce.current) clearTimeout(placesDebounce.current); };
  }, [search]);

  const filtered = brands
    .filter(b => {
      const d = b[lang] || b.ko;
      if (!d) return false;
      const matchFilter = filter === 'all' || b.risk === filter;
      const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    })
    .sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9));

  // 검색어와 매칭되는 식당 DB 항목 (empty state용)
  const searchMatchingRestaurant = search.trim()
    ? restaurants.find(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  const FILTER_BTNS = [
    { key: 'all',     label: lang === 'ko' ? '전체' : 'All' },
    { key: 'danger',  label: lang === 'ko' ? 'X 위험' : 'X Danger' },
    { key: 'caution', label: lang === 'ko' ? '! 주의' : '! Caution' },
    { key: 'info',    label: lang === 'ko' ? 'i 정보' : 'i Info' },
    { key: 'safe',    label: lang === 'ko' ? 'OK 안전' : 'OK Safe' },
  ];

  const showPlaces = search.trim().length >= 2 && (placesLoading || placesResults.length > 0);
  const listHeader = (
    <View style={styles.headerWrap}>
      <WarnBox text={t.brandWarn} />

      {/* 버튼 행 */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.recordBtn, { flex: 1 }]} onPress={() => setShowRecord(true)}>
          <Text style={styles.recordBtnText}>{t.brandRecordBtnText}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submitBtn, { flex: 1 }]} onPress={() => setShowSubmit(true)}>
          <Text style={styles.submitBtnText}>🏪  브랜드 제보하기</Text>
          <Text style={styles.submitBtnSub}>이 브랜드도 DB에 추가해달라고 요청하기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={lang === 'ko' ? '브랜드명 검색...' : 'Search brand...'}
          placeholderTextColor="#BBB"
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>X</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTER_BTNS.map(f => {
          const active = filter === f.key;
          const s = SC[f.key] || {};
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterBtn,
                active && f.key === 'all' && styles.filterBtnAllActive,
                active && f.key !== 'all' && { backgroundColor: s.bg, borderColor: s.color },
              ]}
            >
              <Text style={[
                styles.filterText,
                active && f.key === 'all' && { color: 'white', fontWeight: '800' },
                active && f.key !== 'all' && { color: s.color, fontWeight: '800' },
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.count}>
        {lang === 'ko' ? '브랜드 ' : 'Brands '}
        <Text style={styles.countNum}>{filtered.length}</Text>
        {lang === 'ko' ? '개 · 위험도순' : ' · by risk'}
      </Text>

      {/* Google Places 외부 검색 결과 */}
      {showPlaces && (
        <View style={styles.placesFooter}>
          <View style={styles.placesFooterHeader}>
            <View style={styles.placesBadge}>
              <Text style={styles.placesBadgeText}>{t.externalResults}</Text>
            </View>
            {placesLoading && <ActivityIndicator size="small" color="#4A7FBF" style={{ marginLeft: 8 }} />}
          </View>
          {!placesLoading && placesResults.map(p => {
            const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.placeId}`;
            return (
              <View key={p.placeId} style={styles.placesCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.placesCardName}>{p.name}</Text>
                  <Text style={styles.placesCardAddr} numberOfLines={1}>{p.address}</Text>
                  {p.rating != null && <Text style={styles.placesCardRating}>⭐ {p.rating}</Text>}
                </View>
                <TouchableOpacity onPress={() => Linking.openURL(gmapsUrl)} style={styles.placesMapBtn}>
                  <Text style={styles.placesMapBtnText}>🗺️ 지도</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {!placesLoading && placesResults.length > 0 && (
            <Text style={styles.placesWarn}>{t.placesWarn}</Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#E8704A" />
          <Text style={styles.loadingText}>
            {lang === 'ko' ? '최신 정보 불러오는 중...' : 'Loading...'}
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={listHeader}
        renderItem={({ item, index }) => {
          const d = item[lang] || item.ko;
          if (!d) return null;
          const s = SC[item.risk] || {};
          const prevItem = filtered[index - 1];
          const showGroup = filter === 'all' && (!prevItem || prevItem.risk !== item.risk);
          const groupLabel = GROUP_LABELS[item.risk]?.[lang] || '';
          const linkedRestaurant = restaurants.find(
            r => r.name.toLowerCase() === (d.name || '').toLowerCase()
          );

          const likes = item.likes || [];
          const isLiked = user && likes.includes(user.uid);
          const likeCount = likes.length;

          return (
            <View>
              {showGroup && (
                <View style={[styles.groupHeader, { backgroundColor: s.bg }]}>
                  <Text style={[styles.groupText, { color: s.color }]}>
                    {groupLabel}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.card, { borderLeftColor: s.color, borderLeftWidth: 4 }]}
                onPress={() => setSelected(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardImg}>{item.img}</Text>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{d.name}</Text>
                  <Text style={styles.cardCat}>{d.cat}</Text>
                  {d.reason && (
                    <Text style={styles.cardReason} numberOfLines={1}>{d.reason}</Text>
                  )}
                  <TouchableOpacity onPress={() => handleLike(item)} style={styles.likeBtn} activeOpacity={0.7}>
                    <Text style={styles.likeBtnText}>{isLiked ? '❤️' : '🤍'} {likeCount > 0 ? likeCount : '도움돼요'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.cardRight}>
                  <Badge risk={item.risk} t={t} />
                  <SrcBadge src={item.src} t={t} />
                </View>
              </TouchableOpacity>
              {linkedRestaurant && onNavigateToRestaurant && (
                <TouchableOpacity
                  style={styles.crossTabBanner}
                  onPress={() => onNavigateToRestaurant(linkedRestaurant)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.crossTabText}>{t.viewInRestTab}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() =>
          search.trim().length > 0 ? (
            <NoResultsHelp
              searchQuery={search.trim()}
              matchingRestaurant={searchMatchingRestaurant}
              onNavigate={onNavigateToRestaurant}
              t={t}
            />
          ) : null
        }
      />

      <BrandSheet item={selected} lang={lang} t={t} user={user} onClose={() => setSelected(null)} />

      <BrandRecordModal
        visible={showRecord}
        onClose={() => setShowRecord(false)}
        brands={brands}
        restaurants={restaurants}
        lang={lang}
        t={t}
        user={user}
      />
      <UserSubmitModal
        visible={showSubmit}
        onClose={() => setShowSubmit(false)}
        type="brand"
        user={user}
      />
    </View>
  );
}

// ── 스타일: NoResultsHelp ─────────────────────────────────
const ns = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '900', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: 13, color: '#888', marginBottom: 16, textAlign: 'center' },
  btn: {
    width: '100%', backgroundColor: '#E8704A', borderRadius: 12,
    padding: 15, alignItems: 'center', marginBottom: 10,
  },
  btnGray: { backgroundColor: '#F0EDE8' },
  btnTeal: { backgroundColor: '#2D8A4E' },
  btnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  // Places 결과
  placesSection: { width: '100%', marginBottom: 12 },
  placesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  placesBadge: { backgroundColor: '#EBF3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  placesBadgeText: { fontSize: 11, fontWeight: '800', color: '#4A7FBF' },
  placesCard: {
    width: '100%', backgroundColor: '#F5F8FF', borderRadius: 12,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#C5DFF8',
  },
  placesCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  placesName: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  placesAddr: { fontSize: 11, color: '#777' },
  placesRating: { fontSize: 11, color: '#888', marginTop: 2 },
  placesWarn: { fontSize: 11, color: '#B26A00', marginBottom: 8 },
  gmapsBtn: {
    backgroundColor: 'white', borderRadius: 8, borderWidth: 1,
    borderColor: '#C5DFF8', paddingVertical: 8, alignItems: 'center',
  },
  gmapsBtnText: { fontSize: 12, color: '#4A7FBF', fontWeight: '700' },
});

// ── 스타일: BrandRecordModal ──────────────────────────────
const ms = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 24,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  closeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: '#666' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAF8F5', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#EEE',
    paddingHorizontal: 14, margin: 16, marginBottom: 4,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#333' },
  clearBtn: { fontSize: 13, color: '#BBB', paddingLeft: 8 },
  hint: { fontSize: 11, color: '#BBB', paddingHorizontal: 16, marginBottom: 6 },
  list: { padding: 13, paddingBottom: 40 },
  card: {
    backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImg: { fontSize: 28, flexShrink: 0 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '900', color: '#1A1A1A' },
  cardCat: { fontSize: 11, color: '#BBB', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  typeTag: { fontSize: 9, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, color: '#999', fontWeight: '700' },
  emptyHint: { fontSize: 12, color: '#CCC', marginTop: 4 },
  sectionHeader: {
    backgroundColor: '#EBF3FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 8, marginTop: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#4A7FBF' },
  directCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF8F5', borderRadius: 14, padding: 14,
    marginTop: 8,
    borderWidth: 1.5, borderColor: '#E8704A', borderStyle: 'dashed',
  },
  directCardIcon: { fontSize: 24, flexShrink: 0 },
  directCardBody: { flex: 1 },
  directCardName: { fontSize: 14, fontWeight: '800', color: '#E8704A' },
  directCardHint: { fontSize: 11, color: '#BBB', marginTop: 2 },
});

// ── 스타일: BrandScreen ───────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  loadingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EBF3FF', padding: 8, paddingHorizontal: 14,
  },
  loadingText: { fontSize: 11, color: '#4A7FBF' },
  headerWrap: { paddingBottom: 4 },
  btnRow: { flexDirection: 'row', gap: 8, marginHorizontal: 13, marginBottom: 10 },
  recordBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    padding: 13, alignItems: 'center',
  },
  recordBtnText: { color: 'white', fontSize: 13, fontWeight: '800' },
  submitBtn: {
    backgroundColor: '#4A7FBF', borderRadius: 12,
    padding: 13, alignItems: 'center',
  },
  submitBtnText: { color: 'white', fontSize: 13, fontWeight: '800' },
  submitBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 2 },
  likeBtn: { marginTop: 5, alignSelf: 'flex-start' },
  likeBtnText: { fontSize: 12, color: '#888' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#EEE',
    paddingHorizontal: 12, marginHorizontal: 13, marginBottom: 8,
  },
  searchIcon: { fontSize: 13, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: '#333' },
  clearBtn: { fontSize: 13, color: '#BBB', paddingLeft: 8 },
  filterRow: { paddingHorizontal: 13, gap: 8, marginBottom: 8 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#EEE',
    backgroundColor: 'white',
  },
  filterBtnAllActive: { backgroundColor: '#E8704A', borderColor: '#E8704A' },
  filterText: { fontSize: 12, color: '#999' },
  count: { fontSize: 11, color: '#999', paddingHorizontal: 13, marginBottom: 6 },
  countNum: { fontWeight: '800', color: '#333', fontSize: 13 },
  groupHeader: {
    marginHorizontal: 13, marginTop: 14, marginBottom: 6,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  groupText: { fontSize: 13, fontWeight: '800' },
  list: { paddingTop: 8, paddingBottom: 24 },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 13, marginBottom: 8,
    borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImg: { fontSize: 30, flexShrink: 0 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '900', color: '#1A1A1A', marginBottom: 2 },
  cardCat: { fontSize: 11, color: '#BBB', marginBottom: 3 },
  cardReason: { fontSize: 11, color: '#777' },
  cardRight: { alignItems: 'flex-end', gap: 5 },
  crossTabBanner: {
    marginHorizontal: 13, marginTop: -4, marginBottom: 8,
    backgroundColor: '#EBF5FF', borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#C5DFF8',
  },
  crossTabText: { fontSize: 12, color: '#2A6FA8', fontWeight: '700' },
  // Places 푸터 (브랜드 1-2개 있을 때)
  placesFooter: { marginHorizontal: 13, marginTop: 4, marginBottom: 16 },
  placesFooterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  placesBadge: { backgroundColor: '#EBF3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  placesBadgeText: { fontSize: 11, fontWeight: '800', color: '#4A7FBF' },
  placesCard: {
    backgroundColor: '#F5F8FF', borderRadius: 12, padding: 12, marginBottom: 7,
    borderWidth: 1, borderColor: '#C5DFF8',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  placesCardName: { fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  placesCardAddr: { fontSize: 11, color: '#777' },
  placesCardRating: { fontSize: 11, color: '#888', marginTop: 2 },
  placesMapBtn: {
    backgroundColor: 'white', borderRadius: 8, borderWidth: 1,
    borderColor: '#C5DFF8', paddingVertical: 7, paddingHorizontal: 10,
  },
  placesMapBtnText: { fontSize: 11, color: '#4A7FBF', fontWeight: '700' },
  placesWarn: { fontSize: 11, color: '#B26A00', marginTop: 2 },
});

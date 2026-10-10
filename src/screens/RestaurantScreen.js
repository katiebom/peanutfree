// src/screens/RestaurantScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Linking
} from 'react-native';
import { subscribeReviews, addReview, subscribeRestaurants, addRestaurant } from '../firebase/dbService';
import RestaurantDetailScreen from './RestaurantDetailScreen';
import { REVIEWS as LOCAL_REVIEWS, BRANDS as LOCAL_BRANDS } from '../data/database';
import { Badge, WarnBox } from '../components/Common';
import { RestaurantSheet, BrandSheet } from '../components/BottomSheet';
import { SC } from '../data/translations';
import { GOOGLE_PLACES_KEY } from '../config/keys';
import ReportModal from '../components/ReportModal';
import QuickSafetyReport from '../components/QuickSafetyReport';

import { CUISINE_EMOJI, CUISINE_TYPES, inferCuisine } from '../utils/inferCuisine';
import { tierToRisk, effectiveRisk } from '../utils/risk';

// ── 음식 종류 고정 목록 ────────────────────────────────────
// 정의는 src/utils/inferCuisine.js. 기존 import 경로 호환을 위해 여기서 재수출한다.
export { CUISINE_EMOJI, CUISINE_TYPES };

async function searchPlaces(query) {
  if (!GOOGLE_PLACES_KEY || !query.trim()) return [];
  try {
    const q = encodeURIComponent(query.trim() + ' 한국');
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&language=ko&key=${GOOGLE_PLACES_KEY}`
    );
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
    return (data.results || []).slice(0, 8).map(p => ({
      id: p.place_id,
      name: p.name,
      address: p.formatted_address,
      category: p.types?.[0] || '',
      lat: p.geometry?.location?.lat ?? null,
      lng: p.geometry?.location?.lng ?? null,
    }));
  } catch {
    return [];
  }
}

// 주소에서 시/도 추출
function extractRegion(address) {
  if (!address) return '기타';
  const a = address.trim();
  // 서울 내 주요 동네 먼저 체크
  const seoulAreas = [
    ['성수', '성수'], ['한남', '한남'], ['망원', '망원'],
    ['홍대', '홍대'], ['이태원', '이태원'], ['신촌', '신촌'],
    ['강남', '강남'], ['역삼', '강남'], ['삼성', '강남'], ['논현', '강남'],
    ['신사', '압구정/신사'], ['압구정', '압구정/신사'],
    ['종로', '종로'], ['광화문', '종로'], ['인사동', '종로'],
    ['명동', '명동/중구'], ['충무로', '명동/중구'],
    ['여의도', '여의도'], ['마포', '마포'], ['합정', '합정'],
    ['용산', '용산'], ['이촌', '용산'],
    ['건대', '건대/뚝섬'], ['뚝섬', '건대/뚝섬'],
  ];
  if (a.startsWith('서울') || a.includes('서울')) {
    for (const [keyword, label] of seoulAreas) {
      if (a.includes(keyword)) return label;
    }
    return '서울 기타';
  }
  // 전국 체인/기타 도시
  const cityMap = [
    ['부산', '부산'], ['대구', '대구'], ['인천', '인천'], ['광주', '광주'],
    ['대전', '대전'], ['울산', '울산'], ['세종', '세종'], ['경기', '경기'],
    ['강원', '강원'], ['충청북', '충북'], ['충북', '충북'],
    ['충청남', '충남'], ['충남', '충남'], ['전라북', '전북'],
    ['전북', '전북'], ['전라남', '전남'], ['전남', '전남'],
    ['경상북', '경북'], ['경북', '경북'], ['경상남', '경남'],
    ['경남', '경남'], ['제주', '제주'],
  ];
  for (const [prefix, label] of cityMap) {
    if (a.startsWith(prefix)) return label;
  }
  return a.split(' ')[0] || '기타';
}

// 데이터 구조 방어적 파싱 (nested ko/en 또는 flat 모두 처리)
function getDisplay(item, lang) {
  return item[lang] || item.ko || item.en || {
    name: item.name || '',
    cat: item.cat || '',
    review: item.review || '',
    tags: [],
  };
}

// Google Places API 텍스트 검색
async function searchGooglePlaces(query) {
  if (!GOOGLE_PLACES_KEY || !query.trim()) return [];
  try {
    const q = encodeURIComponent(query.trim() + ' 서울');
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&language=ko&key=${GOOGLE_PLACES_KEY}`;
    console.log('[Places] 검색 쿼리:', query + ' 서울');
    const res = await fetch(url);
    const data = await res.json();
    console.log('[Places] 응답 상태:', data.status, '/ 결과 수:', data.results?.length ?? 0);
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places] API 에러:', data.status, data.error_message || '(메시지 없음)');
      return [];
    }
    return (data.results || []).slice(0, 6).map(p => ({
      placeId: p.place_id,
      name: p.name,
      address: p.formatted_address,
      rating: p.rating,
      userRatingsTotal: p.user_ratings_total,
      types: p.types || [],
    }));
  } catch (e) {
    console.error('[Places] fetch 에러:', e.message || e);
    return [];
  }
}

// Google Places 주소에서 구 추출
function extractDistrictFromAddress(address) {
  if (!address) return '';
  const match = address.match(/([가-힣]+구)/);
  if (match) return match[1];
  return address.split(' ').slice(0, 2).join(' ');
}

// ── Places 결과 카드 ───────────────────────────────────────
function PlacesCard({ place, onTap }) {
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.placeId}`;
  return (
    <TouchableOpacity style={styles.placesCard} onPress={onTap} activeOpacity={0.7}>
      <View style={styles.placesCardTop}>
        <View style={styles.placesCardLeft}>
          <Text style={styles.placesCardName}>{place.name}</Text>
          <Text style={styles.placesCardAddr} numberOfLines={1}>{place.address}</Text>
          {place.rating != null && (
            <Text style={styles.placesCardRating}>
              ⭐ {place.rating}{place.userRatingsTotal ? ` (${place.userRatingsTotal.toLocaleString()}명)` : ''}
              <Text style={styles.googleAttribution}>  ·  Google Maps</Text>
            </Text>
          )}
        </View>
        <View style={styles.placesUnknownBadge}>
          <Text style={styles.placesUnknownText}>정보없음</Text>
        </View>
      </View>
      <Text style={styles.placesWarn}>🥜 땅콩 정보 없음 — 방문 전 직접 확인하세요</Text>
      <View style={styles.placesActions}>
        <TouchableOpacity
          style={styles.gmapsBtn}
          onPress={() => Linking.openURL(gmapsUrl)}
        >
          <Text style={styles.gmapsBtnText}>🗺️ 구글맵에서 보기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addDbBtn} onPress={onTap}>
          <Text style={styles.addDbBtnText}>+ 앱에 추가</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── 메인 화면 ──────────────────────────────────────────────
export default function RestaurantScreen({ lang, t, user, initialRestaurant, onClearInitial }) {
  const [reviews, setReviews] = useState(LOCAL_REVIEWS);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [showWrite, setShowWrite] = useState(false);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('전체');
  const [cuisine, setCuisine] = useState('전체');
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [placesResults, setPlacesResults] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const placesDebounce = useRef(null);
  const [recordTarget, setRecordTarget] = useState(null);
  const [safeOnly, setSafeOnly] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeRestaurants(
      data => setRestaurants(data),
      err => console.warn('[RestaurantScreen] subscribeRestaurants 실패:', err.code, err.message),
    );
    return () => unsubscribe();
  }, []);

  // 브랜드 탭에서 넘어온 경우 자동으로 상세 열기
  useEffect(() => {
    if (initialRestaurant) {
      setSelectedRestaurant(initialRestaurant);
      if (onClearInitial) onClearInitial();
    }
  }, [initialRestaurant]);

  // Google Places 보조 검색 (Firebase 결과 < 3 일 때 자동 실행)
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setPlacesResults([]); return; }
    if (placesDebounce.current) clearTimeout(placesDebounce.current);
    placesDebounce.current = setTimeout(async () => {
      setPlacesLoading(true);
      const raw = await searchGooglePlaces(q);
      // Firebase에 완전히 동일한 이름+지점명이 있는 경우만 제외
      const deduped = raw.filter(p => {
        const pName = p.name.toLowerCase();
        return !restaurants.some(r => {
          const rName = r.name.toLowerCase();
          const rBranch = (r.branch || '').toLowerCase();
          const rFull = rBranch ? `${rName} ${rBranch}` : rName;
          return pName === rFull || pName === rName;
        });
      });
      setPlacesResults(deduped);
      setPlacesLoading(false);
    }, 700);
    return () => { if (placesDebounce.current) clearTimeout(placesDebounce.current); };
  }, [search]);

  async function saveFromPlaces(place) {
    if (!user?.uid) { Alert.alert('로그인이 필요합니다.'); return; }
    try {
      await addRestaurant({
        name: place.name,
        branch: '',
        district: extractDistrictFromAddress(place.address),
        address: place.address,
        cuisineType: inferCuisine({ name: place.name, hints: place.types }),
        peanutRiskTier: 'unknown',
        allergyGuidanceLikelihood: '',
        whyFlagged: '',
        recommendedAction: '',
        peanutHandlingBasis: '',
        recommendedSaferItems: '',
        cautionOrExclusion: '',
        confidence: 'low',
        isVerified: false,
        // 구글 약관상 저장 가능한 건 place_id뿐 — 평점은 저장하지 않고 지도 링크로 본다
        placeId: place.placeId,
      }, user.uid);
      setPlacesResults(prev => prev.filter(p => p.placeId !== place.placeId));
      Alert.alert('추가 완료! ✅', `"${place.name}"이(가) 앱에 추가됐어요.\n다른 사용자가 알레르기 정보를 기록할 수 있어요.`);
    } catch {
      Alert.alert('오류', '추가 중 문제가 생겼어요. 다시 시도해주세요.');
    }
  }

  function handlePlacesTap(place) {
    Alert.alert(
      '이 식당 정보를 앱에 추가할까요?',
      `${place.name}\n${place.address}\n\n추가하면 다른 알레르기 사용자들이 정보를 기록할 수 있어요.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '추가하기', onPress: () => saveFromPlaces(place) },
      ]
    );
  }

  useEffect(() => {
    const unsubscribe = subscribeReviews(data => {
      // Firebase 데이터와 로컬 데이터 병합 (Firebase 우선, 로컬은 중복 제외)
      const fbNames = new Set(data.map(r => r.ko?.name || r.name || ''));
      const localOnly = LOCAL_REVIEWS.filter(r => !fbNames.has(r.ko?.name || ''));
      const merged = [...data, ...localOnly];
      setReviews(merged.length > 0 ? merged : LOCAL_REVIEWS);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 지역 목록 (데이터에 있는 것만)
  const regions = ['전체', ...Array.from(
    new Set(reviews.map(r => extractRegion(r.address)).filter(Boolean))
  ).sort()];

  const filtered = reviews.filter(item => {
    const d = getDisplay(item, lang);
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (d.name || '').toLowerCase().includes(q) ||
      (item.address || '').toLowerCase().includes(q) ||
      (d.cat || '').toLowerCase().includes(q);
    const matchRegion = region === '전체' || extractRegion(item.address) === region;
    const matchCuisine = cuisine === '전체' || (item.cuisineType || '기타') === cuisine;
    return matchSearch && matchRegion && matchCuisine;
  });

  // 안전 DB 검색 필터
  const filteredRestaurantsDB = restaurants.filter(r => {
    if (!search.trim() && !safeOnly) return true;
    const q = search.toLowerCase();
    const matchSearch = !search.trim() || (
      (r.name || '').toLowerCase().includes(q) ||
      (r.district || '').toLowerCase().includes(q) ||
      (r.cuisineType || '').toLowerCase().includes(q)
    );
    const tier = (r.peanutRiskTier || '').toLowerCase();
    const matchSafe = !safeOnly || tier === 'low';
    return matchSearch && matchSafe;
  });

  // 검색어로 브랜드도 검색 (식당 탭에서 브랜드도 보이도록)
  const matchingBrands = search.length > 0
    ? LOCAL_BRANDS.filter(b => {
        const d = b[lang] || b.ko;
        const q = search.toLowerCase();
        return d && ((d.name || '').toLowerCase().includes(q) || (d.cat || '').toLowerCase().includes(q));
      })
    : [];

  const restListHeader = (
          <View>
            <WarnBox text={t.restWarn} />
            <TouchableOpacity style={styles.writeBtn} onPress={() => setShowWrite(true)}>
              <Text style={styles.writeBtnText}>{t.restReportBtn}</Text>
            </TouchableOpacity>

            {/* 검색 */}
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t.restSearchPh}
                placeholderTextColor="#BBB"
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={styles.clearBtn}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 지역 필터 탭 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.regionRow}
            >
              {regions.map(r => {
                const active = region === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRegion(r)}
                    style={[styles.regionBtn, active && styles.regionBtnActive]}
                  >
                    <Text style={[styles.regionText, active && styles.regionTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 음식 종류 필터 탭 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.regionRow}
            >
              {['전체', ...CUISINE_TYPES].map(c => {
                const active = cuisine === c;
                const emoji = CUISINE_EMOJI[c] || '';
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCuisine(c)}
                    style={[styles.cuisineBtn, active && styles.cuisineBtnActive]}
                  >
                    <Text style={[styles.cuisineText, active && styles.cuisineTextActive]}>
                      {emoji ? `${emoji} ` : ''}{c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 안전한 곳만 보기 필터 */}
            <TouchableOpacity
              style={[styles.safeOnlyBtn, safeOnly && styles.safeOnlyBtnActive]}
              onPress={() => setSafeOnly(v => !v)}
            >
              <Text style={[styles.safeOnlyText, safeOnly && styles.safeOnlyTextActive]}>
                {t.safeOnlyFilter}
              </Text>
            </TouchableOpacity>

            <Text style={styles.count}>
              {t.restCountFmt.replace('{n}', filtered.length)}
              {region !== '전체' && <Text style={styles.countRegion}> · {region}</Text>}
              {cuisine !== '전체' && <Text style={styles.countRegion}> · {CUISINE_EMOJI[cuisine]} {cuisine}</Text>}
            </Text>

            {/* 검색 시 브랜드 결과 표시 */}
            {matchingBrands.length > 0 && (
              <View style={styles.brandSection}>
                <Text style={styles.brandSectionTitle}>{t.relatedBrandsFmt.replace('{n}', matchingBrands.length)}</Text>
                {matchingBrands.map(brand => {
                  const d = brand[lang] || brand.ko;
                  const s = SC[brand.risk] || {};
                  return (
                    <TouchableOpacity
                      key={brand.id}
                      style={[styles.brandCard, { borderLeftColor: s.color, borderLeftWidth: 4 }]}
                      onPress={() => setSelectedBrand(brand)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.brandCardImg}>{brand.img}</Text>
                      <View style={styles.brandCardBody}>
                        <Text style={styles.brandCardName}>{d.name}</Text>
                        <Text style={styles.brandCardCat}>{d.cat}</Text>
                        {d.reason && <Text style={styles.brandCardReason} numberOfLines={1}>{d.reason}</Text>}
                      </View>
                      <Badge risk={effectiveRisk(brand)} t={t} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 식당 안전 데이터베이스 + Google Places 통합 섹션 */}
            {(search.trim().length >= 2 || safeOnly || filteredRestaurantsDB.length > 0) && (
              <View style={styles.dbSection}>
                {search.trim().length >= 2 && (
                  <View style={styles.dbGroupRow}>
                    <View style={styles.dbRegisteredBadge}>
                      <Text style={styles.dbRegisteredBadgeText}>{t.registeredInfo}</Text>
                    </View>
                    {filteredRestaurantsDB.length > 0 && (
                      <Text style={styles.dbGroupCount}>{filteredRestaurantsDB.length}개</Text>
                    )}
                  </View>
                )}

                {search.trim().length < 2 && (
                  <Text style={styles.dbSectionTitle}>
                    {t.restSafeDBFmt.replace('{n}', filteredRestaurantsDB.length)}
                  </Text>
                )}

                {filteredRestaurantsDB.length > 0 ? (
                  filteredRestaurantsDB.map(r => {
                    const riskKey = tierToRisk(r.peanutRiskTier);
                    const { color: riskColor, bg: riskBg, icon: riskIcon } = SC[riskKey];
                    const riskLabel = `${riskIcon} ${t[riskKey]}`;
                    const emoji = CUISINE_EMOJI[r.cuisineType || '기타'] || '🍽️';
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.dbCard, { borderLeftColor: riskColor }]}
                        onPress={() => setSelectedRestaurant(r)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.dbCardTop}>
                          <View style={styles.dbCardLeft}>
                            <Text style={styles.dbCardName}>{r.name}{r.branch ? ` (${r.branch})` : ''}</Text>
                            <Text style={styles.dbCardSub}>
                              {emoji} {r.cuisineType || '기타'}{r.district ? ` · 📍 ${r.district}` : ''}
                            </Text>
                          </View>
                          <View style={[styles.dbRiskBadge, { backgroundColor: riskBg }]}>
                            <Text style={[styles.dbRiskText, { color: riskColor }]}>{riskLabel}</Text>
                          </View>
                        </View>
                        {r.recommendedAction ? (
                          <Text style={styles.dbCardNote} numberOfLines={1}>{r.recommendedAction}</Text>
                        ) : r.whyFlagged ? (
                          <Text style={styles.dbCardNote} numberOfLines={1}>{r.whyFlagged}</Text>
                        ) : null}
                        <TouchableOpacity
                          style={styles.checkInBtn}
                          onPress={(e) => { e.stopPropagation?.(); setCheckInTarget(r); }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.checkInBtnText}>{t.checkInBtn}</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })
                ) : search.trim().length >= 2 ? (
                  <Text style={styles.dbEmptyText}>{t.noRegisteredInfo}</Text>
                ) : null}

                {/* Google Places 외부 결과 — 항상 표시 */}
                {search.trim().length >= 2 && (
                  <>
                    <View style={styles.dbGroupDivider} />
                    <View style={styles.dbGroupRow}>
                      <View style={styles.dbPlacesBadge}>
                        <Text style={styles.dbPlacesBadgeText}>{t.externalResults}</Text>
                      </View>
                      {placesLoading && (
                        <ActivityIndicator size="small" color="#4A7FBF" style={{ marginLeft: 8 }} />
                      )}
                    </View>
                    {!placesLoading && placesResults.length > 0 ? (
                      placesResults.map(p => (
                        <PlacesCard key={p.placeId} place={p} onTap={() => handlePlacesTap(p)} />
                      ))
                    ) : !placesLoading ? (
                      <Text style={styles.dbEmptyText}>{t.noExternalResults}</Text>
                    ) : null}
                  </>
                )}

                {/* 직접 이름으로 기록하기 — 검색어가 있으면 항상 표시 */}
                {search.trim().length >= 2 && (
                  <TouchableOpacity
                    style={styles.directCard}
                    onPress={() => setRecordTarget({
                      type: 'restaurant',
                      id: `custom_${Date.now()}`,
                      name: search.trim(),
                      img: '🍽️',
                    })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.directCardIcon}>✏️</Text>
                    <View style={styles.directCardBody}>
                      <Text style={styles.directCardName}>{t.directLogRestFmt.replace('{name}', search.trim())}</Text>
                      <Text style={styles.directCardHint}>{t.directLogRestHint}</Text>
                    </View>
                  </TouchableOpacity>
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
          <Text style={styles.loadingText}>{t.loadingLatest}</Text>
        </View>
      )}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={restListHeader}
        renderItem={({ item }) => {
          const d = getDisplay(item, lang);
          const name = d.name || '(이름 없음)';
          const cat = d.cat || '';
          const review = d.review || '';
          return (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.7}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <View style={styles.cardNameRow}>
                    <Text style={styles.cardName}>{name}</Text>
                    <View style={styles.cuisineTag}>
                      <Text style={styles.cuisineTagText}>
                        {CUISINE_EMOJI[item.cuisineType || '기타']} {item.cuisineType || '기타'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardSub}>{cat}{cat && item.address ? ' · ' : ''}{item.address || ''}</Text>
                </View>
                <Badge risk={effectiveRisk(item)} t={t} />
              </View>
              {item.isBrandException && (
                <Text style={styles.exceptionLabel}>⚠️  {t.brandEx}</Text>
              )}
              <Text style={styles.review} numberOfLines={2}>{review}</Text>
              <Text style={styles.meta}>
                {'★'.repeat(item.rating || 0)}{'☆'.repeat(5 - (item.rating || 0))}  ·  {item.author || '익명'}  ·  {item.date || ''}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {search || region !== '전체' ? t.noSearchResult : t.noRestReported}
              </Text>
              <Text style={styles.emptySub}>{t.firstReportPrompt}</Text>
            </View>
          )
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        extraData={[placesResults, placesLoading, filteredRestaurantsDB.length]}
      />
      <RestaurantSheet item={selected} lang={lang} t={t} user={user} onClose={() => setSelected(null)} />
      <BrandSheet item={selectedBrand} lang={lang} t={t} user={user} onClose={() => setSelectedBrand(null)} />
      <RestaurantDetailScreen
        item={selectedRestaurant}
        visible={!!selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
        user={user}
        lang={lang}
      />
      <WriteReviewModal
        visible={showWrite}
        onClose={() => setShowWrite(false)}
        lang={lang}
        t={t}
        user={user}
      />
      <ReportModal
        visible={!!recordTarget}
        onClose={() => setRecordTarget(null)}
        target={recordTarget || { type: 'restaurant', id: '', name: '', img: '🍽️' }}
        user={user}
      />
      <QuickSafetyReport
        visible={!!checkInTarget}
        restaurant={checkInTarget}
        user={user}
        lang={lang}
        t={t}
        onClose={() => setCheckInTarget(null)}
      />
    </View>
  );
}

// ── 리뷰 작성 모달 ─────────────────────────────────────────
function WriteReviewModal({ visible, onClose, lang, t, user }) {
  const [form, setForm] = useState({
    name: '', address: '', cat: '', risk: 'safe',
    review: '', rating: 5, author: '', lat: null, lng: null,
    cuisineType: inferCuisine({}),
  });
  // 사용자가 음식 종류 칩을 직접 고르기 전까지는 카테고리/이름에서 자동 추론한다
  const [cuisineTouched, setCuisineTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const debounceTimer = useRef(null);

  function reset() {
    setForm({ name:'', address:'', cat:'', risk:'safe', review:'', rating:5, author:'', lat:null, lng:null, cuisineType: inferCuisine({}) });
    setCuisineTouched(false);
    setSearchResults([]);
    setNameQuery('');
  }

  function handleClose() { reset(); onClose(); }

  function withInferredCuisine(next, hint) {
    if (cuisineTouched) return next;
    return { ...next, cuisineType: inferCuisine({ cat: next.cat, name: next.name, hints: hint ? [hint] : [] }) };
  }

  function handleNameChange(v) {
    setNameQuery(v);
    setForm(f => withInferredCuisine({ ...f, name: v, lat: null, lng: null, address: '' }));
    setSearchResults([]);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (v.trim().length < 2) return;
    debounceTimer.current = setTimeout(() => doSearch(v), 600);
  }

  async function doSearch(q) {
    const query = q || nameQuery;
    if (!query.trim()) return;
    setSearching(true);
    const results = await searchPlaces(query);
    setSearchResults(results);
    setSearching(false);
  }

  function handleSelectPlace(place) {
    setNameQuery(place.name);
    setForm(f => withInferredCuisine({
      ...f,
      name: place.name,
      address: place.address,
      cat: f.cat || (place.category ? place.category.split('>').pop().trim() : ''),
      lat: place.lat,
      lng: place.lng,
    }, place.category));
    setSearchResults([]);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.review.trim()) {
      Alert.alert('필수 항목 누락', '식당 이름과 경험 내용을 입력해주세요.');
      return;
    }
    if (!form.lat) {
      Alert.alert(
        '위치 미선택',
        '검색 결과에서 식당을 선택하면 지도에 정확히 표시됩니다.\n그냥 등록하시겠어요?',
        [
          { text: '취소', style: 'cancel' },
          { text: '그냥 등록', onPress: () => submitReview() },
        ]
      );
      return;
    }
    submitReview();
  }

  async function submitReview() {
    if (!user?.uid) { Alert.alert('로그인이 필요합니다.'); return; }
    setSubmitting(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
      await addReview({
        risk: form.risk,
        address: form.address || '',
        rating: form.rating,
        author: form.author || '익명',
        date: dateStr,
        lat: form.lat,
        lng: form.lng,
        cuisineType: form.cuisineType,
        ko: { name: form.name, cat: form.cat || '기타', tags: [], review: form.review },
        en: { name: form.name, cat: form.cat || '기타', tags: [], review: form.review },
      }, user.uid);
      Alert.alert(t.reviewSubmittedTitle, t.reviewSubmittedMsg);
      reset();
      onClose();
    } catch {
      Alert.alert('오류', '등록 중 문제가 생겼어요. 다시 시도해주세요.');
    }
    setSubmitting(false);
  }

  const riskOptions = ['safe', 'info', 'caution', 'danger'];
  const riskLabel = { safe: t.safe, info: t.info, caution: t.caution, danger: t.danger };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.writeModal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.writeHeader}>
          <Text style={styles.writeTitle}>{t.writeModalTitle}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.writeBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">

          {/* 식당 이름 + 카카오 자동 검색 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.restNameLabel}</Text>
            <View style={styles.nameRow}>
              <TextInput
                value={nameQuery}
                onChangeText={handleNameChange}
                placeholder={t.restNamePh}
                placeholderTextColor="#CCC"
                style={[styles.input, { flex: 1 }]}
                returnKeyType="search"
                onSubmitEditing={() => doSearch()}
              />
              {searching && <ActivityIndicator size="small" color="#4A7FBF" style={{ marginLeft: 8 }} />}
            </View>
            <Text style={[styles.searchHint, form.lat && { color: '#2D8A4E', fontWeight: '600' }]}>
              {form.lat ? t.restSelectedLoc : t.restAutoSearch}
            </Text>

            {searchResults.length > 0 && (
              <View style={styles.dropdown}>
                {searchResults.map(place => (
                  <TouchableOpacity
                    key={place.id}
                    style={styles.dropdownItem}
                    onPress={() => handleSelectPlace(place)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownName}>{place.name}</Text>
                    <Text style={styles.dropdownAddr}>{place.address}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* 주소 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.restAddressLabel}</Text>
            <TextInput
              value={form.address}
              onChangeText={v => setForm(f => ({ ...f, address: v }))}
              placeholder={t.restAddressPh}
              placeholderTextColor="#CCC"
              style={[styles.input, form.lat && styles.inputFilled]}
            />
          </View>

          {/* 카테고리 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.restCatLabel}</Text>
            <TextInput
              value={form.cat}
              onChangeText={v => setForm(f => withInferredCuisine({ ...f, cat: v }))}
              placeholder={t.restCatPh}
              placeholderTextColor="#CCC"
              style={styles.input}
            />
          </View>

          {/* 음식 종류 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.restCuisineLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.cuisinePickerRow}>
                {CUISINE_TYPES.map(c => {
                  const active = form.cuisineType === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => { setCuisineTouched(true); setForm(f => ({ ...f, cuisineType: c })); }}
                      style={[styles.cuisinePickerBtn, active && styles.cuisinePickerBtnActive]}
                    >
                      <Text style={[styles.cuisinePickerText, active && styles.cuisinePickerTextActive]}>
                        {CUISINE_EMOJI[c]} {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* 안전도 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.restSafetyLabel}</Text>
            <View style={styles.riskRow}>
              {riskOptions.map(r => {
                const s = SC[r];
                const active = form.risk === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setForm(f => ({ ...f, risk: r }))}
                    style={[styles.riskBtn, { borderColor: s.color, backgroundColor: active ? s.bg : 'white' }]}
                  >
                    <Text style={[styles.riskBtnText, { color: s.color, fontWeight: active ? '800' : '400' }]}>
                      {s.icon} {riskLabel[r]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 별점 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.restRatingLabel}</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setForm(f => ({ ...f, rating: n }))}>
                  <Text style={[styles.star, { color: n <= form.rating ? '#F5C842' : '#DDD' }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 경험 내용 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.restReviewLabel}</Text>
            <TextInput
              value={form.review}
              onChangeText={v => setForm(f => ({ ...f, review: v }))}
              placeholder={t.restReviewPh}
              placeholderTextColor="#CCC"
              multiline
              style={[styles.input, styles.inputMulti]}
            />
          </View>

          {/* 작성자 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.restAuthorLabel}</Text>
            <TextInput
              value={form.author}
              onChangeText={v => setForm(f => ({ ...f, author: v }))}
              placeholder={t.restAuthorPh}
              placeholderTextColor="#CCC"
              style={styles.input}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? t.submitting : t.submitReport}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  loadingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EBF3FF', padding: 8, paddingHorizontal: 14,
  },
  loadingText: { fontSize: 11, color: '#4A7FBF' },
  list: { padding: 13, paddingBottom: 20 },
  writeBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  writeBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#EEE',
    paddingHorizontal: 12, marginBottom: 8,
  },
  searchIcon: { fontSize: 13, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: '#333' },
  clearBtn: { fontSize: 13, color: '#BBB', paddingLeft: 8 },
  regionRow: { paddingBottom: 8, gap: 6 },
  regionBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#EEE',
    backgroundColor: 'white',
  },
  regionBtnActive: { backgroundColor: '#E8704A', borderColor: '#E8704A' },
  regionText: { fontSize: 12, color: '#999' },
  regionTextActive: { color: 'white', fontWeight: '800' },
  count: { fontSize: 11, color: '#999', marginBottom: 6 },
  countNum: { fontWeight: '800', color: '#333' },
  countRegion: { color: '#E8704A', fontWeight: '700' },
  brandSection: { marginTop: 4, marginBottom: 10 },
  brandSectionTitle: { fontSize: 12, fontWeight: '800', color: '#4A7FBF', marginBottom: 8 },
  brandCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 7,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  brandCardImg: { fontSize: 24, flexShrink: 0 },
  brandCardBody: { flex: 1 },
  brandCardName: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  brandCardCat: { fontSize: 11, color: '#BBB', marginTop: 1 },
  brandCardReason: { fontSize: 10, color: '#777', marginTop: 2 },
  card: {
    backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardLeft: { flex: 1, marginRight: 8 },
  cardName: { fontWeight: '800', fontSize: 15, color: '#1A1A1A', marginBottom: 2 },
  cardSub: { fontSize: 11, color: '#999' },
  exceptionLabel: { fontSize: 10, color: '#E8704A', marginBottom: 5 },
  review: { fontSize: 12, color: '#555', lineHeight: 18 },
  meta: { fontSize: 11, color: '#BBB', marginTop: 7 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#999', fontWeight: '700' },
  emptySub: { fontSize: 12, color: '#CCC', marginTop: 6 },
  // Write Modal
  writeModal: { flex: 1, backgroundColor: 'white' },
  writeHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 24,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8',
  },
  writeTitle: { fontSize: 18, fontWeight: '900' },
  closeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: '#666' },
  writeBody: { flex: 1, padding: 20 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6 },
  nameRow: { flexDirection: 'row', gap: 8 },
  nameInput: { flex: 1 },
  searchBtn: {
    backgroundColor: '#E8704A', borderRadius: 10,
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
    minWidth: 52,
  },
  searchBtnText: { color: 'white', fontSize: 13, fontWeight: '800' },
  searchHint: { fontSize: 11, color: '#AAA', marginTop: 5 },
  input: {
    backgroundColor: '#FAF8F5', borderRadius: 10, borderWidth: 1.5,
    borderColor: '#EEE', paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 13, color: '#333',
  },
  inputFilled: { borderColor: '#2D8A4E', backgroundColor: '#E8F5ED' },
  inputMulti: { height: 100, textAlignVertical: 'top' },
  dropdown: {
    marginTop: 4, borderRadius: 10, borderWidth: 1.5, borderColor: '#EEE',
    backgroundColor: 'white', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 5,
  },
  dropdownItem: {
    padding: 13, borderBottomWidth: 1, borderBottomColor: '#F5F0EB',
  },
  dropdownName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  dropdownAddr: { fontSize: 11, color: '#999', marginTop: 2 },
  riskRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  riskBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5,
  },
  riskBtnText: { fontSize: 12 },
  starRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 28 },
  submitBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  // 음식 종류 필터 (목록 화면)
  cuisineBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#EEE',
    backgroundColor: 'white',
  },
  cuisineBtnActive: { backgroundColor: '#5B3EE8', borderColor: '#5B3EE8' },
  cuisineText: { fontSize: 12, color: '#999' },
  cuisineTextActive: { color: 'white', fontWeight: '800' },
  // 카드 이름 행
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  cuisineTag: {
    backgroundColor: '#F0EDFF', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  cuisineTagText: { fontSize: 10, color: '#5B3EE8', fontWeight: '700' },
  // 식당 안전 데이터베이스 섹션
  dbSection: { marginTop: 12, marginBottom: 10 },
  dbSectionTitle: { fontSize: 12, fontWeight: '800', color: '#333', marginBottom: 8 },
  dbGroupRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  dbGroupCount: { fontSize: 11, color: '#999' },
  dbRegisteredBadge: {
    backgroundColor: '#E8F5ED', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  dbRegisteredBadgeText: { fontSize: 11, fontWeight: '800', color: '#2D8A4E' },
  dbPlacesBadge: {
    backgroundColor: '#EBF3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  dbPlacesBadgeText: { fontSize: 11, fontWeight: '800', color: '#4A7FBF' },
  dbGroupDivider: { height: 1, backgroundColor: '#F0EDE8', marginVertical: 10 },
  dbEmptyText: { fontSize: 12, color: '#BBB', marginBottom: 6, paddingLeft: 2 },
  dbCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 7,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  dbCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dbCardLeft: { flex: 1, marginRight: 8 },
  dbCardName: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  dbCardSub: { fontSize: 11, color: '#888' },
  dbCardNote: { fontSize: 11, color: '#666', marginTop: 5 },
  safeOnlyBtn: { marginHorizontal: 12, marginBottom: 6, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: '#DDD', backgroundColor: '#FFF', alignSelf: 'stretch' },
  safeOnlyBtnActive: { borderColor: '#2D8A4E', backgroundColor: '#E8F5EC' },
  safeOnlyText: { fontSize: 14, color: '#888', fontWeight: '500', textAlign: 'center' },
  safeOnlyTextActive: { color: '#2D8A4E', fontWeight: '700' },
  checkInBtn: { marginTop: 8, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#E8F5EC', borderWidth: 1, borderColor: '#2D8A4E', alignSelf: 'flex-start' },
  checkInBtnText: { fontSize: 12, color: '#2D8A4E', fontWeight: '700' },
  dbRiskBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0,
  },
  dbRiskText: { fontSize: 11, fontWeight: '700' },
  // Google Places 카드
  placesCard: {
    backgroundColor: '#F5F8FF', borderRadius: 12, padding: 12, marginBottom: 7,
    borderWidth: 1, borderColor: '#C5DFF8',
  },
  placesCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  placesCardLeft: { flex: 1, marginRight: 8 },
  placesCardName: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  placesCardAddr: { fontSize: 11, color: '#777' },
  placesCardRating: { fontSize: 11, color: '#888', marginTop: 2 },
  googleAttribution: { fontSize: 10, color: '#5F6368' },
  placesUnknownBadge: {
    backgroundColor: '#EEE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  placesUnknownText: { fontSize: 10, color: '#888', fontWeight: '700' },
  placesWarn: { fontSize: 11, color: '#B26A00', marginBottom: 8 },
  placesActions: { flexDirection: 'row', gap: 8 },
  gmapsBtn: {
    flex: 1, backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#C5DFF8',
    paddingVertical: 8, alignItems: 'center',
  },
  gmapsBtnText: { fontSize: 12, color: '#4A7FBF', fontWeight: '700' },
  addDbBtn: {
    backgroundColor: '#4A7FBF', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center',
  },
  addDbBtnText: { fontSize: 12, color: 'white', fontWeight: '800' },
  // 음식 종류 선택 (등록 폼)
  cuisinePickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  cuisinePickerBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#EEE',
    backgroundColor: 'white',
  },
  cuisinePickerBtnActive: { backgroundColor: '#5B3EE8', borderColor: '#5B3EE8' },
  cuisinePickerText: { fontSize: 13, color: '#999' },
  cuisinePickerTextActive: { color: 'white', fontWeight: '800' },
  directCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF8F5', borderRadius: 12, padding: 14,
    marginTop: 8,
    borderWidth: 1.5, borderColor: '#E8704A', borderStyle: 'dashed',
  },
  directCardIcon: { fontSize: 22, flexShrink: 0 },
  directCardBody: { flex: 1 },
  directCardName: { fontSize: 13, fontWeight: '800', color: '#E8704A' },
  directCardHint: { fontSize: 11, color: '#BBB', marginTop: 2 },
});

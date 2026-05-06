// src/components/ReportModal.js
import * as Location from 'expo-location';
import { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { addUserReport } from '../firebase/dbService';
import { GOOGLE_PLACES_KEY } from '../config/keys';

const REST_EXPERIENCES = [
  {
    type: 'all_safe',
    icon: '✅',
    title: '전체 메뉴 안심',
    desc: '모든 메뉴에서 땅콩 성분 없음을 확인했어요',
    color: '#2D8A4E', bg: '#E8F5ED',
    risk: 'safe', scope: 'all', needsMenu: false,
  },
  {
    type: 'some_safe',
    icon: '🍽️',
    title: '안전한 메뉴가 있어요',
    desc: '특정 메뉴만 안심하고 먹을 수 있어요',
    color: '#2D8A4E', bg: '#E8F5ED',
    risk: 'safe', scope: 'specific', needsMenu: true,
    menuLabel: '안전했던 메뉴명 *', menuPlaceholder: '예) 순살치킨, 감자튀김',
  },
  {
    type: 'staff_helpful',
    icon: 'ℹ️',
    title: '직원이 알레르기 정보를 잘 알려줘요',
    desc: '물어보면 성분을 친절하고 자세하게 안내해줘요',
    color: '#4A7FBF', bg: '#EBF3FF',
    risk: 'info', scope: 'all', needsMenu: false,
  },
  {
    type: 'some_danger',
    icon: '⚠️',
    title: '주의할 메뉴가 있어요',
    desc: '이 메뉴는 위험하거나 성분 확인이 어려웠어요',
    color: '#C17C1A', bg: '#FDF3E3',
    risk: 'caution', scope: 'specific', needsMenu: true,
    menuLabel: '주의할 메뉴명 *', menuPlaceholder: '예) 땅콩소스 파스타, 견과류 케이크',
  },
  {
    type: 'cross_risk',
    icon: '🚫',
    title: '혼입 위험 — 방문 비추천',
    desc: '주방에서 땅콩을 혼용해서 전체적으로 먹기 어려워요',
    color: '#C13A2D', bg: '#FDECEA',
    risk: 'danger', scope: 'all', needsMenu: false,
  },
];

const FOOD_EXPERIENCES = [
  {
    type: 'all_safe',
    icon: '✅',
    title: '안전해요',
    desc: '성분표에 땅콩 없음, 먹어도 괜찮았어요',
    color: '#2D8A4E', bg: '#E8F5ED',
    risk: 'safe', scope: 'all', needsMenu: false,
  },
  {
    type: 'some_safe',
    icon: '🏷️',
    title: '특정 맛/종류만 안전해요',
    desc: '이 시리즈 중 이 제품만 땅콩 없어요',
    color: '#2D8A4E', bg: '#E8F5ED',
    risk: 'safe', scope: 'specific', needsMenu: true,
    menuLabel: '안전한 제품명/맛 *', menuPlaceholder: '예) 오리지날맛, 플레인',
  },
  {
    type: 'cross_caution',
    icon: '⚠️',
    title: '혼입 주의',
    desc: '포장에 "땅콩 혼입 가능" 표기가 있어요',
    color: '#C17C1A', bg: '#FDF3E3',
    risk: 'caution', scope: 'all', needsMenu: false,
  },
  {
    type: 'all_danger',
    icon: '❌',
    title: '위험해요',
    desc: '땅콩 성분 있거나 알레르기 반응이 있었어요',
    color: '#C13A2D', bg: '#FDECEA',
    risk: 'danger', scope: 'all', needsMenu: false,
  },
];

// 충돌 그룹: 안심 계열 ↔ 위험 계열은 동시 선택 불가
const CONFLICT_SAFE   = ['all_safe'];
const CONFLICT_DANGER = ['some_danger', 'cross_risk'];
const RISK_ORDER = { danger: 0, caution: 1, safe: 2, info: 3 };

export default function ReportModal({ visible, onClose, target, user }) {
  // target: { type: 'brand'|'food'|'restaurant', id, name, img }
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [menuItem, setMenuItem] = useState('');
  const [note, setNote] = useState('');
  const [locationMode, setLocationMode] = useState('none'); // 'none' | 'gps' | 'search'
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null); // { name, address, lat, lng }
  const addressDebounce = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const EXPERIENCES = target?.type === 'food' ? FOOD_EXPERIENCES : REST_EXPERIENCES;

  function toggleExperience(opt) {
    setSelectedTypes(prev => {
      const isSelected = prev.some(t => t.type === opt.type);
      if (isSelected) return prev.filter(t => t.type !== opt.type);
      let next = [...prev];
      if (CONFLICT_SAFE.includes(opt.type)) {
        next = next.filter(t => !CONFLICT_DANGER.includes(t.type));
      } else if (CONFLICT_DANGER.includes(opt.type)) {
        next = next.filter(t => !CONFLICT_SAFE.includes(t.type));
      }
      return [...next, opt];
    });
  }

  // 선택된 항목 중 메뉴 입력이 필요한 첫 번째 옵션
  const needsMenuOpt = selectedTypes.find(t => t.needsMenu);

  // 가장 위험도 높은 항목이 대표 타입
  const primaryType = selectedTypes.length > 0
    ? [...selectedTypes].sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9))[0]
    : null;

  function reset() {
    setSelectedTypes([]); setMenuItem(''); setNote('');
    setLocationMode('none'); setAddressQuery(''); setAddressResults([]);
    setAddressSearching(false); setSelectedAddress(null);
  }

  useEffect(() => {
    if (locationMode !== 'search') return;
    if (addressDebounce.current) clearTimeout(addressDebounce.current);
    const q = addressQuery.trim();
    if (q.length < 2) { setAddressResults([]); return; }
    addressDebounce.current = setTimeout(async () => {
      setAddressSearching(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&language=ko&key=${GOOGLE_PLACES_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          setAddressResults(
            (data.results || []).slice(0, 5).map(p => ({
              name: p.name,
              address: p.formatted_address,
              lat: p.geometry?.location?.lat ?? null,
              lng: p.geometry?.location?.lng ?? null,
            }))
          );
        } else {
          setAddressResults([]);
        }
      } catch (e) {
        if (__DEV__) console.warn('[ReportModal] 주소 검색 실패:', e);
        setAddressResults([]);
      }
      setAddressSearching(false);
    }, 500);
  }, [addressQuery, locationMode]);

  async function handleSubmit() {
    if (!user) {
      Alert.alert('로그인이 필요합니다.');
      return;
    }
    if (selectedTypes.length === 0) {
      Alert.alert('경험 유형을 하나 이상 선택해주세요.');
      return;
    }
    if (needsMenuOpt && !menuItem.trim()) {
      Alert.alert(needsMenuOpt.menuLabel.replace(' *', '') + '을(를) 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      let lat = null, lng = null, hasLocation = false, address = '';
      if (locationMode === 'gps') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          hasLocation = true;
        }
      } else if (locationMode === 'search' && selectedAddress) {
        lat = selectedAddress.lat;
        lng = selectedAddress.lng;
        address = selectedAddress.address;
        hasLocation = lat != null && lng != null;
      }
      await addUserReport({
        targetType: target.type,
        targetId: target.id,
        targetName: target.name,
        targetImg: target.img || '',
        experienceType: primaryType.type,
        experienceTypes: selectedTypes.map(t => t.type),
        risk: primaryType.risk,
        scope: primaryType.scope,
        menuItem: needsMenuOpt ? menuItem.trim() : '',
        note: note.trim(),
        address,
        hasLocation,
        lat,
        lng,
        userId: user.uid,
        userNickname: user.displayName || '익명',
      });
      Alert.alert('기록 완료! 🙏', '소중한 경험을 공유해주셨습니다.\n다른 알레르기 가족에게 큰 도움이 됩니다.');
      reset();
      onClose();
    } catch (e) {
      Alert.alert('오류', '기록 중 문제가 생겼어요. 다시 시도해주세요.');
    }
    setSubmitting(false);
  }

  const isSubmitDisabled = selectedTypes.length === 0 || submitting;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={s.wrap} behavior="padding" keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}>

        {/* 헤더 */}
        <View style={s.header}>
          <Text style={s.headerTitle}>📝  기록하기</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} style={s.closeBtn}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* 대상 카드 */}
          <View style={s.targetCard}>
            <Text style={s.targetImg}>{target?.img || '📌'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.targetName}>{target?.name || ''}</Text>
              <Text style={s.targetType}>
                {{ brand: '브랜드/식당', food: '식품', restaurant: '식당' }[target?.type] || ''}
              </Text>
            </View>
          </View>

          {/* 경험 유형 선택 (복수 선택 가능) */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>어떤 경험이었나요? * (복수 선택 가능)</Text>
            <View style={s.expList}>
              {EXPERIENCES.map(opt => {
                const isSelected = selectedTypes.some(t => t.type === opt.type);
                // 충돌로 인해 선택 불가한지 체크
                const hasConflict = (
                  (CONFLICT_SAFE.includes(opt.type) && selectedTypes.some(t => CONFLICT_DANGER.includes(t.type))) ||
                  (CONFLICT_DANGER.includes(opt.type) && selectedTypes.some(t => CONFLICT_SAFE.includes(t.type)))
                );
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={[
                      s.expCard,
                      isSelected
                        ? { backgroundColor: opt.bg, borderColor: opt.color }
                        : { backgroundColor: 'white', borderColor: '#EEE' },
                      hasConflict && s.expCardDisabled,
                    ]}
                    onPress={() => { toggleExperience(opt); if (!opt.needsMenu) setMenuItem(''); }}
                    activeOpacity={0.75}
                  >
                    <View style={s.expCardLeft}>
                      <Text style={[s.expCardIcon, hasConflict && { opacity: 0.35 }]}>{opt.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.expCardTitle, isSelected && { color: opt.color }, hasConflict && { color: '#CCC' }]}>
                          {opt.title}
                          {hasConflict ? '  (선택 불가)' : ''}
                        </Text>
                        <Text style={[s.expCardDesc, hasConflict && { color: '#DDD' }]}>{opt.desc}</Text>
                      </View>
                    </View>
                    <View style={[s.expCheckbox, isSelected && { backgroundColor: opt.color, borderColor: opt.color }]}>
                      {isSelected && <Text style={s.expCheckmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 메뉴/제품명 입력 (needsMenu인 경우에만) */}
          {needsMenuOpt && (
            <View style={[s.section, s.menuInputSection]}>
              <Text style={s.sectionLabel}>{needsMenuOpt.menuLabel}</Text>
              <TextInput
                value={menuItem}
                onChangeText={setMenuItem}
                placeholder={needsMenuOpt.menuPlaceholder}
                placeholderTextColor="#CCC"
                style={s.input}
              />
            </View>
          )}

          {/* 상세 메모 */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>더 자세히 알려주세요</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="직접 경험하신 내용을 자유롭게 써주세요. 다른 알레르기 가족에게 큰 도움이 됩니다 🙏"
              placeholderTextColor="#CCC"
              multiline
              style={[s.input, s.inputMulti]}
            />
          </View>

          {/* 위치 (food 타입 제외) */}
          {target?.type !== 'food' && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>📍  위치 (선택)</Text>
              <View style={s.locationModes}>
                {[
                  { key: 'none', icon: '✕', label: '없음' },
                  { key: 'gps',  icon: '📡', label: '현재 위치' },
                  { key: 'search', icon: '🔍', label: '주소 검색' },
                ].map(({ key, icon, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[s.locationModeBtn, locationMode === key && s.locationModeBtnActive]}
                    onPress={() => { setLocationMode(key); setSelectedAddress(null); setAddressQuery(''); setAddressResults([]); }}
                  >
                    <Text style={s.locationModeIcon}>{icon}</Text>
                    <Text style={[s.locationModeLabel, locationMode === key && s.locationModeLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {locationMode === 'gps' && (
                <View style={s.locationInfo}>
                  <Text style={s.locationInfoText}>📡  제출 시 현재 GPS 위치가 자동으로 저장됩니다</Text>
                </View>
              )}

              {locationMode === 'search' && (
                <View style={s.addressSearch}>
                  <View style={s.addressInputWrap}>
                    <TextInput
                      value={addressQuery}
                      onChangeText={setAddressQuery}
                      placeholder="식당명 또는 주소 입력 (예: 스타벅스 강남)"
                      placeholderTextColor="#CCC"
                      style={s.addressInput}
                    />
                    {addressSearching && <ActivityIndicator size="small" color="#4A7FBF" style={{ marginRight: 8 }} />}
                  </View>
                  {selectedAddress && (
                    <View style={s.selectedAddressCard}>
                      <Text style={s.selectedAddressName}>✓  {selectedAddress.name}</Text>
                      <Text style={s.selectedAddressText}>{selectedAddress.address}</Text>
                      <TouchableOpacity onPress={() => { setSelectedAddress(null); setAddressQuery(''); }}>
                        <Text style={s.selectedAddressClear}>다시 검색</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {!selectedAddress && addressResults.length > 0 && (
                    <View style={s.addressResults}>
                      {addressResults.map((r, i) => (
                        <TouchableOpacity
                          key={i}
                          style={s.addressResultItem}
                          onPress={() => { setSelectedAddress(r); setAddressQuery(r.name); setAddressResults([]); }}
                        >
                          <Text style={s.addressResultName}>{r.name}</Text>
                          <Text style={s.addressResultAddr} numberOfLines={1}>{r.address}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {!selectedAddress && addressQuery.trim().length > 1 && !addressSearching && addressResults.length === 0 && (
                    <View>
                      <Text style={s.addressNoResult}>검색 결과가 없어요.</Text>
                      <TouchableOpacity
                        style={s.manualAddressBtn}
                        onPress={() => setSelectedAddress({ name: addressQuery.trim(), address: addressQuery.trim(), lat: null, lng: null })}
                      >
                        <Text style={s.manualAddressBtnText}>"{addressQuery.trim()}" 그대로 입력하기</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <Text style={s.locationHint}>위치를 포함하면 지도 탭에 마커로 표시됩니다</Text>
            </View>
          )}

          {/* 제출 */}
          <TouchableOpacity
            style={[s.submitBtn, isSubmitDisabled && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
          >
            {submitting
              ? <ActivityIndicator color="white" />
              : <Text style={s.submitBtnText}>기록 등록하기</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 24,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8',
  },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  closeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: '#666' },
  body: { flex: 1, padding: 20 },
  targetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FAF8F5', borderRadius: 12, padding: 14, marginBottom: 20,
  },
  targetImg: { fontSize: 28 },
  targetName: { fontSize: 16, fontWeight: '900', color: '#1A1A1A' },
  targetType: { fontSize: 11, color: '#999', marginTop: 2 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
  expList: { gap: 8 },
  expCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#EEE',
    padding: 14, gap: 12,
  },
  expCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  expCardIcon: { fontSize: 22 },
  expCardTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  expCardDesc: { fontSize: 11, color: '#888', lineHeight: 16 },
  expRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#DDD',
    alignItems: 'center', justifyContent: 'center',
  },
  expRadioDot: { width: 11, height: 11, borderRadius: 6 },
  expCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#DDD', backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  expCheckmark: { color: 'white', fontSize: 13, fontWeight: '900' },
  expCardDisabled: { opacity: 0.45, backgroundColor: '#F8F8F8', borderColor: '#EEE' },
  menuInputSection: { marginTop: 8 },
  input: {
    backgroundColor: '#FAF8F5', borderRadius: 10, borderWidth: 1.5,
    borderColor: '#EEE', paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 13, color: '#333',
  },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  locationModes: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  locationModeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E8E8E8', backgroundColor: 'white', gap: 4,
  },
  locationModeBtnActive: { backgroundColor: '#EBF3FF', borderColor: '#4A7FBF' },
  locationModeIcon: { fontSize: 16 },
  locationModeLabel: { fontSize: 11, color: '#999' },
  locationModeLabelActive: { color: '#4A7FBF', fontWeight: '700' },
  locationInfo: {
    backgroundColor: '#EBF3FF', borderRadius: 8, padding: 10, marginBottom: 8,
  },
  locationInfoText: { fontSize: 12, color: '#4A7FBF' },
  locationHint: { fontSize: 10, color: '#CCC', marginTop: 4 },
  addressSearch: { gap: 8 },
  addressInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAF8F5', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#EEE', paddingHorizontal: 12,
  },
  addressInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: '#333' },
  selectedAddressCard: {
    backgroundColor: '#E8F5ED', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#2D8A4E',
  },
  selectedAddressName: { fontSize: 13, fontWeight: '800', color: '#2D8A4E', marginBottom: 2 },
  selectedAddressText: { fontSize: 11, color: '#555', marginBottom: 6 },
  selectedAddressClear: { fontSize: 11, color: '#4A7FBF', fontWeight: '700' },
  addressResults: {
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EEE',
  },
  addressResultItem: {
    padding: 12, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  addressResultName: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  addressResultAddr: { fontSize: 11, color: '#999' },
  addressNoResult: { fontSize: 12, color: '#BBB', textAlign: 'center', paddingVertical: 8 },
  manualAddressBtn: {
    marginTop: 4, padding: 10, backgroundColor: '#F5F0EB', borderRadius: 8, alignItems: 'center',
  },
  manualAddressBtnText: { fontSize: 12, color: '#E8704A', fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#CCC',
  },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
});

// src/components/BottomSheet.js
import * as Brightness from 'expo-brightness';
import { useEffect, useRef, useState } from 'react';
import {
  Linking, Modal, Platform, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { subscribeUserReports } from '../firebase/dbService';
import { SC } from '../data/translations';
import { Badge, DisclaimerFooter, SrcBadge, TagList } from './Common';
import ReportModal from './ReportModal';
import { CUISINE_EMOJI } from '../screens/RestaurantScreen';
import { openGoogleMaps, openNaverMap } from '../utils/openMap';

// ── 알레르기 카드 모달 ────────────────────────────────────
const ALLERGY_TEXTS = [
  {
    lang: 'English',
    flag: '🇺🇸',
    text: 'I have a peanut allergy. My allergy is severe and life-threatening. Does this dish contain peanuts or peanut oil? Please check carefully.',
  },
  {
    lang: '한국어',
    flag: '🇰🇷',
    text: '저는 땅콩 알레르기가 있습니다. 알레르기 반응이 심각하여 생명에 위험할 수 있습니다. 이 음식에 땅콩이나 땅콩 기름이 들어있나요? 주의 깊게 확인해 주세요.',
  },
  {
    lang: '日本語',
    flag: '🇯🇵',
    text: '私はピーナッツアレルギーがあります。アレルギー反応が重篤で、生命に関わる場合があります。この料理にピーナッツやピーナッツオイルは含まれていますか？',
  },
];

function AllergyCardModal({ visible, onClose }) {
  const prevBrightnessRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // 모달 열릴 때 밝기 최대로
      Brightness.getBrightnessAsync()
        .then(b => { prevBrightnessRef.current = b; })
        .catch(() => {});
      Brightness.setBrightnessAsync(1.0).catch(() => {});
    } else {
      // 닫힐 때 원래 밝기로 복원
      if (prevBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(prevBrightnessRef.current).catch(() => {});
        prevBrightnessRef.current = null;
      }
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="#B71C1C" barStyle="light-content" />
      <View style={ac.container}>
        {/* 닫기 버튼 */}
        <TouchableOpacity style={ac.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={ac.closeBtnText}>✕</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={ac.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* 헤더 */}
          <Text style={ac.icon}>🥜</Text>
          <Text style={ac.title}>PEANUT ALLERGY</Text>
          <Text style={ac.subtitle}>땅콩 알레르기  ·  ピーナッツアレルギー</Text>
          <View style={ac.divider} />

          {/* 3개 언어 카드 */}
          {ALLERGY_TEXTS.map(({ lang, flag, text }) => (
            <View key={lang} style={ac.langBlock}>
              <Text style={ac.langLabel}>{flag}  {lang}</Text>
              <Text style={ac.langText}>{text}</Text>
            </View>
          ))}

          <View style={ac.divider} />
          <Text style={ac.footer}>화면을 직원에게 보여주세요</Text>
          <Text style={ac.footerSub}>Show this screen to the staff</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── 공통: 알레르기 카드 버튼 ────────────────────────────
function AllergyCardButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.allergyBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.allergyBtnIcon}>🥜</Text>
      <Text style={styles.allergyBtnText}>알레르기 카드 보기</Text>
    </TouchableOpacity>
  );
}

// ── 공통: 커뮤니티 기록 요약 ─────────────────────────────
function ReportSummary({ reports }) {
  if (reports.length === 0) return null;
  const counts = { safe: 0, caution: 0, danger: 0, info: 0 };
  reports.forEach(r => { if (counts[r.risk] !== undefined) counts[r.risk]++; });
  return (
    <View style={styles.reportSummary}>
      <Text style={styles.reportSummaryTitle}>👥  커뮤니티 기록  {reports.length}건</Text>
      <View style={styles.reportCountRow}>
        {[['safe','✓'],['caution','!'],['danger','✗'],['info','ℹ']].map(([r, icon]) =>
          counts[r] > 0 ? (
            <View key={r} style={[styles.reportCount, { backgroundColor: SC[r].bg }]}>
              <Text style={[styles.reportCountText, { color: SC[r].color }]}>
                {icon} {counts[r]}
              </Text>
            </View>
          ) : null
        )}
      </View>
      {reports.slice(0, 2).map(r => (
        <View key={r.id} style={styles.reportItem}>
          <View style={[styles.reportDot, { backgroundColor: SC[r.risk]?.color || '#999' }]} />
          <Text style={styles.reportItemText} numberOfLines={2}>
            {r.scope === 'specific' && r.menuItem ? `[${r.menuItem}] ` : ''}
            {r.note || (r.scope === 'all' ? '전체 메뉴 기록' : '기록됨')}
          </Text>
          <Text style={styles.reportItemMeta}>{r.userNickname}</Text>
        </View>
      ))}
    </View>
  );
}

// ── 공통: 지도앱 연결 버튼 — 평점·영업정보는 지도 앱에서 최신값으로 본다 ──
const MAP_APPS = [
  { label: '구글맵',   icon: '🌐', color: '#4285F4', textColor: 'white', open: openGoogleMaps },
  { label: '네이버맵', icon: '🟢', color: '#03C75A', textColor: 'white', open: openNaverMap },
];

function MapButtons({ place }) {
  if (!place?.name) return null;
  return (
    <View style={styles.mapRow}>
      {MAP_APPS.map(app => (
        <TouchableOpacity
          key={app.label}
          style={[styles.mapBtn, { backgroundColor: app.color }]}
          onPress={() => app.open(place)}
          activeOpacity={0.75}
        >
          <Text style={styles.mapBtnIcon}>{app.icon}</Text>
          <Text style={[styles.mapBtnLabel, { color: app.textColor }]}>{app.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── 공통: 기록하기 버튼 ──────────────────────────────────
function RecordButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.recordBtn} onPress={onPress}>
      <Text style={styles.recordBtnText}>📝  내 경험 기록하기</Text>
    </TouchableOpacity>
  );
}

// ── 브랜드 시트 ──────────────────────────────────────────
export function BrandSheet({ item, lang, t, user, onClose }) {
  const [showReport, setShowReport] = useState(false);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!item?.id) return;
    const unsub = subscribeUserReports(item.id, setReports);
    return () => unsub();
  }, [item?.id]);

  if (!item) return null;
  const d = item[lang] || item.ko;
  const s = SC[item.risk];

  return (
    <>
      <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <View style={styles.header}>
                  <Text style={styles.title}>{item.img}  {d.name}</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={[styles.riskBox, { backgroundColor: s.bg }]}>
                    <Badge risk={item.risk} t={t} />
                    {item.risk === 'info' && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.infoText}>ℹ️  {t.infoMsg}</Text>
                        <Text style={[styles.infoText, { fontWeight: '700' }]}>{t.infoSub}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.row}>
                    <SrcBadge src={item.src} t={t} />
                    <Text style={styles.cat}>{d.cat}</Text>
                  </View>
                  <Text style={styles.reason}>{d.reason}</Text>
                  <TagList tags={d.tags} risk={item.risk} />
                  {d.note && (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>💬  {d.note}</Text>
                    </View>
                  )}
                  {item.officialAllergyUrl && (
                    <TouchableOpacity
                      style={styles.officialBtn}
                      onPress={() => Linking.openURL(item.officialAllergyUrl)}
                    >
                      <Text style={styles.officialBtnText}>🔗  {t.officialLink}</Text>
                    </TouchableOpacity>
                  )}
                  <ReportSummary reports={reports} />
                  <RecordButton onPress={() => setShowReport(true)} />
                  <View style={{ height: 8 }} />
                </ScrollView>
                <DisclaimerFooter lang={lang} />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        target={{ type: 'brand', id: item.id, name: d.name, img: item.img }}
        user={user}
      />
    </>
  );
}

// ── 식품 시트 ────────────────────────────────────────────
export function FoodSheet({ item, lang, t, user, onClose }) {
  const [showReport, setShowReport] = useState(false);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!item?.id) return;
    const unsub = subscribeUserReports(item.id, setReports);
    return () => unsub();
  }, [item?.id]);

  if (!item) return null;
  const d = item[lang] || item.ko;
  const s = SC[item.risk];

  return (
    <>
      <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <View style={styles.header}>
                  <Text style={styles.title}>{item.img}  {d.name}</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.subInfo}>{item.brand ? `${item.brand}  ·  ` : ''}{d.cat}</Text>
                  <View style={[styles.riskBox, { backgroundColor: s.bg }]}>
                    <Badge risk={item.risk} t={t} />
                    <View style={{ marginTop: 8 }}>
                      <TagList tags={d.tags} risk={item.risk} />
                    </View>
                  </View>
                  {d.note && (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>💬  {d.note}</Text>
                    </View>
                  )}
                  <ReportSummary reports={reports} />
                  <RecordButton onPress={() => setShowReport(true)} />
                  <View style={{ height: 8 }} />
                </ScrollView>
                <DisclaimerFooter lang={lang} />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        target={{ type: 'food', id: item.id, name: d.name, img: item.img }}
        user={user}
      />
    </>
  );
}

// ── 식당 시트 ────────────────────────────────────────────
export function RestaurantSheet({ item, lang, t, user, onClose }) {
  const [showReport, setShowReport] = useState(false);
  const [showAllergyCard, setShowAllergyCard] = useState(false);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!item?.id) return;
    const unsub = subscribeUserReports(String(item.id), setReports);
    return () => unsub();
  }, [item?.id]);

  if (!item) return null;
  const d = item[lang] || item.ko;
  const s = SC[item.risk];

  return (
    <>
      <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <View style={styles.header}>
                  <Text style={styles.title}>{d.name}</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {item.isBrandException && (
                    <View style={styles.exceptionBox}>
                      <Text style={styles.exceptionText}>⚠️  {d.exNote}</Text>
                    </View>
                  )}
                  <View style={[styles.riskBox, { backgroundColor: s.bg }]}>
                    <Badge risk={item.risk} t={t} />
                    <View style={{ marginTop: 8 }}>
                      <TagList tags={d.tags} risk={item.risk} />
                    </View>
                  </View>
                  <View style={styles.cuisineRow}>
                    <View style={styles.cuisinePill}>
                      <Text style={styles.cuisinePillText}>
                        {CUISINE_EMOJI[item.cuisineType || '기타'] || '🍽️'}  {item.cuisineType || '기타'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reviewText}>{d.review}</Text>
                  <Text style={styles.metaText}>{item.author}  ·  {item.date}</Text>
                  {/* 네이버 검색은 한글명이 잘 잡힌다 — 영어 화면에서도 ko 이름으로 찾는다 */}
                  <MapButtons place={{ name: item.ko?.name || d.name, address: item.address, placeId: item.placeId }} />
                  <ReportSummary reports={reports} />
                  <AllergyCardButton onPress={() => setShowAllergyCard(true)} />
                  <RecordButton onPress={() => setShowReport(true)} />
                  <View style={{ height: 8 }} />
                </ScrollView>
                <DisclaimerFooter lang={lang} />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <AllergyCardModal visible={showAllergyCard} onClose={() => setShowAllergyCard(false)} />
      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        target={{ type: 'restaurant', id: String(item.id), name: d.name, img: '🍽️', lat: item.lat, lng: item.lng }}
        user={user}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36, maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#E0E0E0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: '900', flex: 1 },
  closeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: '#666' },
  riskBox: { borderRadius: 12, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cat: { fontSize: 11, color: '#999' },
  reason: { fontSize: 12, color: '#555', lineHeight: 20, marginBottom: 10 },
  noteBox: {
    backgroundColor: '#FAF8F5', borderRadius: 8,
    padding: 10, marginTop: 10,
  },
  noteText: { fontSize: 11, color: '#888' },
  officialBtn: {
    backgroundColor: '#2D8A4E', borderRadius: 10,
    padding: 12, alignItems: 'center', marginTop: 12,
  },
  officialBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
  infoText: { fontSize: 11, color: '#2A5A9A', lineHeight: 18, marginTop: 4 },
  subInfo: { fontSize: 11, color: '#999', marginBottom: 10 },
  exceptionBox: {
    backgroundColor: '#FFF3E0', borderWidth: 1.5, borderColor: '#E8704A',
    borderRadius: 9, padding: 10, marginBottom: 10,
  },
  exceptionText: { fontSize: 11, color: '#E8704A' },
  reviewText: { fontSize: 12, lineHeight: 22, color: '#333', marginBottom: 10 },
  metaText: { fontSize: 11, color: '#999', borderTopWidth: 1, borderTopColor: '#F0EDE8', paddingTop: 10 },
  // 커뮤니티 기록
  reportSummary: {
    backgroundColor: '#FAF8F5', borderRadius: 12, padding: 14,
    marginTop: 14, marginBottom: 6,
  },
  reportSummaryTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
  reportCountRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  reportCount: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  reportCountText: { fontSize: 12, fontWeight: '800' },
  reportItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#F0EDE8',
  },
  reportDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  reportItemText: { flex: 1, fontSize: 11, color: '#555', lineHeight: 16 },
  reportItemMeta: { fontSize: 10, color: '#BBB' },
  // 기록 버튼
  recordBtn: {
    marginTop: 8, borderRadius: 12, padding: 14,
    backgroundColor: '#E8704A', alignItems: 'center',
  },
  recordBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  // 음식 종류 배지
  cuisineRow: { marginBottom: 10 },
  cuisinePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0EDFF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  cuisinePillText: { fontSize: 12, color: '#5B3EE8', fontWeight: '800' },
  // 지도앱 버튼
  mapRow: {
    flexDirection: 'row', gap: 8, marginTop: 14,
  },
  mapBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  mapBtnIcon: { fontSize: 16 },
  mapBtnLabel: { fontSize: 11, fontWeight: '800' },
  // 알레르기 카드 버튼
  allergyBtn: {
    marginTop: 12, borderRadius: 12, padding: 14,
    backgroundColor: '#B71C1C',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#B71C1C', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  allergyBtnIcon: { fontSize: 18 },
  allergyBtnText: { color: 'white', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
});

// ── 알레르기 카드 전체화면 스타일 ─────────────────────────
const ac = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#B71C1C',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 56,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 12 : 60,
    right: 20, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: 'white', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  scroll: { padding: 24, paddingTop: 52, paddingBottom: 60 },
  icon: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 28, fontWeight: '900', color: 'white',
    textAlign: 'center', letterSpacing: 1.5, marginBottom: 6,
  },
  subtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.75)',
    textAlign: 'center', marginBottom: 20,
  },
  divider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 20,
  },
  langBlock: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 14, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  langLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)',
    fontWeight: '800', marginBottom: 10, letterSpacing: 0.5,
  },
  langText: {
    fontSize: 17, color: 'white', lineHeight: 28,
    fontWeight: '600',
  },
  footer: {
    fontSize: 16, color: 'rgba(255,255,255,0.9)',
    textAlign: 'center', fontWeight: '800', marginBottom: 4,
  },
  footerSub: {
    fontSize: 12, color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
});

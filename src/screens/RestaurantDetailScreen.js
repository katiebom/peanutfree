// src/screens/RestaurantDetailScreen.js
import * as Brightness from 'expo-brightness';
import { useEffect, useRef, useState } from 'react';
import {
  Linking, Modal, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { CUISINE_EMOJI } from './RestaurantScreen';
import QuickSafetyReport from '../components/QuickSafetyReport';

// ── 위험도 설정 ───────────────────────────────────────────
const RISK_CFG = {
  high:   { color: '#C13A2D', bg: '#FDECEA', border: '#F5C6C2', label: '위험',  icon: '🚨' },
  medium: { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', label: '주의',  icon: '⚠️' },
  low:    { color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', label: '안전',  icon: '✅' },
};

const GUIDANCE_CFG = {
  high:   '✅  직원이 알레르기 안내를 잘 해줍니다',
  medium: '⚠️  직원 안내 가능하나 확인 필요',
  low:    '❌  알레르기 안내 어려울 수 있음',
};

function normalizeRisk(tier = '') {
  const t = tier.toLowerCase();
  if (t === 'high') return 'high';
  if (t.includes('medium')) return 'medium';
  if (t === 'low') return 'low';
  return 'medium';
}

function isLowConfidence(confidence = '') {
  return ['low', 'medium'].includes(confidence.toLowerCase());
}

// ── 알레르기 카드 데이터 ──────────────────────────────────
const ALLERGY_TEXTS = [
  {
    lang: 'English', flag: '🇺🇸',
    text: 'I have a peanut allergy. My allergy is severe and life-threatening. Does this dish contain peanuts or peanut oil? Please check carefully.',
  },
  {
    lang: '한국어', flag: '🇰🇷',
    text: '저는 땅콩 알레르기가 있습니다. 알레르기 반응이 심각하여 생명에 위험할 수 있습니다. 이 음식에 땅콩이나 땅콩 기름이 들어있나요? 주의 깊게 확인해 주세요.',
  },
  {
    lang: '日本語', flag: '🇯🇵',
    text: '私はピーナッツアレルギーがあります。アレルギー反応が重篤で、生命に関わる場合があります。この料理にピーナッツやピーナッツオイルは含まれていますか？',
  },
];

// ── 알레르기 카드 모달 ────────────────────────────────────
function AllergyCardModal({ visible, onClose }) {
  const prevBrRef = useRef(null);

  useEffect(() => {
    if (visible) {
      Brightness.getBrightnessAsync().then(b => { prevBrRef.current = b; }).catch(() => {});
      Brightness.setBrightnessAsync(1.0).catch(() => {});
    } else if (prevBrRef.current !== null) {
      Brightness.setBrightnessAsync(prevBrRef.current).catch(() => {});
      prevBrRef.current = null;
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar backgroundColor="#B71C1C" barStyle="light-content" />
      <View style={ac.container}>
        <TouchableOpacity style={ac.closeBtn} onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={ac.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={ac.scroll} showsVerticalScrollIndicator={false}>
          <Text style={ac.bigIcon}>🥜</Text>
          <Text style={ac.title}>PEANUT ALLERGY</Text>
          <Text style={ac.subtitle}>땅콩 알레르기  ·  ピーナッツアレルギー</Text>
          <View style={ac.divider} />
          {ALLERGY_TEXTS.map(({ lang, flag, text }) => (
            <View key={lang} style={ac.block}>
              <Text style={ac.blockLang}>{flag}  {lang}</Text>
              <Text style={ac.blockText}>{text}</Text>
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

// ── 지도앱 연결 ───────────────────────────────────────────
const MAP_APPS = [
  {
    label: '구글맵',   icon: '🌐', color: '#4285F4', textColor: 'white',
    url:  n => `https://maps.google.com/?q=${encodeURIComponent(n)}`,
    fallback: null,
  },
  {
    label: '네이버맵', icon: '🟢', color: '#03C75A', textColor: 'white',
    url:  n => `nmap://search?query=${encodeURIComponent(n)}`,
    fallback: n => `https://map.naver.com/search/${encodeURIComponent(n)}`,
  },
];

async function openMap(app, name) {
  const url = app.url(name);
  if (!app.fallback) { Linking.openURL(url).catch(() => {}); return; }
  const ok = await Linking.canOpenURL(url).catch(() => false);
  Linking.openURL(ok ? url : app.fallback(name)).catch(() => {});
}

// ── 정보 섹션 카드 ────────────────────────────────────────
function InfoSection({ icon, title, body, bgColor }) {
  if (!body || !body.trim()) return null;
  return (
    <View style={[d.section, bgColor ? { backgroundColor: bgColor } : null]}>
      <View style={d.sectionHeader}>
        <Text style={d.sectionIcon}>{icon}</Text>
        <Text style={d.sectionTitle}>{title}</Text>
      </View>
      <Text style={d.sectionBody}>{body}</Text>
    </View>
  );
}

// ── 소스 타입 레이블 ──────────────────────────────────────
function SourceBadge({ sourceType, isVerified, confidence, lastCheckedAt }) {
  const srcLabel = isVerified
    ? '✅ 검증됨'
    : sourceType === 'seed' || !sourceType
      ? '🗄️ 운영자 등록'
      : '👤 사용자 제보';
  const confColor = confidence === 'high' ? '#2D8A4E' : confidence === 'medium' ? '#B45309' : '#888';
  const lastDate = lastCheckedAt?.toDate?.()
    ? lastCheckedAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
    : typeof lastCheckedAt === 'string' ? lastCheckedAt : null;

  return (
    <View style={d.trustRow}>
      <Text style={[d.trustSrc, isVerified && { color: '#2D8A4E' }]}>{srcLabel}</Text>
      {confidence && confidence !== 'low' && (
        <View style={[d.trustConfPill, { borderColor: confColor }]}>
          <Text style={[d.trustConfText, { color: confColor }]}>
            {confidence === 'high' ? '신뢰도 높음' : '신뢰도 중간'}
          </Text>
        </View>
      )}
      {lastDate && <Text style={d.trustDate}>· 최종 확인 {lastDate}</Text>}
    </View>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function RestaurantDetailScreen({ item, visible, onClose, user, lang }) {
  const [showAllergyCard, setShowAllergyCard] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);

  if (!item) return null;

  const riskLevel  = normalizeRisk(item.peanutRiskTier);
  const riskCfg    = RISK_CFG[riskLevel];
  const guidanceKey = (item.allergyGuidanceLikelihood || '').toLowerCase();
  const guidanceText = GUIDANCE_CFG[guidanceKey] || null;
  const lowConf    = isLowConfidence(item.confidence);
  const cuisineType = item.cuisineType || '기타';
  const fullName   = [item.name, item.branch].filter(Boolean).join(' ');

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={d.container}>

          {/* ── 헤더 ─────────────────────────────────── */}
          <View style={d.header}>
            <TouchableOpacity onPress={onClose} style={d.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={d.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={d.headerBody}>
              <Text style={d.headerName} numberOfLines={2}>{item.name}</Text>
              {!!item.branch && (
                <Text style={d.headerBranch}>{item.branch}</Text>
              )}
              <View style={d.headerMetaRow}>
                {!!item.district && (
                  <Text style={d.headerDistrict}>📍 {item.district}</Text>
                )}
                <View style={d.cuisinePill}>
                  <Text style={d.cuisinePillText}>
                    {CUISINE_EMOJI[cuisineType] || '🍽️'} {cuisineType}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <ScrollView
            style={d.scroll}
            contentContainerStyle={d.scrollPad}
            showsVerticalScrollIndicator={false}
          >
            {/* ── 신뢰도 경고 배너 ───────────────────── */}
            {lowConf && (
              <View style={d.confWarn}>
                <Text style={d.confWarnText}>
                  ℹ️  이 정보는 참고용입니다. 방문 전 직접 확인하세요.
                </Text>
              </View>
            )}

            {/* ── 정보 출처 / 신뢰 레이어 ────────────── */}
            <SourceBadge
              sourceType={item.sourceType}
              isVerified={item.isVerified}
              confidence={item.confidence}
              lastCheckedAt={item.lastCheckedAt}
            />

            {/* ── 안전 경험 기록 CTA ─────────────────── */}
            <TouchableOpacity
              style={d.checkInCta}
              onPress={() => setShowCheckIn(true)}
              activeOpacity={0.82}
            >
              <Text style={d.checkInCtaIcon}>✓</Text>
              <View style={d.checkInCtaBody}>
                <Text style={d.checkInCtaTitle}>여기에서 먹어봤어요</Text>
                <Text style={d.checkInCtaSub}>안전 경험 기록하기 · I ate here safely</Text>
              </View>
            </TouchableOpacity>

            {/* ── 땅콩 안전도 카드 ───────────────────── */}
            <View style={[d.riskCard, { backgroundColor: riskCfg.bg, borderColor: riskCfg.border }]}>
              <View style={d.riskTopRow}>
                <Text style={d.riskBigIcon}>{riskCfg.icon}</Text>
                <View style={d.riskTextBlock}>
                  <Text style={[d.riskTagLabel, { color: riskCfg.color }]}>땅콩 위험도</Text>
                  <Text style={[d.riskTagValue, { color: riskCfg.color }]}>{riskCfg.label}</Text>
                </View>
              </View>
              {!!guidanceText && (
                <View style={[d.guidancePill, { borderColor: riskCfg.border }]}>
                  <Text style={[d.guidanceText, { color: riskCfg.color }]}>{guidanceText}</Text>
                </View>
              )}
            </View>

            {/* ── 정보 섹션들 ────────────────────────── */}
            <InfoSection
              icon="⚠️" title="왜 주의해야 하나요?"
              body={item.whyFlagged}
            />
            <InfoSection
              icon="💡" title="방문 시 이렇게 하세요"
              body={item.recommendedAction}
            />
            <InfoSection
              icon="✅" title="추천 메뉴"
              body={item.recommendedSaferItems}
              bgColor="#F0FDF4"
            />
            <InfoSection
              icon="⚠️" title="주의할 메뉴"
              body={item.cautionOrExclusion}
              bgColor="#FFFBEB"
            />
            <InfoSection
              icon="🥜" title="이 식당의 땅콩 처리 방식"
              body={item.peanutHandlingBasis}
            />

            {/* ── 하단 버튼 ──────────────────────────── */}
            <TouchableOpacity
              style={d.allergyBtn}
              onPress={() => setShowAllergyCard(true)}
              activeOpacity={0.85}
            >
              <Text style={d.allergyBtnIcon}>🥜</Text>
              <Text style={d.allergyBtnText}>알레르기 카드 보기</Text>
            </TouchableOpacity>

            <View style={d.mapRow}>
              {MAP_APPS.map(app => (
                <TouchableOpacity
                  key={app.label}
                  style={[d.mapBtn, { backgroundColor: app.color }]}
                  onPress={() => openMap(app, fullName)}
                  activeOpacity={0.75}
                >
                  <Text style={d.mapBtnIcon}>{app.icon}</Text>
                  <Text style={[d.mapBtnLabel, { color: app.textColor }]}>{app.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 36 }} />
          </ScrollView>
        </View>
      </Modal>

      <AllergyCardModal
        visible={showAllergyCard}
        onClose={() => setShowAllergyCard(false)}
      />
      <QuickSafetyReport
        visible={showCheckIn}
        restaurant={item}
        user={user}
        lang={lang}
        onClose={() => setShowCheckIn(false)}
      />
    </>
  );
}

// ── 스타일: 상세 화면 ─────────────────────────────────────
const d = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#FAF8F5',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'white', paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8',
    gap: 12,
  },
  backBtn: {
    marginTop: 4,
    backgroundColor: '#F5F0EB', borderRadius: 20,
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: '#555', lineHeight: 22 },
  headerBody: { flex: 1 },
  headerName: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', lineHeight: 26 },
  headerBranch: { fontSize: 13, color: '#888', marginTop: 2 },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  headerDistrict: { fontSize: 12, color: '#888' },
  cuisinePill: {
    backgroundColor: '#F0EDFF', borderRadius: 7,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  cuisinePillText: { fontSize: 11, color: '#5B3EE8', fontWeight: '800' },
  // 스크롤
  scroll: { flex: 1 },
  scrollPad: { padding: 16, gap: 12 },
  // 신뢰도 경고
  confWarn: {
    backgroundColor: '#EBF3FF', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#BFD7F5',
  },
  confWarnText: { fontSize: 12, color: '#2A5A9A', lineHeight: 18 },
  // 신뢰 레이어
  trustRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingHorizontal: 2 },
  trustSrc: { fontSize: 12, color: '#555', fontWeight: '600' },
  trustConfPill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  trustConfText: { fontSize: 11, fontWeight: '600' },
  trustDate: { fontSize: 11, color: '#AAA' },
  // 안전 경험 CTA
  checkInCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#E8F5EC', borderRadius: 14, borderWidth: 1.5, borderColor: '#2D8A4E',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  checkInCtaIcon: { fontSize: 22, color: '#2D8A4E', fontWeight: '900' },
  checkInCtaBody: { flex: 1 },
  checkInCtaTitle: { fontSize: 15, fontWeight: '800', color: '#1A5C33' },
  checkInCtaSub: { fontSize: 11, color: '#2D8A4E', marginTop: 2 },
  // 위험도 카드
  riskCard: {
    borderRadius: 16, borderWidth: 1.5,
    padding: 18,
  },
  riskTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  riskBigIcon: { fontSize: 40 },
  riskTextBlock: {},
  riskTagLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  riskTagValue: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  guidancePill: {
    borderTopWidth: 1, paddingTop: 12, marginTop: 4,
  },
  guidanceText: { fontSize: 13, fontWeight: '700', lineHeight: 20 },
  // 섹션
  section: {
    backgroundColor: 'white', borderRadius: 14,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#1A1A1A' },
  sectionBody: { fontSize: 13, color: '#444', lineHeight: 22 },
  // 알레르기 버튼
  allergyBtn: {
    backgroundColor: '#B71C1C', borderRadius: 14,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    shadowColor: '#B71C1C', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  allergyBtnIcon: { fontSize: 20 },
  allergyBtnText: { color: 'white', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  // 지도 버튼
  mapRow: { flexDirection: 'row', gap: 8 },
  mapBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  mapBtnIcon: { fontSize: 18 },
  mapBtnLabel: { fontSize: 11, fontWeight: '800' },
});

// ── 스타일: 알레르기 카드 ─────────────────────────────────
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
  scroll: { padding: 24, paddingTop: 56, paddingBottom: 60 },
  bigIcon: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 28, fontWeight: '900', color: 'white',
    textAlign: 'center', letterSpacing: 1.5, marginBottom: 6,
  },
  subtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.75)',
    textAlign: 'center', marginBottom: 20,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 20 },
  block: {
    backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 14, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  blockLang: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '800', marginBottom: 10 },
  blockText: { fontSize: 17, color: 'white', lineHeight: 28, fontWeight: '600' },
  footer: { fontSize: 16, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontWeight: '800', marginBottom: 4 },
  footerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});

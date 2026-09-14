// src/screens/RestaurantDetailScreen.js
import { useState } from 'react';
import {
  Modal, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { CUISINE_EMOJI } from './RestaurantScreen';
import QuickSafetyReport from '../components/QuickSafetyReport';
import { DisclaimerFooter } from '../components/Common';
import { openGoogleMaps, openNaverMap } from '../utils/openMap';
import MenuGuideSection from '../components/MenuGuideSection';
import { AllergyCardModal } from '../components/AllergyCard';

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

// ── 지도앱 연결 ───────────────────────────────────────────
const MAP_APPS = [
  { label: '구글맵',   icon: '🌐', color: '#4285F4', textColor: 'white', open: openGoogleMaps },
  { label: '네이버맵', icon: '🟢', color: '#03C75A', textColor: 'white', open: openNaverMap },
];

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
            <MenuGuideSection cuisineType={cuisineType} lang={lang} />

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
                  onPress={() => app.open({ name: fullName, address: item.address, placeId: item.placeId })}
                  activeOpacity={0.75}
                >
                  <Text style={d.mapBtnIcon}>{app.icon}</Text>
                  <Text style={[d.mapBtnLabel, { color: app.textColor }]}>{app.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 36 }} />
          </ScrollView>
          <DisclaimerFooter lang={lang} style={{ backgroundColor: 'white', paddingBottom: 12, marginTop: 0 }} />
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


// src/components/AllergyCard.js
// 알레르기 카드 본문 — 카드 탭(CardScreen)과 식당·브랜드 상세의 모달이 함께 쓴다.
// 선택(땅콩/견과, 심각도)은 기기에 저장해 어느 화면에서 열어도 같게 보인다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Brightness from 'expo-brightness';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CARD_PREFS_KEY, EMERGENCY, LANGS, cardText } from '../data/allergyCardTexts';

export const CARD_BG = '#D4622A';

// 화면이 떠 있는 동안 밝기를 최대로, 닫히면 원래대로
function useMaxBrightness(active) {
  const prev = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    Brightness.getBrightnessAsync().then(b => { prev.current = b; }).catch(() => {});
    Brightness.setBrightnessAsync(1.0).catch(() => {});
    return () => {
      if (prev.current !== null) {
        Brightness.setBrightnessAsync(prev.current).catch(() => {});
        prev.current = null;
      }
    };
  }, [active]);
}

function ToggleRow({ options, value, onChange }) {
  return (
    <View style={s.toggleRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[s.toggleBtn, value === opt.value && s.toggleBtnActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.8}
        >
          <Text style={[s.toggleText, value === opt.value && s.toggleTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function AllergyCardBody({ active = true, topPadding = 0 }) {
  const [prefs, setPrefs] = useState({ allergyType: 'peanut', severity: 'severe', staffLang: 'ko' });
  useMaxBrightness(active);

  useEffect(() => {
    AsyncStorage.getItem(CARD_PREFS_KEY)
      .then(v => { if (v) setPrefs(p => ({ ...p, ...JSON.parse(v) })); })
      .catch(() => {});
  }, []);

  const update = patch => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    AsyncStorage.setItem(CARD_PREFS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const { allergyType, severity, staffLang } = prefs;
  const peanut = allergyType === 'peanut';
  const main = LANGS.find(l => l.key === staffLang) || LANGS[0];
  const others = LANGS.filter(l => l.key !== main.key);

  return (
    <ScrollView contentContainerStyle={[s.scroll, { paddingTop: 24 + topPadding }]} showsVerticalScrollIndicator={false}>
      {/* 이 줄은 직원이 아니라 사용자에게 하는 말이라 작게 맨 위에 둔다 */}
      <Text style={s.topHint}>📱  화면을 직원에게 보여주세요 · Show this screen to the staff</Text>

      <View style={s.settingsCard}>
        <Text style={s.settingsLabel}>직원이 읽을 언어</Text>
        <ToggleRow
          value={staffLang}
          onChange={v => update({ staffLang: v })}
          options={LANGS.map(l => ({ value: l.key, label: l.flag }))}
        />
        <Text style={[s.settingsLabel, { marginTop: 12 }]}>알레르기 종류</Text>
        <ToggleRow
          value={allergyType}
          onChange={v => update({ allergyType: v })}
          options={[{ value: 'peanut', label: '🥜 땅콩' }, { value: 'nut', label: '🌰 견과류' }]}
        />
        <Text style={[s.settingsLabel, { marginTop: 12 }]}>증상 수준</Text>
        <ToggleRow
          value={severity}
          onChange={v => update({ severity: v })}
          options={[{ value: 'severe', label: '⚠️ 심각해서' }, { value: 'mild', label: '💛 알레르기 있어서' }]}
        />
      </View>

      <View style={s.divider} />
      <Text style={s.icon}>{peanut ? '🥜' : '🌰'}</Text>
      <Text style={s.title}>{peanut ? 'PEANUT ALLERGY' : 'NUT ALLERGY'}</Text>

      {/* 고른 언어를 크게 — 이걸 읽는 사람은 직원이다 */}
      <View style={s.mainBlock}>
        <Text style={s.mainText}>{cardText(main.key, allergyType, severity)}</Text>
      </View>

      {severity === 'severe' && (
        <View style={s.emergency}>
          <Text style={s.emergencyTitle}>🚑  응급 시 · In an emergency</Text>
          {(EMERGENCY.find(e => e.key === main.key) ? [EMERGENCY.find(e => e.key === main.key)] : EMERGENCY)
            .map(e => <Text key={e.key} style={s.emergencyText}>{e.text}</Text>)}
        </View>
      )}

      <View style={s.divider} />
      <Text style={s.otherLabel}>다른 언어 · Other languages</Text>
      {others.map(({ key, label, flag }) => (
        <View key={key} style={s.langBlock}>
          <Text style={s.langLabel}>{flag}  {label}</Text>
          <Text style={s.langText}>{cardText(key, allergyType, severity)}</Text>
        </View>
      ))}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

export function AllergyCardModal({ visible, onClose }) {
  const top = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 56;
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar backgroundColor={CARD_BG} barStyle="light-content" />
      <View style={[s.container, { paddingTop: top }]}>
        <TouchableOpacity style={[s.closeBtn, { top: top + 12 }]} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
        {visible && <AllergyCardBody active={visible} topPadding={36} />}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: CARD_BG },
  closeBtn: {
    position: 'absolute', right: 20, zIndex: 10, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: 'white', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  scroll: { padding: 24, paddingBottom: 60 },
  settingsCard: {
    backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 4,
  },
  settingsLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  toggleBtnActive: { backgroundColor: 'white', borderColor: 'white' },
  toggleText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  toggleTextActive: { color: CARD_BG, fontWeight: '800' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 20 },
  icon: { fontSize: 52, textAlign: 'center', marginBottom: 12, marginTop: 8 },
  title: { fontSize: 28, fontWeight: '900', color: 'white', textAlign: 'center', letterSpacing: 1.5, marginBottom: 6 },
  topHint: { fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 14, fontWeight: '700' },
  mainBlock: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginTop: 4 },
  mainText: { fontSize: 24, lineHeight: 36, color: '#1F1F1F', fontWeight: '800' },
  otherLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  langBlock: {
    backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 14, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  langLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '800', marginBottom: 10, letterSpacing: 0.5 },
  langText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 20, fontWeight: '500' },
  emergency: { backgroundColor: 'white', borderRadius: 14, padding: 18, marginTop: 4 },
  emergencyTitle: { fontSize: 14, fontWeight: '900', color: '#B71C1C', marginBottom: 8 },
  emergencyText: { fontSize: 15, color: '#2B2B2B', lineHeight: 24, fontWeight: '600', marginBottom: 6 },
  footer: { fontSize: 16, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontWeight: '800', marginBottom: 4 },
  footerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});

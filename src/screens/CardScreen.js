// src/screens/CardScreen.js
// 알레르기 카드 — 직원에게 보여주는 전용 화면
import * as Brightness from 'expo-brightness';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BG = '#D4622A'; // 앱 오렌지 계열 — 친근하되 눈에 띄는 색

// allergyType: 'peanut' | 'nut'
// severity:    'severe'  | 'mild'
const TEXTS = {
  ko: {
    peanut: {
      severe: '저는 땅콩 알레르기가 있습니다. 알레르기 반응이 심각하여 생명에 위험할 수 있습니다. 이 음식에 땅콩이나 땅콩 기름이 들어있나요? 주의 깊게 확인해 주세요.',
      mild:   '저는 땅콩 알레르기가 있습니다. 이 음식에 땅콩이나 땅콩 기름이 들어있나요? 주의 깊게 확인해 주세요.',
    },
    nut: {
      severe: '저는 견과류 알레르기가 있습니다. 알레르기 반응이 심각하여 생명에 위험할 수 있습니다. 이 음식에 견과류가 들어있나요? 주의 깊게 확인해 주세요.',
      mild:   '저는 견과류 알레르기가 있습니다. 이 음식에 견과류가 들어있나요? 주의 깊게 확인해 주세요.',
    },
  },
  en: {
    peanut: {
      severe: 'I have a peanut allergy. My allergy is severe and life-threatening. Does this dish contain peanuts or peanut oil? Please check carefully.',
      mild:   'I have a peanut allergy. Does this dish contain peanuts or peanut oil? Please check carefully.',
    },
    nut: {
      severe: 'I have a nut allergy. My allergy is severe and life-threatening. Does this dish contain nuts or nut oil? Please check carefully.',
      mild:   'I have a nut allergy. Does this dish contain nuts or nut oil? Please check carefully.',
    },
  },
  ja: {
    peanut: {
      severe: '私はピーナッツアレルギーがあります。アレルギー反応が重篤で、生命に関わる場合があります。この料理にピーナッツやピーナッツオイルは含まれていますか？',
      mild:   '私はピーナッツアレルギーがあります。この料理にピーナッツやピーナッツオイルは含まれていますか？',
    },
    nut: {
      severe: '私はナッツアレルギーがあります。アレルギー反応が重篤で、生命に関わる場合があります。この料理にナッツ類は含まれていますか？',
      mild:   '私はナッツアレルギーがあります。この料理にナッツ類は含まれていますか？',
    },
  },
  zh: {
    peanut: {
      severe: '我对花生过敏。我的过敏反应很严重，可能危及生命。这道菜含有花生或花生油吗？请仔细确认。',
      mild:   '我对花生过敏。这道菜含有花生或花生油吗？请仔细确认。',
    },
    nut: {
      severe: '我对坚果过敏。我的过敏反应很严重，可能危及生命。这道菜含有坚果吗？请仔细确认。',
      mild:   '我对坚果过敏。这道菜含有坚果吗？请仔细确认。',
    },
  },
};

const LANGS = [
  { key: 'ko', label: '한국어', flag: '🇰🇷' },
  { key: 'en', label: 'English', flag: '🇺🇸' },
  { key: 'ja', label: '日本語', flag: '🇯🇵' },
  { key: 'zh', label: '中文',   flag: '🇨🇳' },
];

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
          <Text style={[s.toggleText, value === opt.value && s.toggleTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function CardScreen() {
  const prevBrightnessRef = useRef(null);
  const [allergyType, setAllergyType] = useState('peanut'); // 'peanut' | 'nut'
  const [severity, setSeverity]       = useState('severe');  // 'severe' | 'mild'

  useEffect(() => {
    Brightness.getBrightnessAsync()
      .then(b => { prevBrightnessRef.current = b; })
      .catch(() => {});
    Brightness.setBrightnessAsync(1.0).catch(() => {});
    return () => {
      if (prevBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(prevBrightnessRef.current).catch(() => {});
        prevBrightnessRef.current = null;
      }
    };
  }, []);

  const titleText = allergyType === 'peanut' ? 'PEANUT ALLERGY' : 'NUT ALLERGY';
  const subtitleText = allergyType === 'peanut'
    ? '땅콩 알레르기  ·  ピーナッツアレルギー  ·  花生过敏'
    : '견과류 알레르기  ·  ナッツアレルギー  ·  坚果过敏';

  return (
    <View style={s.container}>
      <StatusBar backgroundColor={BG} barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* 설정 토글 */}
        <View style={s.settingsCard}>
          <Text style={s.settingsLabel}>알레르기 종류</Text>
          <ToggleRow
            value={allergyType}
            onChange={setAllergyType}
            options={[
              { value: 'peanut', label: '🥜 땅콩' },
              { value: 'nut',    label: '🌰 견과류' },
            ]}
          />
          <Text style={[s.settingsLabel, { marginTop: 12 }]}>증상 수준</Text>
          <ToggleRow
            value={severity}
            onChange={setSeverity}
            options={[
              { value: 'severe', label: '⚠️ 심각해서' },
              { value: 'mild',   label: '💛 알레르기 있어서' },
            ]}
          />
        </View>

        <View style={s.divider} />

        <Text style={s.icon}>🥜</Text>
        <Text style={s.title}>{titleText}</Text>
        <Text style={s.subtitle}>{subtitleText}</Text>

        <View style={s.divider} />

        {LANGS.map(({ key, label, flag }) => (
          <View key={key} style={s.langBlock}>
            <Text style={s.langLabel}>{flag}  {label}</Text>
            <Text style={s.langText}>{TEXTS[key][allergyType][severity]}</Text>
          </View>
        ))}

        <View style={s.divider} />
        <Text style={s.footer}>📱  화면을 직원에게 보여주세요</Text>
        <Text style={s.footerSub}>Show this screen to the staff</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  scroll: { padding: 24, paddingBottom: 60 },

  // 설정 카드
  settingsCard: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  settingsLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.7)',
    fontWeight: '700', letterSpacing: 0.5, marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row', gap: 8,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  toggleBtnActive: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  toggleText: {
    fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600',
  },
  toggleTextActive: {
    color: BG, fontWeight: '800',
  },

  divider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 20,
  },
  icon: { fontSize: 52, textAlign: 'center', marginBottom: 12, marginTop: 8 },
  title: {
    fontSize: 28, fontWeight: '900', color: 'white',
    textAlign: 'center', letterSpacing: 1.5, marginBottom: 6,
  },
  subtitle: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', marginBottom: 20,
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
    fontSize: 17, color: 'white', lineHeight: 28, fontWeight: '600',
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

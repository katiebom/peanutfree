// src/screens/ProfileSetupScreen.js
import React, { useState } from 'react';
import {
  ScrollView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Modal
} from 'react-native';
import { saveAllergyProfile } from '../firebase/dbService';
import { SENSITIVE_CONSENT_VERSION, openLegal } from '../data/legal';

// ── Translations ─────────────────────────────────────────────

const STRINGS = {
  ko: {
    screenTitle: '알레르기 프로필 설정',
    screenSub: '더 정확한 정보를 드릴게요. 언제든 수정할 수 있어요.',
    section1: '누구를 위해 사용하시나요?',
    chips1: ['자녀를 위해', '본인', '가족 구성원'],
    childNameLabel: '아이 이름 또는 별명',
    childNamePlaceholder: '예) 민준이, 쿠키',
    childAgeLabel: '나이 (선택)',
    childAgePlaceholder: '예) 7세',
    section2: '알레르기 종류',
    chips2: ['땅콩', '견과류', '땅콩+견과류'],
    section3: '알레르기 심각도',
    severityItems: [
      { key: 'severe',   label: '심각 — 에피펜 보유',   sub: '아나필락시스 위험',  color: '#C13A2D', bg: '#FFF0EE' },
      { key: 'moderate', label: '보통 — 두드러기·구토',  sub: '즉각 치료 필요',    color: '#C17C1A', bg: '#FDF3E3' },
      { key: 'mild',     label: '경미 — 약한 반응',      sub: '조심은 필요',       color: '#2D8A4E', bg: '#E8F5ED' },
    ],
    severityEmoji: { severe: '🚨', moderate: '⚠️', mild: '💛' },
    section4: '주로 사용하는 지역 (선택)',
    regionPlaceholder: '예) 서울 강남구, 경기 분당',
    saveBtn: '저장하고 시작하기 🚀',
    skipBtn: '나중에 설정하기',
    modalTitle: '프로필 수정',
    modalSaveBtn: '저장하기',
    savingError: '저장 중 오류가 발생했어요. 다시 시도해주세요.',
    error: '오류',
    sensTitle: '[필수] 민감정보(알레르기 정보) 수집·이용 동의',
    sensBody: '• 항목: 알레르기 대상, 자녀 이름·나이(입력 시), 알레르기 종류, 심각도, 지역(입력 시)\n• 목적: 알레르기 정보에 맞춘 안전 표시 (광고·마케팅 사용 안 함)\n• 보관: 동의 철회 또는 탈퇴 시까지, 철회 즉시 삭제\n• 동의를 거부해도 프로필 외 기능은 이용할 수 있어요. 마이페이지에서 언제든 철회할 수 있어요.\n• 자녀 정보는 보호자(법정대리인)가 입력해주세요. 실명 대신 별명을 권장해요.',
    sensCheck: '위 내용을 확인했으며 민감정보 수집·이용에 동의합니다.',
    sensLink: '개인정보처리방침 보기',
    sensNeed: '동의하면 저장할 수 있어요',
  },
  en: {
    screenTitle: 'Allergy Profile Setup',
    screenSub: "We'll personalize your experience. You can edit anytime.",
    section1: 'Who is this for?',
    chips1: ['For my child', 'For myself', 'For family'],
    childNameLabel: "Child's name or nickname",
    childNamePlaceholder: 'e.g. Minju, Cookie',
    childAgeLabel: 'Age (optional)',
    childAgePlaceholder: 'e.g. 7',
    section2: 'Allergy type',
    chips2: ['Peanut', 'Tree nuts', 'Both'],
    section3: 'Severity',
    severityItems: [
      { key: 'severe',   label: 'Severe — carry EpiPen',      sub: 'Risk of anaphylaxis',    color: '#C13A2D', bg: '#FFF0EE' },
      { key: 'moderate', label: 'Moderate — hives/vomiting',  sub: 'Needs prompt treatment', color: '#C17C1A', bg: '#FDF3E3' },
      { key: 'mild',     label: 'Mild — minor reaction',      sub: 'Still need to be careful', color: '#2D8A4E', bg: '#E8F5ED' },
    ],
    severityEmoji: { severe: '🚨', moderate: '⚠️', mild: '💛' },
    section4: 'Your region (optional)',
    regionPlaceholder: 'e.g. Seoul, Bundang',
    saveBtn: 'Save & Start 🚀',
    skipBtn: 'Skip for now',
    modalTitle: 'Edit Profile',
    modalSaveBtn: 'Save',
    savingError: 'An error occurred while saving. Please try again.',
    error: 'Error',
    sensTitle: '[Required] Consent to collect sensitive data (allergy information)',
    sensBody: '• Data: who the allergy applies to, child name/age (if entered), allergy type, severity, region (if entered)\n• Purpose: safety labels matched to your allergy (never used for ads or marketing)\n• Retention: until you withdraw consent or delete your account; deleted immediately on withdrawal\n• You can decline and still use everything except the profile. Withdraw anytime from My Page.\n• Please have a legal guardian enter a child\'s information, ideally using a nickname.',
    sensCheck: 'I have read the above and consent to the collection and use of sensitive data.',
    sensLink: 'Read the Privacy Policy',
    sensNeed: 'Consent to enable saving',
  },
};

const TARGET_KEYS = ['child', 'self', 'family'];
const TARGET_EMOJI = ['👶', '🙋', '👨‍👩‍👧'];
const TYPE_KEYS = ['peanut', 'nut', 'both'];
const TYPE_EMOJI = ['🥜', '🌰', '🥜🌰'];

// ── Shared form component ─────────────────────────────────────

function ProfileForm({ lang, initialData, onSave, onSkip, isModal }) {
  const s = STRINGS[lang] || STRINGS.ko;

  const [allergyTarget, setAllergyTarget] = useState(initialData?.allergyTarget || 'self');
  const [childName, setChildName] = useState(initialData?.childName || '');
  const [childAge, setChildAge] = useState(initialData?.childAge || '');
  const [allergyType, setAllergyType] = useState(initialData?.allergyType || 'peanut');
  const [severity, setSeverity] = useState(initialData?.severity || 'severe');
  const [region, setRegion] = useState(initialData?.region || '');
  const [saving, setSaving] = useState(false);
  // 같은 버전으로 이미 동의했다면 체크된 상태로 시작한다 (이전 버전·미동의 기존 사용자는 다시 받는다)
  const [sensConsent, setSensConsent] = useState(
    initialData?.sensitiveConsent?.version === SENSITIVE_CONSENT_VERSION
  );

  async function handleSave() {
    if (!sensConsent) return;
    setSaving(true);
    try {
      await onSave({ allergyTarget, childName, childAge, allergyType, severity, region });
    } catch (e) {
      Alert.alert(s.error, s.savingError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {!isModal && (
        <View style={styles.topHeader}>
          <Text style={styles.screenTitle}>{s.screenTitle}</Text>
          <Text style={styles.screenSub}>{s.screenSub}</Text>
        </View>
      )}

      {/* Section 1: Who */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{s.section1}</Text>
        <View style={styles.chipRow}>
          {TARGET_KEYS.map((key, i) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, allergyTarget === key && styles.chipActive]}
              onPress={() => setAllergyTarget(key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, allergyTarget === key && styles.chipTextActive]}>
                {TARGET_EMOJI[i]} {s.chips1[i]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {allergyTarget === 'child' && (
          <View style={styles.childBlock}>
            <Text style={styles.fieldLabel}>{s.childNameLabel}</Text>
            <TextInput
              style={styles.textInput}
              value={childName}
              onChangeText={setChildName}
              placeholder={s.childNamePlaceholder}
              placeholderTextColor="#BBB"
            />
            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{s.childAgeLabel}</Text>
            <TextInput
              style={styles.textInput}
              value={childAge}
              onChangeText={setChildAge}
              placeholder={s.childAgePlaceholder}
              placeholderTextColor="#BBB"
              keyboardType="numeric"
            />
          </View>
        )}
      </View>

      {/* Section 2: Allergy type */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{s.section2}</Text>
        <View style={styles.chipRow}>
          {TYPE_KEYS.map((key, i) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, allergyType === key && styles.chipActive]}
              onPress={() => setAllergyType(key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, allergyType === key && styles.chipTextActive]}>
                {TYPE_EMOJI[i]} {s.chips2[i]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Section 3: Severity */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{s.section3}</Text>
        {s.severityItems.map(item => {
          const selected = severity === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.severityCard,
                { backgroundColor: item.bg },
                selected && styles.severityCardSelected,
              ]}
              onPress={() => setSeverity(item.key)}
              activeOpacity={0.8}
            >
              <View style={styles.severityCardLeft}>
                <Text style={styles.severityEmoji}>{s.severityEmoji[item.key]}</Text>
                <View style={styles.severityCardText}>
                  <Text style={[styles.severityLabel, { color: item.color }]}>{item.label}</Text>
                  <Text style={styles.severitySub}>{item.sub}</Text>
                </View>
              </View>
              <View style={[styles.radio, selected && { borderColor: item.color }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: item.color }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Section 4: Region */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{s.section4}</Text>
        <TextInput
          style={styles.textInput}
          value={region}
          onChangeText={setRegion}
          placeholder={s.regionPlaceholder}
          placeholderTextColor="#BBB"
        />
      </View>

      {/* 민감정보 별도 동의 */}
      <View style={styles.sensBox}>
        <Text style={styles.sensTitle}>{s.sensTitle}</Text>
        <Text style={styles.sensBody}>{s.sensBody}</Text>
        <TouchableOpacity onPress={() => openLegal('privacy', lang)} accessibilityRole="link">
          <Text style={styles.sensLink}>{s.sensLink}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sensCheckRow}
          onPress={() => setSensConsent(v => !v)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: sensConsent }}
        >
          <View style={[styles.sensCheckbox, sensConsent && styles.sensCheckboxOn]}>
            {sensConsent && <Text style={styles.sensCheckmark}>✓</Text>}
          </View>
          <Text style={styles.sensCheckText}>{s.sensCheck}</Text>
        </TouchableOpacity>
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={[styles.saveBtn, (saving || !sensConsent) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving || !sensConsent}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="white" />
          : <Text style={styles.saveBtnText}>{isModal ? s.modalSaveBtn : s.saveBtn}</Text>
        }
      </TouchableOpacity>
      {!sensConsent && <Text style={styles.sensNeed}>{s.sensNeed}</Text>}

      {!isModal && onSkip && (
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>{s.skipBtn}</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Default export: full-screen setup ────────────────────────

export default function ProfileSetupScreen({ user, lang, onDone, onSkip }) {
  async function handleSave(data) {
    await saveAllergyProfile(user.uid, data, SENSITIVE_CONSENT_VERSION);
    onDone();
  }

  return (
    <View style={styles.container}>
      <ProfileForm
        lang={lang}
        initialData={null}
        onSave={handleSave}
        onSkip={onSkip}
        isModal={false}
      />
    </View>
  );
}

// ── Named export: edit modal ──────────────────────────────────

export function ProfileEditModal({ visible, user, lang, initialData, onClose, onSaved }) {
  const s = STRINGS[lang] || STRINGS.ko;

  async function handleSave(data) {
    await saveAllergyProfile(user.uid, data, SENSITIVE_CONSENT_VERSION);
    onSaved();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{s.modalTitle}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
            <Text style={styles.modalCloseBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ProfileForm
          lang={lang}
          initialData={initialData}
          onSave={handleSave}
          onSkip={null}
          isModal={true}
        />
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  topHeader: { marginBottom: 24 },
  screenTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', marginBottom: 6 },
  screenSub: { fontSize: 13, color: '#888', lineHeight: 19 },

  section: {
    backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionLabel: { fontSize: 13, fontWeight: '900', color: '#333', marginBottom: 12 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#F5F0EB', borderRadius: 20,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#FFF2ED', borderColor: '#E8704A' },
  chipText: { fontSize: 13, color: '#666', fontWeight: '600' },
  chipTextActive: { color: '#E8704A', fontWeight: '800' },

  childBlock: {
    marginTop: 14, backgroundColor: '#FFF8F5', borderRadius: 10,
    padding: 14, borderWidth: 1, borderColor: '#F5C6A8',
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 6 },
  textInput: {
    backgroundColor: '#FAF8F5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1A1A1A', borderWidth: 1, borderColor: '#E8E0D8',
  },

  severityCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  severityCardSelected: { borderColor: '#E8704A' },
  severityCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  severityEmoji: { fontSize: 20 },
  severityCardText: { flex: 1 },
  severityLabel: { fontSize: 13, fontWeight: '800' },
  severitySub: { fontSize: 11, color: '#888', marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#CCC',
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  saveBtn: {
    backgroundColor: '#E8704A', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#E8704A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '900' },

  sensBox: {
    backgroundColor: '#FFF8E7', borderWidth: 1.5, borderColor: '#F5C842',
    borderRadius: 12, padding: 14, marginBottom: 14,
  },
  sensTitle: { fontSize: 13, fontWeight: '900', color: '#8B6914', marginBottom: 8 },
  sensBody: { fontSize: 12, color: '#6B5210', lineHeight: 19 },
  sensLink: { fontSize: 12, color: '#2A5A9A', textDecorationLine: 'underline', marginTop: 8, paddingVertical: 4 },
  sensCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  sensCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D9B84A',
    backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  sensCheckboxOn: { backgroundColor: '#E8704A', borderColor: '#E8704A' },
  sensCheckmark: { color: 'white', fontSize: 13, fontWeight: '900' },
  sensCheckText: { flex: 1, fontSize: 12, color: '#6B5210', lineHeight: 19, fontWeight: '700' },
  sensNeed: { fontSize: 11, color: '#AAA', textAlign: 'center', marginTop: 8 },

  skipBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  skipBtnText: { fontSize: 13, color: '#AAA', fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#FAF8F5' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8',
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#1A1A1A' },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F5F0EB', alignItems: 'center', justifyContent: 'center',
  },
  modalCloseBtnText: { fontSize: 14, color: '#666', fontWeight: '700' },
});

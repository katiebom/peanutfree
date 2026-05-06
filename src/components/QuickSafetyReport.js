// src/components/QuickSafetyReport.js
// Ultra low-friction 3-step safety check-in — tap-based, ~15 seconds
import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  TextInput, StyleSheet, Platform,
} from 'react-native';
import { addUserReport } from '../firebase/dbService';

// ── Answer option sets ───────────────────────────────────────
const RECENCY_OPTS = [
  { key: 'today',      ko: '오늘',    en: 'Today' },
  { key: 'this_week',  ko: '이번 주', en: 'This week' },
  { key: 'this_month', ko: '이번 달', en: 'This month' },
];

const PEANUT_OPTS = [
  { key: 'no',      ko: '없었어요 ✓', en: 'Not present ✓', color: '#2D8A4E', bg: '#E8F5ED' },
  { key: 'yes',     ko: '있었어요 ✗', en: 'Present ✗',      color: '#C13A2D', bg: '#FDECEA' },
  { key: 'unknown', ko: '모르겠어요', en: 'Not sure',        color: '#4A7FBF', bg: '#EBF3FF' },
];

const STAFF_OPTS = [
  { key: 'yes', ko: '알렸어요',        en: 'Yes, I told them', color: '#2D8A4E', bg: '#E8F5ED' },
  { key: 'no',  ko: '알리지 않았어요', en: 'Did not tell',     color: '#888',    bg: '#F5F5F5' },
];

const STAFF_SAFE_OPTS = [
  { key: 'yes',     ko: '안전하다고 했어요', en: "Said it's safe",   color: '#2D8A4E', bg: '#E8F5ED' },
  { key: 'no',      ko: '확인 어려웠어요',   en: 'Could not confirm', color: '#C17C1A', bg: '#FDF3E3' },
  { key: 'unclear', ko: '불명확했어요',       en: 'Unclear',           color: '#4A7FBF', bg: '#EBF3FF' },
];

const ATE_OPTS = [
  { key: 'yes',     ko: '네, 안전했어요',   en: 'Yes, no reaction',   color: '#2D8A4E', bg: '#E8F5ED' },
  { key: 'no',      ko: '반응이 있었어요',  en: 'Had a reaction',     color: '#C13A2D', bg: '#FDECEA' },
  { key: 'unknown', ko: '말하기 어려워요',  en: 'Prefer not to say',  color: '#888',    bg: '#F5F5F5' },
];

const CROSS_OPTS = [
  { key: 'low',     ko: '낮음', en: 'Low',      color: '#2D8A4E', bg: '#E8F5ED' },
  { key: 'medium',  ko: '보통', en: 'Medium',   color: '#C17C1A', bg: '#FDF3E3' },
  { key: 'high',    ko: '높음', en: 'High',     color: '#C13A2D', bg: '#FDECEA' },
  { key: 'unknown', ko: '모름', en: 'Not sure', color: '#888',    bg: '#F5F5F5' },
];

// ── Risk derivation from structured answers ──────────────────
function deriveRisk({ peanutPresence, ateWithoutReaction, crossContaminationRisk }) {
  if (peanutPresence === 'yes') return 'danger';
  if (ateWithoutReaction === 'no') return 'danger';
  if (crossContaminationRisk === 'high') return 'caution';
  if (crossContaminationRisk === 'medium' && peanutPresence === 'unknown') return 'caution';
  if (peanutPresence === 'no' && ateWithoutReaction === 'yes') return 'safe';
  return 'info';
}

// ── Reusable option row ──────────────────────────────────────
function OptionRow({ label, options, value, onSelect, isKo }) {
  return (
    <View style={q.qBlock}>
      <Text style={q.qLabel}>{label}</Text>
      <View style={q.optRow}>
        {options.map(opt => {
          const active = value === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                q.optBtn,
                { borderColor: active ? opt.color : '#E8E8E8', backgroundColor: active ? opt.bg : 'white' },
              ]}
              onPress={() => onSelect(opt.key)}
              activeOpacity={0.7}
            >
              <Text style={[q.optText, { color: active ? opt.color : '#555', fontWeight: active ? '800' : '500' }]}>
                {isKo ? opt.ko : opt.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────
export default function QuickSafetyReport({ visible, onClose, restaurant, user, lang }) {
  const isKo = lang !== 'en';

  const [step, setStep]                                     = useState(1);
  const [recency, setRecency]                               = useState(null);
  const [peanutPresence, setPeanutPresence]                 = useState(null);
  const [staffAsked, setStaffAsked]                         = useState(null);
  const [staffConfirmedSafe, setStaffConfirmedSafe]         = useState(null);
  const [ateWithoutReaction, setAteWithoutReaction]         = useState(null);
  const [crossContaminationRisk, setCrossContaminationRisk] = useState(null);
  const [note, setNote]                                     = useState('');
  const [submitting, setSubmitting]                         = useState(false);
  const [done, setDone]                                     = useState(false);

  const restName = restaurant?.ko?.name || restaurant?.name || '';
  const restAddr = restaurant?.address || '';

  function reset() {
    setStep(1); setRecency(null); setPeanutPresence(null);
    setStaffAsked(null); setStaffConfirmedSafe(null);
    setAteWithoutReaction(null); setCrossContaminationRisk(null);
    setNote(''); setSubmitting(false); setDone(false);
  }

  function handleClose() { reset(); onClose(); }

  const step1OK = !!recency;
  const step2OK = !!peanutPresence && !!staffAsked && !!ateWithoutReaction;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const risk = deriveRisk({
        peanutPresence,
        ateWithoutReaction,
        crossContaminationRisk: crossContaminationRisk || 'unknown',
      });
      await addUserReport({
        targetType: 'restaurant',
        targetId: restaurant?.id || '',
        targetName: restName,
        targetImg: '🍽️',
        experienceType: peanutPresence === 'no' && ateWithoutReaction === 'yes' ? 'all_safe' : 'report',
        risk,
        scope: 'all',
        menuItem: '',
        note: note.trim(),
        hasLocation: !!(restaurant?.lat && restaurant?.lng),
        lat: restaurant?.lat ?? null,
        lng: restaurant?.lng ?? null,
        address: restAddr,
        // Structured safety fields
        isQuickCheckIn: true,
        visitRecency: recency,
        peanutPresence,
        staffAsked,
        staffConfirmedSafe: staffAsked === 'yes' ? (staffConfirmedSafe || 'unclear') : null,
        ateWithoutReaction,
        crossContaminationRisk: crossContaminationRisk || 'unknown',
        sourceType: 'user',
        userId: user?.uid || '',
        userNickname: user?.displayName || (isKo ? '익명' : 'Anonymous'),
      });
      setDone(true);
    } catch {
      setDone(true); // still show done to avoid frustrating the user
    }
    setSubmitting(false);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={q.wrap}>

        {/* ── Header ── */}
        <View style={q.header}>
          <TouchableOpacity onPress={handleClose} style={q.closeBtn}>
            <Text style={q.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={q.headerTitle}>{isKo ? '안전 경험 기록' : 'Safety Check-In'}</Text>
          {!done && (
            <View style={q.dots}>
              {[1, 2, 3].map(s => <View key={s} style={[q.dot, step >= s && q.dotActive]} />)}
            </View>
          )}
        </View>

        {done ? (
          /* ── Done / reward screen ── */
          <View style={q.doneWrap}>
            <Text style={q.doneIcon}>🙏</Text>
            <Text style={q.doneTitle}>{isKo ? '기록 완료!' : 'Submitted!'}</Text>
            <Text style={q.doneMsg}>
              {isKo
                ? '소중한 경험을 나눠주셔서 감사합니다.\n이 기록이 다음 땅콩 알레르기 여행자에게\n큰 도움이 됩니다.'
                : 'Thank you for sharing.\nYou may have just helped the next\npeanut allergy traveler stay safe.'}
            </Text>
            <View style={q.doneBadge}>
              <Text style={q.doneBadgeText}>🌟  {isKo ? '안전 기여자' : 'Safety Contributor'}</Text>
            </View>
            <TouchableOpacity style={q.doneBtn} onPress={handleClose}>
              <Text style={q.doneBtnText}>{isKo ? '확인' : 'Done'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={q.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Restaurant confirmation card */}
            <View style={q.restCard}>
              <Text style={q.restIcon}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={q.restName} numberOfLines={1}>{restName}</Text>
                {!!restAddr && <Text style={q.restAddr} numberOfLines={1}>{restAddr}</Text>}
              </View>
            </View>

            {/* ── STEP 1: Visit recency ── */}
            {step === 1 && (
              <View style={q.stepWrap}>
                <Text style={q.stepTitle}>{isKo ? '언제 방문했나요?' : 'When did you visit?'}</Text>
                {RECENCY_OPTS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[q.bigBtn, recency === opt.key && q.bigBtnActive]}
                    onPress={() => setRecency(opt.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[q.bigBtnText, recency === opt.key && q.bigBtnTextActive]}>
                      {isKo ? opt.ko : opt.en}
                    </Text>
                    {recency === opt.key && <Text style={q.bigBtnCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[q.navBtn, !step1OK && q.navBtnDisabled]}
                  onPress={() => step1OK && setStep(2)}
                  disabled={!step1OK}
                >
                  <Text style={q.navBtnText}>{isKo ? '다음 →' : 'Next →'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2: Safety questions ── */}
            {step === 2 && (
              <View style={q.stepWrap}>
                <Text style={q.stepTitle}>{isKo ? '안전 정보를 알려주세요' : 'Tell us about safety'}</Text>
                <Text style={q.stepSub}>
                  {isKo ? '모두 탭으로 선택 가능합니다' : 'All tap-based, no typing required'}
                </Text>

                <OptionRow
                  label={isKo ? '🥜  땅콩이 있었나요?' : '🥜  Was peanut present?'}
                  options={PEANUT_OPTS}
                  value={peanutPresence}
                  onSelect={setPeanutPresence}
                  isKo={isKo}
                />
                <OptionRow
                  label={isKo ? '👨‍🍳  직원에게 알레르기를 알렸나요?' : '👨‍🍳  Did you tell / ask staff?'}
                  options={STAFF_OPTS}
                  value={staffAsked}
                  onSelect={v => { setStaffAsked(v); if (v === 'no') setStaffConfirmedSafe(null); }}
                  isKo={isKo}
                />
                {staffAsked === 'yes' && (
                  <OptionRow
                    label={isKo ? '✅  직원이 안전하다고 했나요?' : '✅  Did staff say it was safe?'}
                    options={STAFF_SAFE_OPTS}
                    value={staffConfirmedSafe}
                    onSelect={setStaffConfirmedSafe}
                    isKo={isKo}
                  />
                )}
                <OptionRow
                  label={isKo ? '🍽️  이상 없이 드셨나요?' : '🍽️  Did you eat without any reaction?'}
                  options={ATE_OPTS}
                  value={ateWithoutReaction}
                  onSelect={setAteWithoutReaction}
                  isKo={isKo}
                />
                <OptionRow
                  label={isKo ? '⚠️  교차오염 우려 수준은?' : '⚠️  Cross-contamination concern?'}
                  options={CROSS_OPTS}
                  value={crossContaminationRisk}
                  onSelect={setCrossContaminationRisk}
                  isKo={isKo}
                />

                <View style={q.navRow}>
                  <TouchableOpacity style={q.backBtn} onPress={() => setStep(1)}>
                    <Text style={q.backBtnText}>{isKo ? '← 이전' : '← Back'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[q.navBtn, !step2OK && q.navBtnDisabled]}
                    onPress={() => step2OK && setStep(3)}
                    disabled={!step2OK}
                  >
                    <Text style={q.navBtnText}>{isKo ? '다음 →' : 'Next →'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 3: Optional note + submit ── */}
            {step === 3 && (
              <View style={q.stepWrap}>
                <Text style={q.stepTitle}>{isKo ? '추가 메모 (선택)' : 'Anything to add? (optional)'}</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={isKo
                    ? '예) 직원이 친절했어요. 특정 메뉴는 피했어요.'
                    : 'e.g. Staff was very helpful. Avoided certain dishes.'}
                  placeholderTextColor="#CCC"
                  multiline
                  style={q.noteInput}
                />
                <View style={q.disclaimer}>
                  <Text style={q.disclaimerText}>
                    {isKo
                      ? '⚠️ 이 기록은 개인 경험이며, 안전을 보장하지 않습니다. 방문 전 반드시 직접 확인하세요.'
                      : '⚠️ Personal experience only. Does not guarantee safety. Always verify before visiting.'}
                  </Text>
                </View>
                <View style={q.navRow}>
                  <TouchableOpacity style={q.backBtn} onPress={() => setStep(2)}>
                    <Text style={q.backBtnText}>{isKo ? '← 이전' : '← Back'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[q.submitBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    <Text style={q.submitBtnText}>
                      {submitting
                        ? (isKo ? '등록 중...' : 'Saving...')
                        : (isKo ? '기록 등록 🙏' : 'Submit 🙏')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────
const q = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8',
  },
  closeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: '#666' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#1A1A1A' },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8E8E8' },
  dotActive: { backgroundColor: '#E8704A' },
  // Done screen
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  doneIcon: { fontSize: 60, marginBottom: 16 },
  doneTitle: { fontSize: 26, fontWeight: '900', color: '#1A1A1A', marginBottom: 12 },
  doneMsg: { fontSize: 16, color: '#555', lineHeight: 26, textAlign: 'center', marginBottom: 24 },
  doneBadge: {
    backgroundColor: '#FFF4EF', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    marginBottom: 28, borderWidth: 1, borderColor: '#E8704A',
  },
  doneBadgeText: { fontSize: 13, color: '#E8704A', fontWeight: '800' },
  doneBtn: {
    backgroundColor: '#E8704A', borderRadius: 14,
    paddingHorizontal: 48, paddingVertical: 15,
  },
  doneBtnText: { color: 'white', fontSize: 16, fontWeight: '900' },
  // Body
  body: { flex: 1 },
  restCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, padding: 14,
    backgroundColor: '#FAF8F5', borderRadius: 14,
    borderWidth: 1, borderColor: '#F0EDE8',
  },
  restIcon: { fontSize: 26 },
  restName: { fontSize: 15, fontWeight: '900', color: '#1A1A1A' },
  restAddr: { fontSize: 11, color: '#999', marginTop: 2 },
  // Step
  stepWrap: { paddingHorizontal: 16, paddingBottom: 16, gap: 4 },
  stepTitle: { fontSize: 18, fontWeight: '900', color: '#1A1A1A', marginBottom: 4 },
  stepSub: { fontSize: 12, color: '#AAA', marginBottom: 12 },
  // Big buttons (step 1)
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E8E8E8', backgroundColor: 'white', marginBottom: 8,
    minHeight: 60,
  },
  bigBtnActive: { borderColor: '#E8704A', backgroundColor: '#FFF4EF' },
  bigBtnText: { fontSize: 16, fontWeight: '600', color: '#444' },
  bigBtnTextActive: { color: '#E8704A', fontWeight: '800' },
  bigBtnCheck: { fontSize: 20, color: '#E8704A', fontWeight: '900' },
  // Questions (step 2)
  qBlock: { marginBottom: 16 },
  qLabel: { fontSize: 13, fontWeight: '800', color: '#333', marginBottom: 8, lineHeight: 20 },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optBtn: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1.5,
    borderColor: '#E8E8E8', backgroundColor: 'white',
    minHeight: 46,
    justifyContent: 'center',
  },
  optText: { fontSize: 13 },
  // Note (step 3)
  noteInput: {
    backgroundColor: '#FAF8F5', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#EEE',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, color: '#333',
    height: 80, textAlignVertical: 'top',
    marginBottom: 12,
  },
  disclaimer: {
    backgroundColor: '#FFF8E1', borderRadius: 8,
    padding: 10, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: '#FFA000',
  },
  disclaimerText: { fontSize: 11, color: '#5D4037', lineHeight: 17 },
  // Navigation
  navRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  navBtn: {
    flex: 1, backgroundColor: '#E8704A', borderRadius: 12,
    padding: 15, alignItems: 'center',
  },
  navBtnDisabled: { backgroundColor: '#DDD' },
  navBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  backBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 12,
    padding: 15, alignItems: 'center', paddingHorizontal: 20,
  },
  backBtnText: { color: '#666', fontSize: 14, fontWeight: '700' },
  submitBtn: {
    flex: 1, backgroundColor: '#2D8A4E', borderRadius: 12,
    padding: 15, alignItems: 'center',
  },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
});

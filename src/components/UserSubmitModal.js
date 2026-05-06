// src/components/UserSubmitModal.js
import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { addBrand, addFood } from '../firebase/dbService';
import { SC } from '../data/translations';

const BRAND_EMOJIS = ['🍽️','🍔','🍕','🍗','🍜','🍣','🥪','🌮','☕','🧃','🍰','🥩','🥗','🍱','🏪'];
const FOOD_EMOJIS  = ['🍪','🍫','🍬','🍰','🍩','🍿','🧁','🥐','🍞','🧇','🍘','🥜','🍡','🍦','🎂'];

const RISK_OPTIONS = [
  { key: 'safe',    icon: '✅', label: '안전',      color: '#2D8A4E' },
  { key: 'info',    icon: 'ℹ️', label: '정보 제공', color: '#4A7FBF' },
  { key: 'caution', icon: '⚠️', label: '주의',      color: '#C17C1A' },
  { key: 'danger',  icon: '🚫', label: '위험',      color: '#C13A2D' },
];

const INIT = (isBrand) => ({
  emoji: isBrand ? '🍽️' : '🍪',
  name: '', manufacturer: '', cat: '', risk: 'info', reason: '', note: '',
});

export default function UserSubmitModal({ visible, onClose, type, user }) {
  const isBrand = type === 'brand';
  const emojis = isBrand ? BRAND_EMOJIS : FOOD_EMOJIS;
  const [form, setForm] = useState(INIT(isBrand));
  const [submitting, setSubmitting] = useState(false);

  function reset() { setForm(INIT(isBrand)); }
  function handleClose() { reset(); onClose(); }

  async function handleSubmit() {
    if (!user) { Alert.alert('로그인이 필요합니다.'); return; }
    if (!form.name.trim()) { Alert.alert('이름을 입력해주세요.'); return; }
    if (!form.cat.trim())  { Alert.alert('카테고리를 입력해주세요.'); return; }
    if (!form.reason.trim()) { Alert.alert('상세 이유를 입력해주세요.'); return; }

    setSubmitting(true);
    try {
      const nameStr = form.name.trim();
      const catStr  = form.cat.trim();
      const reasonStr = form.reason.trim();
      const noteStr = form.note.trim() || null;

      const data = {
        img: form.emoji,
        risk: form.risk,
        src: 'user',
        submittedBy: user.uid,
        submitterName: user.displayName || '익명',
        ko: { name: nameStr, cat: catStr, reason: reasonStr, tags: [], note: noteStr },
        en: { name: nameStr, cat: catStr, reason: reasonStr, tags: [], note: noteStr },
      };
      if (!isBrand) data.brand = form.manufacturer.trim();

      if (isBrand) await addBrand(data);
      else await addFood(data);

      Alert.alert('제보 완료! 🙏', '소중한 정보를 공유해주셨어요.\n다른 알레르기 가족에게 큰 도움이 됩니다.');
      reset();
      onClose();
    } catch {
      Alert.alert('오류', '제보 중 문제가 생겼어요. 다시 시도해주세요.');
    }
    setSubmitting(false);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={s.wrap} behavior="padding">

        <View style={s.header}>
          <Text style={s.headerTitle}>{isBrand ? '🏪  브랜드 제보하기' : '🍪  식품 제보하기'}</Text>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.body} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>

          {/* 이모지 */}
          <View style={s.section}>
            <Text style={s.label}>이모지  <Text style={s.selected}>{form.emoji}</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.emojiRow}>
                {emojis.map(e => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setForm(f => ({ ...f, emoji: e }))}
                    style={[s.emojiBtn, form.emoji === e && s.emojiBtnActive]}
                  >
                    <Text style={s.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* 이름 */}
          <View style={s.section}>
            <Text style={s.label}>{isBrand ? '브랜드명 *' : '식품명 *'}</Text>
            <TextInput
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder={isBrand ? '예) 맘스터치, 도미노피자' : '예) 허니버터칩, 오레오'}
              placeholderTextColor="#CCC"
              style={s.input}
            />
          </View>

          {/* 제조사 (식품만) */}
          {!isBrand && (
            <View style={s.section}>
              <Text style={s.label}>제조사 / 브랜드</Text>
              <TextInput
                value={form.manufacturer}
                onChangeText={v => setForm(f => ({ ...f, manufacturer: v }))}
                placeholder="예) 해태, 오리온, 롯데"
                placeholderTextColor="#CCC"
                style={s.input}
              />
            </View>
          )}

          {/* 카테고리 */}
          <View style={s.section}>
            <Text style={s.label}>카테고리 *</Text>
            <TextInput
              value={form.cat}
              onChangeText={v => setForm(f => ({ ...f, cat: v }))}
              placeholder={isBrand ? '예) 치킨, 패스트푸드, 카페' : '예) 과자, 초콜릿, 빵'}
              placeholderTextColor="#CCC"
              style={s.input}
            />
          </View>

          {/* 안전도 */}
          <View style={s.section}>
            <Text style={s.label}>안전도 *</Text>
            <View style={s.riskRow}>
              {RISK_OPTIONS.map(r => {
                const active = form.risk === r.key;
                const sc = SC[r.key];
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setForm(f => ({ ...f, risk: r.key }))}
                    style={[s.riskBtn, { borderColor: sc.color, backgroundColor: active ? sc.bg : 'white' }]}
                  >
                    <Text style={[s.riskBtnText, { color: sc.color, fontWeight: active ? '800' : '400' }]}>
                      {r.icon} {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 상세 이유 */}
          <View style={s.section}>
            <Text style={s.label}>상세 이유 *</Text>
            <TextInput
              value={form.reason}
              onChangeText={v => setForm(f => ({ ...f, reason: v }))}
              placeholder={isBrand
                ? '왜 이 안전도인지 알레르기 정보를 자세히 써주세요'
                : '성분 확인 방법, 알레르기 정보 등 자세히 써주세요'}
              placeholderTextColor="#CCC"
              style={[s.input, s.inputMulti]}
              multiline
            />
          </View>

          {/* 메모 */}
          <View style={s.section}>
            <Text style={s.label}>추가 메모 (선택)</Text>
            <TextInput
              value={form.note}
              onChangeText={v => setForm(f => ({ ...f, note: v }))}
              placeholder="추가로 알려주실 정보가 있다면..."
              placeholderTextColor="#CCC"
              style={s.input}
            />
          </View>

          <View style={s.notice}>
            <Text style={s.noticeText}>
              📌 제보하신 내용은 "사용자 제보" 배지로 표시됩니다.{'\n'}
              좋아요가 쌓일수록 신뢰도 높은 정보로 표시됩니다.
            </Text>
          </View>

          <TouchableOpacity
            style={[s.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={s.submitBtnText}>{submitting ? '등록 중...' : '제보 등록하기'}</Text>
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
  headerTitle: { fontSize: 17, fontWeight: '900' },
  closeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: '#666' },
  body: { flex: 1, padding: 20 },
  section: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
  selected: { fontSize: 18 },
  input: {
    backgroundColor: '#FAF8F5', borderRadius: 10, borderWidth: 1.5,
    borderColor: '#EEE', paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 13, color: '#333',
  },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  emojiRow: { flexDirection: 'row', gap: 8 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#F5F0EB',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiBtnActive: { borderColor: '#E8704A', backgroundColor: '#FFF3EE' },
  emojiText: { fontSize: 22 },
  riskRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  riskBtn: {
    flex: 1, minWidth: '45%', padding: 10,
    borderRadius: 10, borderWidth: 1.5, alignItems: 'center',
  },
  riskBtnText: { fontSize: 13 },
  notice: {
    backgroundColor: '#FFF8F0', borderRadius: 10,
    padding: 12, marginBottom: 16,
  },
  noticeText: { fontSize: 11, color: '#C17C1A', lineHeight: 17 },
  submitBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
});

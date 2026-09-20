// src/components/FeedbackModal.js
// 앱 안 의견 보내기 — 모든 항목이 선택이고, 하나라도 채우면 보낼 수 있다. 여러 번 보내도 된다.
import Constants from 'expo-constants';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { addFeedback } from '../firebase/dbService';
import { APP_VER } from '../data/translations';

const WHERE = [
  ['brand', '브랜드'], ['restaurant', '식당'], ['food', '식품'],
  ['map', '지도'], ['card', '알레르기카드'], ['account', '가입·로그인'], ['other', '기타'],
];
const KIND = [
  ['bug', '오류가 났어요'], ['wrong', '정보가 틀렸어요'], ['missing', '찾는 게 없어요'],
  ['hard', '쓰기 불편해요'], ['idea', '이런 게 있으면 좋겠어요'], ['good', '좋았어요'],
];

function Chips({ options, value, onToggle }) {
  return (
    <View style={s.chips}>
      {options.map(([key, label]) => {
        const on = value === key;
        return (
          <TouchableOpacity key={key} style={[s.chip, on && s.chipOn]} onPress={() => onToggle(on ? null : key)} activeOpacity={0.8}>
            <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function FeedbackModal({ visible, onClose, user }) {
  const [where, setWhere] = useState(null);
  const [kind, setKind] = useState(null);
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  const canSend = !!(where || kind || text.trim());

  function reset() {
    setWhere(null); setKind(null); setText(''); setContact(''); setDone(false); setSending(false);
  }

  async function send() {
    if (!canSend || sending) return;
    setSending(true);
    setFailed(false);
    try {
      await addFeedback({
        where, kind,
        message: text.trim(),
        contact: contact.trim() || user?.email || '',
        appVersion: Constants.expoConfig?.version || APP_VER,
        platform: `${Platform.OS} ${Platform.Version}`,
      }, user?.uid);
      setDone(true);
    } catch {
      // 저장에 실패하면 완료라고 하지 않는다 — 기존 QuickSafetyReport 버그와 같은 실수를 막는다
      setSending(false);
      setFailed(true);
    }
  }

  function close() {
    reset(); onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>💬  의견 보내기</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {done ? (
            <View style={s.doneBox}>
              <Text style={s.doneIcon}>🙏</Text>
              <Text style={s.doneTitle}>보냈어요. 고맙습니다!</Text>
              <Text style={s.doneSub}>하실 말씀이 더 있으면 언제든 또 보내주세요.</Text>
              <TouchableOpacity style={s.againBtn} onPress={reset}>
                <Text style={s.againBtnText}>하나 더 쓰기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.closeBtn} onPress={close}>
                <Text style={s.closeBtnText}>닫기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.lead}>전부 선택 사항이에요. 한 가지만 적어도 보낼 수 있어요.</Text>

              <Text style={s.label}>어느 화면인가요?</Text>
              <Chips options={WHERE} value={where} onToggle={setWhere} />

              <Text style={s.label}>어떤 이야기인가요?</Text>
              <Chips options={KIND} value={kind} onToggle={setKind} />

              <Text style={s.label}>자세히 적어주시면 큰 도움이 돼요</Text>
              <TextInput
                style={s.input}
                value={text}
                onChangeText={setText}
                placeholder={'예) 식당 탭에서 검색하면 결과가 안 나와요\n예) OO 과자에 땅콩 들어있는데 안전이라고 나와요'}
                placeholderTextColor="#B3A99C"
                multiline
                maxLength={1000}
              />

              <Text style={s.label}>답장 받을 곳 (선택)</Text>
              <TextInput
                style={s.inputOne}
                value={contact}
                onChangeText={setContact}
                placeholder={user?.email || '이메일 또는 연락처'}
                placeholderTextColor="#B3A99C"
                autoCapitalize="none"
                maxLength={120}
              />

              {failed && <Text style={s.fail}>보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러주세요.</Text>}

              <TouchableOpacity
                style={[s.sendBtn, !canSend && s.sendBtnOff]}
                onPress={send}
                disabled={!canSend || sending}
                activeOpacity={0.85}
              >
                {sending
                  ? <ActivityIndicator color="white" />
                  : <Text style={s.sendBtnText}>보내기</Text>}
              </TouchableOpacity>
              <Text style={s.privacy}>보내주신 내용과 앱 버전·기기 정보가 함께 저장돼요.</Text>
              <View style={{ height: 12 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FAF8F5', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '900', color: '#2B2B2B' },
  close: { fontSize: 18, color: '#8A7F72', fontWeight: '700' },
  lead: { fontSize: 13, color: '#8A7F72', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '800', color: '#4A4238', marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 16, backgroundColor: 'white', borderWidth: 1, borderColor: '#E6DED3' },
  chipOn: { backgroundColor: '#2D8A4E', borderColor: '#2D8A4E' },
  chipText: { fontSize: 13, color: '#6B6157', fontWeight: '600' },
  chipTextOn: { color: 'white', fontWeight: '800' },
  input: {
    backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E6DED3',
    padding: 14, minHeight: 110, fontSize: 14, color: '#2B2B2B', textAlignVertical: 'top', lineHeight: 21,
  },
  inputOne: {
    backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E6DED3',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#2B2B2B',
  },
  sendBtn: { marginTop: 18, backgroundColor: '#2D8A4E', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  sendBtnOff: { backgroundColor: '#C9C2B8' },
  sendBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  privacy: { fontSize: 11, color: '#A39A8E', textAlign: 'center', marginTop: 10 },
  fail: { marginTop: 14, fontSize: 13, color: '#C13A2D', fontWeight: '700' },
  doneBox: { alignItems: 'center', paddingVertical: 30 },
  doneIcon: { fontSize: 44 },
  doneTitle: { fontSize: 17, fontWeight: '900', color: '#2B2B2B', marginTop: 12 },
  doneSub: { fontSize: 13, color: '#8A7F72', marginTop: 6, textAlign: 'center' },
  againBtn: { marginTop: 20, backgroundColor: '#2D8A4E', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 },
  againBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  closeBtn: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 20 },
  closeBtnText: { color: '#8A7F72', fontSize: 14, fontWeight: '700' },
});

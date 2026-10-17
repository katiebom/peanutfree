// 월간 업데이트 공지 팝업 — notices 컬렉션의 최신 활성 공지를 한 번만 보여준다
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchLatestNotice } from '../firebase/dbService';

const SEEN_KEY = 'pf_lastSeenNotice';

export default function NoticePopup({ user }) {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const n = await fetchLatestNotice();
        if (!n || cancelled) return;
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (seen !== n.id) setNotice(n);
      } catch (e) {
        console.log('notice check failed:', e?.code || e);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  async function close() {
    if (notice) await AsyncStorage.setItem(SEEN_KEY, notice.id).catch(() => {});
    setNotice(null);
  }

  if (!notice) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>{notice.title}</Text>
          <ScrollView style={s.scroll}><Text style={s.body}>{notice.body}</Text></ScrollView>
          <TouchableOpacity style={s.btn} onPress={close} accessibilityRole="button">
            <Text style={s.btnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '86%', maxHeight: '70%', backgroundColor: 'white', borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '900', color: '#222', marginBottom: 12 },
  scroll: { marginBottom: 16 },
  body: { fontSize: 14, color: '#333', lineHeight: 21 },
  btn: { backgroundColor: '#222', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '800', fontSize: 14 },
});

// src/screens/CardScreen.js
// 알레르기 카드 탭 — 본문은 src/components/AllergyCard.js (식당·브랜드 상세 모달과 공용)
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { AllergyCardBody, CARD_BG } from '../components/AllergyCard';

export default function CardScreen() {
  return (
    <View style={s.container}>
      <StatusBar backgroundColor={CARD_BG} barStyle="light-content" />
      <AllergyCardBody />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CARD_BG,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
});

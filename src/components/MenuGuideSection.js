// src/components/MenuGuideSection.js
// 식당 상세에 음식 종류별 "메뉴 일반 안내"를 붙인다. 이 식당의 실제 메뉴 정보가 아니다 — 라벨로 분명히 한다.
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MENU_GUIDE } from '../data/menuGuide';

// 식당 cuisineType → 가이드 분류 또는 메뉴 목록. 없는 종류(파인다이닝·중동 등)는 안내를 띄우지 않는다.
const CUISINE_MAP = {
  '한식': { cuisine: '한식' },
  '중식': { cuisine: '중식' },
  '일식': { cuisine: '일식' },
  '동남아시아': { cuisine: '동남아' },
  '양식': { cuisine: '양식' },
  '카페/베이커리': { cuisine: '카페/베이커리' },
  '이탈리안': { dishes: ['토마토 파스타', '크림 파스타', '바질 페스토 파스타', '피자', '리조또', '라자냐', '티라미수'] },
  '피자': { dishes: ['피자'] },
  '버거': { dishes: ['햄버거'] },
  '샌드위치': { dishes: ['샌드위치'] },
  '멕시칸': { dishes: ['타코', '부리또'] },
  '치킨': { dishes: ['양념치킨', '닭강정', '치킨 윙'] },
};

const GRADE = {
  always: { ko: '거의 항상 들어감', en: 'Almost always', color: '#C13A2D', bg: '#FDECEA' },
  varies: { ko: '가게마다 다름 — 주문 시 확인', en: 'Varies — ask when ordering', color: '#B45309', bg: '#FFFBEB' },
  rarely: { ko: '보통 안 들어감', en: 'Usually not', color: '#15803D', bg: '#F0FDF4' },
};

export function guideFor(cuisineType) {
  const rule = CUISINE_MAP[cuisineType];
  if (!rule) return [];
  return rule.cuisine
    ? MENU_GUIDE.filter(g => g.cuisine === rule.cuisine)
    : rule.dishes.map(d => MENU_GUIDE.find(g => g.ko === d)).filter(Boolean);
}

export default function MenuGuideSection({ cuisineType, lang = 'ko' }) {
  const [open, setOpen] = useState(null);
  const items = guideFor(cuisineType);
  if (items.length === 0) return null;
  const en = lang === 'en';

  return (
    <View style={s.box}>
      <Text style={s.title}>{en ? '🥜 Peanut guide by dish' : `🥜 ${cuisineType} 메뉴별 땅콩 일반 안내`}</Text>
      <Text style={s.sub}>
        {en
          ? 'General guidance by dish, not this restaurant\'s recipe. Always confirm when ordering.'
          : '이 식당의 실제 레시피가 아니라 메뉴별 일반 안내예요. 주문할 때 꼭 확인하세요.'}
      </Text>
      {['always', 'varies', 'rarely'].map(grade => {
        const group = items.filter(i => i.peanut === grade);
        if (group.length === 0) return null;
        const g = GRADE[grade];
        return (
          <View key={grade} style={s.group}>
            <Text style={[s.groupLabel, { color: g.color }]}>{en ? g.en : g.ko}</Text>
            <View style={s.chips}>
              {group.map(i => {
                const key = i.ko;
                const nut = i.treenut !== 'rarely';
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.chip, { backgroundColor: g.bg, borderColor: open === key ? g.color : 'transparent' }]}
                    onPress={() => setOpen(open === key ? null : key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.chipText, { color: g.color }]}>{en ? i.en : i.ko}{nut ? ' ·🌰' : ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {group.filter(i => i.ko === open).map(i => (
              <View key={i.ko} style={s.detail}>
                <Text style={s.detailText}>
                  {en ? 'Tree nuts: ' : '견과류: '}{en ? GRADE[i.treenut].en : GRADE[i.treenut].ko}
                </Text>
                {!!(en ? i.noteEn : i.noteKo) && <Text style={s.detailText}>{en ? i.noteEn : i.noteKo}</Text>}
              </View>
            ))}
          </View>
        );
      })}
      <Text style={s.legend}>{en ? '🌰 = tree nuts may also be present. Tap a dish for details.' : '🌰 = 견과류도 들어갈 수 있음. 메뉴를 누르면 자세히 보여요.'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEE7DD' },
  title: { fontSize: 15, fontWeight: '800', color: '#2B2B2B' },
  sub: { fontSize: 12, color: '#8A7F72', marginTop: 4, marginBottom: 6, lineHeight: 17 },
  group: { marginTop: 10 },
  groupLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  detail: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#FAF8F5' },
  detailText: { fontSize: 12, color: '#555', lineHeight: 18 },
  legend: { fontSize: 11, color: '#A39A8E', marginTop: 10 },
});

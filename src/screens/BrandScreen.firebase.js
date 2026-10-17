// src/screens/BrandScreen.js (Firebase 연동 버전)
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native';
import { subscribeBrands } from '../firebase/dbService';
import { BRANDS as LOCAL_BRANDS } from '../data/database'; // 오프라인 폴백용
import { Badge, SrcBadge, FilterBar, WarnBox } from '../components/Common';
import { BrandSheet } from '../components/BottomSheet';

export default function BrandScreen({ lang, t }) {
  const [brands, setBrands] = useState(LOCAL_BRANDS); // 처음엔 로컬 데이터
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    // Firebase 실시간 구독
    const unsubscribe = subscribeBrands(data => {
      if (data.length > 0) setBrands(data);
      setLoading(false);
    });
    return () => unsubscribe(); // 언마운트 시 구독 해제
  }, []);

  const filters = [
    { key: 'all', label: t.filterAll },
    { key: 'safe', label: t.safe },
    { key: 'info', label: t.info },
    { key: 'caution', label: t.caution },
    { key: 'danger', label: t.danger },
  ];

  const filtered = brands.filter(b => {
    const d = b[lang];
    if (!d) return false;
    const matchF = filter === 'all' || b.risk === filter;
    const matchS = !search
      || d.name.toLowerCase().includes(search.toLowerCase())
      || d.cat.toLowerCase().includes(search.toLowerCase());
    return matchF && matchS;
  });

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#E8704A" />
          <Text style={styles.loadingText}>최신 정보 불러오는 중...</Text>
        </View>
      )}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        ListHeaderComponent={() => (
          <View>
            <WarnBox text={t.brandWarn} />
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t.searchBrand}
                placeholderTextColor="#BBB"
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={styles.clearBtn}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <FilterBar filters={filters} active={filter} onSelect={setFilter} />
            <Text style={styles.count}>
              <Text style={styles.countNum}>{filtered.length}</Text>
              {t.brandCount}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const d = item[lang];
          if (!d) return null;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardImg}>{item.img}</Text>
              <View style={styles.cardBody}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.cardName}>{d.name}</Text>
                  <SrcBadge src={item.src} t={t} />
                </View>
                <Text style={styles.cardCat}>{d.cat}</Text>
              </View>
              <Badge risk={item.risk} t={t} />
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <BrandSheet item={selected} lang={lang} t={t} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  loadingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EBF3FF', padding: 8, paddingHorizontal: 14,
  },
  loadingText: { fontSize: 11, color: '#4A7FBF' },
  list: { padding: 13, paddingBottom: 20 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#EEE',
    paddingHorizontal: 12, marginBottom: 10,
  },
  searchIcon: { fontSize: 13, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 12, color: '#333' },
  clearBtn: { fontSize: 13, color: '#BBB', paddingLeft: 8 },
  count: { fontSize: 11, color: '#999', marginBottom: 8 },
  countNum: { fontWeight: '700', color: '#333' },
  card: {
    backgroundColor: 'white', borderRadius: 14,
    padding: 14, marginBottom: 9,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImg: { fontSize: 28 },
  cardBody: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' },
  cardName: { fontWeight: '800', fontSize: 14 },
  cardCat: { fontSize: 11, color: '#999' },
});

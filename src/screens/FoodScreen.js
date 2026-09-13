// src/screens/FoodScreen.js
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { FoodSheet } from '../components/BottomSheet';
import { Badge, FilterBar, WarnBox } from '../components/Common';
import UserSubmitModal from '../components/UserSubmitModal';
import { SC } from '../data/translations';
import { subscribeFoods, fetchFoodByBarcode, toggleLike } from '../firebase/dbService';
import { Camera, CameraView } from 'expo-camera';
import ReportModal from '../components/ReportModal';

function FoodRecordModal({ visible, onClose, foods, lang, t, user }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  function handleClose() {
    setSearch('');
    setSelected(null);
    onClose();
  }

  const filtered = foods
    .filter(f => {
      const d = f[lang] || f.ko;
      if (!d) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q);
    })
    .sort((a, b) => ({ danger: 0, caution: 1, safe: 2 }[a.risk] ?? 9) - ({ danger: 0, caution: 1, safe: 2 }[b.risk] ?? 9));

  if (selected) {
    const d = selected[lang] || selected.ko;
    return (
      <ReportModal
        visible={true}
        onClose={handleClose}
        target={{
          type: 'food',
          id: selected.id,
          name: d?.name || selected.name || '',
          img: selected.img || '🍪',
        }}
        user={user}
      />
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={fm.wrap}>
        <View style={fm.header}>
          <Text style={fm.headerTitle}>{t.foodRecordTitle}</Text>
          <TouchableOpacity onPress={handleClose} style={fm.closeBtn}>
            <Text style={fm.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={fm.searchWrap}>
          <Text style={fm.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.foodRecordSearchPh}
            placeholderTextColor="#BBB"
            style={fm.searchInput}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={fm.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={fm.hint}>
          {search
            ? t.foodResultsHintFmt.replace('{n}', filtered.length)
            : t.foodRecordHintDefault}
        </Text>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={fm.list}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map(item => {
            const d = item[lang] || item.ko;
            if (!d) return null;
            const RISK_COLOR = { danger: '#C13A2D', caution: '#D9622F', safe: '#2D8A4E', info: '#4A7FBF' };
            const color = RISK_COLOR[item.risk] || '#999';
            return (
              <TouchableOpacity
                key={item.id}
                style={[fm.card, { borderLeftColor: color, borderLeftWidth: 4 }]}
                onPress={() => setSelected(item)}
                activeOpacity={0.7}
              >
                <Text style={fm.cardImg}>{item.img || '🍪'}</Text>
                <View style={fm.cardBody}>
                  <Text style={fm.cardName}>{d.name}</Text>
                  {item.brand ? <Text style={fm.cardBrand}>{item.brand}</Text> : null}
                  <Text style={fm.cardCat}>{d.cat}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {search.trim().length > 0 && filtered.length === 0 && (
            <View style={fm.empty}>
              <Text style={fm.emptyText}>{t.noResults}</Text>
              <Text style={fm.emptyHint}>{t.noResultsHint}</Text>
            </View>
          )}

          {search.trim().length >= 2 && (
            <TouchableOpacity
              style={fm.directCard}
              onPress={() => setSelected({
                id: `custom_${Date.now()}`,
                ko: { name: search.trim(), cat: '식품' },
                en: { name: search.trim(), cat: 'Food' },
                img: '🍪',
                risk: 'info',
              })}
              activeOpacity={0.7}
            >
              <Text style={fm.directCardIcon}>✏️</Text>
              <View style={fm.directCardBody}>
                <Text style={fm.directCardName}>{t.directLogBtnFmt.replace('{name}', search.trim())}</Text>
                <Text style={fm.directCardHint}>{t.directLogHint}</Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const GROUP_LABELS = {
  danger:  { ko: 'X  먹으면 안 되는 식품',   en: 'X  Dangerous Foods' },
  caution: { ko: '!  주의가 필요한 식품',      en: '!  Use with Caution' },
  safe:    { ko: 'OK 안전한 식품',             en: 'OK Safe Foods' },
};

const RISK_ORDER = { danger: 0, caution: 1, safe: 2 };

export default function FoodScreen({ lang, t, user }) {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showFoodRecord, setShowFoodRecord] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [foodReportTarget, setFoodReportTarget] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scanned, setScanned] = useState(false);
  const scannedTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scannedTimerRef.current) clearTimeout(scannedTimerRef.current);
    };
  }, []);

  async function handleLike(item) {
    if (!user) { Alert.alert('로그인 필요', '좋아요는 로그인 후 가능합니다.'); return; }
    if (!item._isFirebase) { Alert.alert('', '이 항목은 아직 좋아요를 지원하지 않아요.'); return; }
    try { await toggleLike('foods', item.id, user.uid); } catch { /* silent */ }
  }

  useEffect(() => {
    const unsubscribe = subscribeFoods(
      data => {
        setFoods(data.map(f => ({ ...f, _isFirebase: true })));
        setLoading(false);
        setError(null);
      },
      err => {
        setError(err.message || '');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const filters = [
    { key: 'all',     label: t.filterAll },
    { key: 'danger',  label: t.danger },
    { key: 'caution', label: t.caution },
    { key: 'safe',    label: t.safe },
  ];

  const filtered = foods
    .filter(f => {
      const d = f[lang] || f.ko;
      if (!d) return false;
      return (filter === 'all' || f.risk === filter) &&
        (!search || d.name.toLowerCase().includes(search.toLowerCase())
          || (f.brand || '').toLowerCase().includes(search.toLowerCase()));
    })
    .sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9));

  async function handleBarcodeScan({ data }) {
    if (scanned) return;
    setScanned(true);
    setShowScanner(false);
    try {
      const found = await fetchFoodByBarcode(data);
      if (found) {
        setSelected(found);
      } else {
        Alert.alert(
          t.barcodeUnknownTitle,
          t.barcodeNotFoundFmt.replace('{code}', data),
          [{ text: t.confirm }]
        );
      }
    } catch {
      Alert.alert(t.error, t.barcodeErrMsg);
    }
    if (scannedTimerRef.current) clearTimeout(scannedTimerRef.current);
    scannedTimerRef.current = setTimeout(() => setScanned(false), 2000);
  }

  async function openScanner() {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.cameraPermTitle, t.cameraPermMsg);
      return;
    }
    setScannerReady(true);
    setShowScanner(true);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E8704A" />
        <Text style={styles.loadingText}>{t.loadingFoods}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ fontSize: 14, color: '#C13A2D', textAlign: 'center', marginHorizontal: 24 }}>
          {t.loadFailedMsg}
        </Text>
        <Text style={{ fontSize: 11, color: '#AAA', marginTop: 8 }}>{error}</Text>
      </View>
    );
  }

  const foodListHeader = (
    <View style={styles.headerWrap}>
      <WarnBox text={t.foodWarn} />
      <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
        <Text style={styles.scanBtnIcon}>📷</Text>
        <Text style={styles.scanBtnText}>{t.scanBtnText}</Text>
      </TouchableOpacity>
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.recordBtn, { flex: 1 }]} onPress={() => setShowFoodRecord(true)}>
          <Text style={styles.recordBtnText}>{t.recordBtnText}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submitBtn, { flex: 1 }]} onPress={() => setShowSubmit(true)}>
          <Text style={styles.submitBtnText}>🍪  식품 제보하기</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t.searchFood}
          placeholderTextColor="#BBB"
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>X</Text>
          </TouchableOpacity>
        )}
      </View>
      <FilterBar filters={filters} active={filter} onSelect={setFilter} />
      <Text style={styles.count}>
        <Text style={styles.countNum}>{filtered.length}</Text>
        {t.foodCount}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={foodListHeader}
        renderItem={({ item, index }) => {
          const d = item[lang] || item.ko;
          if (!d) return null;
          const s = SC[item.risk] || {};

          const prevItem = filtered[index - 1];
          const showGroup = filter === 'all' && (!prevItem || prevItem.risk !== item.risk);
          const groupLabel = GROUP_LABELS[item.risk]?.[lang] || '';

          return (
            <View>
              {showGroup && (
                <View style={[styles.groupHeader, { backgroundColor: s.bg }]}>
                  <Text style={[styles.groupText, { color: s.color }]}>
                    {groupLabel}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.card, { borderLeftColor: s.color, borderLeftWidth: 4 }]}
                onPress={() => setSelected(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardImg}>{item.img}</Text>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{d.name}</Text>
                  {item.brand ? (
                    <Text style={styles.cardBrand}>{item.brand}</Text>
                  ) : null}
                  <Text style={styles.cardCat}>{d.cat}</Text>
                  {d.note && <Text style={styles.cardNote} numberOfLines={1}>{d.note}</Text>}
                  {item._isFirebase && (() => {
                    const likes = item.likes || [];
                    const isLiked = user && likes.includes(user.uid);
                    return (
                      <TouchableOpacity onPress={() => handleLike(item)} style={styles.likeBtn}>
                        <Text style={styles.likeBtnText}>
                          {isLiked ? '❤️' : '🤍'} {likes.length > 0 ? likes.length : '도움돼요'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
                <Badge risk={item.risk} t={t} />
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <FoodRecordModal
        visible={showFoodRecord}
        onClose={() => setShowFoodRecord(false)}
        foods={foods}
        lang={lang}
        t={t}
        user={user}
      />
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={styles.scannerWrap}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>📷  {t.scanTitle}</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)} style={styles.scannerClose}>
              <Text style={styles.scannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            {scannerReady && (
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
              />
            )}
            <View style={styles.scannerOverlay} pointerEvents="none">
              <View style={styles.scannerFrame} />
              <Text style={styles.scannerHint}>{t.scannerFrameHint}</Text>
            </View>
          </View>
        </View>
      </Modal>
      <FoodSheet item={selected} lang={lang} t={t} user={user} onClose={() => setSelected(null)} />
      <UserSubmitModal visible={showSubmit} onClose={() => setShowSubmit(false)} type="food" user={user} lang={lang} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8F5' },
  loadingText: { marginTop: 12, fontSize: 13, color: '#999' },
  headerWrap: { paddingBottom: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#EEE',
    paddingHorizontal: 12, marginHorizontal: 13, marginBottom: 8,
  },
  searchIcon: { fontSize: 13, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: '#333' },
  clearBtn: { fontSize: 13, color: '#BBB', paddingLeft: 8 },
  count: { fontSize: 11, color: '#999', paddingHorizontal: 13, marginBottom: 6 },
  countNum: { fontWeight: '800', color: '#333', fontSize: 13 },
  groupHeader: {
    marginHorizontal: 13, marginTop: 14, marginBottom: 6,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  groupText: { fontSize: 13, fontWeight: '800' },
  list: { paddingTop: 8, paddingBottom: 24 },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 13, marginBottom: 8,
    borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImg: { fontSize: 30, flexShrink: 0 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '900', color: '#1A1A1A', marginBottom: 2 },
  cardBrand: { fontSize: 12, color: '#777', marginBottom: 1 },
  cardCat: { fontSize: 11, color: '#BBB' },
  cardNote: { fontSize: 11, color: '#C17C1A', marginTop: 2 },
  btnRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 13, marginBottom: 10,
  },
  recordBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    padding: 13, alignItems: 'center',
  },
  recordBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  submitBtn: {
    backgroundColor: '#4A7FBF', borderRadius: 12,
    padding: 13, alignItems: 'center',
  },
  submitBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  likeBtn: { marginTop: 6, alignSelf: 'flex-start' },
  likeBtnText: { fontSize: 12, color: '#888' },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EBF3FF', borderRadius: 12,
    padding: 12, marginHorizontal: 13, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#4A7FBF',
  },
  scanBtnIcon: { fontSize: 18 },
  scanBtnText: { fontSize: 14, fontWeight: '800', color: '#4A7FBF' },
  scannerWrap: { flex: 1, backgroundColor: 'black' },
  scannerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 28,
    backgroundColor: 'black',
  },
  scannerTitle: { color: 'white', fontSize: 16, fontWeight: '900' },
  scannerClose: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  scannerCloseText: { color: 'white', fontSize: 16 },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  scannerFrame: {
    width: 240, height: 160,
    borderWidth: 2, borderColor: '#E8704A', borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scannerHint: {
    color: 'white', fontSize: 13, marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});

const fm = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 24,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  closeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: '#666' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAF8F5', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#EEE',
    paddingHorizontal: 14, margin: 16, marginBottom: 4,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#333' },
  clearBtn: { fontSize: 13, color: '#BBB', paddingLeft: 8 },
  hint: { fontSize: 11, color: '#BBB', paddingHorizontal: 16, marginBottom: 6 },
  list: { padding: 13, paddingBottom: 40 },
  card: {
    backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImg: { fontSize: 28, flexShrink: 0 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '900', color: '#1A1A1A' },
  cardBrand: { fontSize: 11, color: '#888', marginTop: 1 },
  cardCat: { fontSize: 11, color: '#BBB', marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 40, marginBottom: 16 },
  emptyText: { fontSize: 15, color: '#999', fontWeight: '700' },
  emptyHint: { fontSize: 12, color: '#CCC', marginTop: 4 },
  directCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF8F5', borderRadius: 14, padding: 14,
    marginTop: 8,
    borderWidth: 1.5, borderColor: '#E8704A', borderStyle: 'dashed',
  },
  directCardIcon: { fontSize: 24, flexShrink: 0 },
  directCardBody: { flex: 1 },
  directCardName: { fontSize: 14, fontWeight: '800', color: '#E8704A' },
  directCardHint: { fontSize: 11, color: '#BBB', marginTop: 2 },
});

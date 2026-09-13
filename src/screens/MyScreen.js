// src/screens/MyScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRANDS, FOODS } from '../data/database';
import { Badge } from '../components/Common';
import { getUserProfile } from '../firebase/dbService';
import { deleteAccount, hasRecentLogin, logout, reauthenticate } from '../firebase/authService';
import { ProfileEditModal } from './ProfileSetupScreen';

const STORAGE_KEY = 'peanutfree_favorites';
// 계정 삭제 시 이 기기에서 지우는 로컬 키
const LOCAL_KEYS_ON_DELETE = [STORAGE_KEY, 'pf_profileDone', 'pf_consentDone', 'pf_consentDone_v2'];

/**
 * onLogout: 로그아웃/계정 삭제 완료 후 App 상태를 초기화하는 콜백 (signOut 은 여기서 수행)
 */
export default function MyScreen({ lang, t, user, onLogout }) {
  const [favorites, setFavorites] = useState([]);
  const [profile, setProfile] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } catch (e) {
      if (__DEV__) console.warn('[MyScreen] 로그아웃 실패:', e);
      Alert.alert(t.error, t.logoutFailed);
      return;
    }
    onLogout();
  }

  // ── 계정 삭제 ─────────────────────────────────────────
  function confirmDeleteAccount() {
    Alert.alert(t.deleteAccountTitle, t.deleteAccountMsg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteAccountNext, style: 'destructive',
        onPress: () => {
          Alert.alert(t.deleteAccountConfirmTitle, t.deleteAccountConfirmMsg, [
            { text: t.cancel, style: 'cancel' },
            { text: t.deleteAccountConfirmBtn, style: 'destructive', onPress: startDeleteAccount },
          ]);
        },
      },
    ]);
  }

  function openPasswordModal() {
    setPassword(''); setPwError(''); setPwModal(true);
  }

  function startDeleteAccount() {
    // 오래된 세션이면 데이터 삭제 전에 먼저 재인증 (삭제 도중 requires-recent-login 로 멈추는 것 방지)
    if (hasRecentLogin()) runDeleteAccount();
    else openPasswordModal();
  }

  async function submitPassword() {
    if (!password) return;
    setDeleting(true);
    try {
      await reauthenticate(password);
    } catch (e) {
      setDeleting(false);
      const code = e?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        setPwError(t.deleteAccountWrongPw);
      } else {
        setPwError(t.deleteAccountFailed);
      }
      return;
    }
    setPwModal(false);
    await runDeleteAccount();
  }

  async function runDeleteAccount() {
    setDeleting(true);
    let result;
    try {
      result = await deleteAccount();
    } catch (e) {
      setDeleting(false);
      if (e?.code === 'auth/requires-recent-login') {
        openPasswordModal();
      } else {
        if (__DEV__) console.warn('[MyScreen] 계정 삭제 실패:', e);
        Alert.alert(t.error, t.deleteAccountFailed);
      }
      return;
    }
    try { await AsyncStorage.multiRemove(LOCAL_KEYS_ON_DELETE); } catch { /* ignore */ }
    setDeleting(false);
    const partial = result && Object.keys(result.failed || {}).length > 0;
    Alert.alert(t.deleteAccount, partial ? t.deleteAccountPartial : t.deleteAccountDone);
    onLogout();
  }

  useEffect(() => {
    loadFavorites();
  }, []);

  useEffect(() => {
    if (user?.uid) loadProfile();
  }, [user]);

  async function loadFavorites() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch (e) {
      if (__DEV__) console.warn('[MyScreen] 즐겨찾기 로드 실패:', e);
    }
  }

  async function loadProfile() {
    try {
      const p = await getUserProfile(user.uid);
      if (p) setProfile(p);
    } catch (e) {
      if (__DEV__) console.warn('[MyScreen] 프로필 로드 실패:', e);
    }
  }

  async function removeFavorite(id) {
    const next = favorites.filter(f => f.id !== id);
    setFavorites(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  // 즐겨찾기된 항목을 DB에서 찾기
  const favItems = favorites.map(fav => {
    const item = [...BRANDS, ...FOODS].find(x => x.id === fav.id);
    return item ? { ...item, favType: fav.type } : null;
  }).filter(Boolean);

  return (
    <View style={styles.container}>
      <FlatList
        data={favItems}
        keyExtractor={item => item.id}
        ListHeaderComponent={() => {
          const allergyTypeChip = () => {
            const map = {
              peanut: lang === 'en' ? '🥜 Peanut' : '🥜 땅콩',
              nut: lang === 'en' ? '🌰 Tree nuts' : '🌰 견과류',
              both: lang === 'en' ? '🥜🌰 Both' : '🥜🌰 땅콩+견과류',
            };
            return map[profile?.allergyType] || null;
          };
          const severityChip = () => {
            const map = {
              severe: lang === 'en' ? '🚨 Severe' : '🚨 심각',
              moderate: lang === 'en' ? '⚠️ Moderate' : '⚠️ 보통',
              mild: lang === 'en' ? '💛 Mild' : '💛 경미',
            };
            return map[profile?.severity] || null;
          };
          const targetChip = () => {
            if (!profile) return null;
            if (profile.allergyTarget === 'child') {
              const name = profile.childName || (lang === 'en' ? 'Child' : '자녀');
              return profile.childAge ? `👶 ${name} (${profile.childAge})` : `👶 ${name}`;
            }
            if (profile.allergyTarget === 'self') return lang === 'en' ? '🙋 Myself' : '🙋 본인';
            if (profile.allergyTarget === 'family') return lang === 'en' ? '👨‍👩‍👧 Family' : '👨‍👩‍👧 가족';
            return null;
          };

          return (
            <View>
              <View style={styles.header}>
                <View style={styles.userInfo}>
                  <Text style={styles.userAvatar}>👤</Text>
                  <View>
                    <Text style={styles.userName}>{user?.displayName || user?.email?.split('@')[0] || t.guestUser}</Text>
                    <Text style={styles.userEmail}>{user?.email || ''}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={() => {
                    Alert.alert(t.logout, t.logoutConfirm, [
                      { text: t.cancel, style: 'cancel' },
                      { text: t.logout, style: 'destructive', onPress: handleLogout },
                    ]);
                  }}
                >
                  <Text style={styles.logoutBtnText}>{t.logout}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.profileCard}>
                <View style={styles.profileCardHeader}>
                  <Text style={styles.profileCardTitle}>
                    🧬 {t.myAllergyProfile}
                  </Text>
                  <TouchableOpacity style={styles.profileEditBtn} onPress={() => setShowEditProfile(true)}>
                    <Text style={styles.profileEditBtnText}>{t.edit}</Text>
                  </TouchableOpacity>
                </View>
                {profile && profile.profileComplete ? (
                  <View style={styles.profileChipRow}>
                    {allergyTypeChip() && (
                      <View style={styles.profileChip}>
                        <Text style={styles.profileChipText}>{allergyTypeChip()}</Text>
                      </View>
                    )}
                    {profile.severity === 'severe' && (
                      <View style={[styles.profileChip, styles.profileChipSevere]}>
                        <Text style={[styles.profileChipText, styles.profileChipSevereText]}>{severityChip()}</Text>
                      </View>
                    )}
                    {profile.severity === 'moderate' && (
                      <View style={[styles.profileChip, styles.profileChipModerate]}>
                        <Text style={[styles.profileChipText, styles.profileChipModerateText]}>{severityChip()}</Text>
                      </View>
                    )}
                    {profile.severity === 'mild' && (
                      <View style={[styles.profileChip, styles.profileChipMild]}>
                        <Text style={[styles.profileChipText, styles.profileChipMildText]}>{severityChip()}</Text>
                      </View>
                    )}
                    {targetChip() && (
                      <View style={styles.profileChip}>
                        <Text style={styles.profileChipText}>{targetChip()}</Text>
                      </View>
                    )}
                    {!!profile.region && (
                      <View style={styles.profileChip}>
                        <Text style={styles.profileChipText}>📍 {profile.region}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.profileEmpty}>
                    <Text style={styles.profileEmptyText}>
                      {t.profileSetupPrompt}
                    </Text>
                    <TouchableOpacity style={styles.profileSetupBtn} onPress={() => setShowEditProfile(true)}>
                      <Text style={styles.profileSetupBtnText}>{t.setUp}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitle}>⭐  {t.favorites}</Text>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>{t.myTitle}</Text>
            <Text style={styles.emptySub}>{t.noFavorites}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const d = item[lang];
          return (
            <View style={styles.card}>
              <Text style={styles.cardImg}>{item.img}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{d.name}</Text>
                <Text style={styles.cardSub}>{d.cat || item.brand}</Text>
              </View>
              <Badge risk={item.risk} t={t} />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => {
                  Alert.alert(
                    t.removeFavTitle,
                    t.removeFavConfirmFmt.replace('{name}', d.name),
                    [
                      { text: t.cancel, style: 'cancel' },
                      { text: t.remove, style: 'destructive', onPress: () => removeFavorite(item.id) },
                    ]
                  );
                }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListFooterComponent={() => (
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={confirmDeleteAccount}
            disabled={deleting}
            accessibilityRole="button"
          >
            {deleting
              ? <ActivityIndicator size="small" color="#AAA" />
              : <Text style={styles.deleteAccountText}>{t.deleteAccount}</Text>}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <Modal visible={pwModal} transparent animationType="fade" onRequestClose={() => { if (!deleting) setPwModal(false); }}>
        <View style={styles.pwOverlay}>
          <View style={styles.pwSheet}>
            <Text style={styles.pwTitle}>{t.deleteAccountPwTitle}</Text>
            <Text style={styles.pwMsg}>{t.deleteAccountPwMsg}</Text>
            <TextInput
              value={password}
              onChangeText={v => { setPassword(v); setPwError(''); }}
              placeholder={t.deleteAccountPwPh}
              placeholderTextColor="#BBB"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.pwInput}
              onSubmitEditing={submitPassword}
            />
            {!!pwError && <Text style={styles.pwError}>{pwError}</Text>}
            <View style={styles.pwBtnRow}>
              <TouchableOpacity style={styles.pwCancel} onPress={() => setPwModal(false)} disabled={deleting}>
                <Text style={styles.pwCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pwConfirm, (!password || deleting) && { opacity: 0.5 }]}
                onPress={submitPassword}
                disabled={!password || deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.pwConfirmText}>{t.deleteAccountConfirmBtn}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ProfileEditModal
        visible={showEditProfile}
        user={user}
        lang={lang}
        initialData={profile}
        onClose={() => setShowEditProfile(false)}
        onSaved={() => { setShowEditProfile(false); loadProfile(); }}
      />
    </View>
  );
}

// 다른 화면에서 즐겨찾기 추가할 때 사용하는 유틸 함수
export async function toggleFavorite(id, type) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const favs = raw ? JSON.parse(raw) : [];
    const exists = favs.find(f => f.id === id);
    const next = exists ? favs.filter(f => f.id !== id) : [...favs, { id, type }];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return !exists; // true = 추가됨, false = 제거됨
  } catch (e) {
    return false;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  list: { padding: 13, paddingBottom: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userAvatar: { fontSize: 32 },
  userName: { fontSize: 15, fontWeight: '900', color: '#1A1A1A' },
  userEmail: { fontSize: 11, color: '#999', marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#FEF0ED', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#F5C6BB',
  },
  logoutBtnText: { fontSize: 12, color: '#C13A2D', fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#333', marginBottom: 10 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#999' },
  emptySub: { fontSize: 12, color: '#CCC', marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: 'white', borderRadius: 14,
    padding: 14, marginBottom: 9,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImg: { fontSize: 26 },
  cardBody: { flex: 1 },
  cardName: { fontWeight: '800', fontSize: 14 },
  cardSub: { fontSize: 11, color: '#999', marginTop: 2 },
  removeBtn: {
    backgroundColor: '#F5F0EB', borderRadius: 15,
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { fontSize: 12, color: '#999' },
  profileCard: {
    backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  profileCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  profileCardTitle: { fontSize: 13, fontWeight: '900', color: '#333' },
  profileEditBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FFF2ED', borderRadius: 8 },
  profileEditBtnText: { fontSize: 12, color: '#E8704A', fontWeight: '700' },
  profileChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  profileChip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F5F0EB', borderRadius: 20 },
  profileChipText: { fontSize: 12, color: '#555', fontWeight: '600' },
  profileChipSevere: { backgroundColor: '#FFF0EE' },
  profileChipSevereText: { color: '#C13A2D' },
  profileChipModerate: { backgroundColor: '#FDF3E3' },
  profileChipModerateText: { color: '#C17C1A' },
  profileChipMild: { backgroundColor: '#E8F5ED' },
  profileChipMildText: { color: '#2D8A4E' },
  profileEmpty: { paddingVertical: 6 },
  profileEmptyText: { fontSize: 12, color: '#BBB', marginBottom: 8 },
  profileSetupBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#E8704A', borderRadius: 8 },
  profileSetupBtnText: { fontSize: 12, color: 'white', fontWeight: '700' },
  deleteAccountBtn: { alignSelf: 'center', marginTop: 32, paddingVertical: 10, paddingHorizontal: 16 },
  deleteAccountText: { fontSize: 12, color: '#AAA', textDecorationLine: 'underline' },
  pwOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  pwSheet: { backgroundColor: 'white', borderRadius: 16, padding: 20 },
  pwTitle: { fontSize: 16, fontWeight: '900', color: '#222', marginBottom: 6 },
  pwMsg: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 19 },
  pwInput: {
    borderWidth: 1.5, borderColor: '#EEE', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333',
  },
  pwError: { color: '#C13A2D', fontSize: 12, marginTop: 8 },
  pwBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  pwCancel: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F5F0EB', alignItems: 'center' },
  pwCancelText: { fontSize: 14, color: '#666', fontWeight: '700' },
  pwConfirm: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#C13A2D', alignItems: 'center' },
  pwConfirmText: { fontSize: 14, color: 'white', fontWeight: '800' },
});

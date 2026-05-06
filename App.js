// App.js — 메인 앱 (회원 인증 + 탭바 수정)
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './src/data/translations';
import { onAuthChange } from './src/firebase/authService';
import { checkIsAdmin } from './src/firebase/dbService';
import AdminScreen from './src/screens/AdminScreen';
import { AuthScreen, ConsentScreen } from './src/screens/AuthScreens';
import BrandScreen from './src/screens/BrandScreen';
import CardScreen from './src/screens/CardScreen';
import FoodScreen from './src/screens/FoodScreen';
import MapScreen from './src/screens/MapScreen';
import MyScreen from './src/screens/MyScreen';
import RestaurantScreen from './src/screens/RestaurantScreen';

const TAB_ICONS = ['🏪','🍽️','🍪','🗺️','🥜','📋'];

function MainApp({ lang, setLang, user, setScreen, t }) {
  const [tabIdx, setTabIdx] = useState(0);
  const [crossTabRestaurant, setCrossTabRestaurant] = useState(null);
  const insets = useSafeAreaInsets();

  function navigateToRestaurant(restaurantItem) {
    setCrossTabRestaurant(restaurantItem);
    setTabIdx(1);
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🥜  {t.appName}</Text>
        <View style={styles.headerRight}>
          {user && (
            <TouchableOpacity onPress={async () => {
              const isAdmin = await checkIsAdmin(user.uid);
              if (isAdmin) setScreen('admin');
            }}>
              <View style={styles.userChip}>
                <Text style={styles.userChipText}>
                  {user.displayName ? user.displayName.slice(0,6) : user.email.split('@')[0].slice(0,6)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          <View style={styles.langSwitch}>
            {['ko','en'].map(l => (
              <TouchableOpacity key={l} onPress={() => setLang(l)}
                style={[styles.langBtn, lang===l && styles.langBtnActive]}>
                <Text style={styles.langText}>{l==='ko'?'🇰🇷':'🇺🇸'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.content}>
        {tabIdx===0 && <BrandScreen lang={lang} t={t} user={user} onNavigateToRestaurant={navigateToRestaurant} />}
        {tabIdx===1 && <RestaurantScreen lang={lang} t={t} user={user} initialRestaurant={crossTabRestaurant} onClearInitial={() => setCrossTabRestaurant(null)} />}
        {tabIdx===2 && <FoodScreen lang={lang} t={t} user={user} />}
        {tabIdx===3 && <MapScreen lang={lang} t={t} />}
        {tabIdx===4 && <CardScreen />}
        {tabIdx===5 && <MyScreen lang={lang} t={t} user={user} onLogout={() => setScreen('auth')} />}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {t.tabs.map((name, i) => (
          <TouchableOpacity key={i} style={styles.tabItem} onPress={() => setTabIdx(i)} activeOpacity={0.7}>
            <Text style={styles.tabIcon}>{TAB_ICONS[i]}</Text>
            <Text style={[styles.tabLabel, tabIdx===i && styles.tabLabelActive]}>{name}</Text>
            {tabIdx===i && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [lang, setLang] = useState('ko');
  const [user, setUser] = useState(null);
  const [consentDone, setConsentDone] = useState(false);
  const [profileDone, setProfileDone] = useState(false);
  const t = T[lang];

  function handleSetLang(l) {
    setLang(l);
    AsyncStorage.setItem('pf_lang', l).catch(() => {});
  }

  useEffect(() => {
    if (!__DEV__) {
      (async () => {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        } catch (e) {
          // 업데이트 실패 시 앱 계속 실행
          console.log('OTA update check failed:', e);
        }
      })();
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthChange(u => {
      setUser(u);
      if (u && u.emailVerified) {
        setScreen(consentDone ? 'app' : 'consent');
      } else {
        setScreen('auth');
      }
    });
    return () => unsub();
  }, [consentDone]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('pf_profileDone'),
      AsyncStorage.getItem('pf_consentDone'),
      AsyncStorage.getItem('pf_lang'),
    ]).then(([profile, consent, savedLang]) => {
      if (profile === 'true') setProfileDone(true);
      if (consent === 'true') setConsentDone(true);
      if (savedLang === 'ko' || savedLang === 'en') setLang(savedLang);
    }).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      {screen === 'loading' && (
        <View style={styles.loadingScreen}>
          <Text style={styles.loadingLogo}>🥜</Text>
          <ActivityIndicator color="#E8704A" style={{marginTop:16}} />
        </View>
      )}
      {screen === 'auth' && (
        <AuthScreen
          onSuccess={u => { setUser(u); setScreen('consent'); }}
          lang={lang} setLang={handleSetLang} t={t}
        />
      )}
      {screen === 'consent' && (
        <ConsentScreen
          onAccept={() => { setConsentDone(true); AsyncStorage.setItem('pf_consentDone', 'true').catch(() => {}); setScreen(profileDone ? 'app' : 'profile'); }}
          t={t}
        />
      )}
      {screen === 'profile' && (
        <ProfileSetupScreen
          user={user}
          lang={lang}
          onDone={async () => {
            await AsyncStorage.setItem('pf_profileDone', 'true');
            setProfileDone(true);
            setScreen('app');
          }}
          onSkip={async () => {
            await AsyncStorage.setItem('pf_profileDone', 'true');
            setProfileDone(true);
            setScreen('app');
          }}
        />
      )}
      {screen === 'admin' && (
        <AdminScreen onExit={() => setScreen('app')} t={t} />
      )}
      {screen === 'app' && (
        <MainApp lang={lang} setLang={handleSetLang} user={user} setScreen={setScreen} t={t} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1, backgroundColor:'#FAF8F5' },
  loadingScreen: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#FAF8F5' },
  loadingLogo: { fontSize:64 },
  header: {
    backgroundColor:'white', flexDirection:'row', justifyContent:'space-between',
    alignItems:'center', paddingHorizontal:16, paddingVertical:12,
    borderBottomWidth:1, borderBottomColor:'#F0EDE8',
  },
  headerTitle: { fontSize:18, fontWeight:'900', color:'#222' },
  headerRight: { flexDirection:'row', alignItems:'center', gap:8 },
  userChip: { backgroundColor:'#EBF3FF', borderRadius:12, paddingHorizontal:10, paddingVertical:4 },
  userChipText: { fontSize:11, color:'#4A7FBF', fontWeight:'700' },
  langSwitch: { flexDirection:'row', backgroundColor:'#F0EDE8', borderRadius:8, padding:2, gap:2 },
  langBtn: { paddingHorizontal:8, paddingVertical:4, borderRadius:6 },
  langBtnActive: { backgroundColor:'white' },
  langText: { fontSize:14 },
  content: { flex:1 },
  tabBar: {
    flexDirection:'row', backgroundColor:'white',
    borderTopWidth:1, borderTopColor:'#F0EDE8',
  },
  tabItem: { flex:1, alignItems:'center', paddingVertical:8, position:'relative' },
  tabIcon: { fontSize:20, marginBottom:2 },
  tabLabel: { fontSize:9, color:'#BBB' },
  tabLabelActive: { color:'#E8704A', fontWeight:'700' },
  tabIndicator: {
    position:'absolute', top:0, left:'25%', right:'25%',
    height:2, backgroundColor:'#E8704A', borderRadius:1,
  },
});
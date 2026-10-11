// src/screens/AuthScreens.js — 회원가입/로그인/동의
import { useState } from 'react';
import {
  ActivityIndicator, Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { signIn, signUp } from '../firebase/authService';

// ── 탭: 로그인 / 회원가입 ──────────────────────────────────
export function AuthScreen({ onSuccess, lang, setLang, t }) {
  const [tab, setTab] = useState('login'); // login | signup
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
      >
        {/* 언어 스위치 */}
        <View style={styles.langRow}>
          {['ko','en'].map(l => (
            <TouchableOpacity key={l} onPress={() => setLang(l)}
              style={[styles.langBtn, lang===l && styles.langBtnActive]}>
              <Text style={[styles.langText, lang===l && styles.langTextActive]}>
                {l==='ko' ? '🇰🇷 한국어' : '🇺🇸 English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.logo}>🥜</Text>
        <Text style={styles.appName}>{t.appName}</Text>
        <Text style={styles.appSub}>{t.appSub}</Text>

        {/* 로그인 / 회원가입 탭 */}
        <View style={styles.tabRow}>
          {[['login', t.loginTab], ['signup', t.signupTab]].map(([v,l]) => (
            <TouchableOpacity key={v} onPress={() => setTab(v)}
              style={[styles.tabBtn, tab===v && styles.tabBtnActive]}>
              <Text style={[styles.tabText, tab===v && styles.tabTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'login'
          ? <LoginForm onSuccess={onSuccess} t={t} />
          : <SignupForm onSuccess={() => setTab('login')} t={t} />
        }
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── 로그인 폼 ──────────────────────────────────────────────
function LoginForm({ onSuccess, t }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !pw) { Alert.alert(t.authFillAll); return; }
    setLoading(true);
    try {
      const user = await signIn(email, pw);
      if (!user.emailVerified) {
        Alert.alert(t.emailVerifyTitle, t.emailVerifyMsg);
        setLoading(false);
        return;
      }
      onSuccess(user);
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use' ? t.emailInUse
        : e.code === 'auth/invalid-email' ? t.invalidEmailFmt
        : `${t.error}: ${e.code} / ${e.message}`;
      Alert.alert(t.signupFail, msg);
    }
    setLoading(false);
  }

  return (
    <View style={styles.form}>
      <TextInput value={email} onChangeText={setEmail}
        placeholder={t.emailPh} placeholderTextColor="#BBB"
        keyboardType="email-address" autoCapitalize="none"
        style={styles.input} />
      <TextInput value={pw} onChangeText={setPw}
        placeholder={t.passwordPh} placeholderTextColor="#BBB"
        secureTextEntry style={styles.input} />
      <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]}
        onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color="white" />
          : <Text style={styles.primaryBtnText}>{t.loginBtn}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ── 회원가입 폼 ────────────────────────────────────────────
function SignupForm({ onSuccess, t }) {
  const [form, setForm] = useState({ email:'', pw:'', pw2:'', nickname:'' });
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({...f, [k]: v})); }

  async function handleSignup() {
    if (!form.email || !form.pw || !form.nickname) {
      Alert.alert(t.signupFillAll); return;
    }
    if (form.pw !== form.pw2) {
      Alert.alert(t.pwMismatch); return;
    }
    if (form.pw.length < 6) {
      Alert.alert(t.pwTooShort); return;
    }
    if (form.nickname.length < 2) {
      Alert.alert(t.nickTooShort); return;
    }
    setLoading(true);
    try {
      await signUp(form.email, form.pw, form.nickname);
      Alert.alert(
        t.signupDoneTitle,
        t.signupDoneMsgFmt.replace('{email}', form.email),
        [{ text: t.confirm, onPress: onSuccess }]
      );
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use' ? t.emailInUse
        : e.code === 'auth/invalid-email' ? t.invalidEmailFmt
        : t.signupErrMsg;
      Alert.alert(t.signupFail, msg);
    }
    setLoading(false);
  }

  return (
    <View style={styles.form}>
      {/* 신뢰 안내 배너 */}
      <View style={styles.trustBanner}>
        <Text style={styles.trustIcon}>🛡️</Text>
        <View style={{flex:1}}>
          <Text style={styles.trustTitle}>{t.signupBannerTitle}</Text>
          <Text style={styles.trustSub}>{t.signupBannerSub}</Text>
        </View>
      </View>

      {[
        ['email', t.emailLabel, 'example@gmail.com', 'email-address', false],
        ['nickname', t.nicknameLabel, t.nicknamePh, 'default', false],
        ['pw', t.pwLabel, t.pwPh, 'default', true],
        ['pw2', t.pw2Label, t.pw2Ph, 'default', true],
      ].map(([k,l,ph,kbType,secure]) => (
        <View key={k}>
          <Text style={styles.fieldLabel}>{l}</Text>
          <TextInput value={form[k]} onChangeText={v => set(k,v)}
            placeholder={ph} placeholderTextColor="#BBB"
            keyboardType={kbType} autoCapitalize="none"
            secureTextEntry={secure} style={styles.input} />
        </View>
      ))}

      <View style={styles.ruleBox}>
        <Text style={styles.ruleText}>{t.signupTermsTitle}</Text>
        <Text style={styles.ruleSub}>{t.signupTerms}</Text>
      </View>

      <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]}
        onPress={handleSignup} disabled={loading}>
        {loading
          ? <ActivityIndicator color="white" />
          : <Text style={styles.primaryBtnText}>{t.signupSendEmail}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ── 동의 화면 ──────────────────────────────────────────────
export function ConsentScreen({ onAccept, t }) {
  // 모든 항목(의료 면책 고지 포함)이 필수 — 전부 체크해야 버튼 활성화
  const [checks, setChecks] = useState(() => t.consentItems.map(() => false));
  const allChecked = checks.length === t.consentItems.length && checks.every(Boolean);
  function toggle(i) { const n=[...checks]; n[i]=!n[i]; setChecks(n); }
  return (
    <ScrollView style={styles.consentBg} contentContainerStyle={styles.consentScroll}>
      <Text style={styles.consentAppName}>🥜  {t.appName}</Text>
      <Text style={styles.consentTitle}>{t.consentTitle}</Text>
      {t.consentItems.map((txt,i) => (
        <TouchableOpacity key={i} style={styles.checkRow} onPress={() => toggle(i)} activeOpacity={0.7}>
          <View style={[styles.checkbox, checks[i] && styles.checkboxChecked]}>
            {checks[i] && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkText}>{txt}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[styles.consentBtn, !allChecked && styles.consentBtnDisabled]}
        onPress={onAccept} disabled={!allChecked}>
        <Text style={[styles.consentBtnText, !allChecked && styles.consentBtnTextDisabled]}>
          {t.consentBtn}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#FAF8F5' },
  scroll: { padding:24, alignItems:'center', paddingTop:56, paddingBottom:120 },
  langRow: {
    flexDirection:'row', backgroundColor:'#F0EDE8',
    borderRadius:10, padding:3, gap:2, marginBottom:28,
  },
  langBtn: { paddingHorizontal:14, paddingVertical:7, borderRadius:8 },
  langBtnActive: { backgroundColor:'white' },
  langText: { fontSize:12, color:'#999' },
  langTextActive: { color:'#E8704A', fontWeight:'700' },
  logo: { fontSize:56, marginBottom:8 },
  appName: { fontSize:26, fontWeight:'900', marginBottom:4 },
  appSub: { fontSize:13, color:'#888', textAlign:'center', marginBottom:28 },
  tabRow: {
    flexDirection:'row', backgroundColor:'#F5F0EB',
    borderRadius:10, padding:3, width:'100%', marginBottom:16,
  },
  tabBtn: { flex:1, paddingVertical:10, borderRadius:8, alignItems:'center' },
  tabBtnActive: { backgroundColor:'white' },
  tabText: { fontSize:13, color:'#999' },
  tabTextActive: { color:'#333', fontWeight:'800' },
  form: { width:'100%', gap:10 },
  fieldLabel: { fontSize:11, color:'#888', marginBottom:3, marginTop:4 },
  input: {
    backgroundColor:'white', borderRadius:10, borderWidth:1.5, borderColor:'#EEE',
    paddingHorizontal:14, paddingVertical:12, fontSize:14, color:'#333',
  },
  primaryBtn: {
    backgroundColor:'#E8704A', borderRadius:12,
    paddingVertical:15, alignItems:'center', marginTop:8,
  },
  btnDisabled: { opacity:0.6 },
  primaryBtnText: { color:'white', fontSize:15, fontWeight:'800' },
  trustBanner: {
    backgroundColor:'#EBF3FF', borderRadius:10, padding:12,
    flexDirection:'row', gap:10, alignItems:'flex-start',
  },
  trustIcon: { fontSize:20 },
  trustTitle: { fontSize:13, fontWeight:'800', color:'#2A5A9A', marginBottom:2 },
  trustSub: { fontSize:11, color:'#4A7FBF', lineHeight:17 },
  ruleBox: {
    backgroundColor:'#FFF8E7', borderWidth:1.5, borderColor:'#F5C842',
    borderRadius:10, padding:12, marginTop:4,
  },
  ruleText: { fontSize:12, fontWeight:'800', color:'#8B6914', marginBottom:6 },
  ruleSub: { fontSize:11, color:'#8B6914', lineHeight:20 },
  // Consent
  consentBg: { flex:1, backgroundColor:'#FAF8F5' },
  consentScroll: { padding:24, paddingTop:56 },
  consentAppName: { fontSize:22, fontWeight:'900', marginBottom:6 },
  consentTitle: { fontSize:13, color:'#888', marginBottom:24 },
  checkRow: {
    flexDirection:'row', alignItems:'flex-start', gap:12,
    backgroundColor:'white', borderRadius:12, padding:14,
    marginBottom:10, shadowColor:'#000',
    shadowOffset:{width:0,height:1}, shadowOpacity:0.05, elevation:1,
  },
  checkbox: {
    width:22, height:22, borderRadius:6, borderWidth:2, borderColor:'#DDD',
    backgroundColor:'white', alignItems:'center', justifyContent:'center',
    flexShrink:0, marginTop:1,
  },
  checkboxChecked: { backgroundColor:'#E8704A', borderColor:'#E8704A' },
  checkmark: { color:'white', fontSize:13, fontWeight:'900' },
  checkText: { flex:1, fontSize:12, color:'#555', lineHeight:20 },
  consentBtn: {
    backgroundColor:'#E8704A', borderRadius:12,
    paddingVertical:16, alignItems:'center', marginTop:16,
  },
  consentBtnDisabled: { backgroundColor:'#EEE' },
  consentBtnText: { color:'white', fontSize:15, fontWeight:'800' },
  consentBtnTextDisabled: { color:'#BBB' },
});
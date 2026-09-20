// 앱 내 의견 주간 요약 메일 — node scripts/feedback-digest.mjs [--dry]
// 아직 메일로 안 보낸 feedback 문서만 모아 한 통으로 보내고, 보낸 문서에 emailedAt 을 남긴다.
// 새 의견이 없으면 아무것도 보내지 않는다. 맥이 꺼져 있던 주가 있어도 다음 실행 때 같이 나간다.
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const TO = process.env.FEEDBACK_DIGEST_TO || 'redeyemars@gmail.com';

// .env.local 의 GMAIL_USER / GMAIL_APP_PASSWORD 를 읽어 파이썬 발송기에 넘긴다
const env = { ...process.env };
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const WHERE = { brand: '브랜드', restaurant: '식당', food: '식품', map: '지도', card: '알레르기카드', account: '가입·로그인', other: '기타' };
const KIND = { bug: '오류', wrong: '정보 틀림', missing: '없음', hard: '불편', idea: '제안', good: '칭찬' };
const esc = t => String(t ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const when = ts => (ts?.toDate ? ts.toDate() : new Date()).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(path.join(ROOT, 'serviceAccountKey.json')))) });
const col = admin.firestore().collection('feedback');

const snap = await col.orderBy('createdAt', 'desc').get();
const fresh = snap.docs.filter(d => !d.data().emailedAt);
if (fresh.length === 0) {
  console.log('새 의견 없음 — 메일 보내지 않음');
  process.exit(0);
}

const rows = fresh.map(d => ({ id: d.id, ...d.data() }));
const counts = rows.reduce((a, r) => { const k = KIND[r.kind] || '분류 없음'; a[k] = (a[k] || 0) + 1; return a; }, {});
const summary = Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ');

const text = rows.map(r => [
  `[${KIND[r.kind] || '-'} / ${WHERE[r.where] || '-'}] ${when(r.createdAt)}`,
  r.message || '(내용 없음)',
  [r.appVersion && `v${r.appVersion}`, r.platform, r.contact].filter(Boolean).join(' · '),
].join('\n')).join('\n\n──────────\n\n');

const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:680px">
<h2 style="margin:0 0 4px">💬 땅콩프리 의견 ${rows.length}건</h2>
<p style="color:#666;margin:0 0 18px">${esc(summary)}</p>
${rows.map(r => `<div style="border:1px solid #e6ded3;border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="font-size:12px;color:#8a7f72">
    <b style="color:#2b2b2b">${esc(KIND[r.kind] || '분류 없음')}</b> · ${esc(WHERE[r.where] || '화면 미지정')} · ${esc(when(r.createdAt))}
  </div>
  <div style="font-size:15px;line-height:1.55;margin:8px 0;white-space:pre-wrap">${esc(r.message) || '<i style="color:#aaa">내용 없이 선택만</i>'}</div>
  <div style="font-size:12px;color:#a39a8e">${esc([r.appVersion && 'v' + r.appVersion, r.platform, r.contact].filter(Boolean).join('  ·  '))}</div>
</div>`).join('')}
<p style="font-size:12px;color:#a39a8e">관리자 화면(앱 &gt; 헤더 🛡️관리자 &gt; 받은 의견)에서 처리 표시를 할 수 있어요.</p>
</div>`;

const payload = { to: TO, subject: `[땅콩프리] 새 의견 ${rows.length}건 — ${summary}`, text, html };

if (DRY) {
  console.log(`(dry-run) 받는 사람 ${TO} / ${rows.length}건\n`);
  console.log(text.slice(0, 1200));
  process.exit(0);
}

const res = spawnSync('python3', [path.join(ROOT, 'scripts/send-mail.py')], { input: JSON.stringify(payload), env, encoding: 'utf8' });
if (res.status !== 0) {
  console.error('메일 발송 실패:', (res.stderr || res.stdout || '').trim());
  process.exit(1);   // 실패하면 emailedAt 을 찍지 않는다 — 다음 실행 때 다시 보낸다
}

const now = admin.firestore.FieldValue.serverTimestamp();
for (let i = 0; i < fresh.length; i += 400) {
  const batch = admin.firestore().batch();
  fresh.slice(i, i + 400).forEach(d => batch.update(d.ref, { emailedAt: now }));
  await batch.commit();
}
console.log(`메일 발송 완료 — ${rows.length}건, 받는 사람 ${TO}`);
process.exit(0);

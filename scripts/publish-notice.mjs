// 업데이트 공지 팝업 발행 — node scripts/publish-notice.mjs "<제목>" "<본문>" [--apply]
// 기존 활성 공지는 비활성화하고 새 공지 1건을 올린다. 승인이 끝난 뒤에 실행할 것.
import admin from 'firebase-admin';
import fs from 'fs';

const [title, body] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
if (!title || !body) { console.error('사용법: node scripts/publish-notice.mjs "<제목>" "<본문>" [--apply]'); process.exit(1); }
console.log(`제목: ${title}\n본문:\n${body}`);
if (!APPLY) { console.log('\n(dry-run) 쓰기 없음. --apply 로 발행'); process.exit(0); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const batch = db.batch();
(await db.collection('notices').where('active', '==', true).get()).docs.forEach(d => batch.update(d.ref, { active: false }));
const id = `notice_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
batch.set(db.collection('notices').doc(id), { title, body, active: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
await batch.commit();
console.log(`발행 완료: ${id}`);

// firestore.rules 게시 — node scripts/publish-rules.mjs [--apply]
// 기본은 컴파일 확인만(비활성 ruleset 생성 후 삭제). --apply 를 줘야 운영 release 를 바꾼다.
// 되돌리기: node scripts/publish-rules.mjs --rollback <rulesetName>
import fs from 'fs';
import admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const ROLLBACK = process.argv.includes('--rollback') ? process.argv[process.argv.indexOf('--rollback') + 1] : null;
const key = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
const PROJECT = key.project_id;
const API = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;

const auth = new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const client = await auth.getClient();
const call = async (url, method = 'GET', data) => (await client.request({ url, method, data })).data;

// 지금 운영 중인 ruleset 을 먼저 기록해 둔다 (롤백용)
const release = await call(`${API}/releases/cloud.firestore`);
const current = release.rulesetName;
console.log('현재 운영 ruleset:', current);

if (ROLLBACK) {
  if (!APPLY) { console.log(`(dry-run) ${ROLLBACK} 로 되돌릴 예정`); process.exit(0); }
  await call(`${API}/releases/cloud.firestore`, 'PATCH', { release: { name: `projects/${PROJECT}/releases/cloud.firestore`, rulesetName: ROLLBACK } });
  console.log('롤백 완료 →', ROLLBACK);
  process.exit(0);
}

const source = fs.readFileSync('firestore.rules', 'utf8');
const created = await call(`${API}/rulesets`, 'POST', { source: { files: [{ name: 'firestore.rules', content: source }] } });
console.log('컴파일 성공, 새 ruleset:', created.name);

if (!APPLY) {
  await call(`https://firebaserules.googleapis.com/v1/${created.name}`, 'DELETE');
  console.log('(dry-run) 새 ruleset 삭제함 — 운영 규칙은 그대로');
  process.exit(0);
}

await call(`${API}/releases/cloud.firestore`, 'PATCH', { release: { name: `projects/${PROJECT}/releases/cloud.firestore`, rulesetName: created.name } });
console.log('게시 완료 →', created.name);
console.log('되돌리려면: node scripts/publish-rules.mjs --rollback', current, '--apply');
process.exit(0);

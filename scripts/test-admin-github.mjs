// ทดสอบ adapter แบบ github กับ branch ทดสอบแยก (ไม่แตะ main) แล้วลบ branch ทิ้ง
//   ตรวจ: verify token, อ่านข้อมูล, commit เดียวต่อการบันทึก (blob → tree → commit → อัปเดต ref), เพิ่ม/ลบรูป,
//        การป้องกันเขียนทับ (ไฟล์เปลี่ยนหลังโหลด), ประวัติ commit ของแอดมิน
// ต้องมี token ที่เขียน repo ได้: ตั้ง GITHUB_TOKEN หรือล็อกอิน GitHub CLI (gh auth login)
// รัน: node scripts/test-admin-github.mjs [owner/repo]

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(join(root, 'site', 'admin', p)).href);
const model = await imp('model.js');
const { validateDataset, errorsOf } = await imp('validate.js');
const { githubAdapter, ConflictError } = await imp('adapters.js');
model.configureModel({ aiRefPrefix: JSON.parse(readFileSync(join(root, 'site/admin/th.json'), 'utf8'))['const.aiRefPrefix'] });

let token = process.env.GITHUB_TOKEN;
if (!token) { try { token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim(); } catch { /* ไม่มี gh */ } }
if (!token) { console.log('ไม่มี token (ตั้ง GITHUB_TOKEN หรือ gh auth login)'); process.exit(2); }
let repo = process.argv[2];
if (!repo) {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim();
  repo = url.replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '');
}
const BRANCH = `admin-test-${Date.now()}`;
if (BRANCH === 'main' || BRANCH === 'master') process.exit(3);

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };
const gh = async (path, method = 'GET', body) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) throw new Error(`${method} ${path} → ${res.status}`);
  return res.status === 204 ? null : res.status === 404 ? { notFound: true } : res.json();
};

const mainRef = await gh('/git/ref/heads/main');
const mainSha = mainRef.object.sha;
await gh('/git/refs', 'POST', { ref: `refs/heads/${BRANCH}`, sha: mainSha });
console.log(`repo ${repo}, branch ทดสอบ ${BRANCH} (สร้างจาก main ${mainSha.slice(0, 7)})`);

try {
  const adapter = githubAdapter({ token, repo, branch: BRANCH });
  const adapterBad = githubAdapter({ token: 'github_pat_invalid', repo, branch: BRANCH });
  const adapterOther = githubAdapter({ token, repo: repo.split('/')[0] + '/no-such-repo-xyz', branch: BRANCH });

  console.log('\n== ตรวจ token');
  const v = await adapter.verify();
  check(v.problems.length === 0 && v.canWrite && v.login, `token ใช้ได้ เขียนได้ (ผู้ใช้ ${v.login}, ดู Actions ได้: ${v.canSeeActions})`);
  check((await adapterBad.verify()).problems.includes('tokenInvalid'), 'token ผิด → บอกว่า token ไม่ถูกต้อง');
  check((await adapterOther.verify()).problems.some((p) => /repo/.test(p)), 'repo ที่เข้าไม่ได้ → บอกเหตุผลเกี่ยวกับ repo');

  console.log('\n== โหลดข้อมูล');
  let base = await model.loadBase(adapter);
  check(base.dataset.cells.length > 250 && base.head === mainSha, `โหลดเซลล์ ${base.dataset.cells.length} รายการ จาก head ${base.head.slice(0, 7)}`);
  check(errorsOf(validateDataset(base.dataset, { fileExists: (p) => p in base.shas })).length === 0, 'ข้อมูลที่โหลดผ่านการตรวจ');
  check(Object.entries(model.serializeDataset(base.dataset)).every(([p, t]) => base.texts[p] === t), 'serialize ได้ไฟล์ตรงกับ repo ทุกไบต์');

  console.log('\n== commit เดียว: แก้เซลล์ + เพิ่มรูป');
  const nph = base.dataset.cells.find((c) => c.id === 'CL:0000775');
  const png = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3]);
  const edited = model.normalizeCell(nph);
  edited.function += ' (ทดสอบ admin)';
  edited.images = [{ src: 'images/neutrophil/micrograph-1.webp', type: 'micrograph', alt_th: 'ทดสอบ', credit: 'ทดสอบ', license: 'Own work' }];
  const ov = model.emptyOverlay();
  ov.cells[nph.id] = { cell: edited, base: model.cellJson(nph) };
  const blobs = new Map([['site/images/neutrophil/micrograph-1.webp', png]]);
  const { dataset } = model.applyOverlay(base, ov);
  check(errorsOf(validateDataset(dataset, { fileExists: (p) => p in base.shas || blobs.has(p) })).length === 0, 'การแก้ผ่านการตรวจ');
  const { files } = model.buildChangeSet(base, dataset, blobs);
  const expected = Object.fromEntries(files.map((f) => [f.path, base.shas[f.path] || null]));
  const res = await adapter.commit({ message: 'admin: แก้ นิวโทรฟิล, เพิ่มรูป 1 รูป (ทดสอบ)', base: base.head, expected, changes: files });
  const commit = await gh(`/git/commits/${res.id}`);
  check(commit.parents.length === 1 && commit.parents[0].sha === mainSha, 'ได้ commit เดียว ต่อจาก head เดิม');
  const cmp = await gh(`/compare/${mainSha}...${BRANCH}`);
  check(cmp.total_commits === 1 && cmp.files.length === files.length, `branch ทดสอบมี 1 commit เปลี่ยน ${cmp.files.length} ไฟล์: ${cmp.files.map((f) => f.filename).join(', ')}`);
  const mainNow = await gh('/git/ref/heads/main');
  check(mainNow.object.sha === mainSha, 'main ไม่ถูกแตะ');

  console.log('\n== โหลดซ้ำและลบรูป');
  base = await model.loadBase(adapter);
  check('site/images/neutrophil/micrograph-1.webp' in base.shas, 'ไฟล์รูปอยู่ใน repo (branch ทดสอบ)');
  const cur = model.findCell(base.dataset, 'CL:0000775');
  const ov2 = model.emptyOverlay();
  const noImg = model.normalizeCell(cur);
  noImg.images = [];
  ov2.cells[cur.id] = { cell: noImg, base: model.cellJson(cur) };
  const ds2 = model.applyOverlay(base, ov2).dataset;
  const cs2 = model.buildChangeSet(base, ds2, new Map());
  check(cs2.files.some((f) => f.kind === 'delete' && f.path.endsWith('micrograph-1.webp')), 'ลบรูป → ไฟล์ถูกลบด้วย');
  const r2 = await adapter.commit({ message: 'admin: ลบรูป (ทดสอบ)', base: base.head, expected: Object.fromEntries(cs2.files.map((f) => [f.path, base.shas[f.path] || null])), changes: cs2.files });
  const after = await model.loadBase(adapter);
  check(!('site/images/neutrophil/micrograph-1.webp' in after.shas) && after.head === r2.id, 'ไฟล์รูปหายจาก repo หลัง commit');

  console.log('\n== ป้องกันการเขียนทับ');
  const stale = await model.loadBase(adapter); // โหลดไว้
  // คนอื่น commit ไฟล์เดียวกัน
  const other = model.findCell(stale.dataset, 'CL:0000775');
  const otherEdit = model.normalizeCell(other); otherEdit.function += ' (คนอื่น)';
  const ovO = model.emptyOverlay(); ovO.cells[other.id] = { cell: otherEdit, base: model.cellJson(other) };
  const csO = model.buildChangeSet(stale, model.applyOverlay(stale, ovO).dataset, new Map());
  await adapter.commit({ message: 'admin: คนอื่นแก้ (ทดสอบ)', base: stale.head, expected: Object.fromEntries(csO.files.map((f) => [f.path, stale.shas[f.path] || null])), changes: csO.files });
  // เราแก้ไฟล์เดียวกันจาก snapshot เก่า
  const mine = model.normalizeCell(other); mine.function += ' (ของฉัน)';
  const ovM = model.emptyOverlay(); ovM.cells[other.id] = { cell: mine, base: model.cellJson(other) };
  const csM = model.buildChangeSet(stale, model.applyOverlay(stale, ovM).dataset, new Map());
  let err = null;
  try { await adapter.commit({ message: 'admin: ชน (ทดสอบ)', base: stale.head, expected: Object.fromEntries(csM.files.map((f) => [f.path, stale.shas[f.path] || null])), changes: csM.files }); } catch (e) { err = e; }
  check(err instanceof ConflictError && err.paths.includes('data/cells/blood-immune.json'), 'ไฟล์เปลี่ยนหลังโหลด → ConflictError ระบุไฟล์ที่ชน');
  const fresh = await model.loadBase(adapter);
  check(!model.findCell(fresh.dataset, 'CL:0000775').function.includes('(ของฉัน)'), 'ไม่มีการเขียนทับ');
  // ไฟล์คนละไฟล์: head เปลี่ยนแต่ไม่ชน → ผ่านและรวมเข้ากับ head ใหม่
  const sk = model.findCell(stale.dataset, 'CL:0000062');
  const skEdit = model.normalizeCell(sk); skEdit.function += ' (คนละไฟล์)';
  const ovS = model.emptyOverlay(); ovS.cells[sk.id] = { cell: skEdit, base: model.cellJson(sk) };
  const csS = model.buildChangeSet(stale, model.applyOverlay(stale, ovS).dataset, new Map());
  const rS = await adapter.commit({ message: 'admin: คนละไฟล์ (ทดสอบ)', base: stale.head, expected: Object.fromEntries(csS.files.map((f) => [f.path, stale.shas[f.path] || null])), changes: csS.files });
  const fin = await model.loadBase(adapter);
  check(rS.id === fin.head && model.findCell(fin.dataset, 'CL:0000775').function.includes('(คนอื่น)') && model.findCell(fin.dataset, 'CL:0000062').function.includes('(คนละไฟล์)'), 'แก้คนละไฟล์: ผ่าน และคงการแก้ของคนอื่นไว้');

  console.log('\n== ประวัติและสถานะ');
  const hist = await adapter.history(20);
  check(hist.length >= 4 && hist.every((c) => c.message.startsWith('admin:')), `ประวัติแสดง commit ของแอดมิน ${hist.length} รายการ`);
  const st = await adapter.status(rS.id);
  check(['pending', 'unknown', 'running', 'success', 'failure'].includes(st.state), `status() คืนค่า (${st.state}; branch ทดสอบไม่มี workflow รัน)`);
} finally {
  await gh(`/git/refs/heads/${BRANCH}`, 'DELETE');
  const gone = await gh(`/git/ref/heads/${BRANCH}`);
  console.log(gone.notFound ? `\nลบ branch ${BRANCH} แล้ว` : '\n! ลบ branch ทดสอบไม่สำเร็จ ลบเองด้วย: git push origin --delete ' + BRANCH);
}
console.log(failures ? `\nล้มเหลว ${failures} ข้อ` : '\nOK');
process.exit(failures ? 1 : 0);

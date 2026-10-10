// ทดสอบแกนของหน้าแอดมิน (โมเดล ตรวจข้อมูล adapter local และ admin_server.py) โดยไม่ใช้เบราว์เซอร์
// ทำงานกับสำเนาของโปรเจกต์ในโฟลเดอร์ชั่วคราวเท่านั้น ไม่แตะข้อมูลจริง
// รัน: node scripts/test-admin-core.mjs

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(join(root, 'site', 'admin', p)).href);
const model = await imp('model.js');
const { validateDataset, errorsOf } = await imp('validate.js');
const { localAdapter, ConflictError } = await imp('adapters.js');
const text = JSON.parse(readFileSync(join(root, 'site', 'admin', 'th.json'), 'utf8'));
model.configureModel({ aiRefPrefix: text['const.aiRefPrefix'] });

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };

// ---------- สำเนาโปรเจกต์ + เซิร์ฟเวอร์ local
const tmp = mkdtempSync(join(tmpdir(), 'nexus-admin-'));
for (const d of ['data', 'scripts']) cpSync(join(root, d), join(tmp, d), { recursive: true, filter: (s) => !/data[\\/]generated[\\/]cache/.test(s) });
cpSync(join(root, 'site'), join(tmp, 'site'), { recursive: true });
cpSync(join(root, 'package.json'), join(tmp, 'package.json'));
if (existsSync(join(root, 'node_modules'))) cpSync(join(root, 'node_modules', 'cytoscape-fcose'), join(tmp, 'node_modules', 'cytoscape-fcose'), { recursive: true });

const srv = spawn('python', [join(tmp, 'scripts', 'admin_server.py'), '--port', '0', '--root', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
const port = await new Promise((ok, no) => {
  let buf = '';
  srv.stdout.on('data', (d) => { buf += d; const m = buf.match(/127\.0\.0\.1:(\d+)\/admin/); if (m) ok(+m[1]); });
  srv.stderr.on('data', (d) => process.stderr.write(d));
  setTimeout(() => no(new Error('server timeout')), 10000);
});
const BASE = `http://127.0.0.1:${port}`;
const adapter = localAdapter({ base: BASE });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitStatus = async (id) => { for (let i = 0; i < 120; i++) { const s = await adapter.status(id); if (s.state !== 'running') return s; await sleep(500); } return { state: 'timeout' }; };

async function commitOverlay(base, overlay, msg, blobs = new Map()) {
  const { dataset } = model.applyOverlay(base, overlay);
  const errs = errorsOf(validateDataset(dataset, { fileExists: (p) => p in base.shas || blobs.has(p) }));
  if (errs.length) return { errs };
  const { files } = model.buildChangeSet(base, dataset, blobs);
  const expected = {};
  for (const f of files) expected[f.path] = base.shas[f.path] || null;
  const r = await adapter.commit({ message: msg, base: base.head, expected, changes: files });
  return { r, files };
}

try {
  console.log('\n== เซิร์ฟเวอร์ local');
  check(await adapter.ping(), 'ping ผ่าน');
  const bad = await fetch(`${BASE}/api/tree`);
  check(bad.status === 403, 'เรียก API โดยไม่มี header X-Nexus-Admin ถูกปฏิเสธ');
  const rebindStatus = await new Promise((ok) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/ping', headers: { 'X-Nexus-Admin': '1', Host: 'evil.example' } }, (res) => { res.resume(); ok(res.statusCode); });
    req.on('error', () => ok(0)); req.end();
  });
  check(rebindStatus === 403, 'Host อื่นถูกปฏิเสธ (กัน DNS rebinding)');
  const traversal = await fetch(`${BASE}/api/file?path=${encodeURIComponent('data/../scripts/nexus.py')}`, { headers: { 'X-Nexus-Admin': '1' } });
  check(traversal.status === 400, 'อ่านไฟล์นอก data/ ด้วย .. ถูกปฏิเสธ');
  const w = await fetch(`${BASE}/api/commit`, { method: 'POST', headers: { 'X-Nexus-Admin': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ path: 'scripts/nexus.py', content: 'eA==' }] }) });
  check(w.status === 400, 'เขียนนอก data/ และ site/images/ ถูกปฏิเสธ');
  const w2 = await fetch(`${BASE}/api/commit`, { method: 'POST', headers: { 'X-Nexus-Admin': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ files: [{ path: 'site/images/x.html', content: 'eA==' }] }) });
  check(w2.status === 400, 'เขียนไฟล์ที่ไม่ใช่รูปใน images/ ถูกปฏิเสธ');

  console.log('\n== โหลดและตรวจข้อมูลจริง');
  let base = await model.loadBase(adapter);
  check(base.dataset.cells.length === 265, `โหลดเซลล์ ${base.dataset.cells.length} รายการ`);
  const v0 = validateDataset(base.dataset, { fileExists: (p) => p in base.shas });
  check(errorsOf(v0).length === 0, 'ข้อมูลจริงผ่านการตรวจในเบราว์เซอร์ (ไม่มีข้อผิดพลาด)');
  const files0 = model.serializeDataset(base.dataset);
  check(Object.entries(files0).every(([p, t]) => base.texts[p] === t), 'serialize ข้อมูลที่ไม่แก้ ได้ไฟล์ตรงกับต้นฉบับทุกไบต์');
  check(model.buildChangeSet(base, base.dataset).files.length === 0, 'ไม่แก้อะไร → ไม่มีไฟล์ที่ต้อง commit');

  console.log('\n== แก้เซลล์');
  const nph = base.dataset.cells.find((c) => c.slug === 'neutrophil');
  const edited = { ...model.normalizeCell(nph), function: nph.function + ' (ทดสอบ)' };
  let ov = model.emptyOverlay();
  ov.cells[nph.id] = { cell: edited, base: model.cellJson(nph) };
  let res = await commitOverlay(base, ov, 'admin: แก้ neutrophil');
  check(res.r && res.files.length === 1 && res.files[0].path === 'data/cells/blood-immune.json', 'แก้เซลล์เดียว → เขียนไฟล์เดียว');
  const st = await waitStatus(res.r.id);
  check(st.state === 'success', `local: validate + build ผ่านหลัง commit (${st.state}) ${st.error || ''}`);
  const onDisk = JSON.parse(readFileSync(join(tmp, 'data/cells/blood-immune.json'), 'utf8'));
  check(onDisk.find((c) => c.id === nph.id).function.endsWith('(ทดสอบ)'), 'ไฟล์ในโฟลเดอร์เปลี่ยนจริง');

  console.log('\n== ป้องกันการเขียนทับ');
  const stale = base; // ยังเป็น sha เก่าของ blood-immune.json
  const ov2 = model.emptyOverlay();
  ov2.cells[nph.id] = { cell: { ...edited, function: 'ของอีกคน' }, base: model.cellJson(nph) };
  const r2 = { files: model.buildChangeSet(stale, model.applyOverlay(stale, ov2).dataset).files };
  let conflict = null;
  try { await adapter.commit({ message: 'x', base: stale.head, expected: { 'data/cells/blood-immune.json': stale.shas['data/cells/blood-immune.json'] }, changes: r2.files }); } catch (e) { conflict = e; }
  check(conflict instanceof ConflictError && conflict.paths.includes('data/cells/blood-immune.json'), 'ไฟล์เปลี่ยนหลังโหลด → หยุดและบอกว่าไฟล์ไหนชน');
  base = await model.loadBase(adapter);

  console.log('\n== เพิ่มเซลล์ใหม่ + เส้น + รูป');
  const newCell = {
    id: 'CL:0009999', slug: 'test-cell', kind: 'cell', en: 'test cell', th: 'เซลล์ทดสอบ', systems: ['endocrine', 'nervous'], tissue: 'epithelial', tissue_subtype: null,
    location: 'ที่ทดสอบ', morphology: '', function: 'ทำหน้าที่ทดสอบ', secretes: [], markers: ['X1'], lifespan: '', exam: '', diseases: [], confused_with: [],
    images: [{ src: 'images/test-cell/micrograph-1.webp', type: 'micrograph', alt_th: 'ภาพทดสอบ', credit: 'ทดสอบ', license: 'Own work' }],
    review: 'draft', refs: [],
  };
  const png = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); // ไบต์ตัวอย่าง (ไม่ใช่รูปจริง ใช้ทดสอบการเขียนไฟล์)
  const blobs = new Map([['site/images/test-cell/micrograph-1.webp', png]]);
  ov = model.emptyOverlay();
  ov.cells[newCell.id] = { cell: newCell, base: null };
  const parent = base.dataset.cells.find((c) => c.slug === 'neutrophil');
  ov.edges[model.edgeKey('develops_from', newCell.id, parent.id)] = { op: 'add', kind: 'develops_from', a: newCell.id, b: parent.id };
  ov.edges[model.edgeKey('interacts_with', newCell.id, parent.id)] = { op: 'add', kind: 'interacts_with', a: newCell.id, b: parent.id, mode: 'paracrine', th: 'ทดสอบ' };
  res = await commitOverlay(base, ov, 'admin: เพิ่ม test', blobs);
  check(res.r, 'เพิ่มเซลล์ใหม่ผ่านการตรวจ ' + JSON.stringify((res.errs || []).slice(0, 2)));
  const paths = res.files.map((f) => f.path).sort();
  check(paths.includes('data/cells/endocrine.json') && paths.includes('data/edges/endocrine.json') && paths.includes('site/images/test-cell/micrograph-1.webp'),
    'เซลล์ไปไฟล์ของระบบหลัก (endocrine) เส้นไปไฟล์ของเซลล์ต้นทาง และรูปถูกเขียน: ' + paths.join(', '));
  check((await waitStatus(res.r.id)).state === 'success', 'validate + build หลังเพิ่มเซลล์ผ่าน');
  check(statSync(join(tmp, 'site/images/test-cell/micrograph-1.webp')).size === png.length, 'ไฟล์รูปถูกเขียนลงดิสก์');
  base = await model.loadBase(adapter);

  console.log('\n== ลบเซลล์ (cascade) และลบรูป');
  ov = model.emptyOverlay();
  ov.cells['CL:0009999'] = { cell: null, base: model.cellJson(model.findCell(base.dataset, 'CL:0009999')) };
  const applied = model.applyOverlay(base, ov);
  check(applied.cascade.edges.length === 2, `ลบเซลล์ → เส้นที่อ้างถึงถูกลบตาม (${applied.cascade.edges.length} เส้น)`);
  res = await commitOverlay(base, ov, 'admin: ลบ test');
  check(res.r && res.files.some((f) => f.kind === 'delete' && f.path.endsWith('micrograph-1.webp')), 'ลบเซลล์ → ไฟล์รูปถูกลบด้วย');
  check((await waitStatus(res.r.id)).state === 'success', 'validate + build หลังลบผ่าน');
  check(!existsSync(join(tmp, 'site/images/test-cell')), 'โฟลเดอร์รูปที่ว่างถูกลบ');
  base = await model.loadBase(adapter);
  check(!model.findCell(base.dataset, 'CL:0009999'), 'เซลล์ที่ลบไม่อยู่ในข้อมูล');

  console.log('\n== กรณีผิด ต้องถูกปฏิเสธ');
  const mutate = (fn) => { const o = model.emptyOverlay(); const c = model.normalizeCell(base.dataset.cells.find((x) => x.slug === 'neutrophil')); fn(c); o.cells[c.id] = { cell: c, base: '' }; return errorsOf(validateDataset(model.applyOverlay(base, o).dataset, { fileExists: (p) => p in base.shas })); };
  check(mutate((c) => { c.function = 'x <script>alert(1)</script>'; }).some((e) => e.code === 'html'), 'ข้อความมี <script>');
  check(mutate((c) => { c.images = [{ src: 'http://x.org/a.jpg', type: 'photo', alt_th: 'a', credit: 'a', license: 'CC0', source: 'https://x.org' }]; }).some((e) => e.code === 'imgSrcHttps'), 'รูปลิงก์ไม่ใช่ https');
  check(mutate((c) => { c.images = [{ src: 'https://x.org/a.jpg', type: 'photo', alt_th: 'a', credit: 'a', license: 'CC0', source: 'http://x.org' }]; }).some((e) => e.code === 'imgSourceHttps'), 'source ไม่ใช่ https');
  check(mutate((c) => { c.images = [{ src: 'https://x.org/a.jpg', type: 'photo', alt_th: 'a', credit: 'a', source: 'https://x.org' }]; }).some((e) => e.code === 'imgRequired' && e.field.endsWith('license')), 'รูปไม่มี license');
  check(mutate((c) => { c.images = [{ src: 'https://x.org/a.jpg', type: 'photo', alt_th: 'a', credit: 'a', license: 'CC0' }]; }).some((e) => e.code === 'imgSourceNeeded'), 'รูปลิงก์ไม่มี source');
  check(mutate((c) => { c.review = 'textbook'; }).some((e) => e.code === 'textbookNeedsRef'), 'textbook ไม่มี ref');
  check(mutate((c) => { c.confused_with = [c.id]; }).some((e) => e.code === 'confusedSelf'), 'confused_with ชี้หาตัวเอง');
  check(mutate((c) => { c.systems = ['nope']; }).some((e) => e.code === 'systemUnknown'), 'ระบบที่ไม่มี');
  {
    const o = model.emptyOverlay();
    const [child, par] = base.dataset.edges['blood-immune'].is_a[0];
    o.edges[model.edgeKey('is_a', par, child)] = { op: 'add', kind: 'is_a', a: par, b: child };
    check(errorsOf(validateDataset(model.applyOverlay(base, o).dataset)).some((e) => e.code === 'edgeCycle'), 'is_a ที่วนกลับ');
    const o2 = model.emptyOverlay();
    o2.edges[model.edgeKey('develops_from', child, child)] = { op: 'add', kind: 'develops_from', a: child, b: child };
    check(errorsOf(validateDataset(model.applyOverlay(base, o2).dataset)).some((e) => e.code === 'edgeSelf'), 'เส้นชี้หาตัวเอง');
    const o3 = model.emptyOverlay();
    o3.edges[model.edgeKey('interacts_with', child, par)] = { op: 'add', kind: 'interacts_with', a: child, b: par, mode: 'bogus', th: 'x' };
    check(errorsOf(validateDataset(model.applyOverlay(base, o3).dataset)).some((e) => e.code === 'edgeMode'), 'interacts_with mode ไม่ถูกต้อง');
  }
} finally {
  srv.kill();
  await sleep(300);
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failures ? `\nล้มเหลว ${failures} ข้อ` : '\nOK');
process.exit(failures ? 1 : 0);

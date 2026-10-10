// ทดสอบหน้าแอดมินด้วย Chrome/Edge จริง + adapter local (admin_server.py) บนสำเนาโปรเจกต์ในโฟลเดอร์ชั่วคราว
//   แก้เซลล์ เพิ่มเซลล์ ลบเซลล์ เพิ่มเส้น เพิ่มรูป 3 รูป (สร้างขึ้นเอง มี EXIF GPS ติดมา) ตรวจว่ารูปที่บันทึกไม่มี EXIF
//   กรณีผิด (แท็ก <script>, ลิงก์ไม่ใช่ https, รูปไม่มี source, is_a วน) โหมดตรวจกับตำรา การป้องกันเขียนทับ และจอ 380px
// รัน: node scripts/test-admin-ui.mjs   (ต้องต่ออินเทอร์เน็ต เพราะโหลดไลบรารีกราฟจาก CDN)

import http from 'node:http';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const th = JSON.parse(readFileSync(join(root, 'site', 'admin', 'th.json'), 'utf8'));
const T = (k) => th[k];
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => existsSync(p));
if (!CHROME) { console.log('ไม่พบ Chrome/Edge'); process.exit(2); }

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- สำเนาโปรเจกต์ + เซิร์ฟเวอร์
const tmp = mkdtempSync(join(tmpdir(), 'nexus-adminui-'));
for (const d of ['data', 'scripts', 'site']) cpSync(join(root, d), join(tmp, d), { recursive: true, filter: (s) => !/data[\\/]generated[\\/]cache/.test(s) });
cpSync(join(root, 'package.json'), join(tmp, 'package.json'));
if (existsSync(join(root, 'node_modules', 'cytoscape-fcose'))) cpSync(join(root, 'node_modules', 'cytoscape-fcose'), join(tmp, 'node_modules', 'cytoscape-fcose'), { recursive: true });
const srv = spawn('python', [join(tmp, 'scripts', 'admin_server.py'), '--port', '0', '--root', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
const port = await new Promise((ok, no) => {
  let buf = '';
  srv.stdout.on('data', (d) => { buf += d; const m = buf.match(/127\.0\.0\.1:(\d+)\/admin/); if (m) ok(+m[1]); });
  setTimeout(() => no(new Error('server timeout')), 10000);
});
const BASE = `http://127.0.0.1:${port}/admin/`;

// ---------- รูปทดสอบ 3 รูป (JPEG ที่สร้างเอง ฝัง EXIF พร้อมพิกัด GPS และทิศทาง)
function exifSegment() {
  // TIFF little-endian: IFD0 {Orientation=1, GPSInfo→GPS IFD}, GPS IFD {LatRef, Lat, LonRef, Lon}
  const parts = [];
  const u16 = (n) => [n & 255, (n >> 8) & 255];
  const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
  const header = [0x49, 0x49, 0x2a, 0x00, ...u32(8)];
  // IFD0 ที่ offset 8: 2 entries
  const ifd0 = [...u16(2),
    ...u16(0x0112), ...u16(3), ...u32(1), ...u16(1), 0, 0, // Orientation
    ...u16(0x8825), ...u16(4), ...u32(1), ...u32(8 + 2 + 24 + 4), // GPSInfo pointer
    ...u32(0)];
  const gpsOff = 8 + ifd0.length;
  const gps = [...u16(2),
    ...u16(1), ...u16(2), ...u32(2), 78, 0, 0, 0, // GPSLatitudeRef 'N'
    ...u16(2), ...u16(5), ...u32(3), ...u32(gpsOff + 2 + 24 + 4),
    ...u32(0)];
  const rationals = [13, 0, 0, 0, 1, 0, 0, 0, 45, 0, 0, 0, 1, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 0];
  const tiff = [...header, ...ifd0, ...gps, ...rationals];
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = body.length + 2;
  return Buffer.from([0xff, 0xe1, (len >> 8) & 255, len & 255, ...body]);
}
const MARKER = 'EXIF-GPS-MARKER-xyz';

mkdirSync(join(tmp, '_in'), { recursive: true });
const inputs = [];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + String(e.stack).split(String.fromCharCode(10)).slice(1, 3).join(' ')));
page.on('response', (r) => { if (r.status() === 404 && !/favicon/.test(r.url())) errors.push('404 ' + r.url()); });
page.on('console', (m) => { if (m.type() === 'error' && !/409 \(Conflict\)/.test(m.text())) errors.push('console: ' + m.text()); });

async function makeImage(name, color, w, h2) {
  const b64 = await page.evaluate((c, w, h) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(w / 4, h / 4, w / 2, h / 2);
    return cv.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, color, w, h2);
  const jpg = Buffer.from(b64, 'base64');
  const marker = Buffer.from([0xff, 0xfe, 0x00, MARKER.length + 2, ...Buffer.from(MARKER)]); // COM segment ที่มีข้อความตัวอย่าง
  const withExif = Buffer.concat([jpg.subarray(0, 2), exifSegment(), marker, jpg.subarray(2)]);
  const p = join(tmp, '_in', name);
  writeFileSync(p, withExif);
  inputs.push(p);
  return p;
}

const $ = (sel) => page.$(sel);
const click = async (sel) => { await page.waitForSelector(sel, { timeout: 10000 }); await page.click(sel); };
const typeInto = async (sel, text, clear = true) => {
  await page.waitForSelector(sel, { timeout: 10000 });
  if (clear) { await page.click(sel, { clickCount: 3 }); await page.keyboard.press('Backspace'); }
  await page.type(sel, text);
};
const waitText = (sel, text, timeout = 15000) => page.waitForFunction((s, t) => { const e = document.querySelector(s); return e && e.textContent.includes(t); }, { timeout }, sel, text);
const hashTo = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await sleep(500); };
const valueOf = (sel) => page.$eval(sel, (e) => e.value);
const diskJson = (rel) => JSON.parse(readFileSync(join(tmp, rel), 'utf8'));
const badge = () => page.$eval('.adm-badge', (e) => (e.hidden ? 0 : +e.textContent)).catch(() => 0);

async function login() {
  await page.goto(BASE, { waitUntil: 'load' });
  await click('#adm-use-local');
  await page.waitForSelector('.adm-listpanel > .adm-list a', { timeout: 30000 });
}
async function publish(msgCheck) {
  await hashTo('#/pending');
  await page.waitForSelector('#adm-publish');
  if (msgCheck) check((await valueOf('#adm-commit-msg')).startsWith('admin:'), 'ข้อความ commit อัตโนมัติขึ้นต้นด้วย admin: → ' + (await valueOf('#adm-commit-msg')));
  const before = await page.$eval('#adm-status', (e) => e.dataset.commit).catch(() => '');
  check(!(await page.$eval('#adm-publish', (b) => b.disabled)), 'ปุ่มบันทึกและเผยแพร่กดได้');
  await click('#adm-publish');
  try {
    await page.waitForFunction((b4) => { const s = document.querySelector('#adm-status'); return s && s.dataset.commit !== b4 && /ok|fail/.test(s.className); }, { timeout: 120000 }, before);
  } catch (e) {
    console.log('  ! publish timeout. status=', await page.evaluate(() => (document.querySelector('#adm-status') || {}).textContent), 'toasts=', await page.evaluate(() => [...document.querySelectorAll('.adm-toast')].map((t) => t.textContent)), 'errors=', errors.slice(-3));
    throw e;
  }
  return page.$eval('#adm-status', (e) => ({ ok: e.classList.contains('ok'), text: e.textContent }));
}

try {
  console.log('\n== เข้าสู่ระบบและรายการ');
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#adm-use-local', { timeout: 20000 });
  check(true, 'หน้าเข้าสู่ระบบแสดงตัวเลือก adapter local');
  const meta = await page.$eval('meta[name=robots]', (e) => e.content);
  check(/noindex/.test(meta), 'มี meta noindex');
  await click('#adm-use-local');
  await page.waitForSelector('.adm-listpanel > .adm-list a', { timeout: 30000 });
  const count0 = await page.$$eval('.adm-listpanel > .adm-list a', (a) => a.length);
  check(count0 > 250, `รายการเซลล์ทั้งหมดแสดง (${count0})`);
  const facets = await page.$$eval('.adm-filters select option', (o) => o.map((x) => x.textContent));
  check(facets.some((x) => /\(\d+\)/.test(x)), 'ตัวกรองแสดงจำนวนในแต่ละตัวเลือก: ' + facets.slice(0, 3).join(' | '));
  await typeInto('.adm-filters input[type=search]', 'neutrophil');
  await sleep(300);
  const nOne = await page.$$eval('.adm-listpanel > .adm-list a', (a) => a.length);
  check(nOne >= 1 && nOne < 15, `ค้นหา neutrophil ได้ ${nOne} รายการ`);
  await page.select('.adm-filters select:nth-of-type(3)', 'draft');
  await sleep(200);
  check((await page.$$eval('.adm-listpanel > .adm-list a', (a) => a.length)) === 0, 'กรองระดับ draft ไม่พบ (ข้อมูลจริงเป็น ai_reviewed ทั้งหมด)');
  await page.select('.adm-filters select:nth-of-type(3)', '');
  await page.$eval('.adm-filters input[type=search]', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });

  console.log('\n== แก้เซลล์และตัวอย่าง');
  await hashTo('#/edit/CL_0000775');
  await page.waitForSelector('[data-field="function"] textarea', { timeout: 15000 });
  await page.waitForSelector('#adm-preview .cell-page', { timeout: 15000 });
  check(true, 'หน้าแก้ไขแสดงฟอร์มและตัวอย่างการ์ด');
  check(await page.$eval('#adm-save-cell', (b) => b.disabled), 'ยังไม่แก้อะไร ปุ่มเก็บกดไม่ได้');
  await typeInto('[data-field="function"] textarea', ' (แก้ทดสอบ)', false);
  await sleep(700);
  check(await page.$eval('#adm-preview', (e) => e.textContent.includes('(แก้ทดสอบ)')), 'ตัวอย่างอัปเดตตามที่พิมพ์');
  // กรณีผิด: แท็ก HTML
  await typeInto('[data-field="function"] textarea', ' <script>alert(1)</script>', false);
  await sleep(500);
  check(await page.$eval('#adm-save-cell', (b) => b.disabled), 'ข้อความมี <script> → เก็บไม่ได้');
  check(await page.$eval('[data-field="function"]', (e) => e.classList.contains('has-error') && e.textContent.includes(String.fromCharCode(0x0e2b))), 'แสดงข้อผิดพลาดที่ช่องนั้น');
  await page.$eval('[data-field="function"] textarea', (e) => { e.value = e.value.replace(' <script>alert(1)</script>', ''); e.dispatchEvent(new Event('input')); });
  await sleep(500);
  check(!(await page.$eval('#adm-save-cell', (b) => b.disabled)), 'ลบแท็กออกแล้วเก็บได้');
  await click('#adm-save-cell');
  await sleep(600);
  check((await badge()) === 1, 'เก็บแล้วรอบบันทึกมี 1 รายการ');

  console.log('\n== เส้นใย');
  await click('[data-tab="edges"]');
  await page.waitForSelector('#adm-add-edge');
  // cycle is_a: neutrophil is_a ? ลองให้ "granulocyte is_a neutrophil" ถ้ามี is_a neutrophil→granulocyte
  const rel = await page.evaluate(() => { const c = document.querySelector('.adm-edges'); return c ? c.textContent : ''; });
  check(rel.length > 10, 'แท็บความเชื่อมโยงแสดงเส้นของเซลล์');
  await page.select('.adm-edges select[aria-label]', 'int_out');
  await typeInto('.adm-edges .adm-picker input', 'monocyte');
  await sleep(300);
  await click('.adm-edges .adm-results button');
  await typeInto('.adm-edges [data-field="desc"] input', 'ทดสอบเส้น');
  await sleep(200);
  check(!(await page.$eval('#adm-add-edge', (b) => b.disabled)), 'เลือกเซลล์ปลายทางแล้วปุ่มเพิ่มเส้นกดได้');
  await click('#adm-add-edge');
  await sleep(600);
  check((await badge()) === 2, 'เพิ่มเส้นแล้วรอบบันทึกเป็น 2 รายการ');
  // ป้องกันเส้นชี้หาตัวเอง: picker ไม่แสดงตัวเอง
  await typeInto('.adm-edges .adm-picker input', 'neutrophil');
  await sleep(300);
  const self = await page.$$eval('.adm-edges .adm-results button', (b) => b.map((x) => x.textContent));
  check(!self.some((t) => t.includes('CL:0000775')), 'ค้นหาปลายทางไม่แสดงตัวเอง');
  // is_a วน: หาคู่ is_a ของเซลล์นี้ แล้วลองเพิ่มกลับด้าน
  const cyc = await page.evaluate(() => {
    const m = document.querySelectorAll('.adm-edges h3');
    return [...m].map((x) => x.textContent);
  });
  void cyc;

  console.log('\n== เพิ่มรูป 3 รูป (มี EXIF GPS ติดมา)');
  await click('[data-tab="images"]');
  await page.waitForSelector('#adm-file', { hidden: true });
  const img1 = await makeImage('a.jpg', '#c2185b', 2400, 1600);
  const img2 = await makeImage('b.jpg', '#1976d2', 800, 600);
  const img3 = await makeImage('c.jpg', '#388e3c', 1000, 700);
  const fileInput = await page.$('#adm-file');
  await fileInput.uploadFile(img1, img2, img3);
  await page.waitForFunction(() => document.querySelectorAll('.adm-images .adm-img-form').length === 3 && !document.querySelector('.adm-images .adm-img-form .adm-muted'), { timeout: 30000 });
  const sizesText = await page.$$eval('.adm-images .adm-img-form .adm-hint', (e) => e.map((x) => x.textContent).join(' | '));
  check(/1600/.test(sizesText), 'รูปกว้างเกิน 1600 ถูกย่อเหลือ 1600 px: ' + sizesText.slice(0, 120));
  // กรอกฟอร์มทีละรูป
  for (let i = 0; i < 3; i++) {
    const form = (await page.$$('.adm-images .adm-img-form'))[0];
    await form.$eval('[data-field="alt_th"] input', (e) => { e.focus(); });
    await page.keyboard.type('รูปทดสอบ ' + (i + 1));
    if (i === 1) {
      // รูปที่สองมาจากแหล่งอื่น: ต้องมี source ปุ่มเพิ่มต้องกดไม่ได้จนกว่าจะกรอก
      await form.$eval('[data-field="license"] select', (e) => { e.value = 'CC BY-SA 4.0'; e.dispatchEvent(new Event('change')); });
      await sleep(200);
      const disabledNoSource = await form.$eval('button.adm-btn-primary', (b) => b.disabled);
      check(disabledNoSource, 'รูปจากแหล่งอื่นที่ไม่มี source → ปุ่มเพิ่มกดไม่ได้');
      await form.$eval('[data-field="credit"] input', (e) => { e.focus(); e.select(); });
      await page.keyboard.type('ช่างภาพทดสอบ');
      await form.$eval('[data-field="source"] input', (e) => { e.focus(); });
      await page.keyboard.type('http://example.org/x');
      await sleep(200);
      check(await form.$eval('button.adm-btn-primary', (b) => b.disabled), 'source ที่ไม่ใช่ https → ปุ่มเพิ่มกดไม่ได้');
      await form.$eval('[data-field="source"] input', (e) => { e.select(); });
      await page.keyboard.type('https://example.org/x');
    }
    await sleep(200);
    await form.$eval('button.adm-btn-primary', (b) => b.click());
    await sleep(500);
  }
  const nImgs = await page.$$eval('.adm-sortable .adm-img-item', (e) => e.length);
  check(nImgs === 3, `เพิ่มครบ 3 รูป (${nImgs})`);
  const paths = await page.$$eval('.adm-sortable .adm-img-item .mono', (e) => e.map((x) => x.textContent));
  check(paths.every((p) => /^images\/neutrophil\/micrograph-\d\.webp$/.test(p)) && new Set(paths).size === 3, 'ชื่อไฟล์ตั้งจาก type และลำดับ ไม่ซ้ำ: ' + paths.join(', '));
  // เรียงลำดับ: ย้ายรูปที่ 3 ขึ้นบน
  await page.$$eval('.adm-sortable .adm-img-item', (e) => e[2].querySelector('.adm-img-actions button[aria-label]').click());
  await sleep(300);
  const order = await page.$$eval('.adm-sortable .adm-img-item .mono', (e) => e.map((x) => x.textContent));
  check(order[1] === paths[2], 'ปุ่มเลื่อนขึ้นเรียงลำดับรูปได้');
  await click('#adm-save-cell');
  await sleep(700);
  check((await badge()) === 2, 'เก็บรูปเข้ารอบบันทึก (เซลล์เดียวกัน นับ 1 + เส้น 1)');

  console.log('\n== เผยแพร่ (local: validate + build)');
  const r1 = await publish(true);
  check(r1.ok, 'commit แล้ว validate + build ผ่าน');
  const imgDir = join(tmp, 'site', 'images', 'neutrophil');
  const files = existsSync(imgDir) ? readdirSync(imgDir) : [];
  check(files.length === 3, `ไฟล์รูปถูกเขียน 3 ไฟล์: ${files.join(', ')}`);
  let leaked = false, riff = true;
  for (const f of files) {
    const b = readFileSync(join(imgDir, f));
    const s = b.toString('latin1');
    if (s.includes('Exif') || s.includes('GPS') || s.includes(MARKER) || s.includes('EXIF')) leaked = true;
    if (!(b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP')) riff = false;
  }
  check(!leaked, 'รูปที่บันทึกไม่มี EXIF/GPS/ข้อความที่ฝังไว้');
  check(riff, 'รูปถูกแปลงเป็น WebP จริง');
  const cells = diskJson('data/cells/blood-immune.json');
  const nph = cells.find((c) => c.id === 'CL:0000775');
  check(nph.images.length === 3 && nph.images[0].license, 'ข้อมูลรูปถูกบันทึกในไฟล์เซลล์');
  const edgesFile = diskJson('data/edges/blood-immune.json');
  check(edgesFile.interacts_with.some((e) => e.from === 'CL:0000775' && e.th === 'ทดสอบเส้น'), 'เส้นใหม่ถูกบันทึกในไฟล์ edges ของระบบหลัก');
  check((await badge()) === 0, 'หลังเผยแพร่รอบบันทึกว่าง');

  console.log('\n== เพิ่มเซลล์ใหม่');
  await hashTo('#/new');
  await page.waitForSelector('#adm-preview', { timeout: 10000 });
  await typeInto('[data-field="id"] input', 'CL:0009999');
  await typeInto('[data-field="en"] input', 'test cell');
  await typeInto('[data-field="th"] input', 'เซลล์ทดสอบ');
  await sleep(500);
  check((await valueOf('[data-field="slug"] input')) === 'test-cell', 'slug สร้างจากชื่ออังกฤษอัตโนมัติ');
  check(await page.$eval('#adm-save-cell', (b) => b.disabled), 'ยังไม่เลือกระบบ → เก็บไม่ได้');
  await page.select('.adm-sortable + select, [data-field="systems"] select', 'endocrine');
  await sleep(400);
  check(!(await page.$eval('#adm-save-cell', (b) => b.disabled)), 'เลือกระบบแล้วเก็บได้');
  await click('#adm-save-cell');
  await sleep(800);
  check(location_ok(await page.evaluate(() => location.hash)), 'เก็บแล้วไปหน้าแก้ไขของเซลล์ใหม่');
  const r2 = await publish(false);
  check(r2.ok, 'เพิ่มเซลล์ใหม่แล้ว validate + build ผ่าน');
  check(diskJson('data/cells/endocrine.json').some((c) => c.id === 'CL:0009999'), 'เซลล์ใหม่อยู่ในไฟล์ของระบบหลัก (endocrine)');

  console.log('\n== ลบเซลล์ (cascade + พิมพ์ยืนยัน)');
  await hashTo('#/edit/CL_0009999');
  await page.waitForSelector('#adm-delete-cell', { visible: true });
  // เพิ่มเส้นให้ก่อนเพื่อเห็น cascade
  await click('[data-tab="edges"]');
  await page.select('.adm-edges select[aria-label]', 'int_out');
  await typeInto('.adm-edges .adm-picker input', 'neutrophil');
  await sleep(300);
  await click('.adm-edges .adm-results button');
  await typeInto('.adm-edges [data-field="desc"] input', 'ลบทดสอบ');
  await click('#adm-add-edge');
  await sleep(500);
  await click('#adm-delete-cell');
  await page.waitForSelector('dialog[open]');
  const dlgText = await page.$eval('dialog[open]', (d) => d.textContent);
  check(/CL:0009999/.test(dlgText), 'กล่องลบแสดงเส้นที่จะถูกลบตาม');
  check(await page.$eval('dialog[open] .adm-btn-danger[data-value="true"]', (b) => b.disabled), 'ยังไม่พิมพ์รหัส → ปุ่มลบกดไม่ได้');
  await page.type('dialog[open] input', 'CL:0009999');
  await page.$eval('dialog[open] .adm-btn-danger[data-value="true"]', (b) => b.click());
  await sleep(800);
  const r3 = await publish(false);
  check(r3.ok, 'ลบเซลล์แล้ว validate + build ผ่าน');
  check(!diskJson('data/cells/endocrine.json').some((c) => c.id === 'CL:0009999') && !diskJson('data/edges/endocrine.json').interacts_with.concat(diskJson('data/edges/blood-immune.json').interacts_with).some((e) => e.from === 'CL:0009999' || e.to === 'CL:0009999'), 'เซลล์และเส้นที่อ้างถึงหายจากไฟล์');

  console.log('\n== ลบรูป (ลบทั้งข้อมูลและไฟล์)');
  await hashTo('#/edit/CL_0000775');
  await page.waitForSelector('[data-tab="images"]');
  await click('[data-tab="images"]');
  await page.waitForSelector('.adm-sortable .adm-img-item');
  await page.$$eval('.adm-sortable .adm-img-item', (e) => e[0].querySelector('.adm-btn-danger').click());
  await sleep(300);
  await click('#adm-save-cell');
  await sleep(600);
  const r4 = await publish(false);
  check(r4.ok && readdirSync(imgDir).length === 2, 'ลบรูปแล้วไฟล์ถูกลบด้วย (เหลือ 2)');

  console.log('\n== กรณีผิด');
  await hashTo('#/edit/CL_0000775');
  await page.waitForSelector('[data-tab="images"]');
  await click('[data-tab="images"]');
  await click('.adm-drop .adm-btn:not(.adm-btn-primary)');
  const linkForm = (await page.$$('.adm-images .adm-img-form'))[0];
  await linkForm.$eval('[data-field="src"] input', (e) => e.focus());
  await page.keyboard.type('http://example.org/a.jpg');
  await linkForm.$eval('[data-field="alt_th"] input', (e) => e.focus());
  await page.keyboard.type('ลิงก์');
  await linkForm.$eval('[data-field="license"] select', (e) => { e.value = 'CC0'; e.dispatchEvent(new Event('change')); });
  await linkForm.$eval('[data-field="credit"] input', (e) => { e.select(); });
  await page.keyboard.type('x');
  await sleep(200);
  check(await linkForm.$eval('button.adm-btn-primary', (b) => b.disabled), 'ลิงก์รูป http:// → เพิ่มไม่ได้');
  await linkForm.$eval('[data-field="src"] input', (e) => { e.select(); });
  await page.keyboard.type('https://example.org/a.jpg');
  await sleep(200);
  check(await linkForm.$eval('button.adm-btn-primary', (b) => b.disabled), 'ลิงก์รูปที่ไม่มี source → เพิ่มไม่ได้');
  await linkForm.$eval('[data-field="source"] input', (e) => e.focus());
  await page.keyboard.type('https://example.org/page');
  await sleep(200);
  check(!(await linkForm.$eval('button.adm-btn-primary', (b) => b.disabled)), 'ลิงก์ https + source https → เพิ่มได้');
  await linkForm.$eval('button.adm-btn-primary', (b) => b.click());
  await sleep(400);
  // is_a วนกลับ ผ่านหน้าเส้น: หาคู่ is_a จากข้อมูล แล้วลองเพิ่มกลับด้าน
  const pair = diskJson('data/edges/blood-immune.json').is_a[0];
  await click('#adm-save-cell');
  await sleep(500);
  await hashTo('#/edit/' + pair[1].replace(':', '_'));
  await page.waitForSelector('[data-tab="edges"]');
  await click('[data-tab="edges"]');
  await page.select('.adm-edges select[aria-label]', 'isa');
  await typeInto('.adm-edges .adm-picker input', pair[0]);
  await sleep(300);
  await click('.adm-edges .adm-results button');
  await sleep(300);
  check(await page.$eval('#adm-add-edge', (b) => b.disabled), 'เพิ่ม is_a ที่ทำให้วนกลับไม่ได้ (ปุ่มกดไม่ได้)');
  check(await page.$eval('.adm-edges', (e) => e.textContent.includes(String.fromCharCode(0x0e27))), 'แสดงเหตุผลที่เพิ่มเส้นไม่ได้');
  await hashTo('#/pending');
  await sleep(500);
  const pendingTitle = await page.$eval('.adm-page h1', (e) => e.textContent);
  check(pendingTitle === T('pend.title'), 'หน้ารอบบันทึกเปิดได้');
  await page.$$eval('[data-cancel]', (b) => b.forEach((x) => x.click()));
  await sleep(500);
  check((await badge()) === 0, 'ยกเลิกทุกรายการแล้วรอบบันทึกว่าง');

  console.log('\n== โหมดตรวจกับตำรา');
  await hashTo('#/review');
  await page.waitForSelector('#adm-ref', { timeout: 10000 });
  check(await page.$eval('#adm-review-ok', (b) => b.disabled), 'ไม่มี ref → ปุ่มยืนยันกดไม่ได้');
  await typeInto('#adm-ref', 'Junqueira 15 ตอนที่ 10');
  check(!(await page.$eval('#adm-review-ok', (b) => b.disabled)), 'ใส่ ref แล้วยืนยันได้');
  const first = await page.$eval('.adm-review h2', (e) => e.textContent);
  await click('#adm-review-ok');
  await sleep(600);
  check((await badge()) === 1, 'ยืนยันแล้วรอบบันทึกมี 1 รายการ');
  check((await valueOf('#adm-ref')) === 'Junqueira 15 ตอนที่ 10', 'ช่อง ref จำค่าล่าสุดไว้ให้เซลล์ถัดไป');
  const second = await page.$eval('.adm-review h2', (e) => e.textContent);
  check(first !== second, 'เปลี่ยนไปเซลล์ถัดไป');
  const r5 = await publish(false);
  check(r5.ok, 'ตั้ง textbook แล้ว validate + build ผ่าน');
  const tb = Object.values(['blood-immune', 'cardiovascular', 'digestive', 'endocrine', 'integumentary', 'muscular', 'nervous', 'reproductive', 'respiratory', 'skeletal', 'urinary'])
    .flatMap((f) => diskJson(`data/cells/${f}.json`)).filter((c) => c.review === 'textbook');
  check(tb.length === 1 && tb[0].refs.includes('Junqueira 15 ตอนที่ 10') && !tb[0].refs.some((r) => r.startsWith(th['const.aiRefPrefix'])), 'เซลล์เป็น textbook มี ref ที่กรอก และหมายเหตุ AI ถูกถอด');

  console.log('\n== การป้องกันการเขียนทับ');
  await hashTo('#/edit/CL_0000037');
  await page.waitForSelector('[data-field="function"] textarea');
  await typeInto('[data-field="function"] textarea', ' (ของฉัน)', false);
  await sleep(300);
  await click('#adm-save-cell');
  await sleep(600);
  // มีคนแก้ไฟล์ใน repo ระหว่างนั้น (แก้เซลล์เดียวกันและไฟล์เดียวกัน)
  const f = join(tmp, 'data/cells/blood-immune.json');
  const cur = JSON.parse(readFileSync(f, 'utf8'));
  cur.find((c) => c.id === 'CL:0000037').function += ' (ของอีกคน)';
  writeFileSync(f, JSON.stringify(cur, null, 2) + '\n');
  await hashTo('#/pending');
  await page.waitForSelector('#adm-publish');
  await click('#adm-publish');
  await page.waitForSelector('#adm-conflict', { timeout: 20000 });
  check(true, 'ไฟล์เปลี่ยนหลังโหลด → หยุดและแสดงว่าไฟล์ไหนชน');
  check((await page.$eval('#adm-conflict', (e) => e.textContent)).includes('data/cells/blood-immune.json'), 'แสดงชื่อไฟล์ที่ชน');
  check(!(readFileSync(f, 'utf8').includes('(ของฉัน)')), 'ไม่มีการเขียนทับเงียบ ๆ');
  await click('#adm-reload');
  await page.waitForSelector('[data-key="cell:CL:0000037"] .adm-status.fail', { timeout: 20000 });
  check(true, 'โหลดใหม่แล้วรายการที่ชนถูกทำเครื่องหมายให้เลือก');
  await page.$eval('[data-key="cell:CL:0000037"] .adm-status button', (b) => b.click()); // ใช้ของฉัน
  await sleep(500);
  const r6 = await publish(false);
  check(r6.ok && JSON.parse(readFileSync(f, 'utf8')).find((c) => c.id === 'CL:0000037').function.endsWith('(ของฉัน)'), 'เลือก "ใช้ของฉัน" แล้ว commit ผ่าน');

  console.log('\n== จอมือถือ 380px');
  await page.setViewport({ width: 380, height: 800, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#adm-use-local');
  await click('#adm-use-local');
  await page.waitForSelector('.adm-listpanel > .adm-list a');
  const ov = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!ov, 'หน้ารายการไม่เลื่อนซ้ายขวา');
  const small = await page.$$eval('.adm-top a, .adm-top button, .adm-filters select, .adm-filters input[type=search], #adm-new', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height < 43.5; }).map((e) => e.textContent.slice(0, 20)));
  check(small.length === 0, 'ปุ่ม/ช่องหลักสูง ≥ 44px' + (small.length ? ': ' + small.join(',') : ''));
  await page.$eval('.adm-listpanel > .adm-list a', (a) => a.click());
  await page.waitForSelector('[data-field="function"] textarea');
  await sleep(500);
  const ov2 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!ov2, 'หน้าแก้ไขไม่เลื่อนซ้ายขวา');
  await click('[data-tab="images"]');
  await sleep(300);
  const ov3 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!ov3, 'แท็บรูปไม่เลื่อนซ้ายขวา');
  const btnSmall = await page.$$eval('.adm-images .adm-btn:not(.adm-btn-small), .adm-actions .adm-btn', (els) => els.filter((e) => e.getBoundingClientRect().height < 43.5 && e.getBoundingClientRect().height > 0).length);
  check(btnSmall === 0, 'ปุ่มอัปโหลดและปุ่มบันทึกสูง ≥ 44px');
  await hashTo('#/review');
  await page.waitForSelector('#adm-ref');
  const ov4 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!ov4, 'โหมดตรวจไม่เลื่อนซ้ายขวา');
  await page.setViewport({ width: 1280, height: 900 });

  console.log('\n== ธีมมืด');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#adm-use-local');
  await click('#adm-use-local');
  await page.waitForSelector('.adm-listpanel > .adm-list a');
  await hashTo('#/edit/CL_0000775');
  await page.waitForSelector('#adm-preview .cell-page', { timeout: 15000 });
  check(true, 'ธีมมืด: หน้าแก้ไขและตัวอย่างแสดงผล');
} finally {
  await browser.close();
  srv.kill();
  await sleep(300);
  rmSync(tmp, { recursive: true, force: true });
}

function location_ok(hash) { return /^#\/edit\/CL_0009999$/.test(hash); }
check(errors.length === 0, 'ไม่มี error ใน console' + (errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''));
console.log(failures ? `\nล้มเหลว ${failures} ข้อ` : '\nOK');
process.exit(failures ? 1 : 0);

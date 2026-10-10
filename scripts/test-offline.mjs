// ทดสอบการใช้งานออฟไลน์ (service worker) ด้วย Chrome/Edge จริงแบบ headless
//   1. เปิดเว็บหนึ่งครั้ง (ออนไลน์) ให้ service worker เก็บไฟล์
//   2. ปิดเซิร์ฟเวอร์ (ไม่มีเครือข่ายเลย) แล้วโหลดใหม่ เปิดทุกหน้า สลับภาษา ทำโหมดทดสอบ
//   3. เปิดเซิร์ฟเวอร์กลับด้วยเวอร์ชันข้อมูลใหม่ ต้องมีแถบ "มีข้อมูลใหม่" และกดอัปเดตได้
// ต้องมี Chrome หรือ Edge (ตั้งค่า CHROME_PATH ถ้าอยู่ที่อื่น) และต่ออินเทอร์เน็ตตอนเปิดครั้งแรก (โหลดไลบรารีจาก CDN)
// รัน: node scripts/test-offline.mjs

import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const site = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));
if (!CHROME) { console.log('ไม่พบ Chrome/Edge (ตั้งค่า CHROME_PATH)'); process.exit(2); }

let fakeVersion = null;
const sockets = new Set();
function makeServer() {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    if (rel === 'data/version.json' && fakeVersion) {
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
      res.end(JSON.stringify({ version: fakeVersion }));
      return;
    }
    const file = normalize(join(site, rel));
    if (!file.startsWith(site) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  srv.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return srv;
}
const listen = (srv, port) => new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok(srv.address().port)));
const stop = (srv) => new Promise((ok) => { sockets.forEach((s) => s.destroy()); srv.close(() => ok()); });

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };

const ROUTES = ['#/', '#/overview/system', '#/overview/tissue', '#/quiz', '#/compare', '#/compare/CL_0000767/CL_0000097', ...(existsSync(join(site, 'js', 'about.js')) ? ['#/about'] : []),
  '#/system/blood-immune', '#/system/digestive', '#/tissue/connective', '#/cell/CL_0000091', '#/cell/CL_0000775'];

let srv = makeServer();
const port = await listen(srv, 0);
const base = `http://127.0.0.1:${port}/`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  console.log('1) ออนไลน์: เปิดเว็บและให้ service worker เก็บไฟล์');
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 20000 }).catch(async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 20000 });
  });
  check(true, 'service worker ควบคุมหน้านี้แล้ว');
  const count = await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).length);
  check(count >= 35, `ที่เก็บมี ${count} รายการ (ไฟล์เว็บ ข้อมูล และไลบรารีจาก CDN)`);
  const cdn = await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).filter((r) => r.url.includes('cdn.jsdelivr.net')).length);
  check(cdn >= 4, `เก็บไลบรารี CDN ไว้ ${cdn} ไฟล์`);
  // เปิดทุกหน้าออนไลน์หนึ่งรอบ เพื่อให้ฟอนต์และไฟล์ที่เรียกภายหลังถูกเก็บ
  for (const r of ROUTES) { await page.evaluate((h) => { location.hash = h; }, r); await new Promise((ok) => setTimeout(ok, 700)); }

  console.log('2) ออฟไลน์: ปิดเซิร์ฟเวอร์แล้วโหลดใหม่');
  await stop(srv);
  errors.length = 0;
  await page.goto(base + '?offline=1', { waitUntil: 'load' }).catch((e) => errors.push('goto: ' + e.message));
  await page.waitForSelector('#page-title', { timeout: 20000 });
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await new Promise((ok) => setTimeout(ok, 900));
    const info = await page.evaluate(() => ({ h1: (document.querySelector('#page-title') || document.querySelector('h1') || {}).textContent, nf: !!document.querySelector('.notfound'), len: document.getElementById('app').textContent.trim().length }));
    check(info.h1 && !info.nf && info.len > 40, `${r} → "${(info.h1 || '').slice(0, 40)}"`);
    // ถ้าหน้านี้มีแกลเลอรี รูปหลักที่เคยเปิดออนไลน์ต้องโหลดได้จากที่เก็บ (รวมโครงสร้างโฟลเดอร์ images/<slug>/)
    const galleryImg = await page.evaluate(() => { const i = document.querySelector('.gallery .gal-frame img'); return i ? i.complete && i.naturalWidth > 0 : null; });
    if (galleryImg !== null) check(galleryImg, `${r} รูปในแกลเลอรีโหลดจากที่เก็บได้ตอนออฟไลน์`);
  }
  // สลับภาษาออฟไลน์
  await page.evaluate(() => document.querySelector('[data-lang-btn="en"]').click());
  await new Promise((ok) => setTimeout(ok, 500));
  check((await page.evaluate(() => document.documentElement.lang)) === 'en', 'สลับเป็นอังกฤษได้ตอนออฟไลน์');
  await page.evaluate(() => { location.hash = '#/quiz'; });
  await new Promise((ok) => setTimeout(ok, 800));
  check(await page.evaluate(() => !!document.querySelector('.quiz-setup button[type=submit]')), 'โหมดทดสอบเปิดได้ตอนออฟไลน์');
  const cyOk = await page.evaluate(async () => { location.hash = '#/overview/system'; await new Promise((r) => setTimeout(r, 1500)); const el = document.querySelector('.overview-wrap .cy'); return !!(el && el.__cy && el.__cy.nodes().length > 50); });
  check(cyOk, 'ใยภาพรวมวาดได้ตอนออฟไลน์ (ใช้ layout-overview.json จากที่เก็บ)');
  const offErrors = errors.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(e));
  check(offErrors.length === 0, 'ไม่มี error ของแอปตอนออฟไลน์' + (offErrors.length ? ': ' + offErrors.slice(0, 3).join(' | ') : ''));

  console.log('3) ข้อมูลเวอร์ชันใหม่: ต้องมีแถบอัปเดต');
  fakeVersion = 'test-new-version';
  srv = makeServer();
  await new Promise((ok, fail) => srv.listen(port, '127.0.0.1', ok).on('error', fail));
  await page.goto(base + '?online=1', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.update-banner', { timeout: 15000 }).catch(() => {});
  check(await page.evaluate(() => !!document.querySelector('.update-banner')), 'แถบ "มีข้อมูลใหม่" ปรากฏเมื่อ version.json เปลี่ยน');
  fakeVersion = null; // หลังกดอัปเดต ให้ได้ version.json จริงกลับมา
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {}),
    page.evaluate(() => document.querySelector('.update-banner button').click()),
  ]);
  const cachedVersion = await page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); const r = await c.match('data/version.json'); return r ? (await r.json()).version : null; });
  const realVersion = JSON.parse(readFileSync(join(site, 'data', 'version.json'), 'utf8')).version;
  check(cachedVersion === realVersion, `หลังกดอัปเดต ที่เก็บได้เวอร์ชันข้อมูลจริง (${cachedVersion})`);
  check(await page.evaluate(() => !document.querySelector('.update-banner')), 'แถบหายไปหลังอัปเดต');
} catch (e) {
  console.log('  ✗ ข้อผิดพลาดระหว่างทดสอบ: ' + e.message);
  failures++;
} finally {
  await browser.close();
  await stop(srv).catch(() => {});
}
console.log(failures ? `\nFAILED (${failures})` : '\nOK');
process.exit(failures ? 1 : 0);

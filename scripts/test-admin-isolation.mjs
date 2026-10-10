// ตรวจว่าหน้าแอดมินแยกจากเว็บหลัก: เว็บหลักไม่มีลิงก์ไปหน้าแอดมิน, precache ไม่มี admin/, และ service worker ไม่ cache หน้าแอดมิน
// รัน: node scripts/test-admin-isolation.mjs   (ต้อง build ก่อน และต่ออินเทอร์เน็ตเพื่อโหลดไลบรารีจาก CDN)
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const site = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
let failures = 0;
const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures++; };

// 1) ไม่มีลิงก์/ข้อความอ้างถึงหน้าแอดมินในไฟล์ของเว็บหลัก
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === 'admin' || n === 'images' ? [] : walk(p)) : [p]; });
const hits = walk(site).filter((p) => /\.(html|js|css|json|webmanifest)$/.test(p) && !/data[\/]|precache|sw\.js$/.test(p)) // sw.js กล่าวถึง admin/ เพื่อข้ามหน้านี้ ไม่ใช่ลิงก์
  .filter((p) => /admin/i.test(readFileSync(p, 'utf8'))).map((p) => p.replace(site, ''));
check(hits.length === 0, 'เว็บหลักไม่มีคำว่า admin ในโค้ด/หน้า (ไม่มีลิงก์ไปแอดมิน)' + (hits.length ? ': ' + hits.join(', ') : ''));

// 2) precache ไม่มี admin/
const pre = existsSync(join(site, 'precache.json')) ? JSON.parse(readFileSync(join(site, 'precache.json'), 'utf8')) : [];
check(pre.length > 0 && !pre.some((p) => p.startsWith('admin')), `precache.json (${pre.length} ไฟล์) ไม่มีไฟล์ใน admin/`);

// 3) service worker ไม่ cache หน้าแอดมิน
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  let file = normalize(join(site, rel));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(site) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/`;
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return r && r.active; }, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 4000));
  await page.goto(base + 'admin/', { waitUntil: 'load' });
  await page.waitForSelector('#adm-root h1, #adm-root form', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1500));
  const keys = await page.evaluate(async () => { const out = []; for (const n of await caches.keys()) { const c = await caches.open(n); out.push(...(await c.keys()).map((r) => r.url)); } return out; });
  check(keys.length > 10, `service worker ทำงานและมีไฟล์ใน cache ${keys.length} รายการ`);
  check(!keys.some((u) => /\/admin\//.test(u)), 'ไม่มีไฟล์ใด ๆ ของ admin/ อยู่ใน cache ของ service worker');
} finally { await browser.close(); srv.close(); }
console.log(failures ? `\nล้มเหลว ${failures} ข้อ` : '\nOK');
process.exit(failures ? 1 : 0);

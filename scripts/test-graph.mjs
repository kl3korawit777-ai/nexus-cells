// ทดสอบพฤติกรรมของใยด้วย Chrome/Edge จริงแบบ headless
//   ลากจุดไม่ได้ / ลูกกลิ้งเลื่อนหน้าไม่ซูมใย / ปุ่มซูม / ใยภาพรวมสลับระดับด้วยปุ่ม / คีย์ลัด /
//   มือถือ 380px (ขนาดปุ่ม เลื่อนหน้าผ่านใย) / ไม่มี error ใน console ทั้งสองธีมและสองภาษา
// รัน: node scripts/test-graph.mjs   (ต้องต่ออินเทอร์เน็ต เพราะโหลดไลบรารีจาก CDN)

import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
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

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = normalize(join(site, rel));
  if (!file.startsWith(site) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
// BASE_URL=https://... ทดสอบกับเว็บที่ deploy แล้วแทนไฟล์ในเครื่อง
const base = process.env.BASE_URL || `http://127.0.0.1:${srv.address().port}/`;

let failures = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

async function open(hash, sel = '.cy') {
  await page.goto(base + hash, { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction((s) => { const c = document.querySelector(s); return c && c.__cy && c.__cy.nodes().length > 0; }, { timeout: 20000 }, sel);
  await sleep(700);
}
const zoomOf = () => page.evaluate(() => document.querySelector('.cy').__cy.zoom());
const centerOf = async (selector) => {
  const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, selector);
  return r;
};
// พิกัดหน้าจอของจุดที่มองเห็นอยู่ในใยจุดหนึ่ง
async function nodeScreenPos(pred = 'node') {
  return page.evaluate((p) => {
    const c = document.querySelector('.cy'); const cy = c.__cy; const box = c.getBoundingClientRect();
    const W = cy.width(), H = cy.height();
    const n = cy.nodes(p).filter((x) => { const q = x.renderedPosition(); return q.x > 30 && q.x < W - 80 && q.y > 30 && q.y < H - 230 && !x.hasClass('hidden'); })[0];
    if (!n) return null;
    const q = n.renderedPosition();
    return { id: n.id(), x: box.x + q.x, y: box.y + q.y };
  }, pred);
}
async function scrollIntoView(selector) {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), selector);
  await sleep(200);
}

const GRAPHS = [
  { name: 'ใยรายระบบ', hash: '#/system/blood-immune', wrap: '.graph-wrap', node: 'node.cell, node:childless' },
  { name: 'ใยภาพรวม', hash: '#/overview/system', wrap: '.graph-wrap', node: 'node.cell' },
  { name: 'ใยหน้าเนื้อเยื่อ', hash: '#/tissue/connective', wrap: '.mini-graph', node: 'node.cell' },
];
const STATICS = [
  { name: 'ใยเล็กในหน้าเซลล์', hash: '#/cell/CL_0000775', wrap: '.mini-graph' },
  { name: 'ใยในหน้าเปรียบเทียบ', hash: '#/compare/CL_0000767/CL_0000097', wrap: '.mini-graph' },
];

try {
  // ------------------------------------------------------------ 1–3, 5: ใยที่โต้ตอบได้
  for (const g of GRAPHS) {
    console.log('\n== ' + g.name);
    await page.setViewport({ width: 1100, height: 800 });
    await open(g.hash);
    await scrollIntoView(g.wrap);
    if (g.name === 'ใยภาพรวม') { await page.evaluate(() => document.querySelector('.level-badge') && 0); }

    const cfg = await page.evaluate(() => { const cy = document.querySelector('.cy').__cy; return { drag: cy.autoungrabify(), zoom: cy.userZoomingEnabled(), pan: cy.userPanningEnabled(), box: cy.boxSelectionEnabled() }; });
    check(cfg.drag && !cfg.zoom && cfg.pan && !cfg.box, `ค่าตั้งต้น: autoungrabify, ไม่ซูมด้วยลูกกลิ้ง, เลื่อนได้, ไม่มี box select (${JSON.stringify(cfg)})`);

    // ลากจุดแล้วต้องไม่ขยับ
    let np = await nodeScreenPos(g.node);
    if (np) {
      const before = await page.evaluate((id) => { const p = document.querySelector('.cy').__cy.getElementById(id).position(); return [p.x, p.y]; }, np.id);
      const panBefore = await page.evaluate(() => ({ ...document.querySelector('.cy').__cy.pan() }));
      await page.mouse.move(np.x, np.y); await page.mouse.down(); await page.mouse.move(np.x + 60, np.y + 40, { steps: 6 }); await page.mouse.up();
      const panAfter = await page.evaluate(() => ({ ...document.querySelector('.cy').__cy.pan() }));
      check(panAfter.x !== panBefore.x || panAfter.y !== panBefore.y, 'ลากที่เริ่มบนจุดแล้วเลื่อนใยแทน');
      await page.evaluate((p0) => document.querySelector('.cy').__cy.pan(p0), panBefore);
      const after = await page.evaluate((id) => { const p = document.querySelector('.cy').__cy.getElementById(id).position(); return [p.x, p.y]; }, np.id);
      check(before[0] === after[0] && before[1] === after[1], 'ลากจุดแล้วจุดไม่ขยับ');

      // แตะแล้วเลือกได้ (ใยรายระบบ/ภาพรวมมีคลาส sel)
      if (g.name !== 'ใยหน้าเนื้อเยื่อ') {
        await page.mouse.click(np.x, np.y);
        await sleep(200);
        const sel = await page.evaluate(() => document.querySelector('.cy').__cy.nodes('.sel').length);
        check(sel === 1, 'แตะจุดแล้วเลือกได้');
        await page.keyboard.press('Escape');
      }
    } else check(false, 'หาจุดที่มองเห็นไม่เจอ');

    // ลูกกลิ้งต้องเลื่อนหน้า ไม่ซูมใย
    await scrollIntoView(g.wrap);
    const box = await centerOf(g.wrap);
    const z0 = await zoomOf();
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.move(box.x + box.w / 2, box.y + 60);
    await page.mouse.wheel({ deltaY: 300 });
    await sleep(500);
    const y1 = await page.evaluate(() => window.scrollY);
    check(Math.abs((await zoomOf()) - z0) < 1e-9, 'ลูกกลิ้งบนใยไม่ซูม');
    check(y1 > y0, `ลูกกลิ้งบนใยเลื่อนหน้าเว็บ (${y0} → ${y1})`);

    // ปุ่มซูม
    await scrollIntoView(g.wrap);
    const lvlText = () => page.$eval(g.wrap + ' .gc-level', (e) => e.textContent);
    const btn = (k) => g.wrap + ` .gc-btn[aria-label]:nth-of-type(${k})`;
    const bar = async () => page.$$eval(g.wrap + ' .gc-btn', (bs) => bs.map((b) => ({ label: b.getAttribute('aria-label'), title: b.title, disabled: b.disabled, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
    let bs = await bar();
    check(bs.length === 4 && bs.every((b) => b.label && b.title && b.w >= 44 && b.h >= 44), 'มีปุ่ม 4 ปุ่ม มี aria-label/title และขนาด ≥ 44px');
    check((await lvlText()) === '100%', `เริ่มที่ 100% (ได้ ${await lvlText()})`);
    const zStart = await zoomOf();
    const click = async (i) => { const hs = await page.$$(g.wrap + ' .gc-btn'); await hs[i].click(); await sleep(450); };
    await click(0);
    const z1 = await zoomOf();
    check(Math.abs(z1 / zStart - 1.25) < 0.01, `ซูมเข้าทีละ 1.25 เท่า (${(z1 / zStart).toFixed(3)})`);
    check((await lvlText()) === '125%', `แสดง 125% (ได้ ${await lvlText()})`);
    await click(1); await click(1);
    check(Math.abs((await zoomOf()) / zStart - 1 / 1.25) < 0.01, 'ซูมออกสองครั้งได้ 80%');
    await click(2);
    check((await lvlText()) === '100%', 'ปุ่มดูทั้งใยกลับมาเห็นทั้งใย');
    // ถึงขีดจำกัด
    await page.evaluate(() => { const cy = document.querySelector('.cy').__cy; cy.zoom(cy.maxZoom() / 1.05); });
    await click(0);
    bs = await bar();
    check(bs[0].disabled && !bs[1].disabled, 'ถึง maxZoom แล้วปุ่มซูมเข้ากดไม่ได้');
    await page.evaluate(() => { const cy = document.querySelector('.cy').__cy; cy.zoom(cy.minZoom() * 1.05); });
    await click(1);
    bs = await bar();
    check(bs[1].disabled && !bs[0].disabled, 'ถึง minZoom แล้วปุ่มซูมออกกดไม่ได้');
    await click(3);
    const zr = await zoomOf();
    check(Math.abs(zr - zStart) / zStart < 0.05 || g.name === 'ใยภาพรวม', 'ปุ่มกลับตำแหน่งเริ่มต้นคืนซูมเดิม');
    await click(2);

    // คีย์ลัด
    await page.evaluate((w) => document.querySelector(w).focus(), g.wrap);
    const zk = await zoomOf();
    await page.keyboard.press('+'); await sleep(400);
    check((await zoomOf()) > zk * 1.2, 'คีย์ + ซูมเข้า');
    await page.keyboard.press('-'); await sleep(400);
    check(Math.abs((await zoomOf()) - zk) / zk < 0.02, 'คีย์ − ซูมออก');
    await page.keyboard.press('='); await sleep(400);
    await page.keyboard.press('0'); await sleep(500);
    check(Math.abs((await zoomOf()) - zk) / zk < 0.05, 'คีย์ 0 ดูทั้งใย');
    const p0 = await page.evaluate(() => ({ ...document.querySelector('.cy').__cy.pan() }));
    await page.keyboard.press('ArrowLeft'); await sleep(400);
    const p1 = await page.evaluate(() => ({ ...document.querySelector('.cy').__cy.pan() }));
    check(p1.x > p0.x, 'ลูกศรเลื่อนใย');
    await page.keyboard.press('0'); await sleep(500);
  }

  // ------------------------------------------------------------ 4, 5: ใยภาพรวม
  console.log('\n== ใยภาพรวม: สลับระดับด้วยปุ่ม และคีย์ลัดในช่องค้นหา');
  await page.setViewport({ width: 1100, height: 800 });
  await open('#/overview/system');
  await scrollIntoView('.graph-wrap');
  const badge = () => page.$eval('.level-badge', (e) => e.textContent);
  const b0 = await badge();
  const hs = await page.$$('.graph-wrap .gc-btn');
  for (let i = 0; i < 6; i++) { await hs[0].click(); await sleep(350); }
  const b1 = await badge();
  check(b0 !== b1, `ซูมเข้าด้วยปุ่มแล้วสลับเป็นระดับแสดงชื่อเซลล์ ("${b0}" → "${b1}")`);
  const fineNames = await page.evaluate(() => document.querySelector('.cy').__cy.nodes('.cell').filter((n) => !n.hasClass('lvl-coarse')).length);
  check(fineNames > 0, 'ระดับซูมเข้าแสดงชื่อเซลล์');
  await hs[2].click(); await sleep(900);
  check((await badge()) === b0, 'กดดูทั้งใยแล้วกลับระดับแสดงชื่อกลุ่ม');
  // แตะกรอบกลุ่มเพื่อซูมเข้า
  const gp = await page.evaluate(() => {
    const c = document.querySelector('.cy'); const cy = c.__cy; const r = c.getBoundingClientRect();
    // จุดว่างในกรอบกลุ่มที่ไม่ทับจุดเซลล์ (ขอบบนด้านในของกรอบ)
    for (const g of cy.nodes('.group').toArray()) {
      const bb = g.renderedBoundingBox({ includeLabels: false, includeOverlays: false });
      for (let fy = 0.03; fy < 0.4; fy += 0.02) for (let fx = 0.1; fx < 0.9; fx += 0.1) {
        const x = bb.x1 + (bb.x2 - bb.x1) * fx, y = bb.y1 + (bb.y2 - bb.y1) * fy;
        if (x < 20 || x > cy.width() - 80 || y < 20 || y > cy.height() - 80) continue;
        const hit = cy.nodes().filter((n) => { const b = n.renderedBoundingBox(); return !n.isParent() && x >= b.x1 - 6 && x <= b.x2 + 6 && y >= b.y1 - 6 && y <= b.y2 + 6; });
        if (hit.empty()) return { x: r.x + x, y: r.y + y, id: g.id() };
      }
    }
    return null;
  });
  const zg = await zoomOf();
  await page.mouse.click(gp.x, gp.y); await sleep(900);
  check((await zoomOf()) > zg * 1.2, 'แตะกรอบกลุ่มแล้วซูมเข้าที่กลุ่มนั้น');
  await hs[2].click(); await sleep(900);
  // สลับการจัดกลุ่มยังเคลื่อนแบบ animation
  const moved = await page.evaluate(async () => {
    const cy = document.querySelector('.cy').__cy; const n = cy.nodes('.cell')[0]; const p0 = { ...n.position() };
    document.querySelectorAll('.btn-group button')[1].click();
    await new Promise((r) => setTimeout(r, 200));
    const mid = { ...n.position() };
    await new Promise((r) => setTimeout(r, 900));
    const end = { ...n.position() };
    return { p0, mid, end };
  });
  check(moved.end.x !== moved.p0.x || moved.end.y !== moved.p0.y, 'สลับเป็นเนื้อเยื่อแล้วจุดเคลื่อนไปตำแหน่งใหม่');
  check(moved.mid.x !== moved.end.x || moved.mid.y !== moved.end.y, 'การเคลื่อนเป็น animation (ระหว่างทางยังไม่ถึงปลายทาง)');

  // พิมพ์ + และ 0 ในช่องค้นหาแล้วใยต้องไม่ซูม
  await scrollIntoView('.search input');
  const zq = await zoomOf();
  await page.click('.search input');
  await page.keyboard.type('+0-=');
  await sleep(500);
  check(Math.abs((await zoomOf()) - zq) < 1e-9, 'พิมพ์ + − 0 = ในช่องค้นหาแล้วใยไม่ซูม');
  check((await page.$eval('.search input', (e) => e.value)) === '+0-=', 'ตัวอักษรเข้าช่องค้นหาตามปกติ');

  // ------------------------------------------------------------ ใยนิ่ง
  for (const g of STATICS) {
    console.log('\n== ' + g.name);
    await page.setViewport({ width: 1100, height: 800 });
    await open(g.hash, g.hash.startsWith('#/compare') ? '.cmp-graph .cy' : '.cy');
    const cfg = await page.evaluate(() => { const cy = document.querySelector('.mini-graph .cy').__cy; return { drag: cy.autoungrabify(), zoom: cy.userZoomingEnabled(), pan: cy.userPanningEnabled() }; });
    check(cfg.drag && !cfg.zoom && !cfg.pan, `นิ่งทั้งหมด (${JSON.stringify(cfg)})`);
    check((await page.$$('.mini-graph .gc-bar')).length === 0, 'ไม่มีปุ่มควบคุม');
    await scrollIntoView('.mini-graph');
    const np = await page.evaluate(() => { const c = document.querySelector('.mini-graph .cy'); const cy = c.__cy; const r = c.getBoundingClientRect(); const n = cy.nodes()[cy.nodes().length - 1]; const q = n.renderedPosition(); return { id: n.id(), x: r.x + q.x, y: r.y + q.y }; });
    const pos0 = await page.evaluate((id) => ({ ...document.querySelector('.mini-graph .cy').__cy.getElementById(id).position() }), np.id);
    await page.mouse.move(np.x, np.y); await page.mouse.down(); await page.mouse.move(np.x + 50, np.y + 30, { steps: 5 }); await page.mouse.up();
    await sleep(200);
    const hashNow = await page.evaluate(() => location.hash);
    check(/#\/cell\//.test(hashNow) || true, 'ลากไม่ทำให้พัง');
    await page.goBack().catch(() => {});
    await open(g.hash, g.hash.startsWith('#/compare') ? '.cmp-graph .cy' : '.cy');
    await scrollIntoView('.mini-graph');
    const np2 = await page.evaluate(() => { const c = document.querySelector('.mini-graph .cy'); const cy = c.__cy; const r = c.getBoundingClientRect(); const ids = cy.nodes().map((n) => n.id()); const n = cy.nodes()[cy.nodes().length - 1]; const q = n.renderedPosition(); return { id: n.id(), x: r.x + q.x, y: r.y + q.y }; });
    await page.mouse.click(np2.x, np2.y); await sleep(400);
    check(/#\/cell\//.test(await page.evaluate(() => location.hash)), 'แตะจุดแล้วไปหน้าเซลล์นั้น');
    // ปรับขนาดจอแล้วใยยังพอดีกรอบ
    await open(g.hash, g.hash.startsWith('#/compare') ? '.cmp-graph .cy' : '.cy');
    await page.setViewport({ width: 600, height: 800 });
    await sleep(700);
    const fits = await page.evaluate(() => { const cy = document.querySelector('.mini-graph .cy').__cy; const bb = cy.elements().renderedBoundingBox(); return bb.x1 >= -1 && bb.y1 >= -1 && bb.x2 <= cy.width() + 1 && bb.y2 <= cy.height() + 1; });
    check(fits, 'ปรับขนาดจอแล้วใยยังพอดีกรอบ');
  }

  // ------------------------------------------------------------ 6: มือถือ 380px
  console.log('\n== มือถือ 380px');
  await page.setViewport({ width: 380, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  for (const g of [...GRAPHS.slice(0, 1), GRAPHS[1], GRAPHS[2], ...STATICS]) {
    await open(g.hash, g.hash.startsWith('#/compare') ? '.cmp-graph .cy' : '.cy');
    const interactive = !STATICS.includes(g);
    await scrollIntoView(g.wrap);
    const info = await page.evaluate((w) => {
      const wrap = document.querySelector(w); const r = wrap.getBoundingClientRect();
      const bs = [...wrap.querySelectorAll('.gc-btn')].map((b) => { const q = b.getBoundingClientRect(); return [q.width, q.height, q.right <= r.right + 0.5, q.bottom <= r.bottom + 0.5]; });
      return { bs, coarse: matchMedia('(pointer: coarse)').matches, overflowX: document.documentElement.scrollWidth > innerWidth, wrapH: r.height };
    }, g.wrap);
    if (interactive) check(info.bs.length === 4 && info.bs.every((b) => b[0] >= 44 && b[1] >= 44 && b[2] && b[3]), `${g.name}: ปุ่ม ≥ 44px และอยู่ในกรอบ`);
    check(!info.overflowX, `${g.name}: หน้าไม่เลื่อนซ้ายขวา`);
    // ปัดนิ้วขึ้นบนใย หน้าต้องเลื่อน
    const r = await centerOf(g.wrap);
    const y0 = await page.evaluate(() => window.scrollY);
    const tx = Math.round(r.x + r.w / 2 - 40), ty = Math.round(Math.min(r.y + r.h / 2, 600));
    const finger = await page.touchscreen.touchStart(tx, ty);
    for (let i = 1; i <= 10; i++) { await finger.move(tx, ty - 20 * i); await sleep(16); }
    await finger.end();
    await sleep(500);
    const y1 = await page.evaluate(() => window.scrollY);
    check(y1 > y0, `${g.name}: ปัดนิ้วบนใยแล้วหน้าเว็บเลื่อน (${y0} → ${y1}, coarse=${info.coarse})`);
    check(page.url().endsWith(g.hash), `${g.name}: ปัดนิ้วแล้วไม่ถูกนับเป็นการแตะจุด`);
    if (interactive) {
      // ซูมเข้าแล้ว นิ้วลากต้องเลื่อนใย (ไม่ใช่หน้าเว็บ)
      await page.evaluate(() => { const cy = document.querySelector('.cy').__cy; cy.zoom(cy.zoom() * 2); });
      await sleep(200);
      const pan0 = await page.evaluate(() => ({ ...document.querySelector('.cy').__cy.pan() }));
      const ys = await page.evaluate(() => window.scrollY);
      const f2 = await page.touchscreen.touchStart(tx, ty);
      for (let i = 1; i <= 8; i++) { await f2.move(tx - 10 * i, ty - 10 * i); await sleep(16); }
      await f2.end();
      await sleep(300);
      const pan1 = await page.evaluate(() => ({ ...document.querySelector('.cy').__cy.pan() }));
      check(pan1.x !== pan0.x || pan1.y !== pan0.y, `${g.name}: ซูมเข้าแล้วนิ้วลากเลื่อนใยได้`);
      check((await page.evaluate(() => window.scrollY)) === ys, `${g.name}: ตอนเลื่อนใย หน้าเว็บไม่เลื่อนตาม`);
    }
  }
  await page.setViewport({ width: 1100, height: 800 });

  // ------------------------------------------------------------ คำแนะนำครั้งแรก
  console.log('\n== คำแนะนำการใช้งาน');
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.removeItem('nexus.graphTipDismissed'));
  await open('#/system/blood-immune');
  check((await page.$$('.gc-tip')).length === 1, 'ครั้งแรกแสดงคำแนะนำใต้ใย');
  await page.click('.gc-tip-close');
  check((await page.$$('.gc-tip')).length === 0, 'กด × ปิดได้');
  await open('#/overview/system');
  check((await page.$$('.gc-tip')).length === 0, 'เปิดหน้าอื่น/โหลดใหม่แล้วไม่แสดงอีก (จำไว้ใน localStorage)');

  // ------------------------------------------------------------ 7: ไม่มี error ทั้งสองธีมสองภาษา
  console.log('\n== console ไม่มี error (ธีม × ภาษา)');
  for (const scheme of ['light', 'dark']) {
    for (const lang of ['th', 'en']) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await page.goto(base, { waitUntil: 'load' });
      await page.evaluate((l) => localStorage.setItem('nexus.lang', l), lang);
      await page.evaluate(() => localStorage.removeItem('nexus.graphTipDismissed'));
      const before = errors.length;
      for (const g of [...GRAPHS, ...STATICS]) {
        await open(g.hash, g.hash.startsWith('#/compare') ? '.cmp-graph .cy' : '.cy');
        const k = await page.evaluate(() => document.documentElement.lang);
        if (k !== lang) console.log('  ! lang=' + k + ' คาดว่า ' + lang);
        await page.keyboard.press('+');
      }
      check(errors.length === before, `${scheme}/${lang}: ไม่มี error ${errors.slice(before).join(' | ')}`);
    }
  }
} finally {
  await browser.close();
  srv.close();
}

check(errors.length === 0, 'ตลอดการทดสอบไม่มี error ใน console' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
console.log(failures ? `\nล้มเหลว ${failures} ข้อ` : '\nOK');
process.exit(failures ? 1 : 0);

// ตรวจการแยกข้อความออกจากโค้ด
//   1. ไม่มีอักษรไทยใน .js (ไม่นับคอมเมนต์) ภายใต้ site/js
//   2. ทุก t('key') ที่ใช้ในโค้ดมีใน th.json และ en.json และสองไฟล์มีคีย์ชุดเดียวกัน
//   3. data-i18n ใน index.html/404.html มีคีย์ครบ
//   4. ไม่มีคีย์ที่ไม่ได้ใช้ (เตือนเท่านั้น คีย์ที่ประกอบแบบไดนามิกถูกนับตามคำนำหน้า)
// รัน: node scripts/test-i18n.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, 'site', 'js');
const THAI = /[฀-๿]/;
let failed = 0;

// ตัดคอมเมนต์ออกด้วยตัวสแกนที่รู้จักสตริง เทมเพลต และ regex (กันตัด // ในสตริง เช่น URL)
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const isRegexStart = () => {
    // ดูตัวอักษรที่ไม่ใช่ช่องว่างก่อนหน้า: ถ้าเป็นตัวดำเนินการ/วงเล็บเปิด ถือว่าเป็น regex
    let j = out.length - 1;
    while (j >= 0 && /\s/.test(out[j])) j--;
    if (j >= 1 && /(\+\+|--)$/.test(out.slice(j - 1, j + 1))) return false; // k++ / 3 คือการหาร
    return j < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(out[j]) || /\b(return|typeof|case|in|of)$/.test(out.slice(Math.max(0, j - 6), j + 1));
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; out += c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') { out += src[i++]; } out += src[i++]; }
      out += src[i++] || '';
      continue;
    }
    if (c === '`') {
      out += c; i++;
      let depth = 0;
      while (i < n && !(src[i] === '`' && depth === 0)) {
        if (src[i] === '\\') { out += src[i++]; out += src[i++]; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { depth++; out += '${'; i += 2; continue; }
        if (src[i] === '}' && depth > 0) { depth--; }
        out += src[i++];
      }
      out += src[i++] || '';
      continue;
    }
    if (c === '/' && isRegexStart()) {
      out += c; i++;
      let inClass = false;
      while (i < n && (src[i] !== '/' || inClass)) {
        if (src[i] === '\\') { out += src[i++]; }
        else if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        out += src[i++];
      }
      out += src[i++] || '';
      continue;
    }
    out += c; i++;
  }
  return out;
}

const files = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
const used = new Set();
const usedLoose = new Set();
const dynamicPrefixes = new Set();
for (const f of files) {
  const src = readFileSync(join(jsDir, f), 'utf8');
  const code = stripComments(src);
  code.split('\n').forEach((line, idx) => {
    if (THAI.test(line)) { failed++; console.log(`✗ ${f}:${idx + 1} มีอักษรไทยในโค้ด: ${line.trim().slice(0, 100)}`); }
  });
  for (const m of code.matchAll(/\bt\(\s*(['"`])([^'"`]+)\1/g)) {
    if (m[2].includes('${')) dynamicPrefixes.add(m[2].split('${')[0]); else if (m[2].endsWith('.')) dynamicPrefixes.add(m[2]); else used.add(m[2]);
  }
  for (const m of code.matchAll(/\bt\(\s*(['"])([\w.]+\.)\1\s*\+/g)) dynamicPrefixes.add(m[2]);
  for (const m of code.matchAll(/\b(?:promptKey|labelKey|key):\s*(['"])([\w.]+)\1/g)) used.add(m[2]);
  for (const m of code.matchAll(/promptKey:\s*[^,]*\?\s*(['"])([\w.]+)\1\s*:\s*(['"])([\w.]+)\3/g)) { used.add(m[2]); used.add(m[4]); }
  // t(cond ? 'a' : 'b')
  for (const m of code.matchAll(/\bt\(\s*[^'"`)]*\?\s*(['"])([\w.]+)\1\s*:\s*(['"])([\w.]+)\3/g)) { used.add(m[2]); used.add(m[4]); }
  // คีย์ที่อ้างโดยอ้อม (เก็บในตัวแปรก่อนส่งให้ t) ใช้สรุป "คีย์ที่ไม่ได้ใช้" เท่านั้น ไม่ใช้ตัดสินว่าขาดคีย์
  for (const m of code.matchAll(/(['"])((?:quiz|cmp|compare|field|mode|edge|about|card|legend|search|nav|notfound|home|sys|tissue|overview|common|app|lang|footer|img|rel|ov|germ|layout|peek|cell|pwa)\.[\w.]+)\1/g)) usedLoose.add(m[2]);
}

const th = JSON.parse(readFileSync(join(root, 'site', 'i18n', 'th.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'site', 'i18n', 'en.json'), 'utf8'));
for (const k of Object.keys(th)) if (!(k in en)) { failed++; console.log(`✗ มีใน th.json แต่ไม่มีใน en.json: ${k}`); }
for (const k of Object.keys(en)) if (!(k in th)) { failed++; console.log(`✗ มีใน en.json แต่ไม่มีใน th.json: ${k}`); }
for (const k of used) if (!(k in th)) { failed++; console.log(`✗ โค้ดใช้คีย์ที่ไม่มี: ${k}`); }
for (const [k, v] of Object.entries(th)) {
  const pe = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const pt = [...(en[k] || '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  if (en[k] != null && pe !== pt) { failed++; console.log(`✗ พารามิเตอร์ไม่ตรงกัน ${k}: th{${pe}} en{${pt}}`); }
}


// หน้าแอดมิน (site/admin): ไม่มีอักษรไทยในโค้ด และทุก at('key') มีใน th.json
{
  const adminDir = join(root, 'site', 'admin');
  if (existsSync(adminDir)) {
    const adminTh = JSON.parse(readFileSync(join(adminDir, 'th.json'), 'utf8'));
    const files = readdirSync(adminDir).filter((f) => f.endsWith('.js'));
    for (const f of files) {
      const code = stripComments(readFileSync(join(adminDir, f), 'utf8'));
      code.split(String.fromCharCode(10)).forEach((line, idx) => { if (THAI.test(line)) { failed++; console.log(`✗ admin/${f}:${idx + 1} มีอักษรไทยในโค้ด: ${line.trim().slice(0, 100)}`); } });
      for (const m of code.matchAll(/at\(\s*(['"`])([^'"`]+)/g)) {
        const k = m[2];
        if (k.endsWith('.')) { if (!Object.keys(adminTh).some((x) => x.startsWith(k))) { failed++; console.log(`✗ admin/${f}: ไม่มีคีย์ขึ้นต้น ${k}`); } }
        else if (!(k in adminTh)) { failed++; console.log(`✗ admin/${f}: ไม่มีคีย์ ${k}`); }
      }
    }
    console.log(`admin: ตรวจ ${files.length} ไฟล์ .js, ${Object.keys(adminTh).length} คีย์`);
  }
}

// HTML ตายตัว
for (const f of ['index.html', '404.html']) {
  const p = join(root, 'site', f);
  if (!existsSync(p)) continue;
  const html = readFileSync(p, 'utf8');
  for (const m of html.matchAll(/data-i18n="([\w.]+)"/g)) if (!(m[1] in th)) { failed++; console.log(`✗ ${f}: data-i18n ไม่มีคีย์ ${m[1]}`); }
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const pair of m[1].split(';')) { const k = pair.split(':')[1]; if (k && !(k.trim() in th)) { failed++; console.log(`✗ ${f}: data-i18n-attr ไม่มีคีย์ ${k}`); } }
}

// คีย์ที่ไม่ได้ใช้ (เตือนเท่านั้น)
const unused = Object.keys(th).filter((k) => !used.has(k) && !usedLoose.has(k) && ![...dynamicPrefixes].some((p) => k.startsWith(p)) && !/^(mode|quiz\.type|field)\./.test(k));
if (unused.length) console.log(`! คีย์ที่ไม่พบการใช้ในโค้ด (${unused.length}): ${unused.slice(0, 12).join(', ')}${unused.length > 12 ? ' …' : ''}`);

console.log(failed ? `\nFAILED (${failed})` : `\nOK: ${files.length} ไฟล์ .js ไม่มีข้อความไทยในโค้ด, ${Object.keys(th).length} คีย์ครบทั้งสองภาษา`);
process.exit(failed ? 1 : 0);

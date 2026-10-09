// คำนวณตำแหน่งใยภาพรวมล่วงหน้า (2 แบบ: ตามระบบ และตามเนื้อเยื่อ)
// อ่าน site/data/nexus.json แล้วเขียน site/data/layout-overview.json
// รัน: node scripts/layout.mjs   (หรือ python scripts/nexus.py build ซึ่งเรียกให้อัตโนมัติถ้ามี Node)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { computeAll } from '../site/js/overview-layout.js';

cytoscape.use(fcose);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'site', 'data', 'nexus.json');
const dst = join(root, 'site', 'data', 'layout-overview.json');

const data = JSON.parse(readFileSync(src, 'utf8'));
const t0 = Date.now();
const out = computeAll(cytoscape, data);
// ไม่ใส่เวลาสร้างในไฟล์ เพื่อให้ผลลัพธ์เหมือนกันทุกไบต์เมื่อข้อมูลไม่เปลี่ยน
writeFileSync(dst, JSON.stringify(out, null, 1) + '\n', 'utf8');
console.log(
  `เขียน site/data/layout-overview.json แล้ว: ${out.nodeCount} จุด, ${out.edgeCount} เส้น, hash ${out.hash} (${Date.now() - t0} ms)`,
);

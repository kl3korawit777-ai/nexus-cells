// คำนวณตำแหน่งใยภาพรวม (ไม่แตะ DOM) ใช้ร่วมกันระหว่าง
//   - scripts/layout.mjs (Node, คำนวณล่วงหน้าตอน build)
//   - เบราว์เซอร์ (สำรอง เมื่อไม่มีไฟล์หรือแฮชไม่ตรง)
// ให้ผลเหมือนเดิมทุกครั้ง: ตำแหน่งเริ่มต้นกำหนดได้ + seeded random + fcose แบบ randomize: false

import { hashHex } from './hash.js';

export const LAYOUT_VERSION = 1;

export const primarySystem = (cell) => (cell.systems || [])[0] || 'other';
export const tissueGroup = (cell) => cell.tissue || 'other';

// แฮชของรายการจุด (พร้อมกลุ่ม) และเส้น ใช้ตรวจว่าตำแหน่งที่คำนวณไว้ยังตรงกับข้อมูล
export function layoutHash(data) {
  const nodes = data.cells.map((c) => [c.id, primarySystem(c), tissueGroup(c)].join('|')).sort();
  const edges = data.edges.map((e) => [e.type, e.from, e.to].join('|')).sort();
  const order = data.systems.map((s) => s.id).join(',') + ';' + data.tissues.map((t) => t.id).join(',');
  return hashHex([LAYOUT_VERSION, nodes.join('\n'), edges.join('\n'), order].join('\n--\n'));
}

// กลุ่มตามลำดับใน systems.json / tissues.json (ข้ามกลุ่มที่ไม่มีสมาชิก)
export function groupsFor(mode, data) {
  const defs = mode === 'tissue' ? data.tissues : data.systems;
  const keyOf = mode === 'tissue' ? tissueGroup : primarySystem;
  const byId = new Map(defs.map((d) => [d.id, { id: d.id, th: d.th, en: d.en, color: d.color, members: [] }]));
  for (const c of data.cells) {
    const k = keyOf(c);
    const g = byId.get(k) || byId.get('other');
    if (g) g.members.push(c.id);
  }
  return [...byId.values()].filter((g) => g.members.length);
}

// ตัวสุ่มแบบมีเมล็ด
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n) => Math.round(n * 10) / 10;

export function computeLayout(cytoscape, data, mode) {
  const groups = groupsFor(mode, data);
  const rand = mulberry32(mode === 'tissue' ? 9176 : 4021);

  // วางกลุ่มเป็นวงกลมตามลำดับ แล้วเรียงสมาชิกเป็นเกลียวรอบจุดศูนย์กลางของกลุ่ม
  const G = groups.length;
  const R = Math.max(320, G * 75);
  const init = new Map();
  const elements = [];
  groups.forEach((g, gi) => {
    const ang = (gi / G) * Math.PI * 2 - Math.PI / 2;
    const cx = R * Math.cos(ang), cy = R * Math.sin(ang);
    elements.push({ group: 'nodes', data: { id: 'g:' + g.id }, classes: 'group' });
    g.members.forEach((id, i) => {
      const rad = 30 * Math.sqrt(i + 1);
      const th = i * 2.399963 + rand() * 0.3;
      init.set(id, { x: cx + rad * Math.cos(th), y: cy + rad * Math.sin(th) });
    });
  });
  const groupOf = new Map();
  groups.forEach((g) => g.members.forEach((id) => groupOf.set(id, g.id)));
  for (const [id, p] of init) {
    elements.push({ group: 'nodes', data: { id, parent: 'g:' + groupOf.get(id) }, position: p });
  }
  data.edges.forEach((e, i) => {
    if (!groupOf.has(e.from) || !groupOf.has(e.to)) return;
    const same = groupOf.get(e.from) === groupOf.get(e.to);
    elements.push({ group: 'edges', data: { id: 'e' + i, source: e.from, target: e.to, same: same ? 1 : 0 } });
  });

  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements,
    style: [
      { selector: 'node', style: { width: 18, height: 18 } },
      { selector: ':parent', style: { padding: 22 } },
    ],
  });

  // fcose บางขั้นตอนเรียก Math.random: ใช้ตัวสุ่มมีเมล็ดชั่วคราวเพื่อให้ผลเหมือนเดิมทุกครั้ง
  const realRandom = Math.random;
  Math.random = mulberry32(mode === 'tissue' ? 31 : 17);
  try {
    cy.layout({
      name: 'fcose', quality: 'proof', randomize: false, animate: false, fit: false,
      nodeDimensionsIncludeLabels: false, uniformNodeDimensions: false, packComponents: false,
      nodeRepulsion: () => 7000,
      idealEdgeLength: (e) => (e.data('same') ? 55 : 190),
      edgeElasticity: (e) => (e.data('same') ? 0.45 : 0.08),
      nestingFactor: 0.15, gravity: 0.2, gravityRange: 3.8,
      gravityCompound: 1.0, gravityRangeCompound: 1.6,
      numIter: 3500, tile: true, tilingPaddingVertical: 14, tilingPaddingHorizontal: 14,
    }).run();
  } finally {
    Math.random = realRandom;
  }

  const positions = {};
  cy.nodes().not('.group').forEach((n) => {
    const p = n.position();
    positions[n.id()] = [r1(p.x), r1(p.y)];
  });
  const boxes = {};
  cy.nodes('.group').forEach((n) => {
    const b = n.boundingBox({ includeLabels: false, includeOverlays: false });
    boxes[n.id().slice(2)] = [r1(b.x1), r1(b.y1), r1(b.x2), r1(b.y2)];
  });
  cy.destroy();
  return { positions, boxes };
}

export function computeAll(cytoscape, data) {
  const out = { version: LAYOUT_VERSION, hash: layoutHash(data), nodeCount: data.cells.length, edgeCount: data.edges.length, modes: {} };
  for (const mode of ['system', 'tissue']) out.modes[mode] = computeLayout(cytoscape, data, mode);
  return out;
}

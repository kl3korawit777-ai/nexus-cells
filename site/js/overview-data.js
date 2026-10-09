// โหลดตำแหน่งใยภาพรวมที่คำนวณไว้ล่วงหน้า (data/layout-overview.json)
// ถ้าไม่มีไฟล์ หรือแฮชไม่ตรงกับข้อมูลปัจจุบัน จะคำนวณในเบราว์เซอร์แทนและเตือนใน console

import { store } from './data.js';
import { computeAll, layoutHash, LAYOUT_VERSION } from './overview-layout.js';
import { ensureFcose } from './graph.js';

let pending = null;

export function overviewData() {
  return { systems: store.systems, tissues: store.tissues, cells: store.cells, edges: store.edges };
}

export function loadOverviewLayout() {
  if (!pending) pending = load();
  return pending;
}

async function load() {
  const data = overviewData();
  const expected = layoutHash(data);
  let reason = '';
  try {
    const res = await fetch('data/layout-overview.json', { cache: 'no-cache' });
    if (res.ok) {
      const json = await res.json();
      if (json.version === LAYOUT_VERSION && json.hash === expected) return { ...json, source: 'precomputed' };
      reason = `แฮชไม่ตรงกับข้อมูลปัจจุบัน (ไฟล์: ${json.hash}, ข้อมูล: ${expected})`;
    } else {
      reason = `ไม่พบไฟล์ (HTTP ${res.status})`;
    }
  } catch (e) {
    reason = 'อ่านไฟล์ไม่ได้: ' + e.message;
  }
  console.warn(`[Nexus] ใช้ตำแหน่งใยภาพรวมที่คำนวณล่วงหน้าไม่ได้ — ${reason} จึงคำนวณในเบราว์เซอร์แทน (รัน python scripts/nexus.py build เพื่อสร้างไฟล์ใหม่)`);
  ensureFcose();
  const t0 = performance.now();
  const out = computeAll(window.cytoscape, data);
  console.info(`[Nexus] คำนวณตำแหน่งในเบราว์เซอร์ใช้เวลา ${Math.round(performance.now() - t0)} ms`);
  return { ...out, source: 'browser' };
}

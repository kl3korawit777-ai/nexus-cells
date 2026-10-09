// โหลดตำแหน่งใยภาพรวมที่คำนวณไว้ล่วงหน้า (data/layout-overview.json)
// ถ้าไม่มีไฟล์ หรือแฮชไม่ตรงกับข้อมูลปัจจุบัน จะคำนวณในเบราว์เซอร์แทนและเตือนใน console

import { store } from './data.js';
import { computeAll, layoutHash, LAYOUT_VERSION } from './overview-layout.js';
import { ensureFcose } from './graph.js';
import { t } from './i18n.js';

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
      reason = t('layout.hashMismatch', { file: json.hash, data: expected });
    } else {
      reason = t('layout.notFound', { status: res.status });
    }
  } catch (e) {
    reason = t('layout.unreadable', { msg: e.message });
  }
  console.warn('[Nexus] ' + t('layout.fallbackWarn', { reason }));
  ensureFcose();
  const t0 = performance.now();
  const out = computeAll(window.cytoscape, data);
  console.info('[Nexus] ' + t('layout.fallbackTime', { ms: Math.round(performance.now() - t0) }));
  return { ...out, source: 'browser' };
}

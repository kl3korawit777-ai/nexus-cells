// โหลด nexus.json และสร้างดัชนี ข้อมูลทั้งหมดมาจากไฟล์นี้เท่านั้น

// ประเภทของเส้น interacts_with (ลำดับนี้ใช้เรียงปุ่มและ legend)
export const MODES = [
  { id: 'hormone', th: 'ฮอร์โมน' },
  { id: 'synapse', th: 'ซินแนปส์' },
  { id: 'paracrine', th: 'พาราไครน์' },
  { id: 'support', th: 'สนับสนุน' },
  { id: 'immune', th: 'ภูมิคุ้มกัน' },
];
export const modeLabel = (id) => (MODES.find((m) => m.id === id) || { th: '' }).th;

export const store = {
  meta: null,
  systems: [],
  tissues: [],
  cells: [],
  edges: [],
  cellsById: new Map(),
  systemsById: new Map(),
  tissuesById: new Map(),
  subtypes: new Map(), // id ชนิดย่อย -> {id, th, en, tissue}
  subtypeKeys: [], // ลำดับคงที่ ใช้เลือกสีสำรอง
  searchIndex: [],
};

export async function loadData() {
  const res = await fetch('data/nexus.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('โหลด data/nexus.json ไม่สำเร็จ (HTTP ' + res.status + ')');
  const d = await res.json();
  store.meta = d.meta;
  store.systems = d.systems;
  store.tissues = d.tissues;
  store.cells = d.cells;
  store.edges = d.edges;
  for (const s of d.systems) store.systemsById.set(s.id, s);
  for (const t of d.tissues) {
    store.tissuesById.set(t.id, t);
    for (const st of t.subtypes || []) {
      store.subtypes.set(st.id, { ...st, tissue: t.id });
      store.subtypeKeys.push(st.id);
    }
  }
  for (const c of d.cells) store.cellsById.set(c.id, c);
  store.searchIndex = d.cells.map((c) => ({
    cell: c,
    terms: [c.th, c.en, c.slug, c.id, c.id.replace(':', '_'), ...((c.cl && c.cl.synonyms) || [])]
      .filter(Boolean)
      .map((t) => t.toLowerCase()),
  }));
  return store;
}

// กุญแจสีของจุด: ชนิดย่อย ถ้าไม่มีใช้เนื้อเยื่อหลัก
export const colorKey = (cell) => cell.tissue_subtype || cell.tissue || 'other';

export const cellsInSystem = (systemId) =>
  store.cells.filter((c) => (c.systems || []).includes(systemId));

// นับเฉพาะเซลล์จริง (kind "cell") ไม่นับหมวด
export const realCellCount = (systemId) =>
  cellsInSystem(systemId).filter((c) => c.kind === 'cell').length;

export function systemEdges(systemId) {
  const ids = new Set(cellsInSystem(systemId).map((c) => c.id));
  return store.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
}

// เส้น interacts_with ที่ปลายด้านหนึ่งอยู่ในระบบนี้ อีกด้านอยู่นอกระบบ (ใช้สร้าง ghost node)
export function crossSystemEdges(systemId) {
  const ids = new Set(cellsInSystem(systemId).map((c) => c.id));
  return store.edges.filter((e) => e.type === 'interacts_with' && ids.has(e.from) !== ids.has(e.to));
}

export function edgeSentence(e) {
  const a = store.cellsById.get(e.from);
  const b = store.cellsById.get(e.to);
  if (!a || !b) return '';
  if (e.type === 'develops_from') return `${a.en} เจริญมาจาก ${b.en}`;
  if (e.type === 'is_a') return `${a.en} เป็นชนิดหนึ่งของ ${b.en}`;
  const m = e.mode ? ` [${modeLabel(e.mode)}]` : '';
  return `${a.en} → ${b.en}${m}` + (e.th ? `: ${e.th}` : '');
}

export function relationsOf(id) {
  const get = (i) => store.cellsById.get(i);
  const r = { developsFrom: [], giveRiseTo: [], isA: [], subtypes: [], interactsOut: [], interactsIn: [] };
  for (const e of store.edges) {
    if (e.type === 'develops_from') {
      if (e.from === id) r.developsFrom.push({ cell: get(e.to) });
      if (e.to === id) r.giveRiseTo.push({ cell: get(e.from) });
    } else if (e.type === 'is_a') {
      if (e.from === id) r.isA.push({ cell: get(e.to) });
      if (e.to === id) r.subtypes.push({ cell: get(e.from) });
    } else if (e.type === 'interacts_with') {
      if (e.from === id) r.interactsOut.push({ cell: get(e.to), th: e.th, mode: e.mode });
      if (e.to === id) r.interactsIn.push({ cell: get(e.from), th: e.th, mode: e.mode });
    }
  }
  for (const k of Object.keys(r)) r[k] = r[k].filter((x) => x.cell);
  return r;
}

export function searchCells(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // พิมพ์ "cl_0000775" หรือ "cl0000775" ก็ค้นเจอ
  const qn = q.replace(/^cl[_:]?(?=\d)/, 'cl:');
  const scored = [];
  for (const item of store.searchIndex) {
    let best = 0;
    for (const t of item.terms) {
      if (t === q || t === qn) best = Math.max(best, 4);
      else if (t.startsWith(q) || t.startsWith(qn)) best = Math.max(best, 3);
      else if (t.includes(q) || t.includes(qn)) best = Math.max(best, 2);
    }
    if (best) scored.push([best, item.cell]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].en.localeCompare(b[1].en));
  return scored.slice(0, limit).map((x) => x[1]);
}

export function subtypeLabel(cell) {
  const st = store.subtypes.get(cell.tissue_subtype);
  return st ? st.th : '';
}

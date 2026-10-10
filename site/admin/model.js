// โมเดลข้อมูลของหน้าแอดมิน (ไม่ผูกกับ DOM ใช้ทดสอบด้วย Node ได้)
//   dataset  = ข้อมูลต้นฉบับใน data/ ในรูปที่แก้ได้ {systems, tissues, cells[], edges{ไฟล์: {...}}, clTerms}
//   overlay  = การแก้ที่ยังไม่บันทึก (รายการ "รอบันทึก") ทำซ้ำได้: applyOverlay(base, overlay) → dataset ใหม่
// รูปแบบไฟล์ตรงกับ scripts/nexus.py (JSON ย่อหน้า 2 ช่อง ไม่ escape ภาษาไทย ปิดท้ายด้วยบรรทัดใหม่)

export const CELL_KEYS = [
  'id', 'slug', 'kind', 'en', 'th', 'systems', 'tissue', 'tissue_subtype',
  'location', 'morphology', 'function', 'secretes', 'markers', 'lifespan', 'exam', 'diseases',
  'confused_with', 'images', 'review', 'refs', 'en_content',
];
// ข้อความขึ้นต้นของหมายเหตุ "ทบทวนโดย AI" ใน refs (ต้องตรงกับ AI_REF_PREFIX ใน scripts/nexus.py) ตั้งค่าจาก th.json ตอนเริ่มโปรแกรม ไม่เขียนข้อความไทยในโค้ด
export let AI_REF_PREFIX = '';
export function configureModel({ aiRefPrefix }) { AI_REF_PREFIX = aiRefPrefix; }
export const REVIEW_LEVELS = ['draft', 'ai_reviewed', 'textbook'];
export const MODES = ['hormone', 'synapse', 'paracrine', 'support', 'immune'];
export const IMAGE_TYPES = ['micrograph', 'em', 'photo', 'illustration', 'diagram'];
export const LICENSES = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC0', 'Public domain', 'Own work'];
export const EDGE_ARRAYS = ['develops_from', 'is_a', 'interacts_with'];

export const toText = (obj) => JSON.stringify(obj, null, 2) + '\n';
const clone = (x) => (x === undefined ? x : structuredClone(x));

// ------------------------------------------------------------------ โหลด

export const PATH = {
  systems: 'data/systems.json',
  tissues: 'data/tissues.json',
  clTerms: 'data/generated/cl_terms.json',
  cells: (file) => `data/cells/${file}.json`,
  edges: (file) => `data/edges/${file}.json`,
};
export const SITE_IMAGES = 'site/images/';
export const repoImagePath = (src) => 'site/' + src;

// อ่านข้อมูลทั้งหมดผ่าน adapter คืน base = {head, shas, texts, dataset, files(รายการ path ทั้งหมดใน snapshot)}
export async function loadBase(adapter) {
  const snap = await adapter.snapshot();
  const shas = snap.files;
  const want = Object.keys(shas).filter((p) => p === PATH.systems || p === PATH.tissues || p === PATH.clTerms || /^data\/(cells|edges)\/[^/]+\.json$/.test(p));
  const texts = {};
  // อ่านทีละไม่เกิน 6 ไฟล์พร้อมกัน เพื่อไม่ให้ยิงคำขอพร้อมกันมากเกินไป
  for (let i = 0; i < want.length; i += 6) {
    await Promise.all(want.slice(i, i + 6).map(async (p) => {
      const raw = await adapter.readText(p, shas[p]);
      texts[p] = raw.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10)); // ไฟล์ที่ checkout บน Windows อาจเป็น CRLF
    }));
  }
  const dataset = { systems: [], tissues: [], cells: [], edges: {}, clTerms: {} };
  dataset.systems = JSON.parse(texts[PATH.systems]);
  dataset.tissues = JSON.parse(texts[PATH.tissues]);
  for (const p of want.sort()) {
    let m = p.match(/^data\/cells\/([^/]+)\.json$/);
    if (m) { for (const c of JSON.parse(texts[p])) { c._file = m[1]; dataset.cells.push(c); } continue; }
    m = p.match(/^data\/edges\/([^/]+)\.json$/);
    if (m) dataset.edges[m[1]] = JSON.parse(texts[p]);
  }
  if (texts[PATH.clTerms]) dataset.clTerms = JSON.parse(texts[PATH.clTerms]).terms || {};
  return { head: snap.head, shas, texts, dataset };
}

export const emptyOverlay = () => ({ version: 1, cells: {}, edges: {}, tissues: {} });
export const overlaySize = (o) => Object.keys(o.cells).length + Object.keys(o.edges).length + Object.keys(o.tissues).length;

// ------------------------------------------------------------------ เซลล์

// เรียงช่องตามมาตรฐาน (ช่องอื่นที่ไม่รู้จักต่อท้าย) และตัดช่องภายใน (_file)
export function normalizeCell(cell) {
  const out = {};
  for (const k of CELL_KEYS) if (k in cell && cell[k] !== undefined) out[k] = clone(cell[k]);
  for (const k of Object.keys(cell)) if (!(k in out) && !k.startsWith('_') && cell[k] !== undefined) out[k] = clone(cell[k]);
  return out;
}
export const cellJson = (cell) => JSON.stringify(normalizeCell(cell));
export const primarySystem = (cell) => (cell.systems || [])[0] || null;

export function slugify(en, taken = new Set()) {
  let base = String(en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cell';
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export function findCell(ds, id) { return ds.cells.find((c) => c.id === id) || null; }

// ------------------------------------------------------------------ เส้นใย

export const edgeKey = (kind, a, b) => `${kind}|${a}|${b}`;

// รายการเส้นทั้งหมดของ dataset ในรูปแบนราบ {kind, a, b, mode?, th?, file}
export function listEdges(ds) {
  const out = [];
  for (const [file, e] of Object.entries(ds.edges)) {
    for (const [a, b] of e.develops_from || []) out.push({ kind: 'develops_from', a, b, file });
    for (const [a, b] of e.is_a || []) out.push({ kind: 'is_a', a, b, file });
    for (const it of e.interacts_with || []) out.push({ kind: 'interacts_with', a: it.from, b: it.to, mode: it.mode, th: it.th, file });
  }
  return out;
}

function ensureEdgeFile(ds, file) {
  const e = (ds.edges[file] = ds.edges[file] || {});
  for (const k of EDGE_ARRAYS) if (!e[k]) e[k] = [];
  return e;
}

function removeEdge(ds, kind, a, b) {
  let n = 0;
  for (const e of Object.values(ds.edges)) {
    if (kind === 'interacts_with') {
      const before = (e.interacts_with || []).length;
      e.interacts_with = (e.interacts_with || []).filter((x) => !(x.from === a && x.to === b));
      n += before - e.interacts_with.length;
    } else {
      const before = (e[kind] || []).length;
      e[kind] = (e[kind] || []).filter((x) => !(x[0] === a && x[1] === b));
      n += before - e[kind].length;
    }
  }
  return n;
}

// ------------------------------------------------------------------ overlay → dataset

// คืน {dataset, cascade:{edges, confused}} cascade = สิ่งที่ถูกลบตามเมื่อลบเซลล์
export function applyOverlay(base, overlay) {
  const ds = clone(base.dataset);
  const cascade = { edges: [], confused: [] };

  for (const [id, item] of Object.entries(overlay.tissues || {})) {
    const i = ds.tissues.findIndex((t) => t.id === id);
    if (i >= 0) ds.tissues[i] = clone(item.tissue);
  }

  const deleted = [];
  for (const [id, item] of Object.entries(overlay.cells || {})) {
    const idx = ds.cells.findIndex((c) => c.id === id);
    if (!item.cell) {
      if (idx >= 0) ds.cells.splice(idx, 1);
      deleted.push(id);
      continue;
    }
    const next = normalizeCell(item.cell);
    const file = primarySystem(next) || (idx >= 0 ? ds.cells[idx]._file : 'other');
    next._file = file;
    if (idx < 0) ds.cells.push(next);
    else if (ds.cells[idx]._file === file) ds.cells[idx] = next;
    else { ds.cells.splice(idx, 1); ds.cells.push(next); }
  }
  // เรียงเซลล์ที่ย้ายไฟล์/เพิ่มใหม่ให้อยู่ท้ายไฟล์ตามลำดับเดิมของ cells (ลำดับในไฟล์คือลำดับใน ds.cells ที่ _file เดียวกัน)

  if (deleted.length) {
    const gone = new Set(deleted);
    for (const [file, e] of Object.entries(ds.edges)) {
      for (const kind of ['develops_from', 'is_a']) {
        e[kind] = (e[kind] || []).filter(([a, b]) => {
          if (gone.has(a) || gone.has(b)) { cascade.edges.push({ kind, a, b, file }); return false; }
          return true;
        });
      }
      e.interacts_with = (e.interacts_with || []).filter((x) => {
        if (gone.has(x.from) || gone.has(x.to)) { cascade.edges.push({ kind: 'interacts_with', a: x.from, b: x.to, mode: x.mode, th: x.th, file }); return false; }
        return true;
      });
    }
    for (const c of ds.cells) {
      if ((c.confused_with || []).some((r) => gone.has(r))) {
        for (const r of c.confused_with) if (gone.has(r)) cascade.confused.push({ id: c.id, ref: r });
        c.confused_with = c.confused_with.filter((r) => !gone.has(r));
      }
    }
  }

  const goneIds = new Set(deleted);
  for (const op of Object.values(overlay.edges || {})) {
    if (op.op === 'remove') { removeEdge(ds, op.kind, op.a, op.b); continue; }
    if (goneIds.has(op.a) || goneIds.has(op.b)) continue;
    const exists = listEdges(ds).some((x) => x.kind === op.kind && x.a === op.a && x.b === op.b);
    if (exists) continue;
    const src = findCell(ds, op.a);
    const file = (src && primarySystem(src)) || Object.keys(ds.edges)[0];
    const e = ensureEdgeFile(ds, file);
    if (op.kind === 'interacts_with') e.interacts_with.push({ from: op.a, to: op.b, th: op.th || '', mode: op.mode });
    else e[op.kind].push([op.a, op.b]);
  }
  return { dataset: ds, cascade };
}

// ------------------------------------------------------------------ dataset → ไฟล์

export function serializeDataset(ds) {
  const files = {};
  files[PATH.tissues] = toText(ds.tissues);
  const byFile = {};
  for (const c of ds.cells) (byFile[c._file] = byFile[c._file] || []).push(normalizeCell(c));
  for (const [f, list] of Object.entries(byFile)) files[PATH.cells(f)] = toText(list);
  for (const [f, e] of Object.entries(ds.edges)) files[PATH.edges(f)] = toText(e);
  return files;
}

// รูปที่เซลล์/เนื้อเยื่อใน dataset อ้างถึง เป็น path ใน repo (เฉพาะไฟล์ในเว็บ ไม่นับลิงก์ภายนอก)
export function referencedImagePaths(ds) {
  const out = new Set();
  for (const o of [...ds.cells, ...ds.tissues]) {
    for (const img of o.images || []) if (img && typeof img.src === 'string' && !/^https?:\/\//i.test(img.src)) out.add(repoImagePath(img.src));
  }
  return out;
}

// ชุดการเปลี่ยนแปลงไฟล์ทั้งหมดที่ต้อง commit
//   pendingBlobs: Map path(ใน repo) → Blob/Uint8Array ของรูปที่เพิ่มใหม่
// คืน {files:[{path, kind:'text'|'blob'|'delete', text?, blob?}]}
export function buildChangeSet(base, finalDs, pendingBlobs = new Map()) {
  const files = [];
  const next = serializeDataset(finalDs);
  for (const [path, text] of Object.entries(next)) {
    if (base.texts[path] !== text) files.push({ path, kind: 'text', text, isNew: !(path in base.texts) });
  }
  const before = referencedImagePaths(base.dataset);
  const after = referencedImagePaths(finalDs);
  for (const p of after) {
    if (!(p in base.shas) && pendingBlobs.has(p)) files.push({ path: p, kind: 'blob', blob: pendingBlobs.get(p), isNew: true });
  }
  for (const p of before) {
    if (!after.has(p) && p in base.shas) files.push({ path: p, kind: 'delete' });
  }
  return { files };
}

export function nextImagePath(dir, type, takenRepoPaths, ext = 'webp') {
  for (let n = 1; ; n++) {
    const src = `images/${dir}/${type}-${n}.${ext}`;
    if (!takenRepoPaths.has(repoImagePath(src))) return src;
  }
}

// ------------------------------------------------------------------ diff

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function diffCell(before, after) {
  const fields = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})].filter((k) => !k.startsWith('_')));
  for (const k of keys) if (!same(before && before[k], after && after[k])) fields.push({ key: k, before: before ? before[k] : undefined, after: after ? after[k] : undefined });
  return fields;
}

// สรุปเทียบ base กับผลสุดท้าย แยกตามรายการใน overlay เพื่อให้ยกเลิกทีละรายการได้
export function buildItems(base, overlay, cascade) {
  const items = [];
  for (const [id, it] of Object.entries(overlay.cells || {})) {
    const before = findCell(base.dataset, id);
    const name = (it.cell && (it.cell.th || it.cell.en)) || (before && (before.th || before.en)) || id;
    if (!it.cell) {
      items.push({ key: 'cell:' + id, type: 'cell', op: 'delete', id, name, fields: [], cascade });
    } else if (!before) {
      items.push({ key: 'cell:' + id, type: 'cell', op: 'add', id, name, fields: diffCell(null, normalizeCell(it.cell)) });
    } else {
      items.push({ key: 'cell:' + id, type: 'cell', op: 'change', id, name, fields: diffCell(normalizeCell(before), normalizeCell(it.cell)) });
    }
  }
  for (const [id, it] of Object.entries(overlay.tissues || {})) {
    const before = base.dataset.tissues.find((t) => t.id === id);
    items.push({ key: 'tissue:' + id, type: 'tissue', op: 'change', id, name: it.tissue.th || id, fields: diffCell(before, it.tissue) });
  }
  for (const [k, e] of Object.entries(overlay.edges || {})) {
    items.push({ key: 'edge:' + k, type: 'edge', op: e.op, id: k, edge: e, name: '' });
  }
  return items;
}

export function imageChanges(base, finalDs) {
  const before = referencedImagePaths(base.dataset);
  const after = referencedImagePaths(finalDs);
  return {
    added: [...after].filter((p) => !before.has(p)),
    removed: [...before].filter((p) => !after.has(p)),
  };
}

// ข้อความ commit อัตโนมัติ เช่น "admin: แก้ neutrophil, เพิ่มรูป 2 รูป" (คำไทยมาจากพจนานุกรมที่ส่งเข้ามา)
export function autoMessage(items, imgs, words) {
  const nm = (it) => it.name;
  const parts = [];
  const by = (type, op) => items.filter((i) => i.type === type && i.op === op);
  const list = (xs) => xs.slice(0, 3).map(nm).join(', ') + (xs.length > 3 ? ` +${xs.length - 3}` : '');
  const add = by('cell', 'add'), chg = by('cell', 'change'), del = by('cell', 'delete');
  if (add.length) parts.push(`${words.add} ${list(add)}`);
  if (chg.length) parts.push(`${words.edit} ${list(chg)}`);
  if (del.length) parts.push(`${words.del} ${list(del)}`);
  const tis = items.filter((i) => i.type === 'tissue');
  if (tis.length) parts.push(`${words.edit} ${list(tis)}`);
  const edges = items.filter((i) => i.type === 'edge');
  if (edges.length) parts.push(`${words.edges} ${edges.length}`);
  if (imgs.added.length) parts.push(`${words.imgAdd} ${imgs.added.length} ${words.imgUnit}`);
  if (imgs.removed.length) parts.push(`${words.imgDel} ${imgs.removed.length} ${words.imgUnit}`);
  return 'admin: ' + (parts.join(', ') || words.none);
}

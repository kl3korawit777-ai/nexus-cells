// สถานะของหน้าแอดมิน: ข้อมูลที่โหลดมา (base) + การแก้ที่รอบันทึก (overlay) + รูปที่รออัปโหลด (blobs)
// รายการรอบันทึกเก็บใน IndexedDB ปิดหน้าไปแล้วเปิดใหม่ยังอยู่ (แยกตาม repo@branch)

import * as model from './model.js';
import { validateDataset, errorsOf } from './validate.js';
import { ConflictError } from './adapters.js';
import { fillStore } from '../js/data.js';
import { setAssetResolver } from '../js/images.js';

export const S = {
  adapter: null,
  who: { login: '', name: '' },
  scope: '',
  base: null,
  overlay: model.emptyOverlay(),
  blobs: new Map(), // path ใน repo → Blob (รูปที่เพิ่มใหม่ ยังไม่ commit)
  working: null, // {dataset, cascade}
  issues: [], // ผลตรวจทั้งชุดข้อมูลหลังรวมการแก้
  conflicts: new Set(), // key ของรายการที่ repo เปลี่ยนไปจากตอนแก้
  persistOk: true,
};

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

// ---------------------------------------------------------------- IndexedDB (ครอบ try/catch ทุกครั้ง)

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open('nexus-admin', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('pending'); req.result.createObjectStore('blobs'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }
  return dbp;
}
async function idb(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(r && r.result);
    tx.onerror = () => reject(tx.error);
  });
}
async function persist() {
  try {
    await idb('pending', 'readwrite', (s) => s.put({ overlay: S.overlay, head: S.base && S.base.head }, S.scope));
    S.persistOk = true;
  } catch { S.persistOk = false; }
}
async function persistBlob(path, blob) {
  try { await idb('blobs', 'readwrite', (s) => (blob ? s.put(blob, S.scope + '|' + path) : s.delete(S.scope + '|' + path))); } catch { S.persistOk = false; }
}
async function restore() {
  try {
    const saved = await idb('pending', 'readonly', (s) => s.get(S.scope));
    if (saved && saved.overlay) S.overlay = saved.overlay;
    const keys = await idb('blobs', 'readonly', (s) => s.getAllKeys());
    for (const k of keys || []) {
      if (!String(k).startsWith(S.scope + '|')) continue;
      const blob = await idb('blobs', 'readonly', (s) => s.get(k));
      if (blob) S.blobs.set(String(k).slice(S.scope.length + 1), blob);
    }
  } catch { S.persistOk = false; }
}
async function clearPersisted() {
  try {
    await idb('pending', 'readwrite', (s) => s.delete(S.scope));
    const keys = await idb('blobs', 'readonly', (s) => s.getAllKeys());
    for (const k of keys || []) if (String(k).startsWith(S.scope + '|')) await idb('blobs', 'readwrite', (s) => s.delete(k));
  } catch { /* ไม่มี IndexedDB ก็ไม่มีอะไรให้ล้าง */ }
}

// ---------------------------------------------------------------- รูปที่รออัปโหลด (แสดงตัวอย่างด้วย blob:)

const blobUrls = new Map();
function blobUrl(path) {
  if (!S.blobs.has(path)) return null;
  if (!blobUrls.has(path)) blobUrls.set(path, URL.createObjectURL(S.blobs.get(path)));
  return blobUrls.get(path);
}
setAssetResolver((src) => (/^https?:\/\//i.test(src) ? src : blobUrl(model.repoImagePath(src)) || '../' + src));

export async function addBlob(path, blob) {
  S.blobs.set(path, blob);
  if (blobUrls.has(path)) { URL.revokeObjectURL(blobUrls.get(path)); blobUrls.delete(path); }
  await persistBlob(path, blob);
}
export async function dropBlob(path) {
  S.blobs.delete(path);
  if (blobUrls.has(path)) { URL.revokeObjectURL(blobUrls.get(path)); blobUrls.delete(path); }
  await persistBlob(path, null);
}
export const pendingImageUrl = blobUrl;

// ---------------------------------------------------------------- คำนวณข้อมูลที่กำลังแก้

const OBO = 'http://purl.obolibrary.org/obo/';

// แปลง dataset เป็นรูปแบบเดียวกับ nexus.json เพื่อใช้ components ของเว็บหลักแสดงตัวอย่าง
export function toStoreData(ds) {
  const cells = ds.cells.map((c) => {
    const o = model.normalizeCell(c);
    o.verified = c.review === 'textbook';
    o.purl = OBO + c.id.replace(':', '_');
    const t = ds.clTerms[c.id];
    o.cl = t && t.found ? { label: t.label, definition: t.definition, synonyms: t.synonyms, obsolete: t.obsolete } : null;
    return o;
  });
  const edges = model.listEdges(ds).map((e) => (e.kind === 'interacts_with'
    ? { type: e.kind, from: e.a, to: e.b, th: e.th || '', mode: e.mode, source: 'curated', file: e.file }
    : { type: e.kind, from: e.a, to: e.b, source: 'curated', file: e.file }));
  const images = [...cells, ...ds.tissues].reduce((n, x) => n + ((x.images || []).length), 0);
  return { meta: { data_version: 'admin', stats: { images } }, systems: ds.systems, tissues: ds.tissues, cells, edges };
}

export function fillPreviewStore(ds) { fillStore(toStoreData(ds)); }

export function recompute() {
  S.working = model.applyOverlay(S.base, S.overlay);
  const fileExists = (p) => p in S.base.shas || S.blobs.has(p);
  S.issues = validateDataset(S.working.dataset, { fileExists });
  fillPreviewStore(S.working.dataset);
  emit();
}

function detectConflicts() {
  S.conflicts = new Set();
  for (const [id, it] of Object.entries(S.overlay.cells)) {
    const cur = model.findCell(S.base.dataset, id);
    const curJson = cur ? model.cellJson(cur) : null;
    if ((it.base || null) !== curJson) S.conflicts.add('cell:' + id);
  }
  for (const [id, it] of Object.entries(S.overlay.tissues)) {
    const cur = S.base.dataset.tissues.find((t) => t.id === id);
    if ((it.base || null) !== JSON.stringify(cur || null)) S.conflicts.add('tissue:' + id);
  }
}

// ---------------------------------------------------------------- เชื่อมต่อ / โหลดใหม่

export async function connect(adapter, who) {
  S.adapter = adapter;
  S.who = who || { login: '', name: '' };
  S.scope = adapter.label;
  S.overlay = model.emptyOverlay();
  S.blobs = new Map();
  S.base = await model.loadBase(adapter);
  await restore();
  detectConflicts();
  recompute();
}

// โหลดข้อมูลจาก repo ใหม่ แล้วนำการแก้ที่รอบันทึกกลับมาใส่ (รายการที่ repo เปลี่ยนไปจะถูกทำเครื่องหมายว่าชนกัน)
export async function reload() {
  S.base = await model.loadBase(S.adapter);
  detectConflicts();
  recompute();
  await persist();
}

export function disconnect() {
  S.adapter = null; S.base = null; S.working = null; S.overlay = model.emptyOverlay(); S.blobs = new Map(); S.issues = []; S.conflicts = new Set();
  emit();
}

// ---------------------------------------------------------------- แก้ไข

export const currentCell = (id) => model.findCell(S.working.dataset, id);
export const baseCell = (id) => model.findCell(S.base.dataset, id);

// ตั้งค่าเซลล์ (cell = null คือลบ) ถ้าเหมือนต้นฉบับจะเอารายการออกจากรอบบันทึก
export async function setCell(id, cell) {
  const orig = baseCell(id);
  const origJson = orig ? model.cellJson(orig) : null;
  if (!cell) {
    // เส้นที่เพิ่มรอบันทึกไว้และอ้างถึงเซลล์ที่กำลังจะลบ ไม่มีความหมายแล้ว
    for (const [k, e] of Object.entries(S.overlay.edges)) if (e.op === 'add' && (e.a === id || e.b === id)) delete S.overlay.edges[k];
  }
  if (cell && orig && model.cellJson(cell) === origJson) delete S.overlay.cells[id];
  else S.overlay.cells[id] = { cell: cell ? model.normalizeCell(cell) : null, base: origJson };
  S.conflicts.delete('cell:' + id);
  recompute();
  await persist();
}

export async function setTissue(id, tissue) {
  const orig = S.base.dataset.tissues.find((t) => t.id === id);
  if (JSON.stringify(orig) === JSON.stringify(tissue)) delete S.overlay.tissues[id];
  else S.overlay.tissues[id] = { tissue, base: JSON.stringify(orig || null) };
  S.conflicts.delete('tissue:' + id);
  recompute();
  await persist();
}

// เพิ่ม/ลบเส้น: ถ้าสวนกับรายการรอบบันทึกที่มีอยู่ ให้ยกเลิกรายการนั้นแทน
export async function addEdge(edge) {
  const key = model.edgeKey(edge.kind, edge.a, edge.b);
  const o = S.overlay.edges[key];
  if (o && o.op === 'remove') delete S.overlay.edges[key];
  else S.overlay.edges[key] = { op: 'add', ...edge };
  recompute();
  await persist();
}
export async function removeEdge(edge) {
  const key = model.edgeKey(edge.kind, edge.a, edge.b);
  const o = S.overlay.edges[key];
  if (o && o.op === 'add') delete S.overlay.edges[key];
  else S.overlay.edges[key] = { op: 'remove', kind: edge.kind, a: edge.a, b: edge.b };
  recompute();
  await persist();
}

export async function cancelItem(key) {
  const [type, ...rest] = key.split(':');
  const id = rest.join(':');
  if (type === 'cell') delete S.overlay.cells[id];
  else if (type === 'tissue') delete S.overlay.tissues[id];
  else if (type === 'edge') delete S.overlay.edges[id];
  S.conflicts.delete(key);
  recompute();
  await persist();
}

// ชนกัน: เก็บของฉัน (เขียนทับของใน repo) = ปรับฐานให้เป็นของ repo ตอนนี้
export async function keepMine(key) {
  const [type, ...rest] = key.split(':');
  const id = rest.join(':');
  if (type === 'cell') { const cur = baseCell(id); S.overlay.cells[id].base = cur ? model.cellJson(cur) : null; }
  if (type === 'tissue') { const cur = S.base.dataset.tissues.find((t) => t.id === id); S.overlay.tissues[id].base = JSON.stringify(cur || null); }
  S.conflicts.delete(key);
  recompute();
  await persist();
}

export const itemCount = () => model.overlaySize(S.overlay);
export const hasErrors = () => errorsOf(S.issues).length > 0;

export function summary() {
  const items = model.buildItems(S.base, S.overlay, S.working.cascade);
  const imgs = model.imageChanges(S.base, S.working.dataset);
  return { items, imgs };
}

// ---------------------------------------------------------------- บันทึกและเผยแพร่

export async function publish(message) {
  if (hasErrors()) throw new Error('validation');
  if (S.conflicts.size) throw new Error('conflicts');
  const { files } = model.buildChangeSet(S.base, S.working.dataset, S.blobs);
  if (!files.length) throw new Error('empty');
  const expected = {};
  for (const f of files) expected[f.path] = S.base.shas[f.path] || null;
  const res = await S.adapter.commit({ message, base: S.base.head, expected, changes: files });
  // commit สำเร็จ: ล้างรอบบันทึก แล้วโหลดฐานใหม่
  S.overlay = model.emptyOverlay();
  for (const p of [...S.blobs.keys()]) await dropBlob(p);
  await clearPersisted();
  S.conflicts = new Set();
  S.base = await model.loadBase(S.adapter);
  recompute();
  return res;
}

export { ConflictError };

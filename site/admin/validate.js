// ตรวจข้อมูลในเบราว์เซอร์ ตามกฎเดียวกับ scripts/nexus.py validate (ไม่ผูกกับ DOM ใช้ทดสอบด้วย Node ได้)
// ผลลัพธ์เป็น {level, code, id, field, params} ไม่มีข้อความ ให้ UI แปลงเป็นข้อความไทยจากรหัส (v.<code> ใน th.json)

import { AI_REF_PREFIX, IMAGE_TYPES, LICENSES, MODES, REVIEW_LEVELS, listEdges, repoImagePath } from './model.js';

export const CL_RE = /^CL:\d{7}$/;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// ตรงกับ HTML_TAG_RE ใน nexus.py
export const HTML_TAG_RE = /<\s*\/?\s*[A-Za-z!?]|javascript\s*:/i;
const EN_CELL_FIELDS = ['location', 'morphology', 'function', 'exam'];
const STRING_FIELDS = ['location', 'morphology', 'function', 'lifespan', 'exam'];
const LIST_FIELDS = ['secretes', 'markers', 'diseases', 'refs', 'confused_with'];
const IMAGE_REQUIRED = ['src', 'type', 'alt_th', 'credit', 'license'];
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

function* walkStrings(obj, path = '') {
  if (typeof obj === 'string') yield [path, obj];
  else if (Array.isArray(obj)) for (let i = 0; i < obj.length; i++) yield* walkStrings(obj[i], `${path}[${i}]`);
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) yield* walkStrings(v, path ? `${path}.${k}` : k);
  }
}

export function findCycle(pairs) {
  const graph = new Map();
  for (const [a, b] of pairs) { if (!graph.has(a)) graph.set(a, []); graph.get(a).push(b); }
  const state = new Map();
  for (const start of graph.keys()) {
    if (state.has(start)) continue;
    const stack = [[start, 0]];
    const trail = [start];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [node, i] = top;
      const nb = graph.get(node) || [];
      if (i >= nb.length) { state.set(node, 2); stack.pop(); trail.pop(); continue; }
      top[1]++;
      const nxt = nb[i];
      if (state.get(nxt) === 1) return [...trail.slice(trail.indexOf(nxt)), nxt];
      if (!state.has(nxt)) { state.set(nxt, 1); stack.push([nxt, 0]); trail.push(nxt); }
    }
  }
  return null;
}

// checkImages: ตรวจรูปของเซลล์/เนื้อเยื่อหนึ่งรายการ ctx.fileExists(pathใน repo) ใช้เช็กว่าไฟล์รูปมีจริง (รวมรูปที่รอบันทึก)
function checkImages(obj, who, out, seen, ctx) {
  const push = (code, field, params) => out.push({ level: 'error', code, ...who, field, params });
  const imgs = obj.images;
  if (imgs == null) return push('imagesMissing', 'images');
  if (!Array.isArray(imgs)) return push('imagesList', 'images');
  imgs.forEach((img, i) => {
    const field = `images[${i}]`;
    const p = { n: i + 1 };
    if (!img || typeof img !== 'object') return push('imgObject', field, p);
    for (const k of IMAGE_REQUIRED) if (isEmpty(img[k])) push('imgRequired', `${field}.${k}`, { ...p, field: k });
    for (const k of ['caption_th', 'caption_en', 'stain', 'magnification', 'source']) {
      if (img[k] != null && typeof img[k] !== 'string') push('imgString', `${field}.${k}`, { ...p, field: k });
    }
    if (img.quiz != null && typeof img.quiz !== 'boolean') push('imgQuiz', `${field}.quiz`, p);
    if (img.type && !IMAGE_TYPES.includes(img.type)) push('imgType', `${field}.type`, p);
    if (img.license && !LICENSES.includes(img.license)) out.push({ level: 'warning', code: 'imgLicenseOther', ...who, field: `${field}.license`, params: p });
    if (!isEmpty(img.source) && !(typeof img.source === 'string' && img.source.startsWith('https://'))) push('imgSourceHttps', `${field}.source`, p);
    const src = img.src;
    if (typeof src !== 'string' || !src) return;
    if (seen.has(src)) push('imgSrcDup', `${field}.src`, { ...p, src });
    seen.add(src);
    if (/^https?:\/\//i.test(src)) {
      if (!src.toLowerCase().startsWith('https://')) push('imgSrcHttps', `${field}.src`, p);
      if (isEmpty(img.source)) push('imgSourceNeeded', `${field}.source`, p);
    } else if (!/^images\/[A-Za-z0-9._\-/]+$/.test(src) || src.includes('..')) {
      push('imgSrcPath', `${field}.src`, { ...p, src });
    } else if (ctx.fileExists && !ctx.fileExists(repoImagePath(src))) {
      push('imgFile', `${field}.src`, { ...p, src });
    }
  });
}

// ds = dataset จาก model.js; ctx = {fileExists?}
export function validateDataset(ds, ctx = {}) {
  const out = [];
  const err = (code, who, field, params) => out.push({ level: 'error', code, ...who, field, params });
  const warn = (code, who, field, params) => out.push({ level: 'warning', code, ...who, field, params });

  const systemIds = new Set(ds.systems.map((s) => s.id));
  const subtypes = new Map(ds.tissues.map((t) => [t.id, new Set((t.subtypes || []).map((s) => s.id))]));
  const seen = new Set();

  for (const t of ds.tissues) checkImages(t, { id: null, tissue: t.id }, out, seen, ctx);

  const ids = new Set();
  const slugs = new Map();
  for (const c of ds.cells) {
    const who = { id: c.id };
    if (typeof c.id !== 'string' || !CL_RE.test(c.id)) err('idFormat', who, 'id');
    if (ids.has(c.id)) err('idDup', who, 'id');
    ids.add(c.id);
    if (typeof c.slug !== 'string' || !SLUG_RE.test(c.slug)) err('slugFormat', who, 'slug');
    if (slugs.has(c.slug)) err('slugDup', who, 'slug', { other: slugs.get(c.slug) });
    slugs.set(c.slug, c.id);
    if (c.kind !== 'cell' && c.kind !== 'class') err('kind', who, 'kind');
    for (const k of ['en', 'th']) if (isEmpty(c[k])) err('required', who, k, { field: k });
    if (isEmpty(c.systems)) err('systemsEmpty', who, 'systems');
    for (const s of c.systems || []) if (!systemIds.has(s)) err('systemUnknown', who, 'systems', { system: s });
    if (!isEmpty(c.tissue)) {
      if (!subtypes.has(c.tissue)) err('tissueUnknown', who, 'tissue', { tissue: c.tissue });
      else if (c.tissue_subtype != null && c.tissue_subtype !== '' && !subtypes.get(c.tissue).has(c.tissue_subtype)) err('subtypeUnknown', who, 'tissue_subtype', { sub: c.tissue_subtype });
    }
    for (const k of STRING_FIELDS) if (c[k] != null && typeof c[k] !== 'string') err('mustBeString', who, k, { field: k });
    for (const k of LIST_FIELDS) {
      if (c[k] != null && !(Array.isArray(c[k]) && c[k].every((x) => typeof x === 'string' && x.trim()))) err('listOfStrings', who, k, { field: k });
    }
    if (c.en_content != null) {
      if (typeof c.en_content !== 'object' || Array.isArray(c.en_content)) err('enContentObject', who, 'en_content');
      else {
        for (const [k, v] of Object.entries(c.en_content)) {
          if (!EN_CELL_FIELDS.includes(k)) err('enContentField', who, `en_content.${k}`, { field: k });
          else if (typeof v !== 'string' || !v.trim()) err('enContentEmpty', who, `en_content.${k}`, { field: k });
          else if (/[\u0E00-\u0E7F]/.test(v)) warn('enContentThai', who, `en_content.${k}`, { field: k });
        }
      }
    }
    if ('verified' in c) err('verifiedOld', who, 'verified');
    if (!REVIEW_LEVELS.includes(c.review)) err('review', who, 'review');
    else if (c.review === 'textbook' && !(c.refs || []).some((r) => !r.startsWith(AI_REF_PREFIX))) err('textbookNeedsRef', who, 'refs');
    checkImages(c, who, out, seen, ctx);
    for (const [path, text] of walkStrings(c)) {
      if (HTML_TAG_RE.test(text)) err('html', who, path.replace(/\[\d+\]$/, ''), { path });
    }
  }
  for (const t of ds.tissues) {
    for (const [path, text] of walkStrings(t)) if (HTML_TAG_RE.test(text)) err('html', { id: null, tissue: t.id }, path, { path });
  }

  for (const c of ds.cells) {
    const who = { id: c.id };
    for (const ref of c.confused_with || []) {
      if (!ids.has(ref)) err('confusedUnknown', who, 'confused_with', { ref });
      else if (ref === c.id) err('confusedSelf', who, 'confused_with');
    }
  }

  const seenEdge = new Set();
  for (const [file, e] of Object.entries(ds.edges)) {
    for (const kind of ['develops_from', 'is_a']) {
      for (const item of e[kind] || []) {
        if (!(Array.isArray(item) && item.length === 2)) { err('edgeShape', { id: null, edgeFile: file }, kind, { kind }); continue; }
        checkEdge(kind, item[0], item[1], file, ids, seenEdge, err);
      }
    }
    for (const item of e.interacts_with || []) {
      if (!item || typeof item !== 'object' || !('from' in item) || !('to' in item)) { err('edgeShape', { id: null, edgeFile: file }, 'interacts_with', { kind: 'interacts_with' }); continue; }
      if (!MODES.includes(item.mode)) err('edgeMode', { id: item.from, edgeFile: file }, 'mode', { a: item.from, b: item.to });
      if (isEmpty(item.th)) warn('edgeTh', { id: item.from, edgeFile: file }, 'th', { a: item.from, b: item.to });
      checkEdge('interacts_with', item.from, item.to, file, ids, seenEdge, err);
      for (const [path, text] of walkStrings(item)) if (HTML_TAG_RE.test(text)) err('html', { id: item.from, edgeFile: file }, path, { path });
    }
  }
  for (const kind of ['develops_from', 'is_a']) {
    const pairs = listEdges(ds).filter((x) => x.kind === kind).map((x) => [x.a, x.b]);
    const cyc = findCycle(pairs);
    if (cyc) err('edgeCycle', { id: cyc[0] }, kind, { kind, path: cyc.join(' → ') });
  }
  return out;
}

function checkEdge(kind, a, b, file, ids, seen, err) {
  const who = { id: a, edgeFile: file };
  for (const x of [a, b]) if (!ids.has(x)) err('edgeUnknown', who, kind, { kind, ref: x });
  if (a === b) err('edgeSelf', who, kind, { kind, ref: a });
  const key = `${kind}|${a}|${b}`;
  if (seen.has(key)) err('edgeDup', who, kind, { kind, a, b });
  seen.add(key);
}

export const errorsOf = (list) => list.filter((x) => x.level === 'error');
export const forCell = (list, id) => list.filter((x) => x.id === id);

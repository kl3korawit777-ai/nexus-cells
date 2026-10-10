// สร้างคำถามปรนัย 4 ตัวเลือกจากข้อมูล (ไม่แตะ DOM ทดสอบได้ใน Node: scripts/test-quiz.mjs)
//
// หลักการ: ทุกคำถามมาจาก "spec" หนึ่งอัน ซึ่งมีคำตอบถูกและเงื่อนไข wrongPred
// ที่ตัวเลือกผิดทุกตัวต้องผ่าน (ไม่ตรงกับคำใบ้จริง ๆ) ถ้าหาตัวเลือกผิดไม่ครบ 3 ตัวจะข้ามคำถามนั้น
// ข้อความที่แสดงเป็นหน้าที่ของ UI (engine ส่งแค่ promptKey, params และ clue)

import { mulberry32 } from './overview-layout.js';
import { textOf, listOf, nameOf, hasThai } from './content.js';
import { quizImagesOf } from './images.js';

export const TYPES = ['morphology', 'secretes', 'marker', 'develops_from', 'tissue', 'interacts', 'image'];
export const OPTION_COUNT = 4;

// ------------------------------------------------------------------ ตัวช่วย

export const makeRng = (seed) => mulberry32(seed >>> 0);

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ตัวแยกคำ: เครื่องหมายวรรคตอน "และ" (ภาษาไทย) และ "and" ประกอบด้วยรหัสอักขระเพื่อไม่ให้มีอักษรไทยในโค้ด
const SPLIT_RE = new RegExp('[()/,;]|\\s' + String.fromCharCode(0x0e41, 0x0e25, 0x0e30) + '\\s|\\sand\\s');

// แยกรายการ เช่น "ADH (vasopressin)" เป็นคำสำคัญ ["adh", "vasopressin"]
export function tokensOf(item) {
  return norm(item)
    .split(SPLIT_RE)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);
}

// คำสำคัญแบบ ASCII ต้องตรงทั้งคำ (กัน cd4 ไปตรงกับ cd45ro) ส่วนภาษาไทยใช้การมีอยู่ในข้อความ
function mentions(text, token) {
  if (!token) return false;
  if (/^[a-z0-9\-+ ]+$/.test(token)) {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)').test(text);
  }
  return text.includes(token);
}

// ความคล้ายของข้อความแบบ trigram (ใช้ได้กับภาษาไทยที่ไม่มีเว้นวรรค)
function trigrams(s) {
  const t = norm(s).replace(/\s/g, '');
  const set = new Set();
  for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3));
  return set;
}
export function similarity(a, b) {
  const A = trigrams(a), B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// ------------------------------------------------------------------ บริบท (ดัชนีจากข้อมูล)

export function buildContext(data, lang = 'th') {
  const byId = new Map(data.cells.map((c) => [c.id, c]));
  const realCells = data.cells.filter((c) => c.kind === 'cell');
  const tissuesById = new Map(data.tissues.map((t) => [t.id, t]));

  const isaParents = new Map(), isaChildren = new Map(), devParents = new Map(), devChildren = new Map(), partners = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  for (const e of data.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    if (e.type === 'is_a') { add(isaParents, e.from, e.to); add(isaChildren, e.to, e.from); }
    else if (e.type === 'develops_from') { add(devParents, e.from, e.to); add(devChildren, e.to, e.from); }
    else if (e.type === 'interacts_with') { add(partners, e.from, e.to); add(partners, e.to, e.from); }
  }
  const closure = (start, m) => {
    const seen = new Set(), stack = [...(m.get(start) || [])];
    while (stack.length) {
      const x = stack.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      for (const y of m.get(x) || []) stack.push(y);
    }
    return seen;
  };

  // ข้อความทั้งหมดของเซลล์ (ไทย+อังกฤษ) ไว้ตรวจว่าตัวเลือกผิด "ไม่เอ่ยถึง" คำใบ้
  const fulltext = new Map();
  for (const c of data.cells) {
    const parts = [c.location, c.morphology, c.function, c.exam, c.lifespan,
      ...(c.secretes || []), ...(c.markers || []), ...(c.diseases || [])];
    if (c.en_content) parts.push(...Object.values(c.en_content).flat());
    if (c.cl && c.cl.definition) parts.push(c.cl.definition);
    fulltext.set(c.id, norm(parts.filter(Boolean).join(' | ')));
  }

  const ctx = {
    data, lang, byId, realCells, tissuesById, partners, fulltext,
    devParents, isaParents, isaChildren,
    devAncestors: (id) => closure(id, devParents),
    devDescendants: (id) => closure(id, devChildren),
    isaRelated: (a, b) => closure(a, isaParents).has(b) || closure(b, isaParents).has(a),
  };
  const cache = new Map();
  ctx.isaRelated = (a, b) => {
    const k = a + '>' + b;
    if (!cache.has(k)) cache.set(k, closure(a, isaParents).has(b) || closure(b, isaParents).has(a));
    return cache.get(k);
  };
  return ctx;
}

// ------------------------------------------------------------------ spec ต่อประเภท

const verifiedOf = (c) => c.verified === true;

// คืนรายการ spec ที่เป็นไปได้ของเซลล์ subject สำหรับประเภทนี้
export function enumerateSpecs(ctx, type, subject) {
  const { lang } = ctx;
  const out = [];
  const base = { type, subject, optionKind: 'cell', exclude: new Set([subject.id]), avoidIsa: true };

  if (type === 'morphology') {
    const m = textOf(subject, 'morphology', lang);
    if (!m.text || m.thaiOnly) return out;
    out.push({
      ...base, key: `morphology:${subject.id}`, answerId: subject.id, promptKey: 'quiz.q.morphology',
      clue: { kind: 'text', text: m.text },
      // ตัวเลือกผิดต้องไม่มีลักษณะเหมือนข้อความที่ให้มา
      truth: (c) => c.id === subject.id,
      wrongPred: (c) => {
        const mt = [c.morphology, c.en_content && c.en_content.morphology].filter(Boolean);
        return mt.every((x) => norm(x) !== norm(m.text) && similarity(x, m.text) < 0.5);
      },
    });
  } else if (type === 'secretes' || type === 'marker') {
    const field = type === 'secretes' ? 'secretes' : 'markers';
    const { items } = listOf(subject, field, lang);
    for (const item of items) {
      if (lang === 'en' && hasThai(item)) continue;
      const toks = tokensOf(item);
      if (!toks.length) continue;
      // marker: เซลล์ที่อยู่สายเดียวกัน (ต้นกำเนิด/เซลล์ลูก) มักมี marker เดียวกัน จึงไม่ใช้เป็นตัวเลือกผิด
      const lineage = type === 'marker' ? new Set([...ctx.devAncestors(subject.id), ...ctx.devDescendants(subject.id)]) : new Set();
      const hit = (c) => toks.some((t) => mentions(ctx.fulltext.get(c.id) || '', t)) || lineage.has(c.id);
      out.push({
        ...base, key: `${type}:${subject.id}:${norm(item)}`, answerId: subject.id,
        promptKey: type === 'secretes' ? 'quiz.q.secretes' : 'quiz.q.marker',
        clue: { kind: 'term', text: item }, tokens: toks,
        truth: (c) => c.id === subject.id || hit(c),
        wrongPred: (c) => !hit(c),
      });
    }
  } else if (type === 'develops_from') {
    const parents = [...(ctx.devParents.get(subject.id) || [])].map((id) => ctx.byId.get(id)).filter((c) => c && c.kind === 'cell');
    if (!parents.length) return out;
    const anc = ctx.devAncestors(subject.id);
    const desc = ctx.devDescendants(subject.id);
    for (const p of parents) {
      out.push({
        ...base, key: `develops_from:${subject.id}:${p.id}`, answerId: p.id, anchorId: p.id,
        promptKey: 'quiz.q.develops_from', promptParams: { cellId: subject.id },
        clue: { kind: 'cell', cellId: subject.id },
        exclude: new Set([subject.id, p.id]),
        truth: (c) => anc.has(c.id),
        // ตัวเลือกผิดต้องไม่ใช่ต้นกำเนิดใด ๆ ของเซลล์นี้ (ตรง ๆ หรือย้อนหลายขั้น)
        wrongPred: (c) => !anc.has(c.id) && !desc.has(c.id),
      });
    }
  } else if (type === 'tissue') {
    if (!subject.tissue || !ctx.tissuesById.has(subject.tissue)) return out;
    out.push({
      ...base, key: `tissue:${subject.id}`, optionKind: 'tissue', answerId: subject.tissue,
      promptKey: 'quiz.q.tissue', promptParams: { cellId: subject.id },
      clue: { kind: 'cell', cellId: subject.id },
      truth: (tid) => tid === subject.tissue,
      wrongPred: (tid) => tid !== subject.tissue,
    });
  } else if (type === 'interacts') {
    for (const e of ctx.data.edges) {
      if (e.type !== 'interacts_with' || !e.mode) continue;
      const out_ = e.from === subject.id, in_ = e.to === subject.id;
      if (!out_ && !in_) continue;
      const partner = ctx.byId.get(out_ ? e.to : e.from);
      if (!partner || partner.kind !== 'cell') continue;
      const known = ctx.partners.get(subject.id) || new Set();
      out.push({
        ...base, key: `interacts:${e.from}:${e.to}:${e.mode}`, answerId: partner.id, anchorId: partner.id,
        promptKey: out_ ? 'quiz.q.interacts_out' : 'quiz.q.interacts_in',
        promptParams: { cellId: subject.id, mode: e.mode },
        clue: { kind: 'cell', cellId: subject.id },
        edge: e, exclude: new Set([subject.id, partner.id]),
        truth: (c) => known.has(c.id),
        // ตัวเลือกผิดต้องไม่เคยมีปฏิสัมพันธ์กับเซลล์นี้เลย (ทั้งสองทิศ)
        wrongPred: (c) => !known.has(c.id),
      });
    }
  } else if (type === 'image') {
    // รูปที่ใช้ได้ทุกรูปของเซลล์ (ตัด quiz:false และ diagram/illustration) ข้อหนึ่งสุ่มหนึ่งรูปตอนสร้างคำถาม
    const pool = quizImagesOf(subject);
    if (!pool.length) return out;
    out.push({
      ...base, key: `image:${subject.id}`, answerId: subject.id, promptKey: 'quiz.q.image',
      clue: { kind: 'image', image: pool[0] }, imagePool: pool,
      truth: (c) => c.id === subject.id, wrongPred: () => true,
    });
  }
  return out;
}

// ------------------------------------------------------------------ เลือกตัวเลือกผิด

const labelsOf = (c) => [norm(c.th), norm(c.en)].filter(Boolean);

function pickWrongCells(ctx, spec, rng, n) {
  const anchor = ctx.byId.get(spec.anchorId || spec.answerId);
  const tiers = [
    (c) => (anchor.confused_with || []).includes(c.id) || (c.confused_with || []).includes(anchor.id),
    (c) => anchor.tissue_subtype && c.tissue_subtype === anchor.tissue_subtype,
    (c) => (c.systems || [])[0] === (anchor.systems || [])[0],
    (c) => c.tissue === anchor.tissue,
    () => true,
  ];
  const used = new Set();
  for (const id of [spec.answerId, ...spec.exclude]) { const c = ctx.byId.get(id); if (c) labelsOf(c).forEach((l) => used.add(l)); }
  const chosen = [];
  const taken = new Set();
  for (const tier of tiers) {
    const pool = shuffle(ctx.realCells.filter((c) => !taken.has(c.id) && tier(c)), rng);
    for (const c of pool) {
      if (chosen.length >= n) break;
      if (spec.exclude.has(c.id) || c.id === spec.answerId) continue;
      if (labelsOf(c).some((l) => used.has(l))) continue;
      if (!spec.wrongPred(c)) continue;
      if (spec.avoidIsa && ctx.isaRelated(anchor.id, c.id)) continue;
      chosen.push(c.id);
      taken.add(c.id);
      labelsOf(c).forEach((l) => used.add(l));
    }
    if (chosen.length >= n) break;
  }
  return chosen.length >= n ? chosen : null;
}

function pickWrongTissues(ctx, spec, rng, n) {
  const main = ctx.data.tissues.filter((t) => t.cl_class && t.id !== spec.answerId && spec.wrongPred(t.id));
  const pool = shuffle(main, rng).map((t) => t.id);
  return pool.length >= n ? pool.slice(0, n) : null;
}

// สร้างคำถามจาก spec (คืน null ถ้าหาตัวเลือกผิดไม่ครบ)
export function buildQuestion(ctx, spec, rng, id) {
  const wrong = spec.optionKind === 'tissue' ? pickWrongTissues(ctx, spec, rng, OPTION_COUNT - 1) : pickWrongCells(ctx, spec, rng, OPTION_COUNT - 1);
  if (!wrong) return null;
  const options = shuffle([spec.answerId, ...wrong], rng);
  const s = spec.subject;
  const exam = textOf(s, 'exam', ctx.lang);
  let clue = spec.clue;
  if (spec.imagePool && spec.imagePool.length > 1) clue = { kind: 'image', image: spec.imagePool[Math.floor(rng() * spec.imagePool.length)] };
  return {
    id, key: spec.key, type: spec.type, subjectId: s.id, systemId: (s.systems || [])[0] || '',
    promptKey: spec.promptKey, promptParams: spec.promptParams || {}, clue,
    optionKind: spec.optionKind, options, answerIndex: options.indexOf(spec.answerId),
    verified: verifiedOf(s),
    explain: { exam: exam.text, examThaiOnly: exam.thaiOnly, edge: spec.edge ? { th: spec.edge.th || '', mode: spec.edge.mode } : null },
  };
}

// ------------------------------------------------------------------ ตรวจคำถาม (ใช้ในการทดสอบ)

// ตรวจความถูกต้องของโครงสร้างและเงื่อนไข "ถูกข้อเดียว" โดยใช้ spec เดิม (ข้อความเป็นภาษาอังกฤษเพราะใช้ในรายงานทดสอบ)
export function verifyQuestion(ctx, q) {
  const problems = [];
  if (!Array.isArray(q.options) || q.options.length !== OPTION_COUNT) problems.push('wrong option count');
  if (new Set(q.options).size !== q.options.length) problems.push('duplicate options');
  if (!(q.answerIndex >= 0 && q.answerIndex < q.options.length)) problems.push('bad answerIndex');
  const subject = ctx.byId.get(q.subjectId);
  const spec = subject && enumerateSpecs(ctx, q.type, subject).find((s) => s.key === q.key);
  if (!spec) { problems.push('spec not found'); return problems; }
  if (q.options[q.answerIndex] !== spec.answerId) problems.push('answer is not the spec answer');
  const asObj = (id) => (q.optionKind === 'tissue' ? id : ctx.byId.get(id));
  if (!spec.truth(asObj(spec.answerId))) problems.push('answer does not satisfy the clue');
  for (const id of q.options) {
    if (id === spec.answerId) continue;
    if (spec.truth(asObj(id))) problems.push('wrong option satisfies the clue: ' + id);
    if (!spec.wrongPred(asObj(id))) problems.push('wrong option fails wrongPred: ' + id);
  }
  const c = q.clue;
  if (!c || ((c.kind === 'text' || c.kind === 'term') && !c.text) || (c.kind === 'cell' && !c.cellId) || (c.kind === 'image' && !(c.image && c.image.src))) problems.push('empty clue');
  return problems;
}

// ------------------------------------------------------------------ ขอบเขตและการสร้างชุดทดสอบ

export function inScope(cell, scope = {}) {
  if (scope.cells && scope.cells.length && !scope.cells.includes(cell.id)) return false;
  if (scope.systems && scope.systems.length && !(cell.systems || []).some((s) => scope.systems.includes(s))) return false;
  if (scope.tissues && scope.tissues.length && !scope.tissues.includes(cell.tissue || 'other')) return false;
  return true;
}

// จำนวนคำถามที่เป็นไปได้ต่อประเภท (นับเฉพาะ spec ที่หาตัวเลือกผิดครบ)
export function capacityByType(ctx, scope = {}, { verifiedOnly = false, seed = 1 } = {}) {
  const rng = makeRng(seed);
  const cap = Object.fromEntries(TYPES.map((t) => [t, 0]));
  for (const c of ctx.realCells) {
    if (!inScope(c, scope)) continue;
    if (verifiedOnly && !verifiedOf(c)) continue;
    for (const t of TYPES) {
      for (const spec of enumerateSpecs(ctx, t, c)) if (buildQuestion(ctx, spec, rng, 'x')) cap[t]++;
    }
  }
  return cap;
}

function weightedPick(items, weightOf, rng) {
  const ws = items.map(weightOf);
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// สร้างชุดทดสอบ: opts = {count, types, scope, verifiedOnly, weights, onlyIds, seed}
export function generateQuiz(ctx, opts = {}) {
  const { count = 10, types = TYPES, scope = {}, verifiedOnly = false, weights = {}, onlyIds = null } = opts;
  const rng = makeRng(opts.seed == null ? 12345 : opts.seed);
  let subjects = ctx.realCells.filter((c) => inScope(c, scope) && (!verifiedOnly || verifiedOf(c)));
  if (onlyIds) subjects = subjects.filter((c) => onlyIds.includes(c.id));

  // รวมคำถามที่เป็นไปได้ทั้งหมดต่อประเภท แล้วสุ่มสลับประเภท ให้น้ำหนักเซลล์ที่เคยตอบผิด
  const pools = {};
  for (const t of types) {
    pools[t] = [];
    for (const c of subjects) for (const spec of enumerateSpecs(ctx, t, c)) pools[t].push(spec);
  }
  const questions = [];
  const usedKeys = new Set();
  const usedSubjects = new Map();
  let guard = count * 60;
  let turn = 0;
  const order = shuffle(types, rng);
  while (questions.length < count && guard-- > 0) {
    const live = order.filter((t) => pools[t].length);
    if (!live.length) break;
    const type = live[turn++ % live.length];
    const pool = pools[type].filter((s) => !usedKeys.has(s.key));
    if (!pool.length) { pools[type] = []; continue; }
    // เลี่ยงใช้เซลล์เดิมซ้ำจนกว่าเซลล์อื่นจะถูกใช้แล้ว
    const fresh = pool.filter((s) => !usedSubjects.has(s.subject.id));
    const from = fresh.length ? fresh : pool;
    const spec = weightedPick(from, (s) => 1 + 3 * (weights[s.subject.id] || 0), rng);
    usedKeys.add(spec.key);
    const q = buildQuestion(ctx, spec, rng, 'q' + (questions.length + 1));
    if (!q) continue;
    usedSubjects.set(spec.subject.id, (usedSubjects.get(spec.subject.id) || 0) + 1);
    questions.push(q);
  }
  return { questions, requested: count };
}

export { nameOf };

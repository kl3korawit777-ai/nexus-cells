// ทดสอบตัวสร้างคำถาม: สร้าง 1,000 ข้อจากข้อมูลจริง แล้วตรวจว่า
//   - ทุกข้อมีคำตอบถูกข้อเดียว  - ไม่มีตัวเลือกซ้ำ  - ไม่มีช่องว่าง  - ตัวเลือกผิดไม่ตรงกับคำใบ้
// รัน: node scripts/test-quiz.mjs  (ออกด้วยรหัส 1 ถ้ามีข้อผิดพลาด)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext, generateQuiz, capacityByType, verifyQuestion, TYPES } from '../site/js/quiz-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'site', 'data', 'nexus.json'), 'utf8'));
const TARGET = 1000;

// ---- ตรวจแบบอิสระจากตรรกะใน engine (ใช้ข้อมูลดิบโดยตรง) ----
const byId = new Map(data.cells.map((c) => [c.id, c]));
const norm = (s) => String(s || '').toLowerCase();
const rawText = (c) => norm(JSON.stringify(c));
function rawMentions(c, tok) {
  const t = norm(tok);
  if (/^[a-z0-9\-+ ]+$/.test(t)) return new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(rawText(c));
  return rawText(c).includes(t);
}
function ancestors(id) {
  const seen = new Set(), st = [id];
  while (st.length) {
    const x = st.pop();
    for (const e of data.edges) if (e.type === 'develops_from' && e.from === x && !seen.has(e.to)) { seen.add(e.to); st.push(e.to); }
  }
  return seen;
}

function independentChecks(q, lang) {
  const bad = [];
  const subj = byId.get(q.subjectId);
  const ans = q.options[q.answerIndex];
  const wrong = q.options.filter((_, i) => i !== q.answerIndex);
  const cellOf = (id) => byId.get(id);
  if (q.optionKind === 'cell') {
    const labels = q.options.map((id) => cellOf(id) && (lang === 'en' ? cellOf(id).en : cellOf(id).th));
    if (labels.some((l) => !l)) bad.push('empty option label');
    if (new Set(labels).size !== labels.length) bad.push('duplicate option labels');
    if (q.options.some((id) => !cellOf(id) || cellOf(id).kind !== 'cell')) bad.push('option is not a cell');
    if (new Set(q.options.map((id) => cellOf(id).en)).size !== q.options.length) bad.push('duplicate English names');
  } else {
    const tl = q.options.map((id) => data.tissues.find((t) => t.id === id));
    if (tl.some((t) => !t)) bad.push('unknown tissue option');
  }
  switch (q.type) {
    case 'morphology': {
      // โหมดอังกฤษ: ใช้ en_content ถ้ามี ไม่มีก็ใช้ข้อความเดิมได้เฉพาะเมื่อไม่มีอักษรไทย (เป็นศัพท์ละตินล้วน)
      const thaiRe = /[฀-๿]/;
      const m = lang === 'en' ? (subj.en_content && subj.en_content.morphology) || (thaiRe.test(subj.morphology || '') ? null : subj.morphology) : subj.morphology;
      if (!m || q.clue.text !== m) bad.push('clue is not the subject morphology');
      if (ans !== subj.id) bad.push('answer is not the subject');
      for (const id of wrong) { const c = cellOf(id); if (c.morphology === m || (c.en_content && c.en_content.morphology === m)) bad.push('wrong option has the same morphology'); }
      break;
    }
    case 'secretes':
    case 'marker': {
      const field = q.type === 'secretes' ? 'secretes' : 'markers';
      if (!subj[field].includes(q.clue.text)) bad.push('clue is not in the subject list');
      const toks = q.clue.text.toLowerCase().split(/[()/,;]| และ | and /).map((x) => x.trim()).filter((x) => x.length >= 2);
      for (const id of wrong) if (toks.some((t) => rawMentions(cellOf(id), t))) bad.push(`wrong option mentions the clue: ${id}`);
      if (ans !== subj.id) bad.push('answer is not the subject');
      break;
    }
    case 'develops_from': {
      const anc = ancestors(subj.id);
      if (!data.edges.some((e) => e.type === 'develops_from' && e.from === subj.id && e.to === ans)) bad.push('answer is not a parent');
      for (const id of wrong) if (anc.has(id) || id === subj.id) bad.push(`wrong option is an ancestor: ${id}`);
      break;
    }
    case 'tissue': {
      if (ans !== subj.tissue) bad.push('answer is not the subject tissue');
      if (wrong.includes(subj.tissue)) bad.push('wrong option equals the tissue');
      break;
    }
    case 'interacts': {
      const partners = new Set();
      for (const e of data.edges) if (e.type === 'interacts_with') { if (e.from === subj.id) partners.add(e.to); if (e.to === subj.id) partners.add(e.from); }
      if (!partners.has(ans)) bad.push('answer is not a partner');
      for (const id of wrong) if (partners.has(id) || id === subj.id) bad.push(`wrong option is a partner: ${id}`);
      break;
    }
    case 'image': {
      if (!subj.image || subj.image.src !== q.clue.image.src) bad.push('image clue mismatch');
      if (ans !== subj.id) bad.push('answer is not the subject');
      break;
    }
    default: bad.push('unknown type ' + q.type);
  }
  return bad;
}

let failures = 0;
function runFor(lang) {
  const ctx = buildContext(data, lang);
  const cap = capacityByType(ctx, {});
  const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
  const seenKeys = new Map();
  let total = 0, seed = 1, errors = 0;
  const problems = [];
  while (total < TARGET && seed < 5000) {
    const { questions } = generateQuiz(ctx, { count: 20, seed });
    seed++;
    for (const q of questions) {
      if (total >= TARGET) break;
      total++;
      counts[q.type]++;
      seenKeys.set(q.key, (seenKeys.get(q.key) || 0) + 1);
      const probs = [...verifyQuestion(ctx, q), ...independentChecks(q, lang)];
      if (probs.length) { errors++; if (problems.length < 15) problems.push(`${q.type} ${q.key}: ${probs.join('; ')}`); }
    }
    if (!questions.length) break;
  }
  const totalCap = Object.values(cap).reduce((a, b) => a + b, 0);
  console.log(`\n[${lang}] generated ${total} questions from ${seenKeys.size} distinct clues; ${errors} with problems`);
  console.log('  type'.padEnd(18) + 'capacity'.padStart(10) + 'generated'.padStart(11));
  for (const t of TYPES) console.log(`  ${t}`.padEnd(18) + String(cap[t]).padStart(10) + String(counts[t]).padStart(11));
  console.log(`  total capacity (distinct questions): ${totalCap}`);
  for (const p of problems) console.log('  ✗ ' + p);
  if (errors) failures++;
  if (total < TARGET) { console.log(`  ✗ only ${total}/${TARGET} generated`); failures++; }
}

runFor('th');
runFor('en');

// verifiedOnly: ข้อมูลยังไม่มีเซลล์ที่ตรวจแล้ว ต้องไม่สร้างคำถามเลย
{
  const ctx = buildContext(data, 'th');
  const verified = data.cells.filter((c) => c.verified === true).length;
  const r = generateQuiz(ctx, { count: 10, verifiedOnly: true, seed: 3 });
  console.log(`\nverifiedOnly: ${verified} verified cells -> ${r.questions.length} questions`);
  if (!verified && r.questions.length) { console.log('  ✗ should be empty'); failures++; }
}

if (failures) { console.log(`\nFAILED (${failures})`); process.exit(1); }
console.log('\nOK');

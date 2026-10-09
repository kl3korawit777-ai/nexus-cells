// หน้าโหมดทดสอบ (#/quiz): ตั้งค่า ทำข้อสอบทีละข้อ (ใช้แป้นพิมพ์ได้) และสรุปผล
// ตัวสร้างคำถามอยู่ใน quiz-engine.js

import { store, dataset, realCellCount, cellName, cellAlt, sysName, tissueName } from './data.js';
import { t, getLang } from './i18n.js';
import { h, cellHref } from './util.js';
import { getJSON, setJSON, removeItem } from './storage.js';
import { buildContext, generateQuiz, capacityByType, TYPES } from './quiz-engine.js';

const HISTORY_KEY = 'nexus.quiz.wrong';
const COUNTS = [10, 20, 30];
const MIN_VERIFIED_QUESTIONS = 10; // ต่ำกว่านี้ถือว่าข้อมูลที่ตรวจแล้วไม่พอ

// ------------------------------------------------------------------ ประวัติข้อที่ผิด

const loadHistory = () => {
  const h0 = getJSON(HISTORY_KEY, {});
  return h0 && typeof h0 === 'object' && !Array.isArray(h0) ? h0 : {};
};
const saveHistory = (hist) => setJSON(HISTORY_KEY, hist);

// ------------------------------------------------------------------ ตัวช่วยแสดงผล

const modeName = (id) => t('mode.' + id);

function optionLabel(q, id) {
  if (q.optionKind === 'tissue') { const tis = store.tissuesById.get(id); return { main: tis ? tissueName(tis) : id, alt: '' }; }
  const c = store.cellsById.get(id);
  return { main: c ? cellName(c) : id, alt: c ? cellAlt(c) : '' };
}

function promptText(q) {
  const p = q.promptParams || {};
  const params = {};
  if (p.cellId) params.cell = cellName(store.cellsById.get(p.cellId));
  if (p.mode) params.mode = modeName(p.mode);
  return t(q.promptKey, params);
}

function thaiOnlyChip() { return h('span', { class: 'chip chip-thai', text: t('common.thaiOnly') }); }

function clueNode(q) {
  const c = q.clue;
  if (c.kind === 'text') return h('blockquote', { class: 'quiz-clue' }, c.text);
  if (c.kind === 'term') return h('div', { class: 'quiz-term mono' }, c.text);
  if (c.kind === 'image') {
    const box = h('div', { class: 'quiz-image' });
    const img = h('img', { src: c.image.src, alt: t('quiz.imageAlt') });
    img.addEventListener('error', () => box.replaceChildren(h('p', { class: 'empty', text: t('card.imageFailed') })));
    box.append(img);
    if (c.image.credit) box.append(h('p', { class: 'graph-hint' }, [c.image.credit, c.image.license].filter(Boolean).join(' · ')));
    return box;
  }
  return null;
}

// ------------------------------------------------------------------ หน้า

export function quizView(params = {}) {
  const root = h('div', { class: 'quiz' });
  let session = null;
  let keyHandler = null;
  const cleanups = [];

  const ctxCache = {};
  const getCtx = () => {
    const l = getLang();
    if (!ctxCache[l]) ctxCache[l] = buildContext(dataset(), l);
    return ctxCache[l];
  };

  // ขอบเขตเริ่มต้นจากพารามิเตอร์ใน URL: ?system=a,b &tissue=x &cell=CL_0000091
  const urlList = (v) => (v ? String(v).split(',').filter(Boolean) : []);
  const state = {
    systems: new Set(urlList(params.system).filter((s) => store.systemsById.has(s))),
    tissues: new Set(urlList(params.tissue).filter((s) => store.tissuesById.has(s))),
    cells: urlList(params.cell).map((x) => x.replace('_', ':')).filter((id) => store.cellsById.has(id)),
    types: new Set(TYPES),
    count: 10,
    verifiedOnly: false,
  };

  const scope = () => ({ systems: [...state.systems], tissues: [...state.tissues], cells: state.cells });

  function stopKeys() {
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
  }

  // ---------------------------------------------------------------- ตั้งค่า
  function renderSetup() {
    stopKeys();
    const hist = loadHistory();
    const wrongIds = Object.keys(hist).filter((id) => hist[id] > 0 && store.cellsById.has(id));

    const head = h('header', { class: 'sys-head' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: t('quiz.title') }),
      h('p', { class: 'sub-title', text: t('quiz.intro') }));

    const form = h('form', { class: 'quiz-setup card', novalidate: true, onsubmit: (e) => { e.preventDefault(); start(); } });
    const note = h('p', { class: 'empty', role: 'status', 'aria-live': 'polite' });

    // ขอบเขตเฉพาะเซลล์ (มาจากปุ่ม "ทดสอบเรื่องนี้" ในหน้าเซลล์)
    if (state.cells.length) {
      const c = store.cellsById.get(state.cells[0]);
      form.append(h('p', { class: 'chips' }, h('span', { class: 'chip' }, t('quiz.scopeCell', { cell: cellName(c) })),
        h('button', { type: 'button', class: 'btn', onclick: () => { state.cells = []; renderSetup(); } }, t('quiz.clearCellScope'))));
    }

    const group = (legend, items) => h('fieldset', { class: 'quiz-group' }, h('legend', { text: legend }), h('div', { class: 'quiz-checks' }, items));
    const check = (id, label, checked, onchange, extra) => {
      const input = h('input', { type: 'checkbox', id, checked: checked ? true : null, onchange: () => onchange(input.checked) });
      return h('label', { class: 'quiz-check', for: id }, input, h('span', {}, label), extra || null);
    };

    const sysItems = store.systems.filter((s) => realCellCount(s.id) > 0).map((s) =>
      check('qs-' + s.id, sysName(s), state.systems.has(s.id), (on) => { on ? state.systems.add(s.id) : state.systems.delete(s.id); refresh(); }));
    const tisItems = store.tissues.map((tt) =>
      check('qt-' + tt.id, tissueName(tt), state.tissues.has(tt.id), (on) => { on ? state.tissues.add(tt.id) : state.tissues.delete(tt.id); refresh(); }));
    const typeCounts = {};
    const typeItems = TYPES.map((ty) => {
      const badge = h('span', { class: 'chip quiz-cap', 'data-type': ty });
      typeCounts[ty] = badge;
      return check('qy-' + ty, t('quiz.type.' + ty), state.types.has(ty), (on) => { on ? state.types.add(ty) : state.types.delete(ty); refresh(); }, badge);
    });
    const countItems = COUNTS.map((n) => {
      const input = h('input', { type: 'radio', name: 'qcount', id: 'qc-' + n, value: n, checked: state.count === n ? true : null, onchange: () => { state.count = n; refresh(); } });
      return h('label', { class: 'quiz-check', for: 'qc-' + n }, input, h('span', {}, String(n)));
    });

    const verInput = h('input', { type: 'checkbox', id: 'q-ver', onchange: () => { state.verifiedOnly = verInput.checked; refresh(); } });
    const verReason = h('p', { class: 'graph-hint', id: 'q-ver-reason' });
    const verRow = h('div', { class: 'quiz-ver' }, h('label', { class: 'quiz-check', for: 'q-ver' }, verInput, h('span', {}, t('quiz.verifiedOnly'))), verReason);

    const startBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, t('quiz.start'));
    const practiceBtn = h('button', { type: 'button', class: 'btn', disabled: wrongIds.length ? null : true, onclick: () => start({ onlyIds: wrongIds }) },
      t('quiz.practiceWrong', { n: wrongIds.length }));
    const clearBtn = h('button', { type: 'button', class: 'btn', disabled: Object.keys(hist).length ? null : true, onclick: () => { removeItem(HISTORY_KEY); renderSetup(); } }, t('quiz.clearHistory'));

    form.append(
      group(t('quiz.systems'), sysItems), group(t('quiz.tissues'), tisItems),
      group(t('quiz.types'), typeItems), group(t('quiz.count'), countItems), verRow, note,
      h('div', { class: 'toolbar' }, startBtn, practiceBtn, clearBtn));

    // อัปเดตจำนวนคำถามที่สร้างได้และสถานะตัวเลือก "เฉพาะข้อมูลที่ตรวจแล้ว"
    function refresh() {
      const ctx = getCtx();
      const cap = capacityByType(ctx, scope());
      const total = TYPES.filter((ty) => state.types.has(ty)).reduce((a, ty) => a + cap[ty], 0);
      TYPES.forEach((ty) => { typeCounts[ty].textContent = t('quiz.typeCount', { n: cap[ty] }); });
      const capV = capacityByType(ctx, scope(), { verifiedOnly: true });
      const totalV = TYPES.filter((ty) => state.types.has(ty)).reduce((a, ty) => a + capV[ty], 0);
      const verifiedCells = store.cells.filter((c) => c.kind === 'cell' && c.verified === true).length;
      const enough = totalV >= Math.min(state.count, MIN_VERIFIED_QUESTIONS);
      verInput.disabled = !enough;
      if (!enough) { verInput.checked = false; state.verifiedOnly = false; }
      verInput.checked = state.verifiedOnly;
      verReason.textContent = enough ? '' : t('quiz.verifiedDisabled', { n: verifiedCells });
      verInput.setAttribute('aria-describedby', 'q-ver-reason');
      const eff = state.verifiedOnly ? totalV : total;
      note.textContent = eff === 0
        ? t('quiz.noQuestions')
        : eff < state.count ? t('quiz.fewer', { n: eff, req: state.count }) : t('quiz.availableTotal', { n: eff });
      startBtn.disabled = eff === 0;
    }
    root.replaceChildren(head, form);
    // คำนวณหลังใส่ใน DOM เพื่อไม่ให้หน้าค้างตอนโหลด
    setTimeout(refresh, 0);
  }

  // ---------------------------------------------------------------- ทำข้อสอบ
  function start(extra = {}) {
    const ctx = getCtx();
    const hist = loadHistory();
    const types = TYPES.filter((ty) => state.types.has(ty));
    const result = generateQuiz(ctx, {
      count: state.count, types, scope: scope(), verifiedOnly: state.verifiedOnly,
      weights: hist, onlyIds: extra.onlyIds || null, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
    });
    if (!result.questions.length) { renderSetup(); return; }
    session = { questions: result.questions, index: 0, answers: [], requested: state.count, extra };
    renderQuestion();
  }

  function renderQuestion() {
    stopKeys();
    const { questions, index } = session;
    const q = questions[index];
    const n = questions.length;
    let pending = -1;
    let answered = false;

    const progress = h('div', { class: 'quiz-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': String(index), 'aria-label': t('quiz.progress', { i: index + 1, n }) },
      h('div', { class: 'bar', style: `width:${(index / n) * 100}%` }));
    const head = h('header', { class: 'quiz-head' },
      h('h1', { class: 'page-title quiz-title', id: 'page-title', tabindex: '-1', text: t('quiz.progress', { i: index + 1, n }) }),
      q.verified ? null : h('span', { class: 'chip chip-warn', text: t('quiz.unverified') }));

    const optionButtons = q.options.map((id, i) => {
      const lab = optionLabel(q, id);
      const b = h('button', { type: 'button', class: 'quiz-option', role: 'radio', 'aria-checked': 'false', 'data-i': i, onclick: () => answer(i) },
        h('span', { class: 'num', 'aria-hidden': 'true', text: String(i + 1) }),
        h('span', { class: 'lbl' }, lab.main, lab.alt ? h('span', { class: 'alt', text: lab.alt }) : null));
      return b;
    });
    const group = h('div', { class: 'quiz-options', role: 'radiogroup', 'aria-labelledby': 'quiz-prompt' }, optionButtons);
    const feedback = h('div', { class: 'quiz-feedback', role: 'status', 'aria-live': 'polite' });
    const hint = h('p', { class: 'graph-hint', text: t('quiz.keyhint') });

    const card = h('section', { class: 'card quiz-card' },
      h('p', { class: 'quiz-type eyebrow', text: t('quiz.type.' + q.type) }),
      h('h2', { id: 'quiz-prompt', class: 'quiz-prompt', text: promptText(q) }),
      clueNode(q), group, feedback, hint);

    function select(i) {
      if (answered) return;
      pending = i;
      optionButtons.forEach((b, k) => b.setAttribute('aria-checked', String(k === i)));
      optionButtons[i].focus();
    }

    function answer(i) {
      if (answered) return;
      answered = true;
      pending = i;
      const correct = i === q.answerIndex;
      session.answers.push({ choice: i, correct });
      optionButtons.forEach((b, k) => {
        b.disabled = true;
        b.setAttribute('aria-checked', String(k === i));
        if (k === q.answerIndex) b.classList.add('is-correct');
        else if (k === i) b.classList.add('is-wrong');
      });
      const correctLabel = optionLabel(q, q.options[q.answerIndex]).main;
      feedback.replaceChildren(...explanation(q, correct, correctLabel));
      progress.firstChild.style.width = `${((index + 1) / n) * 100}%`;
      progress.setAttribute('aria-valuenow', String(index + 1));
      const last = index + 1 >= n;
      const nextBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { if (last) renderResult(); else { session.index++; renderQuestion(); } } },
        last ? t('quiz.finish') : t('quiz.next'));
      card.append(h('div', { class: 'toolbar' }, nextBtn));
      nextBtn.focus();
      hint.remove();
    }

    // แป้นพิมพ์: 1–4 เลือกตัวเลือก (โฟกัสไปที่ตัวเลือก) Enter/Space ยืนยัน แล้ว Enter ไปข้อถัดไป
    keyHandler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-4]$/.test(e.key) && !answered) {
        const i = Number(e.key) - 1;
        if (i < q.options.length) { e.preventDefault(); select(i); }
      } else if (e.key === 'Enter' && !answered && pending >= 0 && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        answer(pending);
      }
    };
    document.addEventListener('keydown', keyHandler);

    root.replaceChildren(progress, head, card);
    const title = root.querySelector('#page-title');
    if (title && index > 0) title.focus({ preventScroll: true });
  }

  function explanation(q, correct, correctLabel) {
    const out = [];
    out.push(h('p', { class: 'quiz-verdict ' + (correct ? 'ok' : 'bad'), text: correct ? t('quiz.correct') : t('quiz.wrong', { answer: correctLabel }) }));
    const subject = store.cellsById.get(q.subjectId);
    if (q.explain.exam) {
      out.push(h('div', { class: 'quiz-explain' }, h('strong', { text: t('quiz.explain') + ': ' }), q.explain.exam, q.explain.examThaiOnly ? thaiOnlyChip() : null));
    }
    if (q.type === 'secretes' && subject.secretes && subject.secretes.length) {
      out.push(h('p', { class: 'quiz-extra', text: t('quiz.secretesList', { cell: cellName(subject), list: subject.secretes.join(', ') }) }));
    }
    if (q.type === 'marker' && subject.markers && subject.markers.length) {
      out.push(h('p', { class: 'quiz-extra', text: t('quiz.markersList', { cell: cellName(subject), list: subject.markers.join(', ') }) }));
    }
    if (q.type === 'interacts' && q.explain.edge) {
      const e = q.explain.edge;
      out.push(h('p', { class: 'quiz-extra' }, t('quiz.mechanism', { mode: modeName(e.mode) }), e.th ? [' · ', e.th, getLang() === 'en' ? thaiOnlyChip() : null] : null));
    }
    const links = [h('a', { href: cellHref(subject.id) }, t('quiz.viewCell', { cell: cellName(subject) }))];
    if (q.optionKind === 'cell') {
      const ansId = q.options[q.answerIndex];
      if (ansId !== subject.id) links.push(h('a', { href: cellHref(ansId) }, t('quiz.viewCell', { cell: correctLabel })));
    }
    out.push(h('p', { class: 'quiz-links' }, links.flatMap((l, i) => (i ? [' · ', l] : [l]))));
    return out;
  }

  // ---------------------------------------------------------------- ผลลัพธ์
  function renderResult() {
    stopKeys();
    const { questions, answers } = session;
    const n = questions.length;
    const correct = answers.filter((a) => a.correct).length;

    // บันทึกประวัติ: ผิดเพิ่ม 1 ถูกลด 1 (ต่ำสุด 0)
    const hist = loadHistory();
    questions.forEach((q, i) => {
      const cur = hist[q.subjectId] || 0;
      const next = answers[i].correct ? Math.max(0, cur - 1) : cur + 1;
      if (next > 0) hist[q.subjectId] = next; else delete hist[q.subjectId];
    });
    saveHistory(hist);

    const tally = (keyOf) => {
      const m = new Map();
      questions.forEach((q, i) => {
        const k = keyOf(q);
        const r = m.get(k) || { c: 0, n: 0 };
        r.n++; if (answers[i].correct) r.c++;
        m.set(k, r);
      });
      return m;
    };
    const table = (title, map, label) => h('section', { class: 'quiz-table' }, h('h3', { text: title }),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: t('quiz.col.topic') }), h('th', { scope: 'col', text: t('quiz.col.score') }))),
        h('tbody', {}, [...map.entries()].map(([k, r]) => h('tr', {}, h('th', { scope: 'row', text: label(k) }), h('td', { text: `${r.c} / ${r.n}` }))))));

    const wrongItems = questions.map((q, i) => ({ q, a: answers[i] })).filter((x) => !x.a.correct);
    const wrongList = h('section', {}, h('h3', { text: t('quiz.result.wrongList') }),
      wrongItems.length
        ? h('ul', { class: 'rel-list' }, wrongItems.map(({ q, a }) => {
          const subject = store.cellsById.get(q.subjectId);
          return h('li', { class: 'quiz-wrong' },
            h('div', {}, h('strong', { text: promptText(q) })),
            h('div', { class: 'note', text: t('quiz.yourAnswer', { a: optionLabel(q, q.options[a.choice]).main }) }),
            h('div', { class: 'note', text: t('quiz.correctAnswer', { a: optionLabel(q, q.options[q.answerIndex]).main }) }),
            h('a', { href: cellHref(subject.id) }, t('quiz.result.review', { cell: cellName(subject) })));
        }))
        : h('p', { class: 'empty', text: t('quiz.result.allCorrect') }));

    const wrongIds = Object.keys(hist).filter((id) => hist[id] > 0 && store.cellsById.has(id));
    root.replaceChildren(
      h('header', { class: 'sys-head' },
        h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: t('quiz.result.title') }),
        h('p', { class: 'quiz-score' }, h('b', { text: `${correct} / ${n}` }), ` ${t('quiz.result.percent', { p: Math.round((correct / n) * 100) })}`),
        n < session.requested ? h('p', { class: 'empty', text: t('quiz.fewer', { n, req: session.requested }) }) : null),
      h('div', { class: 'quiz-tables' },
        table(t('quiz.result.bySystem'), tally((q) => q.systemId), (k) => (store.systemsById.has(k) ? sysName(store.systemsById.get(k)) : k)),
        table(t('quiz.result.byType'), tally((q) => q.type), (k) => t('quiz.type.' + k))),
      wrongList,
      h('div', { class: 'toolbar' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => start(session.extra) }, t('quiz.again')),
        h('button', { type: 'button', class: 'btn', disabled: wrongIds.length ? null : true, onclick: () => start({ onlyIds: wrongIds }) }, t('quiz.practiceWrong', { n: wrongIds.length })),
        h('button', { type: 'button', class: 'btn', onclick: renderSetup }, t('quiz.back'))));
    const title = root.querySelector('#page-title');
    if (title) title.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  renderSetup();
  return {
    title: t('quiz.title'),
    el: root,
    destroy: () => { stopKeys(); cleanups.forEach((f) => f()); },
  };
}

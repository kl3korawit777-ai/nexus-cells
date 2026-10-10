// แท็บ "ความเชื่อมโยง": แสดงเส้นทุกแบบที่เข้า/ออกจากเซลล์นี้ เพิ่ม/ลบเส้น (เก็บเข้ารายการรอบบันทึกทันที)

import { h, field, select, textInput, cellPicker } from './ui.js';
import { at, issueText } from './text.js';
import { S, addEdge, removeEdge } from './state.js';
import * as model from './model.js';
import { validateDataset } from './validate.js';

// ชนิดความสัมพันธ์ที่เพิ่มได้ จากมุมมองของเซลล์นี้ (self) กับเซลล์ที่เลือก (other)
const RELATIONS = [
  { id: 'dev_from', kind: 'develops_from', self: 'a' },
  { id: 'dev_to', kind: 'develops_from', self: 'b' },
  { id: 'isa', kind: 'is_a', self: 'a' },
  { id: 'isa_sub', kind: 'is_a', self: 'b' },
  { id: 'int_out', kind: 'interacts_with', self: 'a' },
  { id: 'int_in', kind: 'interacts_with', self: 'b' },
];

export function edgesTab(selfId, onChange) {
  const ds = () => S.working.dataset;
  const nameOf = (cid) => { const c = ds().cells.find((x) => x.id === cid); return c ? `${c.th} (${c.en})` : cid; };
  const root = h('div', { class: 'adm-edges' });

  const rel = h('select', { 'aria-label': at('edge.relation') }, RELATIONS.map((r) => h('option', { value: r.id, text: at('edge.rel.' + r.id) })));
  const modeSel = select(model.MODES.map((m) => ({ value: m, label: at('edge.mode.' + m) })), 'hormone', () => {});
  const desc = textInput('', () => {}, { placeholder: at('edge.descPlaceholder') });
  const picked = h('div', { class: 'adm-muted', 'aria-live': 'polite' });
  const problems = h('div', { role: 'alert' });
  const addBtn = h('button', { type: 'button', class: 'adm-btn adm-btn-primary', id: 'adm-add-edge', disabled: true }, at('edge.add'));
  let other = null;

  const current = () => RELATIONS.find((r) => r.id === rel.value);
  const interacts = () => current().kind === 'interacts_with';
  const build = () => {
    const r = current();
    const a = r.self === 'a' ? selfId : other.id;
    const b = r.self === 'a' ? other.id : selfId;
    return { kind: r.kind, a, b, ...(r.kind === 'interacts_with' ? { mode: modeSel.value, th: desc.value.trim() } : {}) };
  };

  function check() {
    modeWrap.hidden = descWrap.hidden = !interacts();
    problems.replaceChildren();
    addBtn.disabled = true;
    if (!other) return;
    const e = build();
    const ov = { ...S.overlay, edges: { ...S.overlay.edges } };
    const key = model.edgeKey(e.kind, e.a, e.b);
    const existing = model.listEdges(ds()).some((x) => x.kind === e.kind && x.a === e.a && x.b === e.b);
    if (existing) { problems.append(h('div', { class: 'adm-err', text: at('edge.exists') })); return; }
    ov.edges[key] = { op: 'add', ...e };
    const out = validateDataset(model.applyOverlay(S.base, ov).dataset, { fileExists: () => true })
      .filter((i) => i.level === 'error' && i.code.startsWith('edge') && (i.id === e.a || i.id === e.b || i.code === 'edgeCycle'));
    if (out.length) { problems.replaceChildren(...out.map((i) => h('div', { class: 'adm-err', text: issueText(i) }))); return; }
    if (interacts() && !desc.value.trim()) problems.append(h('div', { class: 'adm-warn', text: at('v.edgeTh', { a: nameOf(e.a), b: nameOf(e.b) }) }));
    addBtn.disabled = false;
  }

  const picker = cellPicker((c) => { other = c; picked.textContent = at('edge.picked', { name: `${c.th} (${c.en})` }); check(); }, { exclude: new Set([selfId]) });
  const modeWrap = field(at('edge.mode'), modeSel, { id: 'mode' });
  const descWrap = field(at('edge.desc'), desc, { id: 'desc' });
  rel.addEventListener('change', check);
  modeSel.addEventListener('change', check);
  desc.addEventListener('input', check);
  addBtn.addEventListener('click', async () => {
    await addEdge(build());
    other = null; picked.textContent = ''; desc.value = '';
    draw();
    onChange();
  });

  function draw() {
    const mine = model.listEdges(ds()).filter((e) => e.a === selfId || e.b === selfId);
    const sentence = (e) => {
      const out = e.a === selfId;
      const otherId = out ? e.b : e.a;
      const key = out ? `${e.kind}.out` : `${e.kind}.in`;
      return at('edge.sentence.' + key, { other: nameOf(otherId) });
    };
    const groups = [['develops_from', 'edge.groupDev'], ['is_a', 'edge.groupIsa'], ['interacts_with', 'edge.groupInt']];
    const parts = groups.map(([kind, title]) => {
      const list = mine.filter((e) => e.kind === kind);
      if (!list.length) return null;
      return h('section', {}, h('h3', { text: at(title) }), h('ul', { class: 'adm-edge-list' }, list.map((e) => {
        const pendingAdd = (S.overlay.edges[model.edgeKey(e.kind, e.a, e.b)] || {}).op === 'add';
        return h('li', {},
          h('div', { class: 'grow' }, sentence(e), e.kind === 'interacts_with' ? [' ', h('span', { class: 'adm-tag', text: at('edge.mode.' + e.mode) }), e.th ? h('div', { class: 'adm-hint', text: e.th }) : null] : null,
            pendingAdd ? [' ', h('span', { class: 'adm-edge-new', text: at('edge.new') })] : null),
          h('button', { type: 'button', class: 'adm-btn adm-btn-small', 'aria-label': at('common.remove'), onclick: async () => { await removeEdge(e); draw(); onChange(); } }, at('common.remove')));
      })));
    }).filter(Boolean);
    const removed = Object.values(S.overlay.edges).filter((o) => o.op === 'remove' && (o.a === selfId || o.b === selfId));
    root.replaceChildren(
      ...(parts.length ? parts : [h('p', { class: 'adm-muted', text: at('edge.none') })]),
      removed.length ? h('p', { class: 'adm-hint', text: at('edge.removedPending', { n: removed.length }) }) : null,
      h('div', { class: 'adm-card' }, h('h3', { text: at('edge.addTitle') }),
        field(at('edge.relation'), rel, { id: 'relation' }), modeWrap, descWrap,
        field(at('edge.other'), picker, { id: 'other' }), picked, problems, addBtn));
    check();
  }
  draw();
  return root;
}

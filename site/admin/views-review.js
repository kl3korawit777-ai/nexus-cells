// โหมดตรวจกับตำรา (#/review): นั่งอ่านเนื้อหาทีละเซลล์เทียบตำรา แล้วตั้งเป็น textbook พร้อมแหล่งอ้างอิง

import { h, field, textInput, select, toast } from './ui.js';
import { at } from './text.js';
import { S, setCell, currentCell } from './state.js';
import * as model from './model.js';
import { idToHash } from '../js/util.js';

const REF_KEY = 'nexus.admin.lastRef';
const rs = { system: '', skipped: new Set() };
const lastRef = () => { try { return localStorage.getItem(REF_KEY) || ''; } catch { return ''; } };
const saveRef = (v) => { try { localStorage.setItem(REF_KEY, v); } catch { /* ไม่มีที่เก็บ */ } };

export function reviewView({ navigate }) {
  const ds = () => S.working.dataset;
  const root = h('div', { class: 'adm-page adm-review' });
  let refValue = lastRef();

  const inScope = (c) => !rs.system || (c.systems || []).includes(rs.system);
  const queue = () => {
    const todo = ds().cells.filter((c) => inScope(c) && c.review !== 'textbook').sort((a, b) => a.en.localeCompare(b.en));
    return [...todo.filter((c) => !rs.skipped.has(c.id)), ...todo.filter((c) => rs.skipped.has(c.id))];
  };

  function read(label, value) {
    const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
    return [h('dt', { text: label }), h('dd', { text: empty ? '—' : Array.isArray(value) ? value.join(', ') : String(value) })];
  }

  function draw() {
    const scope = ds().cells.filter(inScope);
    const done = scope.filter((c) => c.review === 'textbook').length;
    const q = queue();
    const pct = scope.length ? Math.round((done / scope.length) * 100) : 0;
    const sysSel = select([{ value: '', label: at('rev.allSystems') }, ...ds().systems.map((s) => ({ value: s.id, label: s.th }))], rs.system, (v) => { rs.system = v; rs.skipped = new Set(); draw(); });
    sysSel.setAttribute('aria-label', at('list.system'));
    const head = h('div', {},
      h('h1', { style: 'font-size:1.3rem', text: at('rev.title') }),
      h('p', { class: 'adm-muted', text: at('rev.intro') }),
      field(at('list.system'), sysSel, { id: 'system' }),
      h('div', { class: 'adm-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(scope.length), 'aria-valuenow': String(done) }, h('span', { style: `width:${pct}%` })),
      h('p', { class: 'adm-count', text: at('rev.progress', { done, total: scope.length, pct, left: q.length }) }));
    if (!q.length) { root.replaceChildren(head, h('p', { class: 'adm-card', text: at('rev.allDone') })); return; }

    const c = q[0];
    const cl = ds().clTerms[c.id];
    const sysNames = (c.systems || []).map((sid) => { const s = ds().systems.find((x) => x.id === sid); return s ? s.th : sid; });
    const tis = ds().tissues.find((t) => t.id === c.tissue);
    const sub = tis && (tis.subtypes || []).find((s) => s.id === c.tissue_subtype);
    const conf = (c.confused_with || []).map((cid) => { const x = ds().cells.find((y) => y.id === cid); return x ? x.th : cid; });

    const refInput = textInput(refValue, (v) => { refValue = v; ok.disabled = !v.trim(); }, { placeholder: at('rev.refPlaceholder'), id: 'adm-ref' });
    const ok = h('button', { type: 'button', class: 'adm-btn adm-btn-primary', id: 'adm-review-ok', disabled: !refValue.trim(), onclick: async () => {
      const ref = refValue.trim();
      if (!ref) return;
      const next = model.normalizeCell(currentCell(c.id));
      const refs = (next.refs || []).filter((r) => !r.startsWith(model.AI_REF_PREFIX));
      if (!refs.includes(ref)) refs.push(ref);
      next.refs = refs;
      next.review = 'textbook';
      saveRef(ref);
      await setCell(c.id, next);
      toast(at('rev.marked', { name: c.th }));
      draw();
    } }, at('rev.ok'));
    const fix = h('button', { type: 'button', class: 'adm-btn', onclick: () => navigate('#/edit/' + idToHash(c.id)) }, at('rev.fix'));
    const skip = h('button', { type: 'button', class: 'adm-btn', onclick: () => { rs.skipped.add(c.id); draw(); } }, at('rev.skip'));

    root.replaceChildren(head,
      h('div', { class: 'adm-card' },
        h('h2', { style: 'margin-top:0', text: `${c.th} · ${c.en}` }),
        h('p', {}, h('span', { class: 'mono', text: c.id }), ' ', h('span', { class: 'adm-tag review-' + c.review, text: at('review.' + c.review) })),
        h('dl', { class: 'adm-read' },
          read(at('f.systems'), sysNames), read(at('f.tissue'), [tis && tis.th, sub && sub.th].filter(Boolean).join(' › ')),
          read(at('f.location'), c.location), read(at('f.morphology'), c.morphology), read(at('f.function'), c.function),
          read(at('f.lifespan'), c.lifespan), read(at('f.secretes'), c.secretes), read(at('f.markers'), c.markers),
          read(at('f.exam'), c.exam), read(at('f.diseases'), c.diseases), read(at('f.confused_with'), conf), read(at('f.refs'), c.refs),
          cl && cl.found ? read(at('rev.clDef'), cl.definition) : null)),
      h('div', { class: 'adm-card' },
        field(at('rev.ref'), refInput, { id: 'ref', hint: at('rev.refHint') }),
        h('div', { class: 'adm-row' }, ok, fix, skip)));
  }
  draw();
  return { el: root, destroy() {} };
}

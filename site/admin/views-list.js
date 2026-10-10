// รายการเซลล์ด้านซ้าย: ค้นหา กรอง (ระบบ เนื้อเยื่อ ระดับการตรวจ ยังไม่มีรูป) พร้อมจำนวนในแต่ละตัวกรอง

import { h, select } from './ui.js';
import { at } from './text.js';
import { S } from './state.js';
import { idToHash } from '../js/util.js';

export const filters = { q: '', system: '', tissue: '', review: '', noImage: false };

const norm = (s) => String(s || '').toLowerCase();
function matchQuery(c, q) {
  if (!q) return true;
  const n = norm(q).replace(/^cl[_:]?(?=\d)/, 'cl:');
  return [c.th, c.en, c.id, c.slug, ...(c.synonyms || [])].some((x) => norm(x).includes(n));
}

// ตัวกรองแต่ละตัวนับจากเซลล์ที่ผ่านตัวกรองอื่น ๆ (ไม่นับตัวมันเอง)
function pass(c, f, skip) {
  return (skip === 'q' || matchQuery(c, f.q))
    && (skip === 'system' || !f.system || (c.systems || []).includes(f.system))
    && (skip === 'tissue' || !f.tissue || c.tissue === f.tissue)
    && (skip === 'review' || !f.review || c.review === f.review)
    && (skip === 'noImage' || !f.noImage || !(c.images || []).length);
}

export function listPanel({ selectedId, onNavigate }) {
  const ds = S.working.dataset;
  const pendingIds = new Set(Object.keys(S.overlay.cells));

  const search = h('input', { type: 'search', placeholder: at('list.search'), value: filters.q, 'aria-label': at('list.search'), autocomplete: 'off' });
  const sysSel = h('select', { 'aria-label': at('list.system') });
  const tisSel = h('select', { 'aria-label': at('list.tissue') });
  const revSel = h('select', { 'aria-label': at('list.review') });
  const noImg = h('input', { type: 'checkbox', id: 'adm-noimg' });
  noImg.checked = filters.noImage;
  const noImgLabel = h('span');
  const countLine = h('div', { class: 'adm-count', 'aria-live': 'polite' });
  const list = h('ul', { class: 'adm-list' });

  function fillOptions() {
    const count = (skip, test) => ds.cells.filter((c) => pass(c, filters, skip) && test(c)).length;
    const setOpts = (sel, key, opts) => {
      sel.replaceChildren(...opts.map((o) => h('option', { value: o.value, text: `${o.label} (${o.n})` })));
      sel.value = filters[key];
    };
    setOpts(sysSel, 'system', [{ value: '', label: at('list.allSystems'), n: count('system', () => true) },
      ...ds.systems.map((s) => ({ value: s.id, label: s.th, n: count('system', (c) => (c.systems || []).includes(s.id)) }))]);
    setOpts(tisSel, 'tissue', [{ value: '', label: at('list.allTissues'), n: count('tissue', () => true) },
      ...ds.tissues.map((t) => ({ value: t.id, label: t.th, n: count('tissue', (c) => c.tissue === t.id) }))]);
    setOpts(revSel, 'review', [{ value: '', label: at('list.allReviews'), n: count('review', () => true) },
      ...['draft', 'ai_reviewed', 'textbook'].map((r) => ({ value: r, label: at('review.' + r), n: count('review', (c) => c.review === r) }))]);
    noImgLabel.textContent = `${at('list.noImage')} (${count('noImage', (c) => !(c.images || []).length)})`;
  }

  function fillList() {
    const rows = ds.cells.filter((c) => pass(c, filters)).sort((a, b) => a.en.localeCompare(b.en));
    countLine.textContent = at('list.shown', { n: rows.length, total: ds.cells.length });
    list.replaceChildren(...rows.map((c) => h('li', {}, h('a', { href: '#/edit/' + idToHash(c.id), 'aria-current': String(c.id === selectedId), onclick: onNavigate ? () => onNavigate() : null },
      h('div', { class: 'th', text: c.th }),
      h('div', { class: 'meta' },
        h('span', { text: c.en }), h('span', { class: 'mono', text: c.id }),
        h('span', { class: 'adm-tag review-' + c.review, text: at('review.' + c.review) }),
        c.kind === 'class' ? h('span', { class: 'adm-tag', text: at('list.class') }) : null,
        h('span', { class: 'adm-tag', text: at('list.imgCount', { n: (c.images || []).length }) }),
        pendingIds.has(c.id) ? h('span', { class: 'adm-dot', title: at('list.pending'), role: 'img', 'aria-label': at('list.pending') }) : null)))));
  }
  const refresh = () => { fillOptions(); fillList(); };

  search.addEventListener('input', () => { filters.q = search.value; refresh(); });
  sysSel.addEventListener('change', () => { filters.system = sysSel.value; refresh(); });
  tisSel.addEventListener('change', () => { filters.tissue = tisSel.value; refresh(); });
  revSel.addEventListener('change', () => { filters.review = revSel.value; refresh(); });
  noImg.addEventListener('change', () => { filters.noImage = noImg.checked; refresh(); });
  refresh();

  const tissues = h('details', {}, h('summary', { text: at('list.tissuesTitle', { n: ds.tissues.length }) }),
    h('ul', { class: 'adm-list' }, ds.tissues.map((t) => h('li', {}, h('a', { href: '#/tissue/' + encodeURIComponent(t.id), onclick: onNavigate ? () => onNavigate() : null },
      h('div', { class: 'th', text: t.th }),
      h('div', { class: 'meta' }, h('span', { text: t.en }), h('span', { class: 'adm-tag', text: at('list.imgCount', { n: (t.images || []).length }) }),
        S.overlay.tissues[t.id] ? h('span', { class: 'adm-dot', title: at('list.pending') }) : null))))));

  return h('div', { class: 'adm-listpanel' },
    h('div', { class: 'adm-row' }, h('a', { class: 'adm-btn adm-btn-primary', href: '#/new', id: 'adm-new' }, at('list.new'))),
    h('div', { class: 'adm-filters' }, search, sysSel, tisSel, revSel,
      h('label', { class: 'adm-check', for: 'adm-noimg' }, noImg, noImgLabel)),
    countLine, list, tissues);
}

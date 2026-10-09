// ส่วนประกอบหน้าตาที่ใช้ซ้ำหลายหน้า: ช่องค้นหา สัญลักษณ์เส้น legend ปุ่มเปิดปิด

import { store, searchCells, colorKey, MODES, crossSystemEdges, cellName, cellAlt, subtypeName, tissueName } from './data.js';
import { h, cellHref } from './util.js';
import { colorForKey } from './graph.js';
import { t } from './i18n.js';

// ช่องค้นหาเซลล์ onPick(cell) ถ้าไม่ระบุจะไปหน้าเซลล์ opts: {id, label} (id ต้องไม่ซ้ำเมื่อมีหลายช่องในหน้าเดียว)
export function searchBox(onPick, opts = {}) {
  const id = opts.id || 'q';
  const input = h('input', {
    id, type: 'search', autocomplete: 'off', role: 'combobox',
    'aria-expanded': 'false', 'aria-controls': id + '-results', 'aria-autocomplete': 'list',
    placeholder: t('search.placeholder'),
  });
  const list = h('ul', { id: id + '-results', class: 'search-results', role: 'listbox', 'aria-label': t('search.results'), hidden: true });
  const status = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const wrap = h('div', { class: 'search' }, h('label', { for: id, text: opts.label || t('search.label') }), input, list, status);

  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  function update() {
    const q = input.value;
    list.replaceChildren();
    if (!q.trim()) { close(); status.textContent = ''; return; }
    const res = searchCells(q);
    if (!res.length) {
      list.append(h('li', { class: 'search-note', role: 'presentation' }, t('search.none', { q })));
    }
    for (const c of res) {
      list.append(h('li', { role: 'presentation' },
        h('a', { role: 'option', href: cellHref(c.id), 'data-id': c.id },
          h('span', { class: 'th' }, cellName(c)), h('span', { class: 'en' }, cellAlt(c)), h('span', { class: 'mono' }, c.id))));
    }
    status.textContent = res.length ? t('search.count', { n: res.length }) : t('search.noneStatus');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function pick(a) {
    if (!onPick) { location.hash = a.getAttribute('href'); return; }
    const cell = store.cellsById.get(a.dataset.id);
    close();
    input.value = '';
    if (cell) onPick(cell);
  }
  list.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && onPick) { e.preventDefault(); pick(a); }
  });
  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('keydown', (e) => {
    const links = [...list.querySelectorAll('a')];
    if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); links[0].focus(); }
    else if (e.key === 'Enter' && links.length) { e.preventDefault(); pick(links[0]); }
    else if (e.key === 'Escape') { close(); }
  });
  list.addEventListener('keydown', (e) => {
    const links = [...list.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (links[i + 1] || links[i]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : links[i - 1]).focus(); }
    else if (e.key === 'Escape') { input.focus(); close(); }
    else if (e.key === 'Enter' && onPick && i >= 0) { e.preventDefault(); pick(links[i]); }
  });
  const outside = (e) => { if (!wrap.contains(e.target)) close(); };
  document.addEventListener('click', outside);
  return { el: wrap, destroy: () => document.removeEventListener('click', outside) };
}

export function edgeSwatch(type, mode) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 34 12');
  svg.setAttribute('aria-hidden', 'true');
  const color = mode ? `var(--mode-${mode})` : { develops_from: 'var(--edge-dev)', is_a: 'var(--edge-isa)' }[type];
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M2 6 H 24');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', mode === 'synapse' ? '3' : type === 'is_a' ? '1.5' : '2');
  const dash = { is_a: '5 3', paracrine: '4 3', support: '1.5 3' }[mode || type];
  if (dash) path.setAttribute('stroke-dasharray', dash);
  if (mode === 'support') path.setAttribute('stroke-linecap', 'round');
  // หัวลูกศรต่างกันตามชนิด เพื่อไม่ต้องพึ่งสีอย่างเดียว
  const head = document.createElementNS(ns, 'path');
  const shape = {
    develops_from: ['M24 1.5 L32 6 L24 10.5 Z', color], is_a: ['M24 1.5 L32 6 L24 10.5 Z', 'none'],
    hormone: ['M24 6 L28 2 L32 6 L28 10 Z', color], synapse: ['M26 6 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', color],
    paracrine: ['M24 1.5 L32 6 L24 10.5 Z M32 1.5 V10.5', 'none'], support: ['M28 1 V11', 'none'],
    immune: ['M23 2 L31 6 L23 10', 'none'],
  }[mode || type];
  head.setAttribute('d', shape[0]);
  head.setAttribute('stroke', color);
  head.setAttribute('stroke-width', '1.6');
  head.setAttribute('fill', shape[1]);
  svg.append(path, head);
  return svg;
}

export function legendFor(cells, systemId, opts = {}) {
  const keys = [];
  for (const c of cells) { const k = colorKey(c); if (!keys.includes(k)) keys.push(k); }
  const label = (k) => (store.subtypes.has(k) ? subtypeName(k) : store.tissuesById.has(k) ? tissueName(store.tissuesById.get(k)) : k);
  const items = keys.map((k) => h('span', {}, h('i', { class: 'sw', style: `background:${colorForKey(k)}` }), label(k)));
  if (cells.some((c) => c.kind === 'class')) items.push(h('span', {}, h('i', { class: 'sw cls' }), t('legend.class')));
  if (opts.overview) {
    items.push(h('span', {}, h('i', { class: 'sw dotmark' }), t('legend.dots')));
  } else if (cells.some((c) => (c.systems || []).some((s) => s !== systemId))) {
    items.push(h('span', {}, h('i', { class: 'sw ring' }), t('legend.ring')));
  }
  if (!opts.overview && crossSystemEdges(systemId).length) {
    items.push(h('span', {}, h('i', { class: 'sw ghost' }), t('legend.ghost')));
  }
  return h('div', { class: 'legend', 'aria-label': t('legend.aria') }, items);
}

// mode ของ interacts_with ที่มีในข้อมูลทั้งหมด (เรียงตามลำดับมาตรฐาน)
export function modesInData() {
  const present = new Set(store.edges.filter((e) => e.type === 'interacts_with' && e.mode).map((e) => e.mode));
  return MODES.filter((m) => present.has(m.id));
}

export function makeToggle(label, swatch, onChange, pressed = true) {
  const b = h('button', { type: 'button', class: 'toggle', 'aria-pressed': String(pressed), onclick: () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    onChange(on);
  } }, swatch, h('span', { class: 'label' }, label));
  return b;
}

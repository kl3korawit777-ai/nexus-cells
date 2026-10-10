// เปรียบเทียบสองเซลล์ (#/compare/<A>/<B>) และหน้ารวมคู่ที่มักสับสน (#/compare)

import { store, cellName, cellAlt, sysName, tissueName, subtypeName, edgeSentence, colorKey } from './data.js';
import { t, getLang } from './i18n.js';
import { h, cellHref, idToHash, hashToId, onThemeChange } from './util.js';
import { textOf, listOf } from './content.js';
import { imageFigure } from './gallery.js';
import { imagesOf, typesIn, pickByType } from './images.js';
import { searchBox } from './ui.js';
import { buildStyle, ensureFcose } from './graph.js';
import { notFoundView } from './views.js';

const cytoscape = window.cytoscape;
const compareHref = (a, b) => '#/compare/' + idToHash(a) + (b ? '/' + idToHash(b) : '');
const EDGE_CLASS = { develops_from: 'e-dev', is_a: 'e-isa', interacts_with: 'e-int' };

const thaiOnlyChip = () => h('span', { class: 'chip chip-thai', text: t('common.thaiOnly') });
const norm = (s) => String(s).toLowerCase().trim();

// ------------------------------------------------------------------ เส้นทางที่สั้นที่สุด (ทุกชนิดเส้น ไม่สนทิศ)

export function shortestPath(fromId, toId) {
  if (fromId === toId) return { nodes: [fromId], edges: [] };
  const adj = new Map();
  const add = (a, b, e) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, edge: e }); };
  for (const e of store.edges) { add(e.from, e.to, e); add(e.to, e.from, e); }
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length) {
    const x = queue.shift();
    if (x === toId) break;
    for (const { to, edge } of adj.get(x) || []) {
      if (prev.has(to)) continue;
      prev.set(to, { from: x, edge });
      queue.push(to);
    }
  }
  if (!prev.has(toId)) return null;
  const nodes = [toId], edges = [];
  for (let cur = toId; prev.get(cur);) {
    const p = prev.get(cur);
    edges.unshift(p.edge);
    nodes.unshift(p.from);
    cur = p.from;
  }
  return { nodes, edges };
}

function createPathGraph(container, path) {
  ensureFcose();
  const vertical = container.clientWidth < 520;
  const step = vertical ? 86 : 170;
  const els = path.nodes.map((id, i) => {
    const c = store.cellsById.get(id);
    return {
      group: 'nodes',
      data: { id, label: cellName(c), ck: colorKey(c) },
      position: vertical ? { x: (i % 2) * 70, y: i * step } : { x: i * step, y: (i % 2) * 40 },
      classes: 'cell' + (c.kind === 'class' ? ' cls' : ''),
    };
  });
  path.edges.forEach((e, i) => {
    const flip = e.type === 'develops_from';
    els.push({
      group: 'edges',
      data: { id: 'p' + i, source: flip ? e.to : e.from, target: flip ? e.from : e.to },
      classes: EDGE_CLASS[e.type] + (e.mode ? ' m-' + e.mode : ''),
    });
  });
  const cy = cytoscape({
    container, elements: els, style: buildStyle(), layout: { name: 'preset', fit: true, padding: 30 },
    userZoomingEnabled: false, boxSelectionEnabled: false, autoungrabify: true,
  });
  cy.nodes().style({ width: 34, height: 34, 'font-size': 12, 'text-max-width': 120 });
  cy.fit(undefined, 30);
  cy.on('tap', 'node', (ev) => { location.hash = cellHref(ev.target.id()); });
  const off = onThemeChange(() => { cy.style(buildStyle()); cy.nodes().style({ width: 34, height: 34, 'font-size': 12, 'text-max-width': 120 }); });
  const ro = new ResizeObserver(() => { if (container.offsetWidth) { cy.resize(); cy.fit(undefined, 30); } });
  ro.observe(container);
  return { destroy() { off(); ro.disconnect(); cy.destroy(); } };
}

// ------------------------------------------------------------------ ตารางเทียบ

function textRow(label, ta, tb) {
  if (!ta.text && !tb.text) return null;
  const cellOf = (x) => (x.text ? [x.text, x.thaiOnly ? thaiOnlyChip() : null] : h('span', { class: 'cmp-none', text: t('cmp.none') }));
  return { label, a: cellOf(ta), b: cellOf(tb), diff: norm(ta.text) !== norm(tb.text) };
}

function listRows(label, la, lb) {
  const A = la.items, B = lb.items;
  if (!A.length && !B.length) return [];
  const nb = new Set(B.map(norm)), na = new Set(A.map(norm));
  const common = A.filter((x) => nb.has(norm(x)));
  const onlyA = A.filter((x) => !nb.has(norm(x)));
  const onlyB = B.filter((x) => !na.has(norm(x)));
  const rows = [];
  const chips = (items) => (items.length ? items.map((x) => h('span', { class: 'chip', text: x })) : h('span', { class: 'cmp-none', text: t('cmp.none') }));
  const thai = la.thaiOnly || lb.thaiOnly ? thaiOnlyChip() : null;
  if (common.length) rows.push({ label: t('cmp.common', { field: label }), span: [h('span', { class: 'chips' }, chips(common)), thai], common: true });
  rows.push({ label: t('cmp.only', { field: label }), a: h('span', { class: 'chips' }, chips(onlyA)), b: h('span', { class: 'chips' }, chips(onlyB)), diff: onlyA.length > 0 || onlyB.length > 0 });
  return rows;
}

function linkList(ids) {
  const cells = ids.map((i) => store.cellsById.get(i)).filter(Boolean);
  if (!cells.length) return h('span', { class: 'cmp-none', text: t('cmp.none') });
  return h('span', { class: 'cmp-links' }, cells.flatMap((c, i) => (i ? [', ', h('a', { href: cellHref(c.id) }, cellName(c))] : [h('a', { href: cellHref(c.id) }, cellName(c))])));
}

function buildRows(A, B) {
  const lang = getLang();
  const rows = [];
  const push = (r) => { if (r) rows.push(...[].concat(r)); };
  rows.push({ label: t('field.id'), a: h('span', { class: 'mono', text: A.id }), b: h('span', { class: 'mono', text: B.id }), diff: true });
  const sys = (c) => (c.systems || []).map((s) => sysName(store.systemsById.get(s))).join(', ');
  push(textRow(t('field.systems'), { text: sys(A) }, { text: sys(B) }));
  const tis = (c) => {
    const tt = store.tissuesById.get(c.tissue);
    const st = subtypeName(c.tissue_subtype);
    return tt ? tissueName(tt) + (st ? ' · ' + st : '') : '';
  };
  push(textRow(t('field.tissue'), { text: tis(A) }, { text: tis(B) }));
  for (const f of ['location', 'morphology', 'function']) push(textRow(t('field.' + f), textOf(A, f, lang), textOf(B, f, lang)));
  for (const f of ['secretes', 'markers']) push(listRows(t('field.' + f), listOf(A, f, lang), listOf(B, f, lang)));
  push(textRow(t('field.lifespan'), textOf(A, 'lifespan', lang), textOf(B, 'lifespan', lang)));
  push(textRow(t('field.exam'), textOf(A, 'exam', lang), textOf(B, 'exam', lang)));
  push(listRows(t('field.diseases'), listOf(A, 'diseases', lang), listOf(B, 'diseases', lang)));
  if ((A.confused_with || []).length || (B.confused_with || []).length) {
    rows.push({ label: t('field.confused'), a: linkList(A.confused_with || []), b: linkList(B.confused_with || []), diff: false });
  }
  return rows;
}

function table(A, B) {
  const nameA = cellName(A), nameB = cellName(B);
  const head = h('thead', {}, h('tr', {},
    h('th', { scope: 'col', class: 'cmp-corner', text: t('cmp.field') }),
    h('th', { scope: 'col', class: 'cmp-a' }, h('a', { href: cellHref(A.id) }, nameA), h('span', { class: 'alt', text: cellAlt(A) })),
    h('th', { scope: 'col', class: 'cmp-b' }, h('a', { href: cellHref(B.id) }, nameB), h('span', { class: 'alt', text: cellAlt(B) }))));
  const body = h('tbody', {}, buildRows(A, B).map((r) => {
    if (r.span) {
      return h('tr', { class: 'cmp-common' }, h('th', { scope: 'row', text: r.label }), h('td', { colspan: '2' }, r.span));
    }
    return h('tr', { class: r.diff ? 'cmp-diff' : '' },
      h('th', { scope: 'row' }, r.label, r.diff ? h('span', { class: 'sr-only', text: ' (' + t('cmp.differs') + ')' }) : null),
      h('td', { 'data-name': nameA }, r.a), h('td', { 'data-name': nameB }, r.b));
  }));
  return h('table', { class: 'cmp-table' }, h('caption', { class: 'sr-only', text: t('cmp.caption', { a: nameA, b: nameB }) }), head, body);
}

// ------------------------------------------------------------------ ตัวเลือกเซลล์

function pickers(a, b) {
  const wrap = h('div', { class: 'cmp-pickers' });
  const slot = (cell, id, label, other, isA) => {
    const box = searchBox((picked) => { location.hash = isA ? compareHref(picked.id, other && other.id) : compareHref(other ? other.id : picked.id, other ? picked.id : null); }, { id, label });
    return h('div', { class: 'cmp-slot' }, box.el,
      cell ? h('p', { class: 'cmp-current' }, h('span', { class: 'chip' }, h('span', { class: 'dot', style: `background:var(--accent)` }), cellName(cell))) : null);
  };
  wrap.append(slot(a, 'cmp-a-q', t('cmp.cellA'), b, true), slot(b, 'cmp-b-q', t('cmp.cellB'), a, false));
  return wrap;
}

// รูปของสองเซลล์เคียงกัน เลือกประเภทรูปที่จะเทียบได้ (ค่าเริ่มต้น = รูปหลักของแต่ละเซลล์)
let cmpType = null;
function imagesPanel(A, B) {
  const types = typesIn([...imagesOf(A), ...imagesOf(B)]);
  if (cmpType && !types.includes(cmpType)) cmpType = null;
  const wrap = h('section', { class: 'cmp-imgs' });
  const draw = () => {
    const fig = (c) => {
      const img = pickByType(c, cmpType);
      const empty = cmpType && !img && imagesOf(c).length ? t('cmp.noImageOfType', { type: t('img.type.' + cmpType) }) : null;
      return h('div', { class: 'cmp-item' }, h('p', { class: 'cmp-name', text: cellName(c) }), imageFigure(img, cellName(c), `images/${c.slug}/`, { emptyText: empty }));
    };
    const mk = (ty) => h('button', { type: 'button', class: 'gal-chip', 'aria-pressed': String(cmpType === ty),
      onclick: () => { cmpType = ty; draw(); } }, ty ? t('img.type.' + ty) : t('cmp.mainImage'));
    wrap.replaceChildren(
      types.length > 1 ? h('div', { class: 'gal-filter', role: 'group', 'aria-label': t('cmp.imageTypeLabel') }, mk(null), types.map(mk)) : null,
      h('div', { class: 'cmp-images' }, fig(A), fig(B)));
  };
  draw();
  return wrap;
}

// ------------------------------------------------------------------ หน้าเปรียบเทียบ

export function compareView(idA, idB) {
  const bad = (id) => !/^CL_\d{7}$/.test(id) || !store.cellsById.has(hashToId(id));
  for (const id of [idA, idB].filter(Boolean)) {
    if (bad(id)) return notFoundView(t('notfound.cell'), t('compare.notFoundCell', { id }));
  }
  const A = store.cellsById.get(hashToId(idA));
  const B = idB ? store.cellsById.get(hashToId(idB)) : null;
  let pathGraph = null;
  const children = [
    h('a', { class: 'crumb', href: '#/compare' }, t('compare.backToPairs')),
    h('header', { class: 'sys-head' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: t('compare.title') }),
      h('p', { class: 'sub-title', text: B ? t('compare.subtitle', { a: cellName(A), b: cellName(B) }) : t('compare.pickSecond', { a: cellName(A) }) })),
    pickers(A, B),
  ];
  let after = null;
  if (B) {
    children.push(h('div', { class: 'toolbar' },
      h('a', { class: 'btn', href: compareHref(B.id, A.id) }, t('compare.swap'))));
    children.push(imagesPanel(A, B));
    children.push(table(A, B));

    // เส้นทางในใย
    const path = shortestPath(A.id, B.id);
    const section = h('section', { class: 'cmp-path' }, h('h2', { class: 'section', text: t('compare.pathTitle') }));
    if (A.id === B.id) section.append(h('p', { class: 'empty', text: t('compare.sameCell') }));
    else if (!path) section.append(h('p', { class: 'empty', text: t('compare.noPath') }));
    else {
      section.append(h('p', { class: 'sub-title', text: t('compare.pathLength', { n: path.edges.length }) }));
      const box = h('div', { class: 'mini-graph cmp-graph', role: 'img', 'aria-label': t('compare.pathAria', { a: cellName(A), b: cellName(B) }) }, h('div', { class: 'cy' }));
      section.append(box);
      section.append(h('ol', { class: 'cmp-steps' }, path.edges.map((e, i) => {
        const from = store.cellsById.get(path.nodes[i]), to = store.cellsById.get(path.nodes[i + 1]);
        return h('li', {}, h('span', { class: 'cmp-step-path' }, h('a', { href: cellHref(from.id) }, cellName(from)), ' → ', h('a', { href: cellHref(to.id) }, cellName(to))),
          h('span', { class: 'note', text: edgeSentence(e) }));
      })));
      after = () => { pathGraph = createPathGraph(box.querySelector('.cy'), path); };
    }
    children.push(section);
  } else {
    const sugg = (A.confused_with || []).map((i) => store.cellsById.get(i)).filter(Boolean);
    if (sugg.length) {
      children.push(h('section', {}, h('h2', { class: 'section', text: t('compare.suggested') }),
        h('ul', { class: 'cell-list' }, sugg.map((c) => h('li', {}, h('a', { href: compareHref(A.id, c.id) }, h('div', { class: 'th', text: cellName(c) }), h('div', { class: 'en', text: cellAlt(c) })))))));
    }
  }
  return {
    title: B ? t('compare.titlePair', { a: cellName(A), b: cellName(B) }) : t('compare.title'),
    el: h('div', { class: 'compare' }, children),
    after: () => { if (after) after(); },
    destroy: () => pathGraph && pathGraph.destroy(),
  };
}

// ------------------------------------------------------------------ หน้ารวมคู่ที่มักสับสน

export function confusablesView() {
  const seen = new Set();
  const groups = new Map();
  for (const c of store.cells) {
    for (const id of c.confused_with || []) {
      const o = store.cellsById.get(id);
      if (!o) continue;
      const key = [c.id, o.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const sys = (c.systems || [])[0] || 'other';
      if (!groups.has(sys)) groups.set(sys, []);
      groups.get(sys).push([c, o]);
    }
  }
  const sel = { a: null, b: null };
  const status = h('p', { class: 'cmp-current', role: 'status', 'aria-live': 'polite' });
  const choose = (which) => (cell) => {
    sel[which] = cell;
    status.replaceChildren(...['a', 'b'].filter((k) => sel[k]).map((k) => h('span', { class: 'chip' }, (k === 'a' ? 'A: ' : 'B: ') + cellName(sel[k]))));
    if (sel.a && sel.b) location.hash = compareHref(sel.a.id, sel.b.id);
  };
  const sa = searchBox(choose('a'), { id: 'cmp-free-a', label: t('cmp.cellA') });
  const sb = searchBox(choose('b'), { id: 'cmp-free-b', label: t('cmp.cellB') });
  const list = store.systems.filter((s) => groups.has(s.id)).map((s) =>
    h('section', { class: 'cmp-group' },
      h('h3', {}, h('span', { class: 'dot', style: `background:${s.color}` }), ' ', sysName(s), h('span', { class: 'chip', text: t('compare.pairCount', { n: groups.get(s.id).length }) })),
      h('ul', { class: 'cell-list' }, groups.get(s.id).map(([a, b]) => h('li', {},
        h('a', { href: compareHref(a.id, b.id), style: `--c:${s.color}` }, h('div', { class: 'th', text: `${cellName(a)} ↔ ${cellName(b)}` }), h('div', { class: 'en', text: cellAlt(a) ? `${cellAlt(a)} ↔ ${cellAlt(b)}` : '' })))))));
  return {
    title: t('compare.pairsTitle'),
    el: h('div', { class: 'compare' },
      h('a', { class: 'crumb', href: '#/' }, t('nav.backHome')),
      h('header', { class: 'sys-head' },
        h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: t('compare.pairsTitle') }),
        h('p', { class: 'sub-title', text: t('compare.pairsIntro') })),
      h('div', { class: 'cmp-pickers' }, h('div', { class: 'cmp-slot' }, sa.el), h('div', { class: 'cmp-slot' }, sb.el)),
      status,
      h('h2', { class: 'section', text: t('compare.pairsHeading', { n: seen.size }) }),
      list.length ? list : h('p', { class: 'empty', text: t('compare.noPairs') })),
    destroy: () => { sa.destroy(); sb.destroy(); },
  };
}

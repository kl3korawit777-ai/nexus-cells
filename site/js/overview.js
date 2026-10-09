// ใยภาพรวมทั้งร่างกาย: จัดกลุ่มตามระบบหรือตามเนื้อเยื่อ ซูมสองระดับ และตารางสรุปการเชื่อมข้ามกลุ่ม
// ตำแหน่งมาจาก data/layout-overview.json (คำนวณล่วงหน้า) ดู overview-data.js

import { store, edgeSentence, colorKey, cellName, sysName, tissueName } from './data.js';
import { h, cellHref, systemHref, cssVar, onThemeChange, reducedMotion } from './util.js';
import { buildStyle } from './graph.js';
import { t, getLang } from './i18n.js';
import { nameOf } from './content.js';
import { renderPeek } from './card.js';
import { searchBox, edgeSwatch, legendFor, modesInData, makeToggle } from './ui.js';
import { loadOverviewLayout, overviewData } from './overview-data.js';
import { groupsFor } from './overview-layout.js';

const cytoscape = window.cytoscape;
const EDGE_CLASS = { develops_from: 'e-dev', is_a: 'e-isa', interacts_with: 'e-int' };
const ZOOM_IN_RATIO = 1.6; // ซูมเกินระดับพอดีจอกี่เท่าจึงถือว่าเป็นระดับซูมเข้า
const groupLabel = (g) => nameOf(g, getLang());

// ------------------------------------------------------------------ สไตล์

const isDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function dotUri(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="3.4" fill="${color}" stroke="${cssVar('--surface') || '#fff'}" stroke-width="1"/></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
const dotList = (n) => (n.data('dots') || []).map(dotUri);

export function overviewStyle() {
  const ink = cssVar('--ink'), surface = cssVar('--surface'), muted = cssVar('--muted'), focus = cssVar('--focus');
  const dark = isDark();
  return [
    ...buildStyle(),
    { selector: 'node.cell', style: { width: 16, height: 16, 'font-size': 10, 'text-max-width': 84, 'border-width': 1.5 } },
    { selector: 'node.cell.cls', style: { width: 24, height: 14 } },
    { selector: 'node.cell.lvl-coarse', style: { 'text-opacity': 0, 'text-background-opacity': 0 } },
    { selector: 'node.cell.lvl-coarse.hl', style: { 'text-opacity': 1, 'text-background-opacity': 0.8 } },
    {
      // เซลล์หลายระบบ (เมื่อจัดกลุ่มตามระบบ): จุดสีเล็กของระบบอื่นที่ขอบ
      selector: 'node.cell.multi',
      style: {
        'background-image': (n) => dotList(n),
        'background-width': (n) => dotList(n).map(() => 8),
        'background-height': (n) => dotList(n).map(() => 8),
        'background-position-x': (n) => dotList(n).map(() => '11px'),
        'background-position-y': (n) => dotList(n).map((_, i) => `${-3 + i * 7}px`),
        'background-fit': 'none',
        'background-clip': 'none',
      },
    },
    {
      selector: 'node.group',
      style: {
        shape: 'round-rectangle',
        'background-color': (n) => n.data('color'),
        'background-opacity': dark ? 0.18 : 0.11,
        'border-width': 1.5,
        'border-color': (n) => n.data('color'),
        'border-opacity': 0.7,
        padding: 24,
        label: 'data(label)',
        'text-valign': 'top',
        'text-halign': 'center',
        'font-size': 16,
        'font-weight': 600,
        color: ink,
        'text-background-opacity': 0,
        'text-wrap': 'none',
        'z-index': 1,
      },
    },
    { selector: 'node.group.hl-group', style: { 'border-width': 4, 'border-color': focus, 'border-opacity': 1, 'background-opacity': dark ? 0.32 : 0.24 } },
    {
      selector: 'edge.agg',
      style: {
        'curve-style': 'bezier', 'line-color': muted, width: 'data(w)', opacity: 0.75,
        label: 'data(label)', 'font-size': 14, color: ink, 'text-rotation': 'none',
        'text-background-color': surface, 'text-background-opacity': 0.92, 'text-background-padding': 3,
        'text-background-shape': 'roundrectangle', 'target-arrow-shape': 'none', 'z-index': 5,
      },
    },
    { selector: 'edge.real.lvl-coarse', style: { display: 'none' } },
    { selector: 'edge.real.lvl-coarse.hl', style: { display: 'element' } },
    { selector: 'edge.agg.lvl-fine', style: { display: 'none' } },
    { selector: '.hidden', style: { display: 'none' } },
  ];
}

// ------------------------------------------------------------------ องค์ประกอบ

function groupMap(mode) {
  const groups = groupsFor(mode, overviewData());
  const of = new Map();
  groups.forEach((g) => g.members.forEach((id) => of.set(id, g.id)));
  return { groups, of };
}

function cellElements(layout, mode, withEdges) {
  const pos = layout.modes[mode].positions;
  const { groups, of } = groupMap(mode);
  const els = groups.map((g) => ({ group: 'nodes', data: { id: 'g:' + g.id, label: groupLabel(g), color: g.color, gid: g.id }, classes: 'group' }));
  for (const c of store.cells) {
    const others = mode === 'system' ? (c.systems || []).slice(1) : [];
    const p = pos[c.id] || [0, 0];
    els.push({
      group: 'nodes',
      data: {
        id: c.id, label: c.en, ck: colorKey(c), parent: 'g:' + of.get(c.id),
        dots: others.map((s) => (store.systemsById.get(s) || {}).color).filter(Boolean),
      },
      position: { x: p[0], y: p[1] },
      classes: 'cell' + (c.kind === 'class' ? ' cls' : '') + (others.length ? ' multi' : ''),
    });
  }
  if (withEdges) {
    store.edges.forEach((e, i) => {
      const flip = e.type === 'develops_from';
      els.push({
        group: 'edges',
        data: { id: 'e' + i, source: flip ? e.to : e.from, target: flip ? e.from : e.to, type: e.type, th: e.th || '', mode: e.mode || '', from: e.from, to: e.to },
        classes: 'real ' + EDGE_CLASS[e.type] + (e.mode ? ' m-' + e.mode : ''),
      });
    });
  }
  return els;
}

// เส้นรวมระหว่างกลุ่ม: ความหนาตามจำนวนเส้น ตัวเลขกำกับ (นับเฉพาะเส้นที่ไม่ถูกซ่อน)
function rebuildAgg(cy, level) {
  cy.edges('.agg').remove();
  const counts = new Map();
  cy.edges('.real').forEach((e) => {
    if (e.hasClass('hidden')) return;
    const a = e.source().parent().id(), b = e.target().parent().id();
    if (a === b) return;
    const key = a < b ? a + '|' + b : b + '|' + a;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const adds = [];
  for (const [key, n] of counts) {
    const [a, b] = key.split('|');
    adds.push({ group: 'edges', data: { id: 'agg:' + key, source: a, target: b, label: String(n), w: Math.min(18, 2 + n * 1.1) }, classes: 'agg' + (level === 'fine' ? ' lvl-fine' : '') });
  }
  cy.add(adds);
}

function boxesBounds(boxes) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of Object.values(boxes)) { x1 = Math.min(x1, b[0]); y1 = Math.min(y1, b[1]); x2 = Math.max(x2, b[2]); y2 = Math.max(y2, b[3]); }
  return { x1, y1, x2, y2 };
}

// ซูมและตำแหน่งที่ทำให้กรอบเห็นพอดีจอ
function fitFor(cy, bb, pad = 24) {
  const W = cy.width(), H = cy.height();
  const bw = Math.max(1, bb.x2 - bb.x1), bh = Math.max(1, bb.y2 - bb.y1);
  const zoom = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh, 3);
  return { zoom, pan: { x: W / 2 - ((bb.x1 + bb.x2) / 2) * zoom, y: H / 2 - ((bb.y1 + bb.y2) / 2) * zoom } };
}

// ------------------------------------------------------------------ ใยภาพรวม

export async function createOverviewGraph(container, initialMode, handlers = {}) {
  const layout = await loadOverviewLayout();
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  let mode = initialMode;
  let level = 'coarse';
  let baseZoom = 1;
  let destroyed = false;
  const visible = { develops_from: true, is_a: true };
  modesInData().forEach((m) => { visible['mode:' + m.id] = true; });
  let crossOnly = false;

  const cy = cytoscape({
    container,
    elements: cellElements(layout, mode, true),
    style: overviewStyle(),
    layout: { name: 'preset' },
    minZoom: 0.04,
    maxZoom: 4,
    boxSelectionEnabled: false,
    textureOnViewport: true,
    hideLabelsOnViewport: mobile,
    // ข้อมูลมาก (หลายร้อยเส้น): ซ่อนเส้นชั่วคราวระหว่างลาก/ซูมเพื่อให้ลื่น
    hideEdgesOnViewport: store.edges.length > 400,
  });
  container.__cy = cy;

  // กรอบที่ใช้จัดให้พอดีจอ: รวมความกว้างของชื่อกลุ่ม (ซึ่งยื่นออกนอกกล่องและขยายตามซูม) ด้วย
  function computeFit() {
    const boxes = layout.modes[mode].boxes;
    const groups = groupMap(mode).groups;
    let f = fitFor(cy, boxesBounds(boxes));
    for (let pass = 0; pass < 2; pass++) {
      const fs = Math.max(16, 15 / f.zoom);
      const bb = boxesBounds(boxes);
      for (const g of groups) {
        const b = boxes[g.id];
        if (!b) continue;
        const w = groupLabel(g).length * fs * 0.6;
        const cx = (b[0] + b[2]) / 2;
        bb.x1 = Math.min(bb.x1, cx - w / 2);
        bb.x2 = Math.max(bb.x2, cx + w / 2);
        bb.y1 = Math.min(bb.y1, b[1] - fs * 1.7);
      }
      f = fitFor(cy, bb);
    }
    return f;
  }
  function applyView(animate) {
    const f = computeFit();
    baseZoom = f.zoom;
    if (animate && !reducedMotion()) cy.animate({ zoom: f.zoom, pan: f.pan }, { duration: 650, easing: 'ease-in-out' });
    else { cy.zoom(f.zoom); cy.pan(f.pan); }
    if (!animate || reducedMotion()) updateLevel(true);
  }

  function updateFonts() {
    const z = cy.zoom();
    cy.nodes('.group').style('font-size', level === 'coarse' ? Math.max(16, 15 / z) : 16);
    cy.edges('.agg').style('font-size', Math.max(13, 13 / z));
  }
  function updateLevel(force) {
    const lv = cy.zoom() < baseZoom * ZOOM_IN_RATIO ? 'coarse' : 'fine';
    if (force || lv !== level) {
      level = lv;
      cy.batch(() => {
        cy.nodes('.cell').toggleClass('lvl-coarse', lv === 'coarse');
        cy.edges('.real').toggleClass('lvl-coarse', lv === 'coarse');
        cy.edges('.agg').toggleClass('lvl-fine', lv === 'fine');
      });
      if (handlers.onLevel) handlers.onLevel(lv);
    }
    updateFonts();
  }
  let raf = 0;
  cy.on('zoom', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (!destroyed) updateLevel(false); }); });

  // ---- ตัวกรองเส้น
  function applyFilters() {
    cy.batch(() => {
      cy.edges('.real').forEach((e) => {
        const t = e.data('type');
        const key = t === 'interacts_with' ? 'mode:' + e.data('mode') : t;
        let hide = visible[key] === false;
        if (!hide && crossOnly) hide = e.source().parent().id() === e.target().parent().id();
        e.toggleClass('hidden', hide);
      });
    });
    rebuildAgg(cy, level);
    updateFonts();
    clearSelection();
  }

  // ---- เลือกเซลล์
  function clearSelection(notify = false) {
    cy.batch(() => {
      cy.elements().removeClass('faded sel hl hl-group');
    });
    if (notify && handlers.onClear) handlers.onClear();
  }
  function selectNode(id, notify = true) {
    const n = cy.getElementById(id);
    if (n.empty()) return;
    const edges = n.connectedEdges('.real').not('.hidden');
    const nh = edges.connectedNodes().union(n);
    cy.batch(() => {
      cy.elements().removeClass('faded sel hl hl-group');
      cy.elements('.cell, .real, .agg').addClass('faded');
      nh.removeClass('faded').addClass('hl');
      edges.removeClass('faded').addClass('hl');
      n.addClass('sel');
      if (mode === 'system') {
        const cell = store.cellsById.get(id);
        const own = n.parent().id();
        (cell.systems || []).forEach((s) => { if ('g:' + s !== own) cy.getElementById('g:' + s).addClass('hl-group'); });
      }
    });
    if (notify && handlers.onSelectNode) handlers.onSelectNode(store.cellsById.get(id));
  }

  function zoomTo(eles, ratio) {
    const dur = reducedMotion() ? 0 : 450;
    if (ratio) cy.animate({ center: { eles }, zoom: Math.min(cy.maxZoom(), Math.max(cy.zoom(), baseZoom * ratio)) }, { duration: dur });
    else cy.animate({ fit: { eles, padding: 40 }, duration: dur });
  }

  cy.on('tap', 'node.cell', (ev) => selectNode(ev.target.id()));
  cy.on('tap', 'node.group', (ev) => { if (level === 'coarse') zoomTo(ev.target); });
  cy.on('tap', 'edge.real', (ev) => {
    const d = ev.target.data();
    if (handlers.onSelectEdge) handlers.onSelectEdge(edgeSentence({ type: d.type, from: d.from, to: d.to, th: d.th, mode: d.mode }));
  });
  cy.on('tap', 'edge.agg', (ev) => {
    const e = ev.target;
    const name = (id) => (cy.getElementById(id).data('label') || id);
    if (handlers.onSelectEdge) handlers.onSelectEdge(t('overview.aggInfo', { a: name(e.data('source')), b: name(e.data('target')), n: e.data('label') }));
  });
  cy.on('tap', (ev) => { if (ev.target === cy) clearSelection(true); });

  // ---- สลับการจัดกลุ่ม
  function setMode(m, animate = true) {
    if (m === mode) return;
    mode = m;
    const { groups, of } = groupMap(m);
    const pos = layout.modes[m].positions;
    const quick = !animate || reducedMotion();
    cy.batch(() => {
      cy.nodes('.cell').move({ parent: null });
      cy.nodes('.group').remove();
      cy.add(groups.map((g) => ({ group: 'nodes', data: { id: 'g:' + g.id, label: groupLabel(g), color: g.color, gid: g.id }, classes: 'group' })));
      cy.nodes('.cell').forEach((n) => {
        const c = store.cellsById.get(n.id());
        const others = m === 'system' ? (c.systems || []).slice(1) : [];
        n.data('dots', others.map((s) => (store.systemsById.get(s) || {}).color).filter(Boolean));
        n.toggleClass('multi', others.length > 0);
        n.move({ parent: 'g:' + of.get(n.id()) });
        const p = pos[n.id()] || [0, 0];
        if (quick) n.position({ x: p[0], y: p[1] });
      });
    });
    if (!quick) {
      cy.nodes('.cell').forEach((n) => {
        const p = pos[n.id()] || [0, 0];
        n.animate({ position: { x: p[0], y: p[1] } }, { duration: 650, easing: 'ease-in-out' });
      });
    }
    cy.nodes('.group').toggleClass('coarse', level === 'coarse');
    applyFilters();
    applyView(!quick);
    if (!quick) setTimeout(() => { if (!destroyed) updateLevel(true); }, 700);
  }

  const offTheme = onThemeChange(() => { cy.style(overviewStyle()); });
  const ro = new ResizeObserver(() => {
    if (!container.offsetWidth) return;
    cy.resize();
    baseZoom = computeFit().zoom;
    updateLevel(false);
  });
  ro.observe(container);

  rebuildAgg(cy, level);
  applyView(false);
  cy.nodes('.group').toggleClass('coarse', true);

  return {
    cy,
    get mode() { return mode; },
    get level() { return level; },
    setMode,
    setEdgeVisible(key, on) { visible[key] = on; applyFilters(); },
    setCrossOnly(on) { crossOnly = on; applyFilters(); },
    fit() { const f = computeFit(); baseZoom = f.zoom; cy.animate({ zoom: f.zoom, pan: f.pan }, { duration: reducedMotion() ? 0 : 350 }); },
    focusCell(id) { const n = cy.getElementById(id); if (n.empty()) return; selectNode(id); zoomTo(n, 2.6); },
    destroy() { destroyed = true; offTheme(); ro.disconnect(); cy.destroy(); },
  };
}

// ตัวอย่างขนาดเล็กสำหรับหน้าแรก: สร้างจากข้อมูลจริงและตำแหน่งที่คำนวณไว้ (ไม่โต้ตอบ)
export async function createOverviewPreview(container) {
  const layout = await loadOverviewLayout();
  const cy = cytoscape({
    container,
    elements: cellElements(layout, 'system', true),
    style: overviewStyle(),
    layout: { name: 'preset' },
    userZoomingEnabled: false, userPanningEnabled: false, boxSelectionEnabled: false,
    autoungrabify: true, autounselectify: true,
  });
  cy.edges('.real').addClass('hidden');
  cy.nodes('.cell').addClass('lvl-coarse');
  rebuildAgg(cy, 'coarse');
  cy.edges('.agg').style('label', '');
  const refit = () => {
    cy.resize();
    const f = fitFor(cy, boxesBounds(layout.modes.system.boxes), 26);
    cy.zoom(f.zoom); cy.pan(f.pan);
    cy.nodes('.group').style('font-size', Math.max(13, 13 / f.zoom));
  };
  refit();
  const ro = new ResizeObserver(() => { if (container.offsetWidth) refit(); });
  ro.observe(container);
  const off = onThemeChange(() => { cy.style(overviewStyle()); refit(); });
  return { cy, destroy() { off(); ro.disconnect(); cy.destroy(); } };
}

// ------------------------------------------------------------------ ตารางสรุปการเชื่อมข้ามกลุ่ม

const typePhrase = (ty) => (ty === 'interacts_with' ? '→' : t('edge.toggle.' + ty));

function crossTable(mode) {
  const { groups, of } = groupMap(mode);
  const gById = new Map(groups.map((g) => [g.id, g]));
  const pairs = new Map();
  for (const e of store.edges) {
    const a = of.get(e.from), b = of.get(e.to);
    if (!a || !b || a === b) continue;
    const key = a < b ? a + '|' + b : b + '|' + a;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(e);
  }
  const sorted = [...pairs.entries()].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]));
  const noun = t(mode === 'tissue' ? 'overview.nounTissue' : 'overview.nounSystem');
  const cellLink = (id) => { const c = store.cellsById.get(id); return h('a', { href: cellHref(id) }, c ? cellName(c) : id); };
  const box = h('section', { class: 'cross-table', 'aria-label': t('overview.crossAria', { noun }) },
    h('h2', { class: 'section', text: t('overview.crossTitle', { noun }) }),
    h('p', { class: 'sub-title', text: t('overview.crossIntro', { n: sorted.length, noun }) }));
  if (!sorted.length) { box.append(h('p', { class: 'empty', text: t('overview.crossNone') })); return box; }
  for (const [key, edges] of sorted) {
    const [a, b] = key.split('|');
    const ga = gById.get(a), gb = gById.get(b);
    const sysLink = (g) => (mode === 'system' ? h('a', { href: systemHref(g.id) }, groupLabel(g)) : groupLabel(g));
    box.append(h('details', { class: 'pair' },
      h('summary', {},
        h('span', { class: 'dot', style: `background:${ga.color}` }), groupLabel(ga), ' ↔ ',
        h('span', { class: 'dot', style: `background:${gb.color}` }), groupLabel(gb),
        h('span', { class: 'chip' }, t('overview.linkCount', { n: edges.length }))),
      h('ul', { class: 'rel-list' }, edges.map((e) => h('li', {},
        cellLink(e.from), ' ', h('span', { class: 'note' }, typePhrase(e.type)), ' ', cellLink(e.to),
        e.mode ? h('span', { class: 'chip mode-chip', 'data-mode': e.mode }, t('mode.' + e.mode)) : null,
        e.th ? h('span', { class: 'note' }, e.th) : null))),
      mode === 'system' ? h('p', { class: 'note' }, t('overview.goToWeb'), ' ', sysLink(ga), ' · ', sysLink(gb)) : null));
  }
  return box;
}

// ------------------------------------------------------------------ หน้า

export function overviewView(initialMode) {
  let graph = null;
  let destroyed = false;
  let mode = initialMode;
  const nReal = store.cells.filter((c) => c.kind === 'cell').length;
  const sysCount = new Set(store.cells.map((c) => (c.systems || [])[0])).size;

  const graphBox = h('div', { class: 'cy', role: 'img', 'aria-label': t('overview.graphAria') });
  const loading = h('p', { class: 'loading graph-loading', text: t('overview.loading') });
  const levelBadge = h('div', { class: 'level-badge', 'aria-hidden': 'true' });
  const graphWrap = h('div', { class: 'graph-wrap overview-wrap' }, graphBox, loading, levelBadge);
  const peek = h('aside', { class: 'peek card', 'aria-label': t('peek.aria'), 'aria-live': 'polite' });
  const info = h('div', { class: 'edge-info', role: 'status', 'aria-live': 'polite' });
  const tableHost = h('div', {});

  const emptyPeek = () => h('p', { class: 'peek-empty', text: t('overview.peekEmpty') });
  const resetPeek = () => { peek.replaceChildren(emptyPeek()); info.textContent = ''; };
  resetPeek();

  const setBadge = (lv) => {
    levelBadge.textContent = lv === 'coarse'
      ? t('overview.badgeCoarse')
      : t('overview.badgeFine');
  };
  setBadge('coarse');

  const modeBtns = ['system', 'tissue'].map((m) =>
    h('button', { type: 'button', 'aria-pressed': String(m === mode), onclick: () => switchMode(m) },
      t(m === 'system' ? 'overview.bySystem' : 'overview.byTissue')));
  const crossLabel = h('span', { class: 'label' });
  const setCrossLabel = () => { crossLabel.textContent = t(mode === 'tissue' ? 'overview.crossOnlyTissue' : 'overview.crossOnlySystem'); };
  setCrossLabel();
  const crossBtn = h('button', { type: 'button', class: 'toggle', 'aria-pressed': 'false', onclick: () => {
    const on = crossBtn.getAttribute('aria-pressed') !== 'true';
    crossBtn.setAttribute('aria-pressed', String(on));
    if (graph) graph.setCrossOnly(on);
    resetPeek();
  } }, crossLabel);

  const toggles = [
    makeToggle(t('edge.toggle.develops_from'), edgeSwatch('develops_from'), (on) => { if (graph) graph.setEdgeVisible('develops_from', on); resetPeek(); }),
    makeToggle(t('edge.toggle.is_a'), edgeSwatch('is_a'), (on) => { if (graph) graph.setEdgeVisible('is_a', on); resetPeek(); }),
    ...modesInData().map((m) => makeToggle(m.label, edgeSwatch('interacts_with', m.id), (on) => { if (graph) graph.setEdgeVisible('mode:' + m.id, on); resetPeek(); })),
    crossBtn,
  ];
  const fitBtn = h('button', { type: 'button', class: 'btn', onclick: () => graph && graph.fit() }, t('sys.fit'));

  function switchMode(m) {
    if (m === mode) return;
    mode = m;
    modeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(['system', 'tissue'][i] === m)));
    setCrossLabel();
    // เปลี่ยน hash โดยไม่สร้าง view ใหม่
    history.replaceState(null, '', '#/overview/' + m);
    tableHost.replaceChildren(crossTable(m));
    resetPeek();
    if (graph) graph.setMode(m);
  }

  const search = searchBox((cell) => { if (graph) graph.focusCell(cell.id); });
  const legend = legendFor(store.cells, null, { overview: true });

  tableHost.append(crossTable(mode));

  const el = h('div', {},
    h('a', { class: 'crumb', href: '#/' }, t('nav.backHome')),
    h('header', { class: 'sys-head' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: t('home.overviewTitle') }),
      h('p', { class: 'sub-title' }, t('overview.subtitle', { cells: nReal, links: store.edges.length, systems: sysCount }))),
    h('div', { class: 'toolbar' },
      h('div', { class: 'btn-group', role: 'group', 'aria-label': t('overview.grouping') }, modeBtns), fitBtn),
    h('div', { class: 'toolbar' }, toggles),
    search.el, legend, info,
    h('div', { class: 'sys-body' }, h('div', {}, graphWrap, h('p', { class: 'graph-hint', text: t('overview.hint') })), peek),
    tableHost);

  return {
    title: t('home.overviewTitle'),
    el,
    after: () => {
      createOverviewGraph(graphBox, mode, {
        onSelectNode: (cell) => { info.textContent = ''; peek.replaceChildren(renderPeek(cell)); },
        onSelectEdge: (t) => { info.textContent = t; },
        onClear: resetPeek,
        onLevel: setBadge,
      }).then((g) => {
        if (destroyed) { g.destroy(); return; }
        graph = g;
        loading.remove();
      }).catch((e) => { console.error(e); loading.textContent = t('overview.failed', { msg: e.message }); });
    },
    destroy: () => { destroyed = true; search.destroy(); if (graph) graph.destroy(); },
  };
}

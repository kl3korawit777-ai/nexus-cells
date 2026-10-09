// กราฟ Cytoscape: ใยรายระบบ และใยย่อยในหน้าเซลล์
// สีทั้งหมดอ่านจาก CSS variables และสร้าง stylesheet ใหม่เมื่อธีมเปลี่ยน

import { store, cellsInSystem, systemEdges, crossSystemEdges, colorKey, edgeSentence, MODES } from './data.js';
import { cssVar, onThemeChange, shortSystemName, reducedMotion } from './util.js';

const cytoscape = window.cytoscape;
let registered = false;
export function ensureFcose() {
  if (registered) return;
  registered = true;
  if (window.cytoscapeFcose) cytoscape.use(window.cytoscapeFcose);
}

export function colorForKey(key) {
  const v = cssVar('--st-' + key);
  if (v) return v;
  const i = Math.max(0, store.subtypeKeys.indexOf(key));
  return cssVar('--p' + ((i % 6) + 1)) || cssVar('--st-other');
}

// รูปแบบเส้นของแต่ละ mode ต่างกันทั้งสีและลายเส้น ไม่พึ่งสีอย่างเดียว
const MODE_SHAPE = {
  hormone: { 'line-style': 'solid', 'target-arrow-shape': 'diamond' },
  synapse: { 'line-style': 'solid', 'target-arrow-shape': 'circle', width: 2.6 },
  paracrine: { 'line-style': 'dashed', 'line-dash-pattern': [4, 3], 'target-arrow-shape': 'triangle-tee' },
  support: { 'line-style': 'dotted', 'target-arrow-shape': 'tee' },
  immune: { 'line-style': 'solid', 'target-arrow-shape': 'vee' },
};

const EDGE_CLASS = { develops_from: 'e-dev', is_a: 'e-isa', interacts_with: 'e-int' };

export function buildStyle() {
  const ink = cssVar('--ink');
  const surface = cssVar('--surface');
  const font = 'IBM Plex Sans Thai, Noto Sans Thai, system-ui, sans-serif';
  const accent = cssVar('--accent');
  return [
    {
      selector: 'node',
      style: {
        'background-color': (n) => colorForKey(n.data('ck')),
        'border-width': 2,
        'border-color': cssVar('--node-border'),
        width: 30,
        height: 30,
        label: 'data(label)',
        'font-family': font,
        'font-size': 11,
        color: ink,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 4,
        'text-wrap': 'wrap',
        'text-max-width': 92,
        'line-height': 1.2,
        'text-background-color': surface,
        'text-background-opacity': 0.78,
        'text-background-padding': 2,
        'text-background-shape': 'roundrectangle',
        'min-zoomed-font-size': 6,
      },
    },
    {
      // หมวด (kind "class"): สี่เหลี่ยมมุมมน เส้นขอบประ
      selector: 'node.cls',
      style: {
        shape: 'round-rectangle',
        width: 40,
        height: 26,
        'background-opacity': 0.2,
        'border-style': 'dashed',
        'border-width': 2,
        'border-color': (n) => colorForKey(n.data('ck')),
        'font-weight': 600,
      },
    },
    {
      // เซลล์ที่อยู่หลายระบบ: ขอบสองชั้นสีของระบบอื่น
      selector: 'node.multi',
      style: {
        'border-style': 'double',
        'border-width': 5,
        'border-color': (n) => (store.systemsById.get(n.data('ring')) || {}).color || accent,
      },
    },
    { selector: 'node.sel', style: { 'border-width': 4, 'border-style': 'solid', 'border-color': cssVar('--focus'), 'z-index': 20 } },
    {
      selector: 'edge',
      style: { width: 1.6, 'curve-style': 'bezier', 'arrow-scale': 1, opacity: 0.9, 'line-color': cssVar('--edge-dev') },
    },
    {
      selector: 'edge.e-dev',
      style: { 'line-color': cssVar('--edge-dev'), 'target-arrow-color': cssVar('--edge-dev'), 'target-arrow-shape': 'triangle', width: 1.8 },
    },
    {
      selector: 'edge.e-isa',
      style: {
        'line-style': 'dashed', 'line-dash-pattern': [6, 4], width: 1.3,
        'line-color': cssVar('--edge-isa'), 'target-arrow-color': cssVar('--edge-isa'),
        'target-arrow-shape': 'triangle', 'target-arrow-fill': 'hollow',
      },
    },
    {
      selector: 'edge.e-int',
      style: { width: 2.2, 'curve-style': 'unbundled-bezier', 'control-point-distances': [38], 'control-point-weights': [0.5] },
    },
    ...MODES.map((m) => ({
      selector: 'edge.m-' + m.id,
      style: Object.assign(
        { 'line-color': cssVar('--mode-' + m.id), 'target-arrow-color': cssVar('--mode-' + m.id) },
        MODE_SHAPE[m.id]),
    })),
    {
      // เซลล์ของระบบอื่น (ghost): จางลง สีของระบบนั้น กดแล้วไปหน้าเซลล์
      selector: 'node.ghost',
      style: {
        opacity: 0.55, 'border-style': 'dotted', 'border-width': 2,
        'border-color': (n) => (store.systemsById.get(n.data('ring')) || {}).color || accent,
        'background-color': (n) => (store.systemsById.get(n.data('ring')) || {}).color || accent,
        'font-style': 'italic',
      },
    },
    { selector: 'edge.hl', style: { width: 3.4, opacity: 1, 'z-index': 15 } },
    { selector: '.faded', style: { opacity: 0.13, 'text-opacity': 0.3 } },
    { selector: '.hidden', style: { display: 'none' } },
  ];
}

function toElements(cells, edges, ownSystem, ghosts = []) {
  const ids = new Set(cells.map((c) => c.id));
  const allIds = new Set([...ids, ...ghosts.map((c) => c.id)]);
  const nodes = cells.map((c) => {
    const others = (c.systems || []).filter((s) => s !== ownSystem);
    const otherNames = others.map((s) => store.systemsById.get(s)).filter(Boolean).map(shortSystemName);
    const classes = [];
    if (c.kind === 'class') classes.push('cls');
    if (ownSystem && others.length) classes.push('multi');
    return {
      group: 'nodes',
      data: {
        id: c.id,
        label: c.en + (ownSystem && otherNames.length ? '\n↗ ' + otherNames.join(', ') : ''),
        ck: colorKey(c),
        ring: ownSystem && others.length ? others[0] : '',
      },
      classes: classes.join(' '),
    };
  });
  const ghostNodes = ghosts.map((c) => {
    const sys = store.systemsById.get(c.systems[0]);
    return {
      group: 'nodes',
      data: { id: c.id, label: c.en + '\n(' + (sys ? shortSystemName(sys) : '') + ')', ck: colorKey(c), ring: c.systems[0] },
      classes: 'ghost',
    };
  });
  const es = edges
    .filter((e) => allIds.has(e.from) && allIds.has(e.to))
    .map((e, i) => {
      // develops_from: ลูกศรชี้จากแม่ไปลูก (ทิศการเจริญ) ส่วนชนิดอื่นชี้ตามข้อมูล
      const flip = e.type === 'develops_from';
      return {
        group: 'edges',
        data: { id: `e${i}`, source: flip ? e.to : e.from, target: flip ? e.from : e.to, type: e.type, th: e.th || '', mode: e.mode || '', from: e.from, to: e.to },
        classes: EDGE_CLASS[e.type] + (e.mode ? ' m-' + e.mode : ''),
      };
    });
  return [...nodes, ...ghostNodes, ...es];
}

// ---------------------------------------------------------------- layout

function layoutSystem(cy) {
  ensureFcose();
  // จุดที่ไม่มีเส้นเลยจะไม่เข้า layout แรงผลัก แต่วางเรียงเป็นตารางใต้ใยหลัก (ตายตัว ไม่สุ่ม)
  const isolated = cy.nodes().filter((n) => n.degree(false) === 0);
  const main = cy.elements().not(isolated);
  const dev = main.edges('.e-dev');
  const hasParent = (n) => n.incomers('edge.e-dev').length > 0;
  const hasChild = (n) => n.outgoers('edge.e-dev').length > 0;
  let roots = main.nodes().filter((n) => hasChild(n) && !hasParent(n));
  // เริ่มจาก hematopoietic stem cell ก่อน ถ้ามี
  const hsc = cy.getElementById('CL:0000037');
  if (hsc.nonempty()) roots = hsc;
  else roots = roots.sort((a, b) => b.successors('node').length - a.successors('node').length);

  const lineage = dev.connectedNodes();
  if (lineage.nonempty()) {
    lineage.union(dev).layout({
      name: 'breadthfirst', directed: true, roots, spacingFactor: 1.15, padding: 20, fit: false, animate: false,
    }).run();
  }

  // จุดที่ไม่อยู่ในสายพัฒนา ให้เริ่มใกล้เพื่อนบ้านที่มีตำแหน่งแล้ว (กำหนดตายตัวไม่สุ่ม)
  const bb = lineage.nonempty() ? lineage.boundingBox() : { x1: 0, x2: 300, y1: 0, y2: 300 };
  let k = 0;
  main.nodes().not(lineage).forEach((n) => {
    const nb = n.neighborhood('node').intersection(lineage);
    if (nb.nonempty()) {
      let x = 0, y = 0;
      nb.forEach((m) => { x += m.position('x'); y += m.position('y'); });
      n.position({ x: x / nb.length - 90, y: y / nb.length - 70 });
    } else {
      n.position({ x: bb.x2 + 120 * (k % 3), y: bb.y1 + 90 * Math.floor(k++ / 3) });
    }
  });

  // ให้แม่อยู่เหนือลูกเสมอ ด้วยข้อจำกัดตำแหน่งสัมพัทธ์
  const constraints = dev.map((e) => ({ top: e.data('source'), bottom: e.data('target'), gap: 95 }));
  main.layout({
    name: 'fcose', quality: 'proof', randomize: false, animate: false, fit: false, padding: 30,
    nodeDimensionsIncludeLabels: true, uniformNodeDimensions: false,
    nodeRepulsion: () => 14000,
    idealEdgeLength: (e) => (e.hasClass('e-dev') ? 90 : 120),
    edgeElasticity: (e) => (e.hasClass('e-dev') ? 0.45 : 0.12),
    gravity: 0.25, numIter: 4000, packComponents: false, relativePlacementConstraint: constraints,
  }).run();

  if (isolated.nonempty()) {
    const box = main.nonempty() ? main.boundingBox() : { x1: 0, x2: 480, y1: 0, y2: 0 };
    const cols = 5, dx = 115, dy = 85;
    const x0 = (box.x1 + box.x2) / 2 - ((Math.min(cols, isolated.length) - 1) * dx) / 2;
    const y0 = (main.nonempty() ? box.y2 + 110 : 0);
    isolated.sort((a, b) => a.data('label').localeCompare(b.data('label')));
    isolated.forEach((n, i) => n.position({ x: x0 + (i % cols) * dx, y: y0 + Math.floor(i / cols) * dy }));
  }
  cy.fit(cy.elements(), 30);
}

// ---------------------------------------------------------------- ใยรายระบบ

export function createSystemGraph(container, systemId, handlers = {}) {
  ensureFcose();
  const cells = cellsInSystem(systemId);
  const cross = crossSystemEdges(systemId);
  const own = new Set(cells.map((c) => c.id));
  const ghostIds = new Set();
  cross.forEach((e) => { [e.from, e.to].forEach((i) => { if (!own.has(i)) ghostIds.add(i); }); });
  const ghosts = [...ghostIds].map((i) => store.cellsById.get(i)).filter(Boolean);
  const edges = [...systemEdges(systemId), ...cross];
  const cy = cytoscape({
    container,
    elements: toElements(cells, edges, systemId, ghosts),
    style: buildStyle(),
    minZoom: 0.25,
    maxZoom: 3,
    boxSelectionEnabled: false,
    autoungrabify: false,
  });
  layoutSystem(cy);
  container.__cy = cy; // ใช้ตรวจสอบ/ดีบักจาก console

  const visible = { develops_from: true, is_a: true };
  MODES.forEach((m) => { visible['mode:' + m.id] = true; });
  function applyVisibility() {
    cy.elements().removeClass('hidden');
    cy.edges('.e-dev').toggleClass('hidden', !visible.develops_from);
    MODES.forEach((m) => cy.edges('.m-' + m.id).toggleClass('hidden', !visible['mode:' + m.id]));
    if (!visible.is_a) {
      cy.edges('.e-isa').addClass('hidden');
      cy.nodes('.cls').addClass('hidden');
    }
    // ghost ที่ไม่เหลือเส้นให้เห็นแล้วจะซ่อนด้วย
    cy.nodes('.ghost').forEach((g) => {
      if (g.connectedEdges().filter((e) => !e.hasClass('hidden')).empty()) g.addClass('hidden');
    });
    clearSelection();
  }

  let selectedId = null;
  function clearSelection(notify = false) {
    cy.elements().removeClass('faded sel hl');
    selectedId = null;
    if (notify && handlers.onClear) handlers.onClear();
  }
  function selectNode(id) {
    const n = cy.getElementById(id);
    if (n.empty() || n.hasClass('hidden')) return;
    const nh = n.closedNeighborhood().filter((el) => !el.hasClass('hidden'));
    cy.elements().removeClass('faded sel hl');
    cy.elements().not(nh).addClass('faded');
    nh.edges().addClass('hl');
    n.addClass('sel');
    selectedId = id;
    if (handlers.onSelectNode) handlers.onSelectNode(store.cellsById.get(id));
  }

  cy.on('tap', 'node', (ev) => {
    if (ev.target.hasClass('ghost')) { if (handlers.onGhost) handlers.onGhost(ev.target.id()); return; }
    selectNode(ev.target.id());
  });
  cy.on('tap', 'edge', (ev) => {
    const d = ev.target.data();
    if (handlers.onSelectEdge) handlers.onSelectEdge(edgeSentence({ type: d.type, from: d.from, to: d.to, th: d.th, mode: d.mode }), d.type);
  });
  cy.on('tap', (ev) => { if (ev.target === cy) clearSelection(true); });

  const offTheme = onThemeChange(() => { cy.style(buildStyle()); });
  const ro = new ResizeObserver(() => { if (container.offsetWidth) cy.resize(); });
  ro.observe(container);

  return {
    cy,
    modesPresent: MODES.filter((m) => cy.edges('.m-' + m.id).nonempty()).map((m) => m.id),
    setEdgeVisible(type, on) { visible[type] = on; applyVisibility(); },
    fit() { cy.animate({ fit: { eles: cy.elements().not('.hidden'), padding: 30 }, duration: reducedMotion() ? 0 : 250 }); },
    refit() { cy.resize(); cy.fit(cy.elements().not('.hidden'), 30); },
    select: selectNode,
    destroy() { offTheme(); ro.disconnect(); cy.destroy(); },
  };
}

// ---------------------------------------------------------------- ใยย่อยในหน้าเซลล์

export function createMiniGraph(container, cellId, onNavigate) {
  const rel = store.edges.filter((e) => e.from === cellId || e.to === cellId);
  const ids = new Set([cellId]);
  rel.forEach((e) => { ids.add(e.from); ids.add(e.to); });
  const cells = [...ids].map((i) => store.cellsById.get(i)).filter(Boolean);
  // ใยย่อยแสดงทุกเส้นที่ต่อกับเซลล์นี้ ส่วนเส้นระหว่างเพื่อนบ้านด้วยกันไม่แสดง เพื่อให้อ่านง่าย
  const cy = cytoscape({
    container,
    elements: toElements(cells, rel, null),
    style: buildStyle(),
    minZoom: 0.3,
    maxZoom: 3,
    userZoomingEnabled: false,
  });
  cy.getElementById(cellId).addClass('sel');
  cy.layout({
    name: 'concentric', fit: true, padding: 34, animate: false,
    concentric: (n) => (n.id() === cellId ? 10 : 1), levelWidth: () => 1, minNodeSpacing: 46,
    avoidOverlap: true, startAngle: (3 / 2) * Math.PI,
  }).run();
  cy.on('tap', 'node', (ev) => { if (ev.target.id() !== cellId && onNavigate) onNavigate(ev.target.id()); });
  cy.on('mouseover', 'node', () => { container.style.cursor = 'pointer'; });
  cy.on('mouseout', 'node', () => { container.style.cursor = ''; });
  const offTheme = onThemeChange(() => cy.style(buildStyle()));
  const ro = new ResizeObserver(() => { if (container.offsetWidth) { cy.resize(); cy.fit(undefined, 34); } });
  ro.observe(container);
  return { cy, destroy() { offTheme(); ro.disconnect(); cy.destroy(); } };
}

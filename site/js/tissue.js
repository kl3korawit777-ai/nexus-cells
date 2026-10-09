// หน้าเนื้อเยื่อ (#/tissue/<id>): ข้อมูลเนื้อเยื่อ ชนิดย่อยพร้อมรายการเซลล์ ระบบที่กระจายอยู่ และใยย่อย

import { store, colorKey } from './data.js';
import { h, cellHref, systemHref, onThemeChange } from './util.js';
import { t } from './i18n.js';
import { colorForKey, ensureFcose } from './graph.js';
import { overviewStyle } from './overview.js';
import { imageBlock } from './card.js';
import { notFoundView } from './views.js';

const cytoscape = window.cytoscape;
const GERM = {
  ectoderm: 'เอ็กโทเดิร์ม (ectoderm)',
  mesoderm: 'มีโซเดิร์ม (mesoderm)',
  endoderm: 'เอนโดเดิร์ม (endoderm)',
};
const EDGE_CLASS = { develops_from: 'e-dev', is_a: 'e-isa', interacts_with: 'e-int' };

const cellsOfTissue = (tissueId) =>
  store.cells.filter((c) => (c.tissue || 'other') === tissueId);

// ใยย่อยของเซลล์ทั้งหมดในเนื้อเยื่อ จัดกลุ่มตามชนิดย่อย (กรอบสีอ่อน)
function createTissueGraph(container, tissue, cells, onNavigate) {
  ensureFcose();
  const ids = new Set(cells.map((c) => c.id));
  const subtypes = new Map(tissue.subtypes.map((s) => [s.id, s]));
  const used = new Set();
  const els = [];
  for (const c of cells) {
    const sub = subtypes.has(c.tissue_subtype) ? c.tissue_subtype : '';
    used.add(sub);
  }
  for (const sub of used) {
    const st = subtypes.get(sub);
    els.push({ group: 'nodes', data: { id: 'st:' + sub, label: st ? st.th : 'ไม่ระบุชนิดย่อย', color: tissue.color }, classes: 'group' });
  }
  for (const c of cells) {
    const sub = subtypes.has(c.tissue_subtype) ? c.tissue_subtype : '';
    els.push({
      group: 'nodes',
      data: { id: c.id, label: c.en, ck: colorKey(c), parent: 'st:' + sub },
      classes: 'cell' + (c.kind === 'class' ? ' cls' : ''),
    });
  }
  store.edges.forEach((e, i) => {
    if (!ids.has(e.from) || !ids.has(e.to)) return;
    const flip = e.type === 'develops_from';
    els.push({
      group: 'edges',
      data: { id: 'e' + i, source: flip ? e.to : e.from, target: flip ? e.from : e.to, type: e.type },
      classes: 'real ' + EDGE_CLASS[e.type] + (e.mode ? ' m-' + e.mode : ''),
    });
  });
  const cy = cytoscape({
    container, elements: els, style: overviewStyle(),
    minZoom: 0.15, maxZoom: 3, boxSelectionEnabled: false,
  });
  cy.layout({
    name: 'fcose', quality: 'default', randomize: true, animate: false, fit: true, padding: 24,
    nodeDimensionsIncludeLabels: true, packComponents: false,
    nodeRepulsion: () => 9000, idealEdgeLength: () => 70, gravity: 0.3, gravityCompound: 1.2, tile: true,
  }).run();
  // ขนาดตัวอักษรในโมเดลปรับตามซูม เพื่อให้อ่านได้เมื่อใยถูกย่อให้พอดีจอ
  const sizeText = () => {
    const z = cy.zoom();
    cy.nodes('.group').style('font-size', Math.max(14, 13 / z));
    cy.nodes('.cell').style('font-size', Math.max(10, 10.5 / z));
    cy.nodes('.cell').style('text-max-width', Math.max(84, 84 / z));
  };
  sizeText();
  cy.on('tap', 'node.cell', (ev) => onNavigate(ev.target.id()));
  cy.on('mouseover', 'node.cell', () => { container.style.cursor = 'pointer'; });
  cy.on('mouseout', 'node.cell', () => { container.style.cursor = ''; });
  container.__cy = cy;
  const off = onThemeChange(() => cy.style(overviewStyle()));
  const ro = new ResizeObserver(() => { if (container.offsetWidth) { cy.resize(); cy.fit(undefined, 24); sizeText(); } });
  ro.observe(container);
  return { cy, destroy() { off(); ro.disconnect(); cy.destroy(); } };
}

function cellList(cells) {
  return h('ul', { class: 'cell-list' }, cells.map((c) =>
    h('li', {}, h('a', { href: cellHref(c.id), style: `--c:${colorForKey(colorKey(c))}` },
      h('div', { class: 'th', text: c.th }), h('div', { class: 'en', text: c.en }),
      h('div', { class: 'tags' },
        c.kind === 'class' ? h('span', { class: 'chip' }, 'หมวด') : null,
        h('span', { class: 'chip mono' }, c.id))))));
}

export function tissueView(id) {
  const tissue = store.tissuesById.get(id);
  if (!tissue) return notFoundView('ไม่พบเนื้อเยื่อนี้', `ไม่มีเนื้อเยื่อ "${id}" ในข้อมูล`);
  const cells = cellsOfTissue(id);
  let graph = null;

  // นับจำนวนเซลล์ต่อระบบ (เซลล์ที่อยู่หลายระบบนับในทุกระบบของมัน)
  const bySystem = new Map();
  for (const c of cells) for (const s of c.systems || []) bySystem.set(s, (bySystem.get(s) || 0) + 1);
  const sysChips = store.systems.filter((s) => bySystem.has(s.id)).map((s) =>
    h('a', { class: 'chip', href: systemHref(s.id), title: 'ดูใยของ' + s.th },
      h('span', { class: 'dot', style: `background:${s.color}` }), s.th, h('span', { class: 'count', text: bySystem.get(s.id) })));

  const subSections = tissue.subtypes.map((st) => {
    const list = cells.filter((c) => c.tissue_subtype === st.id);
    return h('section', { class: 'subtype' },
      h('h3', {}, st.th, h('span', { class: 'en', text: ' · ' + st.en }), h('span', { class: 'chip', text: list.length ? `${list.length} รายการ` : 'ยังไม่มีข้อมูล' })),
      list.length ? cellList(list) : h('p', { class: 'empty', text: 'ยังไม่มีข้อมูล' }));
  });
  const noSub = cells.filter((c) => !tissue.subtypes.some((s) => s.id === c.tissue_subtype));
  if (noSub.length) {
    subSections.push(h('section', { class: 'subtype' },
      h('h3', {}, 'ไม่ระบุชนิดย่อย', h('span', { class: 'chip', text: `${noSub.length} รายการ` })), cellList(noSub)));
  }

  const facts = [
    tissue.features ? h('section', { class: 'fact' }, h('h2', { text: 'ลักษณะเด่น' }), h('p', { text: tissue.features })) : null,
    tissue.location ? h('section', { class: 'fact' }, h('h2', { text: 'ตำแหน่งที่พบ' }), h('p', { text: tissue.location })) : null,
    tissue.function ? h('section', { class: 'fact' }, h('h2', { text: 'หน้าที่' }), h('p', { text: tissue.function })) : null,
    (tissue.germ_layers || []).length
      ? h('section', { class: 'fact' }, h('h2', { text: 'ชั้นเอ็มบริโอต้นกำเนิด' }), h('p', { text: tissue.germ_layers.map((g) => GERM[g] || g).join(', ') }))
      : null,
  ].filter(Boolean);

  const graphBox = h('div', { class: 'mini-graph tissue-graph', role: 'img', 'aria-label': `ใยย่อยของเซลล์ในเนื้อเยื่อ${tissue.th} จัดกลุ่มตามชนิดย่อย` }, h('div', { class: 'cy' }));
  const hasEdges = store.edges.some((e) => cells.some((c) => c.id === e.from) && cells.some((c) => c.id === e.to));

  const el = h('article', { class: 'tissue-page' },
    h('a', { class: 'crumb', href: '#/' }, '← หน้าแรก'),
    h('header', { class: 'sys-head' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: tissue.th }),
      h('p', { class: 'sub-title' }, h('span', { class: 'dot', style: `background:${tissue.color}` }), `${tissue.en} · ${cells.length} รายการ`),
      tissue.cl_class ? h('p', { class: 'eyebrow' }, 'อ้างอิง Cell Ontology: ', h('span', { class: 'mono', text: tissue.cl_class })) : null,
      h('p', {}, h('a', { class: 'btn', href: '#/quiz?tissue=' + encodeURIComponent(tissue.id) }, t('quiz.testThis')))),
    h('div', { class: 'cell-hero' }, imageBlock(tissue.image, `ภาพเนื้อเยื่อ${tissue.th}`, `images/tissue-${tissue.id}.jpg`),
      h('div', { class: 'facts card' }, facts)),
    tissue.exam ? h('section', { class: 'exam' }, h('h2', { text: 'จุดออกสอบ' }), h('p', { text: tissue.exam })) : null,
    sysChips.length ? h('section', {}, h('h2', { class: 'section', text: 'ระบบที่เซลล์ในเนื้อเยื่อนี้กระจายอยู่' }), h('div', { class: 'chips' }, sysChips)) : null,
    h('h2', { class: 'section', text: 'ชนิดย่อยและเซลล์' }),
    h('div', { class: 'subtypes' }, subSections),
    cells.length && hasEdges
      ? [h('h2', { class: 'section', text: 'ใยย่อยของเนื้อเยื่อนี้' }), graphBox,
        h('p', { class: 'graph-hint', text: 'แตะจุดเพื่อไปยังเซลล์นั้น · ใช้รายการด้านบนเพื่อใช้แป้นพิมพ์' })]
      : null);

  return {
    title: tissue.th,
    el,
    after: () => {
      if (cells.length && hasEdges) graph = createTissueGraph(graphBox.querySelector('.cy'), tissue, cells, (cid) => { location.hash = cellHref(cid); });
    },
    destroy: () => graph && graph.destroy(),
  };
}

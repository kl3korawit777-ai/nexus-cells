// หน้าเนื้อเยื่อ (#/tissue/<id>): ข้อมูลเนื้อเยื่อ ชนิดย่อยพร้อมรายการเซลล์ ระบบที่กระจายอยู่ และใยย่อย

import { store, colorKey, cellName, cellAlt, sysName, tissueName, subtypeName } from './data.js';
import { h, cellHref, systemHref, onThemeChange } from './util.js';
import { t, getLang } from './i18n.js';
import { tissueText, altNameOf } from './content.js';
import { colorForKey, ensureFcose } from './graph.js';
import { overviewStyle } from './overview.js';
import { imageBlock } from './card.js';
import { notFoundView } from './views.js';

const cytoscape = window.cytoscape;
const EDGE_CLASS = { develops_from: 'e-dev', is_a: 'e-isa', interacts_with: 'e-int' };
const thaiOnlyChip = () => h('span', { class: 'chip chip-thai', text: t('common.thaiOnly') });

const cellsOfTissue = (tissueId) =>
  store.cells.filter((c) => (c.tissue || 'other') === tissueId);

// ใยย่อยของเซลล์ทั้งหมดในเนื้อเยื่อ จัดกลุ่มตามชนิดย่อย (กรอบสีอ่อน)
function createTissueGraph(container, tissue, cells, onNavigate) {
  ensureFcose();
  const ids = new Set(cells.map((c) => c.id));
  const subtypes = new Map(tissue.subtypes.map((s) => [s.id, s]));
  const used = new Set();
  const els = [];
  for (const c of cells) used.add(subtypes.has(c.tissue_subtype) ? c.tissue_subtype : '');
  for (const sub of used) {
    els.push({ group: 'nodes', data: { id: 'st:' + sub, label: sub ? subtypeName(sub) : t('tissue.noSubtype'), color: tissue.color }, classes: 'group' });
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
      h('div', { class: 'th', text: cellName(c) }), h('div', { class: 'en', text: cellAlt(c) }),
      h('div', { class: 'tags' },
        c.kind === 'class' ? h('span', { class: 'chip' }, t('card.classShort')) : null,
        h('span', { class: 'chip mono' }, c.id))))));
}

export function tissueView(id) {
  const tissue = store.tissuesById.get(id);
  if (!tissue) return notFoundView(t('tissue.notFound'), t('tissue.noSuchTissue', { id }));
  const lang = getLang();
  const cells = cellsOfTissue(id);
  let graph = null;

  // นับจำนวนเซลล์ต่อระบบ (เซลล์ที่อยู่หลายระบบนับในทุกระบบของมัน)
  const bySystem = new Map();
  for (const c of cells) for (const s of c.systems || []) bySystem.set(s, (bySystem.get(s) || 0) + 1);
  const sysChips = store.systems.filter((s) => bySystem.has(s.id)).map((s) =>
    h('a', { class: 'chip', href: systemHref(s.id), title: t('card.viewSystem', { system: sysName(s) }) },
      h('span', { class: 'dot', style: `background:${s.color}` }), sysName(s), h('span', { class: 'count', text: bySystem.get(s.id) })));

  const subSections = tissue.subtypes.map((st) => {
    const list = cells.filter((c) => c.tissue_subtype === st.id);
    const alt = altNameOf(st, lang);
    return h('section', { class: 'subtype' },
      h('h3', {}, subtypeName(st.id), alt ? h('span', { class: 'en', text: ' · ' + alt }) : null,
        h('span', { class: 'chip', text: list.length ? t('tissue.itemCount', { n: list.length }) : t('tissue.noData') })),
      list.length ? cellList(list) : h('p', { class: 'empty', text: t('tissue.noData') }));
  });
  const noSub = cells.filter((c) => !tissue.subtypes.some((s) => s.id === c.tissue_subtype));
  if (noSub.length) {
    subSections.push(h('section', { class: 'subtype' },
      h('h3', {}, t('tissue.noSubtype'), h('span', { class: 'chip', text: t('tissue.itemCount', { n: noSub.length }) })), cellList(noSub)));
  }

  const textFact = (field, key) => {
    const x = tissueText(tissue, field, lang);
    return x.text ? h('section', { class: 'fact' }, h('h2', {}, t(key), x.thaiOnly ? thaiOnlyChip() : null), h('p', { text: x.text })) : null;
  };
  const facts = [
    textFact('features', 'tissue.features'),
    textFact('location', 'field.location'),
    textFact('function', 'field.function'),
    (tissue.germ_layers || []).length
      ? h('section', { class: 'fact' }, h('h2', { text: t('tissue.germLayers') }), h('p', { text: tissue.germ_layers.map((g) => t('germ.' + g)).join(', ') }))
      : null,
  ].filter(Boolean);
  const exam = tissueText(tissue, 'exam', lang);

  const graphBox = h('div', { class: 'mini-graph tissue-graph', role: 'img', 'aria-label': t('tissue.graphAria', { tissue: tissueName(tissue) }) }, h('div', { class: 'cy' }));
  const hasEdges = store.edges.some((e) => cells.some((c) => c.id === e.from) && cells.some((c) => c.id === e.to));
  const alt = altNameOf(tissue, lang);

  const el = h('article', { class: 'tissue-page' },
    h('a', { class: 'crumb', href: '#/' }, t('nav.backHome')),
    h('header', { class: 'sys-head' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: tissueName(tissue) }),
      h('p', { class: 'sub-title' }, h('span', { class: 'dot', style: `background:${tissue.color}` }), [alt, t('tissue.itemCount', { n: cells.length })].filter(Boolean).join(' · ')),
      tissue.cl_class ? h('p', { class: 'eyebrow' }, t('tissue.clRef'), ' ', h('span', { class: 'mono', text: tissue.cl_class })) : null,
      h('p', {}, h('a', { class: 'btn', href: '#/quiz?tissue=' + encodeURIComponent(tissue.id) }, t('quiz.testThis')))),
    h('div', { class: 'cell-hero' }, imageBlock(tissue.image, t('tissue.imageAlt', { tissue: tissueName(tissue) }), `images/tissue-${tissue.id}.jpg`),
      h('div', { class: 'facts card' }, facts)),
    exam.text ? h('section', { class: 'exam' }, h('h2', {}, t('field.exam'), exam.thaiOnly ? thaiOnlyChip() : null), h('p', { text: exam.text })) : null,
    sysChips.length ? h('section', {}, h('h2', { class: 'section', text: t('tissue.systems') }), h('div', { class: 'chips' }, sysChips)) : null,
    h('h2', { class: 'section', text: t('tissue.subtypesAndCells') }),
    h('div', { class: 'subtypes' }, subSections),
    cells.length && hasEdges
      ? [h('h2', { class: 'section', text: t('tissue.subgraph') }), graphBox,
        h('p', { class: 'graph-hint', text: t('tissue.subgraphHint') })]
      : null);

  return {
    title: tissueName(tissue),
    el,
    after: () => {
      if (cells.length && hasEdges) graph = createTissueGraph(graphBox.querySelector('.cy'), tissue, cells, (cid) => { location.hash = cellHref(cid); });
    },
    destroy: () => graph && graph.destroy(),
  };
}

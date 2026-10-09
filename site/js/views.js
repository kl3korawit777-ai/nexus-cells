// หน้าต่าง ๆ: หน้าแรก ใยรายระบบ หน้าเซลล์ และหน้าไม่พบ
// แต่ละ view คืน {el, title, destroy?, after?} ข้อความทั้งหมดมาจาก i18n

import {
  store, realCellCount, cellsInSystem, colorKey, MODES, crossSystemEdges, systemEdges,
  cellName, cellAlt, sysName, tissueName, subtypeName,
} from './data.js';
import { h, cellHref, systemHref, tissueHref } from './util.js';
import { t, getLang } from './i18n.js';
import { sysSummary, altNameOf } from './content.js';
import { createSystemGraph, colorForKey } from './graph.js';
import { renderCellPage, renderPeek } from './card.js';
import { searchBox, edgeSwatch, legendFor } from './ui.js';
import { createOverviewPreview } from './overview.js';

const thaiOnlyChip = () => h('span', { class: 'chip chip-thai', text: t('common.thaiOnly') });

// ---------------------------------------------------------------- หน้าไม่พบ

export function notFoundView(message, detail) {
  return {
    title: t('notfound.page'),
    el: h('section', { class: 'notfound' },
      h('h1', { id: 'page-title', tabindex: '-1', text: message }),
      h('p', { text: detail || t('notfound.generic') }),
      h('a', { class: 'btn btn-primary', href: '#/' }, t('notfound.home'))),
  };
}

// ---------------------------------------------------------------- หน้าแรก

export function homeView() {
  const search = searchBox();
  const cards = store.systems.map((s) => {
    const n = realCellCount(s.id);
    const body = [
      h('div', { class: 'th', text: sysName(s) }),
      h('div', { class: 'en', text: altNameOf(s, getLang()) }),
      h('div', { class: 'meta' }, n ? t('sys.cellCount', { n }) : h('span', { class: 'chip chip-warn' }, t('sys.inProgress'))),
    ];
    const style = `--sys-color:${s.color}`;
    return n
      ? h('a', { class: 'sys-card', href: systemHref(s.id), style }, body)
      : h('div', { class: 'sys-card', 'aria-disabled': 'true', style }, body);
  });
  // เนื้อเยื่อหลัก 4 ประเภท (ไม่รวมหมวด other ที่ไม่มี cl_class)
  const tissues = store.tissues.filter((tt) => tt.cl_class).map((tt) =>
    h('a', { class: 'tissue-card', href: tissueHref(tt.id), style: `border-left: 6px solid ${tt.color}` },
      h('h3', { text: tissueName(tt) }), h('div', { class: 'en', text: altNameOf(tt, getLang()) }),
      h('div', { class: 'chips' }, (tt.subtypes || []).map((st) => h('span', { class: 'chip' }, subtypeName(st.id))))));

  // การ์ดใหญ่: ทางเข้าหลักไปยังใยภาพรวม ภาพตัวอย่างสร้างจากข้อมูลและตำแหน่งจริง
  const nReal = store.cells.filter((c) => c.kind === 'cell').length;
  const nSys = store.systems.filter((s) => realCellCount(s.id) > 0).length;
  const previewBox = h('div', { class: 'overview-preview', 'aria-hidden': 'true' }, h('div', { class: 'cy' }));
  const stat = (n, label) => h('div', { class: 'stat' }, h('b', { text: n }), h('span', { text: label }));
  const overviewCard = h('a', { class: 'overview-card', href: '#/overview/system' },
    h('div', {},
      h('h2', { text: t('home.overviewTitle') }),
      h('p', { class: 'sub-title', text: t('home.overviewDesc') }),
      h('div', { class: 'stats' }, stat(nReal, t('home.statCells')), stat(store.edges.length, t('home.statLinks')), stat(nSys, t('home.statSystems'))),
      h('div', { class: 'cta', text: t('home.openOverview') })),
    previewBox);
  let preview = null;

  const el = h('div', {},
    h('section', { class: 'hero' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: t('app.name') }),
      h('p', { class: 'sub-title', text: t('app.tagline') }),
      search.el),
    h('div', { style: 'margin-top:18px' }, overviewCard),
    h('h2', { class: 'section', text: t('home.systems') }),
    h('div', { class: 'sys-grid' }, cards),
    h('h2', { class: 'section', text: t('home.tissues') }),
    h('div', { class: 'tissue-row' }, tissues));
  let gone = false;
  return {
    title: t('app.name'),
    el,
    after: () => {
      createOverviewPreview(previewBox.querySelector('.cy')).then((p) => {
        if (gone) p.destroy(); else preview = p;
      }).catch((e) => console.error(e));
    },
    destroy: () => { gone = true; search.destroy(); if (preview) preview.destroy(); },
  };
}

// ---------------------------------------------------------------- ใยรายระบบ

const EDGE_TYPES = ['develops_from', 'is_a'];

// mode ของ interacts_with ที่มีในระบบนี้ (รวมเส้นที่ออกไปนอกระบบ)
function modesInSystem(systemId) {
  const present = new Set([...systemEdges(systemId), ...crossSystemEdges(systemId)]
    .filter((e) => e.type === 'interacts_with' && e.mode).map((e) => e.mode));
  return MODES.filter((m) => present.has(m.id));
}

function listView(cells) {
  // จัดกลุ่มตามเนื้อเยื่อหลัก แล้วตามชนิดย่อย
  const byTissue = new Map();
  for (const c of cells) {
    const key = c.tissue || 'other';
    if (!byTissue.has(key)) byTissue.set(key, new Map());
    const sub = c.tissue_subtype || '';
    const m = byTissue.get(key);
    if (!m.has(sub)) m.set(sub, []);
    m.get(sub).push(c);
  }
  const lang = getLang();
  const groups = [];
  for (const tt of store.tissues) {
    const m = byTissue.get(tt.id);
    if (!m) continue;
    const subOrder = [...(tt.subtypes || []).map((s) => s.id), ''];
    const sections = [];
    for (const sid of subOrder) {
      const items = m.get(sid);
      if (!items) continue;
      const st = store.subtypes.get(sid);
      sections.push(h('div', {},
        st ? h('h4', { text: [subtypeName(sid), altNameOf(st, lang)].filter(Boolean).join(' · ') }) : null,
        h('ul', { class: 'cell-list' }, items.map((c) =>
          h('li', {}, h('a', { href: cellHref(c.id), style: `--c:${colorForKey(colorKey(c))}` },
            h('div', { class: 'th', text: cellName(c) }), h('div', { class: 'en', text: cellAlt(c) }),
            h('div', { class: 'tags' },
              c.kind === 'class' ? h('span', { class: 'chip' }, t('card.classShort')) : null,
              h('span', { class: 'chip mono' }, c.id))))))));
    }
    groups.push(h('section', { class: 'list-group' }, h('h3', { text: [tissueName(tt), altNameOf(tt, lang)].filter(Boolean).join(' · ') }), sections));
  }
  return h('div', { class: 'list-view' }, groups);
}

export function systemView(systemId) {
  const sys = store.systemsById.get(systemId);
  if (!sys) return notFoundView(t('sys.notFound'), t('sys.noSuchSystem', { id: systemId }));
  const cells = cellsInSystem(systemId);
  if (!cells.length) {
    return {
      title: sysName(sys),
      el: h('section', { class: 'notfound' },
        h('h1', { id: 'page-title', tabindex: '-1', text: sysName(sys) }),
        h('p', { text: t('sys.empty') }),
        h('a', { class: 'btn btn-primary', href: '#/' }, t('notfound.home'))),
    };
  }

  let graph = null;
  const graphBox = h('div', { class: 'cy', role: 'img', 'aria-label': t('sys.graphAria', { system: sysName(sys) }) });
  const peek = h('aside', { class: 'peek card', 'aria-label': t('peek.aria'), 'aria-live': 'polite' },
    h('p', { class: 'peek-empty', text: t('peek.empty') }));
  const info = h('div', { class: 'edge-info', role: 'status', 'aria-live': 'polite' });
  const graphWrap = h('div', { class: 'graph-wrap' }, graphBox);
  const graphPane = h('div', { class: 'sys-body' },
    h('div', {}, graphWrap, h('p', { class: 'graph-hint', text: t('sys.hint') })),
    peek);
  const listPane = listView(cells);
  listPane.hidden = true;

  const viewBtns = [
    h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setMode('graph') }, t('sys.viewGraph')),
    h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setMode('list') }, t('sys.viewList')),
  ];
  const makeToggle = (key, label, swatch) => {
    const b = h('button', { type: 'button', class: 'toggle', 'aria-pressed': 'true', onclick: () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      if (graph) graph.setEdgeVisible(key, on);
      resetPeek();
    } }, swatch, h('span', { class: 'label' }, label));
    return b;
  };
  const toggles = [
    ...EDGE_TYPES.map((ty) => makeToggle(ty, t('edge.toggle.' + ty), edgeSwatch(ty))),
    ...modesInSystem(systemId).map((m) => makeToggle('mode:' + m.id, m.label, edgeSwatch('interacts_with', m.id))),
  ];
  const fitBtn = h('button', { type: 'button', class: 'btn', onclick: () => graph && graph.fit() }, t('sys.fit'));
  const graphTools = h('div', { class: 'toolbar', style: 'margin:0' }, toggles, fitBtn);

  function resetPeek() {
    peek.replaceChildren(h('p', { class: 'peek-empty', text: t('peek.empty') }));
    info.textContent = '';
  }
  function setMode(m) {
    viewBtns[0].setAttribute('aria-pressed', String(m === 'graph'));
    viewBtns[1].setAttribute('aria-pressed', String(m === 'list'));
    graphPane.hidden = m !== 'graph';
    graphTools.hidden = m !== 'graph';
    legend.hidden = m !== 'graph';
    info.hidden = m !== 'graph';
    listPane.hidden = m !== 'list';
    if (m === 'graph') initGraph();
  }
  function initGraph() {
    if (!graph) {
      graph = createSystemGraph(graphBox, systemId, {
        onSelectNode: (cell) => { info.textContent = ''; peek.replaceChildren(renderPeek(cell)); },
        onSelectEdge: (text) => { info.textContent = text; },
        onClear: resetPeek,
        onGhost: (id) => { location.hash = cellHref(id); },
      });
    } else graph.refit();
  }

  const legend = legendFor(cells, systemId);
  const nReal = realCellCount(systemId);
  const summary = sysSummary(sys, getLang());
  const alt = altNameOf(sys, getLang());
  const countText = t('sys.cellCount', { n: nReal }) + (cells.length > nReal ? t('sys.classCount', { n: cells.length - nReal }) : '');
  const el = h('div', {},
    h('a', { class: 'crumb', href: '#/' }, t('nav.backHome')),
    h('header', { class: 'sys-head' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: sysName(sys) }),
      h('p', { class: 'sub-title' }, h('span', { class: 'dot', style: `background:${sys.color}` }), [alt, countText].filter(Boolean).join(' · ')),
      h('p', { class: 'summary' }, summary.text, summary.thaiOnly ? thaiOnlyChip() : null)),
    h('div', { class: 'toolbar' }, h('div', { class: 'btn-group', role: 'group', 'aria-label': t('sys.views') }, viewBtns), graphTools,
      h('a', { class: 'btn', href: '#/quiz?system=' + encodeURIComponent(systemId) }, t('quiz.testThis'))),
    legend, info, graphPane, listPane);

  return {
    title: sysName(sys),
    el,
    // สร้างกราฟหลังใส่ใน DOM เพื่อให้ได้ขนาดคอนเทนเนอร์ที่ถูกต้อง
    after: () => initGraph(),
    destroy: () => graph && graph.destroy(),
  };
}

// ---------------------------------------------------------------- หน้าเซลล์

export function cellView(id) {
  const cell = store.cellsById.get(id);
  if (!cell) return notFoundView(t('notfound.cell'), t('cell.noCell', { id }));
  const page = renderCellPage(cell);
  const alt = cellAlt(cell);
  return {
    title: alt ? `${cellName(cell)} (${alt})` : cellName(cell),
    el: h('div', {}, h('a', { class: 'crumb', href: '#/' }, t('nav.backHome')), page.el),
    destroy: page.destroy,
  };
}

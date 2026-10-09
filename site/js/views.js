// หน้าต่าง ๆ: หน้าแรก ใยรายระบบ หน้าเซลล์ และหน้าไม่พบ
// แต่ละ view คืน {el, title, destroy?, after?}

import { store, realCellCount, cellsInSystem, searchCells, colorKey, MODES, crossSystemEdges, systemEdges } from './data.js';
import { h, cellHref, systemHref } from './util.js';
import { createSystemGraph, colorForKey } from './graph.js';
import { renderCellPage, renderPeek } from './card.js';

// ---------------------------------------------------------------- หน้าไม่พบ

export function notFoundView(message, detail) {
  return {
    title: 'ไม่พบหน้านี้',
    el: h('section', { class: 'notfound' },
      h('h1', { id: 'page-title', tabindex: '-1', text: message }),
      h('p', { text: detail || 'ลิงก์อาจพิมพ์ผิดหรือข้อมูลยังไม่ถูกเพิ่ม' }),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'กลับหน้าแรก')),
  };
}

// ---------------------------------------------------------------- หน้าแรก

function searchBox() {
  const input = h('input', {
    id: 'q', type: 'search', autocomplete: 'off', role: 'combobox',
    'aria-expanded': 'false', 'aria-controls': 'q-results', 'aria-autocomplete': 'list',
    placeholder: 'เช่น นิวโทรฟิล, macrophage, CL:0000775',
  });
  const list = h('ul', { id: 'q-results', class: 'search-results', role: 'listbox', 'aria-label': 'ผลการค้นหา', hidden: true });
  const status = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite', style: 'position:absolute;left:-9999px' });
  const wrap = h('div', { class: 'search' }, h('label', { for: 'q', text: 'ค้นหาเซลล์' }), input, list, status);

  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  function update() {
    const q = input.value;
    list.replaceChildren();
    if (!q.trim()) { close(); status.textContent = ''; return; }
    const res = searchCells(q);
    if (!res.length) {
      list.append(h('li', { class: 'search-note', role: 'presentation' }, 'ไม่พบเซลล์ที่ตรงกับ "' + q + '"'));
    }
    for (const c of res) {
      list.append(h('li', { role: 'presentation' },
        h('a', { role: 'option', href: cellHref(c.id) }, h('span', { class: 'th' }, c.th), h('span', { class: 'en' }, c.en), h('span', { class: 'mono' }, c.id))));
    }
    status.textContent = res.length ? `พบ ${res.length} รายการ` : 'ไม่พบผลลัพธ์';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('keydown', (e) => {
    const links = [...list.querySelectorAll('a')];
    if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); links[0].focus(); }
    else if (e.key === 'Enter' && links.length) { e.preventDefault(); location.hash = links[0].getAttribute('href'); }
    else if (e.key === 'Escape') { close(); }
  });
  list.addEventListener('keydown', (e) => {
    const links = [...list.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (links[i + 1] || links[i]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : links[i - 1]).focus(); }
    else if (e.key === 'Escape') { input.focus(); close(); }
  });
  const outside = (e) => { if (!wrap.contains(e.target)) close(); };
  document.addEventListener('click', outside);
  return { el: wrap, destroy: () => document.removeEventListener('click', outside) };
}

export function homeView() {
  const search = searchBox();
  const cards = store.systems.map((s) => {
    const n = realCellCount(s.id);
    const body = [
      h('div', { class: 'th', text: s.th }),
      h('div', { class: 'en', text: s.en }),
      h('div', { class: 'meta' }, n ? `${n} เซลล์` : h('span', { class: 'chip chip-warn' }, 'กำลังจัดทำ')),
    ];
    const style = `--sys-color:${s.color}`;
    return n
      ? h('a', { class: 'sys-card', href: systemHref(s.id), style }, body)
      : h('div', { class: 'sys-card', 'aria-disabled': 'true', style }, body);
  });
  // เนื้อเยื่อหลัก 4 ประเภท (ไม่รวมหมวด other ที่ไม่มี cl_class)
  const tissues = store.tissues.filter((t) => t.cl_class).map((t) =>
    h('div', { class: 'tissue-card' },
      h('h3', { text: t.th }), h('div', { class: 'en', text: t.en }),
      h('div', { class: 'chips' }, (t.subtypes || []).map((st) => h('span', { class: 'chip' }, st.th)))));

  const el = h('div', {},
    h('section', { class: 'hero' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: 'Nexus · ใยเซลล์' }),
      h('p', { class: 'sub-title', text: 'แผนที่เครือข่ายเซลล์ในร่างกายมนุษย์' }),
      search.el),
    h('h2', { class: 'section', text: 'ระบบอวัยวะ' }),
    h('div', { class: 'sys-grid' }, cards),
    h('h2', { class: 'section', text: 'เนื้อเยื่อหลัก 4 ประเภท' }),
    h('div', { class: 'tissue-row' }, tissues));
  return { title: 'Nexus · ใยเซลล์', el, destroy: search.destroy };
}

// ---------------------------------------------------------------- ใยรายระบบ

const EDGE_TYPES = [
  { type: 'develops_from', label: 'เจริญมาจาก', cls: 'dev' },
  { type: 'is_a', label: 'เป็นชนิดหนึ่งของ', cls: 'isa' },
];

function edgeSwatch(type, mode) {
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

// mode ของ interacts_with ที่มีในระบบนี้ (รวมเส้นที่ออกไปนอกระบบ)
function modesInSystem(systemId) {
  const present = new Set([...systemEdges(systemId), ...crossSystemEdges(systemId)]
    .filter((e) => e.type === 'interacts_with' && e.mode).map((e) => e.mode));
  return MODES.filter((m) => present.has(m.id));
}

function legendFor(cells, systemId) {
  const keys = [];
  for (const c of cells) { const k = colorKey(c); if (!keys.includes(k)) keys.push(k); }
  const label = (k) => (store.subtypes.get(k) || store.tissuesById.get(k) || { th: k }).th;
  const items = keys.map((k) => h('span', {}, h('i', { class: 'sw', style: `background:${colorForKey(k)}` }), label(k)));
  if (cells.some((c) => c.kind === 'class')) items.push(h('span', {}, h('i', { class: 'sw cls' }), 'หมวด (กลุ่มของเซลล์)'));
  if (cells.some((c) => (c.systems || []).some((s) => s !== systemId))) {
    items.push(h('span', {}, h('i', { class: 'sw ring' }), 'ขอบสองชั้น = อยู่ในระบบอื่นด้วย (ชื่อระบบใต้ชื่อเซลล์)'));
  }
  if (crossSystemEdges(systemId).length) {
    items.push(h('span', {}, h('i', { class: 'sw ghost' }), 'จุดจาง = เซลล์ของระบบอื่น (แตะเพื่อเปิดหน้าเซลล์)'));
  }
  return h('div', { class: 'legend', 'aria-label': 'คำอธิบายสี' }, items);
}

function listView(cells) {
  // จัดกลุ่มตามเนื้อเยื่อหลัก แล้วตามชนิดย่อย
  const byTissue = new Map();
  for (const c of cells) {
    if (!byTissue.has(c.tissue)) byTissue.set(c.tissue, new Map());
    const sub = c.tissue_subtype || '';
    const m = byTissue.get(c.tissue);
    if (!m.has(sub)) m.set(sub, []);
    m.get(sub).push(c);
  }
  const groups = [];
  for (const t of store.tissues) {
    const m = byTissue.get(t.id);
    if (!m) continue;
    const subOrder = [...(t.subtypes || []).map((s) => s.id), ''];
    const sections = [];
    for (const sid of subOrder) {
      const items = m.get(sid);
      if (!items) continue;
      const st = store.subtypes.get(sid);
      sections.push(h('div', {},
        st ? h('h4', { text: st.th + ' · ' + st.en }) : null,
        h('ul', { class: 'cell-list' }, items.map((c) =>
          h('li', {}, h('a', { href: cellHref(c.id), style: `--c:${colorForKey(colorKey(c))}` },
            h('div', { class: 'th', text: c.th }), h('div', { class: 'en', text: c.en }),
            h('div', { class: 'tags' },
              c.kind === 'class' ? h('span', { class: 'chip' }, 'หมวด') : null,
              h('span', { class: 'chip mono' }, c.id))))))));
    }
    groups.push(h('section', { class: 'list-group' }, h('h3', { text: t.th + ' · ' + t.en }), sections));
  }
  return h('div', { class: 'list-view' }, groups);
}

export function systemView(systemId) {
  const sys = store.systemsById.get(systemId);
  if (!sys) return notFoundView('ไม่พบระบบนี้', `ไม่มีระบบ "${systemId}" ในข้อมูล`);
  const cells = cellsInSystem(systemId);
  if (!cells.length) {
    return {
      title: sys.th,
      el: h('section', { class: 'notfound' },
        h('h1', { id: 'page-title', tabindex: '-1', text: sys.th }),
        h('p', { text: 'ระบบนี้กำลังจัดทำ ยังไม่มีข้อมูลเซลล์' }),
        h('a', { class: 'btn btn-primary', href: '#/' }, 'กลับหน้าแรก')),
    };
  }

  let graph = null;
  let mode = 'graph';
  const graphBox = h('div', { class: 'cy', role: 'img', 'aria-label': `ใยเซลล์ของ${sys.th} ใช้มุมมองรายการเพื่อเลือกด้วยแป้นพิมพ์` });
  const peek = h('aside', { class: 'peek card', 'aria-label': 'ข้อมูลย่อของเซลล์ที่เลือก', 'aria-live': 'polite' },
    h('p', { class: 'peek-empty', text: 'แตะจุดบนใยเพื่อดูข้อมูลย่อ แตะที่ว่างเพื่อยกเลิก' }));
  const info = h('div', { class: 'edge-info', role: 'status', 'aria-live': 'polite' });
  const graphWrap = h('div', { class: 'graph-wrap' }, graphBox);
  const graphPane = h('div', { class: 'sys-body' },
    h('div', {}, graphWrap, h('p', { class: 'graph-hint', text: 'ซูมด้วยล้อเมาส์หรือบีบนิ้ว · ลากเพื่อเลื่อน · แตะเส้นเพื่ออ่านความสัมพันธ์ · แตะจุดจางเพื่อไปยังเซลล์ของระบบอื่น' })),
    peek);
  const listPane = listView(cells);
  listPane.hidden = true;

  const viewBtns = [
    h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setMode('graph') }, 'ใย'),
    h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setMode('list') }, 'รายการ'),
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
    ...EDGE_TYPES.map((t) => makeToggle(t.type, t.label, edgeSwatch(t.type))),
    ...modesInSystem(systemId).map((m) => makeToggle('mode:' + m.id, m.th, edgeSwatch('interacts_with', m.id))),
  ];
  const fitBtn = h('button', { type: 'button', class: 'btn', onclick: () => graph && graph.fit() }, 'ดูทั้งใย');
  const graphTools = h('div', { class: 'toolbar', style: 'margin:0' }, toggles, fitBtn);

  function resetPeek() {
    peek.replaceChildren(h('p', { class: 'peek-empty', text: 'แตะจุดบนใยเพื่อดูข้อมูลย่อ แตะที่ว่างเพื่อยกเลิก' }));
    info.textContent = '';
  }
  function setMode(m) {
    mode = m;
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
  const el = h('div', {},
    h('a', { class: 'crumb', href: '#/' }, '← หน้าแรก'),
    h('header', { class: 'sys-head' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: sys.th }),
      h('p', { class: 'sub-title' }, h('span', { class: 'dot', style: `background:${sys.color}` }), `${sys.en} · ${nReal} เซลล์` + (cells.length > nReal ? ` + ${cells.length - nReal} หมวด` : '')),
      h('p', { class: 'summary', text: sys.summary })),
    h('div', { class: 'toolbar' }, h('div', { class: 'btn-group', role: 'group', 'aria-label': 'มุมมอง' }, viewBtns), graphTools),
    legend, info, graphPane, listPane);

  return {
    title: sys.th,
    el,
    // สร้างกราฟหลังใส่ใน DOM เพื่อให้ได้ขนาดคอนเทนเนอร์ที่ถูกต้อง
    after: () => initGraph(),
    destroy: () => graph && graph.destroy(),
  };
}

// ---------------------------------------------------------------- หน้าเซลล์

export function cellView(id) {
  const cell = store.cellsById.get(id);
  if (!cell) return notFoundView('ไม่พบเซลล์นี้', `ไม่มีเซลล์รหัส ${id} ในข้อมูล`);
  const page = renderCellPage(cell);
  return {
    title: `${cell.th} (${cell.en})`,
    el: h('div', {}, h('a', { class: 'crumb', href: '#/' }, '← หน้าแรก'), page.el),
    destroy: page.destroy,
  };
}

// การ์ดเซลล์: หน้าเซลล์เต็ม และการ์ดย่อด้านข้างในใยรายระบบ
// ทุกหัวข้อที่ไม่มีข้อมูลจะถูกซ่อน

import { store, relationsOf, subtypeLabel, modeLabel } from './data.js';
import { h, cellHref, systemHref } from './util.js';
import { createMiniGraph } from './graph.js';
import { colorForKey } from './graph.js';
import { colorKey } from './data.js';

const has = (v) => !(v == null || v === '' || (Array.isArray(v) && v.length === 0));

function systemChips(cell) {
  return (cell.systems || [])
    .map((id) => store.systemsById.get(id))
    .filter(Boolean)
    .map((s) =>
      h('a', { class: 'chip', href: systemHref(s.id), title: 'ดูใยของ' + s.th },
        h('span', { class: 'dot', style: `background:${s.color}` }), s.th));
}

function tissueChips(cell) {
  const t = store.tissuesById.get(cell.tissue);
  const chips = [];
  if (t) chips.push(h('span', { class: 'chip' }, h('span', { class: 'dot', style: `background:${colorForKey(colorKey(cell))}` }), t.th));
  const st = subtypeLabel(cell);
  if (st) chips.push(h('span', { class: 'chip' }, st));
  return chips;
}

function cellLink(c) {
  return h('a', { href: cellHref(c.id) }, c.th, ' ', h('span', { class: 'note' }, '(' + c.en + ')'));
}

function fact(title, content) {
  return h('section', { class: 'fact' }, h('h2', { text: title }), content);
}

function imageBlock(cell) {
  const img = cell.image;
  if (!img || !img.src) {
    return h('div', { class: 'img-missing' },
      h('strong', { text: 'ยังไม่มีรูป' }),
      h('span', { text: 'ใส่รูปที่ได้รับอนุญาตไว้ที่' }),
      h('code', { text: `images/${cell.slug}.jpg` }));
  }
  const figure = h('figure', { class: 'figure' });
  const pic = h('img', { src: img.src, alt: `ภาพ ${cell.th} (${cell.en})`, loading: 'lazy' });
  pic.addEventListener('error', () => {
    pic.replaceWith(h('div', { class: 'img-missing', role: 'img', 'aria-label': 'โหลดรูปไม่สำเร็จ' },
      h('strong', { text: 'โหลดรูปไม่สำเร็จ' }),
      h('code', { text: img.src })));
  });
  const credit = [];
  if (img.type) credit.push(img.type);
  if (img.stain) credit.push('ย้อม ' + img.stain);
  const line = [];
  if (img.credit) line.push('ภาพโดย ' + img.credit);
  if (img.license) line.push(img.license);
  figure.append(pic);
  const cap = h('figcaption', {}, credit.length ? credit.join(' · ') + ' — ' : '', line.join(' · '));
  if (img.source) {
    const safe = /^https?:\/\//i.test(img.source);
    cap.append(' · ', safe ? h('a', { href: img.source, rel: 'noopener noreferrer', target: '_blank' }, 'ที่มา') : 'ที่มา: ' + img.source);
  }
  figure.append(cap);
  return figure;
}

function relGroup(title, items, withNote = false, incoming = false) {
  if (!items.length) return null;
  return h('section', { class: 'rel-group' }, h('h3', { text: title }),
    h('ul', { class: 'rel-list' },
      items.map((x) => h('li', {}, cellLink(x.cell),
        withNote && x.mode ? h('span', { class: 'chip mode-chip', 'data-mode': x.mode }, modeLabel(x.mode)) : null,
        withNote && x.th ? h('span', { class: 'note' }, (incoming ? '← ' : '→ ') + x.th) : null))));
}

export function renderCellPage(cell) {
  const rel = relationsOf(cell.id);
  const cleanups = [];
  const root = h('article', { class: 'cell-page' });

  const synonyms = (cell.cl && cell.cl.synonyms) || [];
  const title = h('div', { class: 'cell-title' },
    h('h1', { id: 'page-title', tabindex: '-1', text: cell.th }),
    h('p', { class: 'en', text: cell.en }),
    h('div', { class: 'ids' },
      cell.purl ? h('a', { class: 'mono', href: cell.purl, rel: 'noopener', target: '_blank', title: 'เปิดใน Cell Ontology' }, cell.id) : h('span', { class: 'mono' }, cell.id),
      cell.kind === 'class' ? h('span', { class: 'chip' }, 'หมวด (กลุ่มของเซลล์)') : null,
      cell.verified ? h('span', { class: 'chip chip-ok' }, 'ตรวจกับตำราแล้ว') : h('span', { class: 'chip chip-warn' }, 'ยังไม่ได้ตรวจกับตำรา')),
    synonyms.length ? h('p', { class: 'synonyms' }, 'ชื่ออื่น: ', synonyms.join(', ')) : null,
    h('div', { class: 'chips', 'aria-label': 'ระบบ' }, systemChips(cell)),
    h('div', { class: 'chips', 'aria-label': 'เนื้อเยื่อ' }, tissueChips(cell)),
    cell.cl && cell.cl.definition
      ? h('div', { class: 'def-box', lang: 'en' }, h('h2', { lang: 'th', text: 'คำนิยามจาก Cell Ontology (อังกฤษ)' }), h('p', { text: cell.cl.definition }))
      : null);
  root.append(h('div', { class: 'cell-hero' }, imageBlock(cell), title));

  const facts = [
    has(cell.location) ? fact('ตำแหน่งที่พบ', h('p', { text: cell.location })) : null,
    has(cell.morphology) ? fact('ลักษณะ', h('p', { text: cell.morphology })) : null,
    has(cell.function) ? fact('หน้าที่', h('p', { text: cell.function })) : null,
    has(cell.secretes) ? fact('สารที่หลั่ง', h('p', { text: cell.secretes.join(', ') })) : null,
    has(cell.markers) ? fact('Marker', h('p', { class: 'mono', text: cell.markers.join(' · ') })) : null,
    has(cell.lifespan) ? fact('อายุขัย', h('p', { text: cell.lifespan })) : null,
  ].filter(Boolean);
  if (facts.length) root.append(h('div', { class: 'facts card' }, facts));

  if (has(cell.exam)) {
    root.append(h('section', { class: 'exam' }, h('h2', { text: 'จุดออกสอบ' }), h('p', { text: cell.exam })));
  }

  const extra = [];
  if (has(cell.diseases)) {
    extra.push(fact('โรคและภาวะที่เกี่ยวข้อง', h('ul', { class: 'bullets' }, cell.diseases.map((d) => h('li', { text: d })))));
  }
  const confused = (cell.confused_with || []).map((i) => store.cellsById.get(i)).filter(Boolean);
  if (confused.length) {
    extra.push(fact('มักสับสนกับ', h('ul', { class: 'rel-list' }, confused.map((c) => h('li', {}, cellLink(c))))));
  }
  if (extra.length) root.append(h('div', { class: 'facts card' }, extra));

  const groups = [
    relGroup('เจริญมาจาก', rel.developsFrom),
    relGroup('เจริญไปเป็น', rel.giveRiseTo),
    relGroup('เป็นชนิดหนึ่งของ', rel.isA),
    relGroup('ชนิดย่อย', rel.subtypes),
    relGroup('ทำงานร่วมกับ (ส่งผลต่อ)', rel.interactsOut, true, false),
    relGroup('ทำงานร่วมกับ (ได้รับผลจาก)', rel.interactsIn, true, true),
  ].filter(Boolean);
  if (groups.length) {
    const graphBox = h('div', { class: 'mini-graph', role: 'img', 'aria-label': `ใยย่อยของ ${cell.en} และเซลล์ที่เชื่อมโยงโดยตรง` },
      h('div', { class: 'cy' }));
    root.append(
      h('h2', { class: 'section', text: 'ความเชื่อมโยง' }),
      h('div', { class: 'relations card' }, groups),
      h('h2', { class: 'section', text: 'ใยย่อย' }),
      graphBox,
      h('p', { class: 'graph-hint', text: 'แตะจุดเพื่อไปยังเซลล์นั้น · ใช้ลิงก์ในรายการด้านบนเพื่อใช้แป้นพิมพ์' }));
    // สร้างกราฟหลังใส่ใน DOM แล้ว
    queueMicrotask(() => {
      const g = createMiniGraph(graphBox.querySelector('.cy'), cell.id, (id) => { location.hash = cellHref(id); });
      cleanups.push(() => g.destroy());
    });
  }

  if (has(cell.refs)) {
    root.append(h('h2', { class: 'section', text: 'อ้างอิง' }), h('ul', { class: 'bullets refs' }, cell.refs.map((r) => h('li', { text: r }))));
  }

  return { el: root, destroy: () => cleanups.forEach((f) => f()) };
}

// การ์ดย่อด้านข้างในหน้าใยรายระบบ
export function renderPeek(cell) {
  return h('div', {},
    h('h2', { text: cell.th }),
    h('p', { class: 'en', text: cell.en }),
    h('div', { class: 'chips' },
      h('span', { class: 'chip mono' }, cell.id),
      cell.kind === 'class' ? h('span', { class: 'chip' }, 'หมวด') : null,
      tissueChips(cell),
      cell.verified ? null : h('span', { class: 'chip chip-warn' }, 'ยังไม่ได้ตรวจ')),
    (cell.systems || []).length > 1 ? h('div', { class: 'chips' }, systemChips(cell)) : null,
    has(cell.function) ? h('p', { text: cell.function }) : null,
    h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: cellHref(cell.id) }, 'ดูข้อมูลเต็ม')));
}

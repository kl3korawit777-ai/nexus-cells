// การ์ดเซลล์: หน้าเซลล์เต็ม และการ์ดย่อด้านข้างในใยรายระบบ
// ทุกหัวข้อที่ไม่มีข้อมูลจะถูกซ่อน เนื้อหาเลือกตามภาษา (en_content ถ้ามี ไม่มีก็ใช้ภาษาไทยพร้อมป้าย "Thai only")

import { store, relationsOf, modeLabel, colorKey, cellName, cellAlt, sysName, tissueName, subtypeName } from './data.js';
import { h, cellHref, systemHref, tissueHref, idToHash } from './util.js';
import { t, getLang } from './i18n.js';
import { textOf, listOf } from './content.js';
import { createMiniGraph, colorForKey } from './graph.js';
import { renderGallery, thumbOf } from './gallery.js';
import { firstImage } from './images.js';

const has = (v) => !(v == null || v === '' || (Array.isArray(v) && v.length === 0));
const thaiOnlyChip = () => h('span', { class: 'chip chip-thai', text: t('common.thaiOnly') });

function systemChips(cell) {
  return (cell.systems || [])
    .map((id) => store.systemsById.get(id))
    .filter(Boolean)
    .map((s) =>
      h('a', { class: 'chip', href: systemHref(s.id), title: t('card.viewSystem', { system: sysName(s) }) },
        h('span', { class: 'dot', style: `background:${s.color}` }), sysName(s)));
}

function tissueChips(cell) {
  const tt = store.tissuesById.get(cell.tissue);
  const chips = [];
  if (tt) {
    chips.push(h('a', { class: 'chip', href: tissueHref(tt.id), title: t('card.viewTissue', { tissue: tissueName(tt) }) },
      h('span', { class: 'dot', style: `background:${colorForKey(colorKey(cell))}` }), tissueName(tt)));
  }
  const st = subtypeName(cell.tissue_subtype);
  if (st) chips.push(h('span', { class: 'chip' }, st));
  return chips;
}

function cellLink(c) {
  const alt = cellAlt(c);
  return h('a', { href: cellHref(c.id) }, cellName(c), alt ? ' ' : null, alt ? h('span', { class: 'note' }, '(' + alt + ')') : null);
}

function fact(title, content, thaiOnly) {
  return h('section', { class: 'fact' }, h('h2', {}, title, thaiOnly ? thaiOnlyChip() : null), content);
}

function relGroup(title, items, withNote = false, incoming = false) {
  if (!items.length) return null;
  return h('section', { class: 'rel-group' }, h('h3', { text: title }),
    h('ul', { class: 'rel-list' },
      items.map((x) => h('li', {}, cellLink(x.cell),
        withNote && x.mode ? h('span', { class: 'chip mode-chip', 'data-mode': x.mode }, modeLabel(x.mode)) : null,
        withNote && x.th ? h('span', { class: 'note' }, (incoming ? '← ' : '→ ') + x.th) : null,
        withNote && x.th && getLang() === 'en' ? thaiOnlyChip() : null))));
}

export function renderCellPage(cell) {
  const lang = getLang();
  const rel = relationsOf(cell.id);
  const cleanups = [];
  const root = h('article', { class: 'cell-page' });

  const synonyms = (cell.cl && cell.cl.synonyms) || [];
  const alt = cellAlt(cell);
  const title = h('div', { class: 'cell-title' },
    h('h1', { id: 'page-title', tabindex: '-1', text: cellName(cell) }),
    alt ? h('p', { class: 'en', text: alt }) : null,
    h('div', { class: 'ids' },
      cell.purl ? h('a', { class: 'mono', href: cell.purl, rel: 'noopener', target: '_blank', title: t('card.openInCL') }, cell.id) : h('span', { class: 'mono' }, cell.id),
      cell.kind === 'class' ? h('span', { class: 'chip' }, t('card.class')) : null,
      cell.verified ? h('span', { class: 'chip chip-ok' }, t('card.verified')) : h('span', { class: 'chip chip-warn' }, t('card.unverified'))),
    synonyms.length ? h('p', { class: 'synonyms' }, t('card.synonyms'), ': ', synonyms.join(', ')) : null,
    h('div', { class: 'chips', 'aria-label': t('card.systemsAria') }, systemChips(cell)),
    h('div', { class: 'chips', 'aria-label': t('card.tissuesAria') }, tissueChips(cell)),
    h('p', { class: 'toolbar' },
      h('a', { class: 'btn', href: '#/quiz?cell=' + idToHash(cell.id) }, t('quiz.testThis')),
      h('a', { class: 'btn', href: '#/compare/' + idToHash(cell.id) }, t('cmp.compareWith'))),
    cell.cl && cell.cl.definition
      ? h('div', { class: 'def-box', lang: 'en' }, h('h2', { lang, text: t('card.definition') }), h('p', { text: cell.cl.definition }))
      : null);
  root.append(h('div', { class: 'cell-hero' }, renderGallery(cell.images, { alt: t('card.imageAlt', { name: cellName(cell) }), hint: `images/${cell.slug}/` }), title));

  const T = (field) => textOf(cell, field, lang);
  const L = (field) => listOf(cell, field, lang);
  const textFact = (field, key) => { const x = T(field); return x.text ? fact(t(key), h('p', { text: x.text }), x.thaiOnly) : null; };
  const secretes = L('secretes'), markers = L('markers');
  const facts = [
    textFact('location', 'field.location'),
    textFact('morphology', 'field.morphology'),
    textFact('function', 'field.function'),
    secretes.items.length ? fact(t('field.secretes'), h('p', { text: secretes.items.join(', ') }), secretes.thaiOnly) : null,
    markers.items.length ? fact(t('field.markers'), h('p', { class: 'mono', text: markers.items.join(' · ') }), markers.thaiOnly) : null,
    textFact('lifespan', 'field.lifespan'),
  ].filter(Boolean);
  if (facts.length) root.append(h('div', { class: 'facts card' }, facts));

  const exam = T('exam');
  if (exam.text) {
    root.append(h('section', { class: 'exam' }, h('h2', {}, t('field.exam'), exam.thaiOnly ? thaiOnlyChip() : null), h('p', { text: exam.text })));
  }

  const extra = [];
  const diseases = L('diseases');
  if (diseases.items.length) {
    extra.push(fact(t('field.diseases'), h('ul', { class: 'bullets' }, diseases.items.map((d) => h('li', { text: d }))), diseases.thaiOnly));
  }
  const confused = (cell.confused_with || []).map((i) => store.cellsById.get(i)).filter(Boolean);
  if (confused.length) {
    extra.push(fact(t('field.confused'), h('ul', { class: 'rel-list' }, confused.map((c) => h('li', {}, cellLink(c),
      h('a', { class: 'note', href: '#/compare/' + idToHash(cell.id) + '/' + idToHash(c.id) }, t('card.compareShort')))))));
  }
  if (extra.length) root.append(h('div', { class: 'facts card' }, extra));

  const groups = [
    relGroup(t('rel.developsFrom'), rel.developsFrom),
    relGroup(t('rel.giveRiseTo'), rel.giveRiseTo),
    relGroup(t('rel.isA'), rel.isA),
    relGroup(t('rel.subtypes'), rel.subtypes),
    relGroup(t('rel.interactsOut'), rel.interactsOut, true, false),
    relGroup(t('rel.interactsIn'), rel.interactsIn, true, true),
  ].filter(Boolean);
  if (groups.length) {
    const graphBox = h('div', { class: 'mini-graph', role: 'img', 'aria-label': t('card.subgraphAria', { name: cellName(cell) }) },
      h('div', { class: 'cy' }));
    root.append(
      h('h2', { class: 'section', text: t('card.relations') }),
      h('div', { class: 'relations card' }, groups),
      h('h2', { class: 'section', text: t('card.subgraph') }),
      graphBox,
      h('p', { class: 'graph-hint', text: t('card.subgraphHint') }));
    // สร้างกราฟหลังใส่ใน DOM แล้ว
    queueMicrotask(() => {
      const g = createMiniGraph(graphBox.querySelector('.cy'), cell.id, (id) => { location.hash = cellHref(id); });
      cleanups.push(() => g.destroy());
    });
  }

  if (has(cell.refs)) {
    root.append(h('h2', { class: 'section', text: t('card.refs') }), h('ul', { class: 'bullets refs' }, cell.refs.map((r) => h('li', { text: r }))));
  }

  return { el: root, destroy: () => cleanups.forEach((f) => f()) };
}

// การ์ดย่อด้านข้างในหน้าใยรายระบบ/ใยภาพรวม
export function renderPeek(cell) {
  const fn = textOf(cell, 'function', getLang());
  const alt = cellAlt(cell);
  return h('div', {},
    thumbOf(firstImage(cell), t('card.imageAlt', { name: cellName(cell) })),
    h('h2', { text: cellName(cell) }),
    alt ? h('p', { class: 'en', text: alt }) : null,
    h('div', { class: 'chips' },
      h('span', { class: 'chip mono' }, cell.id),
      cell.kind === 'class' ? h('span', { class: 'chip' }, t('card.classShort')) : null,
      tissueChips(cell),
      cell.verified ? null : h('span', { class: 'chip chip-warn' }, t('card.unverifiedShort'))),
    (cell.systems || []).length > 1 ? h('div', { class: 'chips' }, systemChips(cell)) : null,
    fn.text ? h('p', {}, fn.text, fn.thaiOnly ? thaiOnlyChip() : null) : null,
    h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: cellHref(cell.id) }, t('peek.viewFull'))));
}

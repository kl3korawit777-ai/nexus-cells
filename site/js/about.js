// หน้าเกี่ยวกับ (#/about): โปรเจกต์ ผู้จัดทำ วิธีเก็บและตรวจข้อมูล สถิติ เครดิต และข้อความปฏิเสธความรับผิดชอบ
// สถิติและเครดิตรูปคำนวณจากข้อมูลจริงทุกครั้งที่เปิดหน้า

import { store, realCellCount, cellName, tissueName } from './data.js';
import { h, cellHref, tissueHref } from './util.js';
import { t } from './i18n.js';

// ไลบรารีและแหล่งข้อมูลที่ใช้ (ชื่อเฉพาะและสัญญาอนุญาต ไม่ต้องแปล)
const LIBRARIES = [
  { name: 'Cytoscape.js 3.30.2', license: 'MIT', url: 'https://js.cytoscape.org/' },
  { name: 'cytoscape-fcose 2.2.0', license: 'MIT', url: 'https://github.com/iVis-at-Bilkent/cytoscape.js-fcose' },
  { name: 'layout-base 2.0.1', license: 'MIT', url: 'https://github.com/iVis-at-Bilkent/layout-base' },
  { name: 'cose-base 2.2.0', license: 'MIT', url: 'https://github.com/iVis-at-Bilkent/cose-base' },
  { name: 'IBM Plex Sans Thai / IBM Plex Mono', license: 'SIL OFL 1.1', url: 'https://github.com/IBM/plex' },
];

function stat(n, label) {
  return h('div', { class: 'stat' }, h('b', { text: String(n) }), h('span', { text: label }));
}

// เครดิตรูปทั้งหมดจากช่อง image ของทุกเซลล์และเนื้อเยื่อ
function imageCredits() {
  const rows = [];
  for (const c of store.cells) if (c.image && c.image.src) rows.push({ name: cellName(c), href: cellHref(c.id), img: c.image });
  for (const tt of store.tissues) if (tt.image && tt.image.src) rows.push({ name: tissueName(tt), href: tissueHref(tt.id), img: tt.image });
  return rows;
}

export function aboutView() {
  const cells = store.cells.filter((c) => c.kind === 'cell');
  const classes = store.cells.length - cells.length;
  const verified = cells.filter((c) => c.verified === true).length;
  const withEn = cells.filter((c) => c.en_content && Object.keys(c.en_content).length).length;
  const withImg = cells.filter((c) => c.image && c.image.src).length;
  const byType = (ty) => store.edges.filter((e) => e.type === ty).length;
  const sysWithData = store.systems.filter((s) => realCellCount(s.id) > 0).length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  const stats = h('div', { class: 'stats about-stats' },
    stat(cells.length, t('about.stat.cells')),
    stat(classes, t('about.stat.classes')),
    stat(store.edges.length, t('about.stat.links')),
    stat(`${sysWithData}/${store.systems.length}`, t('about.stat.systems')),
    stat(`${verified}/${cells.length} (${pct(verified, cells.length)}%)`, t('about.stat.verified')),
    stat(`${withEn}/${cells.length} (${pct(withEn, cells.length)}%)`, t('about.stat.english')),
    stat(`${withImg}/${cells.length}`, t('about.stat.images')));
  const linkLine = t('about.stat.linkTypes', { dev: byType('develops_from'), isa: byType('is_a'), int: byType('interacts_with') });

  const credits = imageCredits();
  const creditList = credits.length
    ? h('ul', { class: 'rel-list' }, credits.map(({ name, href, img }) => h('li', {},
      h('a', { href }, name), ' — ', [img.credit, img.license].filter(Boolean).join(' · '),
      img.source && /^https?:\/\//i.test(img.source) ? [' · ', h('a', { href: img.source, rel: 'noopener noreferrer', target: '_blank' }, t('card.source'))] : null)))
    : h('p', { class: 'empty', text: t('about.imagesNone') });

  const el = h('article', { class: 'about' },
    h('a', { class: 'crumb', href: '#/' }, t('nav.backHome')),
    h('header', { class: 'sys-head' },
      h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', text: t('about.title') }),
      h('p', { class: 'sub-title', text: t('about.lead') })),
    h('section', { class: 'card' }, h('h2', { text: t('about.projectTitle') }), h('p', { text: t('about.project1') }), h('p', { text: t('about.project2') })),
    h('section', { class: 'card' }, h('h2', { text: t('about.authorTitle') }), h('p', {}, h('strong', { text: t('about.authorName') }), ' ', t('about.authorRole'))),
    h('section', { class: 'card' }, h('h2', { text: t('about.methodTitle') }),
      h('ol', { class: 'bullets' },
        h('li', { text: t('about.method1') }), h('li', { text: t('about.method2') }),
        h('li', { text: t('about.method3') }), h('li', { text: t('about.method4') }))),
    h('section', {}, h('h2', { class: 'section', text: t('about.statsTitle') }), stats, h('p', { class: 'graph-hint', text: linkLine })),
    h('section', { class: 'card' }, h('h2', { text: t('about.creditsTitle') }),
      h('p', {}, h('a', { href: 'https://obofoundry.org/ontology/cl.html', rel: 'noopener', target: '_blank' }, 'Cell Ontology (CL)'), ' ', t('about.clCredit')),
      h('p', {}, h('a', { href: 'https://www.ebi.ac.uk/ols4', rel: 'noopener', target: '_blank' }, 'EMBL-EBI Ontology Lookup Service'), ' ', t('about.olsCredit')),
      h('h3', { text: t('about.librariesTitle') }),
      h('ul', { class: 'rel-list' }, LIBRARIES.map((l) => h('li', {}, h('a', { href: l.url, rel: 'noopener', target: '_blank' }, l.name), ' · ', l.license)))),
    h('section', { class: 'card' }, h('h2', { text: t('about.imageCreditsTitle') }), creditList),
    h('section', { class: 'exam about-disclaimer' }, h('h2', { text: t('about.disclaimerTitle') }), h('p', { text: t('about.disclaimer') })));

  return { title: t('nav.about'), el };
}

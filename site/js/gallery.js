// แกลเลอรีรูปของเซลล์/เนื้อเยื่อ: รูปใหญ่ + แถบรูปย่อ + ตัวกรองประเภท + ดูเต็มจอ (<dialog>) ซูมได้
// และรูปเดี่ยวสำหรับหน้าเปรียบเทียบ/การ์ดย่อ ข้อความทั้งหมดมาจาก i18n

import { h } from './util.js';
import { t, getLang } from './i18n.js';
import { imagesOf, typesIn } from './images.js';

const typeLabel = (type) => t('img.type.' + type);
const thaiOnlyChip = () => h('span', { class: 'chip chip-thai', text: t('common.thaiOnly') });

function missingBox(hint) {
  return h('div', { class: 'img-missing' },
    h('strong', { text: t('card.imageMissing') }),
    h('span', { text: t('card.imageHint') }),
    h('code', { text: hint }));
}

function failedBox(src) {
  return h('div', { class: 'img-missing img-failed', role: 'img', 'aria-label': t('card.imageFailed') },
    h('strong', { text: t('card.imageFailed') }),
    h('code', { text: src }));
}

export function altOf(img, fallback) {
  if (getLang() === 'th' && img.alt_th) return img.alt_th;
  return [fallback, img.type ? typeLabel(img.type) : null].filter(Boolean).join(' — ');
}

// บรรทัดคำอธิบายรูป: caption + ป้ายประเภท + วิธีย้อม + กำลังขยาย + เครดิต
export function captionNodes(img) {
  const lang = getLang();
  const nodes = [];
  const cap = lang === 'en' ? (img.caption_en || img.caption_th) : img.caption_th;
  if (cap) nodes.push(h('p', { class: 'gal-text' }, cap, lang === 'en' && !img.caption_en ? thaiOnlyChip() : null));
  const facts = [];
  if (img.stain) facts.push(t('card.stain', { stain: img.stain }));
  if (img.magnification) facts.push(t('img.magnification', { m: img.magnification }));
  nodes.push(h('p', { class: 'gal-meta' },
    img.type ? h('span', { class: 'chip', text: typeLabel(img.type) }) : null,
    facts.length ? ' ' + facts.join(' · ') : null));
  const line = [];
  if (img.credit) line.push(t('card.credit', { credit: img.credit }));
  if (img.license) line.push(img.license);
  const credit = h('p', { class: 'gal-credit' }, line.join(' · '));
  if (img.source) {
    const safe = /^https?:\/\//i.test(img.source);
    credit.append(line.length ? ' · ' : '', safe
      ? h('a', { href: img.source, rel: 'noopener noreferrer', target: '_blank' }, t('card.source'))
      : t('card.sourceText', { source: img.source }));
  }
  nodes.push(credit);
  return nodes;
}

// รูปเดี่ยวพร้อมคำอธิบาย (หน้าเปรียบเทียบ การ์ดย่อ) img = null แสดงกรอบ "ยังไม่มีรูป"
export function imageFigure(img, alt, hint, { emptyText } = {}) {
  if (!img || !img.src) {
    if (emptyText) return h('div', { class: 'img-missing' }, h('strong', { text: emptyText }));
    return missingBox(hint);
  }
  const frame = h('div', { class: 'gal-frame' });
  const pic = h('img', { src: img.src, alt: altOf(img, alt), loading: 'lazy', decoding: 'async' });
  pic.addEventListener('error', () => frame.replaceChildren(failedBox(img.src)));
  frame.append(pic);
  return h('figure', { class: 'figure' }, frame, h('figcaption', { class: 'gal-cap' }, captionNodes(img)));
}

// รูปย่อสำหรับการ์ดย่อ (ใช้รูปแรกเท่านั้น) ถ้ารูปโหลดไม่ได้จะเอาออกทั้งกรอบ
export function thumbOf(img, alt) {
  if (!img || !img.src) return null;
  const pic = h('img', { src: img.src, alt: altOf(img, alt), loading: 'lazy', decoding: 'async' });
  const box = h('div', { class: 'peek-thumb' }, pic);
  pic.addEventListener('error', () => box.remove());
  return box;
}

// ------------------------------------------------------------------ แกลเลอรี

export function renderGallery(allImages, { alt, hint }) {
  const images = imagesOf({ images: allImages });
  if (!images.length) return missingBox(hint);

  const types = typesIn(images);
  let filter = null;           // null = ทุกประเภท
  let list = images;
  let idx = 0;

  const root = h('section', { class: 'gallery', 'aria-label': t('img.galleryAria') });
  const filterBar = types.length > 1 ? h('div', { class: 'gal-filter', role: 'group', 'aria-label': t('img.filterLabel') }) : null;
  const frame = h('div', { class: 'gal-frame' });
  const counter = h('span', { class: 'gal-counter', 'aria-hidden': 'true' });
  const openBtn = h('button', { type: 'button', class: 'gal-open', 'aria-label': t('img.open') }, frame);
  const prev = h('button', { type: 'button', class: 'gal-nav gal-prev', 'aria-label': t('img.prev') }, '‹');
  const next = h('button', { type: 'button', class: 'gal-nav gal-next', 'aria-label': t('img.next') }, '›');
  const stage = h('div', { class: 'gal-stage' }, openBtn, prev, next, counter);
  const cap = h('div', { class: 'gal-cap', 'aria-live': 'polite' });
  const thumbs = h('div', { class: 'gal-thumbs', role: 'group', 'aria-label': t('img.thumbsLabel') });
  root.append(filterBar, stage, cap, thumbs);

  let dlg = null;

  function drawMain() {
    const img = list[idx];
    const pic = h('img', { src: img.src, alt: altOf(img, alt), decoding: 'async' });
    pic.addEventListener('error', () => frame.replaceChildren(failedBox(img.src)));
    frame.replaceChildren(pic);
    cap.replaceChildren(...captionNodes(img));
    const many = list.length > 1;
    prev.hidden = next.hidden = counter.hidden = !many;
    counter.textContent = t('img.counter', { n: idx + 1, total: list.length });
    [...thumbs.children].forEach((b, i) => {
      if (i === idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    const cur = thumbs.children[idx];
    if (cur && cur.scrollIntoView && thumbs.scrollWidth > thumbs.clientWidth) {
      thumbs.scrollTo({ left: cur.offsetLeft - (thumbs.clientWidth - cur.offsetWidth) / 2, behavior: 'smooth' });
    }
    if (dlg && dlg.isOpen()) dlg.sync();
  }

  function drawThumbs() {
    thumbs.hidden = list.length < 2;
    thumbs.replaceChildren(...list.map((img, i) => {
      const pic = h('img', { src: img.src, alt: '', loading: 'lazy', decoding: 'async', width: 72, height: 54 });
      const b = h('button', { type: 'button', class: 'gal-thumb', 'aria-label': t('img.showN', { n: i + 1, type: typeLabel(img.type) }), onclick: () => go(i, true) }, pic);
      pic.addEventListener('error', () => { b.classList.add('bad'); pic.remove(); b.append('!'); });
      return b;
    }));
  }

  function drawFilter() {
    if (!filterBar) return;
    const mk = (type) => h('button', {
      type: 'button', class: 'gal-chip', 'aria-pressed': String(filter === type),
      onclick: () => { filter = type; list = type ? images.filter((i) => i.type === type) : images; idx = 0; drawFilter(); drawThumbs(); drawMain(); },
    }, type ? typeLabel(type) : t('img.filterAll'), h('span', { class: 'gal-n', text: String(type ? images.filter((i) => i.type === type).length : images.length) }));
    filterBar.replaceChildren(mk(null), ...types.map(mk));
  }

  function go(i, absolute = false) {
    const n = list.length;
    idx = absolute ? i : (idx + i + n) % n;
    drawMain();
  }

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  openBtn.addEventListener('click', () => {
    if (!dlg) dlg = makeDialog();
    dlg.open();
  });

  // ปัดซ้ายขวาบนจอสัมผัส (เมาส์ไม่ใช้การลาก)
  let sx = null, sy = null, swiped = false;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; sx = e.clientX; sy = e.clientY; swiped = false; });
  stage.addEventListener('pointercancel', () => { sx = null; });
  stage.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (list.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; go(dx < 0 ? 1 : -1); }
  });
  stage.addEventListener('click', (e) => { if (swiped) { swiped = false; e.preventDefault(); e.stopPropagation(); } }, true);

  // ปุ่มลูกศรบนคีย์บอร์ด: ใช้ได้เมื่อโฟกัสอยู่ในแกลเลอรีหรือไม่ได้โฟกัสช่องกรอกใด ๆ
  // (ตัวฟังถอดตัวเองเมื่อแกลเลอรีถูกถอดออกจากหน้า)
  const onKey = (e) => {
    if (!root.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (list.length < 2 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (document.querySelector('dialog[open]')) return;
    const a = document.activeElement;
    const inside = root.contains(a);
    const typing = a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    if (typing || (!inside && a && a !== document.body)) return;
    if (filterBar && filterBar.contains(a)) return;
    e.preventDefault();
    go(e.key === 'ArrowRight' ? 1 : -1);
  };
  document.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- เต็มจอ

  function makeDialog() {
    const d = h('dialog', { class: 'gal-dialog', 'aria-label': t('img.dialogLabel') });
    const title = h('span', { class: 'gal-dlg-count' });
    const zoomLabel = h('span', { class: 'gal-dlg-zoom', 'aria-live': 'polite' });
    const btn = (label, text, fn, extra = '') => h('button', { type: 'button', class: 'gal-dlg-btn ' + extra, 'aria-label': label, title: label, onclick: fn }, text);
    const viewer = h('div', { class: 'gal-viewer', tabindex: '0', 'aria-label': t('img.zoomHint') });
    const dcap = h('div', { class: 'gal-dlg-cap' });
    const bar = h('div', { class: 'gal-dlg-bar' },
      title, zoomLabel,
      btn(t('img.zoomOut'), '−', () => setScale(scale / 1.4)),
      btn(t('img.zoomReset'), '1:1', () => setScale(1)),
      btn(t('img.zoomIn'), '+', () => setScale(scale * 1.4)),
      btn(t('img.close'), '✕', () => d.close(), 'gal-dlg-close'));
    const dprev = btn(t('img.prev'), '‹', () => go(-1), 'gal-nav gal-prev');
    const dnext = btn(t('img.next'), '›', () => go(1), 'gal-nav gal-next');
    d.append(bar, h('div', { class: 'gal-dlg-stage' }, viewer, dprev, dnext), dcap);
    root.append(d);

    let scale = 1;
    let pic = null;
    let baseW = 0;
    const MAX = 6;

    function applyScale(keepCx = 0.5, keepCy = 0.5) {
      if (!pic) return;
      if (scale <= 1.001) {
        pic.classList.add('fit');
        pic.style.width = '';
      } else {
        const w = baseW * scale;
        pic.classList.remove('fit');
        pic.style.width = w + 'px';
        viewer.scrollLeft = viewer.scrollWidth * keepCx - viewer.clientWidth / 2;
        viewer.scrollTop = viewer.scrollHeight * keepCy - viewer.clientHeight / 2;
      }
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }
    function setScale(s) {
      const cx = viewer.scrollWidth ? (viewer.scrollLeft + viewer.clientWidth / 2) / viewer.scrollWidth : 0.5;
      const cy = viewer.scrollHeight ? (viewer.scrollTop + viewer.clientHeight / 2) / viewer.scrollHeight : 0.5;
      scale = Math.min(MAX, Math.max(1, s));
      if (scale > 1 && !baseW && pic) baseW = pic.getBoundingClientRect().width;
      applyScale(cx, cy);
    }

    function sync() {
      const img = list[idx];
      scale = 1; baseW = 0;
      pic = h('img', { src: img.src, alt: altOf(img, alt), class: 'fit', draggable: 'false' });
      pic.addEventListener('error', () => { pic = null; viewer.replaceChildren(failedBox(img.src)); });
      pic.addEventListener('load', () => { baseW = 0; });
      pic.addEventListener('dblclick', () => setScale(scale > 1 ? 1 : 2.5));
      viewer.replaceChildren(pic);
      viewer.scrollTo(0, 0);
      zoomLabel.textContent = '100%';
      title.textContent = t('img.counter', { n: idx + 1, total: list.length });
      dcap.replaceChildren(...captionNodes(img));
      dprev.hidden = dnext.hidden = list.length < 2;
    }

    // ซูมด้วยล้อเมาส์ และบีบสองนิ้ว
    viewer.addEventListener('wheel', (e) => { e.preventDefault(); setScale(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
    let d0 = 0, s0 = 1;
    const dist = (e) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    viewer.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { d0 = dist(e); s0 = scale; } }, { passive: true });
    viewer.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && d0) { e.preventDefault(); setScale(s0 * dist(e) / d0); }
    }, { passive: false });
    viewer.addEventListener('touchend', (e) => { if (e.touches.length < 2) d0 = 0; });
    // ปัดซ้ายขวาเพื่อเปลี่ยนรูปเมื่อไม่ได้ซูม
    let tx = null, ty = null;
    viewer.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && scale <= 1.001) { tx = e.clientX; ty = e.clientY; } });
    viewer.addEventListener('pointerup', (e) => {
      if (tx == null) return;
      const dx = e.clientX - tx, dy = e.clientY - ty;
      tx = null;
      if (list.length > 1 && scale <= 1.001 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    });
    viewer.addEventListener('pointercancel', () => { tx = null; });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && list.length > 1 && scale <= 1.001) { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight' && list.length > 1 && scale <= 1.001) { e.preventDefault(); go(1); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); setScale(scale * 1.4); }
      else if (e.key === '-') { e.preventDefault(); setScale(scale / 1.4); }
      else if (e.key === '0') { e.preventDefault(); setScale(1); }
    });
    d.addEventListener('close', () => { document.documentElement.classList.remove('gal-lock'); });

    return {
      sync,
      isOpen: () => d.open,
      open() {
        sync();
        document.documentElement.classList.add('gal-lock');
        if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
        viewer.focus({ preventScroll: true });
      },
    };
  }

  drawFilter();
  drawThumbs();
  drawMain();
  return root;
}

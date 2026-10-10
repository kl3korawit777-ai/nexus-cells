// ปุ่มควบคุมใย (ซูมเข้า/ออก ดูทั้งใย กลับตำแหน่งเริ่มต้น) และคีย์ลัด ใช้ร่วมกันทุกใยที่ซูมได้
// ใช้: const ctl = attachGraphControls(wrapEl, cy, { fit, reset, baseZoom }); ... ctl.destroy()
//   wrapEl  กรอบที่ครอบ canvas ของใย (ต้อง position: relative)
//   fit     ฟังก์ชัน "ดูทั้งใย" (ไม่ใส่ = จัดให้เห็นทุกจุดที่ไม่ถูกซ่อน)
//   reset   ฟังก์ชัน "กลับตำแหน่งเริ่มต้น" (ไม่ใส่ = กลับซูม/ตำแหน่งที่บันทึกตอนสร้าง)
//   baseZoom ฟังก์ชันคืนค่าซูมที่นับเป็น 100% (ไม่ใส่ = ซูมตอนบันทึกตำแหน่งเริ่มต้น)
// ctl.captureHome() บันทึกมุมมองปัจจุบันเป็นตำแหน่งเริ่มต้นใหม่ (เรียกหลังจัดวางใยเสร็จ)

import { h, reducedMotion } from './util.js';
import { t } from './i18n.js';
import { panifyNodes, ALLOW_PAN, ZOOM_STEP, PAN_KEY_STEP, ZOOM_ANIM_MS, TOUCH_PAN_ONLY_WHEN_ZOOMED, allowTouchScroll } from './graph-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  // เส้นตรงล้วน ๆ ใช้ currentColor เพื่อให้เข้ากับทั้งสองธีม
  in: 'M12 5v14M5 12h14',
  out: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  reset: 'M4 12a8 8 0 1 0 3-6.2M4 4v4.5h4.5',
};
function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', ICONS[name]);
  svg.append(p);
  return svg;
}

const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function attachGraphControls(wrap, cy, opts = {}) {
  let home = { zoom: cy.zoom(), pan: { ...cy.pan() } };
  const baseZoom = () => (opts.baseZoom ? opts.baseZoom() : home.zoom) || 1;
  const dur = () => (reducedMotion() ? 0 : ZOOM_ANIM_MS);
  const touch = window.matchMedia('(pointer: coarse)');

  const btn = (key, ic, onclick) => h('button', {
    type: 'button', class: 'gc-btn', onclick,
    'aria-label': t('gc.' + key), title: t('gc.' + key),
  }, icon(ic));
  panifyNodes(cy);
  const bIn = btn('zoomIn', 'in', () => zoomBy(ZOOM_STEP));
  const bOut = btn('zoomOut', 'out', () => zoomBy(1 / ZOOM_STEP));
  const bFit = btn('fit', 'fit', () => (opts.fit ? opts.fit() : fitAll()));
  const bReset = btn('reset', 'reset', () => (opts.reset ? opts.reset() : goHome()));
  const level = h('span', { class: 'gc-level', title: t('gc.level') });
  const bar = h('div', { class: 'gc-bar', role: 'group', 'aria-label': t('gc.group') }, bIn, level, bOut, bFit, bReset);
  wrap.append(bar);

  function animateTo(props) {
    cy.stop();
    const d = dur();
    if (d === 0) {
      if (props.zoom != null && typeof props.zoom === 'object') cy.zoom(props.zoom);
      else if (props.zoom != null) cy.zoom(props.zoom);
      if (props.pan) cy.pan(props.pan);
      if (props.fit) cy.fit(props.fit.eles, props.fit.padding);
      if (props.center) cy.center(props.center.eles);
      if (props.panBy) cy.panBy(props.panBy);
      return;
    }
    cy.animate(props, { duration: d, easing: 'ease-out' });
  }

  // ซูมรอบจุดที่เลือกอยู่ (ถ้าจุดนั้นยังอยู่ในจอ ตำแหน่งบนจอของมันไม่ขยับ ถ้าอยู่นอกจอให้เลื่อนมากลางจอ)
  // ไม่ได้เลือกจุดไหนให้ซูมรอบกลางกรอบใย
  function zoomBy(factor) {
    const z = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor));
    if (Math.abs(z - cy.zoom()) < 1e-9) return;
    const W = cy.width(), H = cy.height();
    const sel = cy.nodes('.sel, :selected').not('.hidden').first();
    let rp = { x: W / 2, y: H / 2 };
    let recenter = null;
    if (sel.nonempty()) {
      const p = sel.renderedPosition();
      if (p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) rp = p;
      else recenter = sel;
    }
    if (recenter) animateTo({ zoom: z, center: { eles: recenter } });
    else if (dur() === 0) cy.zoom({ level: z, renderedPosition: rp });
    else { cy.stop(); cy.animate({ zoom: { level: z, renderedPosition: rp } }, { duration: dur(), easing: 'ease-out' }); }
  }
  function fitAll() { animateTo({ fit: { eles: cy.elements().not('.hidden'), padding: 30 } }); }
  function goHome() { animateTo({ zoom: home.zoom, pan: home.pan }); }

  function refresh() {
    const z = cy.zoom();
    level.textContent = Math.round((z / baseZoom()) * 100) + '%';
    bIn.disabled = z >= cy.maxZoom() * 0.9995;
    bOut.disabled = z <= cy.minZoom() * 1.0005;
    // จอสัมผัส: เลื่อนใยด้วยนิ้วได้เฉพาะตอนซูมเข้า เพื่อไม่ให้แย่งการเลื่อนหน้าเว็บ
    const pan = ALLOW_PAN && !(TOUCH_PAN_ONLY_WHEN_ZOOMED && touch.matches && z <= baseZoom() * 1.02);
    cy.userPanningEnabled(pan);
    wrap.classList.toggle('gc-pan', pan); // CSS: touch-action none เฉพาะตอนเลื่อนใยได้ ไม่งั้นนิ้วต้องเลื่อนหน้าเว็บ
  }
  cy.on('zoom', refresh);
  refresh();
  const offScroll = allowTouchScroll(cy.container(), () => cy.userPanningEnabled());

  // ---- คีย์ลัดเมื่อโฟกัสอยู่ในกรอบใย
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-keyshortcuts', '+ - 0 ArrowUp ArrowDown ArrowLeft ArrowRight');
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    let handled = true;
    switch (e.key) {
      case '+': case '=': zoomBy(ZOOM_STEP); break;
      case '-': case '_': zoomBy(1 / ZOOM_STEP); break;
      case '0': if (opts.fit) opts.fit(); else fitAll(); break;
      case 'ArrowLeft': if (ALLOW_PAN) animateTo({ panBy: { x: PAN_KEY_STEP, y: 0 } }); break;
      case 'ArrowRight': if (ALLOW_PAN) animateTo({ panBy: { x: -PAN_KEY_STEP, y: 0 } }); break;
      case 'ArrowUp': if (ALLOW_PAN) animateTo({ panBy: { x: 0, y: PAN_KEY_STEP } }); break;
      case 'ArrowDown': if (ALLOW_PAN) animateTo({ panBy: { x: 0, y: -PAN_KEY_STEP } }); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  };
  wrap.addEventListener('keydown', onKey);
  // แตะ/คลิกในกรอบใยแล้วคีย์ลัดใช้ได้ทันที
  const onDown = (e) => { if (!e.target.closest('.gc-bar')) wrap.focus({ preventScroll: true }); };
  wrap.addEventListener('pointerdown', onDown);

  return {
    captureHome() { home = { zoom: cy.zoom(), pan: { ...cy.pan() } }; refresh(); },
    refresh,
    destroy() {
      cy.off('zoom', refresh);
      offScroll();
      wrap.removeEventListener('keydown', onKey);
      wrap.removeEventListener('pointerdown', onDown);
      bar.remove();
    },
  };
}

// ข้อความแนะนำใต้ใย แสดงครั้งแรกที่เปิด ปิดได้ และจำไว้ว่าปิดแล้ว
const TIP_KEY = 'nexus.graphTipDismissed';
function tipDismissed() { try { return localStorage.getItem(TIP_KEY) === '1'; } catch { return false; } }
export function graphTip() {
  if (tipDismissed()) return null;
  const box = h('p', { class: 'gc-tip', role: 'note' },
    h('span', { text: t('gc.tip') }),
    h('button', {
      type: 'button', class: 'gc-tip-close', 'aria-label': t('gc.tipClose'), title: t('gc.tipClose'),
      onclick: () => {
        try { localStorage.setItem(TIP_KEY, '1'); } catch { /* ไม่มีที่เก็บ ก็ปิดเฉพาะครั้งนี้ */ }
        document.querySelectorAll('.gc-tip').forEach((el) => el.remove());
      },
    }, '×'));
  return box;
}

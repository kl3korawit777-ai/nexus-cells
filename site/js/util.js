import { t, getLang } from './i18n.js';
import { nameOf } from './content.js';

// ตัวช่วยทั่วไป: สร้าง DOM อย่างปลอดภัย (ไม่ใช้ innerHTML กับข้อมูล) และอ่านค่าธีม

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

// CL:0000775 <-> CL_0000775 (ใช้ใน hash)
export const idToHash = (id) => id.replace(':', '_');
export const hashToId = (s) => s.replace('_', ':');

export const cellHref = (id) => '#/cell/' + idToHash(id);
export const systemHref = (id) => '#/system/' + encodeURIComponent(id);
export const tissueHref = (id) => '#/tissue/' + encodeURIComponent(id);

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// เรียก callback เมื่อธีมสว่าง/มืดของระบบเปลี่ยน
const schemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themeListeners = new Set();
schemeQuery.addEventListener('change', () => themeListeners.forEach((fn) => fn()));
export function onThemeChange(fn) {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
}

// ตัดคำนำหน้า/ต่อท้ายที่ซ้ำ ๆ (เช่น "ระบบ" / " system") ให้ป้ายสั้นลง คำที่ตัดกำหนดใน i18n (sys.prefix, sys.suffix)
export function shortSystemName(s) {
  let n = nameOf(s, getLang());
  const prefix = t('sys.prefix'), suffix = t('sys.suffix');
  if (prefix && n.startsWith(prefix)) n = n.slice(prefix.length);
  if (suffix && n.endsWith(suffix)) n = n.slice(0, -suffix.length);
  return n.trim();
}

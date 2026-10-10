// สลับภาษาไทย/อังกฤษ: ข้อความทั้งหมดอยู่ใน site/i18n/th.json และ en.json (ไม่มีข้อความในโค้ด)
//   t('key', {n: 3})   แทนค่า {n} ในข้อความ ถ้าไม่พบ key ในภาษาปัจจุบันจะใช้ภาษาไทย แล้วค่อยแสดง key

import { getItem, setItem } from './storage.js';

export const LANGS = ['th', 'en'];
const KEY = 'nexus.lang';
const dicts = { th: {}, en: {} };
let lang = 'th';
const listeners = new Set();

export const getLang = () => lang;

// ภาษาเริ่มต้น: ที่เลือกไว้ → ภาษาของเบราว์เซอร์ (th ถ้าขึ้นต้นด้วย th) → en
export function detectLang() {
  const saved = getItem(KEY);
  if (LANGS.includes(saved)) return saved;
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  return /^th\b/i.test(nav) ? 'th' : 'en';
}

export async function initI18n() {
  const load = async (l) => {
    const res = await fetch(new URL(`../i18n/${l}.json`, import.meta.url), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`i18n/${l}.json (HTTP ${res.status})`);
    return res.json();
  };
  const [th, en] = await Promise.all([load('th'), load('en')]);
  dicts.th = th;
  dicts.en = en;
  lang = detectLang();
  applyDocument();
}

export function t(key, params) {
  let s = dicts[lang][key];
  if (s == null) s = dicts.th[key];
  if (s == null) return key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  return s;
}

// แทนข้อความในส่วนที่เป็น HTML ตายตัว: data-i18n="key" และ data-i18n-attr="aria-label:key;title:key2"
export function applyDocument() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    });
  });
  document.querySelectorAll('[data-lang-btn]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.langBtn === lang));
  });
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  setItem(KEY, next);
  applyDocument();
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

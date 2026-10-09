// ใช้งานออฟไลน์ (PWA): ลงทะเบียน service worker และแจ้งเมื่อมีข้อมูลใหม่

import { h } from './util.js';
import { t } from './i18n.js';
import { store } from './data.js';

const canRegister = () =>
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export function registerPwa() {
  if (!canRegister()) return;
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[Nexus] service worker', e));
}

let banner = null;

function showBanner() {
  if (banner) return;
  const btn = h('button', { type: 'button', class: 'btn btn-primary', onclick: refresh }, t('pwa.update'));
  banner = h('div', { class: 'update-banner', role: 'status', 'aria-live': 'polite' }, h('span', { text: t('pwa.updateAvailable') }), btn);
  document.body.append(banner);
}

// สั่งให้ service worker ดึงข้อมูลใหม่ลงที่เก็บ แล้วโหลดหน้าใหม่
function refresh() {
  const reload = () => location.reload();
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!sw) { reload(); return; }
  const timer = setTimeout(reload, 8000);
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data === 'data-refreshed') { clearTimeout(timer); reload(); } });
  sw.postMessage('refresh-data');
}

// เทียบเวอร์ชันข้อมูลที่โหลดอยู่ (meta.data_version) กับ data/version.json บนเซิร์ฟเวอร์
export async function checkDataUpdate() {
  if (!canRegister()) return;
  try {
    const res = await fetch('data/version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const remote = await res.json();
    const loaded = store.meta && store.meta.data_version;
    if (remote.version && loaded && remote.version !== loaded) showBanner();
  } catch { /* ออฟไลน์: ไม่ต้องแจ้ง */ }
}

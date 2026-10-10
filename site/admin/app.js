// หน้าแอดมิน Nexus: เริ่มโปรแกรม เข้าสู่ระบบ และสลับหน้า (เส้นทางแบบ hash: #/ #/edit/CL_x #/new #/tissue/id #/review #/pending #/history)

import { loadText, at } from './text.js';
import { initI18n } from '../js/i18n.js';
import * as model from './model.js';
import { h, dialog, toast } from './ui.js';
import { S, connect, disconnect, subscribe, itemCount } from './state.js';
import { loginView } from './views-login.js';
import { restoreGithub, logout, authorName } from './session.js';
import { listPanel } from './views-list.js';
import { editView } from './views-edit.js';
import { tissueEditView } from './views-tissue.js';
import { reviewView } from './views-review.js';
import { pendingView, historyView } from './views-pending.js';

const root = document.getElementById('adm-root');
let current = null; // หน้าปัจจุบัน {el, destroy, isDirty}
let lastHash = '#/';
let guarding = false;
let unsub = null;

const wide = window.matchMedia('(min-width: 1100px)');

function parse(hash) {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const parts = raw.split('?')[0].split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  return parts;
}

function navigate(hash, force) {
  if (location.hash === hash && force) render();
  else location.hash = hash;
}

async function connectAndStart(adapter, who) {
  root.replaceChildren(h('p', { class: 'loading', text: at('app.loading') }));
  try {
    await connect(adapter, who);
  } catch (e) {
    console.error(e);
    root.replaceChildren(h('main', { class: 'adm-page adm-narrow' }, h('p', { class: 'adm-status fail', role: 'alert', text: at('app.loadFailed', { msg: e.message }) }),
      h('button', { type: 'button', class: 'adm-btn', onclick: () => { logout(); disconnect(); showLogin(); } }, at('app.back'))));
    return;
  }
  location.hash = location.hash && location.hash !== '#' ? location.hash : '#/';
  buildShell();
  render();
}

async function showLogin() {
  if (unsub) { unsub(); unsub = null; }
  current = null;
  root.replaceChildren(await loginView(connectAndStart));
}

// ---------------------------------------------------------------- โครงหน้า

let shell = null;
function buildShell() {
  const badge = h('span', { class: 'adm-badge', hidden: true, 'aria-label': at('nav.pendingCount') });
  const links = [
    ['#/', at('nav.list'), 'list'], ['#/review', at('nav.review'), 'review'], ['#/pending', at('nav.pending'), 'pending', badge], ['#/history', at('nav.history'), 'history'],
  ].map(([href, label, key, extra]) => h('a', { href, 'data-nav': key }, label, extra || null));
  const who = h('span', { class: 'adm-who', text: `${authorName({ login: S.who.login, name: S.who.name }) || S.who.login} · ${S.adapter.label}` });
  const out = h('button', { type: 'button', class: 'adm-btn adm-btn-small', id: 'adm-logout', onclick: () => { logout(); disconnect(); showLogin(); } }, at('nav.logout'));
  const top = h('header', { class: 'adm-top' }, h('h1', { text: at('app.title') }), h('nav', { class: 'adm-nav', 'aria-label': at('nav.main') }, links), who, out);
  const side = h('aside', { class: 'adm-side', 'aria-label': at('list.title') });
  const main = h('main', { class: 'adm-main', id: 'adm-main', tabindex: '-1' });
  const preview = h('aside', { class: 'adm-preview', 'aria-label': at('edit.previewTitle'), id: 'adm-preview' });
  const grid = h('div', { class: 'adm-grid' }, side, main, preview);
  shell = { top, side, main, preview, grid, links, badge };
  root.replaceChildren(top, grid);
  const updateBadge = () => { const n = itemCount(); badge.textContent = String(n); badge.hidden = n === 0; };
  if (unsub) unsub();
  unsub = subscribe(() => { updateBadge(); refreshSide(); });
  updateBadge();
}

let sideKey = '';
function refreshSide() {
  if (!shell || !shell.side.isConnected) return;
  const sel = sideKey;
  // อัปเดตรายการด้านซ้ายเฉพาะเมื่อมองเห็นอยู่ (กันเด้งโฟกัสตอนพิมพ์ในฟอร์ม)
  if (document.activeElement && shell.side.contains(document.activeElement)) return;
  drawSide(sel);
}
function drawSide(selectedId) {
  sideKey = selectedId || '';
  shell.side.replaceChildren(listPanel({ selectedId, onNavigate: null }));
}

// ---------------------------------------------------------------- สลับหน้า

async function render() {
  if (!S.adapter || !shell) return;
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
  const parts = parse(location.hash);
  const [route, arg] = parts;
  let view;
  let withSide = true, withPreview = false, listRoute = false, nav = 'list', selectedId = '';
  const previewHost = () => (wide.matches ? shell.preview : document.getElementById('adm-preview-mobile'));

  if (!route) { view = { el: h('div', { class: 'adm-page' }, h('p', { class: 'adm-muted', text: at('list.pick') })), destroy() {} }; listRoute = true; }
  else if (route === 'edit' && arg) { selectedId = arg.replace('_', ':'); view = editView({ id: selectedId, isNew: false, navigate, previewHost }); withPreview = true; }
  else if (route === 'new') { view = editView({ id: '', isNew: true, navigate, previewHost }); withPreview = true; }
  else if (route === 'tissue' && arg) { view = tissueEditView({ id: arg, navigate }); }
  else if (route === 'review') { view = reviewView({ navigate }); withSide = false; nav = 'review'; }
  else if (route === 'pending') { view = pendingView({ navigate }); withSide = false; nav = 'pending'; }
  else if (route === 'history') { view = await historyView(); withSide = false; nav = 'history'; }
  else { view = { el: h('div', { class: 'adm-page' }, h('p', { text: at('app.notFound') })), destroy() {} }; }

  current = view;
  shell.grid.className = 'adm-grid' + (listRoute ? ' route-list' : '') + (withPreview ? ' has-preview' : '') + (withSide ? '' : ' no-side');
  shell.links.forEach((a) => { if (a.dataset.nav === nav && (route !== 'edit' || nav === 'list')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  shell.main.replaceChildren(view.el);
  shell.preview.replaceChildren();
  if (withSide) drawSide(selectedId);
  window.scrollTo(0, 0);
  lastHash = location.hash || '#/';
}

// ถ้าฟอร์มมีการแก้ที่ยังไม่เก็บ ถามก่อนออกจากหน้า (ใช้กล่องของหน้าเอง)
window.addEventListener('hashchange', async () => {
  if (guarding) return;
  if (current && current.isDirty && current.isDirty()) {
    const target = location.hash;
    guarding = true;
    location.hash = lastHash;
    await new Promise((r) => setTimeout(r, 0));
    guarding = false;
    const leave = await dialog({
      title: at('guard.title'), body: h('p', { text: at('guard.body') }),
      buttons: [{ label: at('guard.stay'), value: false }, { label: at('guard.leave'), value: true, danger: true }],
    });
    if (!leave) return;
    guarding = true;
    if (current) current.isDirty = () => false;
    location.hash = target;
    await new Promise((r) => setTimeout(r, 0));
    guarding = false;
  }
  render();
});
window.addEventListener('beforeunload', (e) => { if (current && current.isDirty && current.isDirty()) { e.preventDefault(); e.returnValue = ''; } });
wide.addEventListener('change', () => { if (current && location.hash.startsWith('#/edit') || location.hash === '#/new') render(); });

// ---------------------------------------------------------------- เริ่มโปรแกรม

async function boot() {
  try {
    const dict = await loadText();
    model.configureModel({ aiRefPrefix: dict['const.aiRefPrefix'] });
    await initI18n();
  } catch (e) {
    root.replaceChildren(h('p', { class: 'adm-status fail', text: 'th.json / i18n: ' + e.message }));
    return;
  }
  if (!window.cytoscape) toast(at('app.noCytoscape'), 'error', 8000);
  const restored = await restoreGithub().catch(() => null);
  if (restored) { await connectAndStart(restored.adapter, restored.info); return; }
  await showLogin();
}

boot();

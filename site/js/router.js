// router แบบ hash: #/  #/system/<id>  #/cell/<CL_0000000>  #/tissue/<id>  #/overview/<system|tissue>  #/quiz?...

import { homeView, systemView, cellView, notFoundView } from './views.js';
import { overviewView } from './overview.js';
import { tissueView } from './tissue.js';
import { quizView } from './quiz.js';
import { compareView, confusablesView } from './compare.js';
import { aboutView } from './about.js';
import { hashToId } from './util.js';
import { t } from './i18n.js';

let current = null;

// แยก "#/quiz?system=a&tissue=b" เป็น path และพารามิเตอร์
export function parseHash(hash) {
  const raw = (hash || '').replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  const path = q < 0 ? raw : raw.slice(0, q);
  const params = Object.fromEntries(new URLSearchParams(q < 0 ? '' : raw.slice(q + 1)));
  const parts = path.split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { path, parts, params };
}

export function resolve(hash) {
  const { path, parts, params } = parseHash(hash);
  if (parts.length === 0) return homeView();
  if (parts[0] === 'system' && parts.length === 2) return systemView(parts[1]);
  if (parts[0] === 'tissue' && parts.length === 2) return tissueView(parts[1]);
  if (parts[0] === 'quiz' && parts.length === 1) return quizView(params);
  if (parts[0] === 'about' && parts.length === 1) return aboutView();
  if (parts[0] === 'compare' && parts.length === 1) return confusablesView();
  if (parts[0] === 'compare' && (parts.length === 2 || parts.length === 3)) return compareView(parts[1], parts[2] || null);
  if (parts[0] === 'overview' && parts.length <= 2) {
    const m = parts[1] || 'system';
    if (m === 'system' || m === 'tissue') return overviewView(m);
    return notFoundView(t('notfound.page'), t('notfound.badGrouping', { m }));
  }
  if (parts[0] === 'cell' && parts.length === 2) {
    if (!/^CL_\d{7}$/.test(parts[1])) return notFoundView(t('notfound.cell'), t('notfound.badCellId', { id: parts[1] }));
    return cellView(hashToId(parts[1]));
  }
  return notFoundView(t('notfound.page'), t('notfound.noPage', { path }));
}

export function render(app) {
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
  let view;
  try {
    view = resolve(location.hash);
  } catch (e) {
    console.error(e);
    view = notFoundView(t('notfound.error'), String(e.message || e));
  }
  current = view;
  app.replaceChildren(view.el);
  const name = t('app.name');
  document.title = view.title === name ? name : `${view.title} · ${name}`;
  if (view.after) view.after();
  window.scrollTo(0, 0);
  // ย้ายโฟกัสไปหัวเรื่อง เพื่อให้โปรแกรมอ่านหน้าจอรู้ว่าหน้าเปลี่ยน
  const h1 = app.querySelector('#page-title');
  if (h1) h1.focus({ preventScroll: true });
}

export function start(app) {
  window.addEventListener('hashchange', () => render(app));
  render(app);
}

// router แบบ hash: #/  #/system/<id>  #/cell/<CL_0000000>

import { homeView, systemView, cellView, notFoundView } from './views.js';
import { hashToId } from './util.js';

let current = null;

export function resolve(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  if (parts.length === 0) return homeView();
  if (parts[0] === 'system' && parts.length === 2) return systemView(parts[1]);
  if (parts[0] === 'cell' && parts.length === 2) {
    if (!/^CL_\d{7}$/.test(parts[1])) return notFoundView('ไม่พบเซลล์นี้', `รหัส "${parts[1]}" ไม่ถูกรูปแบบ (ต้องเป็น CL_ ตามด้วยเลข 7 หลัก)`);
    return cellView(hashToId(parts[1]));
  }
  return notFoundView('ไม่พบหน้านี้', `ไม่มีหน้า "${path}"`);
}

export function render(app) {
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
  let view;
  try {
    view = resolve(location.hash);
  } catch (e) {
    console.error(e);
    view = notFoundView('เกิดข้อผิดพลาด', String(e.message || e));
  }
  current = view;
  app.replaceChildren(view.el);
  document.title = view.title === 'Nexus · ใยเซลล์' ? view.title : `${view.title} · Nexus ใยเซลล์`;
  if (view.after) view.after();
  window.scrollTo(0, 0);
  // ย้ายโฟกัสไปหัวเรื่อง เพื่อให้โปรแกรมอ่านหน้าจอรู้ว่าหน้าเปลี่ยน
  const t = app.querySelector('#page-title');
  if (t) t.focus({ preventScroll: true });
}

export function start(app) {
  window.addEventListener('hashchange', () => render(app));
  render(app);
}

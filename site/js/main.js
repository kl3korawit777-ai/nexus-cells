import { loadData } from './data.js';
import { start, render } from './router.js';
import { h } from './util.js';
import { initI18n, setLang, onLangChange, t } from './i18n.js';

const app = document.getElementById('app');

async function boot() {
  try {
    await initI18n();
  } catch (e) {
    console.error(e);
    // ยังไม่มีไฟล์ภาษา จึงใช้ข้อความสองภาษาที่เขียนไว้ใน index.html (#boot-error)
    const box = document.getElementById('boot-error');
    if (box) { box.hidden = false; box.append(' ' + e.message); app.replaceChildren(box); }
    return;
  }
  document.querySelectorAll('[data-lang-btn]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langBtn)));
  if (!window.cytoscape) {
    app.replaceChildren(h('p', { class: 'loading' }, t('app.libFailed')));
    return;
  }
  try {
    await loadData();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('p', { class: 'loading' }, t('app.dataFailed', { msg: e.message })));
    return;
  }
  // เปลี่ยนภาษาแล้วสร้างหน้าปัจจุบันใหม่
  onLangChange(() => render(app));
  start(app);
}

boot();

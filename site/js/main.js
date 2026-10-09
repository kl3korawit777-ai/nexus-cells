import { loadData } from './data.js';
import { start } from './router.js';
import { h } from './util.js';

const app = document.getElementById('app');

async function boot() {
  if (!window.cytoscape) {
    app.replaceChildren(h('p', { class: 'loading' }, 'โหลดไลบรารีกราฟ (Cytoscape.js) ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่'));
    return;
  }
  try {
    await loadData();
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('p', { class: 'loading' }, 'โหลดข้อมูลไม่สำเร็จ: ' + e.message));
    return;
  }
  start(app);
}

boot();

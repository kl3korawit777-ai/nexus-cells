// หน้าแก้ข้อมูลรูปของเนื้อเยื่อ (images/tissues/<id>/) ใช้ส่วนจัดการรูปตัวเดียวกับเซลล์

import { h, toast } from './ui.js';
import { at } from './text.js';
import { S, setTissue, cancelItem } from './state.js';
import { imagesTab } from './views-images.js';

export function tissueEditView({ id, navigate }) {
  const t = S.working.dataset.tissues.find((x) => x.id === id);
  if (!t) return { el: h('p', { class: 'adm-page', text: at('edit.notFound', { id }) }), destroy() {} };
  const draft = structuredClone(t);
  const startJson = JSON.stringify(t);
  let saved = false;
  const saveBtn = h('button', { type: 'button', class: 'adm-btn adm-btn-primary', id: 'adm-save-tissue', disabled: true, onclick: async () => {
    saved = true;
    await setTissue(id, draft);
    toast(at('edit.savedToPending'));
    navigate('#/tissue/' + encodeURIComponent(id), true);
  } }, at('edit.save'));
  const api = {
    get draft() { return draft; },
    update(fn) { fn(draft); saveBtn.disabled = JSON.stringify(draft) === startJson; },
    reg() {},
    isNew: false,
  };
  const body = h('div', {});
  const draw = () => body.replaceChildren(imagesTab(api, { dir: 'tissues/' + id }));
  draw();
  const pending = !!S.overlay.tissues[id];
  return {
    el: h('div', { class: 'adm-edit' },
      h('div', { class: 'adm-row' }, h('h1', { style: 'margin:0;font-size:1.3rem;flex:1', text: `${t.th} · ${t.en}` }), h('span', { class: 'mono', text: 'images/tissues/' + id })),
      h('p', { class: 'adm-muted', text: at('tissue.hint') }),
      body,
      h('div', { class: 'adm-actions' }, saveBtn,
        h('button', { type: 'button', class: 'adm-btn', onclick: () => navigate('#/', true) }, at('common.cancel')),
        pending ? h('button', { type: 'button', class: 'adm-btn', onclick: async () => { await cancelItem('tissue:' + id); navigate('#/tissue/' + encodeURIComponent(id), true); } }, at('edit.dropPending')) : null)),
    isDirty: () => !saved && JSON.stringify(draft) !== startJson,
    destroy() {},
  };
}

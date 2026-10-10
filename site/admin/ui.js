// ส่วนประกอบหน้าจอที่ใช้ซ้ำในหน้าแอดมิน ทุกข้อความแสดงด้วย textContent (ไม่ใช้ innerHTML)

import { h } from '../js/util.js';
import { at } from './text.js';
import { searchCells } from '../js/data.js';

export { h };

let toastBox;
export function toast(text, kind = 'info', ms = 4000) {
  if (!toastBox) { toastBox = h('div', { class: 'adm-toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastBox); }
  const el = h('div', { class: 'adm-toast adm-toast-' + kind, text });
  toastBox.append(el);
  setTimeout(() => el.remove(), ms);
}

// กล่องข้อความของหน้าเอง (ไม่ใช้ confirm()/alert()) คืน Promise ของค่าที่ผู้ใช้เลือก
//   buttons: [{label, value, primary?, danger?}]  body: node
export function dialog({ title, body, buttons, onOpen }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'adm-dialog', 'aria-labelledby': 'adm-dlg-title' });
    const close = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const btns = (buttons || [{ label: at('common.ok'), value: true, primary: true }]).map((b) =>
      h('button', { type: 'button', class: 'adm-btn' + (b.primary ? ' adm-btn-primary' : '') + (b.danger ? ' adm-btn-danger' : ''), 'data-value': String(b.value), onclick: () => close(b.value) }, b.label));
    dlg.append(h('h2', { id: 'adm-dlg-title', text: title }), h('div', { class: 'adm-dlg-body' }, body), h('div', { class: 'adm-dlg-actions' }, btns));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    document.body.append(dlg);
    dlg.showModal();
    if (onOpen) onOpen(dlg, close);
  });
}

// ช่องฟอร์มพร้อมป้ายและข้อความผิดพลาด
export function field(label, control, { hint, id, wide } = {}) {
  const errBox = h('div', { class: 'adm-err', role: 'alert' });
  const wrap = h('div', { class: 'adm-field' + (wide ? ' wide' : ''), 'data-field': id || '' },
    h('label', {}, h('span', { class: 'adm-label', text: label }), control),
    hint ? h('div', { class: 'adm-hint', text: hint }) : null, errBox);
  wrap.setError = (msgs) => {
    errBox.replaceChildren(...msgs.map((m) => h('div', { class: m.level === 'warning' ? 'adm-warn' : '', text: m.text })));
    wrap.classList.toggle('has-error', msgs.some((m) => m.level !== 'warning'));
  };
  return wrap;
}

export function textInput(value, onInput, attrs = {}) {
  const el = h('input', { type: 'text', value: value || '', autocomplete: 'off', ...attrs });
  el.addEventListener('input', () => onInput(el.value));
  return el;
}
export function textArea(value, onInput, rows = 3) {
  const el = h('textarea', { rows: String(rows) });
  el.value = value || '';
  el.addEventListener('input', () => onInput(el.value));
  return el;
}
export function select(options, value, onChange, attrs = {}) {
  const el = h('select', attrs, options.map((o) => h('option', { value: o.value, text: o.label })));
  el.value = value == null ? '' : value;
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

// รายการข้อความแบบป้าย: เพิ่มด้วย Enter หรือเครื่องหมายจุลภาค ลบด้วยปุ่ม ×
export function tagInput(items, onChange, { placeholder = '' } = {}) {
  const list = [...(items || [])];
  const chips = h('div', { class: 'adm-chips' });
  const input = h('input', { type: 'text', placeholder, autocomplete: 'off', enterkeyhint: 'done' });
  const wrap = h('div', { class: 'adm-tags' }, chips, input);
  const draw = () => chips.replaceChildren(...list.map((tag, i) => h('span', { class: 'adm-chip' }, h('span', { text: tag }),
    h('button', { type: 'button', class: 'adm-chip-x', 'aria-label': at('common.remove') + ' ' + tag, onclick: () => { list.splice(i, 1); draw(); onChange([...list]); } }, '×'))));
  const commit = () => {
    const v = input.value.trim().replace(/,$/, '').trim();
    if (v && !list.includes(v)) { list.push(v); draw(); onChange([...list]); }
    input.value = '';
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !input.value && list.length) { list.pop(); draw(); onChange([...list]); }
  });
  input.addEventListener('blur', commit);
  draw();
  return wrap;
}

// ช่องค้นหาเซลล์ (ชื่อไทย อังกฤษ หรือ CL ID) เรียก onPick(cell) เมื่อเลือก (ใช้ store ของเว็บหลักที่เติมจากข้อมูลที่กำลังแก้)
export function cellPicker(onPick, { exclude = new Set(), placeholder = '' } = {}) {
  const input = h('input', { type: 'text', placeholder: placeholder || at('picker.placeholder'), autocomplete: 'off', role: 'combobox', 'aria-expanded': 'false' });
  const results = h('ul', { class: 'adm-results', role: 'listbox' });
  const box = h('div', { class: 'adm-picker' }, input, results);
  const hide = () => { results.replaceChildren(); input.setAttribute('aria-expanded', 'false'); };
  input.addEventListener('input', () => {
    const found = searchCells(input.value, 8).filter((c) => !exclude.has(c.id));
    results.replaceChildren(...found.map((c) => h('li', { role: 'option' }, h('button', { type: 'button', onclick: () => { onPick(c); input.value = ''; hide(); } },
      h('span', { class: 'th', text: c.th }), ' ', h('span', { class: 'en', text: c.en }), ' ', h('span', { class: 'mono', text: c.id })))));
    input.setAttribute('aria-expanded', String(found.length > 0));
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  input.addEventListener('blur', () => setTimeout(hide, 200));
  return box;
}

// ลากเรียงลำดับ (เมาส์/นิ้ว): ลากที่ .adm-handle ภายใน .adm-sortable-item ของ container
export function makeSortable(container, onMove) {
  container.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.adm-handle');
    if (!handle || !container.contains(handle)) return;
    const item = handle.closest('.adm-sortable-item');
    if (!item) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const items = () => [...container.querySelectorAll(':scope > .adm-sortable-item')];
    const from = items().indexOf(item);
    item.classList.add('dragging');
    const move = (ev) => {
      const list = items();
      let to = list.length - 1;
      for (let i = 0; i < list.length; i++) {
        const r = list[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { to = i; break; }
      }
      const cur = list.indexOf(item);
      if (to !== cur) container.insertBefore(item, to > cur ? list[to].nextSibling : list[to]);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      item.classList.remove('dragging');
      const to = items().indexOf(item);
      if (to !== from) onMove(from, to);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

export const moveItem = (arr, from, to) => { const a = [...arr]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };

export function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

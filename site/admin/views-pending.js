// หน้ารอบันทึก: ตรวจ diff ยกเลิกทีละรายการ แล้วกด "บันทึกและเผยแพร่" (commit เดียว) ติดตามสถานะ Actions และดูประวัติ

import { h, field, toast } from './ui.js';
import { at, issueText } from './text.js';
import { S, summary, cancelItem, keepMine, publish, reload, hasErrors, subscribe, pendingImageUrl } from './state.js';
import * as model from './model.js';
import { ConflictError } from './adapters.js';
import { idToHash } from '../js/util.js';
import { assetUrl } from '../js/images.js';

const fieldLabel = (k) => (at('f.' + k) !== 'f.' + k ? at('f.' + k) : k);
function show(v) {
  if (v === undefined) return '—';
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') : '[ ]';
  if (v && typeof v === 'object') return JSON.stringify(v);
  return v === '' ? at('pend.blank') : String(v);
}

// สถานะการเผยแพร่ล่าสุด (คงอยู่ระหว่างเปลี่ยนหน้า)
const publishState = { id: null, message: '', cells: [], status: null, timer: 0, listeners: new Set() };
function startPolling() {
  clearInterval(publishState.timer);
  const tick = async () => {
    if (!S.adapter || !publishState.id) return;
    try { publishState.status = await S.adapter.status(publishState.id); } catch { publishState.status = { state: 'unknown' }; }
    publishState.listeners.forEach((fn) => fn());
    const st = publishState.status.state;
    if (st === 'success' || st === 'failure') {
      clearInterval(publishState.timer);
      toast(at(st === 'success' ? 'pend.status.success' : 'pend.status.failure'), st === 'success' ? 'info' : 'error', 8000);
    }
  };
  publishState.timer = setInterval(tick, 10000);
  tick();
}

function diffTable(fields) {
  if (!fields.length) return null;
  return h('table', { class: 'adm-diff' },
    h('thead', {}, h('tr', {}, h('th', { text: at('pend.field') }), h('th', { text: at('pend.before') }), h('th', { text: at('pend.after') }))),
    h('tbody', {}, fields.map((f) => h('tr', {}, h('th', { text: fieldLabel(f.key) }),
      h('td', { class: f.before === undefined ? '' : 'old', text: show(f.before) }),
      h('td', { class: f.after === undefined ? '' : 'new', text: show(f.after) })))));
}

export function pendingView({ navigate }) {
  const root = h('div', { class: 'adm-page' });
  let message = '';
  let messageEdited = false;
  let busy = false;
  let conflictPaths = null;
  const words = { add: at('msg.add'), edit: at('msg.edit'), del: at('msg.del'), edges: at('msg.edges'), imgAdd: at('msg.imgAdd'), imgDel: at('msg.imgDel'), imgUnit: at('msg.imgUnit'), none: at('msg.none') };

  const nameOf = (cid) => { const c = S.working.dataset.cells.find((x) => x.id === cid) || S.base.dataset.cells.find((x) => x.id === cid); return c ? c.th : cid; };
  const edgeText = (e) => `${nameOf(e.a)} — ${at('edge.kind.' + e.kind)} → ${nameOf(e.b)}${e.mode ? ' [' + at('edge.mode.' + e.mode) + ']' : ''}${e.th ? ': ' + e.th : ''}`;

  function statusBox() {
    const st = publishState.status;
    if (!publishState.id) return null;
    const state = st ? st.state : 'pending';
    const cls = state === 'success' ? 'ok' : state === 'failure' ? 'fail' : '';
    const first = publishState.cells[0];
    const siteBase = new URL('../', location.href).href;
    return h('div', { class: 'adm-status ' + cls, id: 'adm-status', role: 'status', 'data-commit': publishState.id },
      h('strong', { text: at('pend.status.' + state) }), ' ', h('span', { class: 'adm-muted', text: publishState.message }),
      state === 'success' ? h('div', {}, first ? h('a', { href: `${siteBase}#/cell/${idToHash(first)}`, target: '_blank', rel: 'noopener noreferrer', text: at('pend.openCell') }) : h('a', { href: siteBase, target: '_blank', rel: 'noopener noreferrer', text: at('pend.openSite') })) : null,
      st && st.url ? h('div', {}, h('a', { href: st.url, target: '_blank', rel: 'noopener noreferrer', text: at('pend.openRun') })) : null,
      state === 'failure' && st.error ? h('pre', { text: st.error }) : null,
      state === 'failure' ? h('p', { class: 'adm-hint', text: at('pend.failHint') }) : null);
  }

  function draw() {
    const { items, imgs } = summary();
    const errs = S.issues.filter((i) => i.level === 'error');
    const auto = model.autoMessage(items, imgs, words);
    if (!messageEdited) message = auto;
    const blocked = errs.length > 0 || S.conflicts.size > 0 || !items.length || busy;

    const msgArea = h('textarea', { rows: '2', id: 'adm-commit-msg', 'aria-label': at('pend.message') });
    msgArea.value = message;
    msgArea.addEventListener('input', () => { message = msgArea.value; messageEdited = true; });
    const pub = h('button', { type: 'button', class: 'adm-btn adm-btn-primary', id: 'adm-publish', disabled: blocked, onclick: async () => {
      if (!message.trim()) { toast(at('pend.needMessage'), 'error'); return; }
      busy = true; draw();
      try {
        const names = items.filter((i) => i.type === 'cell' && i.op !== 'delete').map((i) => i.id);
        const res = await publish(message.trim().startsWith('admin:') ? message.trim() : 'admin: ' + message.trim());
        publishState.id = res.id; publishState.message = message.trim(); publishState.cells = names; publishState.status = { state: 'pending' };
        messageEdited = false;
        startPolling();
        toast(at('pend.committed'));
      } catch (e) {
        if (e instanceof ConflictError) conflictPaths = e.paths;
        else toast(at('pend.commitFailed', { msg: e.detail || e.message }), 'error', 9000);
      }
      busy = false; draw();
    } }, busy ? at('pend.publishing') : at('pend.publish'));

    const itemEls = items.map((it) => {
      const conflict = S.conflicts.has(it.key);
      const title = it.type === 'edge' ? edgeText(it.edge)
        : `${at('pend.op.' + it.op)} · ${it.name}`;
      const body = it.type === 'edge' ? null : [
        it.op === 'delete' ? h('div', {}, h('p', { text: at('pend.delNote', { edges: it.cascade.edges.length, refs: it.cascade.confused.length }) }),
          it.cascade.edges.length ? h('ul', {}, it.cascade.edges.map((e) => h('li', { text: edgeText({ kind: e.kind, a: e.a, b: e.b, mode: e.mode, th: e.th }) }))) : null) : diffTable(it.fields),
      ];
      return h('li', { class: 'adm-card', 'data-key': it.key },
        h('div', { class: 'adm-row' },
          h('strong', { style: 'flex:1;min-width:0;overflow-wrap:anywhere', text: title }),
          it.type === 'edge' ? h('span', { class: 'adm-tag', text: at('pend.op.' + (it.op === 'add' ? 'edgeAdd' : 'edgeRemove')) }) : null,
          it.type === 'cell' && it.op !== 'delete' ? h('a', { class: 'adm-btn adm-btn-small', href: '#/edit/' + idToHash(it.id) }, at('pend.open')) : null,
          h('button', { type: 'button', class: 'adm-btn adm-btn-small', 'data-cancel': it.key, onclick: async () => { await cancelItem(it.key); } }, at('pend.cancel'))),
        conflict ? h('div', { class: 'adm-status fail' }, h('p', { text: at('pend.conflictItem') }),
          h('div', { class: 'adm-row' },
            h('button', { type: 'button', class: 'adm-btn adm-btn-small', onclick: async () => { await keepMine(it.key); } }, at('pend.keepMine')),
            h('button', { type: 'button', class: 'adm-btn adm-btn-small', onclick: async () => { await cancelItem(it.key); } }, at('pend.useRepo')))) : null,
        body);
    });

    const imgBox = (imgs.added.length || imgs.removed.length) ? h('div', { class: 'adm-card' }, h('h2', { style: 'margin-top:0', text: at('pend.images') }),
      imgs.added.length ? h('div', {}, h('h3', { text: at('pend.imgAdded', { n: imgs.added.length }) }), h('div', { class: 'adm-row' }, imgs.added.map((p) => h('figure', { style: 'margin:0;max-width:140px' },
        h('img', { src: pendingImageUrl(p) || assetUrl(p.replace(/^site\//, '')), alt: '', style: 'width:140px;height:100px;object-fit:cover;border-radius:8px' }), h('figcaption', { class: 'mono', style: 'overflow-wrap:anywhere', text: p.replace(/^site\/images\//, '') }))))) : null,
      imgs.removed.length ? h('div', {}, h('h3', { text: at('pend.imgRemoved', { n: imgs.removed.length }) }), h('ul', {}, imgs.removed.map((p) => h('li', { class: 'mono', text: p })))) : null) : null;

    const errBox = errs.length ? h('div', { class: 'adm-status fail', role: 'alert' }, h('strong', { text: at('pend.errors', { n: errs.length }) }),
      h('ul', {}, errs.slice(0, 30).map((i) => h('li', {}, i.id ? h('a', { href: '#/edit/' + idToHash(i.id) }, nameOf(i.id)) : (i.tissue || i.edgeFile || ''), ': ', issueText(i))))) : null;

    const conflictBox = conflictPaths ? h('div', { class: 'adm-status fail', role: 'alert', id: 'adm-conflict' },
      h('strong', { text: at('pend.conflictTitle') }), h('p', { text: at('pend.conflictBody') }),
      h('ul', {}, conflictPaths.map((p) => h('li', { class: 'mono', text: p }))),
      h('button', { type: 'button', class: 'adm-btn adm-btn-primary', id: 'adm-reload', onclick: async () => { await reload(); conflictPaths = null; toast(at('pend.reloaded')); } }, at('pend.reload'))) : null;

    root.replaceChildren(
      h('h1', { style: 'font-size:1.3rem', text: at('pend.title') }),
      S.persistOk ? null : h('p', { class: 'adm-warn', text: at('pend.noIdb') }),
      statusBox(), conflictBox, errBox,
      items.length ? h('ul', { style: 'list-style:none;padding:0;margin:0' }, itemEls) : h('p', { class: 'adm-card adm-muted', text: at('pend.empty') }),
      imgBox,
      items.length ? h('div', { class: 'adm-card' }, field(at('pend.message'), msgArea, { id: 'message', hint: at('pend.messageHint'), wide: true }), pub) : null);
  }
  draw();
  const unsub = subscribe(() => { if (!busy) draw(); });
  publishState.listeners.add(draw);
  return { el: root, destroy() { unsub(); publishState.listeners.delete(draw); } };
}

export async function historyView() {
  const root = h('div', { class: 'adm-page' }, h('h1', { style: 'font-size:1.3rem', text: at('hist.title') }), h('p', { class: 'adm-muted', text: at('hist.loading') }));
  (async () => {
    try {
      const list = await S.adapter.history(20);
      root.replaceChildren(h('h1', { style: 'font-size:1.3rem', text: at('hist.title') }),
        list.length ? h('ul', { class: 'adm-edge-list' }, list.map((c) => h('li', {},
          h('div', { class: 'grow' }, h('div', { text: c.message }), h('div', { class: 'adm-hint', text: `${new Date(c.date).toLocaleString('th-TH')} · ${c.author || ''}` })),
          c.url ? h('a', { class: 'adm-btn adm-btn-small', href: c.url, target: '_blank', rel: 'noopener noreferrer', text: at('hist.open') }) : null)))
          : h('p', { class: 'adm-muted', text: at('hist.empty') }));
    } catch (e) {
      root.replaceChildren(h('h1', { style: 'font-size:1.3rem', text: at('hist.title') }), h('p', { class: 'adm-err', text: at('hist.failed', { msg: e.message }) }));
    }
  })();
  return { el: root, destroy() {} };
}

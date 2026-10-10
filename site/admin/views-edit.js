// ฟอร์มแก้ไข/เพิ่มเซลล์: แท็บ ข้อมูล / ภาษาอังกฤษ / ความเชื่อมโยง / รูป พร้อมตัวอย่างการ์ดด้วย component เดียวกับเว็บจริง

import { h, field, textInput, textArea, select, tagInput, cellPicker, dialog, toast, makeSortable, moveItem } from './ui.js';
import { at, issueText } from './text.js';
import { S, setCell, currentCell, cancelItem, fillPreviewStore } from './state.js';
import * as model from './model.js';
import { validateDataset } from './validate.js';
import { searchCl, termCl } from './ols.js';
import { edgesTab } from './views-edges.js';
import { imagesTab } from './views-images.js';
import { store } from '../js/data.js';
import { renderCellPage } from '../js/card.js';
import { idToHash } from '../js/util.js';

const clone = (x) => structuredClone(x);

export function blankCell() {
  return {
    id: '', slug: '', kind: 'cell', en: '', th: '', systems: [], tissue: '', tissue_subtype: null,
    location: '', morphology: '', function: '', secretes: [], markers: [], lifespan: '', exam: '', diseases: [],
    confused_with: [], images: [], review: 'draft', refs: [],
  };
}

export function editView({ id, isNew, navigate, previewHost }) {
  const orig = isNew ? null : currentCell(id);
  if (!isNew && !orig) return { el: h('p', { class: 'adm-page', text: at('edit.notFound', { id }) }), destroy() {} };

  let draft = isNew ? blankCell() : clone(model.normalizeCell(orig));
  const startJson = isNew ? '' : model.cellJson(orig);
  let slugTouched = !isNew;
  let tab = 'info';
  let saved = false;
  const fields = new Map(); // key ช่อง → ตัวห่อช่อง
  const reg = (key, wrap) => { fields.set(key, wrap); return wrap; };
  let previewTimer = 0, validateTimer = 0;
  let previewInstance = null;
  let issuesNow = [];

  const dirty = () => (isNew ? true : model.cellJson(draft) !== startJson);
  const isDirty = () => !saved && (isNew ? !!(draft.id || draft.en || draft.th) : dirty());
  const api = { get draft() { return draft; }, update, reg, isNew, rebuildImages: null };

  // -------------------------------------------------------------- ตรวจ/ตัวอย่าง

  function candidate() {
    const o = { ...S.overlay, cells: { ...S.overlay.cells, [draft.id || '__new__']: { cell: draft, base: null } } };
    return model.applyOverlay(S.base, o).dataset;
  }
  function runValidate() {
    const ds = candidate();
    const fileExists = (p) => p in S.base.shas || S.blobs.has(p);
    const all = validateDataset(ds, { fileExists });
    issuesNow = all.filter((i) => i.id === draft.id);
    for (const [k, wrap] of fields) {
      const msgs = issuesNow.filter((i) => i.field === k || (i.field || '').startsWith(k + '.') || (i.field || '').startsWith(k + '['))
        .map((i) => ({ level: i.level, text: issueText(i) }));
      wrap.setError(msgs);
    }
    const errs = issuesNow.filter((i) => i.level === 'error');
    const unlisted = errs.filter((i) => ![...fields.keys()].some((k) => i.field === k || (i.field || '').startsWith(k + '.') || (i.field || '').startsWith(k + '[')));
    summary.replaceChildren(...unlisted.map((i) => h('div', { class: 'adm-err', text: issueText(i) })));
    saveBtn.disabled = errs.length > 0 || !dirty() || !draft.id;
    statusLine.textContent = errs.length ? at('edit.errors', { n: errs.length }) : dirty() ? at('edit.unsaved') : at('edit.noChange');
    return ds;
  }
  function schedule() {
    clearTimeout(validateTimer);
    validateTimer = setTimeout(runValidate, 120);
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 350);
  }
  function renderPreview() {
    const host = previewHost();
    if (!host) return;
    if (previewInstance) { previewInstance.destroy(); previewInstance = null; }
    if (!draft.id) { host.replaceChildren(h('p', { class: 'adm-muted', text: at('edit.previewNeedsId') })); return; }
    const ds = candidate();
    fillPreviewStore(ds);
    const cell = store.cellsById.get(draft.id);
    if (!cell) return;
    previewInstance = renderCellPage(cell);
    host.replaceChildren(h('p', { class: 'adm-preview-note', text: at('edit.previewNote') }), h('h2', { text: cell.th + ' · ' + cell.en }), previewInstance.el);
    host.querySelectorAll('a').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(/^#\/cell\/(CL_\d{7})$/);
      if (m) a.setAttribute('href', '#/edit/' + m[1]);
      else if ((a.getAttribute('href') || '').startsWith('#/')) a.removeAttribute('href');
    });
  }

  function update(fn) {
    fn(draft);
    schedule();
  }

  // -------------------------------------------------------------- แท็บข้อมูล

  const f = (key, label, control, opts = {}) => reg(key, field(label, control, { id: key, ...opts }));
  const sysOptions = S.working.dataset.systems.map((s) => ({ value: s.id, label: s.th }));
  const tissueOptions = [{ value: '', label: at('edit.none') }, ...S.working.dataset.tissues.map((t) => ({ value: t.id, label: t.th }))];

  const idInput = textInput(draft.id, (v) => { draft.id = v.trim().toUpperCase().replace(/^CL_/, 'CL:'); schedule(); }, { placeholder: 'CL:0000000', autocapitalize: 'characters', spellcheck: 'false' });
  if (!isNew) { idInput.readOnly = true; }
  const slugInput = textInput(draft.slug, (v) => { slugTouched = true; draft.slug = v.trim(); schedule(); }, { autocapitalize: 'off', spellcheck: 'false' });
  if (!isNew) slugInput.readOnly = true;
  const enInput = textInput(draft.en, (v) => {
    draft.en = v;
    if (isNew && !slugTouched) {
      const taken = new Set(S.working.dataset.cells.map((c) => c.slug));
      draft.slug = model.slugify(v, taken);
      slugInput.value = draft.slug;
    }
    schedule();
  });
  const thInput = textInput(draft.th, (v) => { draft.th = v; schedule(); });
  const kindSel = select([{ value: 'cell', label: at('edit.kind.cell') }, { value: 'class', label: at('edit.kind.class') }], draft.kind, (v) => update((d) => { d.kind = v; }));

  // ระบบ: เรียงลำดับได้ ตัวแรกคือระบบหลัก
  const sysList = h('div', { class: 'adm-sortable' });
  const sysAdd = select([{ value: '', label: at('edit.addSystem') }, ...sysOptions], '', (v) => {
    if (v && !draft.systems.includes(v)) { update((d) => { d.systems = [...d.systems, v]; }); drawSystems(); }
    sysAdd.value = '';
  });
  function drawSystems() {
    sysList.replaceChildren(...draft.systems.map((sid, i) => {
      const s = S.working.dataset.systems.find((x) => x.id === sid);
      return h('div', { class: 'adm-sortable-item adm-row', style: 'border:1px solid var(--line);border-radius:10px;padding:4px 8px;margin:4px 0;background:var(--surface)' },
        h('span', { class: 'adm-handle', title: at('common.drag'), 'aria-hidden': 'true' }, '⠿'),
        h('span', { class: 'grow', style: 'flex:1', text: (s ? s.th : sid) + (i === 0 ? ' · ' + at('edit.primarySystem') : '') }),
        h('button', { type: 'button', class: 'adm-btn adm-btn-small adm-btn-icon', 'aria-label': at('common.up'), disabled: i === 0, onclick: () => { update((d) => { d.systems = moveItem(d.systems, i, i - 1); }); drawSystems(); } }, '▲'),
        h('button', { type: 'button', class: 'adm-btn adm-btn-small adm-btn-icon', 'aria-label': at('common.down'), disabled: i === draft.systems.length - 1, onclick: () => { update((d) => { d.systems = moveItem(d.systems, i, i + 1); }); drawSystems(); } }, '▼'),
        h('button', { type: 'button', class: 'adm-btn adm-btn-small adm-btn-icon', 'aria-label': at('common.remove'), onclick: () => { update((d) => { d.systems = d.systems.filter((x) => x !== sid); }); drawSystems(); } }, '×'));
    }));
  }
  makeSortable(sysList, (from, to) => { update((d) => { d.systems = moveItem(d.systems, from, to); }); drawSystems(); });
  drawSystems();

  const tissueSel = select(tissueOptions, draft.tissue, (v) => { update((d) => { d.tissue = v; d.tissue_subtype = null; }); drawSubtypes(); });
  const subSel = select([], '', (v) => update((d) => { d.tissue_subtype = v || null; }));
  function drawSubtypes() {
    const t = S.working.dataset.tissues.find((x) => x.id === draft.tissue);
    subSel.replaceChildren(...[{ value: '', label: at('edit.none') }, ...((t && t.subtypes) || []).map((s) => ({ value: s.id, label: s.th }))].map((o) => h('option', { value: o.value, text: o.label })));
    subSel.value = draft.tissue_subtype || '';
  }
  drawSubtypes();

  const text = (key, rows = 2) => f(key, at('f.' + key), textArea(draft[key], (v) => update((d) => { d[key] = v; }), rows), { wide: true });
  const tags = (key) => f(key, at('f.' + key), tagInput(draft[key], (v) => update((d) => { d[key] = v; }), { placeholder: at('edit.tagHint') }), { wide: true, hint: at('edit.tagHintLong') });

  // confused_with
  const confBox = h('div', { class: 'adm-chips' });
  function drawConf() {
    confBox.replaceChildren(...(draft.confused_with || []).map((cid) => {
      const c = S.working.dataset.cells.find((x) => x.id === cid);
      return h('span', { class: 'adm-chip' }, h('span', { text: c ? `${c.th} (${c.en})` : cid }),
        h('button', { type: 'button', class: 'adm-chip-x', 'aria-label': at('common.remove'), onclick: () => { update((d) => { d.confused_with = (d.confused_with || []).filter((x) => x !== cid); }); drawConf(); } }, '×'));
    }));
  }
  drawConf();
  const confField = f('confused_with', at('f.confused_with'), h('div', {}, confBox,
    cellPicker((c) => { if (c.id !== draft.id && !(draft.confused_with || []).includes(c.id)) { update((d) => { d.confused_with = [...(d.confused_with || []), c.id]; }); drawConf(); } }, { exclude: new Set([draft.id]) })), { wide: true });

  const reviewSel = select(['draft', 'ai_reviewed', 'textbook'].map((r) => ({ value: r, label: at('review.' + r) })), draft.review, (v) => update((d) => { d.review = v; }));

  // กล่อง CL (อ่านอย่างเดียว) + ค้นจาก OLS เมื่อเพิ่มเซลล์ใหม่
  const clBox = h('div', { class: 'adm-readonly' });
  function drawCl(info) {
    const t = info || S.working.dataset.clTerms[draft.id];
    if (!t || t.found === false) { clBox.replaceChildren(h('em', { text: at('edit.clNone') })); return; }
    clBox.replaceChildren(h('dl', { style: 'margin:0' },
      h('dt', { text: at('edit.clLabel') }), h('dd', { text: t.label || '' }),
      h('dt', { text: at('edit.clDef') }), h('dd', { text: t.definition || '' }),
      (t.synonyms || []).length ? [h('dt', { text: at('edit.clSyn') }), h('dd', { text: t.synonyms.join(', ') })] : null,
      draft.id ? [h('dt', { text: 'CL' }), h('dd', {}, h('a', { href: `https://www.ebi.ac.uk/ols4/ontologies/cl/classes?obo_id=${encodeURIComponent(draft.id)}`, target: '_blank', rel: 'noopener noreferrer', text: draft.id }))] : null));
  }
  const clSection = h('div', { class: 'adm-card' }, h('h3', { text: at('edit.clTitle') }), h('p', { class: 'adm-hint', text: at('edit.clReadonly') }), clBox);
  drawCl();

  const lookup = h('div', { class: 'adm-card' });
  if (isNew) {
    const q = h('input', { type: 'text', placeholder: at('edit.lookupPlaceholder'), autocomplete: 'off', 'aria-label': at('edit.lookupPlaceholder') });
    const out = h('div', { role: 'status', 'aria-live': 'polite' });
    const doSearch = async () => {
      const term = q.value.trim();
      if (!term) return;
      out.replaceChildren(h('span', { class: 'adm-muted', text: at('edit.lookupBusy') }));
      try {
        const rows = /^CL[:_]\d{7}$/i.test(term) ? [await termCl(term.toUpperCase().replace('_', ':'))].filter(Boolean) : await searchCl(term);
        if (!rows.length) { out.replaceChildren(h('span', { text: at('edit.lookupNone') })); return; }
        out.replaceChildren(h('ul', { class: 'adm-edge-list' }, rows.map((r) => h('li', {},
          h('div', { class: 'grow' }, h('strong', { text: r.label }), ' ', h('span', { class: 'mono', text: r.id }), h('div', { class: 'adm-hint', text: r.definition })),
          h('button', { type: 'button', class: 'adm-btn adm-btn-small', onclick: () => {
            draft.id = r.id; idInput.value = r.id;
            draft.en = r.label; enInput.value = r.label;
            if (!slugTouched) { draft.slug = model.slugify(r.label, new Set(S.working.dataset.cells.map((c) => c.slug))); slugInput.value = draft.slug; }
            drawCl({ label: r.label, definition: r.definition, synonyms: [] });
            out.replaceChildren(h('span', { class: 'adm-muted', text: at('edit.lookupPicked', { id: r.id }) }));
            schedule();
          } }, at('edit.lookupUse'))))));
      } catch {
        out.replaceChildren(h('span', { class: 'adm-warn', text: at('edit.lookupFailed') }));
      }
    };
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
    lookup.append(h('h3', { text: at('edit.lookupTitle') }), h('p', { class: 'adm-hint', text: at('edit.lookupHint') }),
      h('div', { class: 'adm-row' }, h('div', { style: 'flex:1;min-width:200px' }, q), h('button', { type: 'button', class: 'adm-btn', onclick: doSearch }, at('edit.lookupGo'))), out);
  }

  const infoPanel = h('div', { 'data-panel': 'info' },
    isNew ? lookup : null,
    h('div', { class: 'adm-fields' },
      f('id', at('f.id'), idInput, { hint: isNew ? at('edit.idHint') : at('edit.idLocked') }),
      f('kind', at('f.kind'), kindSel),
      f('en', at('f.en'), enInput), f('th', at('f.th'), thInput),
      f('slug', at('f.slug'), slugInput, { hint: isNew ? at('edit.slugHint') : at('edit.slugLocked') }),
      f('review', at('f.review'), reviewSel, { hint: at('edit.reviewHint') }),
      f('systems', at('f.systems'), h('div', {}, sysList, sysAdd), { wide: true, hint: at('edit.systemsHint') }),
      f('tissue', at('f.tissue'), tissueSel), f('tissue_subtype', at('f.tissue_subtype'), subSel),
      text('location'), text('morphology'), text('function', 3), text('lifespan', 1), text('exam', 3),
      tags('secretes'), tags('markers'), tags('diseases'), confField, tags('refs')),
    clSection);

  // -------------------------------------------------------------- แท็บอังกฤษ

  const enPanel = h('div', { 'data-panel': 'en', hidden: true },
    h('p', { class: 'adm-hint', text: at('edit.enHint') }),
    h('div', { class: 'adm-fields' }, ['location', 'morphology', 'function', 'exam'].map((k) => {
      const wrap = f('en_content.' + k, at('f.' + k) + ' (EN)', textArea((draft.en_content || {})[k] || '', (v) => update((d) => {
        const en = { ...(d.en_content || {}) };
        if (v.trim()) en[k] = v; else delete en[k];
        if (Object.keys(en).length) d.en_content = en; else delete d.en_content;
      }), 3), { wide: true });
      wrap.append(h('div', { class: 'adm-hint', text: at('edit.enThai') + ' ' + (draft[k] || '—') }));
      return wrap;
    })));

  // -------------------------------------------------------------- แท็บอื่น

  const edgesPanel = h('div', { 'data-panel': 'edges', hidden: true });
  const imagesPanel = h('div', { 'data-panel': 'images', hidden: true });
  const drawImages = () => imagesPanel.replaceChildren(imagesTab(api, { dir: draft.slug || '', ownerLabel: draft.th || draft.en }));
  api.rebuildImages = drawImages;
  const drawEdges = () => edgesPanel.replaceChildren(isNew ? h('p', { class: 'adm-muted', text: at('edge.saveFirst') }) : edgesTab(draft.id, () => schedule()));

  const panels = { info: infoPanel, en: enPanel, edges: edgesPanel, images: imagesPanel };
  const tabBtns = ['info', 'en', 'edges', 'images'].map((k) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === tab), 'data-tab': k, onclick: () => show(k) }, at('tab.' + k)));
  function show(k) {
    tab = k;
    tabBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
    for (const [name, p] of Object.entries(panels)) p.hidden = name !== k;
    if (k === 'edges') drawEdges();
    if (k === 'images') drawImages();
  }

  // -------------------------------------------------------------- ปุ่มล่าง

  const summary = h('div', { role: 'alert' });
  const statusLine = h('span', { class: 'adm-muted', 'aria-live': 'polite' });
  const saveBtn = h('button', { type: 'button', class: 'adm-btn adm-btn-primary', id: 'adm-save-cell', onclick: async () => {
    if (!draft.id) return;
    saved = true;
    await setCell(draft.id, draft);
    toast(at('edit.savedToPending'));
    if (isNew) navigate('#/edit/' + idToHash(draft.id)); else { draft = clone(model.normalizeCell(currentCell(draft.id))); navigate('#/edit/' + idToHash(draft.id), true); }
  } }, at('edit.save'));
  const delBtn = h('button', { type: 'button', class: 'adm-btn adm-btn-danger', id: 'adm-delete-cell', hidden: isNew, onclick: () => deleteDialog() }, at('edit.delete'));
  const revertBtn = h('button', { type: 'button', class: 'adm-btn', onclick: () => navigate(isNew ? '#/' : '#/edit/' + idToHash(id), true) }, at(isNew ? 'common.cancel' : 'edit.revert'));
  const inPending = !isNew && S.overlay.cells[id];
  const cancelPending = h('button', { type: 'button', class: 'adm-btn', hidden: !inPending, onclick: async () => { await cancelItem('cell:' + id); navigate('#/edit/' + idToHash(id), true); } }, at('edit.dropPending'));

  async function deleteDialog() {
    const ds = S.working.dataset;
    const edges = model.listEdges(ds).filter((e) => e.a === id || e.b === id);
    const refs = ds.cells.filter((c) => (c.confused_with || []).includes(id));
    const name = (cid) => { const c = ds.cells.find((x) => x.id === cid); return c ? c.th : cid; };
    const input = h('input', { type: 'text', placeholder: id, autocomplete: 'off', 'aria-label': at('del.typeId', { id }) });
    const ok = h('button', { type: 'button', class: 'adm-btn adm-btn-danger', 'data-value': 'true', disabled: true }, at('del.confirm'));
    input.addEventListener('input', () => { ok.disabled = input.value.trim().toUpperCase() !== id; });
    const body = h('div', {},
      h('p', { text: at('del.intro', { name: orig.th }) }),
      edges.length ? [h('h3', { text: at('del.edges', { n: edges.length }) }), h('ul', {}, edges.map((e) => h('li', { text: `${name(e.a)} — ${at('edge.kind.' + e.kind)} → ${name(e.b)}` })))] : h('p', { class: 'adm-muted', text: at('del.noEdges') }),
      refs.length ? [h('h3', { text: at('del.refs', { n: refs.length }) }), h('ul', {}, refs.map((c) => h('li', { text: c.th })))] : null,
      (orig.images || []).length ? h('p', { text: at('del.images', { n: orig.images.length }) }) : null,
      h('p', { text: at('del.typeId', { id }) }), input);
    const choice = await dialog({ title: at('del.title'), body, buttons: [{ label: at('common.cancel'), value: false }], onOpen: (dlg, close) => {
      dlg.querySelector('.adm-dlg-actions').prepend(ok);
      ok.addEventListener('click', () => close(true));
    } });
    if (choice === true) {
      saved = true;
      await setCell(id, null);
      toast(at('del.done'));
      navigate('#/');
    }
  }

  const header = h('div', { class: 'adm-row' },
    h('h1', { style: 'margin:0;font-size:1.3rem;flex:1', text: isNew ? at('edit.newTitle') : `${orig.th} · ${orig.en}` }),
    isNew ? null : h('span', { class: 'mono', text: id }));

  const el = h('div', { class: 'adm-edit' }, header,
    h('div', { class: 'adm-tabs', role: 'tablist' }, tabBtns),
    infoPanel, enPanel, edgesPanel, imagesPanel, summary,
    h('div', { class: 'adm-actions' }, saveBtn, revertBtn, cancelPending, delBtn, h('span', { class: 'grow' }), statusLine),
    h('details', { class: 'adm-previewbox', ontoggle: (e) => { if (e.target.open) renderPreview(); } }, h('summary', { text: at('edit.previewTitle') }), h('div', { class: 'adm-previewbox-host', id: 'adm-preview-mobile' })));

  queueMicrotask(() => { runValidate(); renderPreview(); });

  return {
    el, isDirty, issues: () => issuesNow,
    destroy() {
      clearTimeout(validateTimer); clearTimeout(previewTimer);
      if (previewInstance) previewInstance.destroy();
      fillPreviewStore(S.working.dataset);
    },
  };
}

// แท็บ "รูป": อัปโหลดหลายไฟล์ (ลากวาง/กล้อง/คลังภาพ) หรือเพิ่มจากลิงก์ แก้ข้อมูลรูป ลากเรียงลำดับ และลบ
// รูปทุกไฟล์ถูกย่อ แปลงเป็น WebP และลบ EXIF ในเบราว์เซอร์ก่อนเก็บ (ดู images-proc.js)

import { h, field, textInput, select, makeSortable, moveItem, fmtBytes, toast } from './ui.js';
import { at } from './text.js';
import { S, addBlob, dropBlob, pendingImageUrl } from './state.js';
import * as model from './model.js';
import { processImage } from './images-proc.js';
import { authorName } from './session.js';
import { assetUrl } from '../js/images.js';

const HTTPS = /^https:\/\//i;

// ฟอร์มข้อมูลรูปหนึ่งรูป (ใช้ทั้งตอนเพิ่มและตอนแก้) value = ข้อมูลรูปเดิม (ถ้ามี)
function imageForm(value, { external = false, onCancel, onSubmit, submitLabel, preview }) {
  const v = { type: 'micrograph', alt_th: '', caption_th: '', caption_en: '', stain: '', magnification: '', license: 'Own work', credit: authorName(S.who), source: '', src: '', ...value };
  const own = () => v.license === 'Own work';
  const inputs = {};
  const bind = (key, ctl) => { inputs[key] = ctl; return ctl; };
  const txt = (key, opts) => bind(key, textInput(v[key] || '', (x) => { v[key] = x; recheck(); }, opts));
  const typeSel = bind('type', select(model.IMAGE_TYPES.map((t) => ({ value: t, label: at('img.type.' + t) })), v.type, (x) => { v.type = x; }));
  const licSel = bind('license', select(model.LICENSES.map((l) => ({ value: l, label: at('img.license.' + l) })), v.license, (x) => {
    v.license = x;
    if (own() && !v.credit) { v.credit = authorName(S.who); inputs.credit.value = v.credit; }
    recheck();
  }));
  const srcIn = external ? txt('src', { placeholder: 'https://…', autocapitalize: 'off', spellcheck: 'false' }) : null;

  const wraps = {
    src: external ? field(at('img.f.src'), srcIn, { id: 'src' }) : null,
    type: field(at('img.f.type'), typeSel, { id: 'type' }),
    alt_th: field(at('img.f.alt_th'), txt('alt_th'), { id: 'alt_th', hint: at('img.altHint'), wide: true }),
    caption_th: field(at('img.f.caption_th'), txt('caption_th'), { id: 'caption_th', wide: true }),
    caption_en: field(at('img.f.caption_en'), txt('caption_en'), { id: 'caption_en', wide: true }),
    stain: field(at('img.f.stain'), txt('stain'), { id: 'stain' }),
    magnification: field(at('img.f.magnification'), txt('magnification', { placeholder: '400x' }), { id: 'magnification' }),
    license: field(at('img.f.license'), licSel, { id: 'license', hint: at('img.licenseWarn') }),
    credit: field(at('img.f.credit'), txt('credit'), { id: 'credit' }),
    source: field(at('img.f.source'), txt('source', { placeholder: 'https://…', autocapitalize: 'off', spellcheck: 'false' }), { id: 'source', hint: at('img.sourceHint'), wide: true }),
  };

  const submit = h('button', { type: 'button', class: 'adm-btn adm-btn-primary', onclick: () => onSubmit({ ...v }) }, submitLabel);
  function problems() {
    const out = {};
    if (external && !HTTPS.test(v.src || '')) out.src = at('v.imgSrcHttps', { n: '' });
    if (!v.alt_th.trim()) out.alt_th = at('v.imgRequired', { n: '', field: at('img.f.alt_th') });
    if (!v.credit.trim()) out.credit = at('v.imgRequired', { n: '', field: at('img.f.credit') });
    if (!own() || external) {
      if (!v.source.trim()) out.source = at('v.imgSourceNeeded', { n: '' });
    }
    if (v.source.trim() && !HTTPS.test(v.source.trim())) out.source = at('v.imgSourceHttps', { n: '' });
    return out;
  }
  function recheck() {
    const p = problems();
    for (const [k, w] of Object.entries(wraps)) if (w) w.setError(p[k] ? [{ level: 'error', text: p[k] }] : []);
    submit.disabled = Object.keys(p).length > 0;
  }
  recheck();

  const el = h('div', { class: 'adm-img-form' }, preview || null,
    h('div', { class: 'adm-fields' }, Object.values(wraps).filter(Boolean)),
    h('div', { class: 'adm-row' }, submit, h('button', { type: 'button', class: 'adm-btn', onclick: onCancel }, at('common.cancel'))));
  return el;
}

export function imagesTab(api, { dir }) {
  const root = h('div', { class: 'adm-images' });
  const staged = h('div', {});
  const list = h('div', { class: 'adm-sortable' });
  const dirNote = h('p', { class: 'adm-hint' });
  const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, id: 'adm-file', 'aria-label': at('img.choose') });
  let editing = -1;

  const taken = () => new Set([...Object.keys(S.base.shas), ...S.blobs.keys(), ...api.draft.images.map((i) => model.repoImagePath(i.src))]);
  const needsDir = () => !dir;

  function drawList() {
    const imgs = api.draft.images;
    if (!imgs.length) { list.replaceChildren(h('p', { class: 'adm-muted', text: at('img.none') })); return; }
    list.replaceChildren(...imgs.map((img, i) => {
      const item = h('div', { class: 'adm-sortable-item adm-img-item', 'data-index': String(i) },
        h('span', { class: 'adm-handle', title: at('common.drag'), 'aria-hidden': 'true' }, '⠿'),
        h('img', { src: assetUrl(img.src), alt: '', loading: 'lazy' }),
        h('div', { style: 'min-width:0' },
          h('div', { text: (i === 0 ? at('img.primary') + ' · ' : '') + at('img.type.' + img.type) }),
          h('div', { class: 'adm-hint', text: img.alt_th }),
          h('div', { class: 'mono', style: 'overflow-wrap:anywhere', text: img.src }),
          h('div', { class: 'adm-hint', text: [img.license, img.credit].filter(Boolean).join(' · ') })),
        h('div', { class: 'adm-img-actions' },
          h('button', { type: 'button', class: 'adm-btn adm-btn-small', onclick: () => { editing = editing === i ? -1 : i; drawList(); } }, at('img.edit')),
          h('button', { type: 'button', class: 'adm-btn adm-btn-small adm-btn-icon', 'aria-label': at('common.up'), disabled: i === 0, onclick: () => move(i, i - 1) }, '▲'),
          h('button', { type: 'button', class: 'adm-btn adm-btn-small adm-btn-icon', 'aria-label': at('common.down'), disabled: i === imgs.length - 1, onclick: () => move(i, i + 1) }, '▼'),
          h('button', { type: 'button', class: 'adm-btn adm-btn-small adm-btn-danger', onclick: () => remove(i) }, at('img.remove'))));
      if (editing !== i) return item;
      const wrap = h('div', {}, item, imageForm(img, {
        external: false,
        submitLabel: at('img.applyEdit'),
        onCancel: () => { editing = -1; drawList(); },
        onSubmit: (val) => { api.update((d) => { d.images = d.images.map((x, k) => (k === i ? cleanImage({ ...x, ...val, src: x.src }) : x)); }); editing = -1; drawList(); },
      }));
      return wrap;
    }));
  }

  function move(from, to) { api.update((d) => { d.images = moveItem(d.images, from, to); }); drawList(); }
  async function remove(i) {
    const img = api.draft.images[i];
    api.update((d) => { d.images = d.images.filter((_, k) => k !== i); });
    const path = model.repoImagePath(img.src);
    if (S.blobs.has(path) && !(path in S.base.shas)) await dropBlob(path);
    editing = -1;
    drawList();
  }
  makeSortable(list, (from, to) => { api.update((d) => { d.images = moveItem(d.images, from, to); }); drawList(); });

  const cleanImage = (v) => {
    const o = {};
    for (const k of ['src', 'type', 'alt_th', 'caption_th', 'caption_en', 'stain', 'magnification', 'credit', 'license', 'source']) {
      const x = typeof v[k] === 'string' ? v[k].trim() : v[k];
      if (x !== undefined && x !== '') o[k] = x;
    }
    if (v.quiz !== undefined) o.quiz = v.quiz;
    return o;
  };

  // ไฟล์ที่เลือก → ประมวลผล → การ์ดฟอร์มรอเพิ่ม
  async function handleFiles(files) {
    if (needsDir()) { toast(at('img.needSlug'), 'error'); return; }
    for (const file of files) {
      const card = h('div', { class: 'adm-img-form' }, h('p', { class: 'adm-muted', text: at('img.processing', { name: file.name }) }));
      staged.append(card);
      let res;
      try { res = await processImage(file); } catch (e) {
        card.replaceChildren(h('p', { class: 'adm-err', text: at('img.err.' + (e.message || 'decode'), { name: file.name }) }), h('button', { type: 'button', class: 'adm-btn', onclick: () => card.remove() }, at('common.close')));
        continue;
      }
      const url = URL.createObjectURL(res.blob);
      const prev = h('div', {}, h('img', { class: 'big', src: url, alt: '' }),
        h('p', { class: 'adm-hint', text: at('img.sizes', { before: fmtBytes(res.before), after: fmtBytes(res.after), w: res.width, h: res.height, name: file.name }) }),
        h('p', { class: 'adm-hint', text: at('img.exifGone') }));
      const form = imageForm({}, {
        preview: prev, submitLabel: at('img.add'),
        onCancel: () => { URL.revokeObjectURL(url); card.remove(); },
        onSubmit: async (val) => {
          const type = val.type;
          const src = model.nextImagePath(dir, type, taken(), res.ext);
          await addBlob(model.repoImagePath(src), res.blob);
          api.update((d) => { d.images = [...d.images, cleanImage({ ...val, src })]; });
          URL.revokeObjectURL(url);
          card.remove();
          drawList();
        },
      });
      card.replaceWith(form);
    }
  }

  function addLink() {
    const form = imageForm({ license: 'CC BY-SA 4.0', credit: '' }, {
      external: true, submitLabel: at('img.add'),
      onCancel: () => form.remove(),
      onSubmit: (val) => { api.update((d) => { d.images = [...d.images, cleanImage(val)]; }); form.remove(); drawList(); },
    });
    staged.append(form);
  }

  const drop = h('div', { class: 'adm-drop', id: 'adm-drop' },
    h('p', { text: at('img.dropHint') }),
    h('div', { class: 'adm-row', style: 'justify-content:center' },
      h('button', { type: 'button', class: 'adm-btn adm-btn-primary', onclick: () => fileIn.click() }, at('img.choose')),
      h('button', { type: 'button', class: 'adm-btn', onclick: addLink }, at('img.addLink'))),
    h('p', { class: 'adm-hint', text: at('img.processHint') }));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); handleFiles([...e.dataTransfer.files]); });
  fileIn.addEventListener('change', () => { handleFiles([...fileIn.files]); fileIn.value = ''; });

  dirNote.textContent = needsDir() ? at('img.needSlug') : at('img.dirNote', { dir: `site/images/${dir}/` });
  root.append(drop, fileIn, dirNote, staged, h('h3', { text: at('img.listTitle') }), list);
  drawList();
  void pendingImageUrl;
  return root;
}

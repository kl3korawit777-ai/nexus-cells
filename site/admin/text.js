// ข้อความภาษาไทยของหน้าแอดมินทั้งหมดอยู่ใน th.json (ไม่เขียนข้อความไทยในโค้ด)
//   at('key', {n: 3}) แทนค่า {n}; ไม่พบคีย์จะคืนตัวคีย์เอง

let dict = {};

export async function loadText() {
  const res = await fetch(new URL('./th.json', import.meta.url), { cache: 'no-cache' });
  if (!res.ok) throw new Error('th.json ' + res.status);
  dict = await res.json();
  return dict;
}

export function at(key, params) {
  let s = dict[key];
  if (s == null) return key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  return s;
}
export const hasText = (key) => key in dict;
export const getDict = () => dict;

// ข้อความของผลตรวจ {code, params} (ชื่อช่องแปลจาก f.<ช่อง> ถ้ามี)
export function issueText(i) {
  const p = { ...(i.params || {}) };
  if (p.field) p.field = hasText('f.' + p.field) ? at('f.' + p.field) : p.field;
  return at('v.' + i.code, p);
}

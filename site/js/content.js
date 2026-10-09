// เลือกเนื้อหาตามภาษา (ไม่แตะ DOM ใช้ร่วมกับ quiz-engine และสคริปต์ทดสอบใน Node)
//   th: ใช้ชื่อและเนื้อหาไทยเป็นหลัก
//   en: ใช้ชื่ออังกฤษ และ en_content ถ้ามี ถ้าไม่มีให้ใช้เนื้อหาไทยพร้อมระบุว่า "Thai only"

// ข้อความที่เป็นอักษรละติน/กรีก/สัญลักษณ์ทั่วไป (ไม่มีอักษรไทย) ถือว่าอ่านได้ในโหมดอังกฤษ
const NON_THAI = /[฀-๿]/;
export const hasThai = (s) => NON_THAI.test(String(s || ''));

export const nameOf = (x, lang) => (lang === 'en' ? x.en : x.th);
// ชื่อรอง: โหมดไทยแสดงชื่ออังกฤษประกอบ โหมดอังกฤษไม่แสดง
export const altNameOf = (x, lang) => (lang === 'en' ? '' : x.en);

export const EN_FIELDS = ['location', 'morphology', 'function', 'exam'];

const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// ข้อความฟิลด์เดียวของเซลล์: {text, thaiOnly}
export function textOf(cell, field, lang) {
  const th = cell[field];
  if (lang !== 'en') return { text: isEmpty(th) ? '' : th, thaiOnly: false };
  const en = cell.en_content && cell.en_content[field];
  if (!isEmpty(en)) return { text: en, thaiOnly: false };
  return { text: isEmpty(th) ? '' : th, thaiOnly: !isEmpty(th) && hasThai(th) };
}

// รายการ (secretes, markers, diseases): {items, thaiOnly}
export function listOf(cell, field, lang) {
  const items = Array.isArray(cell[field]) ? cell[field] : [];
  return { items, thaiOnly: lang === 'en' && items.some(hasThai) };
}

// ข้อความของระบบ/เนื้อเยื่อ: systems.summary (en_summary) และ tissues.{features,location,function,exam} (en_content)
export function sysSummary(sys, lang) {
  if (lang === 'en') {
    if (!isEmpty(sys.en_summary)) return { text: sys.en_summary, thaiOnly: false };
    return { text: sys.summary || '', thaiOnly: !isEmpty(sys.summary) };
  }
  return { text: sys.summary || '', thaiOnly: false };
}
export function tissueText(tissue, field, lang) {
  const th = tissue[field];
  if (lang !== 'en') return { text: isEmpty(th) ? '' : th, thaiOnly: false };
  const en = tissue.en_content && tissue.en_content[field];
  if (!isEmpty(en)) return { text: en, thaiOnly: false };
  return { text: isEmpty(th) ? '' : th, thaiOnly: !isEmpty(th) && hasThai(th) };
}

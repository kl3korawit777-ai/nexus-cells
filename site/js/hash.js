// แฮชข้อความแบบกำหนดได้ (cyrb53) ใช้ร่วมกันระหว่าง Node (scripts/layout.mjs) และเบราว์เซอร์
// ไม่ใช้ crypto.subtle เพื่อให้ทำงานได้ทุกบริบทและเป็นฟังก์ชันซิงโครนัส

export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export const hashHex = (str) => cyrb53(str).toString(16).padStart(14, '0');

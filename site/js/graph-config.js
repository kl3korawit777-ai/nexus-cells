// ตั้งค่ากลางของใยทุกตัว: ทุกที่ที่เรียก cytoscape() ต้องใช้ฟังก์ชันในไฟล์นี้
// อยากเปลี่ยนพฤติกรรมของใยทั้งเว็บ แก้ค่าคงที่ข้างล่างที่เดียว

export const ALLOW_NODE_DRAG = false;   // true = ผู้ใช้ลากจุดย้ายที่ได้ (การเคลื่อนโดยโปรแกรมใช้ได้เสมอ)
export const ALLOW_WHEEL_ZOOM = false;  // true = ซูมด้วยลูกกลิ้งเมาส์และบีบนิ้วได้ (ปิดไว้เพื่อให้ลูกกลิ้งเลื่อนหน้าเว็บ)
export const ALLOW_PAN = true;          // true = ลากพื้นหลังเพื่อเลื่อนใยได้ (ใยแบบโต้ตอบเท่านั้น)

// บนจอสัมผัส การลากพื้นหลังจะแย่งการเลื่อนหน้าเว็บ จึงเปิดการเลื่อนใยเฉพาะตอนซูมเข้าอยู่
// (ตอนเห็นทั้งใยไม่จำเป็นต้องเลื่อน นิ้วจึงเลื่อนหน้าผ่านใยได้) ตั้งเป็น false เพื่อเปิดการเลื่อนใยตลอดเวลา
export const TOUCH_PAN_ONLY_WHEN_ZOOMED = true;

export const ZOOM_STEP = 1.25;          // ซูมต่อการกดปุ่มหนึ่งครั้ง
export const PAN_KEY_STEP = 80;         // พิกเซลที่เลื่อนต่อการกดลูกศรหนึ่งครั้ง
export const ZOOM_ANIM_MS = 180;        // ความยาว animation ของปุ่มซูม (0 ทันทีถ้าผู้ใช้ตั้งลดการเคลื่อนไหว)

const COMMON = {
  boxSelectionEnabled: false,
  autoungrabify: !ALLOW_NODE_DRAG,
  userZoomingEnabled: ALLOW_WHEEL_ZOOM,
};

// ใยที่ผู้ใช้เลื่อนดู/ซูมด้วยปุ่มได้ (ใยรายระบบ ใยภาพรวม ใยในหน้าเนื้อเยื่อ)
export function interactiveGraphOptions(extra = {}) {
  return { ...COMMON, userPanningEnabled: ALLOW_PAN, ...extra };
}

// ใยเล็กที่นิ่งทั้งหมด: ไม่ลาก ไม่ซูม ไม่เลื่อน แตะจุดได้อย่างเดียว
export function staticGraphOptions(extra = {}) {
  return { ...COMMON, autoungrabify: true, userZoomingEnabled: false, userPanningEnabled: false, ...extra };
}

// Cytoscape เรียก preventDefault ตอนนิ้วเริ่มลากบนจุด/เส้นเสมอ ทำให้หน้าเว็บเลื่อนไม่ได้เมื่อวางนิ้วบนใย
// ฟังก์ชันนี้ทำให้ preventDefault ของ touch event ไม่มีผล ตราบที่ใยไม่ได้อยู่ในโหมดเลื่อน (ใยนิ่ง หรือยังไม่ได้ซูมเข้าบนจอสัมผัส)
// การแตะจุดยังทำงานตามปกติ เพราะ Cytoscape ตรวจการแตะเองจากตำแหน่งนิ้ว
// isPanning: ฟังก์ชันคืน true เมื่อใยกำลังให้นิ้วเลื่อนใย (ไม่ใส่ = ไม่เลื่อนใยเลย)
export function allowTouchScroll(container, isPanning = () => false) {
  const neutralize = (e) => { if (!isPanning()) e.preventDefault = () => {}; };
  const types = ['touchstart', 'touchmove', 'touchend'];
  types.forEach((ty) => container.addEventListener(ty, neutralize, { capture: true, passive: true }));
  return () => types.forEach((ty) => container.removeEventListener(ty, neutralize, { capture: true }));
}

// เมื่อลากจุดไม่ได้ Cytoscape จะไม่เลื่อนใยให้ถ้านิ้ว/เมาส์เริ่มลากบนจุด (จุดไม่ใช่ pannable) ทำให้ลากบนกรอบกลุ่มแล้วไม่เกิดอะไร
// เรียกกับใยที่เลื่อนได้ เพื่อให้ลากเริ่มบนจุดไหนก็เลื่อนใยได้ (รวมจุดที่เพิ่มทีหลัง)
export function panifyNodes(cy) {
  if (!ALLOW_PAN) return;
  cy.nodes().panify();
  cy.on('add', 'node', (e) => e.target.panify());
}

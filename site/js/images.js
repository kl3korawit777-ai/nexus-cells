// ตัวช่วยเรื่องรูปที่ไม่ผูกกับ DOM (ใช้ได้ทั้งในเบราว์เซอร์และในการทดสอบด้วย Node)
// รูปของเซลล์/เนื้อเยื่ออยู่ในช่อง images (รายการ) รูปแรกคือรูปหลัก

// แปลง src ของรูปเป็น URL ที่ใช้แสดงจริง (ค่าตั้งต้น: ใช้ตามเดิม) หน้าแอดมินใช้แทนรูปที่ยังไม่ได้บันทึกด้วย blob:
let assetResolver = (src) => src;
export const setAssetResolver = (fn) => { assetResolver = fn || ((src) => src); };
export const assetUrl = (src) => assetResolver(src);

export const IMAGE_TYPES = ['micrograph', 'em', 'photo', 'illustration', 'diagram'];

// รูปที่ใช้ได้จริง (มี src)
export const imagesOf = (obj) => ((obj && obj.images) || []).filter((i) => i && i.src);

export const firstImage = (obj) => imagesOf(obj)[0] || null;

// ประเภทรูปที่มีอยู่ในรายการ เรียงตามลำดับมาตรฐาน
export function typesIn(images) {
  const have = new Set(images.map((i) => i.type));
  return IMAGE_TYPES.filter((ty) => have.has(ty));
}

// รูปแรกของประเภทที่ระบุ (type = null หมายถึงรูปหลัก)
export function pickByType(obj, type) {
  const imgs = imagesOf(obj);
  if (!type) return imgs[0] || null;
  return imgs.find((i) => i.type === type) || null;
}

// รูปที่ใช้ในโหมดทดสอบได้: quiz:false ตัดออก; diagram/illustration มักมีชื่อเซลล์เขียนอยู่ในภาพ
// จึงไม่ใช้ เว้นแต่ตั้ง quiz:true เองในข้อมูล
export function quizImagesOf(obj) {
  return imagesOf(obj).filter((i) => {
    if (i.quiz === false) return false;
    if (i.quiz === true) return true;
    return i.type !== 'diagram' && i.type !== 'illustration';
  });
}

// ประมวลผลรูปในเบราว์เซอร์ก่อนอัปโหลด:
//   - ย่อให้กว้างไม่เกิน MAX_WIDTH
//   - วาดลง canvas แล้ว encode ใหม่เป็น WebP (ถ้าเบราว์เซอร์ encode WebP ไม่ได้ ใช้ JPEG) ข้อมูล EXIF ทั้งหมดรวมถึงพิกัด GPS จึงหายไป
//   - หมุนรูปตามทิศทางที่ EXIF บอกไว้ก่อน (ไม่งั้นรูปจากมือถือจะตะแคงหลังลบ EXIF)

export const MAX_WIDTH = 1600;
export const QUALITY = 0.85;
export const ACCEPTED = /^image\/(jpeg|png|webp|gif|avif|bmp|heic|heif)$/i;

const toBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

export async function processImage(file) {
  if (!ACCEPTED.test(file.type) && !/\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name)) throw new Error('type');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error('decode'); }
  const scale = Math.min(1, MAX_WIDTH / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const hgt = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = hgt;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, hgt);
  let blob = await toBlob(canvas, 'image/webp', QUALITY);
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    // Safari รุ่นเก่า encode WebP ไม่ได้ (จะได้ PNG กลับมา) ใช้ JPEG แทน พื้นหลังโปร่งใสเติมขาว
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, hgt);
    blob = await toBlob(canvas, 'image/jpeg', QUALITY);
    ext = 'jpg';
  }
  bmp.close && bmp.close();
  if (!blob) throw new Error('encode');
  return { blob, width: w, height: hgt, ext, before: file.size, after: blob.size };
}

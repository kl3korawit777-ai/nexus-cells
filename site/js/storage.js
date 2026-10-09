// localStorage ที่ปลอดภัย: ครอบ try/catch ทุกครั้ง (โหมดส่วนตัว/บล็อกข้อมูลเว็บอาจ throw) และคืนค่าเริ่มต้นแทน

export function getItem(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function setItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getJSON(key, fallback) {
  const raw = getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setJSON(key, value) {
  return setItem(key, JSON.stringify(value));
}

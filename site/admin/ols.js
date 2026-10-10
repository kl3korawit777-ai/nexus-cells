// ค้น Cell Ontology ผ่าน OLS4 จากเบราว์เซอร์ (ไม่ส่ง token ไปที่นี่) ถ้าเรียกไม่ได้ (เช่นติด CORS/ออฟไลน์) ให้ผู้ใช้กรอกเอง

const OLS = 'https://www.ebi.ac.uk/ols4/api';

async function getJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

const pick = (d) => ({
  id: d.obo_id || (d.short_form || '').replace('_', ':'),
  label: d.label || '',
  definition: Array.isArray(d.description) ? d.description[0] || '' : d.description || '',
});

// ค้นด้วยชื่อ (หรือรหัส) คืนรายการ {id, label, definition} เฉพาะรหัส CL
export async function searchCl(q) {
  const url = `${OLS}/search?q=${encodeURIComponent(q)}&ontology=cl&type=class&rows=8&fieldList=obo_id,short_form,label,description`;
  const data = await getJson(url);
  return ((data.response && data.response.docs) || []).map(pick).filter((x) => /^CL:\d{7}$/.test(x.id));
}

// ดูรหัสเดียว คืน {id, label, definition} หรือ null ถ้าไม่พบ
export async function termCl(id) {
  const iri = `http://purl.obolibrary.org/obo/${id.replace(':', '_')}`;
  const data = await getJson(`${OLS}/ontologies/cl/terms?iri=${encodeURIComponent(iri)}`);
  const t = data._embedded && data._embedded.terms && data._embedded.terms[0];
  if (!t) return null;
  return { id, label: t.label || '', definition: Array.isArray(t.description) ? t.description[0] || '' : t.description || '' };
}

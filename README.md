# Nexus · ใยเซลล์

เว็บรวบรวมชนิดเซลล์ในร่างกายมนุษย์ ที่เชื่อมข้อมูลเป็นใยเครือข่ายตาม Cell Ontology (CL)
ผู้ใช้หลักคือนักเรียนที่เตรียมสอบ กสพท และผู้สนใจชีววิทยาเซลล์ เนื้อหาสองภาษา (ไทย/อังกฤษ)
เว็บเป็น static site บน GitHub Pages ใช้ Cytoscape.js

**สถานะ:** ขั้นที่ 1–4 เสร็จแล้ว (ข้อมูล 4 ระบบ ใยรายระบบ ใยภาพรวมทั้งร่างกาย และหน้าเนื้อเยื่อ) ยังไม่มีโหมดทดสอบ การเปรียบเทียบสองเซลล์ และการสลับภาษา

## โครงสร้างโฟลเดอร์

```
data/systems.json         ระบบอวัยวะ 11 ระบบ
data/tissues.json         เนื้อเยื่อหลัก 4 ประเภท + หมวด other
data/cells/<system>.json  ข้อมูลเซลล์ หนึ่งไฟล์ต่อระบบ (เขียนเอง)
data/edges/<system>.json  เส้นใยที่คัดเอง หนึ่งไฟล์ต่อระบบ
data/generated/           ไฟล์ที่สคริปต์สร้าง (cl_terms.json; cache/ อยู่ใน .gitignore)
reports/                  รายงานจากสคริปต์
scripts/nexus.py          เครื่องมือหลัก (validate / fetch / build)
scripts/layout.mjs        คำนวณตำแหน่งใยภาพรวมล่วงหน้า (Node.js)
package.json              แพ็กเกจของ Node (ระบุเวอร์ชันแน่นอน) ใช้กับ layout.mjs เท่านั้น
site/                     หน้าเว็บ (โฟลเดอร์นี้คือสิ่งที่ deploy)
  index.html
  css/style.css
  js/                     main, router, views, overview, tissue, card, graph, ui, data, util ... (ES modules)
  data/nexus.json         ข้อมูลรวมสำหรับหน้าเว็บ (สร้างจาก build ห้ามแก้เอง)
  data/layout-overview.json  ตำแหน่งของใยภาพรวม (สร้างจาก build ต้อง commit ไปด้วย)
  images/                 รูปเซลล์ ตั้งชื่อตาม slug
```

ต้องใช้ Python 3 เท่านั้น ไม่ต้องติดตั้งไลบรารีเพิ่ม

## วิธีใช้สคริปต์

```bash
python scripts/nexus.py validate          # ตรวจข้อมูล
python scripts/nexus.py fetch             # ดึงข้อมูลจาก OLS4 (Cell Ontology)
python scripts/nexus.py build             # รวมเป็น site/data/nexus.json
```

| คำสั่ง | ทำอะไร |
|---|---|
| `validate` | ตรวจรูปแบบ CL ID, id/slug ซ้ำ, kind, ชื่อ en/th, ระบบและเนื้อเยื่อที่อ้างถึงมีอยู่จริง, confused_with และปลายเส้นทุกเส้น, เส้นที่ชี้หาตัวเอง, รูปที่ขาด src/credit/license แบ่งเป็น **ข้อผิดพลาด** (exit code 1) กับ **คำเตือน** (ช่องว่าง ยังไม่มีรูป หนึ่งบรรทัดต่อเซลล์) |
| `fetch` | ดึง label, definition, synonyms, สถานะ obsolete, is_a ancestors และ develops_from ของทุก CL ID เก็บ cache รายเซลล์ แล้วรวมเป็น `data/generated/cl_terms.json` และเขียน `reports/fetch-report.md` |
| `build` | รัน validate ก่อน (ถ้ามีข้อผิดพลาดจะไม่สร้างไฟล์) แล้วรวมข้อมูลทั้งหมดเป็น `site/data/nexus.json` และเขียน `reports/build-report.md` เทียบเส้นใยที่คัดเองกับ CL จากนั้นเรียก `scripts/layout.mjs` ต่อท้ายอัตโนมัติถ้าเครื่องมี Node.js (ไม่มีก็แจ้งเตือนแล้วทำต่อ) |

ตัวเลือกของ `fetch`:

- `--refresh` ดึงใหม่แม้มี cache
- `--only CL:0000235,CL:0000576` ดึงเฉพาะรหัสที่ระบุ
- `--sleep 0.2` หน่วงเวลาระหว่างคำขอ (วินาที)

## ข้อมูลเซลล์ (`data/cells/<system>.json`)

ไฟล์เป็นรายการ (array) ของเซลล์และหมวด ใช้ CL ID เป็นตัวหลัก
**ไม่ต้องเก็บคำนิยามและ synonyms ภาษาอังกฤษ** สคริปต์ดึงจาก CL ให้เอง

ช่องที่ช่องว่างได้ ให้เว้นว่าง (`""` หรือ `[]`) ห้ามเดา การ์ดบนเว็บจะซ่อนหัวข้อที่ว่าง

### เซลล์ (`"kind": "cell"`)

| ช่อง | ความหมาย |
|---|---|
| `id` | CL ID เช่น `CL:0000775` (7 หลัก) |
| `slug` | ชื่อสั้น kebab-case ใช้เป็นชื่อไฟล์รูปและ URL เช่น `neutrophil` |
| `kind` | `"cell"` |
| `en`, `th` | ชื่ออังกฤษ (ตรงกับ label หรือ synonym ใน CL) และชื่อไทย |
| `systems` | รายการ id ระบบ เซลล์ที่อยู่หลายระบบใส่หลายค่า **ค่าแรก (`systems[0]`) คือระบบหลัก** ใช้เป็นตำแหน่งของเซลล์ในใยภาพรวมแบบจัดกลุ่มตามระบบ (ดูหัวข้อ "ระบบหลัก") |
| `tissue`, `tissue_subtype` | id เนื้อเยื่อหลักและชนิดย่อยจาก `tissues.json` ถ้าไม่ระบุ `tissue` validate จะเตือน และเซลล์จะไปอยู่กลุ่ม `other` ในใยภาพรวมแบบตามเนื้อเยื่อ |
| `location` | ตำแหน่งที่พบ |
| `morphology` | ลักษณะรูปร่างและโครงสร้าง |
| `function` | หน้าที่ |
| `secretes` | สารที่เซลล์หลั่ง (ว่างได้ถ้าไม่หลั่งสารเด่น) |
| `markers` | marker บนผิวเซลล์หรือในเซลล์ |
| `lifespan` | อายุเซลล์ |
| `exam` | จุดออกสอบและข้อควรจำ |
| `diseases` | โรคหรือภาวะที่เกี่ยวข้อง |
| `confused_with` | CL ID ของเซลล์ที่มักสับสน (ต้องอยู่ในชุดข้อมูล) |
| `image` | `null` หรือ object รูป (ดูหัวข้อรูปภาพ) |
| `verified` | `true` เมื่อตรวจเนื้อหาไทยกับตำราแล้ว (เริ่มต้น `false`) |
| `refs` | ตำราหรือแหล่งอ้างอิงที่ใช้ตรวจ |

### หมวด (`"kind": "class"`)

ใช้แค่ `id`, `slug`, `kind`, `en`, `th`, `systems`, `tissue`, `tissue_subtype`, `function`, `image`, `verified`, `refs`
หมวดคือกลุ่มกว้างของเซลล์ เช่น leukocyte, lymphocyte ไม่ใช่เซลล์ชนิดเดียว

### ผลที่สคริปต์เติมให้ใน `nexus.json`

- `purl` ลิงก์ถาวรของเทอมใน CL
- `cl` ประกอบด้วย `label`, `definition`, `synonyms`, `obsolete` (ได้ค่ามาจาก `fetch`)

## ระบบหลัก (primary system)

เซลล์ที่อยู่หลายระบบต้องเรียง `systems` ให้ **ระบบหลักอยู่ลำดับแรก** ระบบหลักคือระบบที่เซลล์ทำหน้าที่หรืออยู่เป็นหลัก เช่น

| เซลล์ | systems | เหตุผล |
|---|---|---|
| Kupffer cell | `["digestive", "blood-immune"]` | แมโครฟาจประจำตับ |
| alveolar macrophage | `["respiratory", "blood-immune"]` | แมโครฟาจประจำถุงลม |
| microglial cell | `["nervous", "blood-immune"]` | เกลียประจำระบบประสาทส่วนกลาง |
| osteoclast | `["skeletal", "blood-immune"]` | ทำงานที่ผิวกระดูก |
| enteroendocrine cell | `["digestive", "endocrine"]` | อยู่ในเยื่อบุทางเดินอาหาร |

ระบบหลักมีผลเฉพาะตำแหน่งในใยภาพรวมแบบตามระบบ ส่วนใยรายระบบยังแสดงเซลล์ทุกตัวที่มีระบบนั้นอยู่ใน `systems`

## ระบบและเนื้อเยื่อ

`systems.json`: แต่ละระบบมี `id`, `th`, `en`, `color` (`#RRGGBB`), `summary`, `organs`

`tissues.json`: แต่ละประเภทมี `id`, `th`, `en`, `color`, `cl_class`, `features`, `location`, `function`, `exam` (จุดออกสอบของเนื้อเยื่อ แสดงเป็นกล่องเด่นในหน้าเนื้อเยื่อ ว่างได้), `germ_layers`, `image`, `subtypes`
หมวด `other` ไม่มี `cl_class` สำหรับเซลล์ที่ไม่เข้าสี่ประเภท (เซลล์สืบพันธุ์ สเต็มเซลล์)

เลือดจัดเป็นเนื้อเยื่อเกี่ยวพัน เซลล์สายเลือดจึงใช้ `tissue: "connective"` กับ subtype `blood`, `hematopoietic` หรือ `lymphoid` ตามตำแหน่ง

## เส้นใย (`data/edges/<system>.json`)

```json
{
  "develops_from": [["CL:ลูก", "CL:แม่"]],
  "is_a": [["CL:ลูก", "CL:แม่"]],
  "interacts_with": [{ "from": "CL:...", "to": "CL:...", "th": "คำอธิบายสั้น ๆ", "mode": "hormone" }]
}
```

- `develops_from` และ `is_a` เขียนเป็นคู่ **[ลูก, แม่]** เสมอ
- `interacts_with` ไม่มีใน CL ต้องเพิ่มเอง ทิศทางจาก `from` ไปยัง `to`
- `mode` ของ `interacts_with` **จำเป็น** (validate จะแจ้งข้อผิดพลาดถ้าขาด) ค่าได้ 5 แบบ แต่ละแบบมีสีและลายเส้นต่างกันบนเว็บ

| mode | ความหมาย | ตัวอย่าง |
|---|---|---|
| `hormone` | ฮอร์โมนผ่านกระแสเลือด | beta cell → hepatocyte (insulin) |
| `synapse` | สัญญาณผ่านไซแนปส์ | rod cell → bipolar cell |
| `paracrine` | สารสื่อสารระยะใกล้ | delta cell → beta cell (somatostatin) |
| `support` | เซลล์สนับสนุนเซลล์อื่น | oligodendrocyte → pyramidal neuron (ไมอีลิน) |
| `immune` | ปฏิสัมพันธ์ของระบบภูมิคุ้มกัน | dendritic cell → helper T cell |

- เส้น `interacts_with` ข้ามระบบได้ ในใยรายระบบ เซลล์ปลายทางที่อยู่นอกระบบจะแสดงเป็นจุดจางสีของระบบนั้น (ghost node) แตะแล้วไปหน้าเซลล์นั้น
- เส้นที่ปลายทางอยู่ในระบบที่ยังไม่ได้เพิ่ม (เช่น สืบพันธุ์ กล้ามเนื้อ) ให้รอจนกว่าจะเพิ่มระบบนั้น
- ทุกเส้นใน `nexus.json` มี `source: "curated"` (คัดเอง)
- ใน `nexus.json` ใช้ `from`/`to` เหมือนกันทุกชนิดเส้น โดย `develops_from` และ `is_a` มี `from` เป็นลูก `to` เป็นแม่

`build-report.md` เทียบเส้น `is_a` และ `develops_from` ที่คัดเองกับ CL ให้ ใช้ตัดสินว่าจะแก้เส้นใดเอง
(CL ระบุ `develops_from` ของเซลล์เม็ดเลือดไว้น้อย เส้นที่ "คัดเองแต่ CL ไม่มี" จึงมีมาก ไม่ได้แปลว่าผิดเสมอไป)

## วิธีใส่รูป

ใช้เฉพาะรูปที่ **ได้รับอนุญาตให้ใช้** เท่านั้น ห้ามใช้รูปจาก Google ทั่วไป
แหล่งที่ใช้ได้ เช่น Wikimedia Commons และ Human Protein Atlas และรูปถ่ายเองจากกล้องจุลทรรศน์ในแลป

1. ดาวน์โหลดรูปมาเก็บใน `site/images/` ตั้งชื่อตาม slug เช่น `site/images/neutrophil.jpg`
   (การใช้ลิงก์ภายนอกเสี่ยงที่ลิงก์จะเสีย ควรเก็บรูปไว้ในเว็บ)
2. แก้ช่อง `image` ของเซลล์:

```json
"image": {
  "src": "images/neutrophil.jpg",
  "credit": "ชื่อผู้สร้างรูป",
  "license": "CC BY 4.0",
  "source": "https://commons.wikimedia.org/wiki/File:...",
  "stain": "H&E",
  "type": "micrograph"
}
```

- `src` นับจากโฟลเดอร์ `site/` (เช่น `images/neutrophil.jpg` คือไฟล์ `site/images/neutrophil.jpg`)
- `src`, `credit`, `license` **จำเป็น** (validate จะแจ้งข้อผิดพลาดถ้าขาด) เว็บแสดงเครดิตใต้รูปอัตโนมัติ
- `source` ลิงก์ต้นทาง, `stain` วิธีย้อมสี, `type` ประเภทรูป (เช่น micrograph, illustration)
- เซลล์ที่ยังไม่มีรูปจะแสดงกรอบ "ยังไม่มีรูป"
- ภาพวาด SVG ใช้เฉพาะเซลล์ที่หารูปไม่ได้
- การมีลิงก์ไม่ได้ทำให้พ้นเรื่องลิขสิทธิ์ ต้องตรวจสัญญาอนุญาตทุกรูป

## เปิดเว็บบนเครื่อง

เว็บเป็นไฟล์ static ไม่มี build step แต่ต้องเปิดผ่านเซิร์ฟเวอร์ (เปิดไฟล์ตรง ๆ จะโหลด `nexus.json` ไม่ได้) และต้องต่ออินเทอร์เน็ตเพื่อโหลดไลบรารีกราฟและฟอนต์จาก CDN

```bash
python scripts/nexus.py build            # สร้าง site/data/nexus.json ใหม่เมื่อแก้ข้อมูล
cd site
python -m http.server 8000
```

แล้วเปิด http://localhost:8000/ หน้าเว็บอ่านข้อมูลจาก `site/data/nexus.json` เท่านั้น
เมื่อเพิ่มระบบใหม่ในข้อมูลแล้วรัน `build` การ์ดระบบบนหน้าแรกและใยรายระบบจะขึ้นเองโดยไม่ต้องแก้โค้ด

| ลิงก์ | หน้า |
|---|---|
| `#/` | หน้าแรก (ระบบ เนื้อเยื่อ ค้นหา) |
| `#/system/blood-immune` | ใยรายระบบ (สลับเป็นมุมมองรายการได้) |
| `#/overview/system` | ใยภาพรวมทั้งร่างกาย จัดกลุ่มตามระบบอวัยวะ |
| `#/overview/tissue` | ใยภาพรวมทั้งร่างกาย จัดกลุ่มตามเนื้อเยื่อ |
| `#/tissue/connective` | หน้าเนื้อเยื่อ (`epithelial`, `connective`, `muscle`, `nervous`, `other`) |
| `#/cell/CL_0000775` | หน้าเซลล์ (CL ID ใช้ `_` แทน `:`) |

## ใยภาพรวมและตำแหน่งที่คำนวณไว้ล่วงหน้า

ใยภาพรวมมีเซลล์จำนวนมาก การคำนวณ layout ในเบราว์เซอร์ทุกครั้งช้าและทำให้ภาพไม่เหมือนเดิม จึงคำนวณตำแหน่งไว้ล่วงหน้าด้วย Node.js
2 แบบ (ตามระบบ และตามเนื้อเยื่อ) แล้วเก็บใน `site/data/layout-overview.json`

**ความต้องการ:** Node.js 18 ขึ้นไป (ทดสอบกับ v24) ใช้เฉพาะตอน build ไม่ต้องใช้ตอนเปิดเว็บ

```bash
npm install                      # ครั้งแรกครั้งเดียว (ติดตั้ง cytoscape และ fcose เวอร์ชันที่ระบุไว้ใน package.json)
python scripts/nexus.py build    # สร้าง nexus.json แล้วเรียก layout ต่อให้อัตโนมัติ
node scripts/layout.mjs          # หรือรันเฉพาะ layout (อ่าน nexus.json ที่มีอยู่)
```

- ผลลัพธ์เหมือนเดิมทุกไบต์เมื่อข้อมูลไม่เปลี่ยน (ตำแหน่งเริ่มต้นกำหนดได้ + ตัวสุ่มมีเมล็ด)
  ถ้า fcose แบบ `randomize: false` ให้ผลเสียรูป (ยุบเป็นเส้นทแยง ซึ่งเกิดกับการจัดกลุ่มตามเนื้อเยื่อ) สคริปต์จะคืนตำแหน่งเริ่มต้นแล้วรันแบบ `randomize: true` ด้วยตัวสุ่มมีเมล็ดแทน ซึ่งยังเหมือนเดิมทุกครั้ง
- ไฟล์เก็บแฮชของรายการจุด (พร้อมระบบหลักและเนื้อเยื่อของแต่ละจุด) และรายการเส้น หน้าเว็บตรวจแฮชนี้ ถ้าไฟล์ไม่มีหรือไม่ตรงกับข้อมูล
  เว็บจะคำนวณในเบราว์เซอร์แทน (ช้ากว่า) และเตือนใน console
- ถ้าไม่มี Node: `build` จะแจ้งเตือนและข้ามขั้นนี้ เว็บยังใช้ได้ แต่ต้อง commit `layout-overview.json` ที่เพิ่งสร้างจากเครื่องที่มี Node ไว้ก่อน deploy เพื่อให้เปิดเร็ว
- ต้อง **commit `site/data/layout-overview.json`** ทุกครั้งที่ข้อมูลเปลี่ยน (`node_modules/` ไม่ต้อง commit)

**การจัดกลุ่ม:** ตามระบบใช้ระบบหลัก (`systems[0]`) ของเซลล์ ตามเนื้อเยื่อใช้ `tissue` (ไม่มี `tissue` ไปกลุ่ม `other`)
**ซูมสองระดับ:** ซูมออกเห็นเฉพาะกลุ่มและเส้นรวมระหว่างกลุ่ม (ความหนาตามจำนวนเส้น) ซูมเข้าเห็นชื่อเซลล์และเส้นจริง

## Deploy บน GitHub Pages

`site/data/nexus.json` ถูกสร้างจาก `build` และต้อง commit ไปด้วย (GitHub Pages ไม่รัน Python ให้) มีสองวิธี:

**วิธี 1: GitHub Actions (แนะนำ เพราะรองรับโฟลเดอร์ `site/`)**
1. ไปที่ Settings → Pages → Source เลือก **GitHub Actions**
2. สร้างไฟล์ `.github/workflows/pages.yml`:

```yaml
name: Deploy site
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

**วิธี 2: เลือกโฟลเดอร์โดยตรง** GitHub Pages เลือกโฟลเดอร์ได้เฉพาะ `/ (root)` หรือ `/docs` ดังนั้นถ้าไม่ใช้ Actions ให้ย้ายหรือคัดลอกเนื้อหาใน `site/` ไปไว้ที่ `docs/`

เว็บใช้ path แบบ relative และ routing ด้วย hash จึงทำงานได้ทั้งที่ `https://<user>.github.io/<repo>/` และโดเมนของตัวเอง

## วิธีเพิ่มระบบใหม่ (ไม่ต้องแก้โค้ด)

1. ตรวจว่า id ระบบมีอยู่ใน `data/systems.json` แล้ว (มีครบ 11 ระบบ)
2. สร้าง `data/cells/<system>.json` ตามรูปแบบด้านบน ใส่ `systems` ให้ถูก
   เซลล์ที่มีอยู่แล้วในอีกระบบ ไม่ต้องสร้างซ้ำ ให้เพิ่มระบบใน `systems` ของเซลล์เดิม
3. สร้าง `data/edges/<system>.json` (ไม่มีเส้นก็ใส่ `{}` ได้)
4. รัน `validate` แล้วแก้ข้อผิดพลาด
5. รัน `fetch` ตรวจ `reports/fetch-report.md` ว่ารหัสถูกต้อง ชื่อตรง และไม่ถูกยกเลิก
6. รัน `build` ตรวจ `reports/build-report.md` แล้วค่อยตัดสินใจเรื่องเส้นใย
7. (อัตโนมัติ) `build` คำนวณตำแหน่งใยภาพรวมใหม่ ถ้าเครื่องมี Node.js ให้ commit `site/data/layout-overview.json` ที่เปลี่ยนไปด้วย
8. ตรวจเนื้อหาไทยกับตำรา (Junqueira's Basic Histology, Campbell Biology) ก่อนตั้ง `verified: true`

ระบบที่เพิ่มแล้วจะปรากฏเองในหน้าแรก ใยรายระบบ ใยภาพรวม ตารางการเชื่อมข้ามระบบ และหน้าเนื้อเยื่อ โดยไม่ต้องแก้ไฟล์ใน `site/js/` เซลล์ที่อยู่หลายระบบให้เรียง `systems` โดยใส่ระบบหลักเป็นลำดับแรก

## ที่มาของข้อมูล

- **Cell Ontology (CL)** ชื่อ คำนิยาม synonyms และความสัมพันธ์ ดึงผ่าน OLS4 API ของ EBI (https://www.ebi.ac.uk/ols4)
  Cell Ontology เผยแพร่ภายใต้สัญญาอนุญาต **CC BY 4.0** (https://obofoundry.org/ontology/cl.html)
- เนื้อหาภาษาไทย เส้น `interacts_with` และข้อมูลอื่น ๆ ที่คัดเองเขียนโดยผู้จัดทำโครงการ ทุกรายการเริ่มที่ `verified: false` จนกว่าจะตรวจกับตำรา

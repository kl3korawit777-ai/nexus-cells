# รายงานความครบถ้วน (coverage)

สร้างเมื่อ: 2026-10-10 11:10
เทียบ data/checklist.json กับข้อมูลจริง จับคู่ด้วย CL ID ก่อน ถ้าไม่มี ID ใช้ชื่อ en เทียบกับ en, cl.label และ synonyms

## สรุป

- เซลล์ (kind = cell): **169** ชนิด  |  หมวด (kind = class): **15** หมวด  |  รวม 184 รายการ
- เป้าหมาย: เซลล์อย่างน้อย 200 ชนิด (ขาดอีก 31)

| ระบบ | เซลล์ในข้อมูล | หมวดในข้อมูล | รายการตรวจ | มีแล้ว | ขาด (หาได้ใน CL) | ไม่มีใน CL |
|---|---:|---:|---:|---:|---:|---:|
| blood-immune | 35 | 5 | 50 | 34 | 16 | 0 |
| digestive | 23 | 3 | 37 | 23 | 13 | 1 |
| endocrine | 19 | 3 | 20 | 19 | 1 | 0 |
| nervous | 25 | 4 | 39 | 24 | 13 | 2 |
| muscular | 5 | 0 | 8 | 5 | 3 | 0 |
| skeletal | 9 | 0 | 16 | 9 | 6 | 1 |
| cardiovascular | 8 | 0 | 14 | 7 | 7 | 0 |
| respiratory | 7 | 0 | 10 | 8 | 2 | 0 |
| urinary | 12 | 0 | 16 | 9 | 6 | 1 |
| integumentary | 10 | 0 | 13 | 9 | 2 | 2 |
| reproductive | 16 | 0 | 23 | 16 | 7 | 0 |
| other | 0 | 0 | 2 | 0 | 2 | 0 |
| **รวม** | 169 | 15 | 248 | 163 | 78 | 7 |

นับระบบตามระบบหลัก (systems[0]) ของแต่ละเซลล์ กลุ่ม other ในรายการตรวจไม่ใช่ระบบ จึงไม่มีเซลล์ในข้อมูลนับที่กลุ่มนี้

## ยังขาด

### blood-immune (16)
- megakaryoblast (เมกะคารีโอบลาสต์) [CL:0000553] — CL ใช้ megakaryocyte progenitor cell (megakaryoblast เป็น synonym)
- myelocyte (ไมอีโลไซต์) [CL:0002193]
- metamyelocyte (เมทาไมอีโลไซต์) [CL:0002192]
- monoblast (โมโนบลาสต์) [CL:0000040]
- red pulp macrophage (แมโครฟาจในเรดพัลป์ของม้าม) [CL:0000874]
- conventional dendritic cell (เดนไดรต์เซลล์ชนิดดั้งเดิม) [CL:0000990]
- naive T cell (ทีเซลล์ที่ยังไม่เคยพบแอนติเจน) [CL:0000898]
- T-helper 1 cell (Th1) [CL:0000545]
- T-helper 2 cell (Th2) [CL:0000546]
- T-helper 17 cell (Th17) [CL:0000899]
- T follicular helper cell (ทีฟอลลิคูลาร์เฮลเปอร์เซลล์) [CL:0002038]
- naive B cell (บีเซลล์ที่ยังไม่เคยพบแอนติเจน) [CL:0000788]
- marginal zone B cell (บีเซลล์ใน marginal zone) [CL:0000845]
- thymic epithelial cell (เซลล์เยื่อบุผิวของไทมัส) [CL:0002293]
- fibroblastic reticular cell (เซลล์เรติคูลาร์ไฟโบรบลาสต์) [CL:0009101]
- high endothelial venule cell (เซลล์บุผนังหลอดเลือดดำเอนโดทีเลียมสูง) [CL:0002652]

### digestive (13)
- cementoblast (ซีเมนโตบลาสต์) [CL:0000061]
- esophageal squamous epithelial cell (เซลล์เยื่อบุผิวสความัสของหลอดอาหาร) [CL:0009096]
- enterochromaffin-like cell (เซลล์คล้ายเอนเทอโรโครมาฟฟิน) [CL:0000504]
- D cell of stomach (ดีเซลล์ของกระเพาะ) [CL:0002267]
- tuft cell (ทัฟต์เซลล์) [CL:0002204]
- colonocyte (โคโลโนไซต์) [CL:1000347]
- I cell (ไอเซลล์ (CCK)) [CL:0002277]
- S cell (เอสเซลล์ (secretin)) [CL:0002281]
- K cell (เคเซลล์ (GIP)) [CL:0002278]
- L cell (แอลเซลล์ (GLP-1)) [CL:0002279]
- enterochromaffin cell (เซลล์เอนเทอโรโครมาฟฟิน) [CL:0000577]
- centroacinar cell (เซลล์เซนโทรเอซินาร์) [CL:0002080]
- gallbladder epithelial cell (เซลล์เยื่อบุถุงน้ำดี) [CL:1000415]

### endocrine (1)
- folliculostellate cell (เซลล์ฟอลลิคูโลสเตลเลต) [CL:0000642]

### nervous (13)
- cerebellar granule cell (เซลล์แกรนูลของสมองน้อย) [CL:0001031]
- GABAergic neuron (เซลล์ประสาท GABA) [CL:0000617]
- glutamatergic neuron (เซลล์ประสาทกลูตาเมต) [CL:0000679]
- serotonergic neuron (เซลล์ประสาทเซโรโทนิน) [CL:0000850]
- oligodendrocyte precursor cell (เซลล์ตั้งต้นโอลิโกเดนโดรไซต์) [CL:0002453]
- tanycyte (แทนนีไซต์) [CL:0002085]
- choroid plexus epithelial cell (เซลล์เยื่อบุผิวของ choroid plexus) [CL:0000706]
- olfactory ensheathing cell (เซลล์เกลียหุ้มปลายประสาทรับกลิ่น) [CL:0011028]
- radial glial cell (เซลล์เรเดียลเกลีย) [CL:0000681]
- retina horizontal cell (เซลล์ฮอริซอนทัลของจอตา) [CL:0000745]
- amacrine cell (เซลล์อะมาคริน) [CL:0000561]
- vestibular hair cell (เซลล์ขนของระบบทรงตัว) [CL:0000609]
- supporting cell of organ of Corti (เซลล์ค้ำจุนของ organ of Corti) [CL:0002490]

### muscular (3)
- slow muscle fiber (เส้นใยกล้ามเนื้อชนิดช้า (type I)) [CL:0000189] — slow muscle cell
- fast muscle fiber (เส้นใยกล้ามเนื้อชนิดเร็ว (type II)) [CL:0000190] — fast muscle cell
- myofibroblast cell (ไมโอไฟโบรบลาสต์) [CL:0000186]

### skeletal (6)
- fibrochondrocyte (ไฟโบรคอนโดรไซต์) [CL:4072104]
- fibroblast (ไฟโบรบลาสต์) [CL:0000057]
- white fat cell (เซลล์ไขมันสีขาว) [CL:0000448]
- brown fat cell (เซลล์ไขมันสีน้ำตาล) [CL:0000449]
- beige fat cell (เซลล์ไขมันสีเบจ) [CL:0001070]
- mesothelial cell (เซลล์เมโซทีเลียม) [CL:0000077]

### cardiovascular (7)
- atrial cardiac muscle cell (เซลล์กล้ามเนื้อหัวใจห้องบน) [CL:0002129] — regular atrial cardiac myocyte
- cardiac ventricular muscle cell (เซลล์กล้ามเนื้อหัวใจห้องล่าง) [CL:2000046] — ventricular cardiac muscle cell
- epicardial cell (เซลล์เอพิคาร์เดียม) [CL:0011019] — mesothelial cell of epicardium
- endothelial cell of artery (เซลล์บุผนังหลอดเลือดแดง) [CL:1000413]
- endothelial cell of vein (เซลล์บุผนังหลอดเลือดดำ) [CL:0002543]
- endothelial cell of capillary (เซลล์บุผนังหลอดเลือดฝอย) [CL:0002144]
- endothelial cell of lymphatic vessel (เซลล์บุผนังหลอดน้ำเหลือง) [CL:0002138]

### respiratory (2)
- pulmonary ionocyte (พัลโมนารีไอโอโนไซต์) [CL:0017000]
- serous cell of bronchial submucosal gland (เซลล์ซีรัสของต่อมใต้เยื่อเมือกหลอดลม) [CL:0019001] — tracheobronchial serous cell

### urinary (6)
- parietal epithelial cell of Bowman's capsule (เซลล์เยื่อบุผิวชั้นนอกของ Bowman's capsule) [CL:1000452] — parietal epithelial cell
- thin limb cell of loop of Henle (เซลล์ส่วนบางของ loop of Henle) [CL:1001111] — kidney loop of Henle thin descending limb epithelial cell
- thick ascending limb cell (เซลล์ส่วนหนาขาขึ้นของ loop of Henle) [CL:1001106]
- type A intercalated cell (เซลล์อินเตอร์คาเลตชนิด A) [CL:0005011] — renal alpha-intercalated cell
- type B intercalated cell (เซลล์อินเตอร์คาเลตชนิด B) [CL:0002201] — renal beta-intercalated cell
- basal urothelial cell (เซลล์เบซัลของยูโรทีเลียม) [CL:1000486]

### integumentary (2)
- eccrine sweat gland cell (เซลล์ต่อมเหงื่อแบบ eccrine) [CL:0002146] — clear cell of eccrine sweat gland (คู่กับ dark cell CL:0002142)
- hair matrix cell (เซลล์แมทริกซ์ของรากผม) [CL:0002562] — hair germinal matrix cell

### reproductive (7)
- prostate luminal epithelial cell (เซลล์เยื่อบุผิวด้านในของต่อมลูกหมาก) [CL:0002340] — luminal cell of prostate epithelium
- ciliated cell of oviduct (เซลล์ขนกวัดของท่อนำไข่) [CL:4030007] — fallopian tube multiciliated epithelial cell
- endometrial epithelial cell (เซลล์เยื่อบุผิวโพรงมดลูก) [CL:4052050] — luminal epithelial cell of endometrium (คู่กับ glandular CL:0009084)
- decidual cell (เดซิดูอัลเซลล์) [CL:2000002]
- myometrial smooth muscle cell (เซลล์กล้ามเนื้อเรียบของมดลูก) [CL:0002366] — myometrial cell
- luminal epithelial cell of mammary gland (เซลล์เยื่อบุผิวด้านในของต่อมน้ำนม) [CL:0002326]
- myoepithelial cell of mammary gland (เซลล์ไมโออีพิทีเลียลของต่อมน้ำนม) [CL:0002324] — basal-myoepithelial cell of mammary gland

### other (2)
- embryonic stem cell (เซลล์ต้นกำเนิดตัวอ่อน) [CL:0002322]
- primordial germ cell (เซลล์สืบพันธุ์ปฐมภูมิ) [CL:0000670]

## ไม่มีใน CL (7)

หารหัส CL ไม่เจอ จึงไม่นำเข้าข้อมูล ดู reports/missing-cl.md

- [digestive] Brunner gland cell
- [nervous] nociceptor
- [nervous] satellite glial cell
- [skeletal] bone lining cell
- [urinary] erythropoietin-producing renal interstitial cell
- [integumentary] apocrine sweat gland cell
- [integumentary] hair follicle stem cell

## มีแล้ว

### blood-immune (34/50)
- hematopoietic stem cell → CL:0000037 hematopoietic stem cell [ชื่อ]
- common myeloid progenitor → CL:0000049 common myeloid progenitor [ชื่อ]
- common lymphoid progenitor → CL:0000051 common lymphoid progenitor [ชื่อ]
- megakaryocyte-erythroid progenitor cell → CL:0000050 megakaryocyte-erythroid progenitor cell [ชื่อ]
- granulocyte monocyte progenitor cell → CL:0000557 granulocyte monocyte progenitor cell [ชื่อ]
- proerythroblast → CL:0000547 proerythroblast [ชื่อ]
- erythroblast → CL:0000765 erythroblast [ชื่อ]
- reticulocyte → CL:0000558 reticulocyte [ชื่อ]
- erythrocyte → CL:0000232 erythrocyte [ชื่อ]
- megakaryocyte → CL:0000556 megakaryocyte [ชื่อ]
- platelet → CL:0000233 platelet [ชื่อ]
- myeloblast → CL:0000835 myeloblast [ชื่อ]
- promyelocyte → CL:0000836 promyelocyte [ชื่อ]
- band form neutrophil → CL:0000560 band form neutrophil [ชื่อ]
- neutrophil → CL:0000775 neutrophil [ชื่อ]
- eosinophil → CL:0000771 eosinophil [ชื่อ]
- basophil → CL:0000767 basophil [ชื่อ]
- mast cell → CL:0000097 mast cell [ชื่อ]
- monocyte → CL:0000576 monocyte [ชื่อ]
- macrophage → CL:0000235 macrophage [ชื่อ]
- plasmacytoid dendritic cell → CL:0000784 plasmacytoid dendritic cell [ชื่อ]
- follicular dendritic cell → CL:0000442 follicular dendritic cell [ชื่อ]
- T cell → CL:0000084 T cell [ชื่อ]
- helper T cell → CL:0000912 helper T cell [ชื่อ]
- cytotoxic T cell → CL:0000910 cytotoxic T cell [ชื่อ]
- regulatory T cell → CL:0000815 regulatory T cell [ชื่อ]
- memory T cell → CL:0000813 memory T cell [ชื่อ]
- NK T cell → CL:0000814 mature NK T cell [id]
- gamma-delta T cell → CL:0000798 gamma-delta T cell [ชื่อ]
- B cell → CL:0000236 B cell [ชื่อ]
- plasma cell → CL:0000786 plasma cell [ชื่อ]
- memory B cell → CL:0000787 memory B cell [ชื่อ]
- natural killer cell → CL:0000623 natural killer cell [ชื่อ]
- innate lymphoid cell → CL:0001065 innate lymphoid cell [ชื่อ]

### digestive (23/37)
- serous acinar cell of salivary gland → CL:4052065 serous acinar cell of salivary gland [ชื่อ]
- mucous acinar cell of salivary gland → CL:4052066 mucous acinar cell of salivary gland [ชื่อ]
- odontoblast → CL:0000060 odontoblast [ชื่อ]
- ameloblast → CL:0000059 ameloblast [ชื่อ]
- parietal cell → CL:0000162 parietal cell [ชื่อ]
- chief cell of stomach → CL:0000155 chief cell of stomach [ชื่อ]
- mucous neck cell → CL:0002181 mucous neck cell of gastric gland [ชื่อ]
- surface mucous cell → CL:0002179 foveolar cell of stomach [id]
- G cell → CL:0000509 gastrin secreting cell [id]
- enterocyte → CL:0000584 enterocyte [ชื่อ]
- goblet cell → CL:0000160 goblet cell [ชื่อ]
- Paneth cell → CL:0000510 paneth cell [ชื่อ]
- M cell → CL:0000682 M cell of gut [ชื่อ]
- intestinal stem cell → CL:0002250 intestinal crypt stem cell [id]
- enteroendocrine cell → CL:0000164 enteroendocrine cell [ชื่อ]
- interstitial cell of Cajal → CL:0002088 interstitial cell of Cajal [ชื่อ]
- hepatocyte → CL:0000182 hepatocyte [ชื่อ]
- hepatic stellate cell → CL:0000632 hepatic stellate cell [ชื่อ]
- cholangiocyte → CL:1000488 cholangiocyte [ชื่อ]
- liver sinusoidal endothelial cell → CL:1000398 endothelial cell of hepatic sinusoid [ชื่อ]
- Kupffer cell → CL:0000091 Kupffer cell [ชื่อ]
- pancreatic acinar cell → CL:0002064 pancreatic acinar cell [ชื่อ]
- pancreatic ductal cell → CL:0002079 pancreatic ductal cell [ชื่อ]

### endocrine (19/20)
- pancreatic alpha cell → CL:0000171 pancreatic A cell [ชื่อ]
- pancreatic beta cell → CL:0000169 type B pancreatic cell [ชื่อ]
- pancreatic delta cell → CL:0000173 pancreatic D cell [ชื่อ]
- pancreatic PP cell → CL:0002275 pancreatic PP cell [ชื่อ]
- thyroid follicular cell → CL:0002258 thyroid follicular cell [ชื่อ]
- parafollicular cell → CL:0000570 parafollicular cell [ชื่อ]
- parathyroid chief cell → CL:0000446 chief cell of parathyroid gland [ชื่อ]
- oxyphil cell → CL:0002199 oxyphil cell of parathyroid gland [id]
- zona glomerulosa cell → CL:0002099 type I cell of adrenal cortex [id]
- zona fasciculata cell → CL:0002136 type II cell of adrenal cortex [id]
- zona reticularis cell → CL:0002137 type III cell of adrenal cortex [id]
- chromaffin cell → CL:0000336 adrenal medulla chromaffin cell [id]
- somatotroph → CL:0002312 somatotroph [ชื่อ]
- lactotroph → CL:0002311 mammotroph [ชื่อ]
- corticotroph → CL:0002309 corticotroph [ชื่อ]
- thyrotroph → CL:0000476 thyrotroph [ชื่อ]
- gonadotroph → CL:0000437 gonadotroph [ชื่อ]
- pituicyte → CL:0000645 pituicyte [ชื่อ]
- pinealocyte → CL:0000652 pinealocyte [ชื่อ]

### nervous (24/39)
- sensory neuron → CL:0000101 sensory neuron [ชื่อ]
- motor neuron → CL:0000100 motor neuron [ชื่อ]
- interneuron → CL:0000099 interneuron [ชื่อ]
- pyramidal neuron → CL:0000598 pyramidal neuron [ชื่อ]
- Purkinje cell → CL:0000121 Purkinje cell [ชื่อ]
- neurosecretory cell → CL:0000165 neuroendocrine cell (หมวด) [id]
- dopaminergic neuron → CL:0000700 dopaminergic neuron [ชื่อ]
- cholinergic neuron → CL:0000108 cholinergic neuron [ชื่อ]
- astrocyte → CL:0000127 astrocyte [ชื่อ]
- oligodendrocyte → CL:0000128 oligodendrocyte [ชื่อ]
- Schwann cell → CL:0002573 Schwann cell [ชื่อ]
- ependymal cell → CL:0000065 ependymal cell [ชื่อ]
- microglial cell → CL:0000129 microglial cell [ชื่อ]
- neural stem cell → CL:0000047 neural stem cell [ชื่อ]
- retinal rod cell → CL:0000604 retinal rod cell [ชื่อ]
- retinal cone cell → CL:0000573 retinal cone cell [ชื่อ]
- retinal bipolar neuron → CL:0000748 retinal bipolar neuron [ชื่อ]
- retinal ganglion cell → CL:0000740 retinal ganglion cell [ชื่อ]
- retinal pigment epithelial cell → CL:0002586 retinal pigment epithelial cell [ชื่อ]
- Mueller cell → CL:0000636 Mueller cell [ชื่อ]
- cochlear inner hair cell → CL:0000589 cochlear inner hair cell [ชื่อ]
- cochlear outer hair cell → CL:0000601 cochlear outer hair cell [ชื่อ]
- olfactory receptor cell → CL:0000207 olfactory receptor cell [ชื่อ]
- taste receptor cell → CL:0000209 taste receptor cell [ชื่อ]

### muscular (5/8)
- skeletal muscle fiber → CL:0008002 skeletal muscle fiber [ชื่อ]
- skeletal muscle satellite cell → CL:0000594 skeletal muscle satellite cell [ชื่อ]
- myoblast → CL:0000056 myoblast [ชื่อ]
- smooth muscle cell → CL:0000192 smooth muscle cell [ชื่อ]
- tendon cell → CL:0000388 tendon cell [ชื่อ]

### skeletal (9/16)
- mesenchymal stem cell → CL:0000134 mesenchymal stem cell [ชื่อ]
- osteoprogenitor cell → CL:0007010 osteoprogenitor cell [ชื่อ]
- osteoblast → CL:0000062 osteoblast [ชื่อ]
- osteocyte → CL:0000137 osteocyte [ชื่อ]
- osteoclast → CL:0000092 osteoclast [ชื่อ]
- chondroblast → CL:0000058 chondroblast [ชื่อ]
- chondrocyte → CL:0000138 chondrocyte [ชื่อ]
- type A synovial cell → CL:0002302 type A synovial cell [ชื่อ]
- type B synovial cell → CL:0002301 type B synovial cell [ชื่อ]

### cardiovascular (7/14)
- cardiac pacemaker cell of sinoatrial node → CL:1000477 cardiac pacemaker cell of sinoatrial node [ชื่อ]
- Purkinje myocyte → CL:0002068 Purkinje myocyte [ชื่อ]
- cardiac fibroblast → CL:0002548 fibroblast of cardiac tissue [ชื่อ]
- endocardial cell → CL:0002350 endocardial cell [ชื่อ]
- endothelial cell → CL:0000115 endothelial cell [ชื่อ]
- vascular associated smooth muscle cell → CL:0000359 vascular associated smooth muscle cell [ชื่อ]
- pericyte → CL:0000669 pericyte [ชื่อ]

### respiratory (8/10)
- pulmonary alveolar type 1 cell → CL:0002062 pulmonary alveolar type 1 cell [ชื่อ]
- pulmonary alveolar type 2 cell → CL:0002063 pulmonary alveolar type 2 cell [ชื่อ]
- club cell → CL:0000158 club cell [ชื่อ]
- ciliated cell of airway → CL:0002145 multiciliated columnar cell of tracheobronchial tree [id]
- basal cell of airway → CL:0002329 basal epithelial cell of tracheobronchial tree [id]
- pulmonary neuroendocrine cell → CL:1000223 pulmonary neuroendocrine cell [ชื่อ]
- alveolar macrophage → CL:0000583 alveolar macrophage [ชื่อ]
- goblet cell → CL:0000160 goblet cell [ชื่อ]

### urinary (9/16)
- podocyte → CL:0000653 podocyte [ชื่อ]
- glomerular endothelial cell → CL:0002188 glomerular endothelial cell [ชื่อ]
- glomerular mesangial cell → CL:1000742 glomerular mesangial cell [ชื่อ]
- epithelial cell of proximal tubule → CL:0002306 epithelial cell of proximal tubule [ชื่อ]
- epithelial cell of distal tubule → CL:0002305 epithelial cell of distal tubule [ชื่อ]
- macula densa epithelial cell → CL:1000850 macula densa epithelial cell [ชื่อ]
- kidney granular cell → CL:0000648 kidney granular cell [ชื่อ]
- kidney collecting duct principal cell → CL:1001431 kidney collecting duct principal cell [ชื่อ]
- umbrella cell of urothelium → CL:4030056 umbrella cell of urothelium [ชื่อ]

### integumentary (9/13)
- basal cell of epidermis → CL:0002187 basal cell of epidermis [ชื่อ]
- keratinocyte → CL:0000312 keratinocyte [ชื่อ]
- corneocyte → CL:0002153 corneocyte [ชื่อ]
- melanocyte → CL:0000148 melanocyte [ชื่อ]
- Langerhans cell → CL:0000453 Langerhans cell [ชื่อ]
- Merkel cell → CL:0000242 Merkel cell [ชื่อ]
- sebocyte → CL:0000317 sebocyte [ชื่อ]
- myoepithelial cell of sweat gland → CL:1000417 myoepithelial cell of sweat gland [ชื่อ]
- fibroblast of dermis → CL:0002551 fibroblast of dermis [ชื่อ]

### reproductive (16/23)
- spermatogonium → CL:0000020 spermatogonium [ชื่อ]
- primary spermatocyte → CL:0000656 primary spermatocyte [ชื่อ]
- secondary spermatocyte → CL:0000657 secondary spermatocyte [ชื่อ]
- spermatid → CL:0000018 spermatid [ชื่อ]
- sperm → CL:0000019 sperm [ชื่อ]
- Sertoli cell → CL:0000216 Sertoli cell [ชื่อ]
- Leydig cell → CL:0000178 Leydig cell [ชื่อ]
- oogonial cell → CL:0000024 oogonial cell [ชื่อ]
- primary oocyte → CL:0000654 primary oocyte [ชื่อ]
- secondary oocyte → CL:0000655 secondary oocyte [ชื่อ]
- granulosa cell → CL:0000501 granulosa cell [ชื่อ]
- theca cell → CL:0000503 theca cell [ชื่อ]
- luteal cell → CL:0000175 luteal cell [ชื่อ]
- stromal cell of endometrium → CL:0002255 stromal cell of endometrium [ชื่อ]
- mononuclear cytotrophoblast cell → CL:0000523 mononuclear cytotrophoblast cell [ชื่อ]
- syncytiotrophoblast cell → CL:0000525 syncytiotrophoblast cell [ชื่อ]

### other (0/2)

## ในข้อมูลแต่ไม่อยู่ในรายการตรวจ (22)

ไม่ใช่ข้อผิดพลาด แค่แจ้งไว้ (หมวดและเซลล์ที่เพิ่มนอกรายการ)

- CL:0000451 dendritic cell (blood-immune)
- CL:0000094 granulocyte [หมวด] (blood-immune)
- CL:0000988 hematopoietic cell [หมวด] (blood-immune)
- CL:0000738 leukocyte [หมวด] (blood-immune)
- CL:0000542 lymphocyte [หมวด] (blood-immune)
- CL:0000145 professional antigen presenting cell [หมวด] (blood-immune)
- CL:0000746 cardiac muscle cell (cardiovascular)
- CL:1001433 epithelial cell of exocrine pancreas [หมวด] (digestive)
- CL:0002178 epithelial cell of stomach [หมวด] (digestive)
- CL:0002563 intestinal epithelial cell [หมวด] (digestive)
- CL:0002097 cortical cell of adrenal gland [หมวด] (endocrine)
- CL:0000167 peptide hormone secreting cell [หมวด] (endocrine)
- CL:0000174 steroid hormone secreting cell [หมวด] (endocrine)
- CL:1000448 epithelial cell of sweat gland (integumentary)
- CL:0000125 glial cell [หมวด] (nervous)
- CL:0011003 magnocellular neurosecretory cell (nervous)
- CL:0000540 neuron [หมวด] (nervous)
- CL:1001505 parvocellular neurosecretory cell (nervous)
- CL:0000210 photoreceptor cell [หมวด] (nervous)
- CL:1000909 kidney loop of Henle epithelial cell (urinary)
- CL:0005010 renal intercalated cell (urinary)
- CL:0000731 urothelial cell (urinary)

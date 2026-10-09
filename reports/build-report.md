# รายงานการรวมข้อมูล (build)

สร้างเมื่อ: 2026-10-09 18:07

## is_a: เส้นที่คัดเอง เทียบกับ CL (หลัง transitive reduction ภายในชุดข้อมูล)

- ตรงกัน: 41 เส้น
- คัดเองมี และเป็นบรรพบุรุษใน CL แต่ข้ามขั้น: 1 เส้น
- คัดเองมี แต่ CL ไม่มีความสัมพันธ์นี้เลย: 4 เส้น
- CL มี แต่ไม่ได้คัดไว้: 24 เส้น

### is_a ที่คัดเองข้ามขั้น
ถูกตามความหมาย แต่ใน CL มีตัวกลางอยู่ระหว่างสองรหัสนี้ในชุดข้อมูล

- CL:0000235 macrophage → CL:0000738 leukocyte

### is_a ที่คัดเองแต่ CL ไม่มี
ควรตรวจว่าตำราหรือ CL ถูก

- CL:0000236 B cell → CL:0000145 professional antigen presenting cell
- CL:0000446 chief cell of parathyroid gland → CL:0000167 peptide hormone secreting cell
- CL:0000509 gastrin secreting cell → CL:0002178 epithelial cell of stomach
- CL:0000815 regulatory T cell → CL:0000912 helper T cell

### is_a ที่ CL มีแต่ไม่ได้คัดไว้

- CL:0000037 hematopoietic stem cell → CL:0000988 hematopoietic cell
- CL:0000049 common myeloid progenitor → CL:0000988 hematopoietic cell
- CL:0000050 megakaryocyte-erythroid progenitor cell → CL:0000988 hematopoietic cell
- CL:0000051 common lymphoid progenitor → CL:0000988 hematopoietic cell
- CL:0000092 osteoclast → CL:0000738 leukocyte
- CL:0000097 mast cell → CL:0000738 leukocyte
- CL:0000145 professional antigen presenting cell → CL:0000738 leukocyte
- CL:0000169 type B pancreatic cell → CL:0000164 enteroendocrine cell
- CL:0000171 pancreatic A cell → CL:0000164 enteroendocrine cell
- CL:0000173 pancreatic D cell → CL:0000164 enteroendocrine cell
- CL:0000233 platelet → CL:0000988 hematopoietic cell
- CL:0000509 gastrin secreting cell → CL:0000167 peptide hormone secreting cell
- CL:0000510 paneth cell → CL:0002563 intestinal epithelial cell
- CL:0000556 megakaryocyte → CL:0000988 hematopoietic cell
- CL:0000557 granulocyte monocyte progenitor cell → CL:0000988 hematopoietic cell
- CL:0000558 reticulocyte → CL:0000988 hematopoietic cell
- CL:0000765 erythroblast → CL:0000988 hematopoietic cell
- CL:0000786 plasma cell → CL:0000542 lymphocyte
- CL:0000787 memory B cell → CL:0000145 professional antigen presenting cell
- CL:0000787 memory B cell → CL:0000236 B cell
- CL:0000813 memory T cell → CL:0000084 T cell
- CL:0000815 regulatory T cell → CL:0000084 T cell
- CL:0002258 thyroid follicular cell → CL:0000167 peptide hormone secreting cell
- CL:0002275 pancreatic PP cell → CL:0000164 enteroendocrine cell

## develops_from: เส้นที่คัดเอง เทียบกับ CL

- ตรงกัน: 4 เส้น
- คัดเองมี แต่ CL ไม่มี: 24 เส้น
- CL มี (ในชุดข้อมูล) แต่ไม่ได้คัดไว้: 2 เส้น
- CL ชี้ไปเซลล์นอกชุดข้อมูล: 21 เส้น

หมายเหตุ: OLS คืนเทอมที่ไม่ใช่เซลล์ (GO, PR, PATO ฯลฯ) มาด้วย รวม 208 รายการ ไม่นับในการเทียบ

### develops_from ที่คัดเองแต่ CL ไม่มี

- CL:0000049 common myeloid progenitor → CL:0000037 hematopoietic stem cell
- CL:0000050 megakaryocyte-erythroid progenitor cell → CL:0000049 common myeloid progenitor
- CL:0000051 common lymphoid progenitor → CL:0000037 hematopoietic stem cell
- CL:0000084 T cell → CL:0000051 common lymphoid progenitor
- CL:0000097 mast cell → CL:0000557 granulocyte monocyte progenitor cell
- CL:0000160 goblet cell → CL:0002250 intestinal crypt stem cell
- CL:0000164 enteroendocrine cell → CL:0002250 intestinal crypt stem cell
- CL:0000236 B cell → CL:0000051 common lymphoid progenitor
- CL:0000451 dendritic cell → CL:0000049 common myeloid progenitor
- CL:0000510 paneth cell → CL:0002250 intestinal crypt stem cell
- CL:0000556 megakaryocyte → CL:0000050 megakaryocyte-erythroid progenitor cell
- CL:0000557 granulocyte monocyte progenitor cell → CL:0000049 common myeloid progenitor
- CL:0000558 reticulocyte → CL:0000765 erythroblast
- CL:0000576 monocyte → CL:0000557 granulocyte monocyte progenitor cell
- CL:0000584 enterocyte → CL:0002250 intestinal crypt stem cell
- CL:0000623 natural killer cell → CL:0000051 common lymphoid progenitor
- CL:0000682 M cell of gut → CL:0002250 intestinal crypt stem cell
- CL:0000765 erythroblast → CL:0000050 megakaryocyte-erythroid progenitor cell
- CL:0000767 basophil → CL:0000557 granulocyte monocyte progenitor cell
- CL:0000771 eosinophil → CL:0000557 granulocyte monocyte progenitor cell
- CL:0000775 neutrophil → CL:0000557 granulocyte monocyte progenitor cell
- CL:0000786 plasma cell → CL:0000236 B cell
- CL:0000787 memory B cell → CL:0000236 B cell
- CL:0000813 memory T cell → CL:0000084 T cell

### develops_from ที่ CL มีแต่ไม่ได้คัดไว้

- CL:0000542 lymphocyte → CL:0000051 common lymphoid progenitor
- CL:0000738 leukocyte → CL:0000037 hematopoietic stem cell

### develops_from ที่ CL ชี้ไปเซลล์นอกชุดข้อมูล

- CL:0000037 hematopoietic stem cell ← CL:0000566 angioblastic mesenchymal cell
- CL:0000084 T cell ← CL:0000827 pro-T cell
- CL:0000097 mast cell ← CL:0000831 mast cell progenitor
- CL:0000129 microglial cell ← CL:0000034 stem cell
- CL:0000129 microglial cell ← CL:0000222 mesodermal cell
- CL:0000169 type B pancreatic cell ← CL:0002351 progenitor cell of endocrine pancreas
- CL:0000171 pancreatic A cell ← CL:0002351 progenitor cell of endocrine pancreas
- CL:0000173 pancreatic D cell ← CL:0002351 progenitor cell of endocrine pancreas
- CL:0000182 hepatocyte ← CL:0005026 hepatoblast
- CL:0000336 adrenal medulla chromaffin cell ← CL:0000011 migratory trunk neural crest cell
- CL:0000510 paneth cell ← CL:4047017 transit amplifying cell of gut
- CL:0000542 lymphocyte ← CL:0017500 neutrophillic cytoplasm
- CL:0000556 megakaryocyte ← CL:0000553 megakaryocyte progenitor cell
- CL:0000558 reticulocyte ← CL:0000552 orthochromatic erythroblast
- CL:0000570 parafollicular cell ← CL:0000333 migratory neural crest cell
- CL:0000576 monocyte ← CL:0000559 promonocyte
- CL:0000623 natural killer cell ← CL:0000825 pro-NK cell
- CL:0000765 erythroblast ← CL:0000547 proerythroblast
- CL:0000786 plasma cell ← CL:0000980 plasmablast
- CL:0000786 plasma cell ← CL:0017508 cartwheel heterochromatin
- CL:1000488 cholangiocyte ← CL:0005026 hepatoblast

## คำเตือนจาก validate (78)

- CL:0000988 (hematopoietic cell): ยังไม่มีรูป
- CL:0000738 (leukocyte): ยังไม่มีรูป
- CL:0000094 (granulocyte): ยังไม่มีรูป
- CL:0000542 (lymphocyte): ยังไม่มีรูป
- CL:0000145 (professional antigen presenting cell): ช่องว่าง: tissue_subtype; ยังไม่มีรูป
- CL:0000037 (hematopoietic stem cell): ช่องว่าง: lifespan, confused_with; ยังไม่มีรูป
- CL:0000049 (common myeloid progenitor): ช่องว่าง: morphology, lifespan, diseases; ยังไม่มีรูป
- CL:0000051 (common lymphoid progenitor): ช่องว่าง: morphology, lifespan, diseases; ยังไม่มีรูป
- CL:0000050 (megakaryocyte-erythroid progenitor cell): ช่องว่าง: morphology, markers, lifespan, diseases; ยังไม่มีรูป
- CL:0000557 (granulocyte monocyte progenitor cell): ช่องว่าง: morphology, markers, lifespan, exam, diseases; ยังไม่มีรูป
- CL:0000765 (erythroblast): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000558 (reticulocyte): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000232 (erythrocyte): ยังไม่มีรูป
- CL:0000556 (megakaryocyte): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000233 (platelet): ยังไม่มีรูป
- CL:0000775 (neutrophil): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000771 (eosinophil): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000767 (basophil): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000097 (mast cell): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000576 (monocyte): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000235 (macrophage): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000092 (osteoclast): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000091 (Kupffer cell): ช่องว่าง: morphology, lifespan, diseases; ยังไม่มีรูป
- CL:0000583 (alveolar macrophage): ช่องว่าง: morphology, lifespan, diseases; ยังไม่มีรูป
- CL:0000129 (microglial cell): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000451 (dendritic cell): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000084 (T cell): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000912 (helper T cell): ช่องว่าง: morphology, lifespan; ยังไม่มีรูป
- CL:0000910 (cytotoxic T cell): ช่องว่าง: morphology, lifespan, diseases; ยังไม่มีรูป
- CL:0000815 (regulatory T cell): ช่องว่าง: morphology, lifespan; ยังไม่มีรูป
- CL:0000813 (memory T cell): ช่องว่าง: morphology, lifespan, diseases; ยังไม่มีรูป
- CL:0000236 (B cell): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000786 (plasma cell): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000787 (memory B cell): ช่องว่าง: morphology, lifespan, diseases; ยังไม่มีรูป
- CL:0000623 (natural killer cell): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0002563 (intestinal epithelial cell): ยังไม่มีรูป
- CL:0002178 (epithelial cell of stomach): ยังไม่มีรูป
- CL:1001433 (epithelial cell of exocrine pancreas): ยังไม่มีรูป
- CL:4052065 (serous acinar cell of salivary gland): ช่องว่าง: markers, lifespan; ยังไม่มีรูป
- CL:4052066 (mucous acinar cell of salivary gland): ช่องว่าง: markers, lifespan, diseases; ยังไม่มีรูป
- CL:0000162 (parietal cell): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000155 (chief cell of stomach): ช่องว่าง: markers, lifespan, diseases; ยังไม่มีรูป
- CL:0002181 (mucous neck cell of gastric gland): ช่องว่าง: markers, lifespan, diseases; ยังไม่มีรูป
- CL:0002179 (foveolar cell of stomach): ช่องว่าง: markers; ยังไม่มีรูป
- CL:0000509 (gastrin secreting cell): ช่องว่าง: morphology, markers, lifespan, confused_with; ยังไม่มีรูป
- CL:0000584 (enterocyte): ยังไม่มีรูป
- CL:0000160 (goblet cell): ช่องว่าง: lifespan, diseases; ยังไม่มีรูป
- CL:0000510 (paneth cell): ช่องว่าง: lifespan, confused_with; ยังไม่มีรูป
- CL:0000164 (enteroendocrine cell): ช่องว่าง: lifespan, confused_with; ยังไม่มีรูป
- CL:0002250 (intestinal crypt stem cell): ช่องว่าง: lifespan, confused_with; ยังไม่มีรูป
- CL:0000682 (M cell of gut): ช่องว่าง: markers, lifespan, diseases, confused_with; ยังไม่มีรูป
- CL:0002088 (interstitial cell of Cajal): ช่องว่าง: lifespan, confused_with, tissue_subtype; ยังไม่มีรูป
- CL:0000182 (hepatocyte): ช่องว่าง: lifespan, confused_with; ยังไม่มีรูป
- CL:0000632 (hepatic stellate cell): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:1000488 (cholangiocyte): ช่องว่าง: markers, lifespan; ยังไม่มีรูป
- CL:0002064 (pancreatic acinar cell): ช่องว่าง: markers, lifespan; ยังไม่มีรูป
- CL:0002079 (pancreatic ductal cell): ช่องว่าง: markers, lifespan; ยังไม่มีรูป
- CL:0000167 (peptide hormone secreting cell): ยังไม่มีรูป
- CL:0000174 (steroid hormone secreting cell): ยังไม่มีรูป
- CL:0002097 (cortical cell of adrenal gland): ยังไม่มีรูป
- CL:0000171 (pancreatic A cell): ช่องว่าง: morphology, lifespan, diseases; ยังไม่มีรูป
- CL:0000169 (type B pancreatic cell): ช่องว่าง: morphology, lifespan; ยังไม่มีรูป
- CL:0000173 (pancreatic D cell): ช่องว่าง: morphology, lifespan, diseases, confused_with; ยังไม่มีรูป
- CL:0002275 (pancreatic PP cell): ช่องว่าง: morphology, markers, lifespan, diseases, confused_with; ยังไม่มีรูป
- CL:0002258 (thyroid follicular cell): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000570 (parafollicular cell): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0000446 (chief cell of parathyroid gland): ช่องว่าง: lifespan, confused_with; ยังไม่มีรูป
- CL:0002099 (type I cell of adrenal cortex): ช่องว่าง: markers, lifespan; ยังไม่มีรูป
- CL:0002136 (type II cell of adrenal cortex): ช่องว่าง: markers, lifespan; ยังไม่มีรูป
- CL:0002137 (type III cell of adrenal cortex): ช่องว่าง: markers, lifespan, diseases; ยังไม่มีรูป
- CL:0000336 (adrenal medulla chromaffin cell): ช่องว่าง: lifespan, confused_with; ยังไม่มีรูป
- CL:0002312 (somatotroph): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0002311 (mammotroph): ช่องว่าง: lifespan; ยังไม่มีรูป
- CL:0002309 (corticotroph): ช่องว่าง: lifespan, confused_with; ยังไม่มีรูป
- CL:0000476 (thyrotroph): ช่องว่าง: lifespan, diseases, confused_with; ยังไม่มีรูป
- CL:0000437 (gonadotroph): ช่องว่าง: lifespan, diseases, confused_with; ยังไม่มีรูป
- CL:0000652 (pinealocyte): ช่องว่าง: markers, lifespan, diseases, confused_with; ยังไม่มีรูป
- CL:0000645 (pituicyte): ช่องว่าง: markers, lifespan, diseases, confused_with; ยังไม่มีรูป

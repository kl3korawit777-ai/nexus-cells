# รายงานการรวมข้อมูล (build)

สร้างเมื่อ: 2026-10-09 17:55

## is_a: เส้นที่คัดเอง เทียบกับ CL (หลัง transitive reduction ภายในชุดข้อมูล)

- ตรงกัน: 18 เส้น
- คัดเองมี และเป็นบรรพบุรุษใน CL แต่ข้ามขั้น: 1 เส้น
- คัดเองมี แต่ CL ไม่มีความสัมพันธ์นี้เลย: 2 เส้น
- CL มี แต่ไม่ได้คัดไว้: 17 เส้น

### is_a ที่คัดเองข้ามขั้น
ถูกตามความหมาย แต่ใน CL มีตัวกลางอยู่ระหว่างสองรหัสนี้ในชุดข้อมูล

- CL:0000235 macrophage → CL:0000738 leukocyte

### is_a ที่คัดเองแต่ CL ไม่มี
ควรตรวจว่าตำราหรือ CL ถูก

- CL:0000236 B cell → CL:0000145 professional antigen presenting cell
- CL:0000815 regulatory T cell → CL:0000912 helper T cell

### is_a ที่ CL มีแต่ไม่ได้คัดไว้

- CL:0000037 hematopoietic stem cell → CL:0000988 hematopoietic cell
- CL:0000049 common myeloid progenitor → CL:0000988 hematopoietic cell
- CL:0000050 megakaryocyte-erythroid progenitor cell → CL:0000988 hematopoietic cell
- CL:0000051 common lymphoid progenitor → CL:0000988 hematopoietic cell
- CL:0000092 osteoclast → CL:0000738 leukocyte
- CL:0000097 mast cell → CL:0000738 leukocyte
- CL:0000145 professional antigen presenting cell → CL:0000738 leukocyte
- CL:0000233 platelet → CL:0000988 hematopoietic cell
- CL:0000556 megakaryocyte → CL:0000988 hematopoietic cell
- CL:0000557 granulocyte monocyte progenitor cell → CL:0000988 hematopoietic cell
- CL:0000558 reticulocyte → CL:0000988 hematopoietic cell
- CL:0000765 erythroblast → CL:0000988 hematopoietic cell
- CL:0000786 plasma cell → CL:0000542 lymphocyte
- CL:0000787 memory B cell → CL:0000145 professional antigen presenting cell
- CL:0000787 memory B cell → CL:0000236 B cell
- CL:0000813 memory T cell → CL:0000084 T cell
- CL:0000815 regulatory T cell → CL:0000084 T cell

## develops_from: เส้นที่คัดเอง เทียบกับ CL

- ตรงกัน: 4 เส้น
- คัดเองมี แต่ CL ไม่มี: 19 เส้น
- CL มี (ในชุดข้อมูล) แต่ไม่ได้คัดไว้: 2 เส้น
- CL ชี้ไปเซลล์นอกชุดข้อมูล: 13 เส้น

หมายเหตุ: OLS คืนเทอมที่ไม่ใช่เซลล์ (GO, PR, PATO ฯลฯ) มาด้วย รวม 154 รายการ ไม่นับในการเทียบ

### develops_from ที่คัดเองแต่ CL ไม่มี

- CL:0000049 common myeloid progenitor → CL:0000037 hematopoietic stem cell
- CL:0000050 megakaryocyte-erythroid progenitor cell → CL:0000049 common myeloid progenitor
- CL:0000051 common lymphoid progenitor → CL:0000037 hematopoietic stem cell
- CL:0000084 T cell → CL:0000051 common lymphoid progenitor
- CL:0000097 mast cell → CL:0000557 granulocyte monocyte progenitor cell
- CL:0000236 B cell → CL:0000051 common lymphoid progenitor
- CL:0000451 dendritic cell → CL:0000049 common myeloid progenitor
- CL:0000556 megakaryocyte → CL:0000050 megakaryocyte-erythroid progenitor cell
- CL:0000557 granulocyte monocyte progenitor cell → CL:0000049 common myeloid progenitor
- CL:0000558 reticulocyte → CL:0000765 erythroblast
- CL:0000576 monocyte → CL:0000557 granulocyte monocyte progenitor cell
- CL:0000623 natural killer cell → CL:0000051 common lymphoid progenitor
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
- CL:0000542 lymphocyte ← CL:0017500 neutrophillic cytoplasm
- CL:0000556 megakaryocyte ← CL:0000553 megakaryocyte progenitor cell
- CL:0000558 reticulocyte ← CL:0000552 orthochromatic erythroblast
- CL:0000576 monocyte ← CL:0000559 promonocyte
- CL:0000623 natural killer cell ← CL:0000825 pro-NK cell
- CL:0000765 erythroblast ← CL:0000547 proerythroblast
- CL:0000786 plasma cell ← CL:0000980 plasmablast
- CL:0000786 plasma cell ← CL:0017508 cartwheel heterochromatin

## คำเตือนจาก validate (35)

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

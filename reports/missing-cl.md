# เซลล์ที่หารหัส CL ไม่เจอ

สร้างจาก data/checklist.json (รายการที่ตั้ง `no_cl`) ด้วย `python scripts/nexus.py coverage` ไม่ได้สร้างรหัสเอง ไม่ได้ใส่ในข้อมูล
ถ้า CL เพิ่มเทอมนี้ภายหลัง ให้ลบ `no_cl` ออกจากรายการแล้วใส่ `id`

| ระบบ | เซลล์ | คลาสแม่ที่ใกล้ที่สุดใน CL | หมายเหตุ |
|---|---|---|---|
| digestive | Brunner gland cell (เซลล์ต่อมบรุนเนอร์) | CL:1001589 | ไม่พบ Brunner gland cell ใน CL (พบเฉพาะ duodenum secretory cell) |
| nervous | nociceptor (โนซิเซพเตอร์) | CL:0000101 | ไม่พบ nociceptor ใน CL (พบเฉพาะกลุ่ม dorsal root ganglion neuron ที่ระบุตามยีน) |
| nervous | satellite glial cell (เซลล์เกลียดาวเทียม) | CL:0000125 | ไม่พบ satellite glial cell ใน CL |
| skeletal | bone lining cell (เซลล์เรียงผิวกระดูก) | CL:0001035 | ไม่พบ bone lining cell ใน CL (bone cell เป็นคลาสที่ใกล้ที่สุด) |
| urinary | erythropoietin-producing renal interstitial cell (เซลล์คั่นระหว่างท่อไตที่สร้าง EPO) | CL:1000692 | ไม่พบเซลล์คั่นระหว่างท่อไตที่สร้าง EPO ใน CL (kidney interstitial fibroblast ใกล้ที่สุด แต่นิยามไม่ระบุ EPO) |
| integumentary | apocrine sweat gland cell (เซลล์ต่อมเหงื่อแบบ apocrine) | CL:1000448 | ไม่พบ apocrine sweat gland cell ใน CL (ใช้ epithelial cell of sweat gland) |
| integumentary | hair follicle stem cell (เซลล์ต้นกำเนิดรูขุมขน) | CL:1000428 | ไม่พบ hair follicle stem cell ใน CL (พบเฉพาะ hair follicle dermal stem cell ซึ่งเป็นคนละชนิด; stem cell of epidermis เป็นคลาสที่ใกล้ที่สุด) |

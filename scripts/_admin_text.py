"""ช่วยเพิ่มข้อความลง site/admin/th.json (เรียงคีย์) ใช้ชั่วคราวระหว่างพัฒนา: python scripts/_admin_text.py <ไฟล์ json ที่จะรวม>"""
import json, sys, os
p = os.path.join(os.path.dirname(__file__), "..", "site", "admin", "th.json")
cur = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
add = json.load(open(sys.argv[1], encoding="utf-8"))
cur.update(add)
open(p, "w", encoding="utf-8", newline="\n").write(json.dumps(dict(sorted(cur.items())), ensure_ascii=False, indent=2) + "\n")
print(len(cur), "keys")

#!/usr/bin/env python3
"""ทดสอบกฎความปลอดภัยและความถูกต้องของ nexus.py validate ด้วยข้อมูลสำเนาชั่วคราว (ไม่แตะข้อมูลจริง)
รัน: python scripts/test-validate.py"""

import copy
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nexus  # noqa: E402

tmp = tempfile.mkdtemp()
shutil.copytree(nexus.DATA, os.path.join(tmp, "data"), ignore=shutil.ignore_patterns("cache"))
nexus.DATA = os.path.join(tmp, "data")
failures = 0


def cells_path(name):
    return os.path.join(nexus.DATA, "cells", name + ".json")


def edges_path(name):
    return os.path.join(nexus.DATA, "edges", name + ".json")


def with_change(fn, file_kind="cells", name="blood-immune"):
    path = (cells_path if file_kind == "cells" else edges_path)(name)
    original = nexus.load_json(path)
    data = copy.deepcopy(original)
    fn(data)
    nexus.save_json(path, data)
    try:
        errors, _ = nexus.run_validate(quiet=True)
    finally:
        nexus.save_json(path, original)
    return errors


def expect(label, errors, needle):
    global failures
    ok = any(needle in e for e in errors)
    print(("  ✓ " if ok else "  ✗ ") + label + ("" if ok else "  (ได้: %s)" % errors[:2]))
    if not ok:
        failures += 1


base, _ = nexus.run_validate(quiet=True)
print(("  ✓ " if not base else "  ✗ ") + "ข้อมูลจริงผ่านการตรวจ")
failures += bool(base)


def script_tag(d): d[0]["function"] = "ปกติ <script>alert(1)</script>"
expect("ข้อความมี <script> ถูกปฏิเสธ", with_change(script_tag), "แท็ก HTML")


def img_tag(d): d[0]["en_content"] = {"function": "<img src=x onerror=alert(1)>"}
expect("ข้อความภาษาอังกฤษมีแท็ก ถูกปฏิเสธ", with_change(img_tag), "แท็ก HTML")


def js_url(d): d[0]["refs"] = ["javascript:alert(1)"]
expect("javascript: ถูกปฏิเสธ", with_change(js_url), "แท็ก HTML")


def edge_tag(e): e["interacts_with"][0]["th"] = "<b>x</b>"
expect("คำอธิบายเส้นมีแท็ก ถูกปฏิเสธ", with_change(edge_tag, "edges", "endocrine"), "แท็ก HTML")


def img(**kw):
    base_img = {"src": "https://example.org/a.jpg", "type": "micrograph", "alt_th": "ทดสอบ", "credit": "x", "license": "CC0", "source": "https://example.org/page"}
    base_img.update(kw)
    return base_img


def http_src(d): d[0]["images"] = [img(src="http://example.org/a.jpg")]
expect("src แบบ http:// ถูกปฏิเสธ", with_change(http_src), "https://")


def http_source(d): d[0]["images"] = [img(source="http://example.org/page")]
expect("source ที่ไม่ใช่ https ถูกปฏิเสธ", with_change(http_source), "source ต้องเป็นลิงก์")


def js_source(d): d[0]["images"] = [img(source="javascript:alert(1)")]
expect("source เป็น javascript: ถูกปฏิเสธ", with_change(js_source), "source ต้องเป็นลิงก์")


def no_license(d):
    i = img(); del i["license"]; d[0]["images"] = [i]
expect("รูปไม่มี license ถูกปฏิเสธ", with_change(no_license), "ขาดช่อง license")


def no_source(d):
    i = img(); del i["source"]; d[0]["images"] = [i]
expect("รูปลิงก์ไม่มี source ถูกปฏิเสธ", with_change(no_source), "ต้องมี source")


def isa_cycle(e):
    pairs = e["is_a"]
    a, b = pairs[0]
    pairs.append([b, a])
expect("is_a วนกลับถูกปฏิเสธ", with_change(isa_cycle, "edges", "blood-immune"), "is_a วนกลับ")


def dev_cycle(e):
    a, b = e["develops_from"][0]
    e["develops_from"].append([b, a])
expect("develops_from วนกลับถูกปฏิเสธ", with_change(dev_cycle, "edges", "blood-immune"), "develops_from วนกลับ")


def bad_review(d): d[0]["review"] = "maybe"
expect("review ที่ไม่รู้จักถูกปฏิเสธ", with_change(bad_review), "review ต้องเป็น")


def textbook_no_ref(d): d[0]["review"] = "textbook"
expect("textbook ที่มีแต่หมายเหตุ AI ถูกปฏิเสธ", with_change(textbook_no_ref), "แหล่งอ้างอิงตำรา")


def old_verified(d): d[0]["verified"] = True
expect("ช่อง verified แบบเก่าถูกปฏิเสธ", with_change(old_verified), "verified")

shutil.rmtree(tmp, ignore_errors=True)
print("\nOK" if not failures else "\nล้มเหลว %d ข้อ" % failures)
sys.exit(1 if failures else 0)

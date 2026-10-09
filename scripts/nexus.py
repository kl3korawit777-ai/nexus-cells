#!/usr/bin/env python3
"""Nexus · ใยเซลล์ — เครื่องมือหลักสำหรับตรวจ ดึง และรวมข้อมูล

คำสั่ง:
  python scripts/nexus.py validate
  python scripts/nexus.py fetch [--refresh] [--only CL:0000235,CL:0000576] [--sleep 0.2]
  python scripts/nexus.py build

ใช้ไลบรารีมาตรฐานของ Python เท่านั้น
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
GEN = os.path.join(DATA, "generated")
CACHE = os.path.join(GEN, "cache")
REPORTS = os.path.join(ROOT, "reports")
SITE_OUT = os.path.join(ROOT, "site", "data", "nexus.json")
CL_TERMS = os.path.join(GEN, "cl_terms.json")

OLS = "https://www.ebi.ac.uk/ols4/api"
OBO = "http://purl.obolibrary.org/obo/"
RO_DEVELOPS_FROM = OBO + "RO_0002202"
CL_RE = re.compile(r"^CL:\d{7}$")
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
KINDS = {"cell", "class"}
# ประเภทของเส้น interacts_with: ฮอร์โมน, ซินแนปส์, สนับสนุน, ภูมิคุ้มกัน, พาราไครน์
MODES = ("hormone", "synapse", "support", "immune", "paracrine")
IMAGE_REQUIRED = ("src", "credit", "license")
# ช่องที่ถ้าว่างจะแจ้งเป็นคำเตือน (เฉพาะ kind = cell) — secretes ว่างได้เพราะหลายเซลล์ไม่หลั่งสาร
CELL_FIELDS = [
    "location", "morphology", "function", "markers",
    "lifespan", "exam", "diseases", "confused_with",
]
CLASS_FIELDS = ["function"]


# ---------------------------------------------------------------- ช่วยเหลือ

def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj, indent=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
        f.write("\n")


def save_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def load_dataset():
    """โหลดข้อมูลต้นฉบับทั้งหมด คืนค่า dict"""
    systems = load_json(os.path.join(DATA, "systems.json"))
    tissues = load_json(os.path.join(DATA, "tissues.json"))
    cells = []
    for p in sorted(glob.glob(os.path.join(DATA, "cells", "*.json"))):
        file_id = os.path.splitext(os.path.basename(p))[0]
        for c in load_json(p):
            c["_file"] = file_id
            cells.append(c)
    edges = {}
    for p in sorted(glob.glob(os.path.join(DATA, "edges", "*.json"))):
        file_id = os.path.splitext(os.path.basename(p))[0]
        edges[file_id] = load_json(p)
    return {"systems": systems, "tissues": tissues, "cells": cells, "edges": edges}


def cell_label(c):
    return "%s (%s)" % (c.get("id", "?"), c.get("en") or c.get("slug") or "?")


def is_empty(v):
    return v is None or v == "" or v == [] or v == {}


# ------------------------------------------------------------------ validate

def run_validate(quiet=False):
    """คืนค่า (errors, warnings)"""
    ds = load_dataset()
    errors, warnings = [], []
    err = errors.append
    warn = warnings.append

    system_ids = set()
    for s in ds["systems"]:
        if s.get("id") in system_ids:
            err("ระบบ id ซ้ำ: %s" % s.get("id"))
        system_ids.add(s.get("id"))
        for k in ("id", "th", "en", "color", "summary", "organs"):
            if is_empty(s.get(k)):
                err("ระบบ %s ไม่มีช่อง %s" % (s.get("id"), k))
        if s.get("color") and not re.match(r"^#[0-9A-Fa-f]{6}$", s["color"]):
            err("ระบบ %s สี (color) ไม่ใช่รูปแบบ #RRGGBB" % s.get("id"))

    tissue_subtypes = {}
    for t in ds["tissues"]:
        if t.get("id") in tissue_subtypes:
            err("เนื้อเยื่อ id ซ้ำ: %s" % t.get("id"))
        tissue_subtypes[t.get("id")] = {st.get("id") for st in t.get("subtypes", [])}
        cls = t.get("cl_class")
        if cls is not None and not CL_RE.match(cls):
            err("เนื้อเยื่อ %s: cl_class รูปแบบไม่ถูกต้อง (%s)" % (t.get("id"), cls))
        for k in ("id", "th", "en", "color"):
            if is_empty(t.get(k)):
                err("เนื้อเยื่อ %s ไม่มีช่อง %s" % (t.get("id"), k))

    ids, slugs = {}, {}
    for c in ds["cells"]:
        cid = c.get("id")
        lab = cell_label(c)
        if not isinstance(cid, str) or not CL_RE.match(cid):
            err("%s: รูปแบบ CL ID ไม่ถูกต้อง" % lab)
        if cid in ids:
            err("%s: id ซ้ำกับรายการอื่น" % lab)
        ids[cid] = c
        slug = c.get("slug")
        if not isinstance(slug, str) or not SLUG_RE.match(slug):
            err("%s: slug ต้องเป็น kebab-case (ตัวพิมพ์เล็ก ตัวเลข และขีดกลาง)" % lab)
        if slug in slugs:
            err("%s: slug ซ้ำกับ %s" % (lab, slugs[slug]))
        slugs[slug] = cid
        if c.get("kind") not in KINDS:
            err("%s: kind ต้องเป็น \"cell\" หรือ \"class\"" % lab)
        for k in ("en", "th"):
            if is_empty(c.get(k)):
                err("%s: ไม่มีช่อง %s" % (lab, k))
        if is_empty(c.get("systems")):
            err("%s: ต้องมี systems อย่างน้อย 1 ระบบ" % lab)
        for s in c.get("systems") or []:
            if s not in system_ids:
                err("%s: ไม่มีระบบ \"%s\" ใน systems.json" % (lab, s))
        tis = c.get("tissue")
        if is_empty(tis):
            pass  # ไม่มี tissue: เป็นคำเตือนด้านล่าง และไปอยู่กลุ่ม other ในใยภาพรวม
        elif tis not in tissue_subtypes:
            err("%s: ไม่มีเนื้อเยื่อ \"%s\" ใน tissues.json" % (lab, tis))
        else:
            sub = c.get("tissue_subtype")
            if sub is not None and sub not in tissue_subtypes[tis]:
                err("%s: ไม่มี tissue_subtype \"%s\" ในเนื้อเยื่อ %s" % (lab, sub, tis))
        img = c.get("image")
        if img is not None:
            if not isinstance(img, dict):
                err("%s: image ต้องเป็น null หรือ object" % lab)
            else:
                for k in IMAGE_REQUIRED:
                    if is_empty(img.get(k)):
                        err("%s: รูปต้องมี %s" % (lab, k))

    # ตรวจการอ้างอิงข้ามเซลล์
    for c in ds["cells"]:
        lab = cell_label(c)
        for ref in c.get("confused_with") or []:
            if ref not in ids:
                err("%s: confused_with อ้างถึง %s ซึ่งไม่มีในชุดข้อมูล" % (lab, ref))
            elif ref == c.get("id"):
                err("%s: confused_with ชี้หาตัวเอง" % lab)

    for fid, e in ds["edges"].items():
        pairs = []
        for kind in ("develops_from", "is_a"):
            for item in e.get(kind, []):
                if not (isinstance(item, list) and len(item) == 2):
                    err("edges/%s: รายการ %s ต้องเป็นคู่ [ลูก, แม่]: %r" % (fid, kind, item))
                    continue
                pairs.append((kind, item[0], item[1]))
        for item in e.get("interacts_with", []):
            if not isinstance(item, dict) or "from" not in item or "to" not in item:
                err("edges/%s: interacts_with ต้องเป็น {from, to, th}: %r" % (fid, item))
                continue
            if is_empty(item.get("th")):
                warn("edges/%s: interacts_with %s→%s ไม่มีคำอธิบายไทย (th)" % (fid, item["from"], item["to"]))
            if item.get("mode") not in MODES:
                err("edges/%s: interacts_with %s→%s ต้องมี mode เป็นหนึ่งใน %s (พบ %r)"
                    % (fid, item["from"], item["to"], ", ".join(MODES), item.get("mode")))
            pairs.append(("interacts_with", item["from"], item["to"]))
        seen = set()
        for kind, a, b in pairs:
            for x in (a, b):
                if x not in ids:
                    err("edges/%s: %s อ้างถึง %s ซึ่งไม่มีในชุดข้อมูล" % (fid, kind, x))
            if a == b:
                err("edges/%s: %s ชี้หาตัวเอง (%s)" % (fid, kind, a))
            if (kind, a, b) in seen:
                err("edges/%s: เส้น %s %s→%s ซ้ำ" % (fid, kind, a, b))
            seen.add((kind, a, b))

    # คำเตือน: ช่องว่าง/ไม่มีรูป (หนึ่งบรรทัดต่อเซลล์)
    for c in ds["cells"]:
        fields = CELL_FIELDS if c.get("kind") == "cell" else CLASS_FIELDS
        missing = [k for k in fields if is_empty(c.get(k))]
        parts = []
        if is_empty(c.get("tissue")):
            missing.append("tissue")
        elif c.get("tissue_subtype") is None:
            missing.append("tissue_subtype")
        if missing:
            parts.append("ช่องว่าง: " + ", ".join(missing))
        if c.get("image") is None:
            parts.append("ยังไม่มีรูป")
        if parts:
            warn("%s: %s" % (cell_label(c), "; ".join(parts)))

    if not quiet:
        print("ตรวจข้อมูล: เซลล์/หมวด %d รายการ, ระบบ %d, เนื้อเยื่อ %d, ไฟล์เส้นใย %d"
              % (len(ds["cells"]), len(ds["systems"]), len(ds["tissues"]), len(ds["edges"])))
        if errors:
            print("\nข้อผิดพลาด (%d):" % len(errors))
            for m in errors:
                print("  ✗ " + m)
        if warnings:
            print("\nคำเตือน (%d):" % len(warnings))
            for m in warnings:
                print("  ! " + m)
        if not errors:
            print("\nผ่านการตรวจ (ไม่มีข้อผิดพลาด คำเตือน %d รายการ)" % len(warnings))
    return errors, warnings


def cmd_validate(args):
    errors, _ = run_validate()
    return 1 if errors else 0


# --------------------------------------------------------------------- fetch

def http_get_json(url, retries=3, timeout=30):
    """คืนค่า (status, json หรือ None)"""
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={
            "Accept": "application/json",
            "User-Agent": "nexus-cells/1.0 (educational project)",
        })
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 404, None
            last = "HTTP %s" % e.code
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = str(e)
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("เรียก %s ไม่สำเร็จ: %s" % (url, last))


def term_base(cl_id):
    iri = OBO + cl_id.replace(":", "_")
    # OLS ต้องการ IRI ที่เข้ารหัส URL สองรอบ
    enc = urllib.parse.quote(urllib.parse.quote(iri, safe=""), safe="")
    return "%s/ontologies/cl/terms/%s" % (OLS, enc), iri


def terms_of(js):
    return ((js or {}).get("_embedded") or {}).get("terms", [])


def short(t):
    return {"id": t.get("obo_id") or "", "label": t.get("label") or ""}


def fetch_one(cl_id, sleep):
    base, iri = term_base(cl_id)
    st, term = http_get_json(base)
    time.sleep(sleep)
    if st == 404 or not term:
        return {"id": cl_id, "found": False}
    defs = term.get("obo_definition_citation") or []
    definition = defs[0].get("definition", "") if defs else ""
    out = {
        "id": cl_id,
        "found": True,
        "iri": term.get("iri", iri),
        "label": term.get("label", ""),
        "definition": definition,
        "synonyms": term.get("synonyms") or [],
        "obsolete": bool(term.get("is_obsolete")),
        "replaced_by": term.get("term_replaced_by"),
        "parents": [],
        "ancestors": [],
        "develops_from": [],
    }
    if out["obsolete"]:
        return out
    links = term.get("_links", {})
    anc_url = (links.get("ancestors") or {}).get("href") or base + "/ancestors"
    par_url = (links.get("parents") or {}).get("href") or base + "/parents"
    dev_url = (links.get("develops_from") or {}).get("href") or \
        base + "/" + urllib.parse.quote(urllib.parse.quote(RO_DEVELOPS_FROM, safe=""), safe="")
    for key, url in (("ancestors", anc_url), ("parents", par_url), ("develops_from", dev_url)):
        sep = "&" if "?" in url else "?"
        s, js = http_get_json(url + sep + "size=500")
        time.sleep(sleep)
        out[key] = [short(t) for t in terms_of(js)] if s == 200 else []
    return out


def cache_path(cl_id):
    return os.path.join(CACHE, cl_id.replace(":", "_") + ".json")


def tissue_suggestions(term, cell, tissues):
    """เสนอ tissue จาก ancestors ที่ตรงกับ cl_class"""
    anc = {a["id"] for a in term.get("ancestors", [])}
    hits = [t["id"] for t in tissues if t.get("cl_class") and t["cl_class"] in anc]
    return hits


def cmd_fetch(args):
    ds = load_dataset()
    cells = ds["cells"]
    ids = [c["id"] for c in cells]
    if args.only:
        wanted = [x.strip() for x in args.only.split(",") if x.strip()]
        unknown = [x for x in wanted if x not in ids]
        if unknown:
            print("ไม่พบในชุดข้อมูล: " + ", ".join(unknown))
            return 1
        ids = wanted
    os.makedirs(CACHE, exist_ok=True)
    print("ดึงข้อมูลจาก OLS4 จำนวน %d รหัส" % len(ids))
    fetched = 0
    for i, cid in enumerate(ids, 1):
        p = cache_path(cid)
        if os.path.exists(p) and not args.refresh:
            print("  [%d/%d] %s ใช้ข้อมูลใน cache" % (i, len(ids), cid))
            continue
        try:
            t = fetch_one(cid, args.sleep)
        except RuntimeError as e:
            print("  [%d/%d] %s ล้มเหลว: %s" % (i, len(ids), cid, e))
            return 1
        save_json(p, t)
        fetched += 1
        print("  [%d/%d] %s %s" % (i, len(ids), cid, t.get("label") if t["found"] else "(ไม่พบ)"))

    # รวมทุกเซลล์ในชุดข้อมูลจาก cache
    terms, missing_cache = {}, []
    for c in cells:
        p = cache_path(c["id"])
        if os.path.exists(p):
            terms[c["id"]] = load_json(p)
        else:
            missing_cache.append(c["id"])
    save_json(CL_TERMS, {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "OLS4 / Cell Ontology",
        "terms": terms,
    })

    # รายงาน
    problems, notes, no_tissue = [], [], []
    tissue_by_id = {t["id"]: t for t in ds["tissues"]}
    for c in cells:
        t = terms.get(c["id"])
        if t is None:
            continue
        lab = cell_label(c)
        if not t["found"]:
            problems.append("- **ไม่พบรหัส** %s: ไม่พบใน CL" % lab)
            continue
        if t["obsolete"]:
            rep = t.get("replaced_by")
            rep = (" (แทนที่ด้วย %s)" % rep) if rep else ""
            problems.append("- **ถูกยกเลิก** %s: เป็นรหัสที่ถูกยกเลิกแล้ว%s" % (lab, rep))
            continue
        names = {t["label"].lower()} | {s.lower() for s in t["synonyms"]}
        if c["en"].lower() not in names:
            problems.append("- **ชื่อไม่ตรง** %s: label ใน CL คือ \"%s\" (synonyms: %s)" % (
                lab, t["label"], ", ".join(t["synonyms"]) or "ไม่มี"))
        elif c["en"].lower() != t["label"].lower():
            notes.append("- %s: en ตรงกับ synonym ไม่ใช่ label หลัก (label ใน CL คือ \"%s\")" % (lab, t["label"]))
        sug = tissue_suggestions(t, c, ds["tissues"])
        if sug and c.get("tissue") not in sug:
            problems.append("- **tissue ต่างจาก CL** %s: ตั้งไว้ \"%s\" แต่ ancestors ใน CL ชี้ไป %s" % (
                lab, c.get("tissue"), ", ".join(sug)))
        elif not sug:
            no_tissue.append(c["id"])

    if no_tissue:
        notes.append("- ancestors ใน CL ของ %d รหัสไม่ตรงกับ cl_class ของเนื้อเยื่อใดเลย จึงใช้ tissue ตามที่คัดเอง "
                     "(เซลล์เม็ดเลือดใน CL ไม่ได้อยู่ใต้ \"connective tissue cell\" โดยตรง): %s"
                     % (len(no_tissue), ", ".join(no_tissue)))
    lines = [
        "# รายงานการดึงข้อมูล (fetch)", "",
        "สร้างเมื่อ: %s" % datetime.now().strftime("%Y-%m-%d %H:%M"),
        "ดึงใหม่ %d รหัส จากทั้งหมด %d รหัสในชุดข้อมูล" % (fetched, len(cells)), "",
        "## ปัญหาที่ต้องตรวจ (%d)" % len(problems), "",
    ]
    lines += problems or ["ไม่พบปัญหา"]
    lines += ["", "## หมายเหตุ (%d)" % len(notes), ""]
    lines += notes or ["ไม่มี"]
    if missing_cache:
        lines += ["", "## ยังไม่ได้ดึง", ""] + ["- " + x for x in missing_cache]
    save_text(os.path.join(REPORTS, "fetch-report.md"), "\n".join(lines) + "\n")
    print("\nเขียน reports/fetch-report.md แล้ว: ปัญหา %d, หมายเหตุ %d" % (len(problems), len(notes)))
    for p in problems:
        print("  " + p)
    return 0


# --------------------------------------------------------------------- build

def transitive_reduction(parents_of):
    """parents_of: {node: set(ancestors ภายในชุด)} -> {node: set(parent โดยตรงหลังลดขั้น)}"""
    reduced = {}
    for n, ancs in parents_of.items():
        keep = set(ancs)
        for a in ancs:
            for b in ancs:
                if a != b and a in parents_of.get(b, set()):
                    keep.discard(a)
        reduced[n] = keep
    return reduced


def cmd_build(args):
    errors, warnings = run_validate(quiet=True)
    if errors:
        print("ข้อมูลมีข้อผิดพลาด %d รายการ ยกเลิกการรวมข้อมูล:" % len(errors))
        for m in errors:
            print("  ✗ " + m)
        return 1
    print("ตรวจข้อมูลผ่าน (คำเตือน %d รายการ)" % len(warnings))

    ds = load_dataset()
    cl = load_json(CL_TERMS)["terms"] if os.path.exists(CL_TERMS) else {}
    if not cl:
        print("ยังไม่มี data/generated/cl_terms.json (รัน fetch ก่อน) — จะรวมข้อมูลโดยไม่มีข้อมูลจาก CL")

    cells_out = []
    for c in ds["cells"]:
        o = {k: v for k, v in c.items() if not k.startswith("_")}
        t = cl.get(c["id"])
        o["purl"] = OBO + c["id"].replace(":", "_")
        if t and t.get("found"):
            o["cl"] = {
                "label": t["label"],
                "definition": t["definition"],
                "synonyms": t["synonyms"],
                "obsolete": t["obsolete"],
            }
        else:
            o["cl"] = None
        cells_out.append(o)

    edges_out = []
    for fid, e in ds["edges"].items():
        for kind in ("develops_from", "is_a"):
            for child, parent in e.get(kind, []):
                edges_out.append({"type": kind, "from": child, "to": parent, "source": "curated", "file": fid})
        for it in e.get("interacts_with", []):
            edges_out.append({"type": "interacts_with", "from": it["from"], "to": it["to"],
                              "th": it.get("th", ""), "mode": it.get("mode"), "source": "curated", "file": fid})

    save_json(SITE_OUT, {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "ontology": "Cell Ontology (CL), CC BY 4.0",
            "edge_direction": "develops_from/is_a: from=ลูก to=แม่; interacts_with: from=ผู้กระทำ to=ผู้ถูกกระทำ",
        },
        "systems": ds["systems"],
        "tissues": ds["tissues"],
        "cells": cells_out,
        "edges": edges_out,
    }, indent=1)
    print("เขียน site/data/nexus.json: เซลล์/หมวด %d, เส้นใย %d" % (len(cells_out), len(edges_out)))

    write_build_report(ds, cl, edges_out, warnings)
    run_layout()
    return 0


def run_layout():
    """คำนวณตำแหน่งใยภาพรวมล่วงหน้าด้วย Node (scripts/layout.mjs) ถ้าไม่มี Node แจ้งเตือนแต่ไม่หยุด"""
    node = shutil.which("node")
    if not node:
        print("! ไม่พบ Node.js จึงข้ามการคำนวณตำแหน่งใยภาพรวม (เว็บจะคำนวณในเบราว์เซอร์แทน และช้ากว่า) ติดตั้ง Node.js แล้วรัน build ใหม่")
        return
    if not os.path.isdir(os.path.join(ROOT, "node_modules", "cytoscape-fcose")):
        print("! ยังไม่ได้ติดตั้งแพ็กเกจของ Node จึงข้ามการคำนวณตำแหน่ง รัน `npm install` ในโฟลเดอร์โปรเจกต์ก่อน แล้วรัน build ใหม่")
        return
    r = subprocess.run([node, os.path.join(ROOT, "scripts", "layout.mjs")], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        print("! คำนวณตำแหน่งใยภาพรวมไม่สำเร็จ (เว็บจะคำนวณในเบราว์เซอร์แทน):")
        print((r.stderr or r.stdout).strip()[-600:])
        return
    print(r.stdout.strip())


def write_build_report(ds, cl, edges_out, warnings):
    ids = {c["id"]: c for c in ds["cells"]}
    name = lambda i: "%s %s" % (i, ids[i]["en"]) if i in ids else i
    L = ["# รายงานการรวมข้อมูล (build)", "",
         "สร้างเมื่อ: %s" % datetime.now().strftime("%Y-%m-%d %H:%M"), ""]
    if not cl:
        L += ["ไม่มีข้อมูลจาก CL (ยังไม่ได้รัน fetch) จึงไม่มีการเทียบเส้นใย", ""]
        save_text(os.path.join(REPORTS, "build-report.md"), "\n".join(L))
        return

    # ----- is_a
    cur_isa = {(e["from"], e["to"]) for e in edges_out if e["type"] == "is_a"}
    anc_in = {}
    for cid in ids:
        t = cl.get(cid)
        if t and t.get("found"):
            anc_in[cid] = {a["id"] for a in t["ancestors"] if a["id"] in ids}
        else:
            anc_in[cid] = set()
    cl_red = transitive_reduction(anc_in)
    cl_isa = {(c, p) for c, ps in cl_red.items() for p in ps}

    same = sorted(cur_isa & cl_isa)
    skip = sorted(p for p in cur_isa - cl_isa if p[1] in anc_in.get(p[0], set()))
    conflict = sorted(p for p in cur_isa - cl_isa if p[1] not in anc_in.get(p[0], set()))
    missing = sorted(cl_isa - cur_isa)

    L += ["## is_a: เส้นที่คัดเอง เทียบกับ CL (หลัง transitive reduction ภายในชุดข้อมูล)", "",
          "- ตรงกัน: %d เส้น" % len(same),
          "- คัดเองมี และเป็นบรรพบุรุษใน CL แต่ข้ามขั้น: %d เส้น" % len(skip),
          "- คัดเองมี แต่ CL ไม่มีความสัมพันธ์นี้เลย: %d เส้น" % len(conflict),
          "- CL มี แต่ไม่ได้คัดไว้: %d เส้น" % len(missing), ""]
    def sec(title, items, note=""):
        if not items:
            return
        L.append("### " + title)
        if note:
            L.append(note)
        L.append("")
        for c, p in items:
            L.append("- %s → %s" % (name(c), name(p)))
        L.append("")
    sec("is_a ที่คัดเองข้ามขั้น", skip, "ถูกตามความหมาย แต่ใน CL มีตัวกลางอยู่ระหว่างสองรหัสนี้ในชุดข้อมูล")
    sec("is_a ที่คัดเองแต่ CL ไม่มี", conflict, "ควรตรวจว่าตำราหรือ CL ถูก")
    sec("is_a ที่ CL มีแต่ไม่ได้คัดไว้", missing)

    # ----- develops_from
    cur_df = {(e["from"], e["to"]) for e in edges_out if e["type"] == "develops_from"}
    cl_df, outside, non_cl = set(), [], 0
    for cid in ids:
        t = cl.get(cid)
        if not t or not t.get("found"):
            continue
        for p in t["develops_from"]:
            # OLS คืนเทอมอื่นที่อยู่ในนิยามเชิงตรรกะด้วย (เช่น GO, PR, PATO) นับเฉพาะเซลล์ใน CL
            if not p["id"].startswith("CL:"):
                non_cl += 1
                continue
            if p["id"] in ids:
                cl_df.add((cid, p["id"]))
            else:
                outside.append((cid, p))
    df_same = sorted(cur_df & cl_df)
    df_cur_only = sorted(cur_df - cl_df)
    df_cl_only = sorted(cl_df - cur_df)
    L += ["## develops_from: เส้นที่คัดเอง เทียบกับ CL", "",
          "- ตรงกัน: %d เส้น" % len(df_same),
          "- คัดเองมี แต่ CL ไม่มี: %d เส้น" % len(df_cur_only),
          "- CL มี (ในชุดข้อมูล) แต่ไม่ได้คัดไว้: %d เส้น" % len(df_cl_only),
          "- CL ชี้ไปเซลล์นอกชุดข้อมูล: %d เส้น" % len(outside), "",
          "หมายเหตุ: OLS คืนเทอมที่ไม่ใช่เซลล์ (GO, PR, PATO ฯลฯ) มาด้วย รวม %d รายการ ไม่นับในการเทียบ" % non_cl, ""]
    sec("develops_from ที่คัดเองแต่ CL ไม่มี", df_cur_only)
    sec("develops_from ที่ CL มีแต่ไม่ได้คัดไว้", df_cl_only)
    if outside:
        L += ["### develops_from ที่ CL ชี้ไปเซลล์นอกชุดข้อมูล", ""]
        for cid, p in sorted(outside, key=lambda x: (x[0], x[1]["id"])):
            L.append("- %s ← %s %s" % (name(cid), p["id"], p["label"]))
        L.append("")

    L += ["## คำเตือนจาก validate (%d)" % len(warnings), ""]
    L += ["- " + w for w in warnings] or ["ไม่มี"]
    save_text(os.path.join(REPORTS, "build-report.md"), "\n".join(L) + "\n")
    print("เขียน reports/build-report.md แล้ว")
    print("  is_a: ตรงกัน %d, ข้ามขั้น %d, ไม่มีใน CL %d, ขาด %d" % (len(same), len(skip), len(conflict), len(missing)))
    print("  develops_from: ตรงกัน %d, คัดเองอย่างเดียว %d, CL อย่างเดียว %d, ชี้นอกชุด %d" % (
        len(df_same), len(df_cur_only), len(df_cl_only), len(outside)))


# ---------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description="Nexus · ใยเซลล์ — เครื่องมือจัดการข้อมูล")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("validate", help="ตรวจความถูกต้องของข้อมูล").set_defaults(fn=cmd_validate)
    f = sub.add_parser("fetch", help="ดึงข้อมูลจาก OLS4 (Cell Ontology)")
    f.add_argument("--refresh", action="store_true", help="ดึงใหม่แม้มี cache")
    f.add_argument("--only", help="ดึงเฉพาะ CL ID ที่ระบุ คั่นด้วยจุลภาค")
    f.add_argument("--sleep", type=float, default=0.2, help="หน่วงเวลาระหว่างคำขอ (วินาที)")
    f.set_defaults(fn=cmd_fetch)
    sub.add_parser("build", help="รวมข้อมูลเป็น site/data/nexus.json").set_defaults(fn=cmd_build)
    args = ap.parse_args()
    sys.exit(args.fn(args))


if __name__ == "__main__":
    main()

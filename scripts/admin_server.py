#!/usr/bin/env python3
"""เซิร์ฟเวอร์ local สำหรับหน้าแอดมิน (adapter แบบ local) ใช้พัฒนาและทดสอบบนเครื่องเท่านั้น

  python scripts/admin_server.py [--port 8765] [--root โฟลเดอร์โปรเจกต์]

แล้วเปิด http://127.0.0.1:8765/admin/ (เลือก "ใช้ adapter local")

ความปลอดภัย:
  - รับเฉพาะ 127.0.0.1 และตรวจ Host header (กัน DNS rebinding)
  - เขียนได้เฉพาะใน data/ (ไฟล์ .json) และ site/images/ (ไฟล์รูป) ห้ามออกนอกโฟลเดอร์
  - API ทุกตัวต้องมี header X-Nexus-Admin (เว็บอื่นส่งข้ามโดเมนไม่ได้เพราะต้องผ่าน preflight ซึ่งไม่ตอบรับ)
หลัง commit จะรัน nexus.py validate และ build ให้ ดูผลที่ /api/status
ใช้ไลบรารีมาตรฐานของ Python เท่านั้น
"""

import argparse
import base64
import hashlib
import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRITE_ROOTS = ("data/", "site/images/")
IMAGE_EXTS = (".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif")
MAX_FILE = 15 * 1024 * 1024
SKIP_DIRS = {"cache", "_originals"}

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("image/webp", ".webp")

STATE = {"seq": 0, "results": {}, "lock": threading.Lock(), "root": ROOT, "port": 0}


def blob_sha(data):
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def safe_rel(p):
    """คืนพาธใน repo ที่อนุญาตให้เขียน หรือ None"""
    if not isinstance(p, str) or "\\" in p or p.startswith("/") or ".." in p.split("/") or "//" in p:
        return None
    if not p.startswith(WRITE_ROOTS):
        return None
    if p.startswith("data/") and not p.endswith(".json"):
        return None
    if p.startswith("site/images/") and not p.lower().endswith(IMAGE_EXTS):
        return None
    if "/_originals/" in p or "/cache/" in p:
        return None
    return p


def tree():
    files = {}
    root = STATE["root"]
    for top in ("data", os.path.join("site", "images")):
        for base, dirs, names in os.walk(os.path.join(root, top)):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for n in names:
                full = os.path.join(base, n)
                rel = os.path.relpath(full, root).replace("\\", "/")
                if not rel.startswith(WRITE_ROOTS) or n == ".gitkeep":
                    continue
                with open(full, "rb") as f:
                    files[rel] = blob_sha(f.read())
    return files


def run_checks(commit_id):
    """รัน validate แล้ว build เก็บผลไว้ให้ /api/status"""
    root = STATE["root"]
    py = sys.executable
    script = os.path.join(root, "scripts", "nexus.py")
    log = []
    ok = True
    for step in ("validate", "build"):
        r = subprocess.run([py, script, step], cwd=root, capture_output=True, text=True, encoding="utf-8")
        out = (r.stdout or "") + (r.stderr or "")
        log.append("$ nexus.py %s -> exit %d\n%s" % (step, r.returncode, out[-1500:]))
        if r.returncode != 0:
            ok = False
            break
    with STATE["lock"]:
        STATE["results"][commit_id] = {
            "state": "success" if ok else "failure",
            "error": "" if ok else "\n".join(log)[-1800:],
            "log": "\n".join(log)[-3000:],
        }


class Handler(BaseHTTPRequestHandler):
    server_version = "NexusAdmin/1"

    def log_message(self, fmt, *args):
        sys.stderr.write("[admin] " + (fmt % args) + "\n")

    def host_ok(self):
        host = (self.headers.get("Host") or "").lower()
        return host in ("127.0.0.1:%d" % STATE["port"], "localhost:%d" % STATE["port"], "127.0.0.1", "localhost")

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def deny(self, status=403, msg="forbidden"):
        self.send_json({"error": msg}, status)

    # ---------------------------------------------------------------- GET
    def do_GET(self):
        if not self.host_ok():
            return self.deny()
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            if self.headers.get("X-Nexus-Admin") != "1":
                return self.deny()
            return self.api_get(u)
        return self.static(u.path)

    def api_get(self, u):
        q = parse_qs(u.query)
        if u.path == "/api/ping":
            return self.send_json({"ok": True})
        if u.path == "/api/tree":
            return self.send_json({"head": "local", "files": tree()})
        if u.path == "/api/file":
            rel = (q.get("path") or [""])[0]
            p = rel if rel in ("data/generated/cl_terms.json",) else safe_rel(rel)
            if not p:
                return self.deny(400, "bad path")
            full = os.path.join(STATE["root"], p)
            if not os.path.isfile(full):
                return self.deny(404, "not found")
            with open(full, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if u.path == "/api/status":
            cid = (q.get("id") or [""])[0]
            with STATE["lock"]:
                r = STATE["results"].get(cid)
            return self.send_json(r or {"state": "running"})
        if u.path == "/api/history":
            return self.send_json([])
        return self.deny(404, "not found")

    def static(self, path):
        root = os.path.join(STATE["root"], "site")
        rel = unquote(path).lstrip("/") or "index.html"
        full = os.path.normpath(os.path.join(root, rel))
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not full.startswith(root + os.sep) or not os.path.isfile(full):
            return self.deny(404, "not found")
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", (mimetypes.guess_type(full)[0] or "application/octet-stream") + ("; charset=utf-8" if full.endswith((".html", ".js", ".css", ".json")) else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    # --------------------------------------------------------------- POST
    def do_POST(self):
        if not self.host_ok() or self.headers.get("X-Nexus-Admin") != "1":
            return self.deny()
        u = urlparse(self.path)
        if u.path != "/api/commit":
            return self.deny(404, "not found")
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 120 * 1024 * 1024:
                return self.deny(413, "too large")
            body = json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self.deny(400, "bad json")
        files = body.get("files")
        if not isinstance(files, list) or not files:
            return self.deny(400, "no files")
        root = STATE["root"]
        writes = []
        for item in files:
            rel = safe_rel(item.get("path"))
            if not rel:
                return self.deny(400, "bad path: %s" % item.get("path"))
            content = item.get("content")
            data = None
            if content is not None:
                try:
                    data = base64.b64decode(content, validate=True)
                except ValueError:
                    return self.deny(400, "bad content")
                if len(data) > MAX_FILE:
                    return self.deny(413, "file too large: %s" % rel)
            writes.append((rel, data))
        # ป้องกันการเขียนทับ: sha ของไฟล์ตอนนี้ต้องตรงกับที่แอดมินโหลดไป
        conflicts = []
        for rel, expect in (body.get("expected") or {}).items():
            if safe_rel(rel) is None:
                return self.deny(400, "bad path: %s" % rel)
            full = os.path.join(root, rel)
            cur = None
            if os.path.isfile(full):
                with open(full, "rb") as f:
                    cur = blob_sha(f.read())
            if cur != expect:
                conflicts.append(rel)
        if conflicts:
            return self.send_json({"conflicts": conflicts}, 409)
        tmp_files = []
        try:
            for rel, data in writes:
                if data is None:
                    continue
                full = os.path.join(root, rel)
                os.makedirs(os.path.dirname(full), exist_ok=True)
                tmp = full + ".tmp-admin"
                with open(tmp, "wb") as f:
                    f.write(data)
                tmp_files.append((tmp, full))
            for tmp, full in tmp_files:
                os.replace(tmp, full)
            for rel, data in writes:
                if data is None:
                    full = os.path.join(root, rel)
                    if os.path.isfile(full):
                        os.remove(full)
                        d = os.path.dirname(full)
                        keep = {os.path.join(root, "data"), os.path.join(root, "site", "images")}
                        while d not in keep and os.path.isdir(d) and not os.listdir(d):
                            os.rmdir(d)
                            d = os.path.dirname(d)
        finally:
            for tmp, _ in tmp_files:
                if os.path.exists(tmp):
                    os.remove(tmp)
        with STATE["lock"]:
            STATE["seq"] += 1
            cid = "local-%d-%d" % (int(time.time()), STATE["seq"])
            STATE["results"][cid] = {"state": "running"}
        print("[admin] commit %s: %s (%d ไฟล์)" % (cid, body.get("message", ""), len(writes)))
        threading.Thread(target=run_checks, args=(cid,), daemon=True).start()
        return self.send_json({"id": cid})


class Server(ThreadingHTTPServer):
    request_queue_size = 128  # ค่าตั้งต้น 5 ทำให้ Windows ปฏิเสธการเชื่อมต่อเมื่อหน้าเว็บขอไฟล์พร้อมกันหลายไฟล์
    daemon_threads = True


def make_server(root, port):
    STATE["root"] = os.path.abspath(root)
    srv = Server(("127.0.0.1", port), Handler)
    STATE["port"] = srv.server_address[1]
    return srv


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--root", default=ROOT, help="โฟลเดอร์โปรเจกต์ที่จะอ่านเขียน (ค่าตั้งต้นคือโปรเจกต์นี้)")
    args = ap.parse_args()
    srv = make_server(args.root, args.port)
    print("แอดมิน (local): http://127.0.0.1:%d/admin/   โฟลเดอร์: %s   (Ctrl+C เพื่อหยุด)" % (STATE["port"], STATE["root"]), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

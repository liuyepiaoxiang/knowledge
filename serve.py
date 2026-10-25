# -*- coding: utf-8 -*-
"""serve.py — 知识大地 本地服务 (静态站点 + 策展工作台 API)
用法: python serve.py [端口=8123]
端点:
  GET  /api2/stats                 版次/待策展数/待判读数
  GET  /api2/pending?domain=&limit=  待策展节点列表 (C级)
  GET  /api2/pairs?limit=           待判读共现对 (含证据句)
  POST /api2/promote  {ids:[...]}  复核 C→B
  POST /api2/reject   {id}         标记剔除候选
  POST /api2/semantic  {zh1,zh2,type,weight}  type=DROP 为删除
  POST /api2/export                重新导出全量图
其余路径 = 静态文件 (index.html 等)
"""
import json, os, sqlite3, subprocess, sys, threading
from contextlib import closing
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB = "atlas.db"
_WRITE_LOCK = threading.Lock()

def db(path=DB):
    con = sqlite3.connect(path, timeout=15)
    con.row_factory = sqlite3.Row
    return con

def rows(cur):
    return [dict(r) for r in cur.fetchall()]

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.startswith("/api2/"):
            try:
                self.api2_get(u)
            except Exception as e:
                self._json({"error": str(e)}, 500)
            return
        super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path.startswith("/api2/"):
            try:
                self.api2_post(u, self._body())
            except Exception as e:
                self._json({"error": str(e)}, 500)
            return
        self.send_error(404)

    def api2_get(self, u):
        q = parse_qs(u.query)
        try:
            with closing(db()) as con, con:
                cur = con.cursor()
                if u.path == "/api2/stats":
                    c = dict(cur.execute("""SELECT
                        (SELECT COUNT(*) FROM nodes) nodes,
                        (SELECT COUNT(*) FROM edges) edges,
                        (SELECT COUNT(*) FROM nodes n JOIN evidence v ON n.id=v.node_id WHERE v.grade='C') pending,
                        (SELECT COUNT(*) FROM evidence WHERE grade IN ('A','B')) reviewed,
                        (SELECT COUNT(*) FROM edges WHERE type='relates_to') relates,
                        (SELECT value FROM meta WHERE key='edition') edition""").fetchone())
                    self._json(c); return
                if u.path == "/api2/pending":
                    dom = (q.get("domain", [""])[0] or "").strip()
                    limit = int(q.get("limit", ["30"])[0])
                    where = "AND (d.id=? OR d.zh=?)" if dom else ""
                    args = (dom, dom) if dom else ()
                    out = rows(cur.execute(f"""SELECT n.id,n.zh,n.type,n.born,n.confidence,n.one_liner,d.zh dzh
                        FROM nodes n JOIN evidence v ON n.id=v.node_id JOIN domains d ON n.domain=d.id
                        WHERE v.grade='C' {where} ORDER BY n.confidence LIMIT ?""", (*args, limit)))
                    self._json(out); return
                if u.path == "/api2/pairs":
                    limit = int(q.get("limit", ["30"])[0])
                    out = rows(cur.execute(f"""
                        SELECT e.src, a.zh zha, a.type ta, e.dst, b.zh zbb, b.type tb,
                            COALESCE(x.sentence,'') ctx, COALESCE(x.article,'') article
                        FROM edges e
                        JOIN nodes a ON e.src=a.id JOIN nodes b ON e.dst=b.id
                        LEFT JOIN edge_context x ON (x.src=e.src AND x.dst=e.dst) OR (x.src=e.dst AND x.dst=e.src)
                        WHERE e.type='relates_to'
                          AND a.type!='Domain' AND b.type!='Domain'
                          AND (SELECT grade FROM evidence WHERE node_id=e.src LIMIT 1)='C'
                          AND (SELECT grade FROM evidence WHERE node_id=e.dst LIMIT 1)='C'
                        ORDER BY (a.degree+b.degree) DESC LIMIT ?""", (limit,)))
                    self._json(out); return
            self._json({"error": "unknown endpoint"}, 404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    def api2_post(self, u, body):
        try:
            with _WRITE_LOCK, closing(db()) as con, con:
                cur = con.cursor()
                if u.path == "/api2/promote":
                    today = __import__("datetime").date.today().isoformat()
                    for nid in body.get("ids", []):
                        rid = cur.execute("SELECT id FROM nodes WHERE id=? OR zh=?", (nid, nid)).fetchone()
                        if not rid: continue
                        cur.execute("""UPDATE evidence SET grade='B',
                            source=source || ' | 人工复核 ' || ? WHERE node_id=? AND grade='C'""", (today, rid["id"]))
                        cur.execute("UPDATE nodes SET confidence=0.9 WHERE id=?", (rid["id"],))
                    con.commit()
                    self._json({"ok": True}); return
                if u.path == "/api2/reject":
                    nid = body.get("id")
                    rid = cur.execute("SELECT id FROM nodes WHERE id=? OR zh=?", (nid, nid)).fetchone()
                    if rid:
                        cur.execute("UPDATE nodes SET status='剔除候选' WHERE id=?", (rid["id"],))
                        con.commit()
                    self._json({"ok": True}); return
                if u.path == "/api2/semantic":
                    z1, z2 = body.get("zh1"), body.get("zh2")
                    typ, w = body.get("type", "relates_to"), float(body.get("weight", 0.5))
                    r1 = cur.execute("SELECT id FROM nodes WHERE zh=?", (z1,)).fetchone()
                    r2 = cur.execute("SELECT id FROM nodes WHERE zh=?", (z2,)).fetchone()
                    if not r1 or not r2: self._json({"error": "未解析概念"}, 404); return
                    i1, i2 = r1["id"], r2["id"]
                    hit = c.execute if False else None
                    hit = cur.execute("""SELECT rowid FROM edges WHERE type='relates_to'
                        AND ((src=? AND dst=?) OR (src=? AND dst=?))""", (i1, i2, i2, i1)).fetchone()
                    if typ == "DROP":
                        if hit:
                            cur.execute("DELETE FROM edges WHERE rowid=?", (hit["rowid"],))
                            cur.execute("UPDATE nodes SET degree=degree-1 WHERE id IN (?,?)", (i1, i2))
                    else:
                        if hit:
                            cur.execute("DELETE FROM edges WHERE rowid=?", (hit["rowid"],))
                        else:
                            ex = cur.execute("""SELECT rowid FROM edges WHERE type=? AND
                                ((src=? AND dst=?) OR (src=? AND dst=?))""", (typ, i1, i2, i2, i1)).fetchone()
                            if ex: self._json({"ok": True, "note": "同类型边已存在"}); return
                        cur.execute("INSERT INTO edges VALUES (?,?,?,?,?)", (i1, i2, typ, w, None))
                        cur.execute("UPDATE nodes SET degree=degree+1 WHERE id IN (?,?)", (i1, i2))
                    con.commit()
                    self._json({"ok": True}); return
                if u.path == "/api2/export":
                    with _WRITE_LOCK:
                        pass
                    r = subprocess.run([sys.executable, "export.py"], capture_output=True, text=True,
                                       encoding="utf-8")
                    out = (r.stdout or "").strip().splitlines()
                    self._json({"ok": r.returncode == 0, "report": out[-2:] if out else []}); return
            self._json({"error": "unknown endpoint"}, 404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or ".")
    print(f"知识大地本地服务: http://127.0.0.1:{port}/  (策展台: #/curate)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()

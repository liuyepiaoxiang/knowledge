# -*- coding: utf-8 -*-
"""build_db.py — 知识大地 SQLite 存储层
管线: data/seed.js --(node scripts/build-api.mjs)--> api/*.json --(python build_db.py)--> atlas.db
atlas.db 是查询与分析层(万级节点后前端切片也从这里导出); data.js 仍是人工策展的源。
运行: python build_db.py
"""
import json, os, sqlite3, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

def load(fn):
    with open(os.path.join("api", fn), encoding="utf-8") as f:
        return json.load(f)

def main():
    meta = load("meta.json")
    nodes = load("nodes.json")
    edges = load("edges.json")
    stories = load("stories.json")
    domains = meta["domains"]

    if os.path.exists("atlas.db"):
        os.remove("atlas.db")
    con = sqlite3.connect("atlas.db")
    cur = con.cursor()
    cur.executescript("""
    PRAGMA journal_mode = WAL;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE domains (
        id   TEXT PRIMARY KEY,
        zh   TEXT NOT NULL,
        en   TEXT,
        ord  INTEGER NOT NULL
    );
    CREATE TABLE nodes (
        id         TEXT PRIMARY KEY,
        type       TEXT NOT NULL,
        zh         TEXT NOT NULL,
        en         TEXT,
        domain     TEXT REFERENCES domains(id),
        born       INTEGER,
        died       INTEGER,          -- 被推翻/失效的年份(化石节点)
        one_liner  TEXT NOT NULL,
        why        TEXT,
        example    TEXT,
        status     TEXT,
        tradition  TEXT,
        confidence REAL,
        degree     INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE evidence (
        node_id TEXT NOT NULL REFERENCES nodes(id),
        grade   TEXT NOT NULL,        -- A 权威文献 / B 专家共识 / C 自动 / D 推测
        source  TEXT NOT NULL
    );
    CREATE TABLE edges (
        src    TEXT NOT NULL REFERENCES nodes(id),
        dst    TEXT NOT NULL REFERENCES nodes(id),
        type   TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 0.5,
        since  INTEGER
    );
    CREATE TABLE story_steps (
        story_id  TEXT NOT NULL,
        story_zh  TEXT NOT NULL,
        story_desc TEXT,
        step      INTEGER NOT NULL,
        node_id   TEXT REFERENCES nodes(id),
        text      TEXT NOT NULL,
        PRIMARY KEY (story_id, step)
    );
    CREATE INDEX idx_nodes_domain ON nodes(domain);
    CREATE INDEX idx_nodes_type   ON nodes(type);
    CREATE INDEX idx_nodes_born   ON nodes(born);
    CREATE INDEX idx_edges_src  ON edges(src);
    CREATE INDEX idx_edges_dst  ON edges(dst);
    CREATE INDEX idx_edges_type ON edges(type);
    CREATE INDEX idx_evidence_node ON evidence(node_id);
    """)

    cur.executemany("INSERT INTO domains VALUES (?,?,?,?)",
                    [(d["id"], d["zh"], d["en"], i) for i, d in enumerate(domains)])
    cur.executemany(
        "INSERT INTO nodes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(n["id"], n["t"], n["zh"], n.get("en"), n.get("dom"), n.get("born"), n.get("died"),
          n["one"], n.get("why"), n.get("ex"), n.get("status"), n.get("tr"), n.get("conf", 0.5),
          n.get("degree", 0)) for n in nodes])
    ev_rows = []
    for n in nodes:
        ev = n.get("ev") or []
        for i in range(0, len(ev), 2):
            ev_rows.append((n["id"], ev[i], ev[i + 1] if i + 1 < len(ev) else ""))
    cur.executemany("INSERT INTO evidence VALUES (?,?,?)", ev_rows)
    cur.executemany("INSERT INTO edges VALUES (?,?,?,?,?)",
                    [(e["from"], e["to"], e["type"], e["weight"], e["since"]) for e in edges])
    cur.executemany("INSERT INTO story_steps VALUES (?,?,?,?,?,?)",
                    [(s["id"], s["zh"], s["desc"], i, st["id"], st["text"])
                     for s in stories for i, st in enumerate(s["steps"])])
    cur.executemany("INSERT INTO meta VALUES (?,?)", [
        ("name", meta["name"]), ("edition", meta["edition"]),
        ("generated", meta["generated"]),
        ("nodes", str(len(nodes))), ("edges", str(len(edges))),
        ("built_at", datetime.date.today().isoformat()),
        ("license", meta["license"]),
    ])

    # ---- 完整性校验 ----
    problems = []
    orphan = cur.execute("""SELECT COUNT(*) FROM edges e
        WHERE e.src NOT IN (SELECT id FROM nodes) OR e.dst NOT IN (SELECT id FROM nodes)""").fetchone()[0]
    if orphan: problems.append(f"悬空边 {orphan} 条")
    dangling_ev = cur.execute("""SELECT COUNT(*) FROM evidence v
        WHERE v.node_id NOT IN (SELECT id FROM nodes)""").fetchone()[0]
    if dangling_ev: problems.append(f"悬空证据 {dangling_ev} 条")
    no_domain = cur.execute("""SELECT COUNT(*) FROM nodes WHERE type != 'Domain'
        AND domain IS NULL""").fetchone()[0]
    if no_domain: problems.append(f"缺域归属节点 {no_domain} 个")
    multi_ev = cur.execute("""SELECT COUNT(*) FROM (SELECT node_id FROM evidence GROUP BY node_id HAVING COUNT(*)>1)""").fetchone()[0]
    # 连通性(忽略事件/人物叶节点)
    node_ids = {n["id"] for n in nodes}
    skip = {n["id"] for n in nodes if n["t"] in ("Event", "Person")}
    adj = {}
    for e in edges:
        adj.setdefault(e["from"], set()).add(e["to"])
        adj.setdefault(e["to"], set()).add(e["from"])
    start = next(n["id"] for n in nodes if n["id"] not in skip)
    seen, stack = {start}, [start]
    while stack:
        c = stack.pop()
        for nb in adj.get(c, ()):
            if nb not in seen and nb not in skip:
                seen.add(nb); stack.append(nb)
    main_nodes = {n["id"] for n in nodes} - skip
    off = main_nodes - seen
    if off: problems.append(f"主图脱离组件: {sorted(off)}")

    con.commit()
    stats = cur.execute("""SELECT d.zh, COUNT(n.id) cnt FROM nodes n JOIN domains d ON n.domain=d.id
        GROUP BY n.domain ORDER BY d.ord""").fetchall()
    db_kb = os.path.getsize("atlas.db") // 1024
    print(f"✓ atlas.db 建成: {db_kb} KB · {len(nodes)} 节点 / {len(edges)} 边 / {len(ev_rows)} 条证据 / {sum(1 for _ in cur.execute('SELECT 1 FROM story_steps'))} 步故事")
    print("  域分布:", ", ".join(f"{zh} {c}" for zh, c in stats))
    if multi_ev: print(f"  (多证据节点 {multi_ev} 个)")
    if problems:
        print("❌ 问题:", "; ".join(problems)); raise SystemExit(1)
    print("✓ 完整性检查通过(无悬空边/证据, 主图连通)")
    con.close()

if __name__ == "__main__":
    main()

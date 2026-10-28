# -*- coding: utf-8 -*-
"""curate_batch.py — 策展队列批量消化
1) 类型回写: 语料中明确标注 Person/Event 的节点 → 回写正确类型与年份
2) 噪声剔除: 列表页模式的维基层节点 → 标记剔除候选 (地图隐藏, 数据保留)
3) tradition 补齐: 语料第6列的知识传统写入节点
运行: python curate_batch.py
"""
import glob, os, re, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

con = sqlite3.connect("atlas.db")
con.row_factory = sqlite3.Row
cur = con.cursor()

# ---------- 1. 读取语料中的类型标注行 ----------
typed_rows = []
for path in sorted(glob.glob("data/corpus/batch*.tsv")):
    with open(path, encoding="utf-8") as f:
        next(f)
        for ln in f:
            cols = [c.strip() for c in (ln.rstrip("\n").split("\t") + [""] * 6)][:6]
            fld, name, year, desc, typ, extra = cols
            if not typ and extra in ("Person", "Event", "Technology", "Method", "Proposition"):
                typ, extra = extra, ""
            if typ in ("Person", "Event") and name:
                born = int(year) if year.lstrip("-").isdigit() else None
                typed_rows.append((name, typ, born, extra or None))

# ---------- 2. 类型回写 ----------
fixed = 0
for name, typ, born, tr in typed_rows:
    r = cur.execute("SELECT id, type, born FROM nodes WHERE zh=?", (name,)).fetchone()
    if not r:
        continue
    nid, cur_type, cur_born = r["id"], r["type"], r["born"]
    if cur_type == typ and (cur_born is not None) == (born is not None):
        continue
    if tr:
        cur.execute("UPDATE nodes SET tradition=? WHERE id=?", (tr, nid))
    cur.execute("UPDATE nodes SET type=?, born=COALESCE(?, born) WHERE id=?", (typ, born, nid))
    cur.execute(
        "UPDATE evidence SET source=source || ' | 类型修正 v0.7' "
        "WHERE node_id=? AND grade='C'",
        (nid,),
    )
    fixed += 1
con.commit()
print(f"① 类型回写: {fixed} 个节点 (语料标注 {len(typed_rows)} 条 Person/Event)")

# ---------- 3. 噪声剔除 ----------
NOISE = re.compile(r"(校友|大事记|名录|年表|一览|名单|获奖列表|历任|目录)$|(列表|名录|大事记)")
rows = cur.execute(
    "SELECT n.id, n.zh FROM nodes n "
    "JOIN evidence v ON n.id=v.node_id WHERE v.grade='C' AND n.type='Topic'"
).fetchall()
rejected = 0
for r in rows:
    if NOISE.search(r["zh"]):
        cur.execute("UPDATE nodes SET status='剔除候选' WHERE id=?", (r[0],))
        rejected += 1
con.commit()
print(f"② 噪声剔除: {rejected} 个列表页节点标记剔除候选")

# ---------- 4. 报告 ----------
stats = cur.execute(
    "SELECT "
    "(SELECT COUNT(*) FROM nodes n JOIN evidence v ON n.id=v.node_id WHERE v.grade='C') pending, "
    "(SELECT COUNT(*) FROM nodes WHERE type='Person') persons, "
    "(SELECT COUNT(*) FROM nodes WHERE type='Event') events, "
    "(SELECT COUNT(*) FROM nodes WHERE status='剔除候选') rejected_total"
).fetchone()
print(f"③ 现状: 待策展 {stats[0]} · 人物 {stats[1]} · 事件 {stats[2]} · 已标记剔除 {stats[3]}")
con.close()

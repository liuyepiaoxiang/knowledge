# -*- coding: utf-8 -*-
"""semantic.py — 共现边语义升级
输入: corpus/semantic.tsv (zh1, zh2, type, weight)  type=DROP 表示删除该共现边
规则:
  - 按概念中文名解析为 id, 在库中定位该对的 relates_to 边(不限方向)
  - typed: 删除原 relates_to, 写入带方向/权重的类型边
  - DROP: 直接删除
  - 若两节点间已存在同类型边(任一方向) → 仅删除 relates_to
  - 附带清理: Domain/Field 端点的同域共现垃圾边
之后: python export.py
"""
import sys, datetime
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def resolve(cur, zh):
    r = cur.execute("SELECT id FROM nodes WHERE zh=?", (zh,)).fetchone()
    return r[0] if r else None

def main():
    import os
    os.chdir(ROOT)
    con = sqlite3.connect("atlas.db")
    cur = con.cursor()
    applied = dropped = cleaned = 0
    errs = []

    rows = []
    with open("data/corpus/semantic.tsv", encoding="utf-8") as f:
        head = f.readline()
        for ln in f:
            cols = (ln.rstrip("\n").split("\t") + ["", ""])[:4]
            if not cols[0]: continue
            rows.append(cols)

    for zh1, zh2, typ, w in rows:
        i1, i2 = resolve(cur, zh1), resolve(cur, zh2)
        if not i1 or not i2:
            errs.append(f"未解析: {zh1} / {zh2}"); continue
        hit = cur.execute("""SELECT rowid, src, dst FROM edges WHERE type='relates_to'
            AND ((src=? AND dst=?) OR (src=? AND dst=?))""", (i1, i2, i2, i1)).fetchone()
        if typ == "DROP":
            if hit:
                cur.execute("DELETE FROM edges WHERE rowid=?", (hit[0],))
                cur.execute("UPDATE nodes SET degree=degree-1 WHERE id IN (?,?)", (hit[1], hit[2]))
                dropped += 1
            continue
        w = float(w or 0.5)
        dup = cur.execute("""SELECT rowid FROM edges WHERE type=? AND
            ((src=? AND dst=?) OR (src=? AND dst=?))""", (typ, i1, i2, i2, i1)).fetchone()
        if hit:
            cur.execute("DELETE FROM edges WHERE rowid=?", (hit[0],))
        else:
            if dup: continue   # 无 relates_to 可升级且类型边已存在
        if dup:
            pass
        else:
            cur.execute("INSERT INTO edges VALUES (?,?,?,?,?)", (i1, i2, typ, w, None))
            cur.execute("UPDATE nodes SET degree=degree+1 WHERE id IN (?,?)", (i1, i2))
        applied += 1

    # 清理: Domain/Field 端点的同域共现垃圾边
    cur.execute("""DELETE FROM edges WHERE type='relates_to' AND rowid IN (
        SELECT e.rowid FROM edges e JOIN nodes a ON e.src=a.id JOIN nodes b ON e.dst=b.id
        WHERE (a.type='Domain' AND b.domain=a.id) OR (b.type='Domain' AND a.domain=b.id))""")
    cleaned += cur.execute("SELECT changes()").fetchone()[0]
    cur.execute("""DELETE FROM edges WHERE type='relates_to' AND rowid IN (
        SELECT e.rowid FROM edges e JOIN nodes a ON e.src=a.id JOIN nodes b ON e.dst=b.id
        WHERE a.type='Field' AND b.domain=a.domain AND EXISTS (
            SELECT 1 FROM edges p WHERE p.src=b.id AND p.dst=a.id AND p.type='part_of'))""")
    cleaned += cur.execute("SELECT changes()").fetchone()[0]
    cur.execute("""DELETE FROM edges WHERE type='relates_to' AND rowid IN (
        SELECT e.rowid FROM edges e JOIN nodes a ON e.src=a.id JOIN nodes b ON e.dst=b.id
        WHERE b.type='Field' AND a.domain=b.domain AND EXISTS (
            SELECT 1 FROM edges p WHERE p.src=a.id AND p.dst=b.id AND p.type='part_of'))""")
    cleaned += cur.execute("SELECT changes()").fetchone()[0]

    cur.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)", [
        ("semantic_applied", str(applied)), ("semantic_dropped", str(dropped)),
        ("semantic_cleaned", str(cleaned)),
        ("semantic_date", datetime.date.today().isoformat())])
    con.commit()
    n_total = cur.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
    e_total = cur.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
    rel_left = cur.execute("SELECT COUNT(*) FROM edges WHERE type='relates_to'").fetchone()[0]
    print(f"✓ 语义升级: 类型化 {applied}, 删除 {dropped}, 同域垃圾清理 {cleaned}")
    print(f"  库内总量: {n_total} 节点 / {e_total} 边 (剩余 relates_to {rel_left})")
    if errs:
        print("⚠ 未解析项:"); [print("  " + e) for e in errs]
    con.close()

if __name__ == "__main__":
    main()

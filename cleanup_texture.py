# -*- coding: utf-8 -*-
"""cleanup_texture.py — v0.7 纹理层大清理
裁决: C 级 relates_to 边若无证据句 → 删除 (可随时从本地 dump 重新提取)
      连带: 清理后 degree=0 的 Topic 纹理节点一并移除
运行: python cleanup_texture.py && python export.py
"""
import sqlite3

con = sqlite3.connect("atlas.db")
cur = con.cursor()

before_e = cur.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
before_n = cur.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]

# 1) 删除无证据句的 C 级共现边 (双端均为提取层 C 级)
cur.execute("""
DELETE FROM edges WHERE type='relates_to' AND rowid IN (
  SELECT e.rowid FROM edges e
  JOIN nodes a ON e.src=a.id JOIN nodes b ON e.dst=b.id
  WHERE (a.type='Topic' OR b.type='Topic')
    AND (SELECT grade FROM evidence WHERE node_id=e.src LIMIT 1)='C'
    AND (SELECT grade FROM evidence WHERE node_id=e.dst LIMIT 1)='C'
    AND NOT EXISTS (SELECT 1 FROM edge_context x
        WHERE (x.src=e.src AND x.dst=e.dst) OR (x.src=e.dst AND x.dst=e.src)))
""")
cut_edges = cur.rowcount
cur.execute("""UPDATE nodes SET degree = (SELECT COUNT(*) FROM edges e
    WHERE e.src=nodes.id OR e.dst=nodes.id)""")

# 2) 删除孤立的 C 级纹理节点
cur.execute("""
DELETE FROM nodes WHERE type='Topic' AND degree=0
  AND (SELECT grade FROM evidence WHERE node_id=nodes.id LIMIT 1)='C'
""")
cut_nodes = cur.rowcount

con.commit()
after_e = cur.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
after_n = cur.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
print(f"✓ 纹理层清理: 删除无证据共现边 {cut_edges} 条, 孤立纹理节点 {cut_nodes} 个")
print(f"  节点 {before_n} → {after_n} · 边 {before_e} → {after_e}")
con.close()

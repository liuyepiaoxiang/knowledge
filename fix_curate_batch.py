# -*- coding: utf-8 -*-
"""一次性修复 curate_batch.py 的解析问题并处理 tradition 行"""
import io

p = "curate_batch.py"
s = io.open(p, encoding="utf-8").read()

# row_factory
old = 'con = sqlite3.connect("atlas.db")\ncur = con.cursor()'
new = 'con = sqlite3.connect("atlas.db")\ncon.row_factory = sqlite3.Row\ncur = con.cursor()'
assert old in s, "A1"
s = s.replace(old, new)

# 语料行解析: 6 列(带 tradition)容错
old = '''            cols = (ln.rstrip("\\n").split("\\t") + [""] * 5)[:5]
            fld, name, year, desc, typ = [c.strip() for c in cols]
            if typ in ("Person", "Event") and name:
                typed_rows.append((name, typ, int(year) if year.lstrip("-").isdigit() else None))'''
new = '''            cols = [c.strip() for c in (ln.rstrip("\\n").split("\\t") + [""] * 6)][:6]
            fld, name, year, desc, typ, extra = cols
            if not typ and extra in ("Person", "Event", "Technology", "Method", "Proposition"):
                typ, extra = extra, ""
            if typ in ("Person", "Event") and name:
                typed_rows.append((name, typ,
                                   int(year) if year.lstrip("-").isdigit() else None, extra or None))'''
assert old in s, "A2"
s = s.replace(old, new)

# 回写循环: Row 访问 + tradition
old = '''fixed = 0
for name, typ, born in typed_rows:
    r = cur.execute("SELECT id,type,born FROM nodes WHERE zh=?", (name,)).fetchone()
    if not r: continue
    nid, cur_type, cur_born = r
    if cur_type == typ and (cur_born is not None) == (born is not None):
        continue
    cur.execute("UPDATE nodes SET type=?, born=COALESCE(?, born) WHERE id=?", (typ, born, nid))
    cur.execute(
        "UPDATE evidence SET source=source || ' | 类型修正 v0.7' "
        "WHERE node_id=? AND grade='C'",
        (nid,),
    )
    fixed += 1
con.commit()'''
new = '''fixed = 0
for name, typ, born, tr in typed_rows:
    r = cur.execute("SELECT id,type,born FROM nodes WHERE zh=?", (name,)).fetchone()
    if not r: continue
    nid, cur_type, cur_born = r["id"], r["type"], r["born"]
    if cur_type == typ and (cur_born is not None) == (born is not None):
        continue
    cur.execute("UPDATE nodes SET type=?, born=COALESCE(?, born) WHERE id=?", (typ, born, nid))
    if tr:
        cur.execute("UPDATE nodes SET tradition=? WHERE id=?", (tr, nid))
    cur.execute(
        "UPDATE evidence SET source=source || ' | 类型修正 v0.7' "
        "WHERE node_id=? AND grade='C'",
        (nid,),
    )
    fixed += 1
con.commit()'''
assert old in s, "A3"
s = s.replace(old, new)

# 噪声剔除: Row 索引
old = '''for r in rows:
    if NOISE.search(r["zh"]):
        cur.execute("UPDATE nodes SET status='剔除候选' WHERE id=?", (r["id"],))
        rejected += 1'''
new = '''for r in rows:
    if NOISE.search(r["zh"]):
        cur.execute("UPDATE nodes SET status='剔除候选' WHERE id=?", (r[0],))
        rejected += 1'''
assert old in s, "A4"
s = s.replace(old, new)

io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("curate_batch.py 修复完成")

# -*- coding: utf-8 -*-
"""ingest.py — 批量骨架层导入
bulk/nodes.tsv + bulk/edges.tsv -> atlas.db (证据等级 C, 置信度 0.7, 未逐条人工复核)
运行: python ingest.py
"""
import csv, os, sqlite3, sys

TYPES = {"Domain","Field","Topic","Concept","Theory","Proposition","Method","Skill",
         "Technology","Process","Material","Instrument","Product","Problem","Dataset",
         "Controversy","Person","Event"}
GRADE, SOURCE, CONF = "C", "批量骨架导入 v0.3（未逐条人工复核）", 0.7

def read_tsv(path):
    with open(path, encoding="utf-8") as f:
        rows = [l.rstrip("\n").split("\t") for l in f if l.strip()]
    return rows[1:], rows[0]   # 数据行, 表头

def main():
    if not os.path.exists("atlas.db"):
        print("❌ 先运行 python build_db.py 建库"); sys.exit(1)
    con = sqlite3.connect("atlas.db")
    cur = con.cursor()
    domains = {r[0] for r in cur.execute("SELECT id FROM domains")}
    node_ids = {r[0] for r in cur.execute("SELECT id FROM nodes")}

    n_rows, n_head = read_tsv("bulk/nodes.tsv")
    errs, new_nodes = [], []
    bulk_ids = {cols[0] for cols in n_rows if cols}
    all_ids = node_ids | bulk_ids
    for cols in n_rows:
        nid, typ, zh, en, dom, parent, born, died, one, status, tradition = (cols + [""]*11)[:11]
        if typ not in TYPES: errs.append(f"{nid}: 非法类型 {typ}")
        if dom not in domains: errs.append(f"{nid}: 未知域 {dom}")
        if parent and parent != nid and parent not in all_ids: errs.append(f"{nid}: 未知父节点 {parent}")
        if nid in node_ids: continue
        born_i = int(born) if born.strip() else None
        died_i = int(died) if died.strip() else None
        new_nodes.append((nid, typ, zh, en or None, dom, born_i, died_i, one or zh,
                          None, None, status or None, tradition or None, CONF))
        node_ids.add(nid)

    e_rows, _ = read_tsv("bulk/edges.tsv")
    existing = {tuple(r) for r in cur.execute("SELECT src,dst,type FROM edges")}
    new_edges, new_partof = [], []
    for cols in e_rows:
        src, dst, etype, weight, since = (cols + [""]*5)[:5]
        if src not in node_ids: errs.append(f"边起点不存在: {src}")
        if dst not in node_ids: errs.append(f"边终点不存在: {dst}")
        if (src, dst, etype) in existing: continue
        new_edges.append((src, dst, etype, float(weight or 0.5), int(since) if since.strip() else None))
        existing.add((src, dst, etype))

    # parent -> part_of 边
    for cols in n_rows:
        nid, typ, zh, en, dom, parent, born, died, one, status, tradition = (cols + [""]*11)[:11]
        if parent and parent != nid and (nid, parent, "part_of") not in existing:
            new_partof.append((nid, parent, "part_of", 1.0, None))
            existing.add((nid, parent, "part_of"))

    if errs:
        print("❌ 校验失败:"); [print("  " + e) for e in errs[:20]]; sys.exit(1)

    cur.executemany("""INSERT OR IGNORE INTO nodes
        (id,type,zh,en,domain,born,died,one_liner,why,example,status,tradition,confidence)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", new_nodes)
    cur.executemany("INSERT OR IGNORE INTO evidence VALUES (?,?,?)",
                    [(n[0], GRADE, SOURCE) for n in new_nodes])
    cur.executemany("INSERT OR IGNORE INTO edges VALUES (?,?,?,?,?)",
                    new_edges + new_partof)
    cur.executemany("UPDATE nodes SET degree = degree+1 WHERE id IN (?,?)",
                    [(e[0], e[1]) for e in new_edges + new_partof])
    con.commit()

    n_total = cur.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
    e_total = cur.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
    c_total = cur.execute("SELECT COUNT(*) FROM nodes n JOIN evidence v ON n.id=v.node_id WHERE v.grade='C'").fetchone()[0]
    cur.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)", [
        ("edition", "v0.3"), ("nodes", str(n_total)), ("edges", str(e_total)),
        ("bulk_layer", str(len(new_nodes))), ("bulk_edges", str(len(new_edges) + len(new_partof))),
        ("built_at", __import__("datetime").date.today().isoformat())])
    con.commit()
    print(f"✓ 批量导入: 新节点 {len(new_nodes)}, 新边 {len(new_edges)}+{len(new_partof)}(隶属)")
    print(f"  库内总量: {n_total} 节点 / {e_total} 边 / 其中 C 级批量层 {c_total}")
    con.close()

if __name__ == "__main__":
    main()

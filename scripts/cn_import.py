# -*- coding: utf-8 -*-
"""cn_import.py — ConceptNet zh 断言导入 (使用已验证的扫描循环)
处理含 zh 的 6 个分片 → 度数筛选 top 25k → 入库 → 校准报告
运行: python cn_import.py && python export.py
"""
import hashlib, time
from collections import Counter
from itertools import combinations

import pyarrow.parquet as pq

import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

SHARD_FILES = ["data/corpus/dump/cn-train-00000-of-00023.parquet",
               "data/corpus/dump/cn-train-00010-of-00023.parquet",
               "data/corpus/dump/cn-train-00011-of-00023.parquet",
               "data/corpus/dump/cn-train-00017-of-00023.parquet",
               "data/corpus/dump/cn-train-00018-of-00023.parquet",
               "data/corpus/dump/cn-train-00022-of-00023.parquet"]
TYPE = {"HasPrerequisite": "depends_on", "Causes": "enables", "MadeOf": "composes_of",
        "PartOf": "part_of", "UsedFor": "applied_in", "Entails": "depends_on",
        "Antonym": "competes_with", "HasProperty": "relates_to", "CapableOf": "relates_to",
        "DefinedAs": "relates_to", "InstanceOf": "relates_to", "MannerOf": "relates_to",
        "SimilarTo": "relates_to", "RelatedTo": "relates_to"}
PRIOR = {"HasPrerequisite": 9, "Causes": 8, "MadeOf": 8, "PartOf": 7, "UsedFor": 7,
         "Entails": 6, "Antonym": 6, "HasProperty": 5, "CapableOf": 5, "DefinedAs": 4,
         "InstanceOf": 4, "MannerOf": 4, "SimilarTo": 3, "RelatedTo": 1}
MAX_NODES, MIN_DEG, MAX_EDGES = 25000, 2, 100000

def norm(term):
    parts = term.split("/")
    t = parts[3] if len(parts) > 3 else ""
    return t.replace("_", " ").strip()

def has_cjk(s):
    return any("\u4e00" <= ch <= "\u9fff" for ch in s)

def main():
    import pyarrow.parquet as pq
    import sqlite3
    con = sqlite3.connect("atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    existing = {r["zh"]: r["id"] for r in cur.execute("SELECT zh,id FROM nodes")}

    concepts = Counter()
    cn_any = set()
    edges = {}
    t0 = time.time()
    total_zh = 0
    for path in SHARD_FILES:
        if not path or not __import__("os").path.exists(path):
            print("缺分片:", path); continue
        pf = pq.ParquetFile(path)
        for batch in pf.iter_batches(batch_size=20000, columns=["rel", "arg1", "arg2", "lang", "weight", "sentence"]):
            for rel, h1, h2, lang, wraw, sent in zip(
                    batch.column("rel").to_pylist(), batch.column("arg1").to_pylist(),
                    batch.column("arg2").to_pylist(), batch.column("lang").to_pylist(),
                    batch.column("weight").to_pylist(), batch.column("sentence").to_pylist()):
                if lang != "zh": continue
                rel = rel.split("/")[-1]   # HF 数据集带 /r/ 前缀
                if rel not in TYPE: continue
                a, b = norm(h1), norm(h2)
                if not a or not b or a == b or len(a) < 2 or len(b) < 2 or len(a) > 30 or len(b) > 30: continue
                if not has_cjk(a) or not has_cjk(b): continue
                total_zh += 1
                concepts[a] += 1; concepts[b] += 1
                key = tuple(sorted((a, b)))
                cn_any.add(key)
                prio = PRIOR[rel]
                old = edges.get(key)
                w = min(0.35 + (wraw or 0) * 0.15, 0.6)
                if old is None or prio > old[0] or (prio == old[0] and w > old[2]):
                    edges[key] = (prio, rel, w, sent[:120])
        print(f"  {path.split('/')[-1]}: 累计 zh 断言 {total_zh} · 概念 {len(concepts)} · 边 {len(edges)}", flush=True)
    print(f"扫描完成 {round(time.time()-t0)}s")

    kept = {name for name, deg in concepts.most_common(MAX_NODES) if deg >= MIN_DEG}
    print(f"筛选: 概念 {len(concepts)} → 保留 {len(kept)}")

    def nid_of(name):
        return existing.get(name) or ("cn_" + hashlib.md5(name.encode()).hexdigest()[:10])

    new_nodes, new_ev, new_edges, new_ctx = [], [], [], []
    for name in kept:
        if name in existing: continue
        nid = nid_of(name)
        deg = concepts[name]
        new_nodes.append((nid, "Topic", name, None, "dom_extern", None, None,
                          name + f"（ConceptNet 概念, 度 {deg}）", None, None, None, None, 0.5))
        new_ev.append((nid, "C", "ConceptNet 5.7 导入 (CC BY-SA 4.0)"))
        existing[name] = nid
    cur.executemany("""INSERT OR IGNORE INTO nodes
        (id,type,zh,en,domain,born,died,one_liner,why,example,status,tradition,confidence)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", new_nodes)
    cur.executemany("INSERT OR IGNORE INTO evidence VALUES (?,?,?)", new_ev)

    kept_pairs = [(k, v) for k, v in edges.items() if k[0] in kept and k[1] in kept]
    kept_pairs.sort(key=lambda kv: (-kv[1][0], -kv[1][2]))
    ins = 0
    have_pair_type = set()
    for r in cur.execute("SELECT src,dst,type FROM edges WHERE type='relates_to'"):
        have_pair_type.add((tuple(sorted((r["src"], r["dst"]))), r["type"]))
    for (a, b), (prio, rel, w, sent) in kept_pairs[:MAX_EDGES]:
        ia, ib = nid_of(a), nid_of(b)
        pkey = (tuple(sorted((ia, ib))), TYPE[rel])
        if pkey in have_pair_type: continue
        have_pair_type.add(pkey)
        new_edges.append((ia, ib, TYPE[rel], w, None))
        if rel != "RelatedTo":
            new_ctx.append((ia, ib, sent[:120], "ConceptNet"))
        ins += 1
    cur.executemany("INSERT OR IGNORE INTO edges VALUES (?,?,?,?,?)", new_edges)
    cur.executemany("INSERT OR IGNORE INTO edge_context VALUES (?,?,?,?)", new_ctx)
    cur.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)", [
        ("conceptnet_nodes", str(len(new_nodes))), ("conceptnet_edges", str(ins)),
        ("edition", "v0.9")])
    con.commit()

    # 校准报告
    checked = confirmed = 0
    for e in cur.execute("""SELECT src,dst FROM edges WHERE type IN
        ('depends_on','enables','applied_in','explains','inspired_by','composes_of','part_of')
        AND src NOT LIKE 'cn_%' AND dst NOT LIKE 'cn_%'
        AND src NOT LIKE 'x_%' AND dst NOT LIKE 'x_%'
        AND src NOT LIKE 'w_%' AND dst NOT LIKE 'w_%'""").fetchall():
        za = cur.execute("SELECT zh FROM nodes WHERE id=?", (e["src"],)).fetchone()
        zb = cur.execute("SELECT zh FROM nodes WHERE id=?", (e["dst"],)).fetchone()
        if not za or not zb: continue
        if za["zh"] not in concepts or zb["zh"] not in concepts: continue
        checked += 1
        if tuple(sorted((za["zh"], zb["zh"]))) in cn_any: confirmed += 1
    print(f"✓ 导入: 新节点 {len(new_nodes)}, 类型边 {ins} (其中含证据句 {len(new_ctx)})")
    print(f"✓ 校准: 手写策展层类型边被 ConceptNet 佐证 {confirmed}/{checked}" +
          (f" = {round(confirmed/checked*100)}%" if checked else ""))
    cur.execute("INSERT OR REPLACE INTO meta VALUES (?,?)",
                ("calibration", f"{confirmed}/{checked}"))
    con.commit()
    n_total = cur.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
    e_total = cur.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
    print(f"  库内总量: {n_total} 节点 / {e_total} 边")
    con.close()

if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""cn_all.py — 十倍生成器: ConceptNet 5.7 开放图谱全量导入
数据: hf-mirror.com/datasets/conceptnet5/conceptnet5 (23 parquet, ~1GB, CC BY-SA 4.0)
流程: 逐分片下载→流式过滤中文断言→谓词映射到本体→按度数筛选→入库→校准报告
运行: python cn_all.py   (可中断续跑: 分片处理标记在 corpus/dump/.cn_done)
"""
import json, hashlib, os, sqlite3, time
from collections import Counter
from urllib.parse import unquote

import pyarrow.parquet as pq

import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

BASE = "https://hf-mirror.com/datasets/conceptnet5/conceptnet5/resolve/main/conceptnet5/"
SHARDS = [f"train-{i:05d}-of-00023.parquet" for i in range(23)]
DONE = "data/corpus/dump/.cn_done"
KEEP = True   # 分片保留本地 (wiki_extract/证据句可复用)

# 谓词映射: ConceptNet relation -> 本体 type (None=跳过)
REL_MAP = {
    "HasPrerequisite": ("depends_on", 9),
    "Causes": ("enables", 8),
    "MadeOf": ("composes_of", 8),
    "PartOf": ("part_of", 7),
    "UsedFor": ("applied_in", 7),
    "Entails": ("depends_on", 6),
    "Antonym": ("competes_with", 6),
    "HasProperty": ("relates_to", 5),
    "CapableOf": ("relates_to", 5),
    "DefinedAs": ("relates_to", 4),
    "InstanceOf": ("relates_to", 4),
    "MannerOf": ("relates_to", 4),
    "SimilarTo": ("relates_to", 3),
    "RelatedTo": ("relates_to", 1),
}
PRIOR = {r: p for r, (t, p) in REL_MAP.items()}
TYPE = {r: t for r, (t, p) in REL_MAP.items()}

MAX_NODES = 30000
MIN_DEG = 2
MAX_EDGES = 120000

def norm(term):
    """'/c/zh/中央_处理器' -> '中央 处理器'"""
    parts = term.split("/")
    t = unquote(parts[3]) if len(parts) > 3 else ""
    t = t.replace("_", " ").strip()
    return t

def has_cjk(s):
    return any("\u4e00" <= ch <= "\u9fff" for ch in s)

def main():
    done = set()
    if os.path.exists(DONE):
        done = {l.strip() for l in open(DONE, encoding="utf-8") if l.strip()}
    os.makedirs("data/corpus/dump", exist_ok=True)

    concepts = Counter()          # zh name -> degree
    edges = {}                    # (a,b) sorted -> (prio, rel, weight, sentence)
    cn_any = set()                # 所有映射过的无向对(供校准)
    t0 = time.time()

    for i, shard in enumerate(SHARDS, 1):
        if shard in done:
            print(f"[{i}/23] 已处理, 跳过 {shard}", flush=True)
            continue
        dest = f"data/corpus/dump/cn-{shard}"
        if not os.path.exists(dest) or os.path.getsize(dest) < 1_000_000:
            print(f"[{i}/23] 下载 {shard} …", flush=True)
            import subprocess
            r = subprocess.run(["curl", "-sL", "-m", "1800", BASE + shard, "-o", dest])
            if r.returncode != 0 or not os.path.exists(dest) or os.path.getsize(dest) < 1_000_000:
                print(f"[{i}/23] ❌ 下载失败, 跳过", flush=True)
                if os.path.exists(dest): os.remove(dest)
                continue
        print(f"[{i}/23] 流式处理 …", flush=True)
        pf = pq.ParquetFile(dest)
        n = 0
        for batch in pf.iter_batches(batch_size=5000, columns=["sentence", "rel", "arg1", "arg2", "lang", "weight"]):
            for sent, rel, h1, h2, lang, wraw in zip(
                    batch.column("sentence").to_pylist(), batch.column("rel").to_pylist(),
                    batch.column("arg1").to_pylist(), batch.column("arg2").to_pylist(),
                    batch.column("lang").to_pylist(), batch.column("weight").to_pylist()):
                if lang != "zh":
                    continue
                if rel not in TYPE:
                    continue
                a, b = norm(h1), norm(h2)
                if not a or not b or a == b or len(a) < 2 or len(b) < 2 or len(a) > 30 or len(b) > 30:
                    continue
                if not has_cjk(a) or not has_cjk(b):
                    continue
                concepts[a] += 1
                concepts[b] += 1
                key = tuple(sorted((a, b)))
                cn_any.add(key)
                prio = PRIOR[rel]
                old = edges.get(key)
                w = min(0.35 + (wraw or 0) * 0.15, 0.6)
                if old is None or prio > old[0] or (prio == old[0] and w > old[2]):
                    edges[key] = (prio, rel, w, sent[:120])
                n += 1
        print(f"[{i}/23] 本片中文断言 {n} · 累计概念 {len(concepts)} · 累计边 {len(edges)} · {round(time.time()-t0)}s", flush=True)
        if not KEEP:
            os.remove(dest)
        with open(DONE, "a", encoding="utf-8") as f:
            f.write(shard + "\n")

    # ---- 筛选: 度数 >= MIN_DEG, 按度数取前 MAX_NODES ----
    kept = {name for name, deg in concepts.most_common(MAX_NODES) if deg >= MIN_DEG}
    print(f"筛选: 概念 {len(concepts)} → 保留 {len(kept)} (度≥{MIN_DEG}, 上限 {MAX_NODES})")

    import hashlib
    def nid_of(name):
        return "cn_" + hashlib.md5(name.encode()).hexdigest()[:10]

    con = sqlite3.connect("atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    existing = {r["zh"]: r["id"] for r in cur.execute("SELECT zh,id FROM nodes")}

    cur.execute("INSERT OR IGNORE INTO domains VALUES ('dom_extern','开放图谱导入层','Open KG import',99)")
    con.commit()
    new_nodes, new_ev, new_edges = [], [], []
    reused = 0
    for name in kept:
        if name in existing:
            reused += 1
            continue
        nid = "cn_" + hashlib.md5(name.encode()).hexdigest()[:10]
        if nid in existing.values():
            continue
        deg = concepts[name]
        new_nodes.append((nid, "Topic", name, None, "dom_extern", None, None,
                          name + f"（ConceptNet 概念, 度 {deg}）", None, None, None, None, 0.5))
        new_ev.append((nid, "C", "ConceptNet 5.7 导入 (CC BY-SA 4.0)"))
        existing[name] = nid
    # 域归属留空(由后续判读或共现归属), 先均分到形式科学? 不——无域节点在星图上按锚点引力聚合困难,
    # 方案: 无域 Topic 的锚点引力走中心——接受它们构成"未分类云", 由策展台逐步归类
    cur.executemany("""INSERT OR IGNORE INTO nodes
        (id,type,zh,en,domain,born,died,one_liner,why,example,status,tradition,confidence)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", new_nodes)
    cur.executemany("INSERT OR IGNORE INTO evidence VALUES (?,?,?)", new_ev)

    # 边: 仅保留双端都在 kept 集的, 类型化优先, 上限 MAX_EDGES
    kept_edges = [(k, v) for k, v in edges.items() if k[0] in kept and k[1] in kept]
    kept_edges.sort(key=lambda kv: -kv[1][0])
    now_ids = {r[0] for r in cur.execute("SELECT id FROM nodes")}
    ins = 0
    seen_pair_type = set()
    for (a, b), (prio, rel, w, sent) in kept_edges[:MAX_EDGES]:
        ia = existing.get(a) or ("cn_" + hashlib.md5(a.encode()).hexdigest()[:10])
        ib = existing.get(b) or ("cn_" + hashlib.md5(b.encode()).hexdigest()[:10])
        if ia not in now_ids or ib not in now_ids: continue
        t = TYPE[rel]
        pt = (t, tuple(sorted((ia, ib))))
        if pt in seen_pair_type: continue
        seen_pair_type.add(pt)
        ctx = None if rel == "RelatedTo" else None
        new_edges.append((ia, ib, t, w, None, sent[:100]))
        ins += 1
    # 插入边 (ctx 存入 edge_context 表)
    cur.executemany("INSERT OR IGNORE INTO edges VALUES (?,?,?,?,?)",
                    [(e[0], e[1], e[2], e[3], e[4]) for e in new_edges])
    cur.executemany("INSERT OR IGNORE INTO edge_context VALUES (?,?,?,?)",
                    [(e[0], e[1], e[5], "ConceptNet") for e in new_edges if e[5]])
    cur.execute("UPDATE nodes SET degree = (SELECT COUNT(*) FROM edges e WHERE e.src=nodes.id OR e.dst=nodes.id)")
    cur.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)", [
        ("conceptnet_imported", str(ins)),
        ("conceptnet_date", time.strftime("%Y-%m-%d")),
        ("edition", "v0.9")])
    con.commit()

    # ---- 校准报告: 手写策展层(A/B)的类型边被 ConceptNet 佐证的比例 ----
    checked = confirmed = 0
    for e in cur.execute("SELECT src,dst FROM edges WHERE type IN "
                         "('depends_on','enables','applied_in','explains','inspired_by','composes_of','part_of') "
                         "AND src NOT LIKE 'cn_%' AND dst NOT LIKE 'cn_%'").fetchall():
        na = cur.execute("SELECT zh FROM nodes WHERE id=?", (e["src"],)).fetchone()
        nb = cur.execute("SELECT zh FROM nodes WHERE id=?", (e["dst"],)).fetchone()
        if not na or not nb: continue
        if na["zh"] not in concepts or nb["zh"] not in concepts: continue
        checked += 1
        key = tuple(sorted((na["zh"], nb["zh"])))
        if key in cn_any:
            confirmed += 1
    print(f"✓ ConceptNet 导入: 新节点 {len(new_nodes)}, 类型边 {ins}")
    print(f"✓ 校准报告: 手写策展层类型边被外部图谱佐证 {confirmed}/{checked}" +
          (f" ({round(confirmed/checked*100)}%)" if checked else ""))
    cur.execute("INSERT OR REPLACE INTO meta VALUES (?,?)",
                ("calibration", f"{confirmed}/{checked}"))
    con.commit()
    con.close()
    print("完成, 请运行: python export.py")

if __name__ == "__main__":
    main()

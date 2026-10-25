# -*- coding: utf-8 -*-
"""wiki_extract.py — 维基百科开放数据本地提取 (v0.5)
数据: corpus/dump/zh-part2.parquet (wikimedia/wikipedia 20231101.zh 分片, CC BY-SA)
提取:
  1. 摘要补全与年份: 标题命中既有节点的文章 → born 缺失者补 born (C级)
  2. 共现边: 一篇文章正文同时提到 ≥2 个既有概念 → relates_to (C级, 按文章计数取优)
  3. 新概念: 标题未收录、但正文提到 ≥3 个既有概念的文章 → 新 Topic 节点
     (域归属 = 命中节点域的众数; 上限 600 个)
运行: python wiki_extract.py [parquet路径]
之后: python export.py
"""
import datetime, os, re, sys
from collections import Counter, defaultdict

import ahocorasick
import pyarrow.parquet as pq

DB = "atlas.db"
GRADE, SOURCE, CONF = "C", "维基语料本地提取 v0.5 (CC BY-SA)", 0.55
MAX_NEW = 600
STOP = re.compile(r"(列表|消歧义|索引|年表|目录|小作品|维基|模板|Category|Wikipedia|校友|大事记|名录|概述|条目|人员|人物年谱)", re.I)
YEAR = re.compile(r"(公元前\s*\d+|\d{3,4})\s*年")

def first_year(text):
    m = YEAR.search(text[:600])
    if not m: return None
    s = m.group(1).replace(" ", "").replace("公元前", "-")
    try:
        v = int(s)
        return v if -8000 <= v <= 2026 else None
    except ValueError:
        return None

def first_sentence(text):
    t = re.sub(r"\s+", "", text)
    t = re.sub(r"\([^)]*\)", "", t)
    for sep in ["。", "！", "？", ";", "；"]:
        i = t.find(sep)
        if 15 < i < 160: return t[:i + 1]
    return t[:100]

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "corpus/dump/zh-part2.parquet"
    if not os.path.exists(path):
        print("❌ 找不到分片:", path); sys.exit(1)
    import sqlite3
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    nodes = {r["zh"]: dict(r) for r in cur.execute(
        "SELECT id,zh,domain,born FROM nodes WHERE zh IS NOT NULL AND length(zh)>=2")}
    print(f"既有概念名索引: {len(nodes)}")

    A = ahocorasick.Automaton()
    for zh, n in nodes.items():
        A.add_word(zh, (len(zh), zh))
    A.make_automaton()

    def scan(text):
        """返回去重叠后的命中名集合"""
        spans, names = [], set()
        for end, (ln, zh) in A.iter(text):
            start = end - ln + 1
            if any(not (end < s or start > e) for s, e in spans): continue
            spans.append((start, end)); names.add(zh)
        return names

    enrich, cooc = [], Counter()
    title_seen = set(nodes)
    candidates = {}   # title -> (matches, text)
    pf = pq.ParquetFile(path)
    n_articles = n_hit = 0
    for batch in pf.iter_batches(batch_size=2000, columns=["title", "text"]):
        for title, text in zip(batch.column("title").to_pylist(), batch.column("text").to_pylist()):
            n_articles += 1
            if not text or len(text) < 200: continue
            names = scan(title + "。" + text[:4000])
            if not names: continue
            n_hit += 1
            # 1) 既有节点补年份
            if title in nodes:
                n = nodes[title]
                if n["born"] is None:
                    y = first_year(text)
                    if y is not None: enrich.append((y, n["id"]))
                continue
            if title in title_seen: continue
            title_seen.add(title)
            # 3) 新概念候选: 命中≥3
            if len(names) >= 3 and len(title) <= 15 and not STOP.search(title):
                candidates[title] = (names, text)
            # 2) 共现边 (既有概念间, 每篇最多4对)
            old = [x for x in names if x in nodes] if title not in nodes else list(names)
            if len(old) >= 2:
                old.sort()
                for a in range(len(old)):
                    for b in range(a + 1, min(a + 4, len(old))):
                        pair = tuple(sorted((nodes[old[a]]["id"], nodes[old[b]]["id"])))
                        cooc[pair] += 1
        print(f"  已扫 {n_articles} 篇 / 命中 {n_hit} / 新概念候选 {len(candidates)}", flush=True)

    print(f"扫描完成: {n_articles} 篇, 命中 {n_hit}, 共现对 {len(cooc)}, 候选 {len(candidates)}")

    # 共现边: 取计数≥2的前1200对, 且库中尚无同类边
    have = {tuple(sorted((r[0], r[1]))) + (r[2],) for r in cur.execute("SELECT src,dst,type FROM edges")}
    pair_rows = []
    for (ia, ib), c in cooc.most_common(3000):
        if c < 2 or len(pair_rows) >= 1200: break
        if (ia, ib, "relates_to") in have: continue
        pair_rows.append((ia, ib, "relates_to", 0.5, None, c))

    # 新节点: 按命中数取前 MAX_NEW
    picks = sorted(candidates.items(), key=lambda kv: -len(kv[1][0]))[:MAX_NEW]
    new_nodes, new_ev, new_edges = [], [], []
    for title, (names, text) in picks:
        nid = "w_" + __import__("hashlib").md5(title.encode()).hexdigest()[:10]
        if nid in title_seen: continue
        dom_votes = Counter(nodes[x]["domain"] for x in names if x in nodes)
        dom = dom_votes.most_common(1)[0][0]
        born = first_year(text)
        new_nodes.append((nid, "Topic", title, None, dom, born, None,
                          first_sentence(text), None, None, None, None, CONF))
        new_ev.append((nid, GRADE, SOURCE))
        for x in list(names)[:2]:
            if x in nodes:
                new_edges.append((nid, nodes[x]["id"], "relates_to", 0.4, born))
        title_seen.add(nid)

    cur.executemany("""INSERT OR IGNORE INTO nodes
        (id,type,zh,en,domain,born,died,one_liner,why,example,status,tradition,confidence)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", new_nodes)
    cur.executemany("INSERT OR IGNORE INTO evidence VALUES (?,?,?)", new_ev)
    cur.executemany("INSERT OR IGNORE INTO edges VALUES (?,?,?,?,?)",
                    [(a, b, t, w, s) for a, b, t, w, s, _ in pair_rows])
    cur.executemany("UPDATE nodes SET born=? WHERE id=? AND born IS NULL",
                    [(y, i) for y, i in enrich])
    cur.executemany("UPDATE nodes SET degree=degree+1 WHERE id IN (?,?)",
                    [(e[0], e[1]) for e in pair_rows] + [(e[0], e[1]) for e in new_edges])
    cur.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)", [
        ("edition", "v0.5"), ("wiki_layer", str(len(new_nodes))),
        ("wiki_edges", str(len(pair_rows))), ("wiki_source", os.path.basename(path)),
        ("extract_source", "wikipedia-dump-local"), ("built_at", datetime.date.today().isoformat())])
    con.commit()
    n_total = cur.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
    e_total = cur.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
    print(f"✓ 维基提取完成: 新节点 {len(new_nodes)}, 共现边 {len(pair_rows)}, 年份补全 {len(enrich)}")
    print(f"  库内总量: {n_total} 节点 / {e_total} 边")
    con.close()

if __name__ == "__main__":
    main()

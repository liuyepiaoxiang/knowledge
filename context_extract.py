# -*- coding: utf-8 -*-
"""context_extract.py — 从维基分片提取共现边的证据句
对库中每条 relates_to 边: 找到同时包含两端概念名的文章,
抽出"同时包含两个概念名"的句子存入 edge_context 表 (无向对去重)。
运行: python context_extract.py <parquet路径>
"""
import datetime, hashlib, os, re, sys
from collections import defaultdict
from itertools import combinations

import ahocorasick
import pyarrow.parquet as pq

def split_sentences(text):
    text = re.sub(r"\s+", "", text)
    parts = re.split(r"(?<=[。！？；])", text)
    return [p for p in parts if 8 < len(p) < 220]

def scan_names(A, text):
    spans, names = [], set()
    for end, (ln, zh) in A.iter(text):
        start = end - ln + 1
        if any(not (end < s or start > e) for s, e in spans): continue
        spans.append((start, end)); names.add(zh)
    return names

def main():
    path = sys.argv[1]
    if not os.path.exists(path): print("❌ 找不到", path); sys.exit(1)
    import sqlite3
    con = sqlite3.connect("atlas.db")
    cur = con.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS edge_context (
        src TEXT NOT NULL, dst TEXT NOT NULL,
        sentence TEXT NOT NULL, article TEXT,
        PRIMARY KEY (src, dst))""")

    names = {r[0]: r[1] for r in cur.execute("SELECT zh,id FROM nodes WHERE length(zh)>=2")}
    pairs = set()
    for src, dst in cur.execute("SELECT src,dst FROM edges WHERE type='relates_to'"):
        pairs.add(tuple(sorted((src, dst))))
    print(f"概念名 {len(names)} · 待取证 relates_to 对 {len(pairs)}", flush=True)

    A = ahocorasick.Automaton()
    for zh in names: A.add_word(zh, (len(zh), zh))
    A.make_automaton()

    n_art = n_pair = 0
    ctx_rows = {}
    pf = pq.ParquetFile(path)
    for batch in pf.iter_batches(batch_size=2000, columns=["title", "text"]):
        for title, text in zip(batch.column("title").to_pylist(), batch.column("text").to_pylist()):
            if not text or len(text) < 200: continue
            names_hit = scan_names(A, title + "。" + text[:4000])
            if len(names_hit) < 2: continue
            n_art += 1
            sents = split_sentences(text)
            for n1, n2 in combinations(sorted(names_hit), 2):
                ia, ib = names[n1], names[n2]
                key = tuple(sorted((ia, ib)))
                if key not in pairs or key in ctx_rows: continue
                for s in sents:
                    if n1 in s and n2 in s:
                        ctx_rows[key] = (s, title)
                        n_pair += 1
                        break
                    elif n1 in s or n2 in s:
                        ctx_rows.setdefault(key, ("【" + title + "】" + s[:100], title))
        if n_art % 20000 < 2000:
            print(f"  已扫 {n_art} 篇 · 取证 {n_pair} 对", flush=True)

    cur.executemany("INSERT OR REPLACE INTO edge_context VALUES (?,?,?,?)",
                    [(k[0], k[1], v[0], v[1]) for k, v in ctx_rows.items()])
    con.commit()
    total = cur.execute("SELECT COUNT(*) FROM edge_context").fetchone()[0]
    print(f"✓ 本分片取证 {n_pair} 对 (累计 {total}), 扫描文章 {n_art}, 时间 {datetime.datetime.now():%H:%M}", flush=True)
    con.close()

if __name__ == "__main__":
    main()

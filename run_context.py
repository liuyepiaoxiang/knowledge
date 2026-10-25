# -*- coding: utf-8 -*-
"""run_context.py — 顺序下载全部维基分片并提取共现证据句 (分片保留在本地)
运行: python run_context.py   (可中断续跑: 已下载/已处理的分片自动跳过)
"""
import os, subprocess, sys, time

SHARDS = [f"train-0000{i}-of-00006.parquet" for i in range(6)]
BASE = "https://hf-mirror.com/datasets/wikimedia/wikipedia/resolve/main/20231101.zh/"
os.makedirs("corpus/dump", exist_ok=True)

done_marker = "corpus/dump/.context_done"

done = set()
if os.path.exists(done_marker):
    done = {l.strip() for l in open(done_marker, encoding="utf-8") if l.strip()}

for i, name in enumerate(SHARDS, 1):
    dest = f"corpus/dump/{name}"
    if name in done and os.path.exists(dest):
        print(f"[{i}/6] 已处理过, 跳过: {name}", flush=True)
        continue
    if not os.path.exists(dest) or os.path.getsize(dest) < 10_000_000:
        print(f"[{i}/6] 下载 {name} …", flush=True)
        t0 = time.time()
        r = subprocess.run(["curl", "-sL", "-m", "1800", BASE + name, "-o", dest])
        if r.returncode != 0 or not os.path.exists(dest) or os.path.getsize(dest) < 10_000_000:
            print(f"[{i}/6] ❌ 下载失败, 跳过", flush=True)
            if os.path.exists(dest): os.remove(dest)
            continue
        print(f"[{i}/6] 下载完成 {round(os.path.getsize(dest)/1048576)}MB / {round(time.time()-t0)}s", flush=True)
    print(f"[{i}/6] 提取证据句 …", flush=True)
    r = subprocess.run([sys.executable, "context_extract.py", dest])
    print(f"[{i}/6] 提取退出码 {r.returncode}", flush=True)
    with open(done_marker, "a", encoding="utf-8") as f:
        f.write(name + "\n")

print("✓ 全部分片证据提取完毕", flush=True)

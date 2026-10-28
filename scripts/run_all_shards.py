# -*- coding: utf-8 -*-
"""run_all_shards.py — 顺序下载并提取剩余 5 个维基分片
每片: 下载(curl -L) → wiki_extract.py 入库 → 删除分片省磁盘
完成后自动 python export.py
"""
import subprocess, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
os.chdir(ROOT)

SHARDS = ["train-00000-of-00006.parquet", "train-00001-of-00006.parquet",
          "train-00003-of-00006.parquet", "train-00004-of-00006.parquet",
          "train-00005-of-00006.parquet"]
BASE = "https://hf-mirror.com/datasets/wikimedia/wikipedia/resolve/main/20231101.zh/"
os.makedirs("data/corpus/dump", exist_ok=True)

for i, name in enumerate(SHARDS, 1):
    dest = f"data/corpus/dump/{name}"
    if os.path.exists(dest):
        print(f"[{i}/5] 已存在, 跳过下载: {name}", flush=True)
    else:
        print(f"[{i}/5] 下载 {name} …", flush=True)
        t0 = time.time()
        r = subprocess.run(["curl", "-sL", "-m", "1200", BASE + name, "-o", dest])
        if r.returncode != 0 or not os.path.exists(dest) or os.path.getsize(dest) < 10_000_000:
            print(f"[{i}/5] ❌ 下载失败, 跳过该分片", flush=True)
            if os.path.exists(dest): os.remove(dest)
            continue
        print(f"[{i}/5] 下载完成 {round(os.path.getsize(dest)/1048576)}MB 用时 {round(time.time()-t0)}s", flush=True)
    print(f"[{i}/5] 本地提取 {name} …", flush=True)
    r = subprocess.run([sys.executable, str(SCRIPTS / "wiki_extract.py"), dest])
    print(f"[{i}/5] 提取退出码 {r.returncode}", flush=True)
    os.remove(dest)   # 处理完即删, 省磁盘

print("全部分片处理完毕, 导出全量图 …", flush=True)
subprocess.run([sys.executable, str(SCRIPTS / "export.py")])
print("✓ ALL DONE", flush=True)

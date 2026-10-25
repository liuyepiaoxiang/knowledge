# -*- coding: utf-8 -*-
"""make_all.py — 知识大地全管线编排
用法:
  python make_all.py            # 增量: 跳过已有 DB 重建, 依次执行所有幂等步骤
  python make_all.py --fresh    # 全重建: 从种子重立 DB (维基层需要 corpus/dump 里有分片)
每步带断言, 任何一步失败立即停止并报告。
"""
import glob, os, sqlite3, subprocess, sys

STEPS = []
def step(name):
    def deco(fn):
        STEPS.append((name, fn))
        return fn
    return deco

def sh(cmd):
    r = subprocess.run(cmd, shell=(os.name == "nt"))
    return r.returncode == 0

def q1(cur, sql):
    return cur.execute(sql).fetchone()[0]

def assert_no_dangling(cur):
    n = cur.execute("""SELECT COUNT(*) FROM edges e
        WHERE e.src NOT IN (SELECT id FROM nodes) OR e.dst NOT IN (SELECT id FROM nodes)""").fetchone()[0]
    assert n == 0, f"悬空边 {n} 条"

FRESH = "--fresh" in sys.argv

@step("1. 种子数据校验 (validate.js)")
def s1():
    assert sh("node validate.js"), "种子数据校验失败"

@step("2. 生成 API 种子 (build-api.js)")
def s2():
    assert sh("node build-api.js"), "build-api 失败"

@step("3. 立库/重建 (build_db.py)")
def s3():
    if os.path.exists("atlas.db") and not FRESH:
        print("   [跳过] atlas.db 已存在 (加 --fresh 全重建)")
        return
    assert sh("python build_db.py"), "建库失败"

@step("4. 批量骨架导入 (ingest.py)")
def s4():
    assert sh("python ingest.py"), "ingest 失败"

@step("5. LLM 语料抽取 (extract.py)")
def s5():
    assert sh("python extract.py"), "extract 失败"

@step("6. 语义升级 (semantic.py)")
def s6():
    if not os.path.exists("corpus/semantic.tsv"):
        print("   [跳过] 无 semantic.tsv"); return
    assert sh("python semantic.py"), "semantic 失败"

@step("7. 维基分片提取 (wiki_extract.py)")
def s7():
    dumps = sorted(glob.glob("corpus/dump/*.parquet"))
    if not dumps:
        print("   [跳过] corpus/dump 无分片 (可运行 run_context.py 下载)")
        return
    for d in dumps:
        assert sh(f'python wiki_extract.py "{d}"'), f"维基提取失败: {d}"

@step("8. 共现证据句 (context_extract.py)")
def s8():
    dumps = sorted(glob.glob("corpus/dump/*.parquet"))
    if not dumps:
        print("   [跳过] 无分片"); return
    for d in dumps:
        assert sh(f'python context_extract.py "{d}"'), f"取证失败: {d}"

@step("9. 故事同步 (sync_stories.py)")
def s9():
    assert sh("python sync_stories.py"), "故事同步失败"

@step("10. 导出全量图 (export.py)")
def s10():
    assert sh("python export.py"), "导出失败"

def main():
    print(f"=== 知识大地管线 ({'全重建' if FRESH else '增量'}) ===")
    for name, fn in STEPS:
        print(f"── {name}")
        fn()
    con = sqlite3.connect("file:atlas.db?mode=ro", uri=True)
    cur = con.cursor()
    n = q1(cur, "SELECT COUNT(*) FROM nodes")
    e = q1(cur, "SELECT COUNT(*) FROM edges")
    dangling = cur.execute("""SELECT COUNT(*) FROM edges e
        WHERE e.src NOT IN (SELECT id FROM nodes) OR e.dst NOT IN (SELECT id FROM nodes)""").fetchone()[0]
    stories = q1(cur, "SELECT COUNT(*) FROM story_steps")
    domains = q1(cur, "SELECT COUNT(*) FROM domains")
    con.close()
    assert dangling == 0, f"悬空边 {dangling}"
    print("=== 终检 ===")
    print(f"  {n} 节点 / {e} 边 / {domains} 域 / {stories} 故事步 / 悬空边 {dangling}")
    print("✓ 管线全部完成")

if __name__ == "__main__":
    main()

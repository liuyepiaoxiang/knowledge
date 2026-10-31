# -*- coding: utf-8 -*-
"""cn_triage.py — ConceptNet 纹理层分诊 (2026-10-31)

画像结论: cn_ 层 = 日常常识纹理(枢纽为 睡覺/吃飯/快樂), 与核心层零跨层边,
设计定位即 C 级背景纹理 —— 不做 B 级提升, 仅清除"非概念"噪声:
  D1 孤立节点(0边)            —— 死重, cleanup_texture 同款处置
  D2 名称含空格               —— 口语句子片段("玩 ps2")
  D3 名称含数字               —— ("要考 100 分")
  D4 动词短语开头模式          —— ("想殺人""會打扮")
  D5 敏感/不雅词表            —— ("av 女優")
处置: 物理删除(节点+边+证据), 先例 cleanup_texture.py; 可由 corpus/dump 经
     cn_import.py 重新导入恢复。运行: python scripts/cn_triage.py [--dry]
"""
import re
import sys
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

D4_PAT = re.compile(r"^(想|不想|想要|想去|很想|好想|被|喜歡|喜欢|討厭|讨厌|沒|没|去|開始|开始|正在|一直|曾經|曾经|應該|应该|覺得|觉得|已經|已经|很|最|要|真金|超級|超级)")
# 白名单: 以动词前缀开头但本身是正当概念的词
D4_WHITELIST = {"想像力", "想法", "想像", "太陽", "太陽系", "太空人", "超人", "超商", "超載",
                "能力", "能源", "能量", "真心", "真皮", "被單", "被動"}
D5_WORDS = ["殺", "杀", "女優", "av", "ntr", "色情", "裸", "賭", "赌", "毒品", "自殺", "自杀", "強暴", "强奸", "屁", "屎", "尿", "大便", "小便", "做愛", "做爱", "性愛", "性爱", "妓", "嫖"]


def classify(zh: str, deg: int):
    if deg == 0:
        return "D1 孤立"
    if " " in zh:
        return "D2 含空格"
    if re.search(r"\d", zh):
        return "D3 含数字"
    if D4_PAT.match(zh) and len(zh) >= 2 and zh not in D4_WHITELIST:
        return "D4 动词短语"
    low = zh.lower()
    if any(w in low for w in D5_WORDS):
        return "D5 敏感词"
    return None


def main():
    dry = "--dry" in sys.argv
    con = sqlite3.connect(ROOT / "atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    rows = cur.execute("""SELECT n.id, n.zh,
        (SELECT COUNT(*) FROM edges e WHERE e.src=n.id OR e.dst=n.id) d
        FROM nodes n WHERE n.id LIKE 'cn_%'""").fetchall()

    import collections
    verdicts = collections.defaultdict(list)
    for r in rows:
        v = classify(r["zh"] or "", r["d"])
        if v:
            verdicts[v].append(r["id"])

    total_cut = sum(len(v) for v in verdicts.values())
    for k in sorted(verdicts):
        ids = verdicts[k]
        print(f"{k}: {len(ids)} 个; 样例: " + ", ".join(
            next(r['zh'] for r in rows if r['id'] == i) for i in ids[:6]))
    print(f"合计删除: {total_cut} / {len(rows)} ({total_cut*100//len(rows)}%) · 保留纹理 {len(rows)-total_cut}")

    if dry:
        return
    ids_all = [i for v in verdicts.values() for i in v]
    idset = set(ids_all)
    cut_e = 0
    # 分块删除边(IN 条件占位符上限保护)
    edges = cur.execute("SELECT rowid, src, dst FROM edges WHERE src LIKE 'cn_%' OR dst LIKE 'cn_%'").fetchall()
    dead = [r["rowid"] for r in edges if r["src"] in idset or r["dst"] in idset]
    for i in range(0, len(dead), 500):
        chunk = dead[i:i + 500]
        cur.execute(f"DELETE FROM edges WHERE rowid IN ({','.join('?' * len(chunk))})", chunk)
        cut_e += cur.rowcount
    for i in range(0, len(ids_all), 500):
        chunk = ids_all[i:i + 500]
        q = ",".join("?" * len(chunk))
        cur.execute(f"DELETE FROM evidence WHERE node_id IN ({q})", chunk)
        cur.execute(f"DELETE FROM nodes WHERE id IN ({q})", chunk)
    cur.execute("UPDATE nodes SET degree = (SELECT COUNT(*) FROM edges e WHERE e.src=nodes.id OR e.dst=nodes.id)")
    con.commit()
    print(f"已物理删除: 节点 {len(ids_all)} · 边 {cut_e} (可由 dump 经 cn_import.py 恢复)")


if __name__ == "__main__":
    main()

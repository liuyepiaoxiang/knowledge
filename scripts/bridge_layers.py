# -*- coding: utf-8 -*-
"""bridge_layers.py — 跨层连边: CN 纹理层 ↔ 核心层概念桥 (2026-10-31)

画像: cn_ 层与核心层零跨层边(两个孤岛)。简繁转换(zhconv)后同名匹配 44 个,
且正是纹理层最高连接度的枢纽(音樂 deg135/汽車 deg121/飛機 deg60)。
处置: 建 relates_to 桥边(core→cn, weight 0.5), 让纹理光晕锚定到大陆——
     刻意不合并(合并会把 C 级口语边挂上 B 级核心节点, 破坏三层信任模型)。
运行: python scripts/bridge_layers.py [--dry]
"""
import sys
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    from zhconv import convert
    dry = "--dry" in sys.argv
    con = sqlite3.connect(ROOT / "atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    core = {}
    for r in cur.execute("SELECT id, zh FROM nodes WHERE id NOT LIKE 'cn_%'"):
        core.setdefault(r["zh"], r["id"])

    cn = cur.execute("SELECT id, zh, degree FROM nodes WHERE id LIKE 'cn_%'").fetchall()
    bridges = []
    for r in cn:
        s = convert(r["zh"], "zh-hans")
        cid = core.get(s)
        if cid and cid != r["id"]:
            dup = cur.execute("""SELECT 1 FROM edges WHERE type='relates_to'
                AND ((src=? AND dst=?) OR (src=? AND dst=?))""", (cid, r["id"], r["id"], cid)).fetchone()
            if not dup:
                bridges.append((cid, r["id"], r["zh"], s, r["degree"]))

    bridges.sort(key=lambda x: -x[4])
    for cid, nid, zh, s, d in bridges[:12]:
        print(f"  {s} -- {zh} (cn deg {d})")
    print(f"桥边: {len(bridges)} 条")
    if dry:
        return
    for cid, nid, *_ in bridges:
        cur.execute("INSERT INTO edges (src, dst, type, weight, since) VALUES (?,?,?,?,NULL)",
                    (cid, nid, "relates_to", 0.5))
    cur.execute("UPDATE nodes SET degree = (SELECT COUNT(*) FROM edges e WHERE e.src=nodes.id OR e.dst=nodes.id)")
    con.commit()
    print("已写入")


if __name__ == "__main__":
    main()

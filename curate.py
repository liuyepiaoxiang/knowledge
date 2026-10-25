# -*- coding: utf-8 -*-
"""curate.py — 策展队列 CLI: 把 C 级抽取节点逐条复核为 B 级
用法:
  python curate.py stats                  分域统计待策展量
  python curate.py pending [域id] [-n 20] 列出待复核节点(概览)
  python curate.py show <id>              查看某节点全部信息
  python curate.py promote <id> [<id>...] 复核通过: C→B, 置信度 0.9
  python curate.py reject  <id>           剔除: 打上化石标记(不删除)
  python curate.py promote-domain <域id> [-n 30] 批量复核某域前N个C级节点
之后运行 python export.py 同步到前端。
"""
import sys, datetime

def main():
    import sqlite3
    con = sqlite3.connect("atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    argv = sys.argv[1:]
    cmd = argv[0] if argv else "stats"
    today = datetime.date.today().isoformat()

    if cmd == "stats":
        print("— 待策展(C级)分域 —")
        for r in cur.execute("""SELECT d.zh, COUNT(*) c FROM nodes n
                JOIN evidence v ON n.id=v.node_id JOIN domains d ON n.domain=d.id
                WHERE v.grade='C' GROUP BY n.domain ORDER BY c DESC"""):
            print(f"  {r['zh']:<12} {r['c']:>4}")
        b = cur.execute("SELECT COUNT(*) FROM evidence WHERE grade='B' OR grade='A'").fetchone()[0]
        c = cur.execute("SELECT COUNT(*) FROM evidence WHERE grade='C'").fetchone()[0]
        print(f"— 总量: 已复核 {b} · 待策展 {c} —")

    elif cmd == "pending":
        dom = argv[1] if len(argv) > 1 and not argv[1].startswith("-") else None
        limit = 20
        if "-n" in argv: limit = int(argv[argv.index("-n") + 1])
        where = "AND (d.id=? OR d.zh=?)" if dom else ""
        args = (dom, dom) if dom else ()
        for r in cur.execute(f"""SELECT n.id,n.zh,n.type,n.one_liner,n.confidence,d.zh dzh
                FROM nodes n JOIN evidence v ON n.id=v.node_id JOIN domains d ON n.domain=d.id
                WHERE v.grade='C' {where} ORDER BY n.confidence LIMIT ?""", (*args, limit)):
            print(f"  [{r['id']}] {r['zh']} ({r['type']}, {r['dzh']}, conf {r['confidence']})")
            print(f"      {r['one_liner'][:70]}")

    elif cmd == "show":
        nid = argv[1]
        n = cur.execute("SELECT * FROM nodes WHERE id=? OR zh=?", (nid, nid)).fetchone()
        if not n: print("未找到:", nid); return
        print(dict(n))
        for v in cur.execute("SELECT grade,source FROM evidence WHERE node_id=n.id".replace("n.id", "?"), (n["id"],)):
            print("  证据:", dict(v))
        for e in cur.execute("SELECT type,COUNT(*) c FROM edges WHERE src=? OR dst=? GROUP BY type", (n["id"], n["id"])):
            print("  边:", e["type"], e["c"])

    elif cmd == "promote":
        ids = argv[1:]
        for nid in ids:
            rid = cur.execute("SELECT id FROM nodes WHERE id=? OR zh=?", (nid, nid)).fetchone()
            if not rid: print("未找到:", nid); continue
            real = rid["id"]
            cur.execute("UPDATE evidence SET grade='B', source=source || ' | 人工复核 ' || ? WHERE node_id=? AND grade='C'", (today, real))
            cur.execute("UPDATE nodes SET confidence=0.9 WHERE id=?", (real,))
            print(f"✓ 已复核为 B: {real}")
        con.commit()

    elif cmd == "promote-domain":
        dom = argv[1]
        limit = int(argv[argv.index("-n") + 1]) if "-n" in argv else 30
        did = cur.execute("SELECT id FROM domains WHERE id=? OR zh=?", (dom, dom)).fetchone()
        if not did: print("未找到域:", dom); return
        rows = cur.execute("""SELECT n.id, n.zh FROM nodes n JOIN evidence v ON n.id=v.node_id
                WHERE n.domain=? AND v.grade='C' ORDER BY n.confidence DESC LIMIT ?""",
                (did["id"], limit)).fetchall()
        for r in rows:
            cur.execute("UPDATE evidence SET grade='B', source=source || ' | 人工复核 ' || ? WHERE node_id=? AND grade='C'", (today, r["id"]))
            cur.execute("UPDATE nodes SET confidence=0.9 WHERE id=?", (r["id"],))
        con.commit()
        print(f"✓ 批量复核 {len(rows)} 个节点为 B 级")

    elif cmd == "reject":
        nid = argv[1]
        rid = cur.execute("SELECT id FROM nodes WHERE id=? OR zh=?", (nid, nid)).fetchone()
        if not rid: print("未找到:", nid); return
        cur.execute("UPDATE nodes SET status='剔除候选' WHERE id=?", (rid["id"],))
        cur.execute("UPDATE evidence SET source=source || ' | 已标记剔除 ' || ? WHERE node_id=?", (today, rid["id"]))
        con.commit()
        print("✓ 已标记剔除候选:", rid["id"])

    else:
        print(__doc__)

if __name__ == "__main__":
    main()

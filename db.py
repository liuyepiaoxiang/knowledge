# -*- coding: utf-8 -*-
"""db.py — 知识大地 SQLite 查询 CLI
用法:
  python db.py stats                 总览: 版次/计数/域分布/类型分布
  python db.py node <id|名称>        概念卡: 定义/证据/前演后继邻居
  python db.py path <idA> <idB>      最短奠基路径(忽略 part_of/marks/did)
  python db.py domain <域id|域中文名> 域概况: 子域/节点/里程碑
  python db.py search <关键词>       名称/定义模糊检索(前20条)
  python db.py query "<SQL>"         只读 SQL(仅 SELECT)
示例:
  python db.py path 晶体管 mRNA疫苗
  python db.py node 熵
"""
import sqlite3, sys

SKIP_EDGE_TYPES = ("part_of", "marks", "did")   # 结构边, 路径查询忽略
DB = "atlas.db"

def connect():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)   # 只读打开
    con.row_factory = sqlite3.Row
    return con

def resolve_node(cur, key):
    r = cur.execute("SELECT id FROM nodes WHERE id=? OR zh=?", (key, key)).fetchone()
    if r: return r["id"]
    r = cur.execute("SELECT id FROM nodes WHERE zh LIKE ? OR en LIKE ? LIMIT 1",
                    (f"%{key}%", f"%{key}%")).fetchone()
    return r["id"] if r else None

def cmd_stats(cur):
    print("— 版次 —")
    for k, v in cur.execute("SELECT key,value FROM meta"):
        print(f"  {k}: {v}")
    print("— 域分布 —")
    for r in cur.execute("""SELECT d.zh, COUNT(*) c FROM nodes n JOIN domains d ON n.domain=d.id
            GROUP BY n.domain ORDER BY d.ord"""):
        print(f"  {r['zh']:<10} {r['c']:>4}")
    print("— 类型分布 —")
    for r in cur.execute("SELECT type, COUNT(*) c FROM nodes GROUP BY type ORDER BY c DESC"):
        print(f"  {r['type']:<14} {r['c']:>4}")

def cmd_node(cur, key):
    nid = resolve_node(cur, key)
    if not nid: print("未找到:", key); return
    n = cur.execute("SELECT * FROM nodes WHERE id=?", (nid,)).fetchone()
    yr = (f"前{-n['born']}年" if (n['born'] or 0) < 0 else f"{n['born']}年") if n["born"] else "年代不详"
    print(f"◆ {n['zh']} ({n['en']}) · {n['type']} · {yr}"
          + (f" · {n['status']}" if n["status"] else "") + (f" · 传统:{n['tradition']}" if n["tradition"] else ""))
    print("  定义:", n["one_liner"])
    if n["why"]: print("  为什么重要:", n["why"])
    if n["example"]: print("  例子:", n["example"])
    for r in cur.execute("SELECT grade,source FROM evidence WHERE node_id=?", (nid,)):
        print(f"  证据[{r['grade']}]", r["source"])
    for r in cur.execute("""SELECT type, GROUP_CONCAT(z,'、') names FROM (
            SELECT e.type type, b.zh z FROM edges e JOIN nodes b ON e.dst=b.id WHERE e.src=? AND e.type NOT IN (?,?,?)
            UNION ALL SELECT e.type, a.zh FROM edges e JOIN nodes a ON e.src=a.id WHERE e.dst=? AND e.type NOT IN (?,?,?))
            GROUP BY type""", (nid, *SKIP_EDGE_TYPES, nid, *SKIP_EDGE_TYPES)):
        print(f"  {r['type']}: {r['names']}")

def cmd_path(cur, a, b):
    ia, ib = resolve_node(cur, a), resolve_node(cur, b)
    if not ia or not ib: print("未找到端点:", a, b); return
    adj = {}
    for r in cur.execute("SELECT src,dst FROM edges WHERE type NOT IN (?,?,?)", SKIP_EDGE_TYPES):
        adj.setdefault(r["src"], set()).add(r["dst"])
        adj.setdefault(r["dst"], set()).add(r["src"])
    from collections import deque
    prev, seen, q = {ia: None}, {ia}, deque([ia])
    while q:
        c = q.popleft()
        if c == ib: break
        for nb in adj.get(c, ()):
            if nb not in seen:
                seen.add(nb); prev[nb] = c; q.append(nb)
    if ib not in seen:
        print(f"「{a}」与「{b}」之间无语义路径(仅靠结构边不可达)"); return
    chain, c = [], ib
    while c: chain.append(c); c = prev[c]
    zh = {r["id"]: r["zh"] for r in cur.execute("SELECT id,zh FROM nodes")}
    print(" ⟶ ".join(zh[i] for i in reversed(chain)))
    print(f"  (共 {len(chain)-1} 跳)")

def cmd_domain(cur, key):
    r = cur.execute("SELECT id,zh FROM domains WHERE id=? OR zh=?", (key, key)).fetchone()
    if not r: print("未找到域:", key); return
    dom, zh = r["id"], r["zh"]
    print(f"■ {zh}")
    n = cur.execute("SELECT COUNT(*) c FROM nodes WHERE domain=?", (dom,)).fetchone()["c"]
    yrs = cur.execute("SELECT MIN(born) a, MAX(born) b FROM nodes WHERE domain=? AND born IS NOT NULL", (dom,)).fetchone()
    print(f"  节点 {n} · 年代跨度 {yrs['a']} — {yrs['b']}")
    print("  子领域:")
    for f in cur.execute("SELECT zh,en FROM nodes WHERE domain=? AND type='Field' ORDER BY born", (dom,)):
        print(f"    · {f['zh']} ({f['en']})")
    print("  里程碑:")
    for e in cur.execute("SELECT zh,born FROM nodes WHERE domain=? AND type='Event' AND born IS NOT NULL ORDER BY born", (dom,)):
        yr = f"前{-e['born']}" if e["born"] < 0 else str(e["born"])
        print(f"    {yr:>9}  {e['zh']}")

def cmd_search(cur, kw):
    for r in cur.execute("""SELECT id,zh,type,born,one_liner FROM nodes
            WHERE zh LIKE ? OR en LIKE ? OR one_liner LIKE ? LIMIT 20""",
            (f"%{kw}%",) * 3):
        yr = f"前{-r['born']}" if (r['born'] or 0) < 0 else r['born']
        print(f"  [{r['type']}] {r['zh']} ({r['id']}) {yr or ''} — {r['one_liner'][:60]}")

def cmd_query(cur, sql):
    if not sql.strip().lower().startswith("select"):
        print("只允许只读 SELECT"); return
    for r in cur.execute(sql):
        print(dict(r))

def main():
    argv = sys.argv[1:]
    if not argv:
        print(__doc__); return
    cmd, *args = argv
    cur = connect().cursor()
    if cmd == "stats" and not args: cmd_stats(cur)
    elif cmd == "node" and args: cmd_node(cur, args[0])
    elif cmd == "path" and len(args) >= 2: cmd_path(cur, args[0], args[1])
    elif cmd == "domain" and args: cmd_domain(cur, args[0])
    elif cmd == "search" and args: cmd_search(cur, args[0])
    elif cmd == "query" and args: cmd_query(cur, args[0])
    else: print(__doc__)

if __name__ == "__main__":
    main()

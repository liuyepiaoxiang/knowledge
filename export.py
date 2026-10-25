# -*- coding: utf-8 -*-
"""export.py — 从 SQLite 导出全量图
atlas.db -> api/*.json + js/data_full.js (window.GRAPH_FULL, 前端优先加载)
运行: python export.py
"""
import json, os, sqlite3
from collections import defaultdict
from datetime import date

EDITION = "v0.9"

def main():
    con = sqlite3.connect("file:atlas.db?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    domains = [{"id": r["id"], "zh": r["zh"], "en": r["en"]}
               for r in cur.execute("SELECT id,zh,en FROM domains ORDER BY ord")]
    ev = defaultdict(list)
    for r in cur.execute("SELECT node_id,grade,source FROM evidence ORDER BY rowid"):
        ev[r["node_id"]].extend([r["grade"], r["source"]])
    ev_list = cur.execute("SELECT node_id,grade FROM evidence").fetchall()
    ev_list = [{"g": r["grade"]} for r in ev_list]
    nodes = []
    for r in cur.execute("""SELECT id,type,zh,en,domain,born,died,one_liner,why,example,
                            status,tradition,confidence FROM nodes"""):
        evs = ev.get(r["id"], [])
        nodes.append({
            "id": r["id"], "t": r["type"], "zh": r["zh"], "en": r["en"], "dom": r["domain"],
            "born": r["born"], "died": r["died"], "one": r["one_liner"],
            "why": r["why"], "ex": r["example"],
            "ev": evs if evs else ["C", "未标注"],
            "conf": round(r["confidence"], 2), "status": r["status"], "tr": r["tradition"],
        })
    ctx = {}
    for r in cur.execute("SELECT src,dst,sentence FROM edge_context"):
        key = tuple(sorted((r["src"], r["dst"])))
        ctx.setdefault(key, r["sentence"])
    edges = []
    for r in cur.execute("SELECT src,dst,type,weight,since FROM edges"):
        c = ctx.get(tuple(sorted((r["src"], r["dst"]))))
        edges.append({"from": r["src"], "to": r["dst"], "type": r["type"],
                      "weight": r["weight"], "since": r["since"], "ctx": c})
    stories = defaultdict(lambda: {"steps": []})
    for r in cur.execute("""SELECT story_id,story_zh,story_desc,step,node_id,text
                            FROM story_steps ORDER BY story_id,step"""):
        s = stories[r["story_id"]]
        s.update({"id": r["story_id"], "zh": r["story_zh"], "desc": r["story_desc"]})
        s["steps"].append({"id": r["node_id"], "text": r["text"]})
    story_list = list(stories.values())

    meta = {
        "name": "知识大地 Terra Cognita · 人类知识与技术底图",
        "edition": EDITION,
        "generated": date.today().isoformat(),
        "counts": {"nodes": len(nodes), "edges": len(edges), "domains": len(domains)},
        "layers": {"B": sum(1 for e in ev_list if e["g"] in ("A", "B")),
                   "C": sum(1 for e in ev_list if e["g"] == "C")},
        "license": "来源数据遵循其原始许可(Wikipedia 内容 CC BY-SA, 需署名+相同方式共享); 请保留证据溯源字段",
        "domains": domains,
    }

    os.makedirs("api", exist_ok=True)
    def w(path, data):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
    w("api/meta.json", meta)
    w("api/nodes.json", nodes)
    w("api/edges.json", edges)
    w("api/graph.json", dict(meta, nodes=nodes, edges=edges))
    w("api/stories.json", story_list)

    # 核心 = 非 cn_ 节点; 扩展 = cn_ 层 (ConceptNet 导入, 延迟合并)
    cn_ids = {n["id"] for n in nodes if n["id"].startswith("cn_")}
    core_nodes = [n for n in nodes if n["id"] not in cn_ids]
    core_edges = [[e["from"], e["to"], e["type"], e["weight"], e["since"]] +
                  ([e["ctx"]] if e.get("ctx") else [])
                  for e in edges if e["from"] not in cn_ids and e["to"] not in cn_ids]
    cn_nodes = [n for n in nodes if n["id"] in cn_ids]
    cn_edges = [[e["from"], e["to"], e["type"], e["weight"], e["since"]] +
                ([e["ctx"]] if e.get("ctx") else [])
                for e in edges if e["from"] in cn_ids or e["to"] in cn_ids]

    with open("js/data_full.js", "w", encoding="utf-8") as f:
        f.write("/* 核心(策展)+扩展(ConceptNet), 边为元组格式 */\n")
        f.write("window.GRAPH_CORE = ")
        f.write(json.dumps({"domains": domains, "nodes": core_nodes, "edges": core_edges,
                            "stories": story_list}, ensure_ascii=False))
        f.write(";\nwindow.GRAPH_EXT = ")
        f.write(json.dumps({"nodes": cn_nodes, "edges": cn_edges}, ensure_ascii=False))
        f.write(";\n")

    files = ["meta.json", "nodes.json", "edges.json", "graph.json", "stories.json"]
    manifest = {"generated": meta["generated"], "files": []}
    for fn in files:
        kb = round(os.path.getsize(os.path.join("api", fn)) / 102.4) / 10
        desc = {"meta.json": "版次/计数/许可/域清单", "nodes.json": "全部节点(含证据/置信度)",
                "edges.json": "全部边", "graph.json": "全图一次拉取",
                "stories.json": "故事导览脚本"}[fn]
        manifest["files"].append({"file": fn, "desc": desc, "kb": kb, "bytes": kb * 1024})
    with open("api/manifest.js", "w", encoding="utf-8") as f:
        f.write("/* 由 export.py 生成 */\nwindow.API_MANIFEST = ")
        f.write(json.dumps(manifest, ensure_ascii=False, indent=1) + ";")

    by_type = defaultdict(int)
    for n in nodes: by_type[n["t"]] += 1
    print(f"✓ 导出完成: 版次 {EDITION} · {len(nodes)} 节点 / {len(edges)} 边 / {len(domains)} 域")
    print("  类型分布:", ", ".join(f"{k}{v}" for k, v in sorted(by_type.items(), key=lambda x: -x[1])))
    print(f"  api/graph.json {round(os.path.getsize('api/graph.json')/1024)} KB · js/data_full.js {round(os.path.getsize('js/data_full.js')/1024)} KB")
    con.close()

if __name__ == "__main__":
    main()

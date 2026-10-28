# -*- coding: utf-8 -*-
"""export.py — 从 SQLite 导出全量图
atlas.db -> public/data/(core.json/ext.json/meta.json/manifest.js, 部署到前端)
         + api/*.json (开放 API 大文件, 管线中间产物, 不部署)
运行: python scripts/export.py
"""
import json, os, sqlite3, sys
from collections import defaultdict
from datetime import date
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):   # Windows GBK 控制台容错
        _s.reconfigure(errors="replace")

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

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

    OUT = ROOT / "public" / "data"
    OUT.mkdir(parents=True, exist_ok=True)

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

    def wjson(p, data, indent=None):
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)

    wjson(OUT / "core.json", {"domains": domains, "nodes": core_nodes,
                              "edges": core_edges, "stories": story_list})
    wjson(OUT / "ext.json", {"nodes": cn_nodes, "edges": cn_edges})
    wjson(OUT / "meta.json", meta)

    # 开放 API 大文件仍写本地 api/（管线中间产物, 不部署）
    api_dir = ROOT / "api"
    api_dir.mkdir(exist_ok=True)
    wjson(api_dir / "meta.json", meta, indent=1)
    wjson(api_dir / "nodes.json", nodes, indent=1)
    wjson(api_dir / "edges.json", edges, indent=1)
    wjson(api_dir / "graph.json", dict(meta, nodes=nodes, edges=edges), indent=1)
    wjson(api_dir / "stories.json", story_list, indent=1)

    files = ["meta.json", "nodes.json", "edges.json", "graph.json", "stories.json"]
    manifest = {"generated": meta["generated"], "files": []}
    for fn in files:
        kb = round((api_dir / fn).stat().st_size / 102.4) / 10
        desc = {"meta.json": "版次/计数/许可/域清单", "nodes.json": "全部节点(含证据/置信度)",
                "edges.json": "全部边", "graph.json": "全图一次拉取",
                "stories.json": "故事导览脚本"}[fn]
        manifest["files"].append({"file": fn, "desc": desc, "kb": kb, "bytes": kb * 1024})
    with open(OUT / "manifest.js", "w", encoding="utf-8") as f:
        f.write("/* 由 export.py 生成 */\nwindow.API_MANIFEST = ")
        f.write(json.dumps(manifest, ensure_ascii=False, indent=1) + ";")

    by_type = defaultdict(int)
    for n in nodes: by_type[n["t"]] += 1
    print(f"✓ 导出完成: 版次 {EDITION} · {len(nodes)} 节点 / {len(edges)} 边 / {len(domains)} 域")
    print(f"  public/data/core.json {round((OUT / 'core.json').stat().st_size / 1024)} KB · "
          f"ext.json {round((OUT / 'ext.json').stat().st_size / 1024)} KB")
    con.close()

if __name__ == "__main__":
    main()

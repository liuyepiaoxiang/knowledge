# -*- coding: utf-8 -*-
"""extract.py — LLM/网络 概念抽取管线
语料: corpus/batch*.tsv (field, name, year, def, type?)
  - offline 模式(默认): 语料由 LLM 生成(即模型抽取输出), 管线负责规范化/去重/连边
  - wikipedia 模式: 预留适配器, 网络可达时 --source wikipedia 启用 (当前网络不可达)
入库: atlas.db, 证据等级 C, 置信度 0.6, 自动共现连边
运行: python extract.py
"""
import glob, hashlib, os, sqlite3, sys, re

GRADE, SOURCE, CONF = "C", "LLM抽取语料 v0.4", 0.6
SKIP_TYPES = ("part_of", "marks", "did")
TYPES = {"Domain","Field","Topic","Concept","Theory","Proposition","Method","Skill",
         "Technology","Process","Material","Instrument","Product","Problem","Dataset",
         "Controversy","Person","Event"}

def main():
    con = sqlite3.connect("atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    existing_names = {r["zh"]: r["id"] for r in cur.execute("SELECT zh,id FROM nodes")}
    existing_en = {r["en"]: r["id"] for r in cur.execute("SELECT en,id FROM nodes WHERE en IS NOT NULL")}
    field_dom = {r["id"]: r["domain"] for r in cur.execute("SELECT id,domain FROM nodes WHERE type='Field'")}
    fields = {r["id"]: r["zh"] for r in cur.execute("SELECT id,zh FROM nodes WHERE type='Field'")}
    # 便捷桶 -> 真实子域 (人物/事件批次用)
    FIELD_MAP = {
        "f_physics_persons": "f_modern", "f_cs_persons": "f_theory_cs", "f_bio_persons": "f_molbio",
        "f_med_persons": "f_clinical", "f_chem_persons": "f_organic", "f_math_persons": "f_algebra",
        "f_soc_persons": "f_sociology", "f_hum_persons": "f_history", "f_art_persons": "f_visual",
        "f_law_persons": "f_legaltheory", "f_econ_persons": "f_econ", "f_edu_persons": "f_pedagogy",
        "f_eng_persons": "f_arch", "f_earth_persons": "f_geology", "f_prac_persons": "f_craft",
        "f_astro_events": "f_astro", "f_optics_events": "f_optics", "f_particle_events": "f_particle",
        "f_chem_events": "f_inorganic", "f_geology_events": "f_geology", "f_climate_events": "f_climate",
        "f_envir_events": "f_envir", "f_cs_events": "f_arch", "f_bio_events": "f_molbio",
        "f_med_events": "f_clinical", "f_agri_events": "f_crop", "f_soc_events": "f_sociology",
        "f_hum_events": "f_history", "f_art_events": "f_visual", "f_law_events": "f_legaltheory",
        "f_econ_events": "f_finance", "f_edu_events": "f_pedagogy", "f_eng_events": "f_arch",
        "f_bigbang": "f_astro",
    }
    fields.update(FIELD_MAP)
    for k, v in FIELD_MAP.items():
        field_dom.setdefault(k, field_dom.get(v, "dom_form"))

    rows = []
    for path in sorted(glob.glob("corpus/batch*.tsv")):
        with open(path, encoding="utf-8") as f:
            head = f.readline().split("\t")
            for ln in f:
                cols = (ln.rstrip("\n").split("\t") + [""] * 5)[:5]
                fld, name, year, desc, typ = [c.strip() for c in cols]
                if not fld or not name: continue
                if typ and typ not in TYPES: typ = "Topic"   # 语料误列(如 T L9) 归为 Topic
                rows.append((fld, name, year, desc, typ or "Topic"))
    print(f"语料行: {len(rows)} (来自 {len(glob.glob('corpus/batch*.tsv'))} 个批次)")

    new_nodes, new_edges, skipped = [], [], {"dup": 0, "badfield": 0}
    for fld, name, year, desc, typ in rows:
        if name in existing_names: skipped["dup"] += 1; continue
        if fld not in fields: skipped["badfield"] += 1; continue
        nid = "x_" + hashlib.md5(name.encode()).hexdigest()[:10]
        dom = field_dom[fld]
        born = int(year) if re.fullmatch(r"-?\d{1,5}", year or "") else None
        one = desc or (name + "——" + fields[fld] + "的概念")
        new_nodes.append((nid, typ, name, None, dom, born, None, one, None, None, None, None, CONF))
        new_edges.append((nid, fld, "part_of", 1.0, None))
        existing_names[name] = nid
        new_nodes and existing_names  # noqa

    # 共现连边: 新节点定义/名称中出现既有概念名 → relates_to
    mention = sorted([(zh, i) for zh, i in existing_names.items() if len(zh) >= 2], key=lambda x: -len(x[0]))
    linked = 0
    for cols in new_nodes:
        nid, typ, name, en, dom, born, died, one, *_ = cols
        text = (name or "") + "。" + (one or "")
        hit = 0
        for zh, oid in mention:
            if oid == nid or hit >= 2: continue
            if zh in text and (nid, oid, "relates_to") not in {(e[0], e[1], e[2]) for e in new_edges}:
                new_edges.append((nid, oid, "relates_to", 0.4, born))
                hit += 1; linked += 1

    cur.executemany("""INSERT OR IGNORE INTO nodes
        (id,type,zh,en,domain,born,died,one_liner,why,example,status,tradition,confidence)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", new_nodes)
    cur.executemany("INSERT OR IGNORE INTO evidence VALUES (?,?,?)",
                    [(n[0], GRADE, SOURCE) for n in new_nodes])
    cur.executemany("INSERT OR IGNORE INTO edges VALUES (?,?,?,?,?)", new_edges)
    cur.executemany("UPDATE nodes SET degree=degree+1 WHERE id IN (?,?)",
                    [(e[0], e[1]) for e in new_edges])
    cur.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)", [
        ("edition", "v0.4"), ("extract_source", "offline-LLM-corpus")])
    con.commit()

    n_total = cur.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
    e_total = cur.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
    print(f"✓ 抽取入库: 新节点 {len(new_nodes)}, 新边 {len(new_edges)}(含共现 {linked}), 跳过 {skipped}")
    print(f"  库内总量: {n_total} 节点 / {e_total} 边")
    con.close()

if __name__ == "__main__":
    main()

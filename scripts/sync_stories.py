# -*- coding: utf-8 -*-
"""sync_stories.py — 将 api/stories.json (来自 data.js STORIES) 同步到 atlas.db 的 story_steps
只替换故事表, 不触碰节点/边。运行: python sync_stories.py
"""
import json, os, sqlite3, sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):   # Windows GBK 控制台容错
        _s.reconfigure(errors="replace")

ROOT = Path(__file__).resolve().parents[1]

def main():
    os.chdir(ROOT)
    stories = json.load(open("api/stories.json", encoding="utf-8"))
    con = sqlite3.connect("atlas.db")
    cur = con.cursor()
    cur.execute("DELETE FROM story_steps")
    rows = []
    for s in stories:
        for i, st in enumerate(s["steps"]):
            rows.append((s["id"], s["zh"], s.get("desc", ""), i, st["id"], st["text"]))
    cur.executemany("INSERT INTO story_steps VALUES (?,?,?,?,?,?)", rows)
    con.commit()
    print(f"✓ 故事同步: {len(stories)} 条 / {len(rows)} 步")
    con.close()

if __name__ == "__main__":
    main()

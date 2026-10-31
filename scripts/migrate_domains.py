# -*- coding: utf-8 -*-
"""migrate_domains.py — 跨域迁移: 域错配剔除节点归位 (2026-10-31)

来源: 四批策展中因"域错配"被剔除的 63 条, 其中 58 条迁移到正确域并复核为 B
(剔除理由即位置错误而非质量问题); 5 条维持剔除(重复/低价值)。
处置: UPDATE domain + status 置空 + 证据 C→B('LLM迁移复核') + confidence 0.9
     + 顺带繁简/类型/生年修正。运行: python scripts/migrate_domains.py [--dry]
"""
import sys
import datetime
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# (id, 目标域, zh_fix, type_fix, born_fix)
MIGRATE = [
    ("x_03cd239c51", "dom_econ", None, None, None),          # 经济史→经济
    ("w_57406b30a8", "dom_eng", None, None, None),           # 核技术→工程
    ("w_512ca8fb8a", "dom_soc", None, None, None),           # 城市化→社科
    ("w_29e17ba066", "dom_soc", None, None, None),           # 智慧城市→社科
    ("w_e03c331c3c", "dom_eng", None, None, None),           # 瞄准镜→工程(仪器)
    ("w_680aa93df9", "dom_bio", None, None, None),           # 磷脂双分子层→生物
    ("w_ffb93bb549", "dom_cs", None, None, None),            # 计算机视觉→计算机
    ("w_2bf65f0b16", "dom_soc", None, None, None),           # 认知科学→社科(心理)
    ("w_e5cd8b0f51", "dom_earth", None, None, None),         # 污染→地球气候
    ("w_2cc60d3b30", "dom_eng", None, None, None),           # 太阳能→工程(能源)
    ("w_5d6a59b2f2", "dom_econ", None, None, None),          # 管理学→经济
    ("w_c9c4557fcb", "dom_eng", None, None, None),           # 电子工程→工程
    ("w_5db2c47afd", "dom_soc", None, None, None),           # 政治学→社科
    ("w_9ca51c79bb", "dom_edu", None, None, None),           # 传播学→教育传播
    ("w_414c2a5030", "dom_eng", None, None, None),           # 核武器→工程
    ("w_9935fd8a32", "dom_form", None, None, None),          # 系统科学→形式科学
    ("w_4b8712eb3a", "dom_form", None, None, None),          # 动力系统→形式科学
    ("w_4f89ab7495", "dom_chem", None, None, None),          # 荧光→化学(光化学)
    ("w_cfa4ac0978", "dom_hum", "现象学", None, None),        # 現象學→人文(繁简)
    ("w_194ad7c9fa", "dom_econ", None, None, None),          # 英国经济→经济
    ("w_85dad92449", "dom_form", "张量", None, None),         # 張量→形式科学(繁简)
    ("w_51d3c2702b", "dom_prac", None, None, None),          # 家政学→实践技艺
    ("w_8ba12c2c3d", "dom_earth", None, None, None),         # 空气→地球气候
    ("w_c3e9ee92b0", "dom_eng", None, None, None),           # 核安全→工程
    ("w_68aff41f8f", "dom_cs", "计算机图形学", None, None),    # 计算机图形→计算机
    ("w_ff89f4ffff", "dom_eng", None, None, None),           # 核燃料→工程
    ("w_54d9923e2c", "dom_edu", None, None, None),           # 教育史→教育传播
    ("w_99b352d9dd", "dom_art", None, None, None),           # 新古典主义建筑→艺术
    ("w_93d27e8a71", "dom_med", None, "Person", 1930),        # 屠呦呦→医学
    ("w_19839695d8", "dom_econ", None, None, None),          # 中国工业→经济
    ("w_6f157325c0", "dom_eng", None, None, None),           # 薄膜→工程(材料)
    ("w_023cc905ae", "dom_hum", "东方学", None, None),        # 东方研究→人文
    ("w_28a284c63a", "dom_earth", None, None, None),         # 气象雷达→地球气候
    ("w_f360c5c549", "dom_econ", None, None, None),          # 文化产业→经济
    ("w_3079a19a23", "dom_hum", None, None, None),           # 乌托邦→人文
    ("w_41891c9aa1", "dom_chem", None, None, None),          # 氢化铝→化学
    ("w_8fc0961486", "dom_soc", None, None, None),           # 亲密关系→社科(心理)
    ("w_c9426c6604", "dom_hum", None, None, None),           # 航空史→人文(科技史)
    ("w_1f02f411cf", "dom_earth", None, None, None),         # 地球→地球气候
    ("w_1d36bcde43", "dom_med", None, None, None),           # 生物医学→医学
    ("w_f731f9786e", "dom_eng", None, None, None),           # 含水量→工程
    ("w_ca10461ad2", "dom_eng", None, None, None),           # 发现计划→工程(航天)
    ("w_3f6d5e353a", "dom_med", None, None, None),           # 肺癌→医学
    ("w_9f257cd27b", "dom_econ", None, None, None),          # 互联网+→经济(政策)
    ("w_f11d874334", "dom_eng", None, None, None),           # 卡拉拉大理石→工程(材料)
    ("x_c26c79f04c", "dom_eng", None, None, None),           # 爱迪生→工程
    ("x_9edef009c2", "dom_eng", None, None, None),           # 特斯拉→工程
    ("x_5a30d4d379", "dom_eng", None, None, None),           # 莱特兄弟→工程
    ("x_3ce9663af0", "dom_eng", None, None, None),           # 科罗廖夫→工程
    ("x_c313cd1232", "dom_eng", None, "Person", None),        # 茅以升→工程
    ("x_d2735e845b", "dom_physics", None, None, None),       # 富兰克林风筝实验→物理
    ("x_ac87249108", "dom_eng", None, None, None),           # 交流电系统胜出→工程
    ("x_aa0b506d8f", "dom_bio", None, None, None),           # 人类基因组测序完成→生物
    ("x_cf1b2aa1d7", "dom_eng", None, None, None),           # 嫦娥四号月背着陆→工程
    ("x_912ac81b4b", "dom_chem", None, None, None),          # 化学平衡常数→化学
    ("x_9e742b3445", "dom_cs", None, None, None),            # 语义网→计算机
    ("x_bb48182543", "dom_cs", None, None, None),            # 知识图谱→计算机
    ("x_8014804617", "dom_econ", None, None, None),          # 能源经济学→经济
]

# 维持剔除: 空气污染(重复:大气污染) / 马克龙 / 健康码 / dna双螺旋50周年(重复) / 军民融合


def main():
    dry = "--dry" in sys.argv
    con = sqlite3.connect(ROOT / "atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    today = datetime.date.today().isoformat()
    n = 0
    for nid, dom, zfix, tfix, bfix in MIGRATE:
        r = cur.execute("SELECT id, zh, domain FROM nodes WHERE id=?", (nid,)).fetchone()
        if not r:
            print("未找到:", nid)
            continue
        if not dry:
            sets = ["domain=?", "status=NULL", "confidence=0.9"]
            args = [dom]
            if zfix: sets.append("zh=?"); args.append(zfix)
            if tfix: sets.append("type=?"); args.append(tfix)
            if bfix: sets.append("born=?"); args.append(bfix)
            cur.execute(f"UPDATE nodes SET {','.join(sets)} WHERE id=?", (*args, nid))
            cur.execute("UPDATE evidence SET grade='B', source=source || ' | LLM迁移复核 ' || ? WHERE node_id=? AND grade='C'", (today, nid))
        n += 1
        print(f"  {r['zh']}: {r['domain']} -> {dom}")
    if not dry:
        con.commit()
    print(f"迁移 {n} 条" + (" (dry)" if dry else ""))


if __name__ == "__main__":
    main()

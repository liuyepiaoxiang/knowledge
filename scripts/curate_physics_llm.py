# -*- coding: utf-8 -*-
"""curate_physics_llm.py — 物理学域 LLM 辅助批量策展试点 (2026-10-31)

对象: dom_physics 全部 205 条 C 级待策展节点 (x_=LLM抽取层 / w_=维基扫描层)
判定: 逐条三选一 —— promote(复核为B+补强 born/en/type) / reject(剔除候选)
语义: 与 curate.py promote/reject 完全一致 (grade C→B, confidence 0.9,
      证据 source 追加 'LLM复核 <date>'; 剔除打 status='剔除候选')
判据: 概念真实且重要 / one_liner 准确 / 与既有 A/B 级无重复 / 域匹配物理学
运行: python scripts/curate_physics_llm.py [--dry]
"""
import sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# (id, born, en, type_fix, zh_fix) —— None 表示不改该字段
PROMOTE = [
    # ---- LLM 抽取层 (x_) ----
    ("x_1ca916e418", 1998, "neutrino oscillation", None, None),          # 中微子振荡
    ("x_5ae75a546b", 1998, "neutrino mass", None, None),                 # 中微子质量
    ("x_742d764f8f", 2004, "two-dimensional materials", None, None),     # 二维材料
    ("x_c7772fba7e", None, "luminosity and cross section", "Method", None),  # 亮度与截面
    ("x_2d8b7c446a", 1908, "low-temperature physics", None, None),       # 低温物理
    ("x_27cf8f6d63", 1961, "thermodynamics of information", None, None), # 信息热力学
    ("x_c299a1ee3a", 1946, "Fourier optics", None, None),                # 傅里叶光学
    ("x_5cc99d1ba2", 2001, "optical atomic clock", None, None),          # 光学原子钟
    ("x_b9bb55461e", 1935, "optical coating", None, None),               # 光学薄膜
    ("x_ac4fb044d3", 1905, "photoelectric effect", None, None),          # 光电效应
    ("x_00a6abeb44", 1966, "optical fiber communication", None, None),   # 光纤通信
    ("x_b77199eb0c", None, "hyperspectral imaging", None, None),         # 光谱成像
    ("x_89acf0ad5c", 1982, "quasicrystal", None, None),                  # 准晶
    ("x_d9882fe003", None, "geometric optics", None, None),              # 几何光学
    ("x_358bfe7936", 1959, "semiconductor process physics", None, None), # 半导体制程物理
    ("x_56504f2341", 1962, "semiconductor laser", None, None),           # 半导体激光器
    ("x_a976692baa", 1931, "semiconductor physics", None, None),         # 半导体物理
    ("x_f66dd4d368", 1824, "Carnot cycle", None, None),                  # 卡诺循环
    ("x_d216b166ad", 1871, "Ernest Rutherford", None, None),             # 卢瑟福
    ("x_3c3c6eaa7e", None, "protoplanetary disk", None, None),           # 原行星盘
    ("x_5221aa0e9b", 1913, "isotope", None, None),                       # 同位素
    ("x_4047e5f9fb", 1990, "Hubble Space Telescope launch", None, None), # 哈勃太空望远镜发射
    ("x_0a9bb16c0b", 1929, "Hubble's law", "Proposition", None),         # 哈勃定律(事件→命题)
    ("x_205e276a72", 1543, "De revolutionibus orbium coelestium", None, None),  # 天球运行论
    ("x_c96d186cd8", 1845, "Kirchhoff's circuit laws", None, None),      # 基尔霍夫电路定律
    ("x_2b092556f2", 1992, "phononic crystal", None, None),              # 声子晶体
    ("x_873b96e2da", 1890, "many-body problem", None, None),             # 多体问题
    ("x_e230d9912c", 2008, "Large Hadron Collider", None, None),         # 大型强子对撞机
    ("x_d56f90d1aa", 1687, "celestial mechanics", None, None),           # 天体力学
    ("x_5a1805161f", 1888, "antenna theory", None, None),                # 天线理论
    ("x_c982e6f74c", 1964, "quark", None, None),                         # 夸克
    ("x_c42a500c50", 1992, "CMB anisotropy", None, None),                # 宇宙微波背景各向异性
    ("x_732a483e3b", 1932, "cosmic ray physics", None, None),            # 宇宙线物理
    ("x_f9bcca5eb7", 1820, "Ampère's law", None, None),                  # 安培定律
    ("x_4153a0a191", 1701, "convective heat transfer", None, None),      # 对流传热
    ("x_363d1c3cc2", 1932, "radio astronomy", None, None),               # 射电天文学
    ("x_c63e49be1c", 1946, "radio interferometry", None, None),          # 射电干涉测量
    ("x_9f1f50c5c3", 1867, "Marie Curie", None, None),                   # 居里夫人
    ("x_3065300433", 1964, "Higgs mechanism", None, None),               # 希格斯机制
    ("x_490e9a652f", 1785, "Coulomb's law", None, None),                 # 库仑定律
    ("x_50d8bfcbcd", 1923, "Compton scattering", None, None),            # 康普顿散射
    ("x_7d04b677ef", 1609, "Kepler's laws of planetary motion", None, None),  # 开普勒三定律
    ("x_04fa2190f5", 1963, "heterojunction and quantum well", None, None),    # 异质结与量子阱
    ("x_318fe2fbf1", 2017, "multi-messenger astronomy", None, None),     # 引力波多信使天文学
    ("x_ff913a8252", 1936, "gravitational lensing", None, None),         # 引力透镜
    ("x_7ded3df71f", 1930, "weak interaction", None, None),              # 弱相互作用
    ("x_b662aed504", 1935, "strong interaction", None, None),            # 强相互作用
    ("x_3f913fc4a6", 2007, "fast radio burst", None, None),              # 快速射电暴
    ("x_df96de0e8a", 1890, "stellar classification", None, None),        # 恒星光谱分类
    ("x_1be5de9979", 1938, "stellar evolution", None, None),             # 恒星演化
    ("x_fd572178c7", None, "imaging systems", None, None),               # 成像系统
    ("x_62ea58f763", 2007, "topological insulator", None, None),         # 拓扑绝缘体
    ("x_b7bfdb461a", None, "galaxy merger", None, None),                 # 星系合并
    ("x_d16b463939", None, "galaxy formation and evolution", None, None),# 星系形成与演化
    ("x_90850c60e7", None, "dark matter detection", None, None),         # 暗物质探测实验
    ("x_d1f11a55a6", 1662, "principle of least action", None, None),     # 最小作用量原理
    ("x_47394b9d8c", None, "beam physics", None, None),                  # 束流物理
    ("x_5e576bdaa7", 1827, "Ohm's law", None, None),                     # 欧姆定律
    ("x_3b54d91029", 1932, "positron", None, None),                      # 正电子
    ("x_99e8f46761", 1831, "Faraday's law of induction", None, None),    # 法拉第电磁感应
    ("x_e08d0a6b1b", 1801, "wave optics", None, None),                   # 波动光学
    ("x_c9567ecce8", 1963, "active galactic nucleus", None, None),       # 活动星系核
    ("x_372bebbed3", 1846, "discovery of Neptune", None, None),          # 海王星的笔尖发现
    ("x_fb4935f860", 1834, "eddy current", None, None),                  # 涡流
    ("x_20e2bd256f", 1850, "liquid crystal", "Material", None),          # 液晶(→材料)
    ("x_d4af6ae460", 1687, "theory of tides", None, None),               # 潮汐理论
    ("x_c0c8b9298a", 1969, "lunar laser ranging", None, None),           # 激光测月
    ("x_84adfa1db5", None, "exciton", None, None),                       # 激子
    ("x_6643719062", 1822, "heat conduction", None, None),               # 热传导
    ("x_021ee31c41", 1666, "Newton's prism experiment", None, None),     # 牛顿色散实验
    ("x_4fcd0f74ad", 1902, "Paul Dirac", None, None),                    # 狄拉克
    ("x_48447b8621", 1885, "Niels Bohr", None, None),                    # 玻尔
    ("x_d2d79b5000", 1844, "Ludwig Boltzmann", None, None),              # 玻尔兹曼
    ("x_fc9d3e5b36", 1868, "Boltzmann distribution", None, None),        # 玻尔兹曼分布
    ("x_caca841aca", 1995, "Bose-Einstein condensate", None, None),      # 玻色-爱因斯坦凝聚
    ("x_d5dac639af", 1897, "discovery of the electron", None, None),     # 电子的发现
    ("x_a2f9860cac", None, "electromagnetic compatibility", None, None), # 电磁兼容
    ("x_d4aa417daf", 1887, "electromagnetic spectrum", None, None),      # 电磁波谱
    ("x_3a456da4a9", 1869, "phase transition and critical point", None, None),  # 相变与临界点
    ("x_712d719274", 1876, "Gibbs phase rule", None, None),              # 相律
    ("x_a582708593", None, "physics of MRI", None, None),                # 磁共振成像物理
    ("x_7b05d4b4fa", 1600, "magnetic materials", None, None),            # 磁性材料
    ("x_4965422a77", 1929, "plasma physics", None, None),                # 等离子体物理
    ("x_a289f3dbd9", 1963, "quasar", None, None),                        # 类星体
    ("x_a1d51ba18a", None, "accelerator physics", None, None),           # 粒子加速器物理
    ("x_6b05053bf0", 1968, "particle detector", None, None),             # 粒子探测器
    ("x_dc5d3ca824", 1995, "exoplanet", None, None),                     # 系外行星
    ("x_c2fe440e39", 1999, "transit method", None, None),                # 系外行星凌星法
    ("x_e8b38d6c14", 1936, "muon", None, None),                          # 缪子
    ("x_71fcffcffb", 1967, "pulsar", None, None),                        # 脉冲星
    ("x_1b5c0c5555", 1953, "adaptive optics", None, None),               # 自适应光学
    ("x_ff071d20aa", None, "Mott insulator", None, None),                # 莫特绝缘体
    ("x_26be4901f3", None, "diffractive optical element", None, None),   # 衍射光学元件
    ("x_0b455bfa80", 1687, "conservation of angular momentum", None, None),  # 角动量守恒
    ("x_0fa5e63607", 1918, "Richard Feynman", None, None),               # 费曼
    ("x_4f40e1e02f", 1781, "discovery of Uranus", None, None),           # 赫歇尔发现天王星
    ("x_7d1f575dd3", 1971, "supersymmetry", None, None),                 # 超对称(年份修正)
    ("x_0978cd4ccd", 1933, "superconducting electromagnetism", None, None),  # 超导电磁学
    ("x_62756acb39", 2000, "metamaterial", None, None),                  # 超材料
    ("x_48c8d770d0", 1962, "lepton", None, None),                        # 轻子
    ("x_f29677b6c5", 1879, "thermal radiation", None, None),             # 辐射传热
    ("x_bebd180688", 1822, "continuum mechanics", None, None),           # 连续介质力学
    ("x_330aae0855", 1908, "Cepheid variables", None, None),             # 造父变星与测距
    ("x_f73fe9c587", 1963, "quantum optics", None, None),                # 量子光学(年份修正)
    ("x_8152e54c6e", 1972, "Bell test experiments", None, None),         # 量子纠缠实验
    ("x_60a7e5ce20", 1970, "quantum decoherence", None, None),           # 量子退相干
    ("x_c5db8568af", 1928, "quantum tunnelling", None, None),            # 量子隧穿
    ("x_741ac06bf2", 1980, "quantum Hall effect", None, None),           # 量子霍尔效应
    ("x_effb0b8bcd", 1914, "dimensional analysis", None, None),          # 量纲分析
    ("x_731979efa4", 1942, "Stephen Hawking", None, None),               # 霍金
    ("x_966d86661d", 1836, "electrostatic shielding", None, None),       # 静电屏蔽
    ("x_e60978a787", 1969, "non-equilibrium thermodynamics", None, None),# 非平衡态热力学
    ("x_58845c3be5", None, "amorphous solid", None, None),               # 非晶态物理
    ("x_3258b6b712", 1961, "nonlinear optics", None, None),              # 非线性光学
    ("x_3a4211011a", None, "nonlinear oscillation", None, None),         # 非线性振动
    ("x_b3b1a68b84", 1995, "top quark", "Topic", None),                  # 顶夸克(命题→主题)
    ("x_df23d59336", None, "polymer chain dynamics", None, None),        # 高分子链动力学
    ("x_285f37cd94", 1859, "Maxwell-Boltzmann distribution", None, None),# 麦克斯韦速率分布
    # ---- 维基扫描层 (w_) 保留项 ----
    ("w_ed6062ed3d", 1930, "neutrino", None, None),                      # 中微子
    ("w_e88e38f9f1", 1905, "photon", None, None),                        # 光子
    ("w_f2c10c1c5f", 1803, "atom", None, None),                          # 原子
    ("w_34bbd10058", 1964, "elementary particle", None, None),           # 基本粒子
    ("w_686f7a4779", 1859, "astrophysics", None, None),                  # 天体物理学
    ("w_348838ac03", 1917, "universe", None, None),                      # 宇宙
    ("w_4628c7ed90", 1687, "gravity", None, None),                       # 引力
    ("w_81a4c57807", 1968, "string theory", "Theory", "弦理论"),          # 弦理論(繁简+类型修正)
    ("w_135cead0be", 1940, "microwave", None, None),                     # 微波
    ("w_0f6a354de7", 1908, "spacetime", None, None),                     # 时空
    ("w_1fb9ff218d", 1925, "spin", None, None),                          # 自旋
    ("w_3a7170b92e", 1687, "mass", None, None),                          # 质量
    ("w_407f0455cb", 1858, "Max Planck", "Person", None),                # 普朗克(年份→生年)
    ("w_5f43aa4b96", 1912, "Chien-Shiung Wu", None, None),               # 吴健雄
    ("w_ddd4b41707", None, "matter", None, None),                        # 物质
    ("w_aeb8c14772", None, "coupling constant", None, "耦合常数"),        # 耦合常數(繁简修正)
    ("w_ee27e7d14e", 1912, "crystallography", None, None),                # 晶体学
]

# (id, 剔除理由)
REJECT = [
    # 日历噪声
    ("w_8069ec8f98", "年份条目"), ("w_53df2198bf", "年份条目"), ("w_5ec901e4cf", "年份条目"),
    ("w_e047fdfc54", "年份条目"), ("w_7b0b93c2e2", "年份条目"), ("w_07144f45ee", "年份条目"),
    ("w_151781e87c", "年份条目"), ("w_2bbccbc713", "年份条目"), ("w_dfce374fc8", "年份条目"),
    ("w_9b1894df7b", "年份条目"), ("w_230a296a7d", "年份条目"), ("w_5eaa92a3b1", "日期条目"),
    # 机构/制度/地名/人名消歧义
    ("w_0278b48721", "机构"), ("w_88d82d95a4", "机构"), ("w_543440df7a", "机构"),
    ("w_8365037da8", "机构"), ("w_7f1f81d35d", "机构"), ("w_4af12268f0", "机构"),
    ("w_e0dec4c437", "机构"), ("w_58810ae49d", "机构"), ("w_f68f56db03", "机构"),
    ("w_31da667712", "机构"), ("w_4a08650ad5", "泛概念"), ("w_c83e30b30d", "泛概念"),
    ("w_9298b0e194", "人名消歧义"), ("w_f90a76ca3a", "人名消歧义"),
    ("w_986a5b4bf2", "勋章制度"), ("w_18648da4d3", "学术荣誉"), ("w_0220d3a75e", "奖项制度"),
    ("w_4f5df662e2", "跨域制度"), ("w_d600d33a2f", "行政机构"),
    ("w_63a6bb521a", "地名"), ("w_9b73bd33ac", "地名"), ("w_b369c9a116", "地名"),
    ("w_a2b1b55ee8", "人物列表"), ("w_cae5b64b6b", "非物理概念"), ("w_c515f3385e", "非物理概念"),
    # 域错配
    ("w_41891c9aa1", "域错配:化学"), ("w_680aa93df9", "域错配:生物"), ("w_3f6d5e353a", "域错配:医学"),
    ("w_f731f9786e", "域错配:工程"), ("w_99b352d9dd", "域错配:艺术"), ("w_3079a19a23", "域错配:人文"),
    ("w_1f02f411cf", "域错配:地球科学"), ("w_ca10461ad2", "域错配:航天工程"),
    ("w_c3e9ee92b0", "域错配:工程政策"), ("w_57406b30a8", "域错配:工程"),
    ("w_414c2a5030", "域错配:军事工程"), ("w_ff89f4ffff", "域错配:工程"),
    ("w_93d27e8a71", "域错配:医药(屠呦呦宜入医学域)"),
    ("w_4b8712eb3a", "域错配:数学(宜入形式科学)"), ("w_85dad92449", "域错配:数学"),
    ("w_19fcb9eb25", "泛概念(时间)"), ("w_6f157325c0", "域错配:材料工程"), ("w_f11d874334", "域错配:材料"),
    ("x_912ac81b4b", "域错配:化学"),
    # 与既有 A/B 级重复
    ("w_ad6a23efb7", "重复:光学与光子学(Field B)"),
    ("w_d2aa6b6381", "重复:广义相对论(Theory A, 繁简变体)"),
    ("w_6d020f8e10", "重复:经典力学(Field B)/物理学(Domain)"),
    ("w_4a96ce2c54", "重复:现代物理(Field B)"),
    ("w_fa913fb181", "重复:狭义+广义相对论(均A)"),
    ("w_022299f177", "重复:大爆炸宇宙学(Theory A)"),
    ("w_1c00b55e6c", "重复:暗物质与暗能量(Problem B)"),
    ("w_7e84dd1cb3", "重复:粒子物理标准模型(Theory A)"),
    ("w_837395e341", "重复:牛顿(Person A)"),
    ("x_0e98e0fec5", "重复:热力学第二定律(Proposition A)"),
    ("x_3cec19c6f9", "重复:希格斯机制+希格斯玻色子发现(A)"),
    ("x_01da68245e", "重复:希格斯玻色子发现(Event A)"),
    ("x_5b4ee9c7c6", "重复:正电子(同批保留概念节点)"),
    ("x_545fd6730a", "重复:暗物质与暗能量(Problem B)"),
]


def main():
    import os, sqlite3
    os.chdir(ROOT)
    dry = "--dry" in sys.argv
    con = sqlite3.connect("atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    today = datetime.date.today().isoformat()

    n_prom = n_rej = 0
    missing = []
    for nid, born, en, tfix, zfix in PROMOTE:
        r = cur.execute("SELECT id, zh FROM nodes WHERE id=?", (nid,)).fetchone()
        if not r:
            missing.append(nid); continue
        sets, args = [], []
        if born is not None:
            sets.append("born=?"); args.append(born)
        if en is not None:
            sets.append("en=?"); args.append(en)
        if tfix is not None:
            sets.append("type=?"); args.append(tfix)
        if zfix is not None:
            sets.append("zh=?"); args.append(zfix)
        if not dry:
            if sets:
                cur.execute(f"UPDATE nodes SET {','.join(sets)} WHERE id=?", (*args, nid))
            cur.execute("UPDATE evidence SET grade='B', source=source || ' | LLM复核 ' || ? WHERE node_id=? AND grade='C'", (today, nid))
            cur.execute("UPDATE nodes SET confidence=0.9 WHERE id=?", (nid,))
        n_prom += 1
    for nid, reason in REJECT:
        r = cur.execute("SELECT id FROM nodes WHERE id=?", (nid,)).fetchone()
        if not r:
            missing.append(nid); continue
        if not dry:
            cur.execute("UPDATE nodes SET status='剔除候选' WHERE id=?", (nid,))
            cur.execute("UPDATE evidence SET source=source || ' | LLM剔除:' || ? || ' ' || ? WHERE node_id=?", (reason, today, nid))
        n_rej += 1
    if not dry:
        con.commit()

    left = cur.execute("""SELECT COUNT(*) FROM nodes n JOIN evidence v ON n.id=v.node_id
        WHERE n.domain='dom_physics' AND v.grade='C'""").fetchone()[0]
    print(f"复核为 B: {n_prom} · 剔除候选: {n_rej} · 未匹配 id: {missing or '无'}")
    print(f"物理学域剩余 C 级: {left}")
    if dry:
        print("(dry run, 未写库)")


if __name__ == "__main__":
    main()

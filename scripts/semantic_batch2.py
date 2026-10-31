# -*- coding: utf-8 -*-
"""semantic_batch2.py — 第二轮共现边语义判读 (2026-10-31)

对象: data/corpus/pending_semantic.tsv 全部 561 对
输出: 追加到 data/corpus/semantic.tsv (zh1, zh2, type, weight), 之后跑 semantic.py 应用
约定: 键 "A|B" 的书写方向即边的方向(A→B); 查找时双向匹配 pending 对。
     DROP = 判噪声删除。人物创立用 did(种子层惯例)。
运行: python scripts/semantic_batch2.py [--dry]
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ============ 升级为有向边 (~130 对) ============
TYPED = {
    # 技术奠基/使能链
    "铁路|蒸汽机": ("depends_on", 0.9),
    "工业革命|铁路": ("enables", 0.7),
    "铁路|冶铁": ("depends_on", 0.6),
    "铁路|交通工程": ("applied_in", 0.6),
    "铁路|运营管理": ("applied_in", 0.5),
    "高速公路网|铁路": ("competes_with", 0.5),
    "城市规划|铁路": ("relates_to", 0.4),
    "工业革命|汽车": ("enables", 0.7),
    "汽车|内燃机": ("depends_on", 0.9),
    "汽车|集成电路": ("depends_on", 0.5),
    "汽车|半导体": ("depends_on", 0.4),
    "汽车|微处理器": ("depends_on", 0.4),
    "汽车|高速公路网": ("enables", 0.5),
    "汽车|空气动力学": ("applied_in", 0.4),
    "汽车|机械设计": ("applied_in", 0.6),
    "汽车|气候变化": ("raises", 0.5),
    "催化|汽车": ("applied_in", 0.6),
    "飞机|内燃机": ("depends_on", 0.8),
    "飞机|空气动力学": ("depends_on", 0.9),
    "飞机|流体力学": ("depends_on", 0.8),
    "飞机|轮子": ("depends_on", 0.5),
    "飞机|气候变化": ("raises", 0.4),
    "湍流|飞机": ("raises", 0.4),
    "内燃机|蒸汽机": ("supersedes", 0.7),
    "自行车|奥林匹克运动会": ("relates_to", 0.4),
    "精准农业|农业": ("refines", 0.6),
    "有机农业|农业": ("competes_with", 0.5),
    # 农业
    "农业|工业革命": ("enables", 0.6),
    "基因|农业": ("applied_in", 0.6),
    "统计学|农业": ("applied_in", 0.4),
    "疫苗|农业": ("applied_in", 0.5),
    "农业|冶铁": ("depends_on", 0.5),
    "温室|农业": ("applied_in", 0.7),
    "内燃机|农业": ("applied_in", 0.4),
    "人造卫星|农业": ("applied_in", 0.4),
    "蒸汽机|农业": ("applied_in", 0.4),
    "机械设计|农业": ("applied_in", 0.4),
    "发酵|农业": ("applied_in", 0.6),
    "育种学|农业": ("applied_in", 0.7),
    "农业|气候变化": ("raises", 0.5),
    "农业|粮食安全": ("relates_to", 0.6),
    "水产养殖|农业": ("part_of", 0.6),
    "农业|动物福利": ("contested_by", 0.5),
    "农业|光合作用": ("depends_on", 0.7),
    # 文字/印刷
    "雕版印刷|文字": ("depends_on", 0.8),
    "科举制度|文字": ("depends_on", 0.7),
    # 半导体/计算链
    "集成电路|半导体": ("depends_on", 0.95),
    "晶体管|半导体": ("depends_on", 0.95),
    "微处理器|半导体": ("depends_on", 0.9),
    "光刻|半导体": ("depends_on", 0.8),
    "太阳能电池|半导体": ("depends_on", 0.9),
    "智能手机|半导体": ("depends_on", 0.9),
    "电力电子|半导体": ("depends_on", 0.9),
    "半导体|制造工艺": ("depends_on", 0.6),
    "集成电路|晶体管": ("depends_on", 0.95),
    "电子计算机|集成电路": ("depends_on", 0.8),
    "电子计算机|晶体管": ("depends_on", 0.8),
    "电子计算机|真空管": ("depends_on", 0.6),
    "晶体管|真空管": ("supersedes", 0.8),
    "微处理器|集成电路": ("depends_on", 0.9),
    "集成电路设计|集成电路": ("applied_in", 0.6),
    "电力电子|集成电路": ("depends_on", 0.6),
    "电力电子|晶体管": ("depends_on", 0.8),
    "微处理器|二进制": ("depends_on", 0.9),
    "编译器|二进制": ("depends_on", 0.7),
    "信息论|二进制": ("depends_on", 0.7),
    "编译器|算法": ("depends_on", 0.8),
    "机器学习|算法": ("depends_on", 0.6),
    "机器学习|统计学": ("depends_on", 0.8),
    "机器学习|概率论": ("depends_on", 0.8),
    "概率论|统计学": ("depends_on", 0.9),
    "算法|统计学": ("depends_on", 0.6),
    "算法|微积分": ("depends_on", 0.4),
    "算法|二进制": ("depends_on", 0.5),
    "算法|概率论": ("depends_on", 0.6),
    "算法|图论": ("depends_on", 0.7),
    "算法|信息论": ("depends_on", 0.6),
    "算法|电子计算机": ("depends_on", 0.6),
    "算法|软件工程": ("applied_in", 0.5),
    "算法|电子游戏": ("applied_in", 0.5),
    "图灵|算法": ("did", 0.8),
    "统计力学|热力学": ("explains", 0.8),
    "统计学|统计力学": ("depends_on", 0.6),
    "统计学|机器学习": ("depends_on", 0.8),
    "统计学|计量经济学": ("depends_on", 0.8),
    "运筹学|统计学": ("depends_on", 0.4),
    "统计学|基因": ("applied_in", 0.4),
    "微积分|流体力学": ("depends_on", 0.9),
    "湍流|流体力学": ("part_of", 0.8),
    "空气动力学|流体力学": ("depends_on", 0.9),
    "混沌理论|湍流": ("explains", 0.6),
    "编译器|流水线": ("applied_in", 0.5),
    "高速公路网|运营管理": ("applied_in", 0.5),
    # 物理/量子
    "量子力学|狭义相对论": ("relates_to", 0.4),
    "薛定谔方程|量子力学": ("part_of", 0.9),
    "超导|量子力学": ("depends_on", 0.7),
    "量子引力|量子力学": ("depends_on", 0.8),
    "量子引力|广义相对论": ("depends_on", 0.8),
    "量子化学|量子力学": ("depends_on", 0.9),
    "量子化学|热力学": ("depends_on", 0.4),
    "量子化学计算|量子化学": ("part_of", 0.8),
    "量子化学计算|薛定谔方程": ("depends_on", 0.9),
    "广义相对论|狭义相对论": ("depends_on", 0.8),
    "狭义相对论|麦克斯韦": ("depends_on", 0.7),
    "量子力学|麦克斯韦": ("depends_on", 0.4),
    "原子核|中子": ("composes_of", 0.8),
    "放射性|原子核": ("depends_on", 0.8),
    "核裂变|中子": ("depends_on", 0.9),
    "核裂变|放射性": ("depends_on", 0.8),
    "核电站|核裂变": ("depends_on", 0.95),
    "核电站|放射性": ("depends_on", 0.7),
    "中子|元素周期律": ("explains", 0.4),
    "放射性|X射线": ("inspired_by", 0.6),
    "X射线晶体学|X射线": ("depends_on", 0.9),
    "爱因斯坦|量子力学": ("did", 0.6),
    "爱因斯坦|广义相对论": ("did", 0.95),
    "爱因斯坦|狭义相对论": ("did", 0.95),
    "爱因斯坦|统计力学": ("did", 0.5),
    "爱因斯坦|波粒二象性": ("did", 0.7),
    "爱因斯坦|以太": ("refutes", 0.7),
    "爱因斯坦|麦克斯韦": ("inspired_by", 0.7),
    "爱因斯坦|核裂变": ("explains", 0.4),
    "麦克斯韦|统计力学": ("did", 0.7),
    "麦克斯韦|玻尔兹曼分布": ("did", 0.8),
    "麦克斯韦|麦克斯韦速率分布": ("did", 0.9),
    "牛顿|微积分": ("did", 0.9),
    "牛顿|流体力学": ("did", 0.7),
    "牛顿|经典力学": ("did", 0.95),
    "广义相对论|牛顿": ("inspired_by", 0.6),
    "狭义相对论|牛顿": ("inspired_by", 0.6),
    "达尔文|进化论": ("did", 0.95),
    "孟德尔|基因": ("did", 0.9),
    "孟德尔|孟德尔定律": ("did", 0.95),
    "文艺复兴|亚里士多德": ("inspired_by", 0.6),
    "牛顿|文艺复兴": ("inspired_by", 0.4),
    "亚里士多德|亚里士多德三段论": ("did", 0.9),
    "巴赫|对位法": ("did", 0.9),
    "凯恩斯|亚当·斯密": ("refines", 0.4),
    "大萧条|凯恩斯": ("inspired_by", 0.6),
    # 生物/医学
    "疫苗|抗体": ("depends_on", 0.8),
    "抗体|基因": ("depends_on", 0.5),
    "器官移植|麻醉": ("depends_on", 0.8),
    "外科手术学|麻醉": ("depends_on", 0.9),
    "基因|信使RNA": ("enables", 0.5),
    "DNA测序|基因": ("applied_in", 0.6),
    "基因|衰老机制": ("explains", 0.5),
    "分子克隆|基因": ("depends_on", 0.7),
    "动物育种|基因": ("depends_on", 0.7),
    "发酵|催化": ("depends_on", 0.8),
    "光合作用|催化": ("depends_on", 0.5),
    "发酵|微生物组": ("depends_on", 0.6),
    "放射性|基因": ("raises", 0.4),
    "X射线|基因": ("raises", 0.4),
    # 文化/传播
    "电子游戏|电影": ("inspired_by", 0.6),
    "游戏设计|电影": ("inspired_by", 0.5),
    "存在主义|电影": ("inspired_by", 0.5),
    "游戏设计|电子游戏": ("applied_in", 0.8),
    "智能手机|电子游戏": ("enables", 0.7),
    # 社科/治理
    "大萧条|不平等": ("raises", 0.6),
    "福利国家|不平等": ("solves", 0.4),
    "数字鸿沟|教育不平等": ("raises", 0.6),
    "集装箱运输|WTO与多边贸易体系": ("enables", 0.5),
    "开放获取运动|学术期刊与同行评审": ("competes_with", 0.4),
    "臭氧空洞与蒙特利尔议定书|环境立法与环评": ("inspired_by", 0.4),
    "普通法与判例|罗马法法典化": ("inspired_by", 0.4),
    "新教伦理与资本主义|政治经济学批判(资本论)": ("competes_with", 0.5),
    "公共服务创新|服务设计": ("depends_on", 0.6),
    "传统武术与身体技艺|隐性知识的流失": ("raises", 0.5),
    "法律实证主义|实证主义": ("depends_on", 0.7),
    "哥德尔不完备定理|可计算性理论": ("inspired_by", 0.7),
    "P vs NP|可计算性理论": ("part_of", 0.7),
    "图灵|可计算性理论": ("did", 0.95),
    "大语言模型|通用人工智能": ("enables", 0.4),
    "AI对齐|通用人工智能": ("raises", 0.6),
    "量子比特硬件|量子比特": ("depends_on", 0.8),
    "量子比特硬件|超导": ("depends_on", 0.6),
    "互联网泡沫|万维网": ("depends_on", 0.4),
    "选择公理|集合论": ("part_of", 0.8),
    # 地球/气候
    "极端天气归因|气候变化": ("explains", 0.7),
    "气候变化|土壤退化": ("raises", 0.5),
    "气候变化|生物多样性危机": ("raises", 0.6),
    "暗物质与暗能量|粒子物理标准模型": ("raises", 0.5),
    "板块构造理论|板块构造": ("relates_to", 0.7),
    "冷冻电镜分辨率革命|冷冻电镜": ("refines", 0.7),
    "算法设计与分析|算法": ("part_of", 0.6),
    "路由算法|算法": ("part_of", 0.7),
    "生成艺术|算法": ("depends_on", 0.7),
    "平台治理|算法": ("relates_to", 0.5),
}


def main():
    dry = "--dry" in sys.argv
    pend_path = ROOT / "data" / "corpus" / "pending_semantic.tsv"
    sem_path = ROOT / "data" / "corpus" / "semantic.tsv"

    lines = pend_path.read_text(encoding="utf-8").strip().split("\n")[1:]
    judged = {tuple(k.split("|")): v for k, v in TYPED.items()}
    lookup = {}
    for (a, b), v in judged.items():
        lookup[(a, b)] = ("typed", a, b, v[0], v[1])
        lookup.setdefault((b, a), ("typed", a, b, v[0], v[1]))

    out_rows, drops, missing = [], 0, []
    for ln in lines:
        c = ln.split("\t")
        a, b = c[1], c[5]
        hit = lookup.get((a, b))
        if hit:
            _, o1, o2, typ, w = hit
            out_rows.append((o1, o2, typ, w))
        else:
            out_rows.append((a, b, "DROP", 0.0))
            drops += 1

    print(f"待判 {len(lines)} 对 · 升级 {len(out_rows) - drops} · DROP {drops} · 未覆盖 {missing or '无'}")
    if dry:
        for r in out_rows[:8]:
            print(" ", r)
        return
    with open(sem_path, "a", encoding="utf-8") as f:
        for o1, o2, typ, w in out_rows:
            f.write(f"{o1}\t{o2}\t{typ}\t{w}\n")
    print(f"已追加 {len(out_rows)} 行到 semantic.tsv (含 DROP 行, semantic.py 会删除对应边)")


if __name__ == "__main__":
    main()

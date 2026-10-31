# -*- coding: utf-8 -*-
"""curate_batch2_llm.py — 第二批 LLM 辅助批量策展 (2026-10-31)

对象: 工程与技术(154) + 人文学科(120) + 计算机科学与技术(107) 共 381 条 C 级
判据与语义同 curate_physics_llm.py (试点批次, 物理学域)。
运行: python scripts/curate_batch2_llm.py [--dry]
"""
import sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ============ 工程与技术 dom_eng (154: promote 142 / reject 12) ============
ENG_PROMOTE = [
    # 骨架/种子层 (born 已有, 补 en)
    ("tech_gps", 1995, "GPS and satellite navigation", None, None),
    ("f_transport", 1863, "transportation engineering", None, None),
    ("tech_satellite", 1957, "artificial satellite", None, None),
    ("c_metric", 1795, "metric system", None, None),
    ("tech_combustion", 1876, "internal combustion engine", None, None),
    ("f_chemeng", 1887, "chemical engineering", None, None),
    ("c_interchangeable", 1795, "interchangeable parts", None, None),
    ("tech_dye", 1856, "synthetic dye", None, None),
    ("tech_elevator", 1852, "safety elevator", None, None),
    ("f_indeng", 1795, "industrial and reliability engineering", None, None),
    ("tech_robot", 1961, "industrial robot", None, None),
    ("dom_eng", None, "engineering and technology", None, None),        # 域节点本体升B
    ("ev_brooklyn", 1883, "Brooklyn Bridge opening", None, None),
    ("c_skyscraper", 1885, "skyscraper", None, None),
    ("tech_cnc", 1952, "CNC machine tool", None, None),
    ("ev_sputnik", 1957, "Sputnik launch", None, None),
    ("f_mech", 1712, "mechanical engineering", None, None),
    ("f_materials", 1950, "materials science", None, None),
    ("f_nucleareng", 1954, "nuclear engineering", None, None),
    ("tech_nuclearplant", 1954, "nuclear power plant", None, None),
    ("cv_nuclear", 1986, "nuclear energy controversy", None, None),
    ("c_car", 1886, "automobile", None, None),
    ("c_irrigation", -6000, "irrigation", None, None),
    ("c_suspension", 1883, "suspension bridge", None, None),
    ("tech_rocket", 1926, "modern rocket", None, None),
    ("f_elec", 1882, "electrical engineering", None, None),
    ("tech_oil_refining", 1913, "petroleum refining", None, None),
    ("tech_aircondition", 1902, "air conditioning", None, None),
    ("c_spc", 1924, "statistical process control", None, None),
    ("c_aqueduct", -312, "Roman aqueduct", None, None),
    ("pr_infrastructure", 2007, "aging infrastructure", None, None),
    ("f_energy", 1882, "energy science", None, None),
    ("f_aero", 1903, "aerospace engineering", None, None),
    ("ev_moon", 1969, "Apollo 11 Moon landing", None, None),
    ("e_dujiangyan", -256, "Dujiangyan", None, None),
    ("tech_airplane", 1903, "airplane", None, None),
    ("c_highway", 1932, "highway network", None, None),
    ("f_civil", -256, "civil and structural engineering", None, None),  # 土木与结构工程 Field
    ("x_038ae15d71", None, "industrial robot kinematics", None, None),  # 工业机器人运动学
    # 维基层保留 (年份修正)
    ("w_e75d99897f", 1937, "jet engine", None, None),                  # 喷气发动机(born -400→1937)
    ("w_db369c68cf", 1882, "thermal power station", None, "火力发电厂"),  # (born 2025→1882, 繁简)
    ("w_79d8701e17", None, "structural engineering", None, None),      # 结构工程
    # LLM 抽取层
    ("x_178db5cca6", None, "transport and land use", None, None),
    ("x_c7aea00ba0", 1930, "traffic engineering", None, None),
    ("x_96441601ff", None, "transport emissions", None, None),
    ("x_8b84d16dce", 1949, "human factors engineering", None, None),
    ("x_3656af1759", None, "human-robot collaboration", None, None),
    ("x_f6031a0c21", 1960, "transport phenomena", None, None),
    ("x_6c5f0e25b7", None, "low-altitude economy", None, None),
    ("x_a689289a45", 1948, "signals and systems", None, None),
    ("x_a225ce07b1", 1948, "signal processing", None, None),
    ("x_37809fd4f0", None, "catalytic reactor design", None, None),
    ("x_b8d69e2830", 1954, "photovoltaic cells", None, None),
    ("x_8fa072d8d7", None, "transit priority", None, None),
    ("x_463a31e709", None, "separation engineering", None, None),
    ("x_c2354cda06", 1989, "power semiconductor", None, None),
    ("x_b3334a92be", None, "process safety", None, None),
    ("x_9e4a1f2903", None, "chemical scale-up", None, None),
    ("x_c5352e4adf", None, "chemical thermodynamics", None, None),
    ("x_5233ffec9d", 1957, "semiconductor doping", None, None),
    ("x_8d64031563", 1960, "satellite remote sensing", None, None),
    ("x_433d86679a", None, "reactor thermal hydraulics", None, None),
    ("x_a7dedb454b", 1942, "reactor physics", None, None),
    ("x_504980453a", None, "reaction engineering", None, None),
    ("x_5011a9d031", 1950, "reliability engineering", None, None),
    ("x_3be4e01f61", 2015, "commercial spaceflight", None, None),
    ("x_29393d30ae", None, "underground space development", None, None),
    ("x_534f61074f", None, "complex systems modeling", None, None),
    ("x_065c4ef330", 2020, "small modular reactor", None, None),
    ("x_4a10b51569", 1776, "geotechnical engineering", None, None),
    ("x_153ee61545", None, "engineering ethics", None, None),
    ("x_084d1bfc76", None, "engineering materials", None, None),
    ("x_dd8a20fd97", None, "construction management", None, None),
    ("x_a3d4261e02", 1963, "shape memory alloy", None, None),
    ("x_f01e35248b", None, "earthquake engineering", None, None),
    ("x_444809a8b3", 1882, "pumped-storage hydroelectricity", None, None),
    ("x_f02b6a9d0c", None, "vibration and noise control", None, None),
    ("x_9b4200bc2a", 1868, "control theory", None, None),
    ("x_c8a217e103", 1937, "propulsion", None, None),
    ("x_7adb493f50", 1966, "tribology", None, None),
    ("x_cfe799adc2", 2007, "wireless charging", None, None),
    ("x_871dda4f7c", 2009, "smart grid", None, None),
    ("x_2796d36a60", 1990, "intelligent transportation systems", None, None),
    ("x_b328052824", None, "machine design", None, None),
    ("x_db4a84414e", 1969, "mechatronics", None, None),
    ("x_bc4485f8c1", 2011, "Materials Genome Initiative", None, None),
    ("x_eba7862f2d", None, "standardization", None, None),
    ("x_01f4b5d6bf", 1986, "nuclear safety culture", None, None),
    ("x_f58eb585d9", None, "nuclear medicine", None, None),
    ("x_fadd5bfc7d", 1943, "nuclear fuel cycle", None, None),
    ("x_28adbbff37", None, "fusion engineering", None, None),
    ("x_91b969ff9a", None, "fusion fuel cycle", None, None),
    ("x_8b38a942fb", 1988, "nuclear decommissioning", None, None),
    ("x_e3946b2dca", None, "bridge engineering", None, None),
    ("x_e613456fba", None, "hydrogen economy", None, None),
    ("x_086dd584e2", None, "hydraulic engineering", None, None),
    ("x_d23ba306b0", None, "port automation", None, None),
    ("x_b63cd561e8", None, "thermal-fluid machinery", None, None),
    ("x_8f2940cc5c", None, "logistics optimization", None, None),
    ("x_46f492a799", 2009, "UHV power transmission", None, None),
    ("x_e70f0a85e6", 1958, "power electronics", None, None),
    ("x_9af2217610", None, "power systems", None, None),
    ("x_79cb86f0cc", None, "power system stability", None, None),
    ("x_4dfd4a117b", None, "electric machines and drives", None, None),
    ("x_1ff6bb11ea", None, "grid dispatching", None, None),
    ("x_298575341a", None, "aerodynamics", None, None),
    ("x_a6dfbec456", None, "precision machining", None, None),
    ("x_60d44e6b5a", None, "precision metrology", None, None),
    ("x_05062ce25c", None, "system simulation", None, None),
    ("x_dfbb47bde0", None, "structural health monitoring", None, None),
    ("x_3d8222903f", None, "structural mechanics", None, None),
    ("x_5b1b424d6f", None, "green manufacturing", None, None),
    ("x_28c4d74224", None, "green process", None, None),
    ("x_fb764dcb4d", None, "energy transition", None, None),
    ("x_f64736b991", None, "autonomous driving", None, None),
    ("x_537d419285", 2001, "self-healing materials", None, None),
    ("x_d34f5694ae", None, "space mission design", None, None),
    ("x_27fd2a0cb3", None, "spacecraft orbits", None, None),
    ("x_a9c02b5a80", 1937, "aero engine", None, None),
    ("x_684b87b9a0", 2011, "computational materials science", None, None),
    ("x_c0ae1507fd", None, "digital quality management", None, None),
    ("x_26a7740474", None, "automotive engineering", None, None),
    ("x_30347fdf1b", 1928, "radiation protection", None, None),
    ("x_0094d9001f", 1940, "process control", None, None),
    ("x_bdbcfe4aa7", None, "process systems engineering", None, None),
    ("x_f3f6cd7740", None, "optimization solvers", None, None),
    ("x_d4e673d6f0", 1947, "operations research", None, None),
    ("x_21bcb4ca36", 1948, "communication theory", None, None),
    ("x_6862554e92", 1991, "lithium-ion battery", None, None),
    ("x_42431f2eff", None, "ceramic matrix composites", None, None),
    ("x_8ab17213b2", None, "tunneling", None, None),
    ("x_c7f1b442ad", 1958, "integrated circuit design", None, None),
    ("x_cb61d481fc", 1956, "containerization", None, None),
    ("x_436367b066", None, "project management", None, None),
    ("x_74bfb4003a", 1891, "wind power", None, None),
    ("x_f4af8ee69f", None, "flight dynamics and control", None, None),
    ("x_b414b390ce", None, "aerodynamic optimization", None, None),
    ("x_b717c436ba", None, "aircraft structures", None, None),
    ("x_150d06ebcf", 1935, "synthetic polymers", None, None),
    ("x_b0050e798e", 1959, "HSLA steel", None, None),
    ("x_2277634041", 1891, "high-voltage engineering", None, None),
    ("x_4f6e74e25c", 1964, "high-speed rail", None, None),
]
ENG_REJECT = [
    ("w_67d8bd6177", "年份条目"), ("w_dc2d40644e", "日期条目"),
    ("w_19839695d8", "域错配:经济"), ("w_3fe75c7433", "机构"),
    ("w_6be4549dd9", "地名"), ("w_af64c5c484", "机构"),
    ("w_194ad7c9fa", "域错配:经济"), ("w_2af8ac63f6", "人名/地名消歧义"),
    ("w_c9426c6604", "域错配:宜入科技史"), ("w_ffb93bb549", "域错配:宜入计算机域"),
    ("x_8014804617", "域错配:经济(碳定价)"), ("x_b78c37cbfb", "重复:核聚变工程(同批保留)"),
]

# ============ 人文学科 dom_hum (120: promote 81 / reject 39) ============
HUM_PROMOTE = [
    # 种子/事件层
    ("ev_shiji", -91, "Records of the Grand Historian", None, None),
    ("ev_genji", 1008, "The Tale of Genji", None, None),
    ("ev_shijing", -600, "Book of Songs", None, None),
    ("ev_tangshi", 700, "high Tang poetry", None, None),
    ("ev_homer", -750, "Homeric epics", None, None),
    ("t_historiography", 1824, "Rankean historiography", None, None),
    ("t_existential", 1943, "existentialism", None, None),
    ("t_popper", 1934, "falsificationism", None, None),
    ("f_literature", -750, "literary studies", None, None),
    # 维基层保留 (人物年份按生年惯例修正)
    ("w_36c7b4643b", 1872, "Bertrand Russell", None, None),
    ("w_a3197428b3", 1596, "René Descartes", None, None),
    ("w_6ae243d5cd", 1900, "Joseph Needham", None, None),
    ("w_44e03d249a", None, "materialism", None, None),                 # 唯物主义
    ("w_e34763a254", None, "dignity", None, None),                     # 尊严
    ("w_76ed068d0f", None, "classics", "Topic", "古典学"),              # 古典學
    ("w_7ff35a9f6f", None, "natural history", None, None),             # 自然历史/博物学
    # LLM 抽取层
    ("x_6b7bed7132", 1827, "world literature", None, None),
    ("x_3b4df44d5b", -350, "ethics", None, None),
    ("x_4dc3101beb", 2001, "experimental ethics", None, None),
    ("x_5fc628b2a6", None, "Confucian ethics and modernity", None, None),
    ("x_2760a81e4d", 1744, "children's literature", None, None),
    ("x_a4e2b9b3e8", 1960, "global history", None, None),
    ("x_af6f7b8a53", None, "public history", None, None),
    ("x_095671093c", 1930, "analytic vs continental philosophy", None, None),
    ("x_ddb650fcf3", None, "historical archaeology", None, None),
    ("x_bb4e8bb41d", None, "comparative history", None, None),
    ("x_4112a74528", 1786, "comparative-historical linguistics", None, None),
    ("x_3bd4ed6e07", 1969, "narratology", None, None),
    ("x_b0d3806c87", 1948, "oral history", None, None),
    ("x_755dc97ae5", 1984, "ancient DNA", None, None),
    ("x_a070dbfcaa", 1856, "paleoanthropology", None, None),
    ("x_705940fa32", None, "syntax", None, None),
    ("x_d5aeb0d9fe", None, "prehistoric archaeology", None, None),
    ("x_31f443754a", None, "source criticism", None, None),
    ("x_7a27379460", -484, "Herodotus", None, None),
    ("x_70526cdeee", None, "applied ethics", None, None),
    ("x_3c343574e6", None, "morphology", None, None),
    ("x_ad2135fae3", None, "metaphysics", None, None),
    ("x_82438d034a", 1641, "philosophy of mind", None, None),
    ("x_4d4069ad3f", None, "theatre studies", None, None),
    ("x_0ce63a1f31", -380, "political philosophy", None, None),
    ("x_efbe255fa1", 1900, "Dunhuang library cave", None, None),
    ("x_e75f3e1b5c", None, "digital humanities", None, None),
    ("x_38e99ddc8a", None, "literature and identity", None, None),
    ("x_ed7b969e59", None, "literary criticism", None, None),
    ("x_2638a5d615", None, "canon formation", None, None),
    ("x_93f2a051ce", None, "new cultural history", None, None),
    ("x_04427be646", 1715, "Cao Xueqin", "Person", None),              # 曹雪芹 Topic→Person
    ("x_65c92fbdda", 1749, "Johann Wolfgang von Goethe", None, None),
    ("x_e91783c1d0", 1827, "comparative literature", None, None),
    ("x_b0448ad751", None, "underwater archaeology", None, None),
    ("x_c6c6bf401e", None, "material culture", None, None),
    ("x_d4b8fb5b49", None, "environmental history", None, None),
    ("x_0a00afafe0", None, "field archaeology", None, None),
    ("x_04de9cc704", 1899, "discovery of oracle bone script", None, None),
    ("x_0813684efe", None, "social history", None, None),
    ("x_8d1f9f2ef1", 1952, "sociolinguistics", None, None),
    ("x_3409d61984", None, "science fiction studies", None, None),
    ("x_cd317190bf", None, "history of technology", None, None),
    ("x_301daf9ab4", None, "philosophy of technology", None, None),
    ("x_6c63099a6d", None, "archaeometry", None, None),
    ("x_3e011bab29", None, "linguistic typology", None, None),
    ("x_0a4830f6e3", 1712, "aesthetics", None, None),
    ("x_fd485dad7a", None, "literary translation", None, None),
    ("x_be5d6a61cc", 1963, "archaeoastronomy", None, None),
    ("x_0f440c7ac3", None, "archaeological theory", None, None),
    ("x_db92855ee8", None, "settlement archaeology", None, None),
    ("x_4c7a0697c7", 1564, "William Shakespeare", None, None),
    ("x_bf6e1c66b4", 1950, "computational linguistics", None, None),
    ("x_c24b71ebd8", 1958, "cliometrics", None, None),
    ("x_a0944c049b", -369, "epistemology", None, None),
    ("x_17ac9a75df", -335, "poetics", None, None),
    ("x_faf40dbbeb", 1883, "semantics", None, None),
    ("x_23fd0842f5", 1938, "pragmatics", None, None),
    ("x_8cf234679f", None, "language acquisition", None, None),
    ("x_c44c482351", 1884, "philosophy of language", None, None),
    ("x_aa47130e38", None, "language endangerment", None, None),
    ("x_496f44cf7e", None, "phonetics and phonology", None, None),
    ("x_f9c56b1fab", 1881, "Lu Xun", "Person", None),                  # 鲁迅 Topic→Person
    ("x_49b874fa7b", 1265, "Dante Alighieri", None, None),
    ("x_8891b19a6a", None, "heritage management", None, None),          # 文化遗产管理
]
HUM_REJECT = [
    ("w_c869294442", "年份条目"), ("w_da708d367d", "年份条目"), ("w_ea7860218a", "年份时局"),
    ("w_0a26ec6523", "机构"), ("w_e34209a5e7", "机构"), ("w_04b9adf0e3", "机构"),
    ("w_ccc947202c", "机构"), ("w_3dbb728db3", "机构"), ("w_56f9495590", "机构"),
    ("w_07331aa016", "地名"), ("w_249d9dc923", "地名"), ("w_694e17d0f5", "地名"),
    ("w_661d0aff20", "地名"), ("w_0a91bb086e", "地名"), ("w_f40c294d2d", "地名"),
    ("w_dcac658110", "地名"),
    ("w_28880d87b0", "出版物丛书"), ("w_a2f98ac05a", "奖项制度"),
    ("w_a1e1764298", "域错配:政治人物"), ("w_8fc0961486", "域错配:心理学"),
    ("w_d8c7e04c8e", "泛概念"), ("w_8196d4f752", "泛概念(心理学)"), ("w_3bd2b10e37", "泛概念(心理学)"),
    ("w_bf755f1611", "重复:历史学(Field, 繁简变体)"), ("w_c827d8dbb7", "重复:历史学(Field)"),
    ("w_29a2d4f650", "粒度过粗(区域通史)"), ("w_5db2c47afd", "域错配:社会科学"),
    ("w_54d9923e2c", "域错配:教育"), ("w_2bf65f0b16", "域错配:认知科学交叉"),
    ("w_f360c5c549", "域错配:文化产业"), ("w_412e99ba26", "泛概念"),
    ("w_1fd4e1a157", "重复:语言学(Field, 繁简变体)"), ("w_9c4894349e", "域错配:政务IT"),
    ("w_ff95fa830a", "泛概念(娱乐)"),
    ("w_6f0d4da9b7", "粒度过粗(文明概述)"),
    ("x_f0488094ea", "重复:兰克史学(同批Theory保留)"), ("x_b6886093fd", "重复:《史记》与纪传体(同批Event保留)"),
    ("x_05c52cd9c4", "出版物(期刊)细碎"), ("x_9e742b3445", "域错配:计算机(语义网)"),
    ("x_03cd239c51", "域错配:经济史宜入经济域"),
]

# ============ 计算机科学与技术 dom_cs (107: promote 87 / reject 20) ============
CS_PROMOTE = [
    ("x_d2b0555b05", None, "A/B testing", None, None),
    ("x_ae92c37dda", None, "AI ethics", None, None),
    ("x_1f0d5ea524", 1983, "DNS and addressing", None, None),
    ("x_13ce601dcf", 1998, "content delivery network", None, None),     # 内容分发网络
    ("x_1635f54e2a", 2017, "advanced process nodes", None, None),       # 先进制程
    ("x_e6b0709ebf", None, "embodied AI", None, None),                  # 具身智能
    ("x_cf76b399d9", 1981, "IBM PC launch", None, None),
    ("w_0523b13262", 2015, "OpenAI", None, None),
    ("x_7fd3df4088", None, "world models", None, None),
    ("x_bb22025ac6", 1983, "Chinese supercomputers", None, None),
    ("x_1fefd5a912", 2006, "cloud computing", None, None),
    ("x_9bbf6313bb", 1983, "Ethernet standardization", None, None),
    ("x_7ae9854f13", 1955, "Tim Berners-Lee", None, None),
    ("x_1121be283c", 1998, "convolutional neural network", None, None),
    ("x_cb80f4463e", None, "interpretability", None, None),
    ("x_9b3e155ef1", None, "causal inference", None, None),
    ("x_d504a51b9c", None, "GPU architecture", None, None),
    ("x_728963b082", None, "graph analytics", None, None),
    ("x_1a91cefc89", None, "online algorithms", None, None),
    ("x_3e4ffef0e5", None, "multi-agent systems", None, None),
    ("x_1ad08b8f62", None, "multimodal learning", None, None),
    ("x_d5a09ab998", None, "big data architecture", None, None),
    ("w_549305c697", 2001, "big data", None, "大数据"),                # 大數據(繁简+年份)
    ("x_1767fbe245", 2022, "LLM alignment techniques", None, None),
    ("x_9b10813e1b", 1946, "Andrew Yao", None, None),
    ("x_85858c3908", None, "memory hierarchy", None, None),
    ("x_c7edf789e2", None, "compute-in-memory", None, None),
    ("x_50759e9589", None, "embedded systems", None, None),
    ("x_6964a39570", None, "reinforcement learning", None, None),
    ("x_aad0870515", 1986, "recurrent neural network", None, None),
    ("x_73c27637d2", None, "bus and interconnect", None, None),
    ("x_cd31ab3a08", None, "congestion control", None, None),
    ("x_2e4f0679ac", None, "instruction-level parallelism", None, None),
    ("x_db93eb9c0d", None, "instruction set architecture", None, None),
    ("x_bf04b33fb3", 1977, "exploratory data analysis", None, None),
    ("x_8327278b40", None, "search and planning", None, None),
    ("x_3cd79e401e", None, "data visualization", None, None),
    ("x_7f27a0b68c", None, "data governance", None, None),
    ("x_1b625ed660", None, "data cleaning", None, None),
    ("f_data", 2008, "data science", None, None),
    ("x_0d127def93", None, "unsupervised learning", None, None),
    ("x_11d9c5bfef", 1997, "wireless networking", None, None),
    ("x_c277967014", None, "time series analysis", None, None),
    ("x_72fbb9b58d", None, "intelligent agents", None, None),
    ("x_61bb1751fd", None, "machine learning", "Topic", None),          # Method→Topic(领域名)
    ("x_4504223cbd", None, "ML workflow", None, None),
    ("x_38058c9965", None, "model compression and inference", None, None),
    ("x_b20e0f4ede", 1915, "Richard Hamming", None, None),
    ("x_b280064d56", None, "pipelining and superscalar", None, None),
    ("w_8c5f70f85d", 2006, "deep learning", None, None),               # 深度学习(年份修正)
    ("x_6b623f4fe8", 2018, "Turing Award for deep learning", None, None),
    ("x_9627e3861b", None, "game AI", None, None),
    ("x_3d13e1c086", 1980, "Internet of Things", None, None),
    ("x_5ed9c8cd91", None, "generative models", None, None),
    ("x_4c5ce91258", 1844, "telegraph and Morse code", None, None),
    ("x_cc39a0862a", 1876, "telephone patent", None, None),
    ("x_d67e318877", None, "supervised learning", None, None),
    ("x_e6df82d293", None, "knowledge representation and reasoning", None, None),
    ("x_fd0ec3223e", None, "social network analysis", None, None),
    ("x_0856c02f94", None, "program synthesis", None, None),
    ("x_e2ae4e52af", None, "program verification", None, None),
    ("x_86190ecb05", None, "neuro-symbolic integration", None, None),
    ("x_1738850215", 1945, "ENIAC", None, None),
    ("x_c43a140615", None, "cache coherence", None, None),
    ("x_a46662de4e", None, "network protocol stack", None, None),
    ("x_a9fbbd4004", None, "cybersecurity", None, None),
    ("x_166c215f41", None, "federated learning", None, None),
    ("x_0dd18de7ab", None, "chip design flow", None, None),
    ("x_aa878f2b03", None, "computational learning theory", None, None),
    ("x_9084b476bd", None, "superscalar out-of-order execution", None, None),
    ("x_c3f6e443c1", None, "routing algorithms", None, None),
    ("x_0d00dc8c5e", None, "software-defined networking", None, None),
    ("x_8dd4d769a7", None, "edge computing", None, None),
    ("x_70fa887f20", None, "transfer learning", None, None),
    ("x_213f6070da", None, "approximation algorithms", None, None),
    ("x_d67f72db97", 1930, "Edsger Dijkstra", None, None),
    ("x_bc30ddc73e", None, "communication complexity", None, None),
    ("x_01209bb714", None, "logic gates and digital circuits", None, None),
    ("x_e5ffe7639f", None, "qubit hardware", None, None),
    ("x_5a1aec4249", 1994, "quantum algorithms", None, None),
    ("x_d3492070c0", None, "privacy-preserving computation", None, None),
    ("x_07c298c414", None, "zero-trust security", None, None),
    ("x_7556bf62cd", None, "domain-specific architecture", None, None),
    ("x_7086c376ac", 1938, "Donald Knuth", None, None),
    ("x_ef6aa96b56", 1961, "packet switching", None, None),
    ("x_c760fd8a0c", None, "distributed systems", None, None),
    ("x_9831a32059", None, "CAP theorem trade-offs", None, None),
]
CS_REJECT = [
    ("w_f003c44dea", "消歧义(SE)"), ("w_9c4894349e", "域错配:政务IT"),
    ("w_29e17ba066", "域错配:城市治理"), ("w_c9c4557fcb", "域错配:电气工程(eng域)"),
    ("w_449352dce4", "机构"), ("w_e03c331c3c", "域错配:光学器具"),
    ("w_1273ce3d54", "重复:计算机科学与技术(Domain)"), ("w_cd0e29b1e8", "机构"),
    ("w_a5dd723061", "重复:神经网络(Concept)"),
    ("x_8e719b7bfe", "重复:哈勃太空望远镜发射(物理域已复核)"),
    ("x_d2735e845b", "域错配:物理(富兰克林)"),
    ("x_aa0b506d8f", "域错配:生物(基因组测序)"),
    ("x_ac87249108", "域错配:电气工程(交流电)"),
    ("x_cf1b2aa1d7", "域错配:航天工程(嫦娥四号)"),
    ("x_3ce9663af0", "域错配:航天工程(科罗廖夫)"),
    ("x_5a30d4d379", "域错配:航空工程(莱特兄弟)"),
    ("x_c26c79f04c", "域错配:电气工程(爱迪生)"),
    ("x_9edef009c2", "域错配:电气工程(特斯拉)"),
    ("x_a480d91452", "重复:都江堰建成(eng域已复核)"),
    ("x_c313cd1232", "域错配:土木工程(茅以升)"),
]

BATCHES = [
    ("dom_eng", ENG_PROMOTE, ENG_REJECT),
    ("dom_hum", HUM_PROMOTE, HUM_REJECT),
    ("dom_cs", CS_PROMOTE, CS_REJECT),
]


def main():
    import os, sqlite3
    os.chdir(ROOT)
    dry = "--dry" in sys.argv
    con = sqlite3.connect("atlas.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    today = datetime.date.today().isoformat()

    total_prom = total_rej = 0
    for dom, prom, rej in BATCHES:
        ids = {p[0] for p in prom} | {r[0] for r in rej}
        rows = cur.execute("""SELECT id FROM nodes WHERE domain=? AND id IN
            (SELECT node_id FROM evidence WHERE grade='C')""", (dom,)).fetchall()
        actual = {r["id"] for r in rows}
        dup = "无"
        missing = sorted(actual - ids)
        n_prom = n_rej = 0
        for nid, born, en, tfix, zfix in prom:
            if nid not in actual:
                continue
            sets, args = [], []
            if born is not None: sets.append("born=?"); args.append(born)
            if en is not None: sets.append("en=?"); args.append(en)
            if tfix is not None: sets.append("type=?"); args.append(tfix)
            if zfix is not None: sets.append("zh=?"); args.append(zfix)
            if not dry:
                if sets:
                    cur.execute(f"UPDATE nodes SET {','.join(sets)} WHERE id=?", (*args, nid))
                cur.execute("UPDATE evidence SET grade='B', source=source || ' | LLM复核 ' || ? WHERE node_id=? AND grade='C'", (today, nid))
                cur.execute("UPDATE nodes SET confidence=0.9 WHERE id=?", (nid,))
            n_prom += 1
        for nid, reason in rej:
            if nid not in actual:
                continue
            if not dry:
                cur.execute("UPDATE nodes SET status='剔除候选' WHERE id=?", (nid,))
                cur.execute("UPDATE evidence SET source=source || ' | LLM剔除:' || ? || ' ' || ? WHERE node_id=?", (reason, today, nid))
            n_rej += 1
        print(f"{dom}: 复核 {n_prom} · 剔除 {n_rej} · 漏判 {missing or '无'}")
        total_prom += n_prom; total_rej += n_rej
    if not dry:
        con.commit()
    print(f"合计: 复核 {total_prom} · 剔除 {total_rej}")
    if dry:
        print("(dry run, 未写库)")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""curate_batch4_llm.py — 第四批 LLM 辅助批量策展·收官 (2026-10-31)

对象: 艺术90+医学78+法律77+地球气候77+教育66+农业62+化学43+实践技艺36 共 529 条 C 级
判据与语义同前三批。运行: python scripts/curate_batch4_llm.py [--dry]
"""
import sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ---- 艺术与设计 dom_art (90: 63 复核 / 27 剔除) ----
ART_PROMOTE = [
    ("x_73821ec9d0", None, "AI-generated video", None, None),
    ("x_776966f66e", None, "Chinese landscape painting", None, None),
    ("x_3369275f27", -220, "Chinese calligraphy", None, None),
    ("x_3d213e084c", None, "interactive storytelling", None, None),
    ("x_6391e9b2fe", 1989, "interaction design", None, None),
    ("x_dc8c3a84c4", 1889, "The Starry Night", None, None),
    ("x_b599979e9a", 1908, "animation", None, None),
    ("t_impressionism", 1874, "Impressionism", None, None),
    ("x_f755ba5f80", None, "sustainable design", None, None),
    ("x_e89ba16522", None, "harmony", None, None),
    ("t_hiphop", 1973, "hip-hop and sampling", None, None),
    ("x_8a8e115c2c", 1909, "urban planning", None, None),
    ("x_a760c26528", None, "sound art", None, None),
    ("t_symphony", 1750, "sonata form and symphony", None, None),
    ("x_3c6082c240", None, "media archaeology", None, None),
    ("x_871e672cab", 900, "counterpoint", None, None),
    ("x_e34778a486", 1901, "industrial design", None, None),
    ("x_fef862cdfc", None, "graphic design", None, None),
    ("x_2b56fc9bdb", None, "architectural design", None, None),
    ("x_b4186548d0", 1964, "the Beatles conquer America", None, None),
    ("x_c4be70fab7", 1910, "abstract art", None, None),
    ("x_6817050844", None, "photography and truth", None, None),
    ("t_rock", 1954, "rock and roll", None, None),
    ("x_a8b4c5b2d1", None, "digital curation", None, None),
    ("t_digitalphoto", 1975, "digital photography", None, None),
    ("x_6b6102c173", 1400, "Renaissance painting", None, None),
    ("x_4ca50a10ff", None, "service design", None, None),
    ("x_40f29d6c6a", None, "materials and the senses", None, None),
    ("x_7f55399534", 1853, "Vincent van Gogh", None, None),
    ("x_4733864823", None, "opera and music theatre", None, None),
    ("t_opera", 1600, "birth of opera", None, None),
    ("x_d63b2528b5", 1881, "Pablo Picasso", None, None),
    ("x_6a62cd3287", 1937, "Guernica", None, None),
    ("x_17ef72e089", 1880, "ethnomusicology", None, None),
    ("c_oilpaint", 1410, "oil painting technique", None, None),
    ("x_6e230f836a", None, "pop music industry", None, None),
    ("x_9e51187e04", None, "game design", None, None),
    ("t_jazz", 1917, "birth of jazz", None, None),
    ("x_1f8380ae36", None, "printmaking", None, None),
    ("x_a673a1643f", None, "generative art", None, None),
    ("t_games", 1962, "video games", None, None),
    ("x_7d77bbade7", 1948, "electronic music", None, None),
    ("x_589cb292fc", None, "film language", None, None),
    ("x_0a3f2b313d", 1975, "Pina Bausch's Tanztheater", None, None),
    ("t_cubism", 1907, "Cubism", None, None),
    ("x_c69a1c5423", 1922, "documentary", None, None),
    ("x_5bec753d78", None, "museum studies", None, None),
    ("x_8758d3b815", None, "art and power", None, None),
    ("x_5a4e283123", None, "art market", None, None),
    ("x_aebb4128c0", 1756, "Wolfgang Amadeus Mozart", None, None),
    ("x_7f9f186edf", 1968, "virtual reality", None, None),            # (born 1982→1968)
    ("x_6ba2dd1788", 1960, "installation and conceptual art", None, None),
    ("w_3ed6918bc0", 1925, "Art Deco", None, None),                    # 装饰风艺术
    ("x_d4bbee01f5", None, "design thinking", None, None),
    ("x_1cd7cd4ad5", 1770, "Ludwig van Beethoven", None, None),
    ("x_4166f9cb36", 1452, "Leonardo da Vinci", None, None),
    ("x_5237e1d822", None, "universal design", None, None),
    ("x_bcdbc1cf7a", None, "sculpture", None, None),
    ("x_4be7e517d5", None, "music and mathematics", None, None),
    ("x_c839b59039", None, "music analysis", None, None),
    ("x_ef55ab5014", None, "musical acoustics", None, None),
    ("x_72c9f4c6a3", None, "music therapy", None, None),
    ("x_c9a5a8bd77", None, "music cognition", None, None),
]
ART_REJECT = [
    ("w_7b997ed3de", "日期条目"), ("w_e3253f0ac7", "年份条目"),
    ("w_0271ae18ba", "年份条目"), ("w_21fc90ef3b", "年份条目"), ("w_777a63fc19", "日期条目"),
    ("w_f2ff6c6ce4", "行政机构"), ("w_c9f767ac0c", "机构"), ("w_25d88a8e1c", "机构"),
    ("w_211cc08cd8", "人名(偶像)"), ("w_4edfb056d5", "地名"), ("w_34182b04b5", "地名"),
    ("w_37e372d747", "地名"), ("w_ce66afdff6", "机构"), ("w_2aeed5db97", "人名消歧义"),
    ("w_ae5c17826d", "地名"), ("w_3d09678a94", "奖项(天文)"), ("w_277cbecd7a", "地名"),
    ("w_75b830cd84", "机构"), ("w_68aff41f8f", "域错配:计算机(图形学)"),
    ("w_afd8f25e69", "人名消歧义"), ("w_51bad5931c", "地名"), ("w_904e64834c", "人名消歧义"),
    ("w_df89ead94e", "地名"), ("w_4fbf9461ad", "地名"), ("w_d95cf6d244", "细碎(宣发物料)"),
    ("w_2cc60d3b30", "域错配:能源工程"), ("x_298ddcfb85", "重复:人因工程(eng域已复核)"),
]

# ---- 医学与健康 dom_med (78: 71 复核 / 7 剔除) ----
MED_PROMOTE = [
    ("x_e4f26271d8", 1971, "first clinical CT scan", None, None),
    ("x_55c4832783", None, "Chinese medicine and modern pharmacology", None, None),
    ("x_4fdc8c30f7", 1927, "infectious disease dynamics", None, None),
    ("x_ec10a1de84", None, "health communication", None, None),
    ("x_7ce938f3ab", None, "health statistics", None, None),
    ("x_c17c9c8eb4", None, "lymphoid organs and immune residency", None, None),
    ("x_1e0f330e3a", None, "global health", None, None),
    ("x_f407b1d5ce", None, "general practice", None, None),
    ("x_7b33d3bf37", None, "public health surveillance", None, None),
    ("x_155d0bb31d", None, "endocrine system", None, None),
    ("x_3ec4385544", 1820, "Florence Nightingale", None, None),
    ("x_96354b9c07", None, "health policy", None, None),
    ("x_97d1ee7256", None, "health economics", None, None),
    ("x_7a5093ae19", None, "respiratory physiology", None, None),
    ("x_ba980070fb", None, "surgery", None, None),
    ("x_399f1f02f9", None, "multidisciplinary teams", None, None),
    ("x_c0a475b879", 1909, "Brodmann areas", None, None),
    ("x_e9994e7c76", 1967, "palliative care", None, None),
    ("x_d08c6cb5fa", -460, "Hippocrates", None, None),
    ("x_efee5624e7", None, "rehabilitation medicine", None, None),
    ("x_8092a8130c", 150, "Zhang Zhongjing", "Person", None),         # 张仲景 Topic→Person
    ("x_49c775b575", None, "diagnostic imaging", None, None),
    ("x_9bb6aa199b", None, "clinical practice guidelines", None, None),
    ("x_29c4fc9b0a", None, "minimally invasive surgery", None, None),
    ("x_af32d6216d", None, "cardiac electrophysiology", None, None),
    ("x_502bff877f", 1958, "first pacemaker implantation", None, None),
    ("x_d21ff86186", None, "cardiovascular drugs", None, None),
    ("x_0c529bebe1", None, "emergency medicine", None, None),
    ("x_d9543b76cb", None, "consciousness research", None, None),
    ("x_0c17a7632f", None, "antimicrobial stewardship", None, None),
    ("x_5d96db603d", None, "antibiotic drugs", None, None),
    ("x_85b97a73db", None, "anticancer drugs", None, None),
    ("x_59197d845d", None, "digestive and metabolic physiology", None, None),
    ("x_04c95e8e9f", 1891, "Frederick Banting", None, None),
    ("x_c6c00c8085", None, "reproductive physiology", None, None),
    ("x_7000f4406e", None, "biologics", None, None),
    ("x_a214860d93", None, "epidemic modeling", None, None),
    ("x_09a65c042d", None, "vaccine epidemiology", None, None),
    ("x_cacbd8b50c", None, "vaccine hesitancy", None, None),
    ("x_0f010113c4", None, "case-control studies", None, None),
    ("x_722e8fee43", None, "mechanisms of pain", None, None),
    ("x_8c725103a5", 129, "Galen", None, None),
    ("x_50759f8aae", None, "neural stem cells", None, None),
    ("x_414348ef12", None, "neuropsychiatric drugs", None, None),
    ("x_0a61a2e760", None, "neuromodulation", None, None),
    ("x_8ad662fe9d", None, "mechanisms of neurodegeneration", None, None),
    ("x_433dd2f4c2", None, "synaptic transmission", None, None),
    ("x_3b4261dc73", None, "psychiatry", None, None),
    ("x_144de67bb8", None, "routes of drug administration", None, None),
    ("x_804fe88e8b", 1537, "Vesalius's anatomy lectureship", None, None),
    ("x_b7f34669b7", None, "rare diseases", None, None),
    ("x_835cfb2ce8", None, "enteric nervous system", None, None),
    ("x_958f42e6d7", None, "renal and fluid balance", None, None),
    ("x_1d983f8879", 1922, "first therapeutic use of insulin", None, None),
    ("x_ab67589299", None, "brain imaging", None, None),
    ("x_40872959fb", 1990, "brain-computer interfaces", None, None),
    ("x_dc637f2a42", None, "pharmacokinetics", None, None),
    ("x_fb1f020298", None, "pharmacodynamics", None, None),
    ("x_8f709a60d7", None, "drug interactions", None, None),
    ("x_248520cc9d", None, "drug design", None, None),
    ("x_3848284848", None, "blood-brain barrier", None, None),
    ("x_c83bca8a22", None, "visual neuroscience", None, None),
    ("x_ea4eafd0a0", None, "neural basis of memory", None, None),
    ("x_e5ddf9288d", None, "diagnostics", None, None),
    ("x_0463cff0f0", None, "motor control", None, None),
    ("x_1a8ddf6d83", None, "telemedicine", None, None),
    ("x_57966713cd", None, "critical care medicine", None, None),
    ("x_9ebc341270", None, "cohort studies", None, None),
    ("x_5aad55e921", 1972, "discovery of artemisinin", "Event", None),  # Topic→Event
    ("x_f49c2d7e5a", 1967, "first human heart transplant", None, None),
    ("x_a5c6f2e590", None, "anesthesiology", None, None),
]
MED_REJECT = [
    ("x_bc829b4cfc", "噪声(测试节点)"), ("w_0ebd4aab88", "年份条目"),
    ("w_2fb06ac96a", "日期条目"), ("w_cd95733849", "消歧义(GA)"),
    ("w_e4e682b34f", "机构"), ("w_2d80944224", "机构"),
    ("w_5eaa89f429", "重复:医学与健康(Domain)"),
]

# ---- 法律与治理 dom_law (77: 75 复核 / 2 剔除) ----
LAW_PROMOTE = [
    ("c_gdpr", 2018, "GDPR and data protection", None, None),
    ("c_wto", 1995, "WTO and the multilateral trading system", None, None),
    ("t_beccaria", 1764, "On Crimes and Punishments", None, None),
    ("c_human_rights", 1948, "Universal Declaration of Human Rights", None, None),
    ("x_f2ccb527ad", 2020, "China's Civil Code", None, None),
    ("x_ae619978fa", None, "humanitarian intervention", None, None),
    ("x_6d7e5a3b00", None, "arbitration and dispute settlement", None, None),
    ("c_sharia", 620, "Islamic legal tradition", None, None),
    ("x_2caff624a0", None, "tort liability principles", None, None),
    ("x_52caafddd1", None, "tort law", None, None),
    ("x_25195926b0", None, "public policy analysis", None, None),
    ("x_89ae3f4c8f", None, "public service innovation", None, None),
    ("x_3fb09c33c2", None, "public finance and budgeting", None, None),
    ("x_ba8a097564", None, "public choice theory", None, None),
    ("x_3a1cfc187b", None, "company law", None, None),
    ("x_d8761d5471", None, "criminal procedure", None, None),
    ("f_criminal", 1764, "criminal law and justice", None, None),
    ("x_e490f3954a", None, "penology", None, None),
    ("x_2f983e4103", None, "purposes of punishment", None, None),
    ("x_67f123479f", None, "case law and statute", None, None),
    ("x_518e2605c2", None, "labor law and gig work", None, None),
    ("x_cea3103bec", None, "labor law", None, None),
    ("c_antitrust", 1890, "antitrust law", None, None),
    ("x_9d82f3f080", None, "judicial review", None, None),
    ("x_0ca11e10ba", None, "judicial independence", None, None),
    ("x_377e951b56", None, "contract formation and validity", None, None),
    ("x_d8a9f820f3", None, "contract law", None, None),
    ("x_0cb5913a7b", None, "sovereignty and non-intervention", None, None),
    ("x_1fa1927b09", None, "international human rights law", None, None),
    ("x_1f5075ec28", None, "international criminal justice", None, None),
    ("x_45d4f55595", None, "international courts", None, None),
    ("x_5eef335d98", None, "international environmental law", None, None),
    ("x_7948b29c9f", None, "international economic law", None, None),
    ("x_de4927210e", None, "systems of fundamental rights", None, None),
    ("x_3bcaa8b2be", None, "equal protection", None, None),
    ("x_39d1419b3f", None, "emergency governance", None, None),
    ("t_napoleon", 1804, "Napoleonic Code", None, None),
    ("x_e1fc4a5bda", None, "governance and accountability", None, None),
    ("x_dfeeb6df7c", None, "intergovernmental relations", None, None),
    ("x_dc34fddb96", None, "policy evaluation", None, None),
    ("x_6fc19337a3", None, "digital rights", None, None),
    ("x_182ef9bbd5", None, "digital governance", None, None),
    ("x_14f576f6c1", None, "data property rights", None, None),
    ("x_179bd0aaa8", 1889, "Meiji Constitution", None, None),
    ("c_commonlaw", 1189, "common law and precedent", None, None),
    ("x_c8c2985c21", None, "conflicts of rights", None, None),
    ("x_6593ae002d", None, "separation of powers", None, None),
    ("x_dc688a3d3b", None, "law of treaties", None, None),
    ("x_088e6d3cb1", 1583, "Hugo Grotius", None, None),
    ("x_ea75f86d46", -638, "Solon", None, None),
    ("c_eu", 1993, "EU and regional integration", None, None),
    ("x_da4c0def65", None, "due process", None, None),
    ("x_3cd079af58", None, "comparative law", None, None),
    ("f_private", 1804, "private and commercial law", None, None),
    ("x_ef13787d07", None, "legal positivism", None, None),
    ("x_6fd18f205b", None, "sociology of law", None, None),
    ("x_2210cca294", None, "statutory interpretation", None, None),
    ("x_788a50fa26", None, "economic analysis of law", None, None),
    ("x_7c29f75518", None, "law of the sea", None, None),
    ("x_32d3558428", None, "property law", None, None),
    ("t_env_law", 1970, "environmental legislation and EIA", None, None),
    ("x_949c94b10c", None, "regulatory science", None, None),
    ("x_c4157e7603", None, "intellectual property law", None, None),
    ("x_8957a48440", None, "emergency powers and rule of law", None, None),
    ("x_bedbad0cd3", None, "principle of legality", None, None),
    ("x_74c2e59477", 1982, "UNCLOS", None, None),
    ("x_2a6a0ea642", None, "federalism", None, None),
    ("x_92e0cc3239", None, "natural law", None, None),
    ("x_a547471a3e", -106, "Cicero", None, None),
    ("x_b217f4ef4c", None, "limits of free speech", None, None),
    ("x_7661d3a4a3", None, "law of evidence", None, None),
    ("x_343add6959", None, "regulating multinationals", None, None),
    ("x_4f4d0e2fd9", None, "cross-border crime", None, None),
    ("x_43de635b94", 1755, "John Marshall", None, None),
    ("x_1cfb8aed8b", None, "criminology", None, None),                 # 犯罪学
]
LAW_REJECT = [
    ("x_9646f9b124", "重复:拿破仑法典(同批Proposition保留)"),
    ("x_3f446fd728", "重复:纽伦堡审判(既有Event)"),
]

# ---- 地球与气候科学 dom_earth (77: 69 复核 / 8 剔除) ----
EARTH_PROMOTE = [
    ("x_2fbe351149", None, "mesoscale convective weather", None, None),
    ("x_eb29624f45", None, "cloud physics", None, None),
    ("x_39d8e0491b", 1997, "Kyoto Protocol", None, None),
    ("x_33a0518563", None, "three-cell circulation model", None, None),
    ("x_5af0bd3204", None, "glacier mass balance", None, None),
    ("t_icecore", 1966, "ice cores and paleoclimate", None, None),
    ("x_79c3a612be", None, "El Niño", None, None),
    ("x_64e0abf8f5", None, "paleoclimatology", None, None),
    ("x_8e53c33a03", None, "typhoons and hurricanes", None, None),
    ("x_2fe9124f0c", 1950, "radiometric dating established", None, None),
    ("x_7f8c80bd15", None, "solid waste and circular economy", None, None),
    ("x_45a165e6ae", None, "soil remediation", None, None),
    ("x_2f59f78d68", None, "stratigraphy and paleontology", None, None),
    ("x_773ae0cb12", None, "seismology", None, None),
    ("x_6acf888272", None, "urban heat island", None, None),
    ("x_b797b76413", None, "layers of the atmosphere", None, None),
    ("x_ceccc1aefb", None, "atmospheric chemistry", None, None),
    ("x_396eb0c2c3", None, "air pollution", None, None),
    ("x_6358ec36d6", None, "atmospheric circulation", None, None),
    ("x_7d58286a74", None, "operational weather forecasting", None, None),
    ("x_cb349551a0", None, "structure of the lithosphere", None, None),
    ("x_965818c48b", None, "petrology", None, None),
    ("x_0a1e29d373", 2015, "Paris Agreement", None, None),
    ("x_63ee03c3f0", None, "persistent organic pollutants", None, None),
    ("x_8bb7dcb98f", None, "plate tectonics theory", None, None),
    ("x_68f9822e7f", None, "driving forces of plate motion", None, None),
    ("x_6b0922df02", None, "polar science", None, None),
    ("x_c6a89bc24f", None, "extreme event attribution", None, None),
    ("x_b82a1b2503", None, "extreme precipitation trends", None, None),
    ("x_fcac0cca0f", None, "structural geology", None, None),
    ("x_ce3418e950", 2000, "climate tipping points", None, None),
    ("x_e2395e1a90", None, "climate models", None, None),
    ("x_10038fb1a2", None, "CMIP model intercomparison", None, None),
    ("x_906163e500", None, "climate adaptation", None, None),
    ("x_bdd8ddbc4e", None, "hydrogeology", None, None),
    ("x_3f8955d5fe", None, "water pollution and treatment", None, None),
    ("x_d2ef2401cd", None, "ocean currents and the thermohaline circulation", None, None),
    ("x_346cdf5ffe", None, "sea level rise", None, None),
    ("x_04f7af8b76", None, "air-sea exchange", None, None),
    ("x_745d4a126c", None, "ocean and climate", None, None),
    ("x_62bdd147ae", None, "marine geology", None, None),
    ("x_768a69ef8b", None, "marine life", None, None),
    ("f_ocean", 1872, "ocean science", None, None),
    ("x_b75bdbf457", None, "ocean observing networks", None, None),
    ("x_ec278deae1", None, "ocean remote sensing", None, None),
    ("w_8c57275d3a", None, "ocean acidification", None, None),
    ("x_015fc63433", 1977, "deep-sea hydrothermal vents", None, None),
    ("x_1bc3a3b340", None, "offshore aquaculture", None, None),
    ("x_d9afc21679", None, "greenhouse gas inventories", None, None),
    ("x_4e23eb1ae7", None, "volcanic eruption mechanisms", None, None),
    ("x_94d297053b", None, "physical oceanography", None, None),
    ("x_bc8bcf2ada", None, "environmental impact assessment", None, None),
    ("x_24161bcf5a", None, "environmental microbiology", None, None),
    ("x_001d3b8976", None, "environmental monitoring", None, None),
    ("f_envir", 1962, "environmental science", None, None),
    ("x_08a02cdd31", None, "ecological restoration engineering", None, None),
    ("x_bcb586c19d", None, "ecosystem services", None, None),
    ("x_7aeb6b68d9", None, "biodiversity conservation", None, None),
    ("x_90f410bd2a", None, "petroleum geology", None, None),
    ("x_370a63a8d1", None, "mineralogy", None, None),
    ("x_89679886bb", None, "carbon cycle", None, None),
    ("t_carbon_ccs", 1996, "carbon capture and storage", None, None),
    ("x_765ecab372", 1890, "Zhu Kezhen", "Person", None),              # 竺可桢 Topic→Person
    ("x_fdebf6de0e", 1979, "First World Climate Conference", None, None),
    ("c_ozone", 1985, "ozone hole and Montreal Protocol", None, None),
    ("x_8893b98bc9", None, "blue carbon", None, None),
    ("x_b044fcb6c8", None, "planetary geology", None, None),
    ("w_5471026bd3", 1980, "teleconnection", None, None),
    ("x_e6eb86f372", None, "radar meteorology", None, None),
]
EARTH_REJECT = [
    ("w_90253361df", "机构(认证公司)"), ("w_5b8d906b6f", "重复:地球与气候科学(Domain)"),
    ("w_512ca8fb8a", "域错配:社会科学(城市化)"), ("w_42261bafd4", "重复:气象学(Field)"),
    ("w_a68661fb5c", "重复:数值天气预报(既有Method)"), ("w_2f4039e02d", "重复:气候科学(Field)"),
    ("x_09b7c83a5c", "重复:气候变化(既有)"), ("x_d979e0353b", "重复:基林曲线(既有Dataset)"),
]

# ---- 教育与传播 dom_edu (66: 55 复核 / 11 剔除) ----
EDU_PROMOTE = [
    ("c_factcheck", 2016, "fact-checking and misinformation", None, None),
    ("x_b5a7600434", None, "media effects theories", None, None),
    ("x_b10f39c13b", None, "information retrieval", None, None),
    ("x_e3ff5363ca", None, "information literacy", None, None),
    ("x_ca59f5fe9d", None, "knowledge organization", None, None),
    ("x_066c660554", None, "information overload", None, None),
    ("x_29cb1eeda4", None, "metacognition", None, None),
    ("x_e74cc352e1", None, "science of motivation", None, None),
    ("x_acb8896893", None, "collaborative learning", None, None),
    ("x_fb94d85dcb", None, "participatory culture", None, None),
    ("t_comenius", 1658, "Comenius's Didactica Magna", None, None),
    ("x_5f34435f0b", None, "the medium is the message", None, None),
    ("x_e7562ba8f1", None, "history of media", None, None),
    ("x_1c9d468e19", -551, "Confucius", "Person", None),               # 孔子 Topic→Person
    ("x_88eae845f5", None, "learning analytics", None, None),
    ("x_e06fa7167d", None, "brain mechanisms of learning", None, None),
    ("x_ca235e1e47", None, "family and education", None, None),
    ("x_ddecff47ed", 1968, "working memory", None, None),
    ("x_49fc4d9f83", None, "platform governance", None, None),
    ("c_radio_tv", 1920, "radio and television", None, None),
    ("x_277bafb555", 1969, "Open University founded", None, None),
    ("x_6fc81e7818", None, "open data", None, None),
    ("c_openaccess", 2002, "open access movement", None, None),
    ("x_267487387d", 2012, "Year of the MOOC", None, None),
    ("c_literacy", 1950, "literacy campaigns", None, None),
    ("x_b8cb01f5fb", None, "assessment of learning", None, None),
    ("x_2db3ad939f", None, "teacher professional development", None, None),
    ("x_66c07c1f3a", None, "teacher education", None, None),
    ("x_15aa59113d", None, "educational equity", None, None),
    ("x_6e357116a2", None, "educational psychology", None, None),
    ("x_52a3252bf2", None, "educational technology", None, None),
    ("x_6dc724f9e4", None, "neuromyths in education", None, None),
    ("x_6ceda78517", None, "digital humanities infrastructure", None, None),
    ("x_b507277af0", None, "digital libraries", None, None),
    ("x_d6dccb30ca", None, "data journalism", None, None),
    ("x_7383465f80", None, "journalistic professionalism", None, None),
    ("x_29ccd80c23", None, "archival science", None, None),
    ("x_f56528d42d", None, "attention economy", None, None),
    ("x_de36bc875c", 1767, "Wilhelm von Humboldt", None, None),
    ("x_c30b449e3f", 1810, "founding of Humboldt University", None, None),
    ("x_ab388401e3", None, "gamified learning", None, None),
    ("x_8c4554b1f5", None, "lifelong learning", None, None),
    ("x_171a5a7f2b", 1862, "Morrill Land-Grant Act", None, None),
    ("x_31a81cbac2", None, "public opinion", None, None),
    ("x_4c377441f4", -470, "Socrates", "Person", None),                # 苏格拉底 Person ✓
    ("t_montessori", 1907, "Montessori method", None, None),
    ("x_aedae3651c", None, "individual differences in cognition", None, None),
    ("x_a9579cb0ca", None, "cognitive load theory", None, None),
    ("x_545ce80693", None, "instructional design", None, None),
    ("x_c0d3f116dc", None, "learning from errors", None, None),
    ("c_printing_china", 700, "woodblock printing", None, None),
    ("x_c678dd6da7", None, "project-based learning", None, None),
    ("x_66f04025c2", None, "higher education", None, None),
    ("x_4a05822188", None, "algorithmic recommendation", None, None),  # 算法推荐
    ("x_b3428d8464", 1961, "scientometrics", None, None),              # 科学计量
]
EDU_REJECT = [
    ("w_2d6388c12e", "机构"), ("w_968b58913d", "机构"), ("w_55ce836600", "地名"),
    ("w_e22f742c82", "地名"), ("w_de0eb81752", "机构"), ("w_f84f3c5b44", "地名"),
    ("w_3c26987ff3", "泛机构概念"), ("w_73083b5ba1", "机构"), ("w_4b039bce29", "机构"),
    ("w_7d745a2727", "机构"), ("x_bb48182543", "域错配:计算机(知识图谱)"),
]

# ---- 农业与食品 dom_agri (62: 59 复核 / 3 剔除) ----
AGRI_PROMOTE = [
    ("cv_ddt", 1962, "the DDT controversy", None, None),
    ("ev_spring", 1962, "Silent Spring published", None, None),
    ("x_2cd5e615e8", None, "zoonoses", None, None),
    ("x_0ad3fc1196", None, "crop genomics", None, None),
    ("x_b09b8c71c7", None, "crop physiology and agronomy", None, None),
    ("x_fbd1edcd83", None, "cold-chain logistics", None, None),
    ("x_c07eeb4c0d", None, "livestock wastewater", None, None),
    ("x_3fa251d28c", None, "smart livestock farming", None, None),
    ("x_3c97aa234d", None, "veterinary science", None, None),
    ("x_51387d0d06", None, "produce quality", None, None),
    ("x_56f7c29e14", None, "climate-smart agriculture", None, None),
    ("c_domestication", -15000, "domestication of plants and animals", None, None),
    ("x_0117f00e18", None, "animal vaccines", None, None),
    ("x_e5402ceca3", None, "animal welfare", None, None),
    ("x_10b035d92e", None, "animal breeding", None, None),
    ("x_b30ff8f3d7", None, "animal nutrition", None, None),
    ("t_pesticide", 1939, "synthetic pesticides", None, None),
    ("x_37c1eeaaa7", 1960, "IRRI founded", None, None),
    ("x_73245ad5e4", None, "soil chemistry", None, None),
    ("x_be34a40216", None, "soil microbiology", None, None),
    ("x_0906f35d0b", None, "soil organic matter", None, None),
    ("x_2f15a98cae", None, "soil physics", None, None),
    ("x_2bc439e3f4", None, "soil carbon stocks", None, None),
    ("x_f2609c3079", None, "companion animal medicine", None, None),
    ("x_66591bcbed", None, "drought-tolerant breeding", None, None),
    ("x_87b8e181a3", None, "organic farming", None, None),
    ("x_9048cbea95", None, "future foods", None, None),
    ("x_d2509e3199", 1973, "hybrid rice breakthrough", None, None),
    ("x_8f3cbe1afe", 1840, "Liebig's mineral nutrition theory", None, None),
    ("x_ffd91e3c4d", None, "plant protection", None, None),
    ("t_aquaculture", -475, "aquaculture", None, None),
    ("x_5ec7d78d71", None, "aquaculture nutrition", None, None),
    ("x_f66e591bd8", None, "soil and water conservation", None, None),
    ("x_3ce24c49c6", None, "fisheries management", None, None),
    ("tech_greenhouse", -100, "greenhouses", None, None),
    ("tech_plow", -3500, "the plow", None, None),
    ("x_394d576920", None, "biological control", None, None),
    ("f_animal", -15000, "animal husbandry and aquaculture", None, None),
    ("x_2c74ce1bec", None, "seed science", None, None),
    ("x_e5fd357dfc", None, "precision agriculture", None, None),
    ("x_717236933c", None, "food processing", None, None),
    ("x_c290659e5f", None, "fertilizer science", None, None),
    ("x_4d92ab6a1b", None, "plant breeding", None, None),
    ("x_f9fca444b1", None, "nutrition science", None, None),
    ("pr_bees", 2006, "pollinator crisis", None, None),
    ("x_921e767a0f", None, "beekeeping", None, None),
    ("x_cf60d41b8e", 1944, "Borlaug goes to Mexico", None, None),
    ("x_53066d1d1f", None, "continuous cropping obstacles", None, None),
    ("x_303a70b6f6", None, "urban agriculture", None, None),
    ("x_bf1aa8b432", None, "immobilization of heavy metals", None, None),
    ("x_c560ec6624", None, "food preservation", None, None),
    ("x_ed87556786", None, "food processing engineering", None, None),
    ("x_ad10d86c29", None, "food chemistry", None, None),
    ("x_0e8032dff9", None, "food safety", None, None),
    ("x_2a44438f80", None, "food regulations and labeling", None, None),
    ("x_a72d0aca3a", None, "food microbiology", None, None),
    ("x_d1a7648020", None, "food additives", None, None),
    ("c_horse", -3500, "domestication of the horse", None, None),
    ("x_9092cff910", None, "functional foods", None, None),            # 功能食品
]
AGRI_REJECT = [
    ("w_79e93cbde1", "行政机构沿革"), ("w_7de6a0a71c", "重复:发酵(既有)+面包与啤酒(prac域)"),
    ("x_1d91910f35", "域错配:生物(DNA双周年)"),
]

# ---- 化学 dom_chem (43: 34 复核 / 9 剔除) ----
CHEM_PROMOTE = [
    ("x_6c6995c4bf", None, "main-group chemistry", None, None),
    ("w_9c61c24ed5", None, "acetic acid", None, None),
    ("x_bbd22f1037", 1917, "Robert Burns Woodward", None, None),
    ("x_e7cf7ed028", 1886, "photochemistry", None, None),
    ("x_61adec1999", None, "molecular simulation", None, None),
    ("x_6f0c60f2b8", None, "chemical kinetics", None, None),
    ("x_5b83904dab", None, "chemical equilibrium", None, None),
    ("x_3bfcf588d9", None, "chemical thermodynamics", None, None),
    ("x_56e0d97c44", None, "reaction mechanisms", None, None),
    ("x_3fadc9b58f", None, "total synthesis of natural products", None, None),
    ("x_91e9bbc9e2", None, "radiochemistry", None, None),
    ("x_86dbe21355", None, "crystal engineering", None, None),
    ("x_eb6d3482ec", None, "organic structure elucidation (NMR/MS/IR)", None, None),
    ("x_da82066255", None, "organometallic catalysis", None, None),
    ("x_c5f496fd1e", None, "heterocyclic chemistry", None, None),
    ("x_784322580e", 1936, "Yuan T. Lee", "Person", None),             # 李远哲 Topic→Person
    ("x_3db790ceab", None, "amino acids and peptides", None, None),
    ("x_d1dfd7e16b", None, "aqueous solution chemistry", None, None),
    ("w_c8ed51b3e2", None, "hydrochloric acid", None, None),
    ("x_ccf8129eaa", 1661, "Boyle's The Sceptical Chymist", None, None),
    ("x_11253b0e73", None, "electrochemical kinetics", None, None),
    ("x_5e7cb76111", None, "stereoselective synthesis", None, None),
    ("x_972a23b937", None, "carbohydrate chemistry", None, None),
    ("x_67b1f78e80", None, "nanomaterials chemistry", None, None),
    ("x_6498c8590b", None, "statistical thermodynamics", None, None),
    ("x_b8e9feb821", None, "green chemistry", None, None),
    ("x_02e77a221f", None, "colloids and dispersions", None, None),
    ("x_553ea5359f", None, "aromatic chemistry", None, None),
    ("x_ceb0b7c57e", None, "medicinal chemistry", None, None),
    ("x_010c9c0e22", None, "surface and interface chemistry", None, None),
    ("x_bb5fc07890", 1990, "retrosynthetic analysis", None, None),
    ("x_fe7befffe5", None, "quantum chemistry calculations", None, None),
    ("x_fe036f9ad7", 1898, "discovery of radium", None, None),
    ("x_26f140203f", 1901, "Linus Pauling", None, None),
]
CHEM_REJECT = [
    ("w_3b8017f6f5", "年份条目"), ("w_f89b5b9232", "机构"), ("w_1101924827", "机构"),
    ("w_cf1e4a35f2", "机构"), ("w_e5cd8b0f51", "域错配:环境科学(污染)"),
    ("w_7230b900e2", "域错配:地球科学(空气污染)"), ("w_8ba12c2c3d", "域错配:地球科学(空气)"),
    ("x_e3c44484f3", "重复:石墨烯(物理域A)"), ("x_51f173802d", "重复:哈伯-博施固氮(既有)"),
]

# ---- 实践技艺与生活 dom_prac (36: 32 复核 / 4 剔除) ----
PRAC_PROMOTE = [
    ("x_ca22ea0133", None, "Chinese regional cuisines", None, None),
    ("x_6ab88be00b", None, "traditional sports", None, None),
    ("c_martial", -500, "traditional martial arts", None, None),
    ("x_56c6f0e595", None, "sociology of sport", None, None),
    ("x_8b647d8347", None, "knife skills and heat control", None, None),
    ("x_52bc8e1277", None, "molecular gastronomy", None, None),
    ("x_ac70b3d5fe", None, "fermented foods", None, None),
    ("x_e318902232", None, "coffee and tea craft", None, None),
    ("x_2246b6658b", None, "outdoor sports", None, None),
    ("x_90c3e624ec", None, "digital craftsmanship", None, None),
    ("x_cfc28818d5", None, "woodworking and joinery", None, None),
    ("x_e75f32e015", None, "lacquer art", None, None),
    ("x_4e63a1cace", None, "the science of baking", None, None),
    ("x_5c0e7164ab", None, "chemistry of cooking", None, None),
    ("x_397768570a", None, "glasswork", None, None),
    ("x_11c28cb5c7", None, "esports", None, None),
    ("x_8c9b57f492", None, "paper craft and bookbinding", None, None),
    ("c_textile", -6000, "spinning and weaving", None, None),
    ("x_475055046c", None, "textile dyeing and printing", None, None),
    ("c_tea", -200, "tea and the way of tea", None, None),
    ("c_navigation", -1000, "celestial navigation and ocean voyaging", None, None),
    ("x_f61a18c8e3", 533, "Jia Sixie", "Person", None),                # 贾思勰 Topic→Person
    ("x_7aaf30834b", None, "sports medicine", None, None),
    ("x_6f635a2c94", None, "sports biomechanics", None, None),
    ("x_ecf707326c", None, "exercise physiology", None, None),
    ("x_d02781f494", None, "athletic training", None, None),
    ("x_bcfe9995a4", None, "metalworking", None, None),
    ("x_f847ec6ff0", 733, "Lu Yu", "Person", None),                    # 陆羽 Topic→Person
    ("x_e8478ad83d", None, "ceramic craft", None, None),
    ("c_bread", -3000, "bread and beer", None, None),
    ("x_0b83ff2aeb", 1863, "Pierre de Coubertin", None, None),
    ("x_75134e7911", None, "table manners and etiquette", None, None),
]
PRAC_REJECT = [
    ("w_3f294176d8", "地名"), ("w_4b9b0d308a", "地名"),
    ("w_2f6d51a6c1", "地名"), ("w_c9bcf1f71c", "地名"),
]

BATCHES = [
    ("dom_art", ART_PROMOTE, ART_REJECT),
    ("dom_med", MED_PROMOTE, MED_REJECT),
    ("dom_law", LAW_PROMOTE, LAW_REJECT),
    ("dom_earth", EARTH_PROMOTE, EARTH_REJECT),
    ("dom_edu", EDU_PROMOTE, EDU_REJECT),
    ("dom_agri", AGRI_PROMOTE, AGRI_REJECT),
    ("dom_chem", CHEM_PROMOTE, CHEM_REJECT),
    ("dom_prac", PRAC_PROMOTE, PRAC_REJECT),
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
        missing = sorted(actual - ids)
        extra = sorted(ids - actual)
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
        print(f"{dom}: 复核 {n_prom} · 剔除 {n_rej} · 漏判 {missing or '无'} · 多余 {extra or '无'}")
        total_prom += n_prom; total_rej += n_rej
    if not dry:
        con.commit()
    print(f"合计: 复核 {total_prom} · 剔除 {total_rej}")
    if dry:
        print("(dry run, 未写库)")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""curate_batch3_llm.py — 第三批 LLM 辅助批量策展 (2026-10-31)

对象: 生物技术(106) + 社会科学(94) + 经济与商业(94) + 形式科学(90) 共 384 条 C 级
判据与语义同前两批。运行: python scripts/curate_batch3_llm.py [--dry]
"""
import sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ============ 生物技术 dom_bio (106: promote 99 / reject 7) ============
BIO_PROMOTE = [
    ("x_c58d18c9b8", 1988, "PCR automation", None, None),
    ("x_4e3be29d3a", 1912, "X-ray crystallography", None, None),
    ("w_54eca2e7ca", None, "G protein-coupled receptor", None, None),  # G蛋白偶联受体
    ("x_1e08995820", None, "major histocompatibility complex", None, None),
    ("x_e35131964f", 2008, "Human Microbiome Project", None, None),
    ("x_38a81f65d5", None, "human genetics", None, None),
    ("x_999d810126", None, "conservation biology", None, None),
    ("x_a4c7b38a1d", None, "innate immunity", None, None),
    ("c_photosynthesis", 1779, "photosynthesis", None, None),
    ("x_3b13355012", 1950, "elucidation of the Calvin cycle", None, None),
    ("t_clonal", 1957, "clonal selection theory", None, None),
    ("x_d25c7899e0", 1996, "immune checkpoints", None, None),
    ("x_ff396834d8", 1949, "immune tolerance", None, None),
    ("x_e717775ac9", 1958, "invasion ecology", None, None),
    ("c_endosymbiosis", 1967, "endosymbiosis", None, None),
    ("x_35b9aa45eb", 2013, "cryo-EM resolution revolution", None, None),
    ("x_3516786169", None, "cryo-electron tomography", None, None),
    ("w_2f993afcbb", None, "bacterial strain", None, "菌株"),          # 分型→菌株
    ("x_ec3d6ce1a8", 1973, "molecular cloning", None, None),
    ("x_9a22b623f6", None, "molecular docking", None, None),
    ("x_c8dbbc0c9e", 1674, "first sighting of microorganisms", None, None),
    ("x_2d50357b7f", 1911, "Melvin Calvin", None, None),
    ("x_556b51c8fd", None, "fermentation engineering", None, None),
    ("x_4226cc1d49", None, "metabolic flux engineering", None, None),
    ("x_dd9e4cd980", 2000, "synthetic gene circuits", None, None),
    ("t_synthetic_genome", 2010, "synthetic genome", None, None),
    ("x_9899b5244d", None, "urban ecology", None, None),
    ("x_5b3ad50554", 1989, "gene knockout", None, None),
    ("x_b5700acf9f", 1990, "gene therapy", None, None),
    ("x_16a72f04de", 1927, "gene mutation", None, None),
    ("x_f10f620476", 1986, "genomics", None, None),
    ("x_ce32cdf15c", 1961, "gene regulation", None, None),
    ("x_858fff0877", None, "gene regulatory networks", None, None),
    ("x_a66f8e05ba", 1865, "Mendel's laws", None, None),
    ("x_80a416197f", 1967, "island biogeography", None, None),
    ("x_e784a4e45c", 1822, "Louis Pasteur", None, None),
    ("x_db88f73821", 1961, "stem cells", None, None),
    ("w_81835a9a9e", 1861, "microbiology", None, None),                # (born 1546→1861)
    ("c_microbiome", 2000, "microbiome", None, None),
    ("x_d2662a83e6", None, "restoration ecology", None, None),
    ("x_233de546dc", 1976, "antibody diversity (V(D)J recombination)", None, None),
    ("x_3aabac3948", 1989, "quantitative trait loci", None, None),
    ("x_a3d5a24887", 1918, "quantitative genetics", None, None),
    ("w_0fe2a80552", None, "entomology", None, None),                  # 昆虫学
    ("x_f1aff7de0e", 1974, "chromatin and histones", None, None),
    ("x_156f7b958a", None, "NMR structure determination", None, None),
    ("x_417622aa41", 2000, "ribosome structure", None, None),
    ("x_4a04b1e919", 1918, "Frederick Sanger", None, None),
    ("w_87990be6d6", -300, "botany", None, None),                      # 植物学
    ("x_05a618046b", None, "ecological responses to climate change", None, None),
    ("x_f35949d519", 1917, "ecological niche", None, None),
    ("f_ecology", 1866, "ecology", None, None),
    ("x_5cfde451af", None, "ecosystem diversity", None, None),
    ("x_590883523c", 1935, "ecosystem ecology", None, None),
    ("x_b02956f860", 1962, "biosensors", None, None),
    ("x_9b17337cce", 1970, "bioinformatics", None, None),
    ("x_bee4b5b1e1", None, "biomanufacturing", None, None),
    ("x_9f6481f93b", None, "bioreactors", None, None),
    ("pr_biodiversity", 1992, "biodiversity crisis", None, None),
    ("x_3405f7eecc", 1993, "biosafety", None, None),
    ("x_61bf7d8983", None, "biological membranes", None, None),
    ("x_2ba937d2c3", 1925, "vaccine adjuvants", None, None),
    ("x_6ed7163ac3", None, "vaccinology", None, None),
    ("x_a01d2386dd", 1898, "virology", None, None),
    ("x_0a40697605", None, "population ecology", None, None),
    ("x_6cddbfe559", 1843, "Robert Koch", None, None),
    ("x_9a23e33f57", 2009, "organoids", None, None),
    ("x_01a6a3d624", None, "omics and multi-omics", None, None),
    ("x_bd3722d53e", 1993, "tissue engineering", None, None),
    ("x_e5fbd5547a", None, "signal transduction", None, None),
    ("x_ac21693818", 2002, "cell cycle and apoptosis", None, None),
    ("x_a73622bb82", None, "cytokines", None, None),
    ("x_b09ec8894b", None, "cell therapy", None, None),
    ("x_3d2092558a", None, "structure determination algorithms", None, None),
    ("x_92b4a8d904", 1930, "population genetics", None, None),         # (born 1980→1930)
    ("x_301fade7d8", None, "community ecology", None, None),
    ("x_d044568227", None, "tumor immunology", None, None),
    ("x_912d0554fa", None, "tumor microenvironment", None, None),
    ("x_a078f39721", None, "membrane protein crystallization", None, None),
    ("x_bb651ede59", None, "membrane protein structures", None, None),
    ("x_f2ce8f2aa6", 1963, "autophagy", None, None),
    ("x_5b2f786eec", None, "autoimmune diseases", None, None),
    ("w_e01fbd1d4f", 1828, "biochemistry", None, None),                # 生物化学
    ("x_7c1a85185b", None, "protein synthesis", None, None),
    ("x_110c89c808", None, "protein complexes", None, None),
    ("x_23dc076f5b", None, "protein design", None, None),
    ("x_9cb8a42bc0", 1980, "ubiquitin-proteasome pathway", None, None),
    ("x_6f39e5c731", None, "behavioral ecology", None, None),
    ("x_538a7797ed", 1942, "epigenetics", None, None),
    ("x_32dcb884ff", 1906, "allergy", None, None),
    ("x_a3416771e5", 1910, "linkage and crossing over", None, None),
    ("x_c36f84dad3", None, "linkage analysis", None, None),
    ("x_4b6d89e6df", None, "adaptive immunity", None, None),
    ("x_167999a4a8", 1897, "enzymes and catalysis", None, None),
    ("x_0b1eca4a6d", None, "enzyme engineering", None, None),
    ("x_2eedafa06b", None, "non-coding RNA", None, None),
    ("x_8d9eb5d4fa", None, "food chains and trophic levels", None, None),
    ("x_856412b136", 1902, "Barbara McClintock", None, None),
    ("x_40d41a2537", 1969, "insulin structure determination", None, None),
]
BIO_REJECT = [
    ("w_52a14245ca", "日期条目"), ("w_01fd1b3543", "年份条目"),
    ("w_e0e77e9df3", "机构"), ("w_8c5d1e3872", "机构"),
    ("w_1d36bcde43", "域错配:宜入医学域"), ("w_4f89ab7495", "域错配:物理(荧光)"),
    ("w_fea42d3700", "重复:表观遗传学(同批简体保留)"),
]

# ============ 社会科学 dom_soc (94: promote 61 / reject 33) ============
SOC_PROMOTE = [
    ("x_2c78490590", 1981, "World Values Survey", None, None),
    ("x_f2adc13f19", 1896, "clinical psychology", None, None),
    ("x_a777b54e38", 1662, "demography", None, None),
    ("x_55e888afb9", 1937, "personality psychology", None, None),
    ("x_b23a53ba14", 1981, "Big Five personality traits", None, None),
    ("x_e43c30f6d6", 1970, "information asymmetry", None, None),
    ("x_ff793ceb9f", 1954, "public goods", None, None),
    ("c_tragedy", 1968, "tragedy of the commons", None, None),
    ("t_institution", 1990, "institutional economics", None, None),
    ("x_bbc8f9e54f", None, "labor economics", None, None),
    ("x_4a24a5c432", None, "applications of game theory", None, None),
    ("x_0462384d33", 1882, "developmental psychology", None, None),
    ("x_ea65969320", None, "development economics", None, None),
    ("x_c4241bde96", 1817, "international trade theory", None, None),
    ("x_e6d8740471", 1925, "urban sociology", None, None),
    ("x_ce88aa471d", 1920, "externalities", None, None),
    ("x_3643e05147", 1936, "macroeconomics", None, None),              # (born 1929→1936)
    ("x_bcda86406f", 1912, "sociology of religion", None, None),
    ("x_fb98c7f856", 1962, "experimental economics", None, None),      # (born 2002→1962)
    ("x_fb74789e1a", None, "sociology of the family", None, None),
    ("x_7397b72cfb", None, "industrial and organizational psychology", None, None),
    ("x_e096a0f374", None, "work and organization studies", None, None),
    ("x_25726c7bf2", 1912, "Milton Friedman", None, None),
    ("x_8326dea7b1", 1890, "microeconomics", None, None),
    ("x_0b352adffc", None, "psychometrics", None, None),
    ("x_7d37f3be4c", None, "psychological resilience", None, None),
    ("x_ad43b58b66", None, "emotion regulation", None, None),
    ("x_1052dcfd4e", None, "search and matching", None, None),
    ("x_131afbd97b", None, "cultural psychology", None, None),
    ("t_weber", 1905, "Protestant ethic and capitalism", None, None),
    ("x_891777dad3", 1772, "David Ricardo", None, None),
    ("x_c97c6d71a1", None, "attention and executive function", None, None),
    ("x_cbb6c76a37", 1858, "Émile Durkheim", None, None),
    ("x_4e487fb2f4", 1897, "Suicide (Durkheim)", None, None),
    ("x_53cd1acd0f", 1883, "Joseph Schumpeter", None, None),
    ("x_881b4ecd9b", None, "environmental economics", None, None),
    ("t_piaget", 1923, "Piaget's genetic epistemology", None, None),
    ("x_7f0d1f3603", None, "cultural reproduction (Bourdieu)", None, None),
    ("x_bd7e5b4166", None, "social stratification", None, None),
    ("x_0d79dc379b", 1908, "social psychology", None, None),
    ("x_31c1384e3a", None, "social networks", None, None),
    ("c_network", 1930, "social network analysis", None, None),
    ("x_8bfcb480b0", None, "social capital", None, None),
    ("x_5fd08a0f7e", None, "social movement theory", None, None),
    ("x_a5f6de5599", 1998, "positive psychology", None, None),
    ("c_milgram", 1961, "Milgram obedience experiment", None, None),
    ("x_bb7a6dc68f", 1928, "John Nash", None, None),
    ("x_74d1862a40", 1915, "Paul Samuelson", None, None),
    ("t_behavioral", 1979, "behavioral economics", None, None),
    ("x_d3c4434bb9", 2002, "Nobel Prize for behavioral economics", None, None),
    ("x_87e2da7653", 2009, "computational social science", None, None),
    ("x_603277d9d2", 1930, "econometrics", None, None),                # (born 2012→1930)
    ("x_21d72a9cc5", 1956, "cognitive psychology", None, None),
    ("x_cd682a1307", None, "monetary economics", None, None),
    ("x_fcdd814120", None, "cross-cultural research", None, None),
    ("x_256a755583", None, "evolutionary psychology", None, None),
    ("x_6d5db68e7d", 1924, "Hawthorne studies", None, None),
    ("x_96cc78fa55", 1986, "risk society (Beck)", None, None),
    ("x_f71f91163d", 1908, "Abraham Maslow", None, None),
    ("w_50d37c464f", 1919, "international relations", None, "国际关系学"),  # 國際關係學
    ("w_4c76c58bad", None, "political economy", None, None),           # 政治经济学
]
SOC_REJECT = [
    ("w_ae03b301f6", "年份条目"), ("w_20ec1ebf14", "年份条目"),
    ("w_bdac6e924c", "机构"), ("w_54d1df1974", "机构"), ("w_cd21fba316", "机构"),
    ("w_8cfdae93f9", "机构"), ("w_66cea36231", "泛机构概念"), ("w_7716414944", "行政机构"),
    ("w_07240b13bf", "机构"), ("w_b0510ef464", "机构"), ("w_2411c8e87b", "机构"),
    ("w_51d3c2702b", "域错配:生活技艺"), ("w_fe7d3f4b84", "机构"),
    ("w_2976e91c23", "泛概念(心理状态)"), ("w_b6f57a960b", "机构"),
    ("w_a7def10b45", "机构"), ("w_d72114b5f4", "机构"), ("w_0f99269ba5", "机构"),
    ("w_31d0a3c1aa", "地名"), ("w_c0dfd788d9", "机构"),
    ("w_28a284c63a", "域错配:地球科学(气象雷达)"),
    ("w_cfa4ac0978", "域错配:哲学(宜入人文域)"),
    ("w_46fd796d21", "泛概念(因果)"), ("w_4a27f6167d", "泛概念(科学)"),
    ("w_9935fd8a32", "域错配:交叉学科(系统科学)"), ("w_5d6a59b2f2", "域错配:管理"),
    ("w_8b33859e41", "泛概念(国别社会)"), ("w_b0a79b23b5", "机构"),
    ("w_7b6dc27d1d", "机构"), ("w_5e5e6a6dbf", "机构"),
    ("w_023cc905ae", "域错配:宜入人文域(东方学)"),
    ("w_9ca51c79bb", "域错配:宜入教育与传播域(传播学)"),
    ("w_138a676635", "重复:注意与执行功能(泛概念变体)"),
]

# ============ 经济与商业 dom_econ (94: promote 47 / reject 47) ============
ECON_PROMOTE = [
    ("x_b11bd14dba", 1929, "Wall Street Crash of 1929", None, None),
    ("x_ecfc63978e", 2008, "2008 global financial crisis", None, None),
    ("c_silkroad", -130, "Silk Road and Eurasian trade routes", None, None),
    ("x_c13e179fd7", 1978, "China's reform and opening-up", None, None),
    ("x_d4dd86f545", None, "central bank digital currency", None, None),
    ("c_dotcom", 2000, "dot-com bubble", None, None),
    ("x_8291562b84", None, "industrial upgrading", None, None),
    ("x_ed66886864", None, "industrial policy", None, None),
    ("x_7fa12073de", 1985, "supply chain management", None, None),
    ("c_insurance", 1347, "insurance and actuarial science", None, None),
    ("x_71b4f0ca4b", None, "global value chains", None, None),
    ("x_9fd81f7a61", 1958, "corporate finance", None, None),
    ("x_95afd0c7b7", None, "tariff and non-tariff barriers", None, None),
    ("x_b7efb8fd79", 1949, "export controls", None, None),
    ("x_6f5bd6cd82", None, "manufacturing processes", None, None),
    ("x_da9b3c8de4", None, "Industrial Revolution and labor", None, None),
    ("c_gig", 2010, "platform economy and gig work", None, None),
    ("x_7f54473329", 1952, "portfolio theory", None, None),
    ("c_index_fund", 1976, "index investing", None, None),
    ("x_0f4aae793e", None, "smart manufacturing", None, None),
    ("x_7b28339380", 1965, "efficient market hypothesis", None, None),
    ("x_d50c9f3a39", None, "trade in services", None, None),
    ("x_3b81feff0a", None, "standards competition", None, None),
    ("x_89a14b34e4", None, "comparative advantage and factor endowments", None, None),
    ("x_6377151cb3", None, "exchange rates and balance of payments", None, None),
    ("c_assembly_line", 1913, "assembly line", None, None),
    ("c_welfare", 1883, "welfare state", None, None),
    ("t_scientific_mgmt", 1911, "scientific management", None, None),
    ("x_73dc8d177b", 2011, "lean startup", None, None),
    ("t_kaizen", 1950, "lean production", None, None),
    ("x_8b98e72063", None, "green finance", None, None),
    ("x_296b29f0e0", None, "free trade agreements", None, None),
    ("x_fa22f62634", None, "behavioral finance", None, None),
    ("x_4664bcd491", 1973, "derivatives and hedging", None, None),
    ("x_054f5e7756", None, "quality management", None, None),
    ("x_a016344d11", None, "trade and supply chain security", None, None),
    ("x_5dbbf55ce7", None, "trade and development", None, None),
    ("x_72f3dc68ab", None, "trade and employment", None, None),
    ("x_02422e987e", None, "trade and environment", None, None),
    ("x_1126721472", None, "capital structure (MM theorem)", None, None),
    ("x_9d2b7e2f87", 1964, "capital asset pricing model", None, None),
    ("x_4529dfda2f", None, "cross-border e-commerce", None, None),
    ("x_26e8fc7ab4", None, "operations management", None, None),
    ("x_8b929be971", 1988, "financial regulation", None, None),
    ("x_bd593ebeef", None, "fintech", None, None),
    ("x_f2d9a98c5d", 1602, "Amsterdam Stock Exchange", None, None),
    ("x_ea63996a78", None, "venture capital deal terms", None, None),
]
ECON_REJECT = [
    ("w_d0127b0af4", "年份条目"), ("w_56073302be", "年份条目"),
    ("w_c4afb07615", "机构"), ("w_107d217cc4", "泛概念(国别经济)"),
    ("w_9f257cd27b", "域错配:政策概念"),
    # 法国/欧洲市镇维基条目(39)
    ("w_42e7c3c78e", "地名"), ("w_9e9a016c2a", "地名"), ("w_6f4a543345", "地名"),
    ("w_0b8735a3ab", "地名"), ("w_bddfc72c1a", "地名"), ("w_51d720a7f7", "地名"),
    ("w_7e2c37d129", "地名"), ("w_c3a73722a2", "地名"), ("w_601295c9f9", "地名"),
    ("w_db7d111b08", "地名"), ("w_521322f574", "地名"), ("w_681b6753ba", "地名"),
    ("w_3ac46c7e48", "地名"), ("w_b2248ddab9", "地名"), ("w_64712822e9", "地名"),
    ("w_089a47f5b5", "地名"), ("w_43a9bdf387", "地名"), ("w_9e118f63fe", "地名"),
    ("w_3b05641844", "地名"), ("w_92647c3354", "地名"), ("w_b5249b03e5", "地名"),
    ("w_cb34dc1c41", "地名"), ("w_afae4effef", "地名"), ("w_b0bcabbfdb", "地名"),
    ("w_112de46717", "地名"), ("w_4af7300a02", "地名"), ("w_36fe015c1e", "地名"),
    ("w_6af5bf9489", "地名"), ("w_8a4e8e1cce", "地名"), ("w_3c04cd63cd", "地名"),
    ("w_c7f85a3e3f", "地名"), ("w_e90fa32637", "地名"), ("w_3c1f2aebfd", "地名"),
    ("w_00e19863a7", "地名"), ("w_2cddf7c4d1", "地名"), ("w_8313d85969", "地名"),
    ("w_bb3d7608b2", "地名"), ("w_2b6b8d37ae", "地名"), ("w_9bb438edff", "地名"),
    ("x_f87bf526e2", "重复:全球价值链(同批保留)"),
    ("x_b78efea77b", "域错配:政策概念(军民融合)"),
    ("x_7f99c46ffb", "重复:布雷顿森林体系(既有Event)"),
]

# ============ 形式科学 dom_form (90: promote 85 / reject 5) ============
FORM_PROMOTE = [
    ("c_crt", 1247, "Chinese remainder theorem", None, None),
    ("x_83d4d9f371", None, "central limit theorem", None, None),
    ("x_42ab41b1b2", None, "second-order logic", None, None),
    ("x_81111ed995", -350, "Aristotelian syllogism", None, None),
    ("x_6ff08d564b", None, "commutative algebra", None, None),
    ("f_algebra", -1800, "algebra and number theory", None, None),
    ("x_e3a06a083a", None, "algebraic geometry", None, None),
    ("x_cf33f4790b", None, "algebraic number theory", None, None),
    ("x_ae7a4388e6", None, "hypothesis testing", None, None),
    ("w_6bd7f30551", 1822, "Fourier transform", None, None),
    ("x_dfa559704b", None, "meta-analysis", None, None),
    ("x_67c12b298a", 1908, "axiomatic set theory", None, None),
    ("f_geometry", -300, "geometry", None, None),
    ("x_b55bd94a77", None, "geometry of convex optimization", None, None),
    ("x_23939d649f", 1910, "Hua Loo-keng", "Person", None),            # 华罗庚 Topic→Person
    ("x_e8e42801be", None, "homotopy theory", None, None),
    ("x_e415e7d208", None, "homological algebra", None, None),
    ("x_7036c8a41a", 1900, "homology theory", None, None),
    ("t_godel", 1931, "Gödel's incompleteness theorems", None, None),
    ("x_c93a5b1667", 1930, "Gödel's completeness theorem", None, None),
    ("x_0ae0a32564", 1885, "regression analysis", None, None),
    ("x_b3d9de759c", None, "field theory (algebra)", None, None),
    ("x_55251c7dac", None, "polynomials and equation solving", None, None),
    ("x_c3b6124322", 1713, "law of large numbers", None, None),
    ("x_8971928b30", None, "projective geometry", None, None),
    ("x_2128ce92dc", 1862, "David Hilbert", None, None),
    ("x_e98160c041", 1900, "Poincaré conjecture", None, None),
    ("x_50d5f36b47", 1879, "Frege's predicate logic", None, None),
    ("x_37aeb207a0", 1854, "differential geometry", None, None),
    ("x_1184254b17", 1887, "Srinivasa Ramanujan", None, None),
    ("f_topology", 1895, "topology", None, None),
    ("t_topology", 1895, "topology (Poincaré and homology)", None, None),
    ("x_9a7db28b26", None, "persistent homology", None, None),
    ("x_3cfd7c8d51", None, "proof assistants (Lean/Coq)", None, None),
    ("f_foundations", 1874, "mathematical logic and foundations", None, None),
    ("f_numbertheory", -300, "number theory", None, None),
    ("x_808debd6d6", 1967, "Langlands program", None, None),
    ("x_f53d0e98d5", None, "Lie groups and Lie algebras", None, None),
    ("x_f93c92775f", None, "conditional probability and Bayes' theorem", None, None),
    ("x_967aee09cb", 1912, "maximum likelihood estimation", None, None),
    ("x_3591ec49ec", None, "constructivist mathematics", None, None),
    ("x_f6950b0564", None, "elliptic curves", None, None),
    ("x_05b7a50c40", None, "model theory", None, None),
    ("x_7303402903", None, "modal logic", None, None),
    ("x_6bfc9e3b6b", -300, "Euclid's proof of infinitude of primes", None, None),
    ("x_f4c4b83a58", 1707, "Leonhard Euler", None, None),
    ("x_5fe56d5b11", None, "Euclidean geometry", None, None),
    ("x_41f3ee6542", None, "classification of surfaces", None, None),
    ("x_75e7eec73c", None, "rings and ideals", None, None),
    ("x_0c45f929b6", None, "survival analysis", None, None),
    ("x_94f91a210b", None, "intuitionistic logic", None, None),
    ("x_e84d8f9410", None, "discrete and combinatorial geometry", None, None),
    ("x_a102427649", None, "type theory", None, None),
    ("x_1d34b3eac9", 1896, "prime number theorem", None, None),
    ("x_5b854fde55", None, "knot theory", None, None),
    ("x_4d08a6448d", 1693, "linear algebra", None, None),
    ("x_483ffd0f3f", 1901, "Russell's paradox", None, None),
    ("c_groups", 1832, "group theory", None, None),
    ("x_996c4771b4", 1945, "category theory", None, None),
    ("x_180581fd8b", None, "Monte Carlo integration", None, None),
    ("x_6ec5705d96", None, "representation theory", None, None),
    ("x_98e7c79aad", 1637, "analytic geometry", None, None),
    ("x_acedac1fcc", 1837, "analytic number theory", None, None),
    ("x_9011f9af41", None, "proof theory", None, None),
    ("x_c650000ad1", 1882, "Emmy Noether", None, None),
    ("x_795f8d3ed5", None, "Bayesian optimal experiment design", None, None),
    ("x_b0cf535006", None, "Bayesian deep learning", None, None),
    ("x_85b35fa98c", None, "Bayesian networks", None, None),
    ("c_fermat", 1637, "Fermat's Last Theorem", None, None),
    ("x_011ce46080", 1878, "continuum hypothesis", None, None),
    ("x_ed5d85f79b", 1904, "axiom of choice", None, None),
    ("x_7ac6c9dbfa", 1930, "recursion theory", None, None),
    ("w_4063f9556f", 1911, "Shiing-Shen Chern", "Person", None),       # 陈省身 (born 2010→1911)
    ("x_31bce43426", 1959, "random graph theory", None, None),
    ("x_31b3d64fdd", 1880, "stochastic processes", None, None),
    ("c_sets", 1874, "set theory", None, None),
    ("x_aba4f72f9f", None, "non-monotonic reasoning", None, None),
    ("c_nonEuclid", 1829, "non-Euclidean geometry", None, None),
    ("x_6941c1b71c", None, "non-classical logics", None, None),
    ("x_7dc268de66", None, "martingales and stopping times", None, None),
    ("x_006c9daac2", 1906, "Markov chains", None, None),
    ("x_45b185f0ae", 1777, "Carl Friedrich Gauss", None, None),
    ("x_c10c6b3c93", 1826, "Bernhard Riemann", None, None),
    ("x_98b924bd67", 1854, "Riemannian manifolds", None, None),
]
FORM_REJECT = [
    ("w_e5bd3a90ee", "年份条目"), ("w_9fc7ee8be8", "机构"),
    ("w_00a4e94cd6", "机构"), ("w_d0fb55e157", "泛概念(理科)"),
    ("w_cf55fa5b12", "泛概念(理论)"),
    ("w_098da08f9b", "重复:数据科学(cs域 f_data 已复核)"),
]

BATCHES = [
    ("dom_bio", BIO_PROMOTE, BIO_REJECT),
    ("dom_soc", SOC_PROMOTE, SOC_REJECT),
    ("dom_econ", ECON_PROMOTE, ECON_REJECT),
    ("dom_form", FORM_PROMOTE, FORM_REJECT),
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

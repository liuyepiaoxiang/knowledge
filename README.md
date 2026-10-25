# 知识大地 Terra Cognita · 人类知识与技术底图

一张会生长的知识地图：看清知识如何长成技术，技术如何反哺知识。

**当前版次：v0.8（已交付）** —— **1888 节点 / 8125 边 / 16 个学科域 / 13 条故事导览**（纹理层证据化大清理后：图上全部为有边可解释的实体，3600 个孤立纹理节点保留在本地 dump 可随时重提取），**前沿引擎 v2 + 完备度指标 + 策展工作台 + 判读证据句**，git 受控。**全部 6 个维基分片（1.6GB，CC BY-SA）已下载并本地提取完毕**：`wiki_extract.py` 用 Aho-Corasick 扫描约 140 万篇文章（只扫到一半的匹配名称），累计提取 3600 个概念节点 + 5000 条真实文本共现边，全部 C 级标注 CC BY-SA 溯源，`curate.py` 可逐条复核或剔除。

- **设计蓝图**：[知识技术底图-十倍扩展设计.md](知识技术底图-十倍扩展设计.md)

## 打开方式

**方式一（最简单）**：直接双击 `index.html`——无构建、无外部依赖、离线可用。

**方式二（本地服务器，开放 API / SQLite 可用）**：

```bash
cd D:\03-write\projects\knowledge
python -m http.server 8123
# 浏览器打开 http://127.0.0.1:8123/
```

## 16 个学科域

形式科学 · 物理学 · 化学 · 地球与气候科学 · **工程与技术** · 计算机科学与技术 · 生物技术 · 医学与健康 · 农业与食品 · 社会科学 · 人文学科 · 艺术与设计 · 法律与治理 · 经济与商业 · 教育与传播 · 实践技艺与生活

- **深度层**：物理学、计算机、生物技术三域打穿到概念/公式/证据链粒度
- **骨架层**：其余 13 域各有真实子领域结构 + 标志性节点（火的使用、文字、轴心时代、科举、汉谟拉比法典、工业革命、哈伯固氮、板块构造、都江堰、集成电路……）
- **跨域奠基链**（SQLite 实测可查）：`火的使用→冶铜→冶铁→工业革命→蒸汽机→热力学→统计力学→蒙特卡洛→蛋白质折叠→AlphaFold→Transformer→ChatGPT`（12 跳横跨 40 万年）；最长的单条时间边"轮子(前3500)→铁路(1825)"
- **多文明**：中国、印度、阿拉伯、希腊化、两河、罗马、波利尼西亚、日本各有传统标注

## 数据管线（v0.3 架构）

```
js/data.js(种子策展层,B级) ──node build-api.js──> api/*.json ──python build_db.py──┐
                                                                                    ▼
bulk/*.tsv(批量骨架层,C级) ──────python ingest.py──────────────────────────────> atlas.db (SQLite, 规范存储)
corpus/batch*.tsv(LLM抽取,C级) ───python extract.py──────────────────────────────↗
corpus/dump/zh-*.parquet(维基CC BY-SA) ──python wiki_extract.py(Aho-Corasick扫23万篇)──↗
                                                                                    │
js/data_full.js(前端全量层) <──python export.py────────────────────────────────────┘
        ↓ 网站优先加载
```

- **三层信任模型**：种子层 B（人工校订）→ 批量层 C（`bulk/*.tsv`，conf 0.7）→ 抽取层 C（`corpus/*.tsv` LLM 语料经 `extract.py` 规范化：按名去重、年份提取、共现自动连边，conf 0.6）
- **策展队列**：`python curate.py stats|pending|promote|promote-domain|reject` —— 把 C 逐条/批量复核为 B（已演示复核 52 条），复核后 `export.py` 同步全站
- **策展工作台（v0.7 新增）**：`python serve.py` 启动本地服务后，访问 `#/curate` —— 网页界面批量复核节点（通过/剔除）、依据**维基原文证据句**判读共现边（奠基/使能/应用/解释/启发/保留/删除），写回 SQLite 后一键重新导出。概念卡的"关联"边下方会直接显示原文共现引文
- **构建一体化（v0.7 新增）**：`python make_all.py` 一条命令编排全部管线（含每步断言与终检），`--fresh` 全重建
- **共现边语义升级（v0.6 新增）**：`corpus/pending_semantic.tsv`（待判读对导出）→ 人工/LLM 判读 `corpus/semantic.tsv`（升级为带方向类型边 或 判噪声删除）→ `python semantic.py` 应用 → `export.py` 同步。首轮：560 对判读，88 条升级（半导体→使能集成电路/微处理器/智能手机/激光器…），295 条同域垃圾边清理
- **维基开放数据本地管线（v0.5 新增）**：`wiki_extract.py` —— 下载→本地解析→三类提取（既有节点年份补全 / 文本共现边按计数取优 / 高关联新概念），全部 C 级标注溯源"维基语料本地提取 (CC BY-SA)"；可用 `curate.py reject` 剔除质量差的列表页混入项
- **扩数据只需**：往 `corpus/` 加批次或再下载一个 parquet 分片 → `python wiki_extract.py corpus/dump/zh-part4.parquet` → `python export.py`
- SQLite schema：`nodes/edges/evidence/story_steps/domains/meta` + 域/类型/年代/边端点索引；`ingest.py` 幂等可重跑、建库时自动完整性校验
- **改数据后的重跑顺序**：`node validate.js` → `node build-api.js` → `python build_db.py` → `python ingest.py` → `python export.py`

### SQLite 查询 CLI

```bash
python db.py stats                      # 版次/域分布/类型分布
python db.py node 熵                    # 概念卡: 定义/证据/邻居
python db.py path 火的使用 ChatGPT      # 跨域最短奠基路径(实测12跳)
python db.py domain 医学与健康          # 域概况: 子领域+里程碑
python db.py search 印刷                # 模糊检索
python db.py query "SELECT ..."        # 只读 SQL
```

## 六大视图

| 视图 | 回答的问题 | 亮点 |
|---|---|---|
| **星图** `#/atlas` | 全景长什么样？ | 16 域成簇+大陆光斑+域名常显；提取层(主题)作为背景纹理降权绘制；边按缩放分级 LOD；脏标记渲染(空闲零 CPU) |
| **河流** `#/flow` | 知识怎么长成技术？ | 五级成熟度管道桑基图 |
| **前沿** `#/frontier` | 哪里在生长/卡住/漏接？ | v2：四张榜单（活跃/瓶颈传导影响面/类型化待连接/生长大陆）+ 星图热力层 |
| **时间轴** `#/timeline` | 每个时代发生了什么？ | 画布密度视图：淡蓝直方图=各域节点分布（可承载任意规模），彩色点=已策展节点（贪心防重叠标签），点击密度块展开该时段完整清单，点彩点直接开概念卡 |
| **图志** `#/about` | 方法论是什么？ | 八条生长机制、成熟度管道、证据分级制度 |
| **开放 API** `#/api` | AI Agent 怎么用？ | 静态 JSON 端点(graph.json 一次拉取) + SQLite 查询层 |

**全局能力**：非线性年代尺（前8000→2026）、`▷ 重放生长`、搜索、概念卡（含 A/B/C 证据分级与置信度）、化石节点、三条故事导览、深链接 `#/node/<id>` 与 `#/domain/<id>`。

## 已验证（浏览器 + 数据库实测）

- 497 节点全量加载（data_full.js 优先层）与 16 域渲染
- 批量层概念卡诚实标注（都江堰：C 级证据·置信度 70%·归属正确）
- 跨域路径 `火的使用→…→ChatGPT` 12 跳、`晶体管→mRNA疫苗` 9 跳
- 前沿三榜单/热力层/时间轴远古层/故事导览回归通过
- `validate.js`（种子层）+ `build_db.py`/`ingest.py` 完整性检查全部通过

## 覆盖度现状（诚实标尺）

| 层级 | 现状 | 下一版次 |
|---|---|---|
| 宏观域 | 16/16 ✓ | — |
| 子领域 | 77 Field | LLM 管线补齐各部门法/工程分支/艺术门类 |
| 概念 | 5174（LLM抽取+批量+维基三层） | 更多语料批次 / en-wiki / 语义判读迭代 |
| 证据层 | 540 条标注 | 接 OpenAlex/专利引证 |
| 隐性知识 | 本征受限，仅作标注 | 永远是地图的边界 |

## 路线图（见设计文档 §11）

- Phase 1 续：LLM 提取管线直接入 SQLite；策展队列（把 C 复核成 B）；从 DB 导出图瓦片
- Phase 2：待连接层叠加星图；预测登记簿；骨架域逐个打穿
- Phase 3：社区策展；多语种；AI Agent 消费端

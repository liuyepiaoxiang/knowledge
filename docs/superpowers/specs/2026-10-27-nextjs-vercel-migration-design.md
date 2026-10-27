# 知识大地 · Next.js / Vercel 迁移与工程化设计

日期：2026-10-27
状态：已批准

## 背景与目标

现状：纯静态站（`index.html` + `js/app.js` 76K canvas 力导向图 + `css/style.css`），数据由本地 Python 管线产出（`atlas.db` → `export.py` → `js/data_full.js` / `js/data_ext.json`），策展工作台 `#/curate` 依赖本地 `serve.py` 的 `/api2/*` 接口写 SQLite。

目标：

1. 前端迁移到 Next.js（App Router + TypeScript），部署到 Vercel
2. 仓库工程化：模块化拆分、类型化、脚本归位
3. Python 管线保持本地运行不变，输出对接新前端
4. 部署范围：仅公开站点（图谱浏览器）；策展工作台留在本地

## 决策记录

| 决策点 | 选择 | 理由 |
|---|---|---|
| 部署范围 | 仅公开站点 | 策展依赖本地 SQLite/serve.py，上云成本高、无必要 |
| 仓库结构 | Next.js 在根 | 单仓库，Vercel 直接识别根目录 |
| 改造深度 | 模块化 + TypeScript，逻辑不改写 | 工程化达成、风险可控 |
| 数据交付 | `public/data/` 只放页面所需（core 2.1M + ext 15M + meta） | 26M+ 的 api/*.json 不部署 |
| 渲染模式 | `output: 'export'` 纯静态 | 无服务器函数需求，CDN 直出，可移植 |
| 路由 | 保留 hash 路由（#/atlas、#/node/xx、#/curate） | 单页图应用，不引入 next/router |
| window.GRAPH_CORE | 废弃，改 fetch `/data/core.json` | 去全局变量；data.js 种子 fallback 为死代码一并移除 |
| api/*.json（~50M） | 从 git 移除，.gitignore 忽略 | 可由 atlas.db 重新生成，仓库瘦身 |

## 目标结构

```
knowledge/
├─ app/
│  ├─ layout.tsx        # <head> 元数据/favicon/theme-color（迁移自 index.html）
│  ├─ page.tsx          # 挂载图谱应用
│  └─ globals.css       # 现 css/style.css 整体迁入
├─ components/
│  ├─ AtlasMap.tsx      # "use client" 画布主组件（指针/滚轮交互）
│  ├─ ConceptPanel.tsx  # 概念详情面板
│  ├─ CuratePanel.tsx   # #/curate 策展面板（仅本地）
│  ├─ TimeSlider.tsx
│  ├─ SearchBox.tsx
│  └─ Legend.tsx
├─ lib/
│  ├─ types.ts          # Node/Edge/Domain/Story 类型
│  ├─ graph.ts          # byId 索引、mergeExt、neighborsOf、yearOK 等纯逻辑
│  ├─ loader.ts         # fetch core/ext/meta
│  ├─ render.ts         # canvas 绘制（draw/tick、边合批）
│  └─ sim.ts            # Worker 协议（createSimWorker/send*）
├─ public/
│  ├─ sim-worker.js     # 现 sim_worker.js 原样，路径改 "/sim-worker.js"
│  └─ data/
│     ├─ core.json      # 现 js/data_full.js → 纯 JSON
│     ├─ ext.json       # 现 js/data_ext.json（懒加载）
│     └─ meta.json      # 版本信息
├─ scripts/             # 全部 Python 管线 + serve.py + validate.mjs
├─ data/                # bulk/ + corpus/
├─ atlas.db
├─ next.config.mjs      # output: 'export'
├─ package.json / tsconfig.json / eslint 配置
└─ docs/
```

迁移完成后删除根目录 `index.html`、`js/`、`css/`、`api/`、根级散置的 `*.py` / `validate.js` / `sim_worker.js`。

## 前端迁移要点

- **模块拆分**：按 app.js 现有函数边界拆到 `lib/`（纯逻辑）与 `components/`（DOM/交互），逻辑不改写，只做 TS 类型标注与模块化搬运
- **数据加载**：启动时 `fetch('/data/core.json')`；`data_ext.json` → `/data/ext.json` 保持懒加载；`api/meta.json` → `/data/meta.json`
- **Worker**：`new Worker("/sim-worker.js")`，文件放 `public/` 原样保留
- **策展面板**：`/api2/*` 请求失败时显示「策展工作台仅本地模式可用（python scripts/serve.py）」提示；本地 `serve.py` 下功能不变
- **样式**：`css/style.css` → `app/globals.css` 单文件保留，不做 CSS Modules 化

## 数据管线调整

- 全部 `*.py` 移入 `scripts/`（`import db` 天然可用）
- 脚本内路径改为以脚本位置推导仓库根：`ROOT = Path(__file__).resolve().parents[1]`；`atlas.db`、`data/`、`public/data/` 均基于 ROOT，不再依赖运行时 cwd
- `export.py` 输出改为 `public/data/{core.json, ext.json, meta.json}`；不再产出 `js/data_full.js` 与 `api/*.json`
- `make_all.py` 同步更新路径；`validate.js` → `scripts/validate.mjs`，接入 `npm run validate`
- `.gitignore` 增加：`api/`、`.next/`、`node_modules/`；`git rm --cached api/*.json`

## 工程化配置

- `package.json` scripts：`dev` / `build` / `start`(静态预览) / `lint` / `validate` / `export:data`（调 `python scripts/export.py`）
- TypeScript strict，路径别名 `@/*`
- Vercel：Framework 自动识别 Next.js，Root Directory = 仓库根，无环境变量、无额外配置

## 错误处理

- 数据加载失败（core/ext fetch 失败）：页面显示明确错误状态与重试按钮
- Worker 创建失败：回退主线程模拟（沿用现有 fallback 行为）
- `/api2/*` 线上失败：策展面板显示本地模式提示（见上）

## 验收标准

1. `npm run dev` 与现站行为一致：图谱渲染、缩放拖拽、节点面板、时间轴、story、搜索、`#/curate` 本地可用
2. `npm run build` 成功产出静态站，本地预览 `out/` 验证通过
3. `python scripts/make_all.py` 全管线跑通，产物落在 `public/data/`
4. Vercel 部署成功，首屏与 ext 懒加载正常
5. `npm run validate` 通过数据校验

## 不做的事（YAGNI）

- 不上云数据库 / 在线策展
- 不重写渲染层（react-flow/d3）
- 不做 CSS Modules/Tailwind 迁移
- api/*.json 开放下载另议（GitHub Release / 对象存储），不在本次范围

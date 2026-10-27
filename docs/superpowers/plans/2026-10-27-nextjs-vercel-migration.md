# 知识大地 · Next.js / Vercel 迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将纯静态站（index.html + js/app.js）迁移到 Next.js (App Router + TypeScript + `output: 'export'`)，Python 管线归位 `scripts/` 并对接 `public/data/`，最终部署 Vercel。

**Architecture:** 前端代码从 `js/app.js`（1654 行）按函数边界机械拆分到 `lib/`（数据/模拟/渲染）与 `components/`（视图/交互），逻辑不改写；数据从 `window.*` 全局改为 `public/data/` 下 JSON 按需 fetch；Python 管线整体移入 `scripts/`，`export.py` 输出改为 `public/data/{core.json, ext.json, meta.json, manifest.js}`。

**Tech Stack:** Next.js 15（App Router, 静态导出）、React 19、TypeScript strict、Vitest（纯函数单测）、Python 3（管线不变）。

**规格文档:** `docs/superpowers/specs/2026-10-27-nextjs-vercel-migration-design.md`

---

## 全局约定（每个任务都要遵守）

- **机械搬运原则**：从 `js/app.js` 搬运代码时逐字保留函数体，只做三类修改：(a) 加 `export`；(b) 跨模块引用改为 `import`；(c) 补 TS 类型（参数/返回值能用推断就不手写，禁止改逻辑）。每个搬运任务的验收是「dev 页面行为与旧站一致」。
- **源码行号基于当前 `js/app.js`（1654 行版本）**，搬运前先 `grep -n "^function <名>" js/app.js` 校准行号。
- 每个 Task 结束必须 commit。
- Windows + bash 环境：命令用 Unix 语法，路径用正斜杠。
- Node 版本 ≥ 20。

## 目标文件结构（最终态）

```
app/layout.tsx            # <head> 元数据（Task 1）
app/page.tsx              # DOM 骨架（Task 6）
app/globals.css           # css/style.css 迁入（Task 2）
lib/types.ts              # Task 3
lib/loader.ts             # Task 3
lib/state.ts              # 图数据单例 + initGraph（Task 4）
lib/graph.ts              # 纯函数（Task 4）
lib/sim.ts                # Worker + 主线程模拟（Task 5）
lib/render.ts             # draw/tick（Task 5）
lib/router.ts             # hash 路由（Task 6）
components/AtlasMap.tsx   # 画布 + 交互 + boot（Task 7）
components/ConceptPanel.tsx  # Task 8
components/TimeBar.tsx       # Task 8
components/Legend.tsx        # Task 8
components/SearchBox.tsx     # Task 8
components/Stories.tsx       # Task 8
components/TimelineView.tsx  # Task 9
components/FlowView.tsx      # Task 10
components/FrontierView.tsx  # Task 10
components/ApiView.tsx       # Task 11
components/MetricsBox.tsx    # Task 11
components/CurateView.tsx    # Task 12
public/sim-worker.js      # Task 2
public/data/core.json     # Task 2 生成 / Task 13 由 export.py 再生
public/data/ext.json      # 同上
public/data/meta.json     # 同上
public/data/manifest.js   # 同上
scripts/*.py              # Task 13
scripts/validate.mjs      # Task 13
```

---

### Task 1: Next.js 脚手架

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`（占位）, `next-env.d.ts`（build 自动生成，不手写）

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "terra-cognita",
  "private": true,
  "version": "0.9.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "preview": "npx serve out",
    "export:data": "python scripts/export.py",
    "validate": "node scripts/validate.mjs"
  },
  "dependencies": {
    "next": "^15.5.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 写 next.config.mjs**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
};
export default nextConfig;
```

- [ ] **Step 3: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scripts", "js", "out"]
}
```

- [ ] **Step 4: 写 app/layout.tsx**（元数据逐字取自 `index.html:5-10`）

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "知识大地 Terra Cognita · 人类知识与技术底图",
  description: "一张会生长的人类知识与技术底图——看清知识如何长成技术，技术如何反哺知识。",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='13' fill='%230d1420' stroke='%23d9b36c' stroke-width='2'/%3E%3Ccircle cx='11' cy='13' r='3' fill='%2389ddff'/%3E%3Ccircle cx='20' cy='11' r='2.4' fill='%235fd68a'/%3E%3Ccircle cx='19' cy='21' r='3.4' fill='%23ffd166'/%3E%3Ccircle cx='11.5' cy='20' r='2' fill='%23ff5370'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1420",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body data-view="map">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: 写占位 app/page.tsx 与空 app/globals.css**

```tsx
export default function Home() {
  return <main style={{ color: "#d9b36c", padding: 40 }}>scaffold ok</main>;
}
```

`app/globals.css` 暂写一行 `/* placeholder */`（Task 2 替换）。

- [ ] **Step 6: 更新 .gitignore**（保留现有内容，追加）

```
node_modules/
.next/
out/
```

- [ ] **Step 7: 安装并验证构建**

Run: `npm install && npm run build`
Expected: 构建成功，生成 `out/index.html`；无 TS 报错。

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json next.config.mjs tsconfig.json app/ .gitignore
git commit -m "chore: Next.js 脚手架(App Router + 静态导出 + TS strict)"
```

---

### Task 2: 静态资源与数据迁移

**Files:**
- Modify: `app/globals.css`（替换为 `css/style.css` 全文）
- Create: `public/sim-worker.js`（来自 `sim_worker.js`，修 1 处 bug）
- Create: `public/data/core.json`、`public/data/ext.json`、`public/data/meta.json`、`public/data/manifest.js`

- [ ] **Step 1: 样式迁入**

```bash
cp css/style.css app/globals.css
```

检查 `app/globals.css` 内无 `url(...)` 外部引用（原文件纯 CSS 变量+规则，应无）。

- [ ] **Step 2: Worker 迁入并修 bug**

```bash
cp sim_worker.js public/sim-worker.js
```

`public/sim-worker.js:103` 存在未定义变量 `edgeCount`（声明的是 `eCount`，见 :10 与 :33），弹簧力实际从未执行。修复：

```js
// 修改前
for (let e = 0; e < edgeCount; e++) {
// 修改后
for (let e = 0; e < eCount; e++) {
```

- [ ] **Step 3: 数据转换**（`js/data_full.js` 是 `/* 注释 */\nwindow.GRAPH_CORE = {...};` 包装的 JSON）

```bash
mkdir -p public/data
node -e "
const fs = require('fs');
const s = fs.readFileSync('js/data_full.js', 'utf8');
const json = s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1);
const core = JSON.parse(json);
fs.writeFileSync('public/data/core.json', JSON.stringify(core));
console.log('core.json:', core.nodes.length, 'nodes', core.edges.length, 'edges');
"
cp js/data_ext.json public/data/ext.json
cp api/meta.json public/data/meta.json
cp api/manifest.js public/data/manifest.js
```

Expected: 输出 `core.json: <N> nodes <M> edges`（N≈5000 非 cn_ 节点，M 为核心边数）。

- [ ] **Step 4: 验证数据完整性**

```bash
node -e "
const fs=require('fs');
const core=JSON.parse(fs.readFileSync('public/data/core.json','utf8'));
const ext=JSON.parse(fs.readFileSync('public/data/ext.json','utf8'));
if(!core.domains||!core.nodes||!core.edges||!core.stories) throw new Error('core 字段缺失');
if(!ext.nodes||!ext.edges) throw new Error('ext 字段缺失');
console.log('OK core',core.nodes.length,'ext',ext.nodes.length);
"
```

- [ ] **Step 5: 重新构建验证**

Run: `npm run build`
Expected: 成功；`out/data/core.json` 等 4 个文件被复制进产物。

- [ ] **Step 6: Commit**

```bash
git add app/globals.css public/
git commit -m "feat: 样式/Worker/数据迁入 public (含 sim-worker eCount bug 修复)"
```

---

### Task 3: 类型与数据加载器（TDD）

**Files:**
- Create: `lib/types.ts`, `lib/loader.ts`
- Test: `lib/loader.test.ts`

- [ ] **Step 1: 写 lib/types.ts**（字段以 `export.py` 输出为准；`st` 与 `status` 并存是历史事实——种子层用 `st`、导出层用 `status`，两者都设可选）

```ts
/** 节点。字段命名与 scripts/export.py 输出一致；st(种子层)/status(导出层) 同义 */
export interface GraphNode {
  id: string;
  t: string;            // Domain|Field|Theory|Tech|Material|Event|Question|Topic|Person|...
  zh: string;
  en?: string | null;
  dom: string;
  born?: number | null;
  died?: number | null;
  one?: string | null;
  why?: string | null;
  ex?: string | null;
  ev?: (string | number)[];
  conf?: number;
  st?: string | null;
  status?: string | null;
  tr?: string | null;
  /** 运行时字段（initGraph/mergeExt 填充） */
  idx?: number;
  deg?: number;
  out?: GraphEdge[];
  in?: GraphEdge[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  w: number;
  since: number | null;
  grade: string;
  ctx: string | null;
}

/** 导出层边为元组: [from, to, type, w, since, (ctx)?] */
export type EdgeTuple = (string | number | null)[];

export interface Domain {
  id: string;
  zh: string;
  en?: string;
}

export interface StoryStep {
  id: string;
  text: string;
}

export interface Story {
  id: string;
  zh: string;
  desc?: string;
  steps: StoryStep[];
}

/** public/data/core.json */
export interface GraphCore {
  domains: Domain[];
  nodes: GraphNode[];
  edges: EdgeTuple[];
  stories: Story[];
}

/** public/data/ext.json（ConceptNet 扩展层） */
export interface ExtData {
  nodes: GraphNode[];
  edges: EdgeTuple[];
}

/** public/data/meta.json */
export interface Meta {
  name: string;
  edition: string;
  generated: string;
  counts: { nodes: number; edges: number; domains: number };
  layers: { B: number; C: number };
  license: string;
  domains: Domain[];
}

export function toEdge(e: EdgeTuple): GraphEdge {
  return {
    from: String(e[0]),
    to: String(e[1]),
    type: String(e[2]),
    w: e[3] == null ? 0.5 : Number(e[3]),
    since: e[4] == null ? null : Number(e[4]),
    grade: e[2] === "marks" ? "A" : "B",
    ctx: e.length > 5 ? String(e[5]) : null,
  };
}
```

- [ ] **Step 2: 写失败测试 lib/loader.test.ts**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadCore, loadExt, loadMeta } from "./loader";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("loadCore", () => {
  it("解析 core.json", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ domains: [], nodes: [{ id: "a", t: "Tech", zh: "A", dom: "d" }], edges: [], stories: [] }),
    }));
    const core = await loadCore();
    expect(core.nodes).toHaveLength(1);
    expect(core.nodes[0].zh).toBe("A");
  });

  it("404 时抛出含 URL 的错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadCore()).rejects.toThrow("/data/core.json");
  });
});

describe("loadExt", () => {
  it("解析 ext.json", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ nodes: [], edges: [["a", "b", "relates_to", 0.5, null]] }),
    }));
    const ext = await loadExt();
    expect(ext.edges[0][2]).toBe("relates_to");
  });

  it("失败时抛错（调用方决定静默）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(loadExt()).rejects.toThrow();
  });
});

describe("loadMeta", () => {
  it("解析 meta.json", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "x", edition: "v0.9", generated: "2026-10-27", counts: { nodes: 1, edges: 2, domains: 3 }, layers: { B: 1, C: 2 }, license: "", domains: [] }),
    }));
    const m = await loadMeta();
    expect(m.counts.nodes).toBe(1);
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run lib/loader.test.ts`
Expected: FAIL（`lib/loader.ts` 不存在）。

- [ ] **Step 4: 写 lib/loader.ts**

```ts
import type { ExtData, GraphCore, Meta } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`加载失败 ${url} (HTTP ${r.status})`);
  return r.json() as Promise<T>;
}

export function loadCore(): Promise<GraphCore> {
  return fetchJson<GraphCore>("/data/core.json");
}

export function loadExt(): Promise<ExtData> {
  return fetchJson<ExtData>("/data/ext.json");
}

export function loadMeta(): Promise<Meta> {
  return fetchJson<Meta>("/data/meta.json");
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run lib/loader.test.ts`
Expected: PASS（6 个用例）。

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/loader.ts lib/loader.test.ts
git commit -m "feat: 图数据类型定义与 JSON 加载器(TDD)"
```

---

### Task 4: 图状态与纯函数模块（TDD）

**Files:**
- Create: `lib/state.ts`, `lib/graph.ts`
- Test: `lib/graph.test.ts`

说明：旧代码 `js/app.js:8-12,49-134` 在脚本加载时同步初始化全局（`NODES_`、`byId`、`E`、锚点、初始位置）。迁移后数据是异步 fetch 的，因此把这段逻辑收进 `initGraph(core)`，其余代码引用的模块级单例（`S`/`P`/`byId`/`E` 等）都从这里导出。

- [ ] **Step 1: 写失败测试 lib/graph.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { yearOK, isFossil, hashStr, sliderToYear, yearToSlider } from "./graph";
import { ANCIENT, YEAR_MIN, YEAR_MAX } from "./state";

describe("yearOK", () => {
  const node = (born: number | null) => ({ born }) as any;
  it("born 为空恒可见", () => expect(yearOK(node(null))).toBe(true));
  it("born <= 当前年可见", () => {
    expect(yearOK(node(1900), 1950)).toBe(true);
    expect(yearOK(node(1950), 1900)).toBe(false);
  });
  it("远古节点(早于年代尺)永久可见", () => {
    expect(ANCIENT).toBeLessThan(YEAR_MIN);
    expect(yearOK(node(-8500), YEAR_MIN)).toBe(true);
  });
  it("默认年参取 state.S.year", () => {
    expect(yearOK(node(3000))).toBe(false); // S.year 初始 = YEAR_MAX
  });
});

describe("isFossil", () => {
  it("died <= 当前年为化石", () => {
    expect(isFossil({ died: 1887 } as any, 1900)).toBe(true);
    expect(isFossil({ died: 1887 } as any, 1800)).toBe(false);
    expect(isFossil({ died: null } as any, 9999)).toBe(false);
  });
});

describe("hashStr", () => {
  it("确定性且非负", () => {
    expect(hashStr("半导体")).toBe(hashStr("半导体"));
    expect(hashStr("半导体")).not.toBe(hashStr("集成电路"));
    expect(hashStr("x")).toBeGreaterThanOrEqual(0);
  });
});

describe("sliderToYear / yearToSlider 互逆", () => {
  it("往返一致(锚点处)", () => {
    for (const s of [0, 250, 500, 750, 1000]) {
      const y = sliderToYear(s);
      const back = yearToSlider(y);
      if (s === 0 || s === 1000) expect(back).toBe(s);
      else expect(Math.abs(back - s)).toBeLessThan(3);
    }
  });
  it("端点映射到 YEAR_MIN/YEAR_MAX", () => {
    expect(sliderToYear(0)).toBe(YEAR_MIN);
    expect(sliderToYear(1000)).toBe(YEAR_MAX);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run lib/graph.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 lib/state.ts**（搬运 `js/app.js:14-134`，改造点见注释）

```ts
import type { Domain, GraphCore, GraphEdge, GraphNode, Story } from "./types";
import { toEdge } from "./types";

export const YEAR_MIN = -8000, YEAR_MAX = 2026;
/** 远古层: 早于年代尺起点的节点永久可见(火/制陶/农业) */
export const ANCIENT = -9000;
export const REDUCED =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 全局视图状态 (js/app.js:68-77 原样) */
export const S = {
  view: "map",
  year: YEAR_MAX,
  playing: false, playT0: 0, playDur: 0,
  sel: null as string | null, hov: null as string | null,
  k: 0.13, tx: 0, ty: 0,
  typeOff: new Set<string>(), domOff: new Set<string>(),
  story: null as number | null, storyTimer: null as ReturnType<typeof setTimeout> | null,
  cam: null as { x1: number, y1: number, k1: number, x2: number, y2: number, k2: number, t0: number, dur: number } | null,
};

/** 力导向位置池 (js/app.js:93) */
export const P = { x: [] as number[], y: [] as number[], vx: [] as number[], vy: [] as number[], fixed: [] as boolean[] };
export const DOM_ANCHOR: Record<string, { x: number; y: number }> = {};

export let NODES_: GraphNode[] = [];
export let STORIES_: Story[] = [];
export let byId: Record<string, GraphNode> = {};
export let E: GraphEdge[] = [];
export const CN_TOPIC_EDGES: GraphEdge[] = [];
export let CN_ALL_EDGES: GraphEdge[] = [];
export let DOMAIN_IDS: string[] = [];
export let DOMAINS_: Domain[] = [];

function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 初始化图数据。搬运自 js/app.js:9-12,49-134，把顶层执行改为函数体 */
export function initGraph(core: GraphCore): void {
  NODES_ = core.nodes;
  STORIES_ = core.stories;
  DOMAINS_ = core.domains;
  byId = {};
  NODES_.forEach((n, i) => { n.idx = i; byId[n.id] = n; n.deg = 0; n.out = []; n.in = []; });
  E = core.edges.map((tuple) => {
    const edge = toEdge(tuple);
    byId[edge.from].out!.push(edge);
    byId[edge.to].in!.push(edge);
    byId[edge.from].deg!++;
    byId[edge.to].deg!++;
    return edge;
  });
  DOMAIN_IDS = DOMAINS_.map((d) => d.id);
  CN_ALL_EDGES = E.concat(CN_TOPIC_EDGES);

  /* layoutAnchors (js/app.js:95-103 原样) */
  {
    const n = DOMAIN_IDS.length, inner = Math.ceil(n / 2);
    DOMAIN_IDS.forEach((id, i) => {
      if (i < inner) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / inner);
        DOM_ANCHOR[id] = { x: Math.cos(a) * 1150, y: Math.sin(a) * 1150 };
      } else {
        const a = -Math.PI / 4 + (i - inner) * (Math.PI * 2 / (n - inner));
        DOM_ANCHOR[id] = { x: Math.cos(a) * 1780, y: Math.sin(a) * 1780 };
      }
    });
  }
  /* initPositions (js/app.js:104-134 原样, hash 提升为上面的模块函数) */
  P.x.length = 0; P.y.length = 0; P.vx.length = 0; P.vy.length = 0; P.fixed.length = 0;
  const angle: Record<string, number> = {};
  DOMAIN_IDS.forEach((id, i) => { angle[id] = -Math.PI / 2 + i * (Math.PI * 2 / DOMAIN_IDS.length); });
  const anchor = Object.assign({ dom_extern: { x: 0, y: -3900 } }, DOM_ANCHOR);
  const fieldCount: Record<string, number> = {};
  NODES_.forEach((n) => {
    let ax: number, ay: number;
    if (n.t === "Domain") { ax = anchor[n.id].x; ay = anchor[n.id].y; }
    else if (n.t === "Field") {
      const a = angle[n.dom] + (hash(n.id) % 100 / 100 - 0.5) * 0.9;
      ax = anchor[n.dom].x + Math.cos(a) * 150; ay = anchor[n.dom].y + Math.sin(a) * 150;
    } else if (n.t === "Topic" && n.dom === "dom_extern") {
      const a = hash(n.id) % 6283 / 1000;
      const r = 2350 + (hash(n.id + "r") % 100 / 100) * 950;
      ax = Math.cos(a) * r; ay = Math.sin(a) * r;
    } else if (n.t === "Topic") {
      const a = hash(n.id) % 6283 / 1000;
      const r = 70 + (hash(n.id + "r") % 100 / 100) * 250;
      ax = anchor[n.dom].x + Math.cos(a) * r; ay = anchor[n.dom].y + Math.sin(a) * r;
    } else {
      fieldCount[n.dom] = (fieldCount[n.dom] || 0) + 1;
      const a = angle[n.dom] + (hash(n.id) % 1000 / 1000 - 0.5) * 2.4;
      const r = 230 + (hash(n.id + "r") % 100 / 100) * 130;
      ax = anchor[n.dom].x + Math.cos(a) * r; ay = anchor[n.dom].y + Math.sin(a) * r;
    }
    P.x.push(ax); P.y.push(ay); P.vx.push(0); P.vy.push(0); P.fixed.push(false);
  });
}

/** 画布尺寸（AtlasMap 的 resize() 写入） */
export const canvasSize = { W: 0, H: 0, DPR: 1 };
/** 脏标记: 无变化不重绘 (js/app.js:608) */
export let forceDraw = true;
export function setForceDraw(v: boolean): void { forceDraw = v; }
export function getForceDraw(): boolean { return forceDraw; }
```

- [ ] **Step 4: 写 lib/graph.ts**（搬运 `js/app.js:300-323, 830-849`）

```ts
import { ANCIENT, S, byId, E } from "./state";
import type { GraphNode } from "./types";

export function yearOK(n: GraphNode, year: number = S.year): boolean {
  return n.born == null || n.born <= year || n.born < ANCIENT;
}

export function isFossil(n: GraphNode, year: number = S.year): boolean {
  return n.died != null && n.died <= year;
}

/** 邻居 id 集合 (js/app.js:311-316 原样改造为纯函数) */
export function neighborsOf(id: string): Set<string> {
  const n = byId[id];
  const set = new Set<string>();
  if (!n) return set;
  for (const e of n.out || []) set.add(e.to);
  for (const e of n.in || []) set.add(e.from);
  return set;
}

export function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* 时间滑块锚点 (js/app.js:830-849 原样) */
const SLIDER_ANCHORS: [number, number][] = [
  [0, -8000], [250, -4000], [400, -2000], [500, -500], [550, 500], [620, 1200], [720, 1600],
  [830, 1800], [890, 1900], [930, 1950], [1000, 2026],
];

export function sliderToYear(s: number): number {
  for (let i = 1; i < SLIDER_ANCHORS.length; i++) {
    const [s1, y1] = SLIDER_ANCHORS[i];
    const [s0, y0] = SLIDER_ANCHORS[i - 1];
    if (s <= s1) {
      const t = (s - s0) / (s1 - s0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return SLIDER_ANCHORS[SLIDER_ANCHORS.length - 1][1];
}

export function yearToSlider(y: number): number {
  for (let i = 1; i < SLIDER_ANCHORS.length; i++) {
    const [s1, y1] = SLIDER_ANCHORS[i];
    const [s0, y0] = SLIDER_ANCHORS[i - 1];
    if (y <= y1) {
      const t = (y - y0) / (y1 - y0);
      return Math.round(s0 + t * (s1 - s0));
    }
  }
  return SLIDER_ANCHORS[SLIDER_ANCHORS.length - 1][0];
}
```

注意：`SLIDER_ANCHORS` 逐字抄 `js/app.js:830` 那一行的完整数组后再格式化，上面若与源不符以源为准。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run lib/graph.test.ts`
Expected: PASS。

- [ ] **Step 6: tsc 校验**

Run: `npm run lint`
Expected: 无错误（`E` 未使用会有 TS6133 警告——在文件头加 `void E;` 或从 import 中去掉，以实际使用为准）。

- [ ] **Step 7: Commit**

```bash
git add lib/state.ts lib/graph.ts lib/graph.test.ts
git commit -m "feat: 图状态单例(initGraph)与纯函数模块(TDD)"
```

---

### Task 5: 模拟与渲染模块（机械搬运）

**Files:**
- Create: `lib/sim.ts`（`js/app.js:135-299`）
- Create: `lib/render.ts`（`js/app.js:317-583`）

- [ ] **Step 1: 写 lib/sim.ts**

搬运 `js/app.js:135-299`：`reheat`、`createSimWorker`、`sendSimInit`、`sendPin`、`sendUnpin`、`sendReheat`、`step`（主线程回退模拟），加 `export`。改动点：

1. `new Worker("sim_worker.js")` → `new Worker("/sim-worker.js")`
2. 模块级可变量（`simWorker`、`dynIdx`、`workerReady`、`alpha`、`let HL`）保留在本模块；`S/P/E/byId/DOM_ANCHOR/DOMAIN_IDS/NODES_` 从 `@/lib/state` import（`E`/`NODES_` 是 `let` 导出——用 state 导出的 getter，或把 state 的 `E`、`NODES_` 改为对象包装。**采用 getter 方案**：在 `lib/state.ts` 追加：
   ```ts
   export function getE(): GraphEdge[] { return E; }
   export function getNodes(): GraphNode[] { return NODES_; }
   export function getCNAll(): GraphEdge[] { return CN_ALL_EDGES; }
   ```
   sim/render 中引用处 `E` → `getE()`，`NODES_` → `getNodes()`，`CN_ALL_EDGES` → `getCNAll()`）
3. Worker 消息类型加 TS interface：
   ```ts
   export interface SimInitMsg {
     type: "init"; count: number;
     px: Float32Array; py: Float32Array; fixed: Uint8Array;
     isTopic: Uint8Array; domIdx: Uint8Array; nDomains: number;
     ancX: Float32Array; ancY: Float32Array;
     edgeSrc: Uint32Array; edgeDst: Uint32Array; edgeRest: Float32Array; edgeK: Float32Array;
   }
   export type SimMsg = SimInitMsg | { type: "reheat"; alpha: number }
     | { type: "pin"; idx: number; x: number; y: number }
     | { type: "unpin"; idx: number }
     | { type: "add"; count: number; px: Float32Array; py: Float32Array; isTopic: Uint8Array; domIdx: Uint8Array }
     | { type: "stop" };
   ```

- [ ] **Step 2: 写 lib/render.ts**

搬运 `js/app.js:317-583`：`HL`、`refreshHL`、`sx`、`sy`、`draw`、`_fpsN/_fpsT`、`tick`。改动点：

1. `const cv = document.getElementById("cv")` → 模块内保存引用：`let cv: HTMLCanvasElement | null = null; let ctx: CanvasRenderingContext2D | null = null; export function initRender(c: HTMLCanvasElement) { cv = c; ctx = c.getContext("2d"); }`
2. `W/H/DPR` → 从 `state.canvasSize` 读写
3. `forceDraw` → 用 `state` 的 `getForceDraw()/setForceDraw()`
4. `tick` 内调用 `draw`、`S`、`P`、`byId` 等 import 自 `@/lib/state`；`E`→`getE()`；`flowBuilt/drawFlow`（resize 中引用，js/app.js:87）→ 通过回调解耦：在 render.ts 加 `export let onResize: (() => void) | null = null;`，`resize()` 中 `if (onResize) onResize();`，FlowView 设置 `onResize = () => { if (flowBuilt) drawFlow(); }`
5. `draw` 末尾对 `ctx`/`cv` 的空值断言用 `!`（initRender 保证在 AtlasMap useEffect 中先调用）

`resize()` 函数（js/app.js:83-89）也搬入本模块并 `export`（供 AtlasMap 与 window resize 监听使用）。

- [ ] **Step 3: tsc 校验**

Run: `npm run lint`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add lib/sim.ts lib/render.ts lib/state.ts
git commit -m "feat: 力导向模拟(Worker+主线程回退)与canvas渲染模块"
```

---

### Task 6: 页面骨架与路由

**Files:**
- Create: `app/page.tsx`（重写占位）、`lib/router.ts`（`js/app.js:1162-1211`）

- [ ] **Step 1: 写 lib/router.ts**（搬运 `js/app.js:1162-1200`，加 export；`route()` 末尾对 `buildFlow/buildTimeline/...` 的调用通过注册表解耦）

```ts
export const VIEW_SECTIONS: Record<string, string> = {
  map: "view-map", flow: "view-flow", frontier: "view-frontier",
  timeline: "view-timeline", about: "view-about", api: "view-api", curate: "view-curate",
  domain: "view-domain",
};
export const VIEW_HASH: Record<string, string> = {
  map: "atlas", flow: "flow", frontier: "frontier", timeline: "timeline",
  about: "about", api: "api", curate: "curate",
};
export const VIEW_TITLE: Record<string, string> = {
  map: "星图", flow: "河流 · 成熟度管道", frontier: "前沿", timeline: "时间轴",
  about: "图志", api: "开放 API", curate: "策展台", domain: "域地图",
};

/** 各视图注册懒构建器（FlowView/TimelineView 等在挂载时注册），解耦 route() 对视图模块的直接依赖 */
export const viewBuilders: Record<string, () => void> = {};

export function setHash(h: string): void {
  if (location.hash !== h) history.replaceState(null, "", h);
}

export function switchView(v: string, opts?: { silent?: boolean }): void {
  /* js/app.js:1166-1182 原样搬运: data-view 切换、section hidden 切换、tab active、标题、hash 同步 */
}

export function route(): void {
  /* js/app.js:1183-1199 原样搬运; 对 buildFlow()/buildTimeline() 等调用改为
     viewBuilders.flow?.(); viewBuilders.timeline?.(); 等 */
}
```

搬运时以 `grep -n "function switchView\|function route" js/app.js` 校准，函数体逐字保留（DOM 查询 `document.querySelector` 系列不变——页面骨架里 id 全部保留）。

- [ ] **Step 2: 写 app/page.tsx**（把 `index.html:12-221` 的 body 内容转成 JSX）

转换规则：
1. `<body data-view="map">` 不需要（layout.tsx 已有）；从 `<header id="topbar">` 到 `<div id="tooltip" hidden></div>` 全部放入组件
2. `class=` → `className=`；`style="left:0%"` → `style={{ left: "0%" }}`；`aria-label` 保留
3. 所有 `id` 原样保留（imperative 代码靠 getElementById 工作；React 只渲染一次骨架，无 state，不会重渲染冲突）
4. 空标签自闭合：`<input …></input>` → `<input … />`，`<canvas id="cv"></canvas>` → `<canvas id="cv" />`
5. `<section id="view-…" hidden>` → `<section id="view-…" hidden={true}>`（或 `hidden` 即可）
6. 注释 `<!-- … -->` → `{/* … */}`
7. 末尾挂载 AtlasMap（Task 7 实现后启用；本 Task 先不引用，骨架内联在 page.tsx 中）

page.tsx 结构：

```tsx
import AtlasMap from "@/components/AtlasMap";

export default function Home() {
  return (
    <>
      <header id="topbar">
        {/* …index.html:14-33 的 JSX 转换… */}
      </header>
      <main>
        <section id="view-map">
          <canvas id="cv" />
          {/* …legend / timebar / storyChips / storyBox / hint… */}
        </section>
        {/* …view-flow / view-frontier / view-domain / view-curate / view-timeline / view-about / view-api… */}
      </main>
      <aside id="panel" hidden></aside>
      <div id="tooltip" hidden></div>
      <AtlasMap />
    </>
  );
}
```

- [ ] **Step 3: 手动验证 dev**

Run: `npm run dev` → 打开 http://localhost:3000
Expected: 骨架可见（顶栏 tabs、星图区、时间轴区、图志文案），无 React hydration 报错；控制台无 404 样式。此时交互尚未接（AtlasMap 占位返回 null）。

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx lib/router.ts
git commit -m "feat: 页面DOM骨架(HTML→JSX)与hash路由模块"
```

---

### Task 7: AtlasMap 主组件（画布 + 交互 + boot）

**Files:**
- Create: `components/AtlasMap.tsx`（`js/app.js:14-48` mergeExt + `584-686` 交互 + `1632-1653` boot + resize 监听）

- [ ] **Step 1: 写组件**（"use client"）

```tsx
"use client";
import { useEffect } from "react";
import { loadCore, loadExt } from "@/lib/loader";
import { initGraph, S, P, byId, canvasSize, DOMAIN_IDS, NODES_,
  CN_TOPIC_EDGES, setForceDraw, getCNAll } from "@/lib/state";  // 按实际使用调整
import { initRender, resize, tick } from "@/lib/render";
import { createSimWorker, sendSimInit, reheat } from "@/lib/sim";
import { YEAR_MIN, YEAR_MAX, REDUCED } from "@/lib/state";
import { switchView, route } from "@/lib/router";
```

组件逻辑（搬运 `js/app.js:14-48,584-686,1632-1653`）：

1. `useEffect` 内：`loadCore().then(core => { initGraph(core); boot(); }).catch(err => 显示错误层)`——错误层：往 `#view-map` 顶部插入 `<div class="load-error">数据加载失败：{err.message}</div>`（用 `document.getElementById("cv")` 父节点 append），并给重试按钮 `location.reload()`
2. `boot()`（js/app.js:1632 原样）：`resize()`（先 `initRender(cv)`）、`buildLegend()`/`buildStories()` 等调用通过 `viewBuilders` 注册表或直接 import（Legend/Stories 在 Task 8 才有——**本 Task 先注释掉这两行并留 TODO 注释**，Task 8 接回）、`buildMetrics()` 同理、`createSimWorker()+sendSimInit()`、预热 step 循环、hash 深链判断、`tick()`、`setTimeout(mergeExt, 1500)`
3. `mergeExt()`（js/app.js:14-48 原样）：`fetch("js/data_ext.json")` → `loadExt()`；`reheat(0.15)`、worker add 消息、`setForceDraw(true)`；`.catch(() => {})` 保留静默
4. 交互（js/app.js:584-686 原样）：`zoomAt`、`flyTo`、`pickNode`、`drag/lastHov/lastSel` 状态、`cv` 的 pointerdown/move/up、dblclick、wheel 监听（监听器在 useEffect 内注册，cleanup 函数里全部 removeEventListener）
5. `window.addEventListener("resize", resize)` + cleanup

- [ ] **Step 2: 手动验证 dev（核心里程碑）**

Run: `npm run dev`
Expected（与旧站 http://127.0.0.1:8123 对比）：
- 星图渲染，开幕生长动画（6.5s 播放）
- 拖动平移 / 滚轮缩放 / 双击聚焦
- hover 高亮 + tooltip
- 1.5s 后 ext 层合并（节点数明显增加， Topic 光晕环出现）
- 控制台无报错；Worker 生效（DevTools → Sources → sim-worker.js 有帧循环）

- [ ] **Step 3: Commit**

```bash
git add components/AtlasMap.tsx
git commit -m "feat: AtlasMap 画布主组件(boot/交互/懒加载ext)"
```

---

### Task 8: 星图视图 UI 组件

**Files:**
- Create: `components/ConceptPanel.tsx`（`js/app.js:687-829`：`REL_LABELS`、`relHTML`、`select`）
- Create: `components/TimeBar.tsx`（`js/app.js:850-872`：`yearRange/yearLabel/playBtn`、`syncTimeUI`、`startPlay`、`stopPlay`）
- Create: `components/Legend.tsx`（`js/app.js:873-907`：`buildLegend`）
- Create: `components/SearchBox.tsx`（`js/app.js:908-937`）
- Create: `components/Stories.tsx`（`js/app.js:938-976`：`buildStories`、`startStory`、`storyStep`、`endStory`）

- [ ] **Step 1: 逐文件机械搬运**

规则同 Task 5：函数体逐字保留，import 依赖（`S/byId/E/P/flyTo/select` 等跨组件调用通过相互 import 或集中在 `AtlasMap.tsx` 导出）。`S.story`/`S.storyTimer` 已在 state.ts。`TimeBar` 的 `sliderToYear/yearToSlider` 用 `@/lib/graph`。

- [ ] **Step 2: AtlasMap 接回 boot 中的 buildLegend/buildStories 调用**

- [ ] **Step 3: 手动验证 dev**

Expected：概念卡（单击节点：定义/奠基链/关联/证据）、年代尺拖动+重放生长、图例过滤（域/类型显隐+全部显示）、搜索下拉、三条故事导览全流程。逐项与旧站对比。

- [ ] **Step 4: Commit**

```bash
git add components/
git commit -m "feat: 概念卡/年代尺/图例/搜索/故事组件"
```

---

### Task 9: 时间轴视图

**Files:**
- Create: `components/TimelineView.tsx`（`js/app.js:977-1161`：`TL_ANCHORS`、`xFor`、`xToYear`、`buildTimeline`、`sizeTl`、`queueTlDraw`、`drawTimeline`、`tlHit`、`closeTlPop`、`updateTimelineCursor`、resize 监听）

- [ ] **Step 1: 机械搬运**；`tlCv/tctx` 经 `initTimelineRender(cv)`；`gradeOf` 一并搬入。
- [ ] **Step 2: router 注册**：`route()` 切到 timeline 时调用 `buildTimeline()` → 通过 `viewBuilders.timeline = buildTimeline`（在组件模块顶层或 AtlasMap boot 中注册）。
- [ ] **Step 3: 手动验证**：`#/timeline` 长时段泳道渲染、密度直方图、点悬停弹出 tlPop、点击跳节点、随年代尺光标更新。
- [ ] **Step 4: Commit** `git commit -m "feat: 长时段时间轴视图"`

---

### Task 10: 河流图与前沿视图

**Files:**
- Create: `components/FlowView.tsx`（`js/app.js:1212-1362`：`heatColor`、`STAGES`、`stageOf`、`buildFlow`、`drawFlow`）
- Create: `components/FrontierView.tsx`（`js/app.js:1363-1511`：`TYPED_EDGE_TYPES`、`jaccardPairs`、`bottleneckImpact`、`growthRank`、`buildFrontier`、`renderDomain`）

- [ ] **Step 1: 机械搬运两个组件**；FlowView 设置 `render.onResize = () => { if (flowBuilt) drawFlow(); }`（Task 5 预留的钩子）。
- [ ] **Step 2: router 注册** `viewBuilders.flow / viewBuilders.frontier`；`heatBtn`（叠加生长热力层）与 `renderDomain`（域地图 `#/domain/<id>`）一并接好。
- [ ] **Step 3: 手动验证**：`#/flow` 彩带管道渲染+悬停；`#/frontier` 四张榜单 + 热力叠加 + 点入域地图。
- [ ] **Step 4: Commit** `git commit -m "feat: 成熟度河流图与前沿榜单视图"`

---

### Task 11: 图志 / 指标 / 开放 API 视图

**Files:**
- Create: `components/ApiView.tsx`（`js/app.js:1512-1533`：`buildApi`）
- Create: `components/MetricsBox.tsx`（`js/app.js:1534-1557`：`buildMetrics`）

- [ ] **Step 1: 机械搬运 + 路径修改**
  - `buildApi`：`window.API_MANIFEST` 改为动态加载 `<script src="/data/manifest.js">`（或直接 `fetch('/data/manifest.js')` 后 `new Function` 解析——**采用 script 标签注入**，与旧行为一致）；`apiFetchNote` 提示改为：「大体积数据文件（nodes/edges/graph.json）不随站点部署，请从本地管线 `python scripts/export.py --with-api` 或项目 Release 获取」
  - `buildMetrics`：`fetch("api/meta.json")` → `loadMeta()`（`@/lib/loader`）
  - `#/about` 页（图志）为纯静态 JSX，已在 page.tsx 骨架中，无逻辑搬运；`stampNo/stampDate/stampNodes` 的填充在 `boot()` 里（js/app.js:1636-1639），随本任务搬进 MetricsBox 或 AtlasMap。
- [ ] **Step 2: 手动验证**：`#/about` 版次戳+完备度指标渲染；`#/api` 端点表渲染且无 404 报错（meta 部分来自 `/data/meta.json`）。
- [ ] **Step 3: Commit** `git commit -m "feat: 图志指标与开放API视图(meta改走/data/)"`

---

### Task 12: 策展视图（本地模式）

**Files:**
- Create: `components/CurateView.tsx`（`js/app.js:1558-1630`：`buildCurate`、`loadCurNodes`、`loadCurPairs`、`bindCur`）

- [ ] **Step 1: 机械搬运 + 失败提示改造**

`buildCurate` 里 `fetch("/api2/stats")` 的 `.catch` / 失败分支改为：

```ts
document.getElementById("curateStatus")!.textContent =
  "策展工作台仅本地模式可用 —— 在仓库根目录运行 python scripts/serve.py 后访问 http://127.0.0.1:8123/#/curate";
```

（原代码 fetch 失败时 status 文案是「正在连接本地服务…」，改为上述明确提示；本地 serve.py 下流程不变。）

- [ ] **Step 2: 手动验证**
  - 线上形态：`npm run dev`（无 serve.py）→ `#/curate` 显示本地模式提示，无未捕获报错
  - 本地形态：`python scripts/serve.py`（Task 13 之后路径）或当前根目录 `python serve.py` + `python -m http.server` 旧站对照——策展全流程：复核为 B / 标记剔除 / 共现对判读（POST /api2/semantic）

- [ ] **Step 3: Commit** `git commit -m "feat: 策展台视图(线上显示本地模式提示)"`

---

### Task 13: Python 管线归位与 export.py 重写

**Files:**
- Move: 根目录全部 `*.py` → `scripts/`（git mv）
- Move: `build-api.js` → `scripts/build-api.mjs`；`validate.js` → `scripts/validate.mjs`
- Modify: `scripts/export.py`（输出改为 `public/data/`）、`scripts/make_all.py`（编排路径）、`scripts/serve.py`（静态目录指向 `out/` 或保留原根目录服务旧行为——见 Step 4）

- [ ] **Step 1: 移动文件**

```bash
git mv build_db.py build-api.js cleanup_texture.py cn_all.py cn_import.py context_extract.py curate.py curate_batch.py db.py export.py extract.py fix_curate_batch.py ingest.py make_all.py run_all_shards.py run_context.py semantic.py serve.py sync_stories.py validate.js wiki_extract.py scripts/
git mv scripts/build-api.js scripts/build-api.mjs
git mv scripts/validate.js scripts/validate.mjs
mkdir -p data
git mv bulk corpus data/
```

- [ ] **Step 2: 统一路径基准**

每个移动后的脚本，把 cwd 相对路径改为仓库根推导。在每个脚本 main/顶部加：

```python
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)   # 保持其余相对路径(atlas.db / corpus/ / bulk/ / api/)不变
```

逐脚本确认（grep `open("` / `connect` / `"api/` / `"js/` / `"corpus/` / `"bulk/`）：`build_db.py`、`ingest.py`、`extract.py`、`wiki_extract.py`、`export.py`、`curate.py`、`make_all.py`、`serve.py`、`sync_stories.py`、`cn_all.py`、`cn_import.py`、`semantic.py`、`context_extract.py`、`run_*.py`、`curate_batch.py`、`fix_curate_batch.py`、`cleanup_texture.py`、`db.py`（被 import，无需改）。`corpus/` 与 `bulk/` 的引用路径随目录迁移改为 `data/corpus/`、`data/bulk/`（grep `"corpus/` 与 `"bulk/` 逐处替换）。`scripts/build-api.mjs` 与 `scripts/validate.mjs` 同理在文件头加 `process.chdir(__dirname + "/..")`（mjs 用 `import { fileURLToPath } from "node:url"`）。

验证：`python scripts/export.py`（此刻仍写旧路径 api/、js/——行为不变）输出 `✓ 导出完成`。

- [ ] **Step 3: 重写 export.py 输出段**

把 `export.py` 的 `main()` 输出部分（`os.makedirs("api", ...)` 到文件末尾的 manifest 写入）替换为：

```python
    OUT = ROOT / "public" / "data"
    OUT.mkdir(parents=True, exist_ok=True)

    # 核心 = 非 cn_ 节点; 扩展 = cn_ 层 (ConceptNet 导入, 延迟合并)
    cn_ids = {n["id"] for n in nodes if n["id"].startswith("cn_")}
    core_nodes = [n for n in nodes if n["id"] not in cn_ids]
    core_edges = [[e["from"], e["to"], e["type"], e["weight"], e["since"]] +
                  ([e["ctx"]] if e.get("ctx") else [])
                  for e in edges if e["from"] not in cn_ids and e["to"] not in cn_ids]
    cn_nodes = [n for n in nodes if n["id"] in cn_ids]
    cn_edges = [[e["from"], e["to"], e["type"], e["weight"], e["since"]] +
                ([e["ctx"]] if e.get("ctx") else [])
                for e in edges if e["from"] in cn_ids or e["to"] in cn_ids]

    def wjson(name, data, indent=None):
        with open(OUT / name, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)

    wjson("core.json", {"domains": domains, "nodes": core_nodes,
                        "edges": core_edges, "stories": story_list})
    wjson("ext.json", {"nodes": cn_nodes, "edges": cn_edges})
    wjson("meta.json", meta)

    # 开放 API 端点清单（站点仅展示清单; 大文件本地生成）
    api_files = ["meta.json", "nodes.json", "edges.json", "graph.json", "stories.json"]
    manifest = {"generated": meta["generated"], "files": []}
    # api/*.json 仍写到本地 api/（管线中间产物, 不部署）
    api_dir = ROOT / "api"
    api_dir.mkdir(exist_ok=True)
    wjson_to = lambda rel, data: json.dump(
        data, open(api_dir / rel, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    wjson_to("meta.json", meta)
    wjson_to("nodes.json", nodes)
    wjson_to("edges.json", edges)
    wjson_to("graph.json", dict(meta, nodes=nodes, edges=edges))
    wjson_to("stories.json", story_list)
    for fn in api_files:
        kb = round((api_dir / fn).stat().st_size / 102.4) / 10
        desc = {"meta.json": "版次/计数/许可/域清单", "nodes.json": "全部节点(含证据/置信度)",
                "edges.json": "全部边", "graph.json": "全图一次拉取",
                "stories.json": "故事导览脚本"}[fn]
        manifest["files"].append({"file": fn, "desc": desc, "kb": kb, "bytes": kb * 1024})
    with open(OUT / "manifest.js", "w", encoding="utf-8") as f:
        f.write("/* 由 export.py 生成 */\nwindow.API_MANIFEST = ")
        f.write(json.dumps(manifest, ensure_ascii=False, indent=1) + ";")

    by_type = defaultdict(int)
    for n in nodes: by_type[n["t"]] += 1
    print(f"✓ 导出完成: 版次 {EDITION} · {len(nodes)} 节点 / {len(edges)} 边 / {len(domains)} 域")
    print(f"  public/data/core.json {round((OUT / 'core.json').stat().st_size / 1024)} KB · "
          f"ext.json {round((OUT / 'ext.json').stat().st_size / 1024)} KB")
    con.close()
```

（同时删除原 `js/data_full.js` / `js/data_ext.json` / `api/manifest.js` 的写入代码。）

- [ ] **Step 4: make_all.py 与 serve.py 调整**
  - `make_all.py`：子进程调用改为 `sys.executable scripts/xxx.py`（或 `python scripts/xxx.py`）、`node scripts/build-api.mjs`；每步断言的产物路径同步（export 步改为断言 `public/data/core.json` 存在且节点数 > 0）
  - `serve.py`：静态目录改为服务 `out/`（若不存在则提示先 `npm run build`）；`/api2/*` 逻辑不变。静态目录部分找到 `os.path` / `SimpleHTTPRequestHandler` 相关配置修改。

- [ ] **Step 5: validate.mjs 更新**

`scripts/validate.mjs`：校验对象改为 `public/data/core.json` + `ext.json` + `meta.json`：core 节点 id 唯一、边端点都存在于节点表（含 ext 合并后）、stories 步骤引用的节点存在。文件头 `process.chdir`（Step 2 已加）。运行 `npm run validate`。

- [ ] **Step 6: 全管线验证**

Run: `python scripts/make_all.py`
Expected: 每步 ✓，`public/data/` 四个文件重新生成；`npm run validate` 通过；`npm run build` 后 `npm run preview` 打开站点数据正常。

- [ ] **Step 7: Commit**

```bash
git add scripts/ public/data/
git commit -m "refactor: Python管线归位scripts/, export.py输出public/data/"
```

---

### Task 14: 清理旧文件、README 与验收

**Files:**
- Delete: `index.html`, `js/`（app.js/data.js/data_full.js/data_ext.json）, `css/`, `sim_worker.js`, `api/`（git rm --cached）
- Modify: `.gitignore`, `README.md`

- [ ] **Step 1: 删除旧前端文件**

```bash
git rm index.html css/style.css js/app.js js/data.js js/data_full.js js/data_ext.json sim_worker.js
git rm -r --cached api/
```

`.gitignore` 追加：

```
api/
```

（`api/` 仍是管线本地中间产物目录，只是不再入库。）

- [ ] **Step 2: 更新 README.md**

改动点：打开方式改为 `npm install && npm run dev`；数据管线一节路径全部加 `scripts/` 前缀；新增「部署」一节：Vercel 导入仓库 → Framework 自动识别 Next.js → Root Directory 仓库根 → 零配置；删除「双击 index.html」相关描述；保留设计文档链接。

- [ ] **Step 3: 终验收（对照 spec 验收标准）**

```bash
npm run lint && npm run test && npm run validate && npm run build && npm run preview
```

浏览器逐项检查（http://localhost:3000，与旧站截图/行为对照）：
1. 星图渲染、开幕生长、缩放拖拽、双击聚焦
2. 概念卡、年代尺+重放、图例过滤、搜索、三条故事
3. `#/timeline` `#/flow` `#/frontier` `#/about` `#/api` 全视图正常
4. `#/curate` 显示本地模式提示；`python scripts/serve.py` 下策展全流程可用
5. `out/` 目录含 `data/` 四文件与 `sim-worker.js`
6. Vercel：推送后部署成功（用户操作，验收时提示）

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: 移除旧静态站文件, README切换到Next.js工作流"
```

---

## 风险与回退

- **最大风险在 Task 7-8**（初始化时序从同步改异步）。若星图空白：先查 `initGraph` 是否在 `createSimWorker` 前完成（sendSimInit 依赖 NODES_）；再查 worker `pos` 消息是否回传（DevTools Network → worker）。
- 每个 Task 独立 commit，任何一步行为与旧站不符可 `git revert` 单个提交。
- 旧站文件在 Task 14 前始终保留，可随时 `python -m http.server 8123` 对照。

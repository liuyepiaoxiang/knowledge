import type { Domain, GraphCore, GraphEdge, GraphNode, Story } from "./types";
import { toEdge } from "./types";

/** 年代尺范围 (js/app.js:63 原样) */
export const YEAR_MIN = -8000, YEAR_MAX = 2026;
/** 远古层: 早于年代尺起点的节点永久可见(火/制陶/农业) (js/app.js:64) */
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
  /* 源码 JS 里动态挂载的字段(js/app.js:551/556/1192/1464), 显式声明 */
  heat: false as boolean,            /* 生长热力层开关 (js/app.js:1464) */
  userMoved: false as boolean,       /* 用户已手动平移/缩放 (js/app.js:551/623) */
  needFly: null as string | null,    /* 相机飞行推迟到画布尺寸就绪 (js/app.js:553/1192) */
  /* 相机动画状态 (js/app.js:597-604 flyTo 写入, tick 插值读取) */
  cam: null as { k0: number, k1: number, tx0: number, ty0: number, tx1: number, ty1: number, t0: number, dur: number } | null,
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
  /* initPositions (js/app.js:104-134 原样, IIFE 内 hash 提升为上面的模块函数) */
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
      /* 开放图谱导入层: 环绕全部大陆的光晕 */
      const a = hash(n.id) % 6283 / 1000;
      const r = 2350 + (hash(n.id + "r") % 100 / 100) * 950;
      ax = Math.cos(a) * r; ay = Math.sin(a) * r;
    } else if (n.t === "Topic") {
      /* 提取层背景纹理: 固定盘面布点, 不参与模拟 */
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

/** 画布尺寸（AtlasMap 的 resize() 写入, js/app.js:82） */
export const canvasSize = { W: 0, H: 0, DPR: 1 };
/** 脏标记: 无变化不重绘 (js/app.js:608) */
export let forceDraw = true;
export function setForceDraw(v: boolean): void { forceDraw = v; }
export function getForceDraw(): boolean { return forceDraw; }

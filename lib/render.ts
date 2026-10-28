/* Canvas 渲染与主循环。搬运自 js/app.js:83-89(resize),317-606(HL/refreshHL/sx/sy/draw/
 * tick/zoomAt/flyTo), 函数体逐字保留, 仅按改动点做: cv/ctx 延迟到 initRender、
 * W/H/DPR 读写 state.canvasSize、forceDraw 走 state、外部视图回调解耦。
 */
import {
  REDUCED, S, P, byId, canvasSize, getForceDraw, setForceDraw,
  CN_ALL_EDGES, DOM_ANCHOR, DOMAINS_, E, NODES_,
} from "./state";
import { hashStr, isFossil, neighborsOf, shownIdx, sliderToYear } from "./graph";
import { EDGE_TYPES, TYPES, heatColor, type EdgeTypeStyle } from "./theme";
import { reheat, sendSimStop, simAlpha, simWorkerActive, step } from "./sim";

/* ---------- Canvas ---------- */
/* 模块级画布引用(命名加下划线, 供函数体内 const ctx = _ctx! 一行别名后逐字使用源码函数体) */
let _cv: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
export function initRender(c: HTMLCanvasElement) {
  _cv = c;
  _ctx = c.getContext("2d");
}

/* 最近一帧的节点屏幕坐标(draw 每帧重算, pickNode 拾取用) */
export let SXA = new Float32Array(0);
export let SYA = new Float32Array(0);

/* resize 回调: FlowView(T10) 通过 setOnResize 注册 "if (flowBuilt) drawFlow()" (js/app.js:87) */
export let onResize: (() => void) | null = null;
export function setOnResize(fn: (() => void) | null): void { onResize = fn; }
/* 时间轴 UI 回调: TimeBar(T8) 注册 syncTimeUI/stopPlay (js/app.js:853/869, tick 内调用) */
export let onTimeSync: (() => void) | null = null;
export function setOnTimeSync(fn: (() => void) | null): void { onTimeSync = fn; }
export let onStopPlay: (() => void) | null = null;
export function setOnStopPlay(fn: (() => void) | null): void { onStopPlay = fn; }
/* 概念卡面板引用: flyTo 据其可见性偏移居中 (js/app.js:595, panel 原为 687 行的 DOM 全局) */
let panelEl: HTMLElement | null = null;
export function setPanelEl(p: HTMLElement | null): void { panelEl = p; }

/* resize() —— 搬运自 js/app.js:83-89; W/H/DPR 改为 canvasSize, drawFlow 经 onResize 解耦 */
export function resize() {
  const cv = _cv!;
  /* DPR 上限 2: 4K+ 高分屏填充率减半, 视觉几乎无损 */
  canvasSize.DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvasSize.W = cv.clientWidth; canvasSize.H = cv.clientHeight;
  cv.width = canvasSize.W * canvasSize.DPR; cv.height = canvasSize.H * canvasSize.DPR;
  if (onResize) onResize();
  setForceDraw(true);
}

/* ---------- 高亮集合 ---------- */
export let HL: string | null = null;       /* 当前高亮节点 id 或 null */
/* 故事导览期间悬停不抢占焦点(鼠标滑过画布会随机选中沿途节点, 导致故事节点"有时不高亮") */
export function refreshHL() { HL = (S.story ? null : S.hov) || S.sel; }

/* ---------- 绘制 ---------- */
export function sx(x: number) { return x * S.k + S.tx; }
export function sy(y: number) { return y * S.k + S.ty; }

/** #rrggbb → rgba(r,g,b,a)。TYPES/heatColor 均输出 hex, 渐变到同色透明避免边缘发暗 */
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," +
    parseInt(h.slice(4, 6), 16) + "," + a + ")";
}

/* ---------- 可见节点索引缓存 ----------
 * shownIdx 依赖 year/typeOff/domOff/节点集, 以签名串检测失效:
 * 命中时 draw 的节点遍历与边端点判定均走 visIdx/visMask (O(可见数) 代替 O(全表)) */
let visIdx = new Int32Array(0);
let visMask = new Uint8Array(0);
let visSig = "";
function rebuildVis(): void {
  const N = NODES_.length;
  visMask = new Uint8Array(N);
  const idx: number[] = [];
  for (let i = 0; i < N; i++) {
    if (shownIdx(i)) { visMask[i] = 1; idx.push(i); }
  }
  visIdx = Int32Array.from(idx);
}

/* ---------- 深空底幕: 预渲染星野(离屏一次, 帧内 4 次 drawImage, 视差缓移) ---------- */
let starCv: HTMLCanvasElement | null = null;
let starW = 0, starH = 0;
function ensureStarfield(W: number, H: number): void {
  if (starCv && starW === W && starH === H) return;
  starW = W; starH = H;
  starCv = document.createElement("canvas");
  starCv.width = Math.max(W, 1); starCv.height = Math.max(H, 1);
  const c = starCv.getContext("2d")!;
  const rnd = mulberry32(20261028);
  /* 远景薄雾: 2-3 片超淡星云带, 建立纵深 */
  for (let i = 0; i < 3; i++) {
    const hx = rnd() * W, hy = rnd() * H, hr = Math.min(W, H) * (0.35 + rnd() * 0.3);
    const haze = c.createRadialGradient(hx, hy, 0, hx, hy, hr);
    const warm = rnd() < 0.5;
    haze.addColorStop(0, warm ? "rgba(120,130,170,0.045)" : "rgba(90,120,150,0.05)");
    haze.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = haze;
    c.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
  }
  /* 星野: 大多为针尖冷白, 少量暖色/微蓝与亮星 */
  const n = Math.round(W * H / 2300);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H, r = 0.35 + rnd() * 0.75;
    const roll = rnd();
    let col = "205,216,230";              /* 冷白 */
    if (roll > 0.86) col = "232,217,176"; /* 暖 */
    else if (roll > 0.76) col = "159,192,255"; /* 微蓝 */
    c.fillStyle = "rgba(" + col + "," + (0.10 + rnd() * 0.5).toFixed(2) + ")";
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    if (rnd() > 0.965) {                  /* 少数亮星加十字微芒 */
      c.strokeStyle = "rgba(" + col + ",0.35)";
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(x - r * 4, y); c.lineTo(x + r * 4, y);
      c.moveTo(x, y - r * 4); c.lineTo(x, y + r * 4);
      c.stroke();
    }
  }
}
function drawStarfield(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  if (!starCv) return;
  /* 视差: 星野比星图慢移(3%), 平移时产生纵深; 取模平铺覆盖全屏 */
  const px = ((-S.tx * 0.03) % W + W) % W;
  const py = ((-S.ty * 0.03) % H + H) % H;
  for (const dx of [px - W, px]) {
    for (const dy of [py - H, py]) {
      ctx.drawImage(starCv, dx, dy, W, H);
    }
  }
}

/* ---------- 大陆星云: 每域独立色调(深空青/靛/紫灰系), 双层弥散 ---------- */
const NEBULA_TINTS = ["96,132,184", "104,152,158", "128,140,192", "148,138,182", "100,158,168"];
export function nebulaTint(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return NEBULA_TINTS[Math.abs(h) % NEBULA_TINTS.length];
}

/* ---------- 深空底幕辅助(其它视图复用: 河流图/时间轴等) ---------- */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 深空底色 + 视口星野(与星图同一离屏层, 视差中心对齐) */
export function drawStars(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = "#0b111c";
  ctx.fillRect(0, 0, W, H);
  ensureStarfield(W, H);
  drawStarfield(ctx, W, H);
}
/** 径向暗角(内容之上绘制, 聚拢视线) */
export function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.74);
  vg.addColorStop(0, "rgba(4,7,13,0)");
  vg.addColorStop(1, "rgba(3,6,11,0.46)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

export function draw() {
  const ctx = _ctx!;
  const DPR = canvasSize.DPR, W = canvasSize.W, H = canvasSize.H;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  /* 背景: 深空底色 → 星野(视差) → 微弱经纬线(海图质感) */
  drawStars(ctx, W, H);
  const wx0 = (0 - S.tx) / S.k, wy0 = (0 - S.ty) / S.k;
  const wx1 = (W - S.tx) / S.k, wy1 = (H - S.ty) / S.k;
  ctx.strokeStyle = "rgba(60,80,110,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const GRID = 240;
  for (let gx = Math.floor(wx0 / GRID) * GRID; gx <= wx1; gx += GRID) { ctx.moveTo(sx(gx), 0); ctx.lineTo(sx(gx), H); }
  for (let gy = Math.floor(wy0 / GRID) * GRID; gy <= wy1; gy += GRID) { ctx.moveTo(0, sy(gy)); ctx.lineTo(W, sy(gy)); }
  ctx.stroke();

  /* 大陆星云: 内层浓 + 外层弥散, 各域色调随 id 稳定 */
  for (const d of DOMAINS_) {
    const anc = DOM_ANCHOR[d.id];
    const gx = sx(anc.x), gy = sy(anc.y), gr = 470 * S.k;
    if (gx > -gr && gx < W + gr && gy > -gr && gy < H + gr) {
      const tint = nebulaTint(d.id);
      const outer = ctx.createRadialGradient(gx, gy, gr * 0.3, gx, gy, gr * 1.55);
      outer.addColorStop(0, "rgba(" + tint + ",0.05)");
      outer.addColorStop(1, "rgba(" + tint + ",0)");
      ctx.fillStyle = outer;
      ctx.fillRect(gx - gr * 1.6, gy - gr * 1.6, gr * 3.2, gr * 3.2);
      const inner = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      inner.addColorStop(0, "rgba(" + tint + ",0.11)");
      inner.addColorStop(1, "rgba(" + tint + ",0)");
      ctx.fillStyle = inner;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
  }

  /* 暗角: 视线聚拢画心, 星图如悬于深空被一束光照亮 */
  drawVignette(ctx, W, H);

  const hlSet = HL ? neighborsOf(HL) : null;
  const focus = HL != null;

  /* 预计算全部节点的屏幕坐标 (避免 sx/sy 万次调用)。
   * SXA/SYA 挂在模块级(pickNode 拾取要用最近一帧的屏幕坐标; 源码中它们是 draw 局部量,
   * pickNode 引用属作用域 bug, 此处提升修正) */
  const N_ALL = NODES_.length;
  SXA = new Float32Array(N_ALL);
  SYA = new Float32Array(N_ALL);
  for (let i = 0; i < N_ALL; i++) {
    SXA[i] = P.x[i] * S.k + S.tx;
    SYA[i] = P.y[i] * S.k + S.ty;
  }

  /* 可见索引: year/图例开关/节点集变化时重建(播放期间每帧重建, 与原先逐节点 shownIdx 同阶) */
  const sig = S.year + "|" + [...S.typeOff].join(",") + "|" + [...S.domOff].join(",") + "|" + N_ALL;
  if (sig !== visSig) { visSig = sig; rebuildVis(); }

  /* 边合批: 按样式分组 → 每组一次 stroke */
  const vl = -80, vr = W + 80, vt = -80, vb = H + 80;
  const buckets = new Map<string, { color: string; dashed?: boolean; al: number; paths: number[] }>();
  const hiEdges: (number | EdgeTypeStyle)[] = [];

  /* 低倍只画策展边(~8k); 高倍追加 CN 边(~85k) */
  const edgeList = (S.k >= 0.45 && CN_ALL_EDGES.length) ? CN_ALL_EDGES : E;

  for (const e of edgeList) {
    const a = byId[e.from], b = byId[e.to];
    if (!visMask[a.idx!] || !visMask[b.idx!]) continue;
    const et = EDGE_TYPES[e.type];
    if (S.k < 0.45 && (a.t === "Topic" || b.t === "Topic")) continue;
    const involved = HL === e.from || HL === e.to;
    let al = et.dim ? 0.13 : 0.28;
    if (focus) al = involved ? 0.85 : 0.05;
    const x1 = SXA[a.idx!], y1 = SYA[a.idx!];
    const x2 = SXA[b.idx!], y2 = SYA[b.idx!];
    if ((x1 < vl && x2 < vl) || (x1 > vr && x2 > vr) ||
        (y1 < vt && y2 < vt) || (y1 > vb && y2 > vb)) continue;

    const bend = ((hashStr(e.from + e.to) % 9) - 4) * 6;
    const dx = x2 - x1, dy = y2 - y1, len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const mx2 = (x1 + x2) / 2, my2 = (y1 + y2) / 2;
    const cx2 = mx2 + (-dy / len) * bend, cy2 = my2 + (dx / len) * bend;

    if (involved) {
      hiEdges.push(x1, y1, cx2, cy2, x2, y2, et);
      continue;
    }

    const key = et.color + "|" + (et.dashed ? "d" : "s") + "|" + Math.round(al * 20);
    let bk = buckets.get(key);
    if (!bk) {
      bk = { color: et.color, dashed: et.dashed, al, paths: [] };
      buckets.set(key, bk);
    }
    bk.paths.push(x1, y1, cx2, cy2, x2, y2);
  }

  /* 逐桶绘制: 每桶一次 beginPath + stroke */
  ctx.lineWidth = 1;
  for (const [, bk] of buckets) {
    ctx.strokeStyle = bk.color;
    ctx.globalAlpha = bk.al;
    ctx.setLineDash(bk.dashed ? [4, 4] : []);
    ctx.beginPath();
    const pp = bk.paths;
    for (let i = 0; i < pp.length; i += 6) {
      ctx.moveTo(pp[i], pp[i + 1]);
      ctx.quadraticCurveTo(pp[i + 2], pp[i + 3], pp[i + 4], pp[i + 5]);
    }
    ctx.stroke();
  }
  /* 高亮边最后绘制: 柔光辉晕强化"关系通路"(仅聚焦邻域的少量边, shadow 开销可承受) */
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 7;
  for (let i = 0; i < hiEdges.length; i += 7) {
    const et = hiEdges[i + 6] as EdgeTypeStyle;
    ctx.shadowColor = et.color;
    ctx.strokeStyle = et.color;
    ctx.globalAlpha = 0.85;
    ctx.setLineDash(et.dashed ? [4, 4] : []);
    ctx.beginPath();
    ctx.moveTo(hiEdges[i] as number, hiEdges[i + 1] as number);
    ctx.quadraticCurveTo(hiEdges[i + 2] as number, hiEdges[i + 3] as number, hiEdges[i + 4] as number, hiEdges[i + 5] as number);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;

  /* 节点(两遍: 先提取层纹理, 再策展/结构层)。
   * 性能修正: 源码把 Topic 纹理层嵌在节点循环内(每个可见 Topic 都全量重画一遍纹理,
   * O(T²)≈4.4亿次操作/帧), 此处重构为单次批量路径——视觉输出等价 */
  ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.textAlign = "center";
  /* 批量背景纹理: 无高亮时万级 Topic 单路径一次填充 */
  if (!focus) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#d9c79a";
    ctx.beginPath();
    for (let vi = 0; vi < visIdx.length; vi++) {
      const i = visIdx[vi];
      const m = NODES_[i];
      if (m.t !== "Topic") continue;
      const bx = SXA[i], by = SYA[i];
      if (bx < -30 || bx > W + 30 || by < -30 || by > H + 30) continue;
      const br = Math.max(TYPES.Topic.r * 0.6 * Math.min(S.k * 1.5, 1), 1.4);
      ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, 7);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let vi = 0; vi < visIdx.length; vi++) {
      const i = visIdx[vi];
      const m = NODES_[i];
      if (m.t !== "Topic") continue;
      if (S.sel !== m.id && S.hov !== m.id) continue;
      const bx = SXA[i], by = SYA[i];
      const br = Math.max(TYPES.Topic.r * 0.6 * Math.min(S.k * 1.5, 1), 2.5);
      ctx.globalAlpha = 1; ctx.fillStyle = "#d9c79a";
      ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
      ctx.strokeStyle = "#d9b36c"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(bx, by, br + 3, 0, 7); ctx.stroke();
      ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
      ctx.fillStyle = "#cfd6e0"; ctx.fillText(m.zh, bx, by + br + 13);
      ctx.lineWidth = 1;
    }
  }
  /* 策展/结构层(聚焦时 Topic 也走此路径, 与源码一致) */
  for (let vi = 0; vi < visIdx.length; vi++) {
    const i = visIdx[vi];
    const n = NODES_[i];
    if (n.t === "Topic" && !focus) continue;   /* 非聚焦时 Topic 已在纹理层处理 */
    const fossil = isFossil(n);
    const T = TYPES[n.t];
    const deg = Math.min(n.deg!, 14);
    let r = T.r * (0.78 + 0.30 * Math.log2(1 + deg)) * (n.t === "Domain" ? 1 : 1);
    if (n.t === "Topic") r *= 0.78;
    r = Math.max(r * Math.min(S.k * 1.5, 1), 2.2);
    const x = SXA[i], y = SYA[i];
    /* NaN 防御: NaN 与任何比较皆为 false, 用正逻辑排除(个别异常坐标不至于中断整帧绘制) */
    if (!(x > -60 && x < W + 60 && y > -60 && y < H + 60)) continue;
    const involved = HL === n.id || (hlSet && hlSet.has(n.id));
    let base = S.heat && !fossil ? heatColor(n) : (fossil ? "#4a5468" : T.color);
    let a = focus ? (involved ? 1 : (n.t === "Topic" ? 0.08 : 0.10)) : (n.t === "Topic" ? 0.55 : 0.92);

    /* 光晕: 高连接节点(径向渐变, 中心亮缘透明) */
    if (!fossil && n.deg! >= 9 && n.t !== "Domain") {
      const hg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6);
      hg.addColorStop(0, hexA(base, 0.9));
      hg.addColorStop(1, hexA(base, 0));
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = a;
    if (n.t === "Event" || n.t === "Domain") {
      /* 事件=菱形, 域=大圆+外环 */
      if (n.t === "Event") {
        ctx.fillStyle = fossil ? base : "#f5f1e4";
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.15, y);
        ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.15, y);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(9,14,23,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      } else {
        /* 域: 暖亮核渐变 + 双层外环 */
        const dg = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
        dg.addColorStop(0, "#ffe3a3");
        dg.addColorStop(1, base);
        ctx.fillStyle = fossil ? base : dg;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = base; ctx.globalAlpha = a * 0.5;
        ctx.beginPath(); ctx.arc(x, y, r + 4.5, 0, 7); ctx.stroke();
        ctx.globalAlpha = a * 0.22;
        ctx.beginPath(); ctx.arc(x, y, r + 9, 0, 7); ctx.stroke();
        ctx.globalAlpha = a;
      }
    } else {
      /* 普通节点: 高连接者径向渐变(亮核→色缘), 其余平涂; 统一细描边勾轮廓 */
      if (!fossil && n.deg! >= 9) {
        const ng = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, r * 0.08, x, y, r);
        ng.addColorStop(0, "#f0ead8");
        ng.addColorStop(0.42, base);
        ng.addColorStop(1, base);
        ctx.fillStyle = ng;
      } else {
        ctx.fillStyle = base;
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(9,14,23,0.5)";
      ctx.lineWidth = 1; ctx.stroke();
    }
    if (fossil) {
      ctx.strokeStyle = "#6b7688"; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (S.sel === n.id) {
      /* 选中: 柔光晕 + 双环 */
      const sg = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3.4);
      sg.addColorStop(0, "rgba(217,179,108,0.30)");
      sg.addColorStop(1, "rgba(217,179,108,0)");
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, 7); ctx.fill();
      ctx.strokeStyle = "#d9b36c"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, r + 5.5, 0, 7); ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(x, y, r + 9, 0, 7); ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = 1;
    }
    /* 星芒衍射: 域节点与高连接"亮星"的十字微芒(天文图语言; 仅放大到一定尺寸才画,
     * 控制每帧渐变数量; 选中节点恒有) */
    const spiked =
      (n.t === "Domain" || (!fossil && n.t !== "Topic" && n.deg! >= 12)) && r > 4.5;
    if (spiked || S.sel === n.id) {
      const L = r * (S.sel === n.id ? 3.4 : 2.5);
      const fade = (a0: number) => {
        const lg = ctx.createLinearGradient(x - L, y, x + L, y);
        lg.addColorStop(0, hexA(base, 0));
        lg.addColorStop(0.5, hexA(base, a0));
        lg.addColorStop(1, hexA(base, 0));
        return lg;
      };
      ctx.globalAlpha = a;
      ctx.lineWidth = 1;
      ctx.strokeStyle = fade(focus && !involved ? 0.10 : 0.55);
      ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.stroke();
      const vg2 = ctx.createLinearGradient(x, y - L, x, y + L);
      vg2.addColorStop(0, hexA(base, 0));
      vg2.addColorStop(0.5, hexA(base, focus && !involved ? 0.10 : 0.55));
      vg2.addColorStop(1, hexA(base, 0));
      ctx.strokeStyle = vg2;
      ctx.beginPath(); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke();
    }

    /* 标签 */
    const wantLabel =
      S.sel === n.id || S.hov === n.id ||
      (S.k > 0.06 && n.t === "Domain") ||
      (S.k > 0.3 && n.t === "Field" && n.deg! >= 4) ||
      (S.k > 0.9 && n.deg! >= 6) ||
      (S.k > 1.35 && n.t !== "Topic");
    if (wantLabel) {
      ctx.globalAlpha = focus && !involved ? 0.15 : (fossil ? 0.55 : 0.9);
      ctx.fillStyle = fossil ? "#8b97a8" : (n.t === "Domain" ? "#ffd166" : n.t === "Topic" ? "#8d99ac" : "#cfd6e0");
      ctx.font = n.t === "Domain" ? 'bold 15px Georgia,"Songti SC",serif' : '11px "Segoe UI","Microsoft YaHei",sans-serif';
      /* 域名与选中节点标签加投影增可读性(数量少, 无性能压力) */
      if (n.t === "Domain" || S.sel === n.id || S.hov === n.id) {
        ctx.shadowColor = "rgba(8,12,20,0.95)"; ctx.shadowBlur = 4;
        ctx.fillText(n.zh, x, y + r + 13);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillText(n.zh, x, y + r + 13);
      }
      /* 域名: 衬线中文 + 英文小字副题(测绘图注记语言) */
      if (n.t === "Domain" && (!focus || involved)) {
        try { (ctx as any).letterSpacing = "1.5px"; } catch { /* 无 letterSpacing 支持则跳过 */ }
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#8b97a8";
        ctx.font = '9.5px Georgia,"Segoe UI",serif';
        if (n.en) ctx.fillText(n.en.toUpperCase(), x, y + r + 27);
        try { (ctx as any).letterSpacing = "0px"; } catch { /* noop */ }
      }
      ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- 主循环 ---------- */
let _fpsN = 0, _fpsT = 0;
/* 脏标记伴随变量 (js/app.js:608 的 lastHov/lastSel; forceDraw 本体在 state) */
let lastHov: string | null = null, lastSel: string | null = null;
export function tick() {
  requestAnimationFrame(tick);
  _fpsN++;
  const now = performance.now();
  if (now - _fpsT > 2000) {
    if (process.env.NODE_ENV !== "production" && _fpsT) console.log("FPS:", Math.round(_fpsN / (now - _fpsT) * 1000), "nodes:", NODES_.length);
    _fpsN = 0; _fpsT = now;
  }
  /* 自愈: 布局尺寸与记录不符时重测(启动时序/窗口变化) */
  const cv = _cv!;
  if (cv.clientWidth !== canvasSize.W || cv.clientHeight !== canvasSize.H) {
    const wasZero = canvasSize.W === 0;
    resize();
    if (wasZero && !S.userMoved) {
      S.k = 0.13; S.tx = canvasSize.W / 2; S.ty = canvasSize.H / 2;
      if (S.sel) S.needFly = S.sel;
    }
  }
  if (S.needFly && canvasSize.W > 0) { const fid = S.needFly; S.needFly = null; flyTo(fid); }
  if (S.view !== "map") { setForceDraw(true); return; }
  if (S.playing) {
    /* 基于真实时间沿分段年代尺重放, 不受 rAF 节流影响 */
    const done = Math.min(1, (performance.now() - S.playT0) / S.playDur);
    S.year = sliderToYear(done * 1000);
    if (onTimeSync) onTimeSync();      /* syncTimeUI(): TimeBar(T8) 注册 */
    if (Math.random() < 0.3) reheat(0.09);
    if (done >= 1) { if (onStopPlay) onStopPlay(); }   /* stopPlay(): TimeBar(T8) 注册 */
  }
  if (S.cam) {
    const t = (performance.now() - S.cam.t0) / S.cam.dur;
    if (t >= 1) {
      S.k = S.cam.k1; S.tx = S.cam.tx1; S.ty = S.cam.ty1; S.cam = null;
    } else {
      const u = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      S.k = S.cam.k0 + (S.cam.k1 - S.cam.k0) * u;
      S.tx = S.cam.tx0 + (S.cam.tx1 - S.cam.tx0) * u;
      S.ty = S.cam.ty0 + (S.cam.ty1 - S.cam.ty0) * u;
    }
  }
  const active = simAlpha() > 0.025 || S.cam || S.playing;
  if (!active) sendSimStop();   /* 空闲: 挂起 Worker(停 pos 心跳→不再触发重绘); reheat 等消息自动唤醒 */
  if (S.hov !== lastHov || S.sel !== lastSel) { lastHov = S.hov; lastSel = S.sel; setForceDraw(true); }
  if (!simWorkerActive() && active) step();   /* Worker 不可用时降级到主线程 */
  if (active || getForceDraw()) { draw(); setForceDraw(false); }
}

/* ---------- 相机 ---------- */
export function zoomAt(mx: number, my: number, f: number) {
  const k2 = Math.min(6, Math.max(0.18, S.k * f));
  const real = k2 / S.k;
  S.tx = mx - (mx - S.tx) * real;
  S.ty = my - (my - S.ty) * real;
  S.k = k2;
}
export function flyTo(id: string, targetK?: number) {
  const n = byId[id]; if (!n) return;
  const k1 = targetK || Math.max(S.k, 1.5);
  const W = canvasSize.W, H = canvasSize.H;
  /* 概念卡打开时, 居中于面板左侧的可见区域 */
  const pw = (panelEl && !panelEl.hidden && W > 860) ? 380 : 0;
  const cx = (W - pw) / 2, cy = H / 2;
  if (REDUCED) { S.k = k1; S.tx = cx - P.x[n.idx!] * k1; S.ty = cy - P.y[n.idx!] * k1; return; }
  S.cam = {
    t0: performance.now(), dur: 700,
    k0: S.k, k1: k1,
    tx0: S.tx, ty0: S.ty,
    tx1: cx - P.x[n.idx!] * k1, ty1: cy - P.y[n.idx!] * k1
  };
}

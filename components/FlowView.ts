/* 成熟度河流视图(桑基管道画布)。搬运自 js/app.js:1212-1362, 函数体逐字保留。
 * 改动点:
 *  - heatColor(源码 1212-1219)已在 lib/theme.ts(T5 为 draw() 搬入), 此处 import 复用不重复定义;
 *    本模块其余函数均未直接调用 heatColor, 故不引入。
 *  - 元素引用 flowCv/fctx(源码 1148-1149 顶层)改为模块级 _flowCv/_fctx(initFlow 填充) +
 *    函数体首行 const 别名——模块顶层禁止 document 访问(SSG 会炸)。
 *  - 源码顶层的 flowCv 指针事件注册(1255-1276)收进 initFlow()(带 inited 守卫, AtlasMap boot 调用)。
 *  - T5 遗留接线: render.resize 的 onResize 回调注册 setOnResize(() => { if (flowBuilt) drawFlow(); })
 *    对应源码 js/app.js:87。
 *  - 路由接线: viewBuilders.flow 对应源码 switchView 的 "if (v === 'flow') buildFlow()"
 *    (js/app.js:1090), router.switchView 经注册表调用。
 *  - 类型驱动微调: FLOW.geom 加 ! 断言(drawFlow 仅在 buildFlow 之后可达)、悬停命中比较
 *    "hit !== flowHover"(节点对象 vs id 字符串, 源码恒真)改写为等价的
 *    "(hit ? hit.id : null) !== flowHover"、tooltip/parentElement 断言——语义与源码一致。
 */
import { E, NODES_, byId } from "../lib/state";
import type { GraphEdge, GraphNode } from "../lib/types";
import { flyTo, setOnResize, drawStars, drawVignette } from "../lib/render";
import { viewBuilders } from "../lib/router";
import { select } from "./ConceptPanel";

/* heatColor(生长热力着色)见 lib/theme.ts —— 源码 1212-1219, T5 已搬入 */

/* ---------- 河流视图: 成熟度管道(桑基图) ---------- */
const STAGES = [
  { zh: "知识 · 理论与概念", color: "#82aaff", types: ["Theory", "Proposition", "Concept"] },
  { zh: "方法", color: "#c792ea", types: ["Method", "Skill"] },
  { zh: "工艺", color: "#4ecdc4", types: ["Process"] },
  { zh: "技术 · 工具与材料", color: "#5fd68a", types: ["Technology", "Instrument", "Material", "Dataset"] },
  { zh: "产品", color: "#f5e663", types: ["Product"] }
];
const stageOf: Record<string, number> = {};
STAGES.forEach((s, i) => s.types.forEach(t => { stageOf[t] = i; }));
/* 模块级画布引用(命名加下划线, 供函数体内 const flowCv = _flowCv! 一行别名后逐字使用源码函数体) */
let _flowCv: HTMLCanvasElement | null = null;
let _fctx: CanvasRenderingContext2D | null = null;
let flowBuilt = false, flowHover: string | null = null;
interface FlowBand { n: GraphNode; si: number; w: number; y0: number; h: number; mean: number[] }
interface FlowLink { e: GraphEdge; a: FlowBand; b: FlowBand }
interface FlowGeom { X0: number; XGAP: number; BAND: number; TOP: number; BOT: number }
const FLOW: { W: number; H: number; cols: FlowBand[][]; links: FlowLink[]; bandOf: Record<string, FlowBand>; geom: FlowGeom | null } = { W: 1520, H: 700, cols: [], links: [], bandOf: {}, geom: null };

function buildFlow() {
  if (flowBuilt) { drawFlow(); return; }
  flowBuilt = true;
  const cross = E.filter(e => stageOf[byId[e.from].t] != null && stageOf[byId[e.to].t] != null &&
    stageOf[byId[e.from].t] !== stageOf[byId[e.to].t]);
  const part = new Set<string>();
  cross.forEach(e => { part.add(e.from); part.add(e.to); });
  FLOW.cols = STAGES.map((s, si) =>
    NODES_.filter(n => stageOf[n.t] === si && part.has(n.id))
      .sort((a, b) => (a.born || 9999) - (b.born || 9999))
      .map(n => ({ n, si, w: 0, y0: 0, h: 0, mean: [] as number[] })));
  FLOW.bandOf = {};
  FLOW.cols.forEach(col => col.forEach(b => { FLOW.bandOf[b.n.id] = b; }));
  for (const e of cross) {
    FLOW.bandOf[e.from].w += e.w;
    FLOW.bandOf[e.to].w += e.w;
  }
  const X0 = 170, XGAP = 295, BAND = 30, TOP = 90, BOT = 650;
  function layout() {
    FLOW.cols.forEach(col => {
      const tot = col.reduce((s, b) => s + b.w, 0) || 1;
      const scale = Math.max((BOT - TOP - col.length * 5) / tot, 0.02);
      let y = TOP;
      col.forEach(b => { b.h = Math.min(46, Math.max(5, b.w * scale)); b.y0 = y; y += b.h + 5; });
    });
  }
  layout();
  for (const e of cross) {
    const a = FLOW.bandOf[e.from], b = FLOW.bandOf[e.to];
    a.mean.push(b.y0 + b.h / 2); b.mean.push(a.y0 + a.h / 2);
  }
  FLOW.cols.forEach(col => {
    if (!col.length) return;
    col.sort((x, y) => (x.mean.reduce((s, v) => s + v, 0) / x.mean.length) - (y.mean.reduce((s, v) => s + v, 0) / y.mean.length));
  });
  layout();
  FLOW.links = cross.map(e => ({ e, a: FLOW.bandOf[e.from], b: FLOW.bandOf[e.to] }));
  FLOW.geom = { X0, XGAP, BAND, TOP, BOT };
  drawFlow();
}
function drawFlow() {
  const flowCv = _flowCv!;
  const fctx = _fctx!;
  const rect = flowCv.parentElement!.getBoundingClientRect();
  const cw = rect.width, ch = rect.height;
  const DPR2 = Math.min(window.devicePixelRatio || 1, 2);
  flowCv.width = cw * DPR2; flowCv.height = ch * DPR2;
  const k = Math.min(cw / FLOW.W, ch / FLOW.H);
  fctx.setTransform(DPR2, 0, 0, DPR2, 0, 0);
  /* 深空底幕: 与星图共用星野层 */
  drawStars(fctx, cw, ch);
  fctx.translate((cw - FLOW.W * k) / 2, (ch - FLOW.H * k) / 2);
  fctx.scale(k, k);
  const g = FLOW.geom!;
  /* 彩带: 起讫阶段色沿程渐变(知识如何"流向"技术); 悬停时聚焦辉光 */
  for (const L of FLOW.links) {
    const a = L.a, b = L.b;
    const x1 = g.X0 + a.si * g.XGAP + g.BAND, x2 = g.X0 + b.si * g.XGAP;
    const y1 = a.y0 + a.h / 2, y2 = b.y0 + b.h / 2;
    const hot = flowHover && (a.n.id === flowHover || b.n.id === flowHover);
    const rg = fctx.createLinearGradient(x1, 0, x2, 0);
    rg.addColorStop(0, STAGES[a.si].color);
    rg.addColorStop(1, STAGES[b.si].color);
    fctx.strokeStyle = rg;
    if (hot) { fctx.shadowColor = STAGES[a.si].color; fctx.shadowBlur = 6; }
    fctx.globalAlpha = flowHover ? (hot ? 0.9 : 0.06) : 0.26;
    fctx.lineWidth = 1.2 + L.e.w * 4.5;
    fctx.beginPath();
    fctx.moveTo(x1, y1);
    fctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2);
    fctx.stroke();
    fctx.shadowBlur = 0;
  }
  fctx.globalAlpha = 1;
  /* 阶段列与节点段 */
  fctx.font = '14px Georgia,"Songti SC","SimSun",serif';
  fctx.textAlign = "center";
  FLOW.cols.forEach((col, si) => {
    const x = g.X0 + si * g.XGAP;
    const colH = g.BOT - g.TOP + 16;
    /* 列身: 阶段色薄雾纵渐变 */
    const colBg = fctx.createLinearGradient(0, g.TOP - 8, 0, g.BOT + 8);
    colBg.addColorStop(0, "rgba(96,132,184,0.07)");
    colBg.addColorStop(1, "rgba(96,132,184,0.02)");
    fctx.fillStyle = colBg;
    fctx.fillRect(x, g.TOP - 8, g.BAND, colH);
    fctx.fillStyle = STAGES[si].color;
    fctx.globalAlpha = 0.95;
    fctx.shadowColor = "rgba(8,12,20,0.9)"; fctx.shadowBlur = 4;
    fctx.fillText(STAGES[si].zh, x + g.BAND / 2, g.TOP - 34);
    fctx.shadowBlur = 0;
    fctx.globalAlpha = 0.5;
    fctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
    fctx.fillText(col.length + " 个在管道中的节点", x + g.BAND / 2, g.TOP - 16);
    fctx.font = '14px Georgia,"Songti SC","SimSun",serif';
    fctx.globalAlpha = 1;
    fctx.strokeStyle = "rgba(60,80,110,0.35)";
    fctx.strokeRect(x, g.TOP - 8, g.BAND, colH);
    /* 顶/底黄铜刻度帽 */
    fctx.strokeStyle = "rgba(217,179,108,0.55)";
    fctx.beginPath();
    fctx.moveTo(x, g.TOP - 8); fctx.lineTo(x + g.BAND, g.TOP - 8);
    fctx.moveTo(x, g.BOT + 8); fctx.lineTo(x + g.BAND, g.BOT + 8);
    fctx.stroke();
    for (const b of col) {
      const hot = flowHover === b.n.id;
      /* 节点段: 阶段色纵渐变(上亮下暗, 玉带质感) */
      const bandGrad = fctx.createLinearGradient(0, b.y0, 0, b.y0 + b.h);
      bandGrad.addColorStop(0, STAGES[si].color);
      bandGrad.addColorStop(1, "rgba(30,42,62,0.9)");
      fctx.fillStyle = bandGrad;
      fctx.globalAlpha = flowHover && !hot ? 0.25 : 0.92;
      fctx.fillRect(x, b.y0, g.BAND, b.h);
      if (hot) {
        fctx.shadowColor = STAGES[si].color; fctx.shadowBlur = 8;
        fctx.strokeStyle = "#d9b36c"; fctx.lineWidth = 1.5;
        fctx.strokeRect(x - 2, b.y0 - 2, g.BAND + 4, b.h + 4);
        fctx.shadowBlur = 0;
        fctx.lineWidth = 1;
        fctx.fillStyle = "#e8e3d5";
        fctx.font = '12px "Segoe UI","Microsoft YaHei",sans-serif';
        fctx.textAlign = si < 2 ? "left" : "right";
        fctx.fillText(b.n.zh, si < 2 ? x + g.BAND + 8 : x - 8, b.y0 + b.h / 2 + 4);
        fctx.textAlign = "center";
        fctx.font = '14px Georgia,"Songti SC","SimSun",serif';
      }
    }
  });
  fctx.globalAlpha = 1;
  /* 暗角收束(屏幕空间) */
  fctx.setTransform(DPR2, 0, 0, DPR2, 0, 0);
  drawVignette(fctx, cw, ch);
}

let inited = false;
export function initFlow() {
  if (inited) return;   /* dev StrictMode 双挂载守卫 */
  inited = true;
  const flowCv = document.getElementById("flowCv") as HTMLCanvasElement;
  const fctx = flowCv.getContext("2d");
  _flowCv = flowCv; _fctx = fctx;
  flowCv.addEventListener("mousemove", ev => {
    if (!flowBuilt) return;
    const rect = flowCv.getBoundingClientRect();
    const k = Math.min(rect.width / FLOW.W, rect.height / FLOW.H);
    const wx = (ev.clientX - rect.left - (rect.width - FLOW.W * k) / 2) / k;
    const wy = (ev.clientY - rect.top - (rect.height - FLOW.H * k) / 2) / k;
    const g = FLOW.geom!;
    let hit: GraphNode | null = null;
    for (const col of FLOW.cols) for (const b of col) {
      const x = g.X0 + b.si * g.XGAP;
      if (wx >= x && wx <= x + g.BAND && wy >= b.y0 && wy <= b.y0 + b.h) { hit = b.n; break; }
    }
    if ((hit ? hit.id : null) !== flowHover) { flowHover = hit ? hit.id : null; drawFlow(); }   /* 源码 "hit !== flowHover"(恒真)的等价改写 */
    const tip = document.getElementById("tooltip") as HTMLElement;
    if (hit) {
      tip.hidden = false;
      tip.style.left = (ev.clientX + 14) + "px"; tip.style.top = (ev.clientY + 12) + "px";
      tip.innerHTML = "<b>" + hit.zh + "</b><span class='tt-type'>" + STAGES[stageOf[hit.t]].zh + " · " + (hit.born || "?") + " 年 · 单击看概念卡</span>";
    } else tip.hidden = true;
  });
  flowCv.addEventListener("mouseleave", () => { flowHover = null; (document.getElementById("tooltip") as HTMLElement).hidden = true; if (flowBuilt) drawFlow(); });
  flowCv.addEventListener("click", () => { if (flowHover) { select(flowHover); flyTo(flowHover); } });
  setOnResize(() => { if (flowBuilt) drawFlow(); });   /* T5 遗留接线 (js/app.js:87) */
  viewBuilders.flow = () => { initFlow(); buildFlow(); };   /* js/app.js:1090 */
}

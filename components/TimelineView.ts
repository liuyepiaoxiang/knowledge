/* 长时段时间轴视图(画布: 密度概览 + 策展点 + 按需展开)。搬运自 js/app.js:977-1161, 函数体逐字保留。
 * 改动点:
 *  - 元素引用 tlCv/tctx(源码 998-999 顶层)移入函数体——模块顶层禁止 document 访问(SSG 会炸);
 *    tlCv._dpr 经 TlCanvas 交叉类型标注。
 *  - 源码顶层的 tlCv 指针事件注册(1114-1156)、tlScroll scroll 监听(1157)、window resize 监听(1158)
 *    收进 initTimeline()(带 inited 守卫, AtlasMap boot 调用)。
 *  - T8 遗留接线: TimeBar.setOnTlCursor(updateTimelineCursor) 对应源码 syncTimeUI 末行
 *    "if (tlBuilt) updateTimelineCursor()"(js/app.js:859)。
 *  - 路由接线: viewBuilders.timeline 对应源码 switchView 的 "if (v === 'timeline') buildTimeline()"
 *    (js/app.js:1173), router.switchView 经注册表调用。
 *  - 类型驱动微调: all 的 filter 加类型谓词(born 收窄为 number)、sort 比较式布尔减法改 Number()
 *    (TS 不允许 boolean 算术)、deg!/显式 cast——语义与源码一致。
 */
import { DOMAINS_, NODES_, S } from "../lib/state";
import type { Domain, GraphNode } from "../lib/types";
import { isFossil } from "../lib/graph";
import { TYPES } from "../lib/theme";
import { select } from "./ConceptPanel";
import { setOnTlCursor } from "./TimeBar";
import { viewBuilders } from "../lib/router";
import { mulberry32, nebulaTint } from "../lib/render";

type TlCanvas = HTMLCanvasElement & { _dpr?: number };
type TlNode = GraphNode & { born: number };
interface TlLane { d: Domain; all: TlNode[]; curated: TlNode[]; bins: number[]; maxBin: number }

/* ---------- 时间轴视图(画布: 密度概览 + 策展点 + 按需展开) ---------- */
const TL_ANCHORS = [[-8000, 60], [-4000, 300], [-2000, 540], [-500, 820], [0, 950], [500, 1110], [1000, 1290], [1500, 1570], [1700, 1950], [1800, 2240], [1850, 2420], [1900, 2650], [1950, 2960], [2000, 3290], [2026, 4180]];
function xFor(y: number): number {
  const cy = Math.max(y, -8000);
  for (let i = 1; i < TL_ANCHORS.length; i++) {
    if (cy <= TL_ANCHORS[i][0]) {
      const [y0, x0] = TL_ANCHORS[i - 1], [y1, x1] = TL_ANCHORS[i];
      return x0 + (x1 - x0) * (cy - y0) / (y1 - y0);
    }
  }
  return TL_ANCHORS[TL_ANCHORS.length - 1][1];
}
function xToYear(x: number): number {
  for (let i = 1; i < TL_ANCHORS.length; i++) {
    if (x <= TL_ANCHORS[i][1]) {
      const [y0, x0] = TL_ANCHORS[i - 1], [y1, x1] = TL_ANCHORS[i];
      return Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
    }
  }
  return 2026;
}
let tlBuilt = false, tlData: { lanes: TlLane[] } | null = null, tlQueued = false;
const TL = { W: 4260, LANE_H: 72, BIN: 20 };

/* 长卷星野: 一次性离屏预渲染(与星图同一深空语言), 每次重绘仅 1 次 drawImage */
let tlStarCv: HTMLCanvasElement | null = null;
function ensureTlStars(W: number, H: number): HTMLCanvasElement {
  if (tlStarCv && tlStarCv.width === W && tlStarCv.height === H) return tlStarCv;
  tlStarCv = document.createElement("canvas");
  tlStarCv.width = W; tlStarCv.height = H;
  const c = tlStarCv.getContext("2d")!;
  const rnd = mulberry32(18891028);   /* 稳定种子: 长卷与星图各自独立星空 */
  const n = Math.round(W * H / 2600);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H, r = 0.3 + rnd() * 0.7;
    const roll = rnd();
    const col = roll > 0.86 ? "232,217,176" : roll > 0.76 ? "159,192,255" : "205,216,230";
    c.fillStyle = "rgba(" + col + "," + (0.06 + rnd() * 0.28).toFixed(2) + ")";
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  return tlStarCv;
}

function gradeOf(n: GraphNode) { return (n.ev && n.ev[0]) || "C"; }

function buildTimeline() {
  if (tlBuilt) { queueTlDraw(); return; }
  tlBuilt = true;
  tlData = { lanes: DOMAINS_.map(d => {
    const all = NODES_.filter((n): n is TlNode => n.dom === d.id && n.t !== "Domain" && n.born != null)
                      .sort((a, b) => a.born - b.born);
    return { d, all, curated: all.filter(n => gradeOf(n) !== "C") };
  }) as TlLane[] };
  tlData.lanes.forEach(L => {
    L.bins = new Array(Math.ceil(TL.W / TL.BIN)).fill(0);
    for (const n of L.all) {
      const b = Math.min(L.bins.length - 1, Math.floor(xFor(n.born) / TL.BIN));
      L.bins[b]++;
    }
    L.maxBin = Math.max(1, ...L.bins);
  });
  sizeTl();
  (document.getElementById("tlScroll") as HTMLElement).scrollLeft = 1980;   /* 画布定宽后再定位: 约 1750-2026 密集区 */
}
function sizeTl() {
  const tlCv = document.getElementById("tlCv") as TlCanvas;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const H = tlData!.lanes.length * TL.LANE_H + 46;
  tlCv.width = TL.W * DPR; tlCv.height = H * DPR;
  tlCv.style.width = TL.W + "px"; tlCv.style.height = H + "px";
  tlCv._dpr = DPR;
  queueTlDraw();
}
function queueTlDraw() {
  if (tlQueued) return;
  tlQueued = true;
  requestAnimationFrame(() => { tlQueued = false; drawTimeline(); });
}
function drawTimeline() {
  if (!tlBuilt || !tlData) return;
  const tlCv = document.getElementById("tlCv") as TlCanvas;
  const tctx = tlCv.getContext("2d") as CanvasRenderingContext2D;
  const DPR = tlCv._dpr || 1;
  const lanes = tlData.lanes;
  const H = lanes.length * TL.LANE_H + 46;
  const scroll = (document.getElementById("tlScroll") as HTMLElement).scrollLeft;
  tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  /* 深空底幕 + 长卷星野(离屏一次) */
  tctx.fillStyle = "#0b111c"; tctx.fillRect(0, 0, TL.W, H);
  tctx.drawImage(ensureTlStars(TL.W, H), 0, 0);
  const cursorX = xFor(S.year);
  /* 年代刻度竖参考线(贯穿全高, 海图经线) */
  const TICKS = [-8000, -4000, -2000, -500, 0, 500, 1000, 1500, 1700, 1800, 1900, 1950, 2000, 2026];
  tctx.strokeStyle = "rgba(96,132,184,0.10)"; tctx.lineWidth = 1;
  tctx.beginPath();
  TICKS.forEach(t => { const x = xFor(t); tctx.moveTo(x, 0); tctx.lineTo(x, lanes.length * TL.LANE_H + 8); });
  tctx.stroke();
  lanes.forEach((L, li) => {
    const y0 = 6 + li * TL.LANE_H;
    const tint = nebulaTint(L.d.id);   /* 泳道色调 = 星图同域大陆星云色 */
    tctx.fillStyle = li % 2 ? "rgba(23,33,52,0.5)" : "rgba(19,28,45,0.5)";
    tctx.fillRect(0, y0, TL.W, TL.LANE_H);
    tctx.fillStyle = "rgba(" + tint + ",0.045)";
    tctx.fillRect(0, y0, TL.W, TL.LANE_H);
    /* 密度直方: 域色调纵渐变, 顶亮底隐 */
    for (let b = 0; b < L.bins.length; b++) {
      if (!L.bins[b]) continue;
      const bx = b * TL.BIN;
      const h = Math.min(TL.LANE_H - 12, L.bins[b] / L.maxBin * (TL.LANE_H - 16));
      const grad = tctx.createLinearGradient(0, y0 + TL.LANE_H - 4 - h, 0, y0 + TL.LANE_H - 4);
      grad.addColorStop(0, "rgba(" + tint + ",0.78)");
      grad.addColorStop(1, "rgba(" + tint + ",0.12)");
      tctx.globalAlpha = bx > cursorX ? 0.14 : 0.6;
      tctx.fillStyle = grad;
      tctx.fillRect(bx + 2, y0 + TL.LANE_H - 4 - h, TL.BIN - 4, h);
    }
    tctx.globalAlpha = 1;
    let lastLabel = -1e9;
    for (const n of L.curated) {
      const x = xFor(n.born), y = y0 + TL.LANE_H * 0.42;
      const future = n.born > S.year, fossil = isFossil(n);
      tctx.globalAlpha = future ? 0.15 : 1;
      const col = fossil ? "#57627a" : TYPES[n.t].color;
      /* 高连接亮星: 微光晕 + 十字微芒(星图语言) */
      if (!future && !fossil && n.deg! >= 9 && n.t !== "Event") {
        const gl = tctx.createRadialGradient(x, y, 0.5, x, y, 7);
        gl.addColorStop(0, "rgba(232,217,176,0.5)");
        gl.addColorStop(1, "rgba(232,217,176,0)");
        tctx.fillStyle = gl;
        tctx.beginPath(); tctx.arc(x, y, 7, 0, 7); tctx.fill();
      }
      tctx.fillStyle = col;
      if (n.t === "Event") {
        tctx.save(); tctx.translate(x, y); tctx.rotate(Math.PI / 4);
        tctx.fillRect(-3.6, -3.6, 7.2, 7.2);
        tctx.strokeStyle = "rgba(9,14,23,0.6)"; tctx.lineWidth = 1; tctx.strokeRect(-3.6, -3.6, 7.2, 7.2);
        tctx.restore();
      } else {
        tctx.beginPath(); tctx.arc(x, y, 3.8, 0, 7); tctx.fill();
        tctx.strokeStyle = "rgba(9,14,23,0.6)"; tctx.lineWidth = 1; tctx.stroke();
      }
      if ((n.t === "Event" || n.t === "Person" || n.deg! >= 9) && x - lastLabel > 66 && !future) {
        tctx.font = "10px 'Segoe UI','Microsoft YaHei',sans-serif";
        tctx.textAlign = "center";
        tctx.shadowColor = "rgba(8,12,20,0.9)"; tctx.shadowBlur = 3;
        tctx.fillStyle = fossil ? "#71809a" : "#c2cbd9";
        tctx.fillText(n.zh, x, y - 9);
        tctx.shadowBlur = 0;
        lastLabel = x + n.zh.length * 10.5;
      }
      tctx.globalAlpha = 1;
    }
  });
  /* 年代游标: 黄铜辉光竖线 + 顶端年份标 */
  const cx = xFor(S.year);
  tctx.shadowColor = "rgba(217,179,108,0.8)"; tctx.shadowBlur = 6;
  tctx.strokeStyle = "#d9b36c"; tctx.globalAlpha = 0.8; tctx.lineWidth = 1;
  tctx.beginPath(); tctx.moveTo(cx, 0); tctx.lineTo(cx, lanes.length * TL.LANE_H + 8); tctx.stroke();
  tctx.shadowBlur = 0;
  tctx.globalAlpha = 1; tctx.lineWidth = 1;
  tctx.font = "12px Georgia,'Songti SC','SimSun',serif"; tctx.textAlign = "left";
  lanes.forEach((L, li) => {
    /* 域名签: 黄铜左规 + 半透明底, 与星图域注记同语言 */
    tctx.fillStyle = "rgba(11,17,28,0.88)";
    tctx.fillRect(scroll + 2, 6 + li * TL.LANE_H, 96, TL.LANE_H - 4);
    tctx.fillStyle = "rgba(217,179,108,0.7)";
    tctx.fillRect(scroll + 2, 6 + li * TL.LANE_H + 8, 2, TL.LANE_H - 20);
    tctx.fillStyle = "#d9b36c";
    tctx.fillText(L.d.zh, scroll + 10, 6 + li * TL.LANE_H + TL.LANE_H / 2 + 4);
  });
  tctx.font = "11px Georgia,serif"; tctx.textAlign = "center"; tctx.fillStyle = "#7a8698";
  const ay = lanes.length * TL.LANE_H + 30;
  TICKS.forEach(t => {
    const x = xFor(t);
    tctx.fillText(t < 0 ? "前" + (-t) : (t === 0 ? "元年" : "" + t), x, ay);
    tctx.fillRect(x - 0.5, ay - 16, 1, 6);
  });
}
function tlHit(ev: MouseEvent) {
  const tlCv = document.getElementById("tlCv") as TlCanvas;
  const rect = tlCv.getBoundingClientRect();
  const ox = ev.clientX - rect.left, oy = ev.clientY - rect.top - 6;
  const li = Math.floor(oy / TL.LANE_H);
  if (li < 0 || li >= tlData!.lanes.length) return null;
  const L = tlData!.lanes[li];
  let best: TlNode | null = null, bestD = 10;
  for (const n of L.curated) {
    const d = Math.abs(xFor(n.born) - ox);
    if (d < bestD) { bestD = d; best = n; }
  }
  const bin = Math.max(0, Math.min(L.bins.length - 1, Math.floor(ox / TL.BIN)));
  return { L, li, bin, node: best, year0: xToYear(bin * TL.BIN), year1: xToYear(bin * TL.BIN + TL.BIN) };
}
function closeTlPop() { const p = document.getElementById("tlPop"); if (p) { p.hidden = true; p.innerHTML = ""; } }

let inited = false;
export function initTimeline() {
  if (inited) return;   /* dev StrictMode 双挂载守卫 */
  inited = true;
  const tlCv = document.getElementById("tlCv") as TlCanvas;
  tlCv.addEventListener("mousemove", ev => {
    if (!tlBuilt) return;
    const hit = tlHit(ev);
    const tip = document.getElementById("tooltip") as HTMLElement;
    if (!hit) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.style.left = (ev.clientX + 14) + "px"; tip.style.top = (ev.clientY + 12) + "px";
    if (hit.node) {
      const n = hit.node;
      tip.innerHTML = "<b>" + n.zh + "</b><span class='tt-type'>" + TYPES[n.t].zh + " · " +
        (n.born < 0 ? "前" + (-n.born) : n.born) + " 年 · 单击开概念卡</span>";
    } else {
      const c = hit.L.bins[hit.bin];
      tip.innerHTML = "<b>" + (hit.year0 < 0 ? "前" + (-hit.year0) : hit.year0) + " — " +
        (hit.year1 < 0 ? "前" + (-hit.year1) : hit.year1) + " 年</b><span class='tt-type'>" +
        hit.L.d.zh + " · " + c + " 个节点 · 单击展开清单</span>";
    }
  });
  tlCv.addEventListener("mouseleave", () => { (document.getElementById("tooltip") as HTMLElement).hidden = true; });
  tlCv.addEventListener("click", ev => {
    if (!tlBuilt) return;
    closeTlPop();
    const hit = tlHit(ev);
    if (!hit) return;
    if (hit.node) { select(hit.node.id); return; }
    const y0 = hit.year0, y1 = hit.year1;
    const inBin = hit.L.all.filter(n => { const x = xFor(n.born); return x >= hit.bin * TL.BIN && x < (hit.bin + 1) * TL.BIN; })
                           .sort((a, b) => (Number(gradeOf(a) !== "C") - Number(gradeOf(b) !== "C")) || (a.born - b.born));
    if (!inBin.length) return;   /* 空时段不弹清单 */
    const pop = document.getElementById("tlPop") as HTMLElement;
    pop.style.left = Math.min(ev.clientX, window.innerWidth - 330) + "px";
    pop.style.top = Math.min(ev.clientY, window.innerHeight - 300) + "px";
    const yr = (y0 < 0 ? "前" + (-y0) : y0) + " — " + (y1 < 0 ? "前" + (-y1) : y1);
    pop.innerHTML = "<h5>" + hit.L.d.zh + " · " + yr + " · " + inBin.length + " 个节点</h5>" +
      inBin.slice(0, 60).map(n =>
        '<a data-go="' + n.id + '"><i class="dot" style="background:' + (isFossil(n) ? "#57627a" : TYPES[n.t].color) +
        '"></i>' + n.zh + '<span class="tl-grad">' + gradeOf(n) + '</span></a>').join("") +
      (inBin.length > 60 ? "<div class='tl-more'>…其余 " + (inBin.length - 60) + " 个</div>" : "");
    pop.hidden = false;
    pop.querySelectorAll<HTMLElement>("[data-go]").forEach(a => {
      a.onclick = () => { select(a.getAttribute("data-go")); closeTlPop(); };
    });
  });
  (document.getElementById("tlScroll") as HTMLElement).addEventListener("scroll", () => { closeTlPop(); queueTlDraw(); });
  window.addEventListener("resize", () => { if (tlBuilt) sizeTl(); });
  setOnTlCursor(updateTimelineCursor);   /* T8 遗留接线 (js/app.js:859) */
  viewBuilders.timeline = () => { initTimeline(); buildTimeline(); };   /* js/app.js:1173 */
}
function updateTimelineCursor() { if (tlBuilt) queueTlDraw(); }

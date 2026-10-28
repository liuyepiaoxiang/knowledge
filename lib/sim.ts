/* 力导向模拟: Web Worker 主路径 + 主线程回退。搬运自 js/app.js:135-299, 函数体逐字保留。
 * 改动点: Worker 路径 "/sim-worker.js"; state 单例从 ./state import; 消息加 TS 类型。
 */
import { DOMAIN_IDS, DOM_ANCHOR, E, NODES_, P, S, byId, setForceDraw } from "./state";
import { shownIdx } from "./graph";

/* Worker 消息协议 —— 与 public/sim-worker.js 的 onmessage 分支一一对应 */
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

let alpha = 1;
export function reheat(a: number) { alpha = Math.max(alpha, a); wakeWorker(); if (simWorker) simWorker.postMessage({ type: "reheat", alpha: a }); }

/* ===== Web Worker: 力导向模拟 ===== */
let simWorker: Worker | null = null;
let dynIdx: number[] = [];       /* 全局→局部索引映射 */
let workerReady = false;

export function createSimWorker(): boolean {
    try {
        simWorker = new Worker("/sim-worker.js");
        simWorker.onmessage = function(e: MessageEvent) {
            const m: any = e.data;
            if (m.type === "pos") {
                /* worker 回传局部索引数组(px/py 长度=dynIdx.length), 按 dynIdx 映射回全局位置池。
                 * 源码此处为 P.x.set(m.px) —— 普通数组无 .set 且全局/局部索引空间混用, 属源码 bug, 此处修正。 */
                for (let li = 0; li < m.px.length; li++) {
                    const gi = dynIdx[li];
                    P.x[gi] = m.px[li];
                    P.y[gi] = m.py[li];
                }
                /* alpha 同步: Worker 模式下主线程 step() 不跑, 主线程 alpha 需跟随 Worker 衰减,
                 * 否则 tick() 的 active 判定恒真 → 60fps 永续重绘(浏览器假死根因) */
                if (typeof m.alpha === "number") alpha = m.alpha;
                setForceDraw(true);
            }
        };
        simWorker.onerror = function(e: ErrorEvent) {
            console.warn("Worker error:", e.message);
            simWorker = null;   /* 降级到主线程模拟 */
        };
        return true;
    } catch (err) {
        console.warn("Worker 创建失败, 降级到主线程:", (err as Error).message);
        simWorker = null;
        return false;
    }
}

export function sendSimInit() {
    if (!simWorker) return;
    /* 收集非 Topic 节点。isTopic/domIdx 按局部索引空间构建(worker 的 px/py/fixed 均为局部)——
     * 源码按全局空间构建导致 worker 端错位, 属源码 bug, 此处修正: 局部节点全部为非 Topic。 */
    dynIdx = [];
    const dIdx: number[] = [];
    for (let i = 0; i < NODES_.length; i++) {
        const n = NODES_[i];
        if (shownIdx(i) && n.t !== "Topic") {
            dynIdx.push(i);
            dIdx.push(DOMAIN_IDS.indexOf(n.dom));
        }
    }
    const count = dynIdx.length;
    const isTopicLocal = new Uint8Array(count);
    const px = new Float32Array(count), py = new Float32Array(count);
    const fixed = new Uint8Array(count);
    for (let li = 0; li < count; li++) {
        const gi = dynIdx[li];
        px[li] = P.x[gi]; py[li] = P.y[gi];
        fixed[li] = P.fixed[gi] ? 1 : 0;
    }
    /* 边: 仅双端均为非 Topic */
    const eS: number[] = [], eD: number[] = [], eR: number[] = [], eK: number[] = [];
    for (const e of E) {
        const a = byId[e.from], b = byId[e.to];
        if (a.t === "Topic" || b.t === "Topic") continue;
        const li1 = dynIdx.indexOf(a.idx!), li2 = dynIdx.indexOf(b.idx!);
        /* 源码为 `li1 == null` —— indexOf 未命中返回 -1 而非 null, 恒假放行;
         * -1 经 Uint32Array 变成 4294967295, worker 弹簧力取 px[4e9]=undefined → NaN
         * 坐标回传 → 渐变/画布异常。属源码潜在 bug(worker 从未真正跑过), 此处修正 */
        if (li1 < 0 || li2 < 0) continue;
        eS.push(li1); eD.push(li2);
        eR.push(e.type === "part_of" ? 105 : (e.type === "marks" || e.type === "did" ? 95 : 175));
        eK.push(e.type === "part_of" ? 0.014 : (e.type === "marks" || e.type === "did" ? 0.016 : 0.03));
    }
    /* 域锚点 */
    const aX: number[] = [], aY: number[] = [];
    for (const d of DOMAIN_IDS) {
        aX.push(DOM_ANCHOR[d].x); aY.push(DOM_ANCHOR[d].y);
    }
    simWorker.postMessage({ type: "init", count: count,
        px: px, py: py, fixed: fixed,
        isTopic: isTopicLocal,
        domIdx: new Uint8Array(dIdx), nDomains: DOMAIN_IDS.length,
        ancX: new Float32Array(aX), ancY: new Float32Array(aY),
        edgeSrc: new Uint32Array(eS), edgeDst: new Uint32Array(eD),
        edgeRest: new Float32Array(eR), edgeK: new Float32Array(eK) });
    workerReady = true;
}

export function sendPin(idx: number) {
    if (simWorker && workerReady) {
        wakeWorker();
        const li = dynIdx.indexOf(idx);
        if (li >= 0) simWorker.postMessage({ type: "pin", idx: li, x: P.x[idx], y: P.y[idx] });
    }
}
export function sendUnpin(idx: number) {
    if (simWorker && workerReady) {
        wakeWorker();
        const li = dynIdx.indexOf(idx);
        if (li >= 0) simWorker.postMessage({ type: "unpin", idx: li });
    }
}
export function sendReheat(a: number) {
    if (simWorker && workerReady) simWorker.postMessage({ type: "reheat", alpha: a });
}
/** mergeExt 新增节点推送 (js/app.js:33-45 的 worker add 消息; 数组由 AtlasMap 按源码构建, 此处统一守卫) */
export function sendSimAdd(count: number, px: Float32Array, py: Float32Array, isTopic: Uint8Array, domIdx: Uint8Array): void {
    if (simWorker && workerReady) {
        wakeWorker();
        simWorker.postMessage({ type: "add", count: count, px: px, py: py, isTopic: isTopic, domIdx: domIdx });
    }
}
export function step() {
  const nodes = NODES_;
  const shown: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!shownIdx(i)) continue;
    if (nodes[i].t === "Topic") continue;   /* Topic 静态, 不进模拟 */
    shown.push(i);
  }
  /* 斥力: 按域分组, 仅同域内互斥 (跨域由锚点分离) */
  const byDom: Record<string, number[]> = {};
  for (const i of shown) {
    const d = nodes[i].dom || "_";
    if (!byDom[d]) byDom[d] = [];
    byDom[d].push(i);
  }
  for (const d in byDom) {
    const arr = byDom[d];
    for (let a = 0; a < arr.length; a++) {
      const i = arr[a];
      for (let b = a + 1; b < arr.length; b++) {
        const j = arr[b];
        let dx = P.x[i] - P.x[j], dy = P.y[i] - P.y[j];
        let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
        if (d2 > 660 * 660) continue;
        const dd = Math.sqrt(d2);
        const f = Math.min(5200 / d2, 2.6) * alpha;
        dx /= dd; dy /= dd;
        P.vx[i] += dx * f; P.vy[i] += dy * f;
        P.vx[j] -= dx * f; P.vy[j] -= dy * f;
      }
    }
  }
  /* 弹簧 */
  for (const e of E) {
    const i = byId[e.from].idx!, j = byId[e.to].idx!;
    if (nodes[i].t === "Topic" || nodes[j].t === "Topic") continue;
    if (!shownIdx(i) || !shownIdx(j)) continue;
    const rest = e.type === "part_of" ? 105 : (e.type === "marks" || e.type === "did" ? 95 : 175);
    const k = e.type === "part_of" ? 0.014 : (e.type === "marks" || e.type === "did" ? 0.016 : 0.03);
    let dx = P.x[j] - P.x[i], dy = P.y[j] - P.y[i];
    const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const kk = (d - rest) > 600 ? k * 0.22 : k;   /* 跨簇长边降劲度, 防止把大陆拽向中心 */
    const f = Math.min((d - rest) * kk * alpha, 2.2);
    dx /= d; dy /= d;
    P.vx[i] += dx * f; P.vy[i] += dy * f;
    P.vx[j] -= dx * f; P.vy[j] -= dy * f;
  }
  /* 向心 + 域锚定 */
  for (const i of shown) {
    const n = nodes[i];
    if (n.t === "Topic") continue;
    if (n.id === S.sel) continue;   /* 选中节点冻结: 概念卡观察期不漂移 */
    P.vx[i] -= P.x[i] * 0.00012 * alpha;
    P.vy[i] -= P.y[i] * 0.00012 * alpha;
    if (n.t !== "Domain") {
      const anc = n.t === "Field" ? 0.003 : (n.t === "Topic" ? 0.02 : 0.0016);
      const gx = DOM_ANCHOR[n.dom].x, gy = DOM_ANCHOR[n.dom].y;
      P.vx[i] += (gx - P.x[i]) * anc * alpha;
      P.vy[i] += (gy - P.y[i]) * anc * alpha;
    }
    /* 阻尼与限速 */
    P.vx[i] *= 0.85; P.vy[i] *= 0.85;
    const sp = Math.sqrt(P.vx[i] * P.vx[i] + P.vy[i] * P.vy[i]);
    if (sp > 14) { P.vx[i] *= 14 / sp; P.vy[i] *= 14 / sp; }
    if (!P.fixed[i]) { P.x[i] += P.vx[i]; P.y[i] += P.vy[i]; }
  }
  alpha = Math.max(alpha * 0.994, 0.02);
}

/* render.tick 的查询接口 (模块内部可变量不直接导出可变绑定) */
export function simAlpha(): number { return alpha; }
export function simWorkerActive(): boolean { return simWorker != null; }

/* 停机/唤醒协议: 空闲时主线程发 stop 让 Worker 挂起(停 pos 心跳→停重绘);
 * reheat/pin/unpin/add 任一消息 Worker 侧自动唤醒, 此处只跟踪状态防重复发 stop */
let workerPaused = false;
export function sendSimStop(): void {
    if (simWorker && workerReady && !workerPaused) {
        simWorker.postMessage({ type: "stop" });
        workerPaused = true;
    }
}
function wakeWorker(): void { workerPaused = false; }

/* ============================================================
 * 知识大地 Terra Cognita · app.js
 * 力导向星图 / 年代尺重放 / 概念卡 / 故事导览 / 时间轴
 * ============================================================ */
"use strict";

/* ---------- 数据准备(优先加载全量图: 种子策展层 + 批量骨架层) ---------- */
const FULL = window.GRAPH_CORE || null;
const NODES_ = FULL ? FULL.nodes : NODES;
const EDGES_ = FULL ? FULL.edges : EDGES;
const DOMAINS_ = FULL ? FULL.domains : DOMAINS;
const STORIES_ = FULL ? FULL.stories : STORIES;
/* ConceptNet 扩展层延迟合并: boot 后 1s 注入, 不阻塞首帧 */
function mergeExt() {
  const ext = window.GRAPH_EXT;
  if (!ext) return;
  for (const n of ext.nodes) { n.deg = 0; n.out = []; n.in = []; n.idx = NODES_.length; NODES_.push(n); byId[n.id] = n; }
  for (const e of ext.edges) {
    const edge = { from: e[0], to: e[1], type: e[2], w: e[3] == null ? 0.5 : e[3],
                   since: e[4] == null ? null : e[4], grade: e[2] === "marks" ? "A" : "B",
                   ctx: e.length > 5 ? e[5] : null };
    byId[e[0]].out.push(edge); byId[e[1]].in.push(edge);
    byId[e[0]].deg++; byId[e[1]].deg++;
    E.push(edge);
  }
  reheat(0.15);
}
const byId = {};
NODES_.forEach((n, i) => { n.idx = i; byId[n.id] = n; n.deg = 0; n.out = []; n.in = []; });
const E = EDGES_.map(function (e) {
  const [from, to, type, w, since] = e;
  const ctx = e.length > 5 ? e[5] : null;
  const edge = { from, to, type, w: w == null ? 0.5 : w, since: since == null ? null : since,
                 grade: type === "marks" ? "A" : "B", ctx: ctx || null };
  byId[from].out.push(edge); byId[to].in.push(edge);
  byId[from].deg++; byId[to].deg++;
  return edge;
});
const DOMAIN_IDS = DOMAINS_.map(d => d.id);
const YEAR_MIN = -8000, YEAR_MAX = 2026;
const ANCIENT = -9000;   /* 远古层: 早于年代尺起点的节点永久可见(火/制陶/农业) */
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 全局状态 ---------- */
const S = {
  view: "map",
  year: YEAR_MAX,
  playing: false, playT0: 0, playDur: 0,
  sel: null, hov: null,
  k: 0.13, tx: 0, ty: 0,
  typeOff: new Set(), domOff: new Set(),
  story: null, storyTimer: null,
  cam: null          /* 相机动画状态 */
};

/* ---------- Canvas ---------- */
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  if (flowBuilt) drawFlow();
  forceDraw = true;
}
window.addEventListener("resize", resize);

/* ---------- 力导向布局 ---------- */
const P = { x: [], y: [], vx: [], vy: [], fixed: [] };
const DOM_ANCHOR = {};
(function layoutAnchors() {
  const n = DOMAIN_IDS.length, inner = Math.ceil(n / 2);
  DOMAIN_IDS.forEach((id, i) => {
    if (i < inner) { const a = -Math.PI / 2 + i * (Math.PI * 2 / inner);
      DOM_ANCHOR[id] = { x: Math.cos(a) * 1150, y: Math.sin(a) * 1150 }; }
    else { const a = -Math.PI / 4 + (i - inner) * (Math.PI * 2 / (n - inner));
      DOM_ANCHOR[id] = { x: Math.cos(a) * 1780, y: Math.sin(a) * 1780 }; }
  });
})();
(function initPositions() {
  const angle = {};
  DOMAIN_IDS.forEach((id, i) => { angle[id] = -Math.PI / 2 + i * (Math.PI * 2 / DOMAIN_IDS.length); });
  const anchor = Object.assign({ dom_extern: { x: 0, y: -3900 } }, DOM_ANCHOR);
  const fieldCount = {};
  NODES_.forEach(n => {
    let ax, ay;
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
  function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
})();
let alpha = 1;
function reheat(a) { alpha = Math.max(alpha, a); }
function step() {
  const nodes = NODES_;
  const shown = [];
  for (let i = 0; i < nodes.length; i++) if (shownIdx(i)) shown.push(i);
  /* 斥力 O(n²) */
  for (let a = 0; a < shown.length; a++) {
    const i = shown[a];
    if (nodes[i].t === "Topic") continue;
    for (let b = a + 1; b < shown.length; b++) {
      const j = shown[b];
      if (nodes[j].t === "Topic") continue;
      let dx = P.x[i] - P.x[j], dy = P.y[i] - P.y[j];
      let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
      if (d2 > 1000 * 1000) continue;
      const d = Math.sqrt(d2);
      /* Topic(提取层背景纹理) 斥力降权: 不参与挤占, 停留在所属大陆内 */
      const w = (nodes[i].t === "Topic" || nodes[j].t === "Topic") ? 0.3 : 1;
      const f = Math.min(5200 / d2, 2.6) * alpha * w;
      dx /= d; dy /= d;
      P.vx[i] += dx * f; P.vy[i] += dy * f;
      P.vx[j] -= dx * f; P.vy[j] -= dy * f;
    }
  }
  /* 弹簧 */
  for (const e of E) {
    const i = byId[e.from].idx, j = byId[e.to].idx;
    if (!shownIdx(i) || !shownIdx(j)) continue;
    if (nodes[i].t === "Topic" || nodes[j].t === "Topic") continue;
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

/* ---------- 可见性 ---------- */
function yearOK(n) { return n.born == null || n.born <= S.year || n.born < ANCIENT; }
function shownIdx(i) {
  const n = NODES_[i];
  if (!yearOK(n)) return false;
  if (S.typeOff.has(n.t)) return false;
  if (S.domOff.has(n.dom)) return false;
  return true;
}
function isFossil(n) { return n.died != null && n.died <= S.year; }

/* ---------- 高亮集合 ---------- */
function neighborsOf(id) {
  const set = new Set();
  for (const e of byId[id].out) set.add(e.to);
  for (const e of byId[id].in) set.add(e.from);
  return set;
}
let HL = null;       /* 当前高亮节点 id 或 null */
function refreshHL() { HL = S.hov || S.sel; }

/* ---------- 绘制 ---------- */
function hashStr(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function sx(x) { return x * S.k + S.tx; }
function sy(y) { return y * S.k + S.ty; }

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  /* 背景 + 微弱经纬线(海图质感) */
  ctx.fillStyle = "#0d1420";
  ctx.fillRect(0, 0, W, H);
  const wx0 = (0 - S.tx) / S.k, wy0 = (0 - S.ty) / S.k;
  const wx1 = (W - S.tx) / S.k, wy1 = (H - S.ty) / S.k;
  ctx.strokeStyle = "rgba(60,80,110,0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const GRID = 240;
  for (let gx = Math.floor(wx0 / GRID) * GRID; gx <= wx1; gx += GRID) { ctx.moveTo(sx(gx), 0); ctx.lineTo(sx(gx), H); }
  for (let gy = Math.floor(wy0 / GRID) * GRID; gy <= wy1; gy += GRID) { ctx.moveTo(0, sy(gy)); ctx.lineTo(W, sy(gy)); }
  ctx.stroke();

  /* 大陆底色光斑 */
  for (const d of DOMAINS_) {
    const anc = DOM_ANCHOR[d.id];
    const gx = sx(anc.x), gy = sy(anc.y), gr = 470 * S.k;
    if (gx > -gr && gx < W + gr && gy > -gr && gy < H + gr) {
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, "rgba(96,132,184,0.10)");
      g.addColorStop(1, "rgba(96,132,184,0)");
      ctx.fillStyle = g;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
  }

  const hlSet = HL ? neighborsOf(HL) : null;
  const focus = HL != null;

  /* 边 */
  for (const e of E) {
    const a = byId[e.from], b = byId[e.to];
    if (!shownIdx(a.idx) || !shownIdx(b.idx)) continue;
    const et = EDGE_TYPES[e.type];
    if (S.k < 0.45 && (a.t === "Topic" || b.t === "Topic")) continue;
    const involved = HL === e.from || HL === e.to;
    let al = et.dim ? 0.13 : 0.28;
    if (focus) al = involved ? 0.85 : 0.05;
    const x1 = sx(P.x[a.idx]), y1 = sy(P.y[a.idx]);
    const x2 = sx(P.x[b.idx]), y2 = sy(P.y[b.idx]);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const bend = ((hashStr(e.from + e.to) % 9) - 4) * 6;
    const dx = x2 - x1, dy = y2 - y1, len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const cx = mx + (-dy / len) * bend, cy = my + (dx / len) * bend;
    ctx.strokeStyle = et.color;
    ctx.globalAlpha = al;
    ctx.lineWidth = involved ? 1.5 : 1;
    ctx.setLineDash(et.dashed ? [4, 4] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  /* 节点(两遍: 先提取层纹理, 再策展/结构层) */
  ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.textAlign = "center";
  for (const topicPass of [true, false]) {
  for (const n of NODES_) {
    if ((n.t === "Topic") !== topicPass) continue;
    if (!shownIdx(n.idx)) continue;
    /* 批量背景纹理: 无高亮时万级 Topic 单路径一次填充 */
    if (topicPass && !focus) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#d9c79a";
      ctx.beginPath();
      for (const m of NODES_) {
        if (m.t !== "Topic" || !shownIdx(m.idx)) continue;
        const bx = sx(P.x[m.idx]), by = sy(P.y[m.idx]);
        if (bx < -30 || bx > W + 30 || by < -30 || by > H + 30) continue;
        const br = Math.max(TYPES.Topic.r * 0.6 * Math.min(S.k * 1.5, 1), 1.4);
        ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, 7);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      for (const m of NODES_) {
        if (m.t !== "Topic" || !shownIdx(m.idx)) continue;
        if (S.sel !== m.id && S.hov !== m.id) continue;
        const bx = sx(P.x[m.idx]), by = sy(P.y[m.idx]);
        const br = Math.max(TYPES.Topic.r * 0.6 * Math.min(S.k * 1.5, 1), 2.5);
        ctx.globalAlpha = 1; ctx.fillStyle = "#d9c79a";
        ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
        ctx.strokeStyle = "#d9b36c"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(bx, by, br + 3, 0, 7); ctx.stroke();
        ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
        ctx.fillStyle = "#cfd6e0"; ctx.fillText(m.zh, bx, by + br + 13);
        ctx.lineWidth = 1;
      }
      continue;
    }
    const fossil = isFossil(n);
    const T = TYPES[n.t];
    const deg = Math.min(n.deg, 14);
    let r = T.r * (0.78 + 0.30 * Math.log2(1 + deg)) * (n.t === "Domain" ? 1 : 1);
    if (n.t === "Topic") r *= 0.78;
    r = Math.max(r * Math.min(S.k * 1.5, 1), 2.2);
    const x = sx(P.x[n.idx]), y = sy(P.y[n.idx]);
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
    const involved = HL === n.id || (hlSet && hlSet.has(n.id));
    let base = S.heat && !fossil ? heatColor(n) : (fossil ? "#4a5468" : T.color);
    let a = focus ? (involved ? 1 : (n.t === "Topic" ? 0.08 : 0.10)) : (n.t === "Topic" ? 0.55 : 0.92);

    /* 光晕: 高连接节点 */
    if (!fossil && n.deg >= 9 && n.t !== "Domain") {
      ctx.globalAlpha = a * 0.13;
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, 7); ctx.fill();
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
      } else {
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = base; ctx.globalAlpha = a * 0.5;
        ctx.beginPath(); ctx.arc(x, y, r + 4.5, 0, 7); ctx.stroke();
      }
    } else {
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    if (fossil) {
      ctx.strokeStyle = "#6b7688"; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (S.sel === n.id) {
      ctx.strokeStyle = "#d9b36c"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, r + 5.5, 0, 7); ctx.stroke();
      ctx.lineWidth = 1;
    }
    /* 标签 */
    const wantLabel =
      S.sel === n.id || S.hov === n.id ||
      (S.k > 0.06 && n.t === "Domain") ||
      (S.k > 0.3 && n.t === "Field" && n.deg >= 4) ||
      (S.k > 0.9 && n.deg >= 6) ||
      (S.k > 1.35 && n.t !== "Topic");
    if (wantLabel) {
      ctx.globalAlpha = focus && !involved ? 0.15 : (fossil ? 0.55 : 0.9);
      ctx.fillStyle = fossil ? "#8b97a8" : (n.t === "Domain" ? "#ffd166" : n.t === "Topic" ? "#8d99ac" : "#cfd6e0");
      ctx.font = n.t === "Domain" ? 'bold 15px "Segoe UI","Microsoft YaHei",sans-serif' : '11px "Segoe UI","Microsoft YaHei",sans-serif';
      ctx.fillText(n.zh, x, y + r + 13);
      ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
    }
    ctx.globalAlpha = 1;
  }
  }
}

/* ---------- 主循环 ---------- */
function tick() {
  requestAnimationFrame(tick);
  /* 自愈: 布局尺寸与记录不符时重测(启动时序/窗口变化) */
  if (cv.clientWidth !== W || cv.clientHeight !== H) {
    const wasZero = W === 0;
    resize();
    if (wasZero && !S.userMoved) {
      S.k = 0.13; S.tx = W / 2; S.ty = H / 2;
      if (S.sel) S.needFly = S.sel;
    }
  }
  if (S.needFly && W > 0) { const fid = S.needFly; S.needFly = null; flyTo(fid); }
  if (S.view !== "map") { forceDraw = true; return; }
  if (S.playing) {
    /* 基于真实时间沿分段年代尺重放, 不受 rAF 节流影响 */
    const done = Math.min(1, (performance.now() - S.playT0) / S.playDur);
    S.year = sliderToYear(done * 1000);
    syncTimeUI();
    if (Math.random() < 0.3) reheat(0.09);
    if (done >= 1) stopPlay();
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
  const active = alpha > 0.025 || S.cam || S.playing;
  if (S.hov !== lastHov || S.sel !== lastSel) { lastHov = S.hov; lastSel = S.sel; forceDraw = true; }
  if (active) step();
  if (active || forceDraw) { draw(); forceDraw = false; }
}

/* ---------- 相机 ---------- */
function zoomAt(mx, my, f) {
  const k2 = Math.min(6, Math.max(0.18, S.k * f));
  const real = k2 / S.k;
  S.tx = mx - (mx - S.tx) * real;
  S.ty = my - (my - S.ty) * real;
  S.k = k2;
}
function flyTo(id, targetK) {
  const n = byId[id]; if (!n) return;
  const k1 = targetK || Math.max(S.k, 1.5);
  /* 概念卡打开时, 居中于面板左侧的可见区域 */
  const pw = (panel && !panel.hidden && W > 860) ? 380 : 0;
  const cx = (W - pw) / 2, cy = H / 2;
  if (REDUCED) { S.k = k1; S.tx = cx - P.x[n.idx] * k1; S.ty = cy - P.y[n.idx] * k1; return; }
  S.cam = {
    t0: performance.now(), dur: 700,
    k0: S.k, k1: k1,
    tx0: S.tx, ty0: S.ty,
    tx1: cx - P.x[n.idx] * k1, ty1: cy - P.y[n.idx] * k1
  };
}

/* ---------- 指针交互 ---------- */
let drag = null;   /* {mode:'pan'|'node', idx, ox, oy, moved} */
let lastHov = null, lastSel = null, forceDraw = true;   /* 脏标记: 无变化不重绘 */
function pickNode(mx, my) {
  for (const n of NODES_) {
    if (!shownIdx(n.idx)) continue;
    const x = sx(P.x[n.idx]), y = sy(P.y[n.idx]);
    const T = TYPES[n.t];
    const r = Math.max(T.r * Math.min(S.k * 1.5, 1), 5) + 4;
    if ((mx - x) * (mx - x) + (my - y) * (my - y) < r * r) return n;
  }
  return null;
}
cv.addEventListener("pointerdown", ev => {
  S.cam = null; S.userMoved = true; forceDraw = true;
  const rect = cv.getBoundingClientRect();
  const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
  const n = pickNode(mx, my);
  cv.setPointerCapture(ev.pointerId);
  if (n) { drag = { mode: "node", idx: n.idx, moved: false }; P.fixed[n.idx] = true; }
  else drag = { mode: "pan", mx, my, tx: S.tx, ty: S.ty, moved: false };
  cv.classList.add("dragging");
});
cv.addEventListener("pointermove", ev => {
  forceDraw = true;
  const rect = cv.getBoundingClientRect();
  const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
  if (drag) {
    if (drag.mode === "node") {
      P.x[drag.idx] = (mx - S.tx) / S.k; P.y[drag.idx] = (my - S.ty) / S.k;
      P.vx[drag.idx] = 0; P.vy[drag.idx] = 0;
      drag.moved = true; reheat(0.05);
    } else {
      S.tx = drag.tx + (mx - drag.mx); S.ty = drag.ty + (my - drag.my);
      if (Math.abs(mx - drag.mx) + Math.abs(my - drag.my) > 3) drag.moved = true;
    }
    return;
  }
  const n = pickNode(mx, my);
  S.hov = n ? n.id : null;
  refreshHL();
  cv.style.cursor = n ? "pointer" : "grab";
  const tip = document.getElementById("tooltip");
  if (n) {
    const T = TYPES[n.t];
    tip.hidden = false;
    tip.style.left = (ev.clientX + 14) + "px";
    tip.style.top = (ev.clientY + 12) + "px";
    tip.innerHTML = "<b>" + n.zh + "</b>" +
      '<span class="tt-type">' + T.zh + (n.born ? " · " + n.born + " 年" : "") +
      (isFossil(n) ? " · 已被推翻" : "") + "</span>";
  } else tip.hidden = true;
});
cv.addEventListener("pointerup", ev => {
  if (!drag) return;
  if (drag.mode === "node") P.fixed[drag.idx] = false;
  const wasClick = !drag.moved;
  if (wasClick && drag.mode === "node") {
    select(NODES_[drag.idx].id);
  } else if (wasClick && drag.mode === "pan") {
    select(null);
  }
  drag = null;
  cv.classList.remove("dragging");
});
cv.addEventListener("dblclick", ev => {
  const rect = cv.getBoundingClientRect();
  const n = pickNode(ev.clientX - rect.left, ev.clientY - rect.top);
  if (n) flyTo(n.id);
});
cv.addEventListener("wheel", ev => {
  ev.preventDefault(); S.userMoved = true; forceDraw = true;
  const rect = cv.getBoundingClientRect();
  zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, Math.exp(-ev.deltaY * 0.0012));
}, { passive: false });

/* ---------- 概念卡面板 ---------- */
const panel = document.getElementById("panel");
const REL_LABELS = {
  depends_on:  ["奠基于", "为其奠基"],
  enables:     ["由…使能", "使能"],
  inspired_by: ["受启发于", "启发了"],
  applied_in:  ["应用于此", "应用于"],
  composes_of: ["由…组成", "组合了"],
  supersedes:  ["被…取代", "取代"],
  refines:     ["被…修正", "修正"],
  refutes:     ["被…反驳", "反驳"],
  formalizes:  ["被…形式化", "形式化了"],
  engineers:   ["被…工程化", "工程化了"],
  productizes: ["被…产品化", "产品化了"],
  transfers_to:["迁移至此", "迁移至"],
  feeds_back:  ["反哺于此", "反哺"],
  competes_with:["与…竞争", "与…竞争"],
  contested_by:["身处争议", "争议相关"],
  raises:      ["由…提出", "提出"],
  solves:      ["被…解决", "解决"],
  constrains:  ["受…约束", "约束"],
  explains:    ["被…解释", "解释"],
  accelerated: ["被…促成", "促成"],
  blocked_by:  ["受制于", "卡住了"],
  relates_to:  ["关联", "关联"]
};
function relHTML(edges, dir, selfId) {
  /* dir: 'in' 收到的边(更早的一端), 'out' 发出的边 */
  const groups = {};
  for (const e of edges) {
    if (e.type === "part_of" || e.type === "marks" || e.type === "did") continue;
    if (e.type === "relates_to") { (groups.relates_to = groups.relates_to || []).push(dir === "in" ? e.from : e.to); continue; }
    if (dir === "in") (groups[e.type] = groups[e.type] || []).push(e.from);
    else (groups[e.type] = groups[e.type] || []).push(e.to);
  }
  let html = "";
  for (const t in groups) {
    const lab = REL_LABELS[t] ? (dir === "in" ? REL_LABELS[t][0] : REL_LABELS[t][1]) : t;
    html += '<div class="r-head">' + lab + " · " + groups[t].length + "</div>";
    for (const id of groups[t]) {
      const n = byId[id]; if (!n) continue;
      html += '<a data-go="' + id + '"><i class="dot" style="background:' + (isFossil(n) ? "#4a5468" : TYPES[n.t].color) + '"></i>' + n.zh + "</a>";
    }
    if (t === "relates_to") {
      for (const e of (dir === "in" ? edges : edges).filter(x => x.ctx).slice(0, 2)) {
        html += '<div class="r-ctx">原文共现：' + e.ctx.slice(0, 80) + "…</div>";
      }
    }
  }
  return html ? '<div class="p-rel">' + html + "</div>" : "";
}
function select(id) {
  S.sel = id;
  refreshHL();
  forceDraw = true;
  if (!id) {
    panel.hidden = true;
    if (location.hash.indexOf("#/node/") === 0) setHash("#/atlas");
    return;
  }
  const n = byId[id];
  const T = TYPES[n.t];
  let html = '<button class="p-close" aria-label="关闭">✕</button>';
  html += '<span class="p-type"><i class="dot" style="background:' + T.color + '"></i>' + T.zh +
    (n.dom && n.t !== "Domain" ? " · " + (byId[n.dom] ? byId[n.dom].zh : "") : "") + "</span>";
  html += '<h2 class="p-zh">' + n.zh + "</h2>";
  if (n.en) html += '<div class="p-en">' + n.en + "</div>";
  html += '<div class="p-meta">';
  const yrTxt = n.born == null ? null :
    (n.born <= -10000 ? "前 " + Math.round(-n.born / 10000) + " 万年" :
     (n.born < 0 ? "前 " + (-n.born) + " 年" : n.born + " 年"));
  if (yrTxt) html += '<span class="p-tag yr">' + yrTxt + "</span>";
  if (n.died) html += '<span class="p-tag yr" style="color:var(--red);border-color:var(--red)">' + n.died + " 年被推翻</span>";
  if (n.status) html += '<span class="p-tag status">' + n.status + "</span>";
  if (n.tr) html += '<span class="p-tag">' + n.tr + "</span>";
  html += "</div>";
  if (isFossil(n)) html += '<div class="fossil-note">⚠ 这条分支已被推翻或证伪。它留在图上，作为科学如何自我纠错的记录。</div>';
  html += '<div class="p-sec"><h4>定 义</h4><p>' + n.one + "</p></div>";
  if (n.why) html += '<div class="p-sec"><h4>为什么重要</h4><p>' + n.why + "</p></div>";
  if (n.ex) html += '<div class="p-sec"><h4>一个具体例子</h4><p>' + n.ex + "</p></div>";
  /* 隶属(part_of 边: 子→父) */
  const parent = n.out.find(e => e.type === "part_of");
  const kids = n.in.filter(e => e.type === "part_of");
  if (parent || kids.length) {
    html += '<div class="p-sec"><h4>归 属</h4><div class="p-rel">';
    if (parent) html += '<div class="r-head">属于</div><a data-go="' + parent.to + '"><i class="dot" style="background:' + TYPES[byId[parent.to].t].color + '"></i>' + byId[parent.to].zh + "</a>";
    if (kids.length) {
      html += '<div class="r-head">包含 · ' + kids.length + "</div>";
      for (const e of kids) html += '<a data-go="' + e.from + '"><i class="dot" style="background:' + TYPES[byId[e.from].t].color + '"></i>' + byId[e.from].zh + "</a>";
    }
    html += "</div></div>";
  }
  /* 历史时刻 / 完成者 */
  const markedBy = n.in.filter(e => e.type === "marks");
  const didBy = n.in.filter(e => e.type === "did");
  const didOut = n.out.filter(e => e.type === "did");
  const marksOut = n.out.filter(e => e.type === "marks");
  if (markedBy.length || didBy.length || didOut.length || marksOut.length) {
    html += '<div class="p-sec"><h4>人与时刻</h4><div class="p-rel">';
    for (const e of didBy) html += '<div class="r-head">完成者</div><a data-go="' + e.from + '"><i class="dot" style="background:' + TYPES[byId[e.from].t].color + '"></i>' + byId[e.from].zh + "</a>";
    for (const e of markedBy) html += '<div class="r-head">历史时刻</div><a data-go="' + e.from + '"><i class="dot" style="background:' + TYPES[byId[e.from].t].color + '"></i>' + byId[e.from].zh + (byId[e.from].born ? "（" + byId[e.from].born + " 年）" : "") + "</a>";
    for (const e of didOut) html += '<div class="r-head">完成</div><a data-go="' + e.to + '"><i class="dot" style="background:' + TYPES[byId[e.to].t].color + '"></i>' + byId[e.to].zh + "</a>";
    for (const e of marksOut) html += '<div class="r-head">标记</div><a data-go="' + e.to + '"><i class="dot" style="background:' + TYPES[byId[e.to].t].color + '"></i>' + byId[e.to].zh + "</a>";
    html += "</div></div>";
  }
  /* 关系 */
  const relIn = relHTML(n.in, "in", id);
  const relOut = relHTML(n.out, "out", id);
  if (relIn) html += '<div class="p-sec"><h4>前 演</h4>' + relIn + "</div>";
  if (relOut) html += '<div class="p-sec"><h4>后 继</h4>' + relOut + "</div>";
  /* 证据 */
  if (n.ev && n.ev.length) {
    html += '<div class="p-sec"><h4>证 据</h4>';
    for (let i = 0; i < n.ev.length; i += 2) {
      const g0 = n.ev[i], g1 = n.ev[i + 1];
      html += '<div class="p-ev"><span class="g g' + g0 + '">' + g0 + "</span><span>" + (g1 || "") + "</span></div>";
    }
    html += '<div class="p-conf"><div class="bar"><i style="width:' + Math.round((n.conf || 0.5) * 100) + '%"></i></div><span>综合置信度 ' + Math.round((n.conf || 0.5) * 100) + "%</span></div></div>";
  }
  const q = encodeURIComponent(n.zh);
  html += '<div class="p-sec"><h4>外 部 索 引</h4><div class="p-ext">' +
    '<a href="https://zh.wikipedia.org/wiki/' + q + '" target="_blank" rel="noopener">维基百科</a>' +
    '<a href="https://baike.baidu.com/item/' + q + '" target="_blank" rel="noopener">百度百科</a>' +
    '<a href="https://www.bing.com/search?q=' + q + '" target="_blank" rel="noopener">必应搜索</a>' +
    '<a href="https://xueshu.baidu.com/s?wd=' + q + '" target="_blank" rel="noopener">学术搜索</a>' +
    '<a href="https://scholar.google.com/scholar?q=' + q + '" target="_blank" rel="noopener">Google Scholar</a>' +
    '</div></div>';
  html += '<div class="p-actions"><button id="pFocus">聚 焦</button>' +
    (n.t === "Domain" ? '<button id="pDomain">进入领域</button>' : '<button id="pTimeline">在时间轴中查看</button>') + "</div>";
  panel.innerHTML = html;
  panel.hidden = false;
  setHash("#/node/" + id);
  panel.querySelector(".p-close").onclick = () => select(null);
  document.getElementById("pFocus").onclick = () => flyTo(id);
  const pt = document.getElementById("pTimeline");
  if (pt) pt.onclick = () => { switchView("timeline"); };
  const pd = document.getElementById("pDomain");
  if (pd) pd.onclick = () => { switchView("domain", { domain: id }); };
  panel.querySelectorAll("[data-go]").forEach(a => {
    a.onclick = () => { const t = a.getAttribute("data-go"); select(t); flyTo(t); };
  });
}

/* ---------- 年代尺(分段线性映射: 远古压缩, 近代展开) ---------- */
const SLIDER_ANCHORS = [[0,-8000],[250,-4000],[400,-2000],[500,-500],[550,500],[620,1200],[720,1600],[800,1760],[880,1870],[940,1930],[975,1970],[1000,2026]];
function sliderToYear(s) {
  for (let i = 1; i < SLIDER_ANCHORS.length; i++) {
    if (s <= SLIDER_ANCHORS[i][0]) {
      const [s0, y0] = SLIDER_ANCHORS[i - 1], [s1, y1] = SLIDER_ANCHORS[i];
      return Math.round(y0 + (y1 - y0) * (s - s0) / (s1 - s0));
    }
  }
  return YEAR_MAX;
}
function yearToSlider(y) {
  if (y <= SLIDER_ANCHORS[0][1]) return 0;
  for (let i = 1; i < SLIDER_ANCHORS.length; i++) {
    if (y <= SLIDER_ANCHORS[i][1]) {
      const [s0, y0] = SLIDER_ANCHORS[i - 1], [s1, y1] = SLIDER_ANCHORS[i];
      return s0 + (s1 - s0) * (y - y0) / (y1 - y0);
    }
  }
  return 1000;
}
const yearRange = document.getElementById("yearRange");
const yearLabel = document.getElementById("yearLabel");
const playBtn = document.getElementById("playBtn");
function syncTimeUI() {
  forceDraw = true;
  yearRange.value = yearToSlider(S.year);
  const visible = NODES_.filter(yearOK).length;
  yearLabel.textContent = S.year >= YEAR_MAX ? "全部年代" : (S.year < 0 ? "前 " + (-S.year) + " 年" : S.year + " 年");
  yearLabel.title = visible + " / " + NODES_.length + " 节点可见";
  if (tlBuilt) updateTimelineCursor();
}
yearRange.addEventListener("input", () => { stopPlay(); S.year = sliderToYear(+yearRange.value); syncTimeUI(); reheat(0.1); });
function startPlay(durMs) {
  if (S.year >= YEAR_MAX) S.year = sliderToYear(0);
  S.playT0 = performance.now();
  S.playDur = durMs || 12000;
  S.playing = true;
  playBtn.textContent = "❚❚ 暂停";
}
function stopPlay() { S.playing = false; playBtn.textContent = "▷ 重放生长"; }
playBtn.addEventListener("click", () => { S.playing ? stopPlay() : startPlay(12000); });

/* ---------- 图例与筛选 ---------- */
function buildLegend() {
  const ld = document.getElementById("legendDomains");
  const lt = document.getElementById("legendTypes");
  ld.innerHTML = DOMAINS_.map(d => {
    const c = NODES_.filter(n => n.dom === d.id).length;
    return '<button class="lg-chip" data-dom="' + d.id + '"><span class="dot" style="background:#5a7ba6"></span>' + d.zh + ' <span class="n">' + c + "</span></button>";
  }).join("");
  lt.innerHTML = Object.keys(TYPES).map(t => {
    const c = NODES_.filter(n => n.t === t).length;
    if (!c) return "";
    return '<button class="lg-chip" data-type="' + t + '"><span class="dot" style="background:' + TYPES[t].color + '"></span>' + TYPES[t].zh + ' <span class="n">' + c + "</span></button>";
  }).join("");
  document.querySelectorAll("#legend .lg-chip").forEach(b => {
    b.onclick = () => {
      if (b.dataset.dom) {
        const d = b.dataset.dom;
        S.domOff.has(d) ? S.domOff.delete(d) : S.domOff.add(d);
        b.classList.toggle("off");
      } else {
        const t = b.dataset.type;
        S.typeOff.has(t) ? S.typeOff.delete(t) : S.typeOff.add(t);
        b.classList.toggle("off");
      }
      reheat(0.1); forceDraw = true;
      if (S.sel && !shownIdx(byId[S.sel].idx)) select(null);
    };
  });
  document.getElementById("legendReset").onclick = () => {
    S.typeOff.clear(); S.domOff.clear();
    document.querySelectorAll("#legend .lg-chip.off").forEach(b => b.classList.remove("off"));
    reheat(0.1);
  };
}

/* ---------- 搜索 ---------- */
const searchInput = document.getElementById("search");
const searchDrop = document.getElementById("searchDrop");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { searchDrop.hidden = true; return; }
  const hits = NODES_.filter(n => n.zh.toLowerCase().includes(q) || n.en.toLowerCase().includes(q)).slice(0, 9);
  if (!hits.length) { searchDrop.hidden = true; return; }
  searchDrop.innerHTML = hits.map(n =>
    '<div class="sd-item" data-id="' + n.id + '"><span class="sd-dot" style="background:' + TYPES[n.t].color + '"></span>' +
    n.zh + '<span class="sd-en">' + TYPES[n.t].zh + (n.born ? " · " + n.born : "") + "</span></div>").join("");
  searchDrop.hidden = false;
  searchDrop.querySelectorAll(".sd-item").forEach(el => {
    el.onmousedown = ev => {
      ev.preventDefault();
      const id = el.getAttribute("data-id");
      select(id); flyTo(id);
      searchDrop.hidden = true; searchInput.value = ""; searchInput.blur();
    };
  });
});
searchInput.addEventListener("keydown", ev => {
  if (ev.key === "Enter") {
    const first = searchDrop.querySelector(".sd-item");
    if (first) { const id = first.getAttribute("data-id"); select(id); flyTo(id); searchDrop.hidden = true; searchInput.value = ""; searchInput.blur(); }
  }
  if (ev.key === "Escape") { searchDrop.hidden = true; searchInput.blur(); }
});
searchInput.addEventListener("blur", () => setTimeout(() => { searchDrop.hidden = true; }, 180));

/* ---------- 故事导览 ---------- */
const storyBox = document.getElementById("storyBox");
function buildStories() {
  document.getElementById("storyChips").innerHTML = STORIES_.map((s, i) =>
    '<button class="chip" data-i="' + i + '">▷ ' + s.zh + "</button>").join("");
  document.querySelectorAll("#storyChips .chip").forEach(b => {
    b.onclick = () => startStory(+b.dataset.i);
  });
  document.getElementById("storyClose").onclick = endStory;
  document.getElementById("storyNext").onclick = () => storyStep(S.story.i + 1);
  document.getElementById("storyPrev").onclick = () => storyStep(S.story.i - 1);
}
function startStory(i) {
  stopPlay();
  S.story = { i: -1, s: STORIES[i] };
  select(null); panel.hidden = true;
  document.getElementById("storyTitle").textContent = STORIES[i].zh + " — " + STORIES[i].desc;
  storyBox.hidden = false;
  storyStep(0);
}
function storyStep(i) {
  if (!S.story) return;
  const steps = S.story.s.steps;
  if (i < 0) return;
  if (i >= steps.length) { endStory(); return; }
  S.story.i = i;
  const st = steps[i];
  document.getElementById("storyText").textContent = st.text;
  document.getElementById("storyStep").textContent = (i + 1) + " / " + steps.length;
  S.sel = st.id; refreshHL();
  flyTo(st.id, Math.max(S.k, 1.35));
  if (S.storyTimer) clearTimeout(S.storyTimer);
  S.storyTimer = setTimeout(() => { if (S.story) storyStep(S.story.i + 1); }, 6200);
}
function endStory() {
  if (S.storyTimer) clearTimeout(S.storyTimer);
  S.story = null; storyBox.hidden = true;
}

/* ---------- 时间轴视图(画布: 密度概览 + 策展点 + 按需展开) ---------- */
const TL_ANCHORS = [[-8000, 60], [-4000, 300], [-2000, 540], [-500, 820], [0, 950], [500, 1110], [1000, 1290], [1500, 1570], [1700, 1950], [1800, 2240], [1850, 2420], [1900, 2650], [1950, 2960], [2000, 3290], [2026, 4180]];
function xFor(y) {
  const cy = Math.max(y, -8000);
  for (let i = 1; i < TL_ANCHORS.length; i++) {
    if (cy <= TL_ANCHORS[i][0]) {
      const [y0, x0] = TL_ANCHORS[i - 1], [y1, x1] = TL_ANCHORS[i];
      return x0 + (x1 - x0) * (cy - y0) / (y1 - y0);
    }
  }
  return TL_ANCHORS[TL_ANCHORS.length - 1][1];
}
function xToYear(x) {
  for (let i = 1; i < TL_ANCHORS.length; i++) {
    if (x <= TL_ANCHORS[i][1]) {
      const [y0, x0] = TL_ANCHORS[i - 1], [y1, x1] = TL_ANCHORS[i];
      return Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
    }
  }
  return 2026;
}
let tlBuilt = false, tlData = null, tlQueued = false;
const tlCv = document.getElementById("tlCv");
const tctx = tlCv.getContext("2d");
const TL = { W: 4260, LANE_H: 72, BIN: 20 };

function gradeOf(n) { return (n.ev && n.ev[0]) || "C"; }

function buildTimeline() {
  if (tlBuilt) { queueTlDraw(); return; }
  tlBuilt = true;
  tlData = { lanes: DOMAINS_.map(d => {
    const all = NODES_.filter(n => n.dom === d.id && n.t !== "Domain" && n.born != null)
                      .sort((a, b) => a.born - b.born);
    return { d, all, curated: all.filter(n => gradeOf(n) !== "C") };
  }) };
  tlData.lanes.forEach(L => {
    L.bins = new Array(Math.ceil(TL.W / TL.BIN)).fill(0);
    for (const n of L.all) {
      const b = Math.min(L.bins.length - 1, Math.floor(xFor(n.born) / TL.BIN));
      L.bins[b]++;
    }
    L.maxBin = Math.max(1, ...L.bins);
  });
  sizeTl();
  document.getElementById("tlScroll").scrollLeft = 1980;   /* 画布定宽后再定位: 约 1750-2026 密集区 */
}
function sizeTl() {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const H = tlData.lanes.length * TL.LANE_H + 46;
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
  const DPR = tlCv._dpr || 1;
  const lanes = tlData.lanes;
  const H = lanes.length * TL.LANE_H + 46;
  const scroll = document.getElementById("tlScroll").scrollLeft;
  tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  tctx.fillStyle = "#0d1420"; tctx.fillRect(0, 0, TL.W + 60, H);
  const cursorX = xFor(S.year);
  lanes.forEach((L, li) => {
    const y0 = 6 + li * TL.LANE_H;
    tctx.fillStyle = li % 2 ? "rgba(23,33,52,0.55)" : "rgba(19,28,45,0.55)";
    tctx.fillRect(0, y0, TL.W, TL.LANE_H);
    for (let b = 0; b < L.bins.length; b++) {
      if (!L.bins[b]) continue;
      const bx = b * TL.BIN;
      tctx.globalAlpha = bx > cursorX ? 0.12 : 0.5;
      tctx.fillStyle = "rgba(96,132,184,0.85)";
      const h = Math.min(TL.LANE_H - 12, L.bins[b] / L.maxBin * (TL.LANE_H - 16));
      tctx.fillRect(bx + 2, y0 + TL.LANE_H - 4 - h, TL.BIN - 4, h);
    }
    tctx.globalAlpha = 1;
    let lastLabel = -1e9;
    for (const n of L.curated) {
      const x = xFor(n.born), y = y0 + TL.LANE_H * 0.42;
      const future = n.born > S.year, fossil = isFossil(n);
      tctx.globalAlpha = future ? 0.15 : 1;
      tctx.fillStyle = fossil ? "#57627a" : TYPES[n.t].color;
      if (n.t === "Event") {
        tctx.save(); tctx.translate(x, y); tctx.rotate(Math.PI / 4);
        tctx.fillRect(-3.6, -3.6, 7.2, 7.2); tctx.restore();
      } else {
        tctx.beginPath(); tctx.arc(x, y, 3.8, 0, 7); tctx.fill();
      }
      if ((n.t === "Event" || n.t === "Person" || n.deg >= 9) && x - lastLabel > 66 && !future) {
        tctx.font = "10px 'Segoe UI','Microsoft YaHei',sans-serif";
        tctx.textAlign = "center";
        tctx.fillStyle = fossil ? "#71809a" : "#b6c0d0";
        tctx.fillText(n.zh, x, y - 9);
        lastLabel = x + n.zh.length * 10.5;
      }
      tctx.globalAlpha = 1;
    }
  });
  const cx = xFor(S.year);
  tctx.strokeStyle = "#d9b36c"; tctx.globalAlpha = 0.75; tctx.lineWidth = 1;
  tctx.beginPath(); tctx.moveTo(cx, 0); tctx.lineTo(cx, lanes.length * TL.LANE_H + 8); tctx.stroke();
  tctx.globalAlpha = 1; tctx.lineWidth = 1;
  tctx.font = "12px Georgia,'Songti SC','SimSun',serif"; tctx.textAlign = "left";
  lanes.forEach((L, li) => {
    tctx.fillStyle = "rgba(13,20,32,0.85)";
    tctx.fillRect(scroll + 2, 6 + li * TL.LANE_H, 96, TL.LANE_H - 4);
    tctx.fillStyle = "#d9b36c";
    tctx.fillText(L.d.zh, scroll + 8, 6 + li * TL.LANE_H + TL.LANE_H / 2 + 4);
  });
  tctx.font = "11px Georgia,serif"; tctx.textAlign = "center"; tctx.fillStyle = "#5a6678";
  const ay = lanes.length * TL.LANE_H + 30;
  [-8000, -4000, -2000, -500, 0, 500, 1000, 1500, 1700, 1800, 1900, 1950, 2000, 2026].forEach(t => {
    const x = xFor(t);
    tctx.fillText(t < 0 ? "前" + (-t) : (t === 0 ? "元年" : "" + t), x, ay);
    tctx.fillRect(x - 0.5, ay - 16, 1, 6);
  });
}
function tlHit(ev) {
  const rect = tlCv.getBoundingClientRect();
  const ox = ev.clientX - rect.left, oy = ev.clientY - rect.top - 6;
  const li = Math.floor(oy / TL.LANE_H);
  if (li < 0 || li >= tlData.lanes.length) return null;
  const L = tlData.lanes[li];
  let best = null, bestD = 10;
  for (const n of L.curated) {
    const d = Math.abs(xFor(n.born) - ox);
    if (d < bestD) { bestD = d; best = n; }
  }
  const bin = Math.max(0, Math.min(L.bins.length - 1, Math.floor(ox / TL.BIN)));
  return { L, li, bin, node: best, year0: xToYear(bin * TL.BIN), year1: xToYear(bin * TL.BIN + TL.BIN) };
}
function closeTlPop() { const p = document.getElementById("tlPop"); if (p) { p.hidden = true; p.innerHTML = ""; } }
tlCv.addEventListener("mousemove", ev => {
  if (!tlBuilt) return;
  const hit = tlHit(ev);
  const tip = document.getElementById("tooltip");
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
tlCv.addEventListener("mouseleave", () => { document.getElementById("tooltip").hidden = true; });
tlCv.addEventListener("click", ev => {
  if (!tlBuilt) return;
  closeTlPop();
  const hit = tlHit(ev);
  if (!hit) return;
  if (hit.node) { select(hit.node.id); return; }
  const y0 = hit.year0, y1 = hit.year1;
  const inBin = hit.L.all.filter(n => { const x = xFor(n.born); return x >= hit.bin * TL.BIN && x < (hit.bin + 1) * TL.BIN; })
                         .sort((a, b) => ((gradeOf(a) !== "C") - (gradeOf(b) !== "C")) || (a.born - b.born));
  if (!inBin.length) return;   /* 空时段不弹清单 */
  const pop = document.getElementById("tlPop");
  pop.style.left = Math.min(ev.clientX, window.innerWidth - 330) + "px";
  pop.style.top = Math.min(ev.clientY, window.innerHeight - 300) + "px";
  const yr = (y0 < 0 ? "前" + (-y0) : y0) + " — " + (y1 < 0 ? "前" + (-y1) : y1);
  pop.innerHTML = "<h5>" + hit.L.d.zh + " · " + yr + " · " + inBin.length + " 个节点</h5>" +
    inBin.slice(0, 60).map(n =>
      '<a data-go="' + n.id + '"><i class="dot" style="background:' + (isFossil(n) ? "#57627a" : TYPES[n.t].color) +
      '"></i>' + n.zh + '<span class="tl-grad">' + gradeOf(n) + '</span></a>').join("") +
    (inBin.length > 60 ? "<div class='tl-more'>…其余 " + (inBin.length - 60) + " 个</div>" : "");
  pop.hidden = false;
  pop.querySelectorAll("[data-go]").forEach(a => {
    a.onclick = () => { select(a.getAttribute("data-go")); closeTlPop(); };
  });
});
document.getElementById("tlScroll").addEventListener("scroll", () => { closeTlPop(); queueTlDraw(); });
window.addEventListener("resize", () => { if (tlBuilt) sizeTl(); });
function updateTimelineCursor() { if (tlBuilt) queueTlDraw(); }

/* ---------- 视图切换与哈希路由 ---------- */
const VIEW_SECTIONS = { map: "view-map", flow: "view-flow", frontier: "view-frontier", timeline: "view-timeline", about: "view-about", api: "view-api", domain: "view-domain", curate: "view-curate" };
const VIEW_HASH = { map: "atlas", flow: "flow", frontier: "frontier", timeline: "timeline", about: "about", api: "api", domain: "domain", curate: "curate" };
const VIEW_TITLE = { map: "星图", flow: "河流 · 成熟度管道", frontier: "前沿", timeline: "时间轴", about: "图志", api: "开放 API", domain: "领域", curate: "策展台" };
function setHash(h) { if (location.hash !== h) history.replaceState(null, "", h); }
function switchView(v, opts) {
  opts = opts || {};
  S.view = v;
  forceDraw = true;
  document.body.dataset.view = v;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === v));
  for (const k in VIEW_SECTIONS) document.getElementById(VIEW_SECTIONS[k]).hidden = k !== v;
  if (v === "timeline") buildTimeline();
  if (v === "flow") buildFlow();
  if (v === "frontier") buildFrontier();
  if (v === "api") buildApi();
  if (v === "curate") buildCurate();
  if (v === "domain" && opts.domain) { S.domainId = opts.domain; renderDomain(opts.domain); }
  const h = v === "domain" ? "#/domain/" + (opts.domain || S.domainId) : "#/" + VIEW_HASH[v];
  setHash(h);
  document.title = VIEW_TITLE[v] + " · 知识大地 Terra Cognita";
}
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (!h) { switchView("map", { silent: true }); return; }
  const slash = h.indexOf("/");
  const head = slash < 0 ? h : h.slice(0, slash);
  const arg = slash < 0 ? null : h.slice(slash + 1);
  if (head === "node" && arg && byId[arg]) {
    if (S.view !== "map") { S.view = "map"; document.body.dataset.view = "map"; for (const k in VIEW_SECTIONS) document.getElementById(VIEW_SECTIONS[k]).hidden = k !== "map"; }
    select(arg);
    S.needFly = arg;   /* 相机飞行推迟到画布尺寸就绪 */
  } else if (head === "domain" && arg && byId[arg]) {
    switchView("domain", { domain: arg });
  } else {
    const v = Object.keys(VIEW_HASH).find(k => VIEW_HASH[k] === head) || "map";
    switchView(v, { silent: true });
  }
}
window.addEventListener("hashchange", route);
document.querySelectorAll(".tab").forEach(t => t.onclick = () => switchView(t.dataset.view));

/* ---------- 全局按键 ---------- */
document.addEventListener("keydown", ev => {
  if (ev.key === "Escape") {
    if (!searchDrop.hidden) { searchDrop.hidden = true; return; }
    if (S.story) { endStory(); return; }
    if (S.sel) select(null);
  }
});

/* ---------- 生长热力着色 ---------- */
function heatColor(n) {
  if (n.born == null) return "#5a6678";
  if (n.born < 1900) return "#3d5a80";
  if (n.born < 1950) return "#3f7f74";
  if (n.born < 1990) return "#d9b36c";
  if (n.born < 2010) return "#ff9e64";
  return "#ff5370";
}

/* ---------- 河流视图: 成熟度管道(桑基图) ---------- */
const STAGES = [
  { zh: "知识 · 理论与概念", color: "#82aaff", types: ["Theory", "Proposition", "Concept"] },
  { zh: "方法", color: "#c792ea", types: ["Method", "Skill"] },
  { zh: "工艺", color: "#4ecdc4", types: ["Process"] },
  { zh: "技术 · 工具与材料", color: "#5fd68a", types: ["Technology", "Instrument", "Material", "Dataset"] },
  { zh: "产品", color: "#f5e663", types: ["Product"] }
];
const stageOf = {};
STAGES.forEach((s, i) => s.types.forEach(t => { stageOf[t] = i; }));
const flowCv = document.getElementById("flowCv");
const fctx = flowCv.getContext("2d");
let flowBuilt = false, flowHover = null;
const FLOW = { W: 1520, H: 700, cols: [], links: [], bandOf: {}, geom: null };

function buildFlow() {
  if (flowBuilt) { drawFlow(); return; }
  flowBuilt = true;
  const cross = E.filter(e => stageOf[byId[e.from].t] != null && stageOf[byId[e.to].t] != null &&
    stageOf[byId[e.from].t] !== stageOf[byId[e.to].t]);
  const part = new Set();
  cross.forEach(e => { part.add(e.from); part.add(e.to); });
  FLOW.cols = STAGES.map((s, si) =>
    NODES_.filter(n => stageOf[n.t] === si && part.has(n.id))
      .sort((a, b) => (a.born || 9999) - (b.born || 9999))
      .map(n => ({ n, si, w: 0, y0: 0, h: 0, mean: [] })));
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
  const rect = flowCv.parentElement.getBoundingClientRect();
  const cw = rect.width, ch = rect.height;
  const DPR2 = window.devicePixelRatio || 1;
  flowCv.width = cw * DPR2; flowCv.height = ch * DPR2;
  const k = Math.min(cw / FLOW.W, ch / FLOW.H);
  fctx.setTransform(DPR2, 0, 0, DPR2, 0, 0);
  fctx.fillStyle = "#0d1420";
  fctx.fillRect(0, 0, cw, ch);
  fctx.translate((cw - FLOW.W * k) / 2, (ch - FLOW.H * k) / 2);
  fctx.scale(k, k);
  const g = FLOW.geom;
  /* 彩带 */
  for (const L of FLOW.links) {
    const a = L.a, b = L.b;
    const x1 = g.X0 + a.si * g.XGAP + g.BAND, x2 = g.X0 + b.si * g.XGAP;
    const y1 = a.y0 + a.h / 2, y2 = b.y0 + b.h / 2;
    const hot = flowHover && (a.n.id === flowHover || b.n.id === flowHover);
    fctx.strokeStyle = STAGES[a.si].color;
    fctx.globalAlpha = flowHover ? (hot ? 0.9 : 0.06) : 0.3;
    fctx.lineWidth = 1.2 + L.e.w * 4.5;
    fctx.beginPath();
    fctx.moveTo(x1, y1);
    fctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2);
    fctx.stroke();
  }
  fctx.globalAlpha = 1;
  /* 阶段列与节点段 */
  fctx.font = '14px Georgia,"Songti SC","SimSun",serif';
  fctx.textAlign = "center";
  FLOW.cols.forEach((col, si) => {
    const x = g.X0 + si * g.XGAP;
    fctx.fillStyle = STAGES[si].color;
    fctx.globalAlpha = 0.95;
    fctx.fillText(STAGES[si].zh, x + g.BAND / 2, g.TOP - 34);
    fctx.globalAlpha = 0.5;
    fctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
    fctx.fillText(col.length + " 个在管道中的节点", x + g.BAND / 2, g.TOP - 16);
    fctx.font = '14px Georgia,"Songti SC","SimSun",serif';
    fctx.globalAlpha = 1;
    fctx.strokeStyle = "rgba(60,80,110,0.35)";
    fctx.strokeRect(x, g.TOP - 8, g.BAND, g.BOT - g.TOP + 16);
    for (const b of col) {
      const hot = flowHover === b.n.id;
      fctx.fillStyle = STAGES[si].color;
      fctx.globalAlpha = flowHover && !hot ? 0.25 : 0.9;
      fctx.fillRect(x, b.y0, g.BAND, b.h);
      if (hot) {
        fctx.strokeStyle = "#d9b36c"; fctx.lineWidth = 1.5;
        fctx.strokeRect(x - 2, b.y0 - 2, g.BAND + 4, b.h + 4);
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
}
flowCv.addEventListener("mousemove", ev => {
  if (!flowBuilt) return;
  const rect = flowCv.getBoundingClientRect();
  const k = Math.min(rect.width / FLOW.W, rect.height / FLOW.H);
  const wx = (ev.clientX - rect.left - (rect.width - FLOW.W * k) / 2) / k;
  const wy = (ev.clientY - rect.top - (rect.height - FLOW.H * k) / 2) / k;
  const g = FLOW.geom;
  let hit = null;
  for (const col of FLOW.cols) for (const b of col) {
    const x = g.X0 + b.si * g.XGAP;
    if (wx >= x && wx <= x + g.BAND && wy >= b.y0 && wy <= b.y0 + b.h) { hit = b.n; break; }
  }
  if (hit !== flowHover) { flowHover = hit ? hit.id : null; drawFlow(); }
  const tip = document.getElementById("tooltip");
  if (hit) {
    tip.hidden = false;
    tip.style.left = (ev.clientX + 14) + "px"; tip.style.top = (ev.clientY + 12) + "px";
    tip.innerHTML = "<b>" + hit.zh + "</b><span class='tt-type'>" + STAGES[stageOf[hit.t]].zh + " · " + (hit.born || "?") + " 年 · 单击看概念卡</span>";
  } else tip.hidden = true;
});
flowCv.addEventListener("mouseleave", () => { flowHover = null; document.getElementById("tooltip").hidden = true; if (flowBuilt) drawFlow(); });
flowCv.addEventListener("click", () => { if (flowHover) { select(flowHover); flyTo(flowHover); } });

/* ---------- 前沿视图 ---------- */
const TYPED_EDGE_TYPES = new Set(["depends_on", "enables", "applied_in", "explains",
  "inspired_by", "composes_of", "solves", "transfers_to", "supersedes", "refines",
  "feeds_back", "formalizes", "engineers", "productizes", "accelerated"]);

function jaccardPairs() {
  /* v2: 邻域只计类型化语义边(奠基/使能/应用...), 共现纹理不参与 */
  const pool = NODES_.filter(n => n.deg >= 3 && !["Domain", "Field", "Event", "Person", "Topic"].includes(n.t));
  const nb = {};
  pool.forEach(n => { nb[n.id] = new Set(); });
  for (const e of E) {
    if (!TYPED_EDGE_TYPES.has(e.type)) continue;
    if (nb[e.from] && nb[e.to]) { nb[e.from].add(e.to); nb[e.to].add(e.from); }
  }
  const hasEdge = new Set(E.filter(e => TYPED_EDGE_TYPES.has(e.type) || e.type === "relates_to")
                          .map(e => e.from + "|" + e.to));
  const out = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    const a = pool[i], b = pool[j];
    if (hasEdge.has(a.id + "|" + b.id) || hasEdge.has(b.id + "|" + a.id)) continue;
    let common = [];
    nb[a.id].forEach(x => { if (nb[b.id].has(x)) common.push(x); });
    if (common.length < 1) continue;
    const uni = new Set([...nb[a.id], ...nb[b.id]]).size;
    let score = common.length / uni;
    if (a.dom !== b.dom) score += 0.15;
    out.push({ a, b, common: common.length, score, via: common.slice(0, 3).map(id => byId[id].zh) });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 12);
}
function bottleneckImpact() {
  /* 瓶颈传导: 该堵点若解除, 沿奠基/组合方向两跳内有多少节点受益 */
  const out = [];
  for (const e of E) if (e.type === "blocked_by") {
    const tech = byId[e.from];
    const seen = new Set([e.from]);
    let frontier = [e.from], impact = 0;
    for (let d = 0; d < 2; d++) {
      const next = [];
      for (const id of frontier)
        for (const ee of byId[id].out)
          if ((ee.type === "enables" || ee.type === "composes_of" || ee.type === "productizes") &&
              !seen.has(ee.to)) { seen.add(ee.to); next.push(ee.to); impact++; }
      frontier = next;
    }
    out.push({ a: byId[e.from], b: byId[e.to], impact });
  }
  return out;
}
function growthRank() {
  return DOMAINS_.map(d => {
    const all = NODES_.filter(n => n.dom === d.id);
    const recent = all.filter(n => (n.born || 0) >= 2005).length;
    return { zh: d.zh, recent, total: all.length };
  }).filter(x => x.recent > 0).sort((a, b) => b.recent - a.recent);
}
function buildFrontier() {
  if (document.getElementById("frActive").childElementCount) return;
  const act = NODES_.filter(n => n.born >= 1950 && n.deg >= 4 && !["Event", "Person"].includes(n.t))
    .sort((a, b) => (b.born + b.deg * 1.5) - (a.born + a.deg * 1.5)).slice(0, 12);
  document.getElementById("frActive").innerHTML = act.map((n, i) =>
    '<div class="fr-item" data-go="' + n.id + '"><div class="fr-names"><i class="dot" style="background:' + TYPES[n.t].color + '"></i>' +
    n.zh + '<span class="x">·' + TYPES[n.t].zh + "</span></div><div class='fr-sub'>" + n.born + " 年生 · " + n.deg + " 条连接 · " + (n.status || "") + "</div>" +
    '<div class="fr-bar"><i style="width:' + Math.min(100, (n.born - 1940) / 0.9) + '%"></i></div></div>').join("");
  const blocks = [];
  for (const e of E) if (e.type === "blocked_by") blocks.push({ a: byId[e.from], b: byId[e.to] });
  const openPr = NODES_.filter(n => n.t === "Problem" && (n.status === "前沿" || n.status === "争议"));
  document.getElementById("frBlock").innerHTML =
    blocks.map(x => '<div class="fr-item" data-imp="' + x.a.id + '" data-go="' + x.a.id + '"><div class="fr-names"><i class="dot" style="background:' + TYPES[x.a.t].color + '"></i>' + x.a.zh + '<span class="x">受制于</span><i class="dot" style="background:' + TYPES[x.b.t].color + '"></i>' + x.b.zh + "</div>" +
      x.a.zh + '<span class="x">受制于</span><i class="dot" style="background:' + TYPES[x.b.t].color + '"></i>' + x.b.zh + "</div>" +
      "<div class='fr-sub'>" + (x.a.one || "") + "</div></div>").join("") +
    openPr.map(n => '<div class="fr-item" data-go="' + n.id + '"><div class="fr-names"><i class="dot" style="background:' + TYPES[n.t].color + '"></i>' +
      n.zh + '<span class="x">' + n.status + "</span></div><div class='fr-sub'>" + n.one + "</div></div>").join("");
  const pairs = jaccardPairs();
  document.getElementById("frPairs").innerHTML = pairs.map(p =>
    '<div class="fr-item"><div class="fr-names"><span data-go="' + p.a.id + '" style="cursor:pointer"><i class="dot" style="background:' + TYPES[p.a.t].color + '"></i>' + p.a.zh + "</span>" +
    '<span class="x">×</span><span data-go="' + p.b.id + '" style="cursor:pointer"><i class="dot" style="background:' + TYPES[p.b.t].color + '"></i>' + p.b.zh + "</span></div>" +
    "<div class='fr-sub'>经 " + (p.via.join("、") || "共同邻居") + " 传递 · 相似度 " + p.score.toFixed(2) + " — 尚无边直接相连</div>" +
    '<div class="fr-bar"><i style="width:' + Math.round(Math.min(1, p.score) * 100) + '%"></i></div></div>').join("");
  document.querySelectorAll("#view-frontier [data-go]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-go");
      switchView("map"); select(id); flyTo(id);
    });
  });
  /* 生长大陆榜 */
  const gr = growthRank();
  const grBox = document.getElementById("frGrowth");
  if (grBox) grBox.innerHTML = gr.map(g =>
    '<div class="fr-item"><div class="fr-names">' + g.zh + '</div><div class="fr-sub">2005 年以来新增 ' +
    g.recent + ' 节点 / 全域 ' + g.total + '</div><div class="fr-bar"><i style="width:' +
    Math.round(g.recent / Math.max(1, gr[0].recent) * 100) + '%"></i></div></div>').join("");
  /* 瓶颈影响面 */
  const bl = bottleneckImpact();
  const blBox = document.getElementById("frBlock");
  if (blBox && bl.length) {
    bl.forEach(x => {
      const first = blBox.querySelector('[data-imp="' + x.a.id + '"] .fr-sub');
      if (first && x.impact > 0) first.textContent += " · 若解除, 两跳内受益节点 " + x.impact + " 个";
    });
  }
  document.getElementById("heatBtn").onclick = () => {
    S.heat = !S.heat;
    document.getElementById("heatBtn").classList.toggle("on", S.heat);
    document.getElementById("heatBtn").textContent = S.heat ? "❚❚ 热力层已开启(按出生年着色, 越红越年轻) — 点击返回" : "▷ 在星图上叠加生长热力层";
    switchView("map");
  };
}

/* ---------- 领域门户 ---------- */
function renderDomain(id) {
  const d = byId[id];
  const members = NODES_.filter(n => n.dom === id && n.t !== "Domain");
  const fields = members.filter(n => n.t === "Field");
  const events = members.filter(n => n.t === "Event").sort((a, b) => a.born - b.born);
  const years = members.filter(n => n.born).map(n => n.born);
  const edgesIn = E.filter(e => byId[e.from].dom === id || byId[e.to].dom === id).length;
  let html = '<div class="dom-hero"><div class="dm-type">学科域 · DOMAIN</div><h1>' + d.zh + "</h1>" +
    '<div class="dm-en">' + d.en + "</div>" +
    '<div class="dm-stats"><span><b>' + members.length + "</b>节点</span><span><b>" + edgesIn + "</b>条边</span>" +
    (years.length ? '<span><b>' + Math.min.apply(null, years) + "–" + Math.max.apply(null, years) + "</b>时间跨度</span>" : "") + "</div>" +
    '<p class="dm-one">' + d.one + "</p>" +
    '<button class="ghost-btn" id="domMap">▷ 在星图中查看</button></div>';
  html += '<div class="dom-body">';
  html += '<div class="dom-card"><h3>子领域</h3>';
  for (const f of fields) {
    const kids = NODES_.filter(n => n.out.some(e => e.type === "part_of" && e.to === f.id))
      .sort((a, b) => b.deg - a.deg);
    html += '<div class="dom-field"><div class="df-name">' + f.zh + "<span>" + kids.length + " 个节点</span></div><div class='dom-chips'>";
    for (const kn of kids.slice(0, 10)) {
      html += '<a data-go="' + kn.id + '"><i class="dot" style="background:' + TYPES[kn.t].color + '"></i>' + kn.zh + "</a>";
    }
    if (kids.length > 10) html += '<a style="cursor:default">…+' + (kids.length - 10) + "</a>";
    html += "</div></div>";
  }
  html += "</div>";
  html += '<div class="dom-card"><h3>里程碑事件</h3>';
  for (const evn of events) html += '<div class="dom-event"><b>' + evn.born + "</b><span>" + evn.zh + "</span></div>";
  html += "</div></div>";
  document.getElementById("view-domain").innerHTML = html;
  document.getElementById("domMap").onclick = () => { switchView("map"); flyTo(id, 1.1); };
  document.querySelectorAll("#view-domain [data-go]").forEach(el => {
    el.addEventListener("click", () => {
      const gid = el.getAttribute("data-go");
      switchView("map"); select(gid); flyTo(gid);
    });
  });
}

/* ---------- 开放 API 页 ---------- */
let apiBuilt = false;
function buildApi() {
  if (apiBuilt) return;
  apiBuilt = true;
  const M = window.API_MANIFEST;
  if (M) {
    document.getElementById("apiTable").innerHTML = M.files.map(f =>
      '<div class="dom-event"><b style="width:auto">' + f.file + "</b><span>" + f.desc + ' · ' + (f.kb >= 1 ? f.kb + " KB" : f.bytes + " B") + "</span></div>").join("");
    const g = M.files.find(f => f.file === "graph.json");
    if (g) document.getElementById("apiSize").textContent = (g.kb >= 1024 ? (g.kb / 1024).toFixed(1) + " MB" : g.kb + " KB");
  }
  fetch("api/meta.json").then(r => r.ok ? r.json() : Promise.reject()).then(m => {
    const layers = m.layers ? " · 已复核层 " + m.layers.B + " / 提取层 " + m.layers.C : "";
    document.getElementById("apiFetchNote").textContent = "API 状态：在线可读 ✓ · 版次 " + m.edition + " · 生成于 " + m.generated + layers;
  }).catch(() => {
    document.getElementById("apiFetchNote").textContent = "当前是 file:// 直接打开模式——API 示例请先用本地服务器访问（python -m http.server 8123）。网页功能不受影响。";
  });
}



/* ---------- 完备度指标 ---------- */
function buildMetrics() {
  const box = document.getElementById("metricsBox");
  if (!box) return;
  const per = DOMAINS_.map(d => {
    const all = NODES_.filter(n => n.dom === d.id && n.t !== "Domain");
    const graded = all.filter(n => n.ev && n.ev[0] && n.ev[0] !== "C").length;
    return { zh: d.zh, total: all.length, graded };
  });
  const orphan = NODES_.filter(n => n.deg <= 1 && !["Domain", "Event", "Person"].includes(n.t)).length;
  const semE = E.filter(e => TYPED_EDGE_TYPES.has(e.type)).length;
  const rows = per.map(p => {
    const pct = Math.round(p.graded / Math.max(1, p.total) * 100);
    return '<div class="mx-row"><span class="mx-label">' + p.zh + '</span><span class="mx-bar"><i style="width:' +
      pct + '%;background:' + (pct >= 60 ? "#5fd68a" : pct >= 30 ? "#d9b36c" : "#e2606b") + '"></i></span><span class="mx-val">' +
      pct + '% · ' + p.total + '节点</span></div>';
  }).join("");
  const totalPct = Math.round(per.reduce((a, p) => a + p.graded, 0) / Math.max(1, NODES_.length) * 100);
  box.innerHTML = rows +
    '<div class="mx-note">彩色条 = 各域已复核(A/B级)节点占比: <b style="color:#5fd68a">绿≥60%</b> / 黄 30-60% / <b style="color:#e2606b">红&lt;30%</b>。' +
    '全图: ' + NODES_.length + " 节点 · 孤岛(≤1边) " + orphan + " · 语义类型边 " + semE + " / " + E.length +
    " · 总复核率 " + totalPct + "%。红线最长的域 = 下一批语料的优先目标。</div>";
}

/* ---------- 策展台 ---------- */
function buildCurate() {
  const st = document.getElementById("curateStatus");
  fetch("/api2/stats").then(r => r.json()).then(m => {
    st.innerHTML = "本地服务已连接 ✓ · 版次 " + m.edition + " · " + m.nodes + " 节点 / " + m.edges +
      " 边 · 待策展 <b>" + m.pending + "</b> · 右侧为待判读共现对";
    loadCurNodes();
    loadCurPairs();
    const sel = document.getElementById("curDom");
    if (sel && !sel.options.length) {
      sel.innerHTML = DOMAINS_.map(d => '<option value="' + d.id + '">' + d.zh + "</option>").join("");
      sel.onchange = () => loadCurNodes();
    }
  }).catch(() => {
    st.innerHTML = "⚠ 需要本地服务支持：请用 <b>python serve.py</b> 启动后访问本页。直接双击打开的 file:// 模式下策展写回不可用，浏览功能不受影响。";
  });
}
function loadCurNodes() {
  const dom = document.getElementById("curDom").value;
  fetch("/api2/pending?limit=25" + (dom ? "&domain=" + encodeURIComponent(dom) : ""))
    .then(r => r.json()).then(list => {
      document.getElementById("curNodeN").textContent = "· 显示 " + list.length + " 条";
      document.getElementById("curNodes").innerHTML = list.map(n =>
        '<div class="cur-item"><b>' + n.zh + '</b> <span style="color:var(--dim)">' + n.type +
        ' · ' + n.dzh + '</span><div class="ci-meta">' + (n.born != null ? n.born + " 年 · " : "") +
        "置信度 " + Math.round(n.confidence * 100) + "%</div><div style=\"color:#9aa5b5;margin-bottom:5px\">" +
        (n.one_liner || "").slice(0, 70) + "</div><div class='ci-btns'>" +
        '<button class="primary" data-act="promote" data-id="' + n.id + '">✓ 复核为B</button>' +
        '<button data-act="reject" data-id="' + n.id + '">✕ 标记剔除</button>' +
        '<button data-act="open" data-id="' + n.id + '">◎ 查看卡片</button></div></div>').join("") ||
        "<div class='cur-hint'>该域暂无待策展节点</div>";
      bindCur(document.getElementById("curNodes"));
    });
}
function loadCurPairs() {
  fetch("/api2/pairs?limit=25").then(r => r.json()).then(list => {
    document.getElementById("curPairN").textContent = "· 显示 " + list.length + " 条";
    document.getElementById("curPairs").innerHTML = list.map(p =>
      '<div class="cur-item"><b>' + p.zha + '</b> <span style="color:var(--dim)">× ' + p.zbb + "</span>" +
      '<div class="ci-meta">' + p.ta + " × " + p.tb + "</div>" +
      (p.ctx ? '<div class="ci-ctx">原文：' + p.ctx.slice(0, 90) + "…</div>" : "") +
      "<div class=ci-btns data-pair='" + p.zha + "|" + p.zbb + "'>" +
      '<button class="primary" data-t="depends_on">奠基</button>' +
      '<button data-t="enables">使能</button>' +
      '<button data-t="applied_in">应用</button>' +
      '<button data-t="explains">解释</button>' +
      '<button data-t="inspired_by">启发</button>' +
      '<button data-t="relates_to">保留</button>' +
      '<button data-t="DROP">删除</button></div></div>').join("") ||
      "<div class='cur-hint'>暂无待判读共现对</div>";
    document.querySelectorAll("#curPairs .ci-btns").forEach(box => {
      const pair = box.dataset.pair.split("|");
      box.querySelectorAll("button").forEach(b => {
        b.onclick = () => {
          fetch("/api2/semantic", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ zh1: pair[0], zh2: pair[1], type: b.dataset.t, weight: 0.5 }) })
            .then(() => loadCurPairs());
        };
      });
    });
  });
}
function bindCur(root) {
  root.querySelectorAll("button[data-act]").forEach(b => {
    b.onclick = () => {
      const act = b.dataset.act, id = b.dataset.id;
      if (act === "open") { select(id); flyTo(id); return; }
      const url = act === "promote" ? "/api2/promote" : "/api2/reject";
      const body = act === "promote" ? { ids: [id] } : { id };
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body) }).then(() => loadCurNodes());
    };
  });
}

function boot() {
  resize();
  buildLegend();
  buildStories();
  const stamp = document.getElementById("stats");
  stamp.textContent = "第一版次 · " + NODES_.length + " 节点 · " + E.length + " 边";
  document.getElementById("stampNo").textContent = "底图 · 第一版次 · " + NODES_.length + " 节点 / " + E.length + " 边";
  document.getElementById("stampDate").textContent = "绘于 2026 年 10 月";
  S.k = 0.13; S.tx = W / 2; S.ty = H / 2;
  buildMetrics();
  const warm = NODES_.length > 800 ? 80 : 240;   /* 大图降预热, 避免启动长阻塞 */
  for (let i = 0; i < warm; i++) step();   /* 预热布局, 防止 rAF 节流时开幕松散 */
  const h0 = location.hash.replace(/^#\/?/, "");
  const deepLink = h0 && h0 !== "atlas";
  if (REDUCED || deepLink) { S.year = YEAR_MAX; syncTimeUI(); }
  else { S.year = YEAR_MIN; syncTimeUI(); startPlay(6500); }   /* 开幕: 地图按年代生长 */
  if (deepLink) route(); else switchView("map", { silent: true });
  tick();
  setTimeout(mergeExt, 1200);
}
boot();

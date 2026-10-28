/* 前沿视图(四张榜单)与领域门户。搬运自 js/app.js:1363-1511, 函数体逐字保留。
 * 改动点:
 *  - 源码无顶层 DOM 引用(全部 getElementById 在函数体内), 仅加 as HTMLElement 断言。
 *  - 路由接线: viewBuilders.frontier 对应源码 switchView 的 "if (v === 'frontier') buildFrontier()"
 *    (js/app.js:1091), viewBuilders.domain 对应 "if (v === 'domain' && opts.domain) renderDomain(opts.domain)"
 *    (js/app.js:1094, S.domainId 由 router.switchView 写入)——经 initFrontier() 注册, AtlasMap boot 调用。
 *  - heatBtn 监听在源码 buildFrontier 末尾(1464-1469), 原样保留; S.heat 已在 lib/state.ts。
 *  - 类型驱动微调: deg!/out! 断言、jaccard common 显式 string[]、renderDomain 的 events/years
 *    filter 加类型谓词(born 收窄为 number, 与 TimelineView 同法)——语义与源码一致。
 */
import { DOMAINS_, E, NODES_, S, byId } from "../lib/state";
import type { GraphNode } from "../lib/types";
import { TYPES } from "../lib/theme";
import { switchView, viewBuilders } from "../lib/router";
import { flyTo } from "../lib/render";
import { select } from "./ConceptPanel";

/* ---------- 前沿视图 ---------- */
const TYPED_EDGE_TYPES = new Set(["depends_on", "enables", "applied_in", "explains",
  "inspired_by", "composes_of", "solves", "transfers_to", "supersedes", "refines",
  "feeds_back", "formalizes", "engineers", "productizes", "accelerated"]);

function jaccardPairs() {
  /* v2: 邻域只计类型化语义边(奠基/使能/应用...), 共现纹理不参与 */
  const pool = NODES_.filter(n => n.deg! >= 3 && !["Domain", "Field", "Event", "Person", "Topic"].includes(n.t));
  const nb: Record<string, Set<string>> = {};
  pool.forEach(n => { nb[n.id] = new Set(); });
  for (const e of E) {
    if (!TYPED_EDGE_TYPES.has(e.type)) continue;
    if (nb[e.from] && nb[e.to]) { nb[e.from].add(e.to); nb[e.to].add(e.from); }
  }
  const hasEdge = new Set<string>(E.filter(e => TYPED_EDGE_TYPES.has(e.type) || e.type === "relates_to")
                          .map(e => e.from + "|" + e.to));
  const out = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    const a = pool[i], b = pool[j];
    if (hasEdge.has(a.id + "|" + b.id) || hasEdge.has(b.id + "|" + a.id)) continue;
    let common: string[] = [];
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
    let frontier: string[] = [e.from], impact = 0;
    for (let d = 0; d < 2; d++) {
      const next = [];
      for (const id of frontier)
        for (const ee of byId[id].out!)
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
  if ((document.getElementById("frActive") as HTMLElement).childElementCount) return;
  const act = NODES_.filter(n => n.born! >= 1950 && n.deg! >= 4 && !["Event", "Person"].includes(n.t))
    .sort((a, b) => (b.born! + b.deg! * 1.5) - (a.born! + a.deg! * 1.5)).slice(0, 12);
  (document.getElementById("frActive") as HTMLElement).innerHTML = act.map((n, i) =>
    '<div class="fr-item" data-go="' + n.id + '"><div class="fr-names"><i class="dot" style="background:' + TYPES[n.t].color + '"></i>' +
    n.zh + '<span class="x">·' + TYPES[n.t].zh + "</span></div><div class='fr-sub'>" + n.born + " 年生 · " + n.deg + " 条连接 · " + (n.status || "") + "</div>" +
    '<div class="fr-bar"><i style="width:' + Math.min(100, (n.born! - 1940) / 0.9) + '%"></i></div></div>').join("");
  const blocks = [];
  for (const e of E) if (e.type === "blocked_by") blocks.push({ a: byId[e.from], b: byId[e.to] });
  const openPr = NODES_.filter(n => n.t === "Problem" && (n.status === "前沿" || n.status === "争议"));
  (document.getElementById("frBlock") as HTMLElement).innerHTML =
    blocks.map(x => '<div class="fr-item" data-imp="' + x.a.id + '" data-go="' + x.a.id + '"><div class="fr-names"><i class="dot" style="background:' + TYPES[x.a.t].color + '"></i>' + x.a.zh + '<span class="x">受制于</span><i class="dot" style="background:' + TYPES[x.b.t].color + '"></i>' + x.b.zh + "</div>" +
      x.a.zh + '<span class="x">受制于</span><i class="dot" style="background:' + TYPES[x.b.t].color + '"></i>' + x.b.zh + "</div>" +
      "<div class='fr-sub'>" + (x.a.one || "") + "</div></div>").join("") +
    openPr.map(n => '<div class="fr-item" data-go="' + n.id + '"><div class="fr-names"><i class="dot" style="background:' + TYPES[n.t].color + '"></i>' +
      n.zh + '<span class="x">' + n.status + "</span></div><div class='fr-sub'>" + n.one + "</div></div>").join("");
  const pairs = jaccardPairs();
  (document.getElementById("frPairs") as HTMLElement).innerHTML = pairs.map(p =>
    '<div class="fr-item"><div class="fr-names"><span data-go="' + p.a.id + '" style="cursor:pointer"><i class="dot" style="background:' + TYPES[p.a.t].color + '"></i>' + p.a.zh + "</span>" +
    '<span class="x">×</span><span data-go="' + p.b.id + '" style="cursor:pointer"><i class="dot" style="background:' + TYPES[p.b.t].color + '"></i>' + p.b.zh + "</span></div>" +
    "<div class='fr-sub'>经 " + (p.via.join("、") || "共同邻居") + " 传递 · 相似度 " + p.score.toFixed(2) + " — 尚无边直接相连</div>" +
    '<div class="fr-bar"><i style="width:' + Math.round(Math.min(1, p.score) * 100) + '%"></i></div></div>').join("");
  document.querySelectorAll("#view-frontier [data-go]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-go");
      switchView("map"); select(id); flyTo(id!);
    });
  });
  /* 生长大陆榜 */
  const gr = growthRank();
  const grBox = document.getElementById("frGrowth");
  if (grBox) grBox!.innerHTML = gr.map(g =>
    '<div class="fr-item"><div class="fr-names">' + g.zh + '</div><div class="fr-sub">2005 年以来新增 ' +
    g.recent + ' 节点 / 全域 ' + g.total + '</div><div class="fr-bar"><i style="width:' +
    Math.round(g.recent / Math.max(1, gr[0].recent) * 100) + '%"></i></div></div>').join("");
  /* 瓶颈影响面 */
  const bl = bottleneckImpact();
  const blBox = document.getElementById("frBlock");
  if (blBox && bl.length) {
    bl.forEach(x => {
      const first = blBox.querySelector<HTMLElement>('[data-imp="' + x.a.id + '"] .fr-sub');
      if (first && x.impact > 0) first.textContent += " · 若解除, 两跳内受益节点 " + x.impact + " 个";
    });
  }
  (document.getElementById("heatBtn") as HTMLElement).onclick = () => {
    S.heat = !S.heat;
    document.getElementById("heatBtn")!.classList.toggle("on", S.heat);
    document.getElementById("heatBtn")!.textContent = S.heat ? "❚❚ 热力层已开启(按出生年着色, 越红越年轻) — 点击返回" : "▷ 在星图上叠加生长热力层";
    switchView("map");
  };
}

/* ---------- 领域门户 ---------- */
type BornNode = GraphNode & { born: number };
function renderDomain(id: string) {
  const d = byId[id];
  const members = NODES_.filter(n => n.dom === id && n.t !== "Domain");
  const fields = members.filter(n => n.t === "Field");
  const events = members.filter((n): n is BornNode => n.t === "Event" && n.born != null).sort((a, b) => a.born - b.born);
  const years = members.filter((n): n is BornNode => !!n.born).map(n => n.born);
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
    const kids = NODES_.filter(n => n.out!.some(e => e.type === "part_of" && e.to === f.id))
      .sort((a, b) => b.deg! - a.deg!);
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
  (document.getElementById("view-domain") as HTMLElement).innerHTML = html;
  document.getElementById("domMap")!.onclick = () => { switchView("map"); flyTo(id, 1.1); };
  document.querySelectorAll("#view-domain [data-go]").forEach(el => {
    el.addEventListener("click", () => {
      const gid = el.getAttribute("data-go");
      switchView("map"); select(gid); flyTo(gid!);
    });
  });
}

let inited = false;
export function initFrontier() {
  if (inited) return;   /* dev StrictMode 双挂载守卫 */
  inited = true;
  viewBuilders.frontier = () => { buildFrontier(); };   /* js/app.js:1091 */
  viewBuilders.domain = (id?: string) => { if (id) renderDomain(id); };   /* js/app.js:1094 (S.domainId 由 router 写入) */
}

/* 概念卡面板。搬运自 js/app.js:687-829(panel 引用/REL_LABELS/relHTML/select), 函数体逐字保留。
 * 改动点: panel 元素引用移入函数体(Next SSR/SSG 阶段禁止模块顶层 document 访问)、
 * forceDraw → setForceDraw(true)、TS 空值断言与泛型标注。
 * render.flyTo 的面板偏移用 setPanelEl 注册(AtlasMap boot 调用)。
 */
import { S, byId, setForceDraw } from "../lib/state";
import type { GraphEdge } from "../lib/types";
import { isFossil } from "../lib/graph";
import { TYPES } from "../lib/theme";
import { flyTo, refreshHL } from "../lib/render";
import { setHash, switchView } from "../lib/router";

/* ---------- 概念卡面板 ---------- */
const REL_LABELS: Record<string, [string, string]> = {
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
function relHTML(edges: GraphEdge[], dir: "in" | "out", selfId: string): string {
  /* dir: 'in' 收到的边(更早的一端), 'out' 发出的边 */
  const groups: Record<string, string[]> = {};
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
        html += '<div class="r-ctx">原文共现：' + e.ctx!.slice(0, 80) + "…</div>";
      }
    }
  }
  return html ? '<div class="p-rel">' + html + "</div>" : "";
}
export function select(id: string | null) {
  const panel = document.getElementById("panel") as HTMLElement;
  S.sel = id;
  refreshHL();
  setForceDraw(true);
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
  const parent = n.out!.find(e => e.type === "part_of");
  const kids = n.in!.filter(e => e.type === "part_of");
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
  const markedBy = n.in!.filter(e => e.type === "marks");
  const didBy = n.in!.filter(e => e.type === "did");
  const didOut = n.out!.filter(e => e.type === "did");
  const marksOut = n.out!.filter(e => e.type === "marks");
  if (markedBy.length || didBy.length || didOut.length || marksOut.length) {
    html += '<div class="p-sec"><h4>人与时刻</h4><div class="p-rel">';
    for (const e of didBy) html += '<div class="r-head">完成者</div><a data-go="' + e.from + '"><i class="dot" style="background:' + TYPES[byId[e.from].t].color + '"></i>' + byId[e.from].zh + "</a>";
    for (const e of markedBy) html += '<div class="r-head">历史时刻</div><a data-go="' + e.from + '"><i class="dot" style="background:' + TYPES[byId[e.from].t].color + '"></i>' + byId[e.from].zh + (byId[e.from].born ? "（" + byId[e.from].born + " 年）" : "") + "</a>";
    for (const e of didOut) html += '<div class="r-head">完成</div><a data-go="' + e.to + '"><i class="dot" style="background:' + TYPES[byId[e.to].t].color + '"></i>' + byId[e.to].zh + "</a>";
    for (const e of marksOut) html += '<div class="r-head">标记</div><a data-go="' + e.to + '"><i class="dot" style="background:' + TYPES[byId[e.to].t].color + '"></i>' + byId[e.to].zh + "</a>";
    html += "</div></div>";
  }
  /* 关系 */
  const relIn = relHTML(n.in!, "in", id);
  const relOut = relHTML(n.out!, "out", id);
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
  panel.querySelector<HTMLButtonElement>(".p-close")!.onclick = () => select(null);
  document.getElementById("pFocus")!.onclick = () => flyTo(id);
  const pt = document.getElementById("pTimeline");
  if (pt) pt.onclick = () => { switchView("timeline"); };
  const pd = document.getElementById("pDomain");
  if (pd) pd.onclick = () => { switchView("domain", { domain: id }); };
  panel.querySelectorAll<HTMLAnchorElement>("[data-go]").forEach(a => {
    a.onclick = () => { const t = a.getAttribute("data-go"); select(t); flyTo(t!); };
  });
}

/* 完备度指标。搬运自 js/app.js:1534-1557(buildMetrics), 函数体逐字保留。
 * 改动点:
 *  - 源码无 fetch、无顶层 DOM 引用(getElementById 在函数体内且自带 !box 守卫),
 *    仅加 deg! 断言与 export。
 *  - TYPED_EDGE_TYPES 为源码 js/app.js:1363 的全局 Set(唯一一处定义), 已由
 *    FrontierView.ts 模块级搬运并 export, 此处相对路径 import 复用。
 *  - boot 调用点(js/app.js:1641)由 AtlasMap.tsx boot 接回。
 *  注: 任务书第 3 条提到 "源码 fetch('api/meta.json') 改 loadMeta()"——经 sed 读源确认,
 *    buildMetrics 无任何 fetch(meta.json 的读取在 buildApi, 已按第 2 条随 apiFetchNote 改造)。
 */
import { DOMAINS_, E, NODES_ } from "../lib/state";
import { TYPED_EDGE_TYPES } from "./FrontierView";

/* ---------- 完备度指标 ---------- */
export function buildMetrics() {
  const box = document.getElementById("metricsBox");
  if (!box) return;
  const per = DOMAINS_.map(d => {
    const all = NODES_.filter(n => n.dom === d.id && n.t !== "Domain");
    const graded = all.filter(n => n.ev && n.ev[0] && n.ev[0] !== "C").length;
    return { zh: d.zh, total: all.length, graded };
  });
  const orphan = NODES_.filter(n => n.deg! <= 1 && !["Domain", "Event", "Person"].includes(n.t)).length;
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

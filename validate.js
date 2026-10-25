/* 数据完整性校验: node validate.js */
const fs = require("fs");
const vm = require("vm");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("js/data.js", "utf8") + "\n; this.__out = {TYPES, EDGE_TYPES, DOMAINS, NODES, EDGES, STORIES};", ctx);
const { TYPES, EDGE_TYPES, DOMAINS, NODES, EDGES, STORIES } = ctx.__out;

const errs = [], warns = [];
const ids = new Set();
for (const n of NODES) {
  if (ids.has(n.id)) errs.push(`重复节点id: ${n.id}`);
  ids.add(n.id);
  if (!TYPES[n.t]) errs.push(`${n.id}: 非法类型 ${n.t}`);
  if (!n.zh || !n.one) errs.push(`${n.id}: 缺 zh 或 one`);
  if (!n.ev || !n.ev.length) warns.push(`${n.id}: 无证据`);
  if (!DOMAINS.find(d => d.id === n.dom)) errs.push(`${n.id}: 非法域 ${n.dom}`);
}
let partOf = 0;
for (const [from, to, type, w, since] of EDGES) {
  if (!ids.has(from)) errs.push(`边起点不存在: ${from} → ${to} (${type})`);
  if (!ids.has(to)) errs.push(`边终点不存在: ${from} → ${to} (${type})`);
  if (!EDGE_TYPES[type]) errs.push(`非法边类型: ${type} (${from}→${to})`);
  if (type === "part_of") partOf++;
  if (w !== undefined && (w < 0 || w > 1)) errs.push(`权重越界: ${from}→${to} ${w}`);
}
// 自环
for (const [f, t] of EDGES) if (f === t) errs.push(`自环: ${f}`);
// 孤岛(无边节点)
const deg = {};
for (const [f, t] of EDGES) { deg[f] = (deg[f] || 0) + 1; deg[t] = (deg[t] || 0) + 1; }
for (const n of NODES) if (!deg[n.id]) warns.push(`孤岛节点(无边): ${n.id} ${n.zh}`);
// 低连接节点
for (const n of NODES) if (deg[n.id] === 1 && n.t !== "Event" && n.t !== "Person" && n.t !== "Dataset" && n.t !== "Product" && n.t !== "Material" && n.t !== "Problem")
  warns.push(`仅1条边的非叶节点: ${n.id} ${n.zh} (${n.t})`);
// 故事引用
for (const s of STORIES) for (const st of s.steps) if (!ids.has(st.id)) errs.push(`故事 ${s.id} 引用不存在节点: ${st.id}`);
// 连通性 (忽略事件/人物叶节点后, 主图应连通)
const adj = {};
for (const [f, t] of EDGES) { (adj[f] = adj[f] || new Set()).add(t); (adj[t] = adj[t] || new Set()).add(f); }
const skip = new Set(NODES.filter(n => ["Event", "Person"].includes(n.t)).map(n => n.id));
const seen = new Set(); const start = NODES.find(n => !skip.has(n.id)).id;
const q = [start]; seen.add(start);
while (q.length) { const c = q.pop(); for (const nb of adj[c] || []) if (!seen.has(nb) && !skip.has(nb)) { seen.add(nb); q.push(nb); } }
const main = NODES.filter(n => !skip.has(n.id));
const off = main.filter(n => !seen.has(n.id));
if (off.length) errs.push(`主图不连通, 脱离组件: ${off.map(n => n.zh).join("、")}`);

const byType = {}; for (const n of NODES) byType[n.t] = (byType[n.t] || 0) + 1;
const byDom = {}; for (const n of NODES) byDom[n.dom] = (byDom[n.dom] || 0) + 1;
const degList = Object.entries(deg).map(([id, d]) => ({ id, d })).sort((a, b) => b.d - a.d);

console.log("=== 校验结果 ===");
console.log(`节点: ${NODES.length}  边: ${EDGES.length} (其中隶属边 ${partOf})  语义边: ${EDGES.length - partOf}`);
console.log(`平均度: ${(2 * EDGES.length / NODES.length).toFixed(1)}  最高度: ${degList.slice(0, 8).map(x => `${x.id}(${x.d})`).join(", ")}`);
console.log("节点类型分布:", JSON.stringify(byType));
console.log("域分布:", JSON.stringify(byDom));
if (errs.length) { console.log("\n❌ 错误:"); errs.forEach(e => console.log("  " + e)); process.exit(1); }
if (warns.length) { console.log("\n⚠️ 提示:"); warns.forEach(w => console.log("  " + w)); }
console.log("\n✅ 数据校验通过");

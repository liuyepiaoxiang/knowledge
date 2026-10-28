/* 生成静态开放 API: node scripts/build-api.mjs
 * 输出 api/meta.json, nodes.json, edges.json, graph.json, stories.json, manifest.js
 * 在 js/data.js 每次更新后重跑, 保证 API 与网站同源 */
import { fileURLToPath } from "node:url";
import path from "node:path";
process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
import fs from "node:fs";
import vm from "node:vm";

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("js/data.js", "utf8") + "\n; this.__out = {TYPES, EDGE_TYPES, DOMAINS, NODES, EDGES, STORIES};", ctx);
const { TYPES, EDGE_TYPES, DOMAINS, NODES, EDGES, STORIES } = ctx.__out;

const deg = {};
for (const [f, t] of EDGES) { deg[f] = (deg[f] || 0) + 1; deg[t] = (deg[t] || 0) + 1; }
const nodes = NODES.map(n => Object.assign({ degree: deg[n.id] || 0 }, n));
const edges = EDGES.map(([from, to, type, weight, since]) => ({
  from, to, type, weight: weight == null ? 0.5 : weight,
  since: since == null ? null : since,
  grade: type === "marks" ? "A" : "B"
}));
const meta = {
  name: "知识大地 Terra Cognita · 人类知识与技术底图",
  edition: "v0.1",
  generated: new Date().toISOString().slice(0, 10),
  counts: { nodes: nodes.length, edges: edges.length, domains: DOMAINS.length },
  license: "来源数据遵循其原始许可(Wikipedia 内容 CC BY-SA, 需署名+相同方式共享); 请保留证据溯源字段",
  domains: DOMAINS
};
fs.mkdirSync("api", { recursive: true });
const w = (file, data) => fs.writeFileSync(path.join("api", file), data);
w("meta.json", JSON.stringify(meta, null, 1));
w("nodes.json", JSON.stringify(nodes, null, 1));
w("edges.json", JSON.stringify(edges, null, 1));
w("graph.json", JSON.stringify(Object.assign({}, meta, { nodes, edges })));
w("stories.json", JSON.stringify(STORIES, null, 1));
const files = ["meta.json", "nodes.json", "edges.json", "graph.json", "stories.json"].map(f => {
  const bytes = fs.statSync(path.join("api", f)).size;
  const desc = { "meta.json": "版次/计数/许可/域清单", "nodes.json": "全部节点(含类型/名称/年代/状态/证据/置信度/度)", "edges.json": "全部边(含类型/权重/起始年/证据等级)", "graph.json": "全图 = meta + nodes + edges, 一次拉取", "stories.json": "故事导览脚本" }[f];
  return { file: f, desc, bytes, kb: Math.round(bytes / 102.4) / 10 };
});
w("manifest.js", "/* 由 build-api.mjs 生成 */\nwindow.API_MANIFEST = " + JSON.stringify({ generated: meta.generated, files }, null, 1) + ";");
console.log("✓ api/ 已生成:", files.map(f => f.file + " " + f.kb + "KB").join(", "));

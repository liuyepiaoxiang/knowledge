/* 数据完整性校验: node scripts/validate.mjs
 * 校验 public/data/ 导出产物 (export.py 输出):
 *   - core/ext 节点 id 唯一 (含合并后全表)
 *   - 边端点存在于节点表 (core/ext 边均查 core+ext 合并表)
 *   - stories 步骤引用的节点 id 存在 */
import { fileURLToPath } from "node:url";
import path from "node:path";
process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
import fs from "node:fs";

const DATA = path.join("public", "data");
for (const f of ["core.json", "ext.json", "meta.json"]) {
  if (!fs.existsSync(path.join(DATA, f))) {
    console.error(`❌ 缺少 public/data/${f} (先运行 python scripts/export.py)`);
    process.exit(1);
  }
}
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const core = read("core.json");
const ext = read("ext.json");
const meta = read("meta.json");

const errs = [];
const coreIds = new Set(), extIds = new Set();
for (const n of core.nodes) {
  if (coreIds.has(n.id)) errs.push(`core 重复节点id: ${n.id}`);
  coreIds.add(n.id);
}
for (const n of ext.nodes) {
  if (extIds.has(n.id)) errs.push(`ext 重复节点id: ${n.id}`);
  extIds.add(n.id);
  if (coreIds.has(n.id)) errs.push(`core/ext 重复节点id: ${n.id}`);
}
const allIds = new Set([...coreIds, ...extIds]);

const checkEdges = (list, label) => {
  list.forEach((e, i) => {
    const [from, to] = e;
    if (!allIds.has(from)) errs.push(`${label}边[${i}] 起点不存在: ${from} → ${to}`);
    if (!allIds.has(to)) errs.push(`${label}边[${i}] 终点不存在: ${from} → ${to}`);
  });
};
checkEdges(core.edges, "core");
checkEdges(ext.edges, "ext");

let steps = 0;
for (const s of core.stories || []) {
  for (const st of s.steps || []) {
    steps++;
    if (!allIds.has(st.id)) errs.push(`故事 ${s.id} 引用不存在节点: ${st.id}`);
  }
}

console.log("=== 校验结果 (public/data) ===");
console.log(`版次: ${meta.edition}  生成: ${meta.generated}`);
console.log(`core 节点: ${core.nodes.length}  core 边: ${core.edges.length}`);
console.log(`ext 节点: ${ext.nodes.length}  ext 边: ${ext.edges.length}  故事步: ${steps}`);
if (errs.length) {
  console.log("\n❌ FAIL:");
  errs.slice(0, 50).forEach(e => console.log("  " + e));
  if (errs.length > 50) console.log(`  … 共 ${errs.length} 条错误`);
  process.exit(1);
}
console.log("\n✅ PASS 数据校验通过");

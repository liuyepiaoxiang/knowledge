/* 开放 API 视图。搬运自 js/app.js:1512-1531(apiBuilt/buildApi), 表格渲染逐字保留。
 * 改动点(本任务授权的差异化改动):
 *  - window.API_MANIFEST 全局(源码由 index.html:219 <script src="api/manifest.js"> 标签加载)
 *    → 动态注入 <script src="/data/manifest.js">(public/data/manifest.js, 内容为
 *    window.API_MANIFEST = {...}), onload 后渲染 apiTable; 已存在则直接渲染。
 *    script 带 id 防重复注入。window 类型声明用 (window as any).API_MANIFEST。
 *  - 源码 fetch("api/meta.json") 的在线实测(apiFetchNote 成功/file:// 两分支文案):
 *    迁移后大体积数据文件(nodes/edges/graph.json)不随站点部署(404), 提示文案改为
 *    本地管线再生说明; apiTable 行与 apiSize 渲染逐字保留(表格展示端点清单, 不实际下载)。
 *  - 路由接线: viewBuilders.api 对应源码 switchView 的 "if (v === 'api') buildApi()"
 *    (js/app.js:1176, lib/router.ts:29 已有 viewBuilders.api?.() 调用点)——经
 *    initApi() 注册, AtlasMap boot 调用。apiBuilt 守卫在源码 buildApi 开头, 原样保留。
 */
import { viewBuilders } from "../lib/router";

/* ---------- 开放 API 页 ---------- */
let apiBuilt = false;

type ManifestFile = { file: string; desc: string; kb: number; bytes: number };

function renderApiTable() {
  const M = (window as any).API_MANIFEST as { files: ManifestFile[] } | undefined;
  if (M) {
    document.getElementById("apiTable")!.innerHTML = M.files.map(f =>
      '<div class="dom-event"><b style="width:auto">' + f.file + "</b><span>" + f.desc + ' · ' + (f.kb >= 1 ? f.kb + " KB" : f.bytes + " B") + "</span></div>").join("");
    const g = M.files.find(f => f.file === "graph.json");
    if (g) document.getElementById("apiSize")!.textContent = (g.kb >= 1024 ? (g.kb / 1024).toFixed(1) + " MB" : g.kb + " KB");
  }
}

function buildApi() {
  if (apiBuilt) return;
  apiBuilt = true;
  if ((window as any).API_MANIFEST) renderApiTable();
  else {
    let s = document.getElementById("tcApiManifestScript") as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = "tcApiManifestScript";
      s.src = "/data/manifest.js";
      document.head.appendChild(s);
    }
    s.addEventListener("load", renderApiTable);
  }
  document.getElementById("apiFetchNote")!.textContent =
    "大体积数据文件（nodes/edges/graph.json）不随站点部署，可由本地管线 python scripts/export.py 重新生成";
}

let inited = false;
export function initApi() {
  if (inited) return;   /* dev StrictMode 双挂载守卫 */
  inited = true;
  viewBuilders.api = () => { if (!apiBuilt) buildApi(); };   /* js/app.js:1176 */
}

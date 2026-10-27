import { S, byId, setForceDraw } from "./state";

/* ---------- 视图切换与哈希路由 (js/app.js:1162-1211 搬运) ---------- */
export const VIEW_SECTIONS: Record<string, string> = { map: "view-map", flow: "view-flow", frontier: "view-frontier", timeline: "view-timeline", about: "view-about", api: "view-api", domain: "view-domain", curate: "view-curate" };
export const VIEW_HASH: Record<string, string> = { map: "atlas", flow: "flow", frontier: "frontier", timeline: "timeline", about: "about", api: "api", domain: "domain", curate: "curate" };
export const VIEW_TITLE: Record<string, string> = { map: "星图", flow: "河流 · 成熟度管道", frontier: "前沿", timeline: "时间轴", about: "图志", api: "开放 API", domain: "领域", curate: "策展台" };

/** 各视图注册懒构建器（FlowView/TimelineView 等在挂载时注册），解耦 route() 对视图模块的直接依赖。
 *  domain 构建器接收域节点 id（对应源码 renderDomain(domain)）。 */
export const viewBuilders: Record<string, (arg?: string) => void> = {};

/** 节点选中回调（route 的 #/node/:id 分支调用源码 select(arg)；AtlasMap 挂载时注册） */
export const routeSelect: { fn: ((id: string) => void) | null } = { fn: null };

export function setHash(h: string): void {
  if (location.hash !== h) history.replaceState(null, "", h);
}

export function switchView(v: string, opts?: { silent?: boolean; domain?: string }): void {
  opts = opts || {};
  S.view = v;
  setForceDraw(true);
  document.body.dataset.view = v;
  document.querySelectorAll<HTMLElement>(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === v));
  for (const k in VIEW_SECTIONS) document.getElementById(VIEW_SECTIONS[k])!.hidden = k !== v;
  if (v === "timeline") viewBuilders.timeline?.();
  if (v === "flow") viewBuilders.flow?.();
  if (v === "frontier") viewBuilders.frontier?.();
  if (v === "api") viewBuilders.api?.();
  if (v === "curate") viewBuilders.curate?.();
  if (v === "domain" && opts.domain) { S.domainId = opts.domain; viewBuilders.domain?.(opts.domain); }
  const h = v === "domain" ? "#/domain/" + (opts.domain || S.domainId) : "#/" + VIEW_HASH[v];
  setHash(h);
  document.title = VIEW_TITLE[v] + " · 知识大地 Terra Cognita";
}

export function route(): void {
  const h = location.hash.replace(/^#\/?/, "");
  if (!h) { switchView("map", { silent: true }); return; }
  const slash = h.indexOf("/");
  const head = slash < 0 ? h : h.slice(0, slash);
  const arg = slash < 0 ? null : h.slice(slash + 1);
  if (head === "node" && arg && byId[arg]) {
    if (S.view !== "map") { S.view = "map"; document.body.dataset.view = "map"; for (const k in VIEW_SECTIONS) document.getElementById(VIEW_SECTIONS[k])!.hidden = k !== "map"; }
    routeSelect.fn?.(arg);
    S.needFly = arg;   /* 相机飞行推迟到画布尺寸就绪 */
  } else if (head === "domain" && arg && byId[arg]) {
    switchView("domain", { domain: arg });
  } else {
    const v = Object.keys(VIEW_HASH).find(k => VIEW_HASH[k] === head) || "map";
    switchView(v, { silent: true });
  }
}
/* 源码此处还有 window.addEventListener("hashchange", route) 与 .tab onclick 绑定 —— 由 Task 7 的 AtlasMap useEffect 注册，router.ts 只提供 route/switchView 导出 */

/* 策展台视图。搬运自 js/app.js:1558-1630(buildCurate/loadCurNodes/loadCurPairs/bindCur),
 * curDom 下拉、curNodes/curPairs 列表渲染、promote/reject/semantic 的 POST、
 * bindCur 的 data-act 处理(open → select+flyTo 查看卡片)逐字保留。
 * 改动点(本任务授权的差异化改动):
 *  - 线上失败提示: 源码 fetch("/api2/stats") 的 .catch 文案("⚠ 需要本地服务支持:请用
 *    python serve.py 启动…file:// 模式…")改为 fetch 失败/非 ok 时统一显示本地模式说明;
 *    本地 serve.py 下流程完全不变(成功分支逐字保留)。
 *  - 路由接线: viewBuilders.curate 对应源码 switchView 的 "if (v === 'curate') buildCurate()"
 *    (js/app.js:1177, lib/router.ts:30 已有 viewBuilders.curate?.() 调用点)——经
 *    initCurate() 注册, AtlasMap boot 调用。
 */
import { viewBuilders } from "../lib/router";
import { DOMAINS_ } from "../lib/state";
import { flyTo } from "../lib/render";
import { select } from "./ConceptPanel";

/* ---------- 策展台 ---------- */
type CurStats = { edition: string | number; nodes: number; edges: number; pending: number };
type CurNode = { id: string; zh: string; type: string; dzh: string; born: number | null; confidence: number; one_liner?: string };
type CurPair = { zha: string; zbb: string; ta: string; tb: string; ctx?: string };

function buildCurate() {
  const st = document.getElementById("curateStatus");
  fetch("/api2/stats")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json() as Promise<CurStats>; })
    .then(m => {
      st!.innerHTML = "本地服务已连接 ✓ · 版次 " + m.edition + " · " + m.nodes + " 节点 / " + m.edges +
        " 边 · 待策展 <b>" + m.pending + "</b> · 右侧为待判读共现对";
      loadCurNodes();
      loadCurPairs();
      const sel = document.getElementById("curDom") as HTMLSelectElement | null;
      if (sel && !sel.options.length) {
        sel.innerHTML = DOMAINS_.map(d => '<option value="' + d.id + '">' + d.zh + "</option>").join("");
        sel.onchange = () => loadCurNodes();
      }
    }).catch(() => {
      document.getElementById("curateStatus")!.textContent =
        "策展工作台仅本地模式可用 —— 在仓库根目录运行 python scripts/serve.py 后访问本地地址的 #/curate";
    });
}
function loadCurNodes() {
  const dom = (document.getElementById("curDom") as HTMLSelectElement).value;
  fetch("/api2/pending?limit=25" + (dom ? "&domain=" + encodeURIComponent(dom) : ""))
    .then(r => r.json() as Promise<CurNode[]>).then(list => {
      document.getElementById("curNodeN")!.textContent = "· 显示 " + list.length + " 条";
      document.getElementById("curNodes")!.innerHTML = list.map(n =>
        '<div class="cur-item"><b>' + n.zh + '</b> <span style="color:var(--dim)">' + n.type +
        ' · ' + n.dzh + '</span><div class="ci-meta">' + (n.born != null ? n.born + " 年 · " : "") +
        "置信度 " + Math.round(n.confidence * 100) + "%</div><div style=\"color:#9aa5b5;margin-bottom:5px\">" +
        (n.one_liner || "").slice(0, 70) + "</div><div class='ci-btns'>" +
        '<button class="primary" data-act="promote" data-id="' + n.id + '">✓ 复核为B</button>' +
        '<button data-act="reject" data-id="' + n.id + '">✕ 标记剔除</button>' +
        '<button data-act="open" data-id="' + n.id + '">◎ 查看卡片</button></div></div>').join("") ||
        "<div class='cur-hint'>该域暂无待策展节点</div>";
      bindCur(document.getElementById("curNodes")!);
    });
}
function loadCurPairs() {
  fetch("/api2/pairs?limit=25").then(r => r.json() as Promise<CurPair[]>).then(list => {
    document.getElementById("curPairN")!.textContent = "· 显示 " + list.length + " 条";
    document.getElementById("curPairs")!.innerHTML = list.map(p =>
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
    document.querySelectorAll<HTMLElement>("#curPairs .ci-btns").forEach(box => {
      const pair = box.dataset.pair!.split("|");
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
function bindCur(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach(b => {
    b.onclick = () => {
      const act = b.dataset.act, id = b.dataset.id!;
      if (act === "open") { select(id); flyTo(id); return; }
      const url = act === "promote" ? "/api2/promote" : "/api2/reject";
      const body = act === "promote" ? { ids: [id] } : { id };
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body) }).then(() => loadCurNodes());
    };
  });
}

let inited = false;
export function initCurate() {
  if (inited) return;   /* dev StrictMode 双挂载守卫 */
  inited = true;
  viewBuilders.curate = () => buildCurate();   /* js/app.js:1177 */
}

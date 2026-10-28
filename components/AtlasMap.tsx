"use client";

/* 星图画布主组件: 异步启动 + boot + 指针交互 + ext 懒加载合并。
 * 搬运自 js/app.js:14-48(mergeExt), 608-686(pickNode/指针交互), 1200-1201(hashchange/tab),
 * 1632-1653(boot)。骨架 DOM 在 app/page.tsx, 组件本身不渲染任何内容。
 */
import { useEffect } from "react";
import { loadCore, loadExt } from "@/lib/loader";
import {
  CN_TOPIC_EDGES, DOMAIN_IDS, E, NODES_, P, REDUCED, S, YEAR_MAX, YEAR_MIN,
  byId, canvasSize, initGraph, setCNAll, setForceDraw,
} from "@/lib/state";
import type { GraphEdge } from "@/lib/types";
import { SXA, SYA, flyTo, initRender, refreshHL, resize, setPanelEl, tick, zoomAt } from "@/lib/render";
import { createSimWorker, reheat, sendPin, sendSimAdd, sendSimInit, sendUnpin, step } from "@/lib/sim";
import { route, routeSelect, switchView } from "@/lib/router";
import { isFossil, shownIdx } from "@/lib/graph";
import { TYPES } from "@/lib/theme";
import { select } from "./ConceptPanel";
import { initTimeBar, startPlay, syncTimeUI } from "./TimeBar";
import { buildLegend } from "./Legend";
import { buildStories } from "./Stories";
import { initSearch } from "./SearchBox";
import { initTimeline } from "./TimelineView";
import { initFlow } from "./FlowView";
import { initFrontier } from "./FrontierView";
import { initApi } from "./ApiView";
import { initCurate } from "./CurateView";
import { buildMetrics } from "./MetricsBox";

/* dev StrictMode 下 effect 双调用守卫: boot/rAF 循环/Worker 只启动一次 */
let started = false;

/* ---------- ConceptNet 扩展层延迟合并 (js/app.js:14-48 原样改造) ----------
 * 改动点: fetch("js/data_ext.json") → loadExt(); CN_ALL_EDGES 赋值 → setCNAll();
 * simWorker/workerReady 私有变量 → sendSimAdd() 统一守卫; forceDraw → setForceDraw(true)。 */
function mergeExt() {
  loadExt().then(ext => {
    for (const n of ext.nodes) { n.deg = 0; n.out = []; n.in = []; n.idx = NODES_.length; NODES_.push(n); byId[n.id] = n; }
    for (const e of ext.edges) {
      const edge: GraphEdge = { from: e[0] as string, to: e[1] as string, type: e[2] as string,
                     w: e[3] == null ? 0.5 : (e[3] as number),
                     since: e[4] == null ? null : (e[4] as number),
                     grade: e[2] === "marks" ? "A" : "B",
                     ctx: e.length > 5 ? (e[5] as string) : null };
      byId[e[0] as string].out!.push(edge); byId[e[1] as string].in!.push(edge);
      byId[e[0] as string].deg!++; byId[e[1] as string].deg!++;
      const na = byId[e[0] as string], nb = byId[e[1] as string];
      if (na.t === "Topic" && nb.t === "Topic") {
        CN_TOPIC_EDGES.push(edge);
      } else {
        E.push(edge);
      }
    }
    setCNAll(E.concat(CN_TOPIC_EDGES));
    reheat(0.15);
    /* 发送新增节点到 Worker (js/app.js:33-45 逐字) */
    const cnNew = ext.nodes;
    const count = cnNew.length;
    const px = new Float32Array(count), py = new Float32Array(count);
    const isT = new Uint8Array(count), dI = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
        const n = cnNew[i];
        px[i] = P.x[n.idx!] || 0; py[i] = P.y[n.idx!] || 0;
        isT[i] = 1; dI[i] = DOMAIN_IDS.indexOf(n.dom) & 0xFF;
    }
    sendSimAdd(count, px, py, isT, dI);
    setForceDraw(true);
  }).catch(() => {});
}

export default function AtlasMap() {
  useEffect(() => {
    const cvEl = document.getElementById("cv");
    if (!(cvEl instanceof HTMLCanvasElement)) return;
    const cv: HTMLCanvasElement = cvEl;

    let extTimer: ReturnType<typeof setTimeout> | null = null;
    let errDiv: HTMLDivElement | null = null;

    /* ---------- 错误层 (数据加载失败) ---------- */
    function showError(err: Error) {
      const host = document.getElementById("view-map");
      if (!host || errDiv) return;
      errDiv = document.createElement("div");
      errDiv.className = "load-error";
      errDiv.style.cssText =
        "position:absolute;top:0;left:0;right:0;z-index:60;text-align:center;" +
        "color:#ff6b6b;padding:16px;font-size:13px;";
      const span = document.createElement("span");
      span.textContent = "数据加载失败：" + err.message + " ";
      const btn = document.createElement("button");
      btn.textContent = "重试";
      btn.style.cssText =
        "margin-left:10px;padding:4px 14px;border:1px solid #ff6b6b;background:transparent;" +
        "color:#ff6b6b;cursor:pointer;border-radius:4px;font-size:12px;";
      btn.onclick = () => location.reload();
      errDiv.appendChild(span);
      errDiv.appendChild(btn);
      host.prepend(errDiv);
    }

    /* 概念卡选中: ConceptPanel.select (js/app.js:737-829, T8 搬入 components/ConceptPanel.ts) */
    routeSelect.fn = select;

    /* ---------- boot (js/app.js:1632-1653 原样改造) ---------- */
    function boot() {
      initRender(cv);
      resize();
      setPanelEl(document.getElementById("panel") as HTMLElement);   /* render.flyTo 据面板可见性偏移居中 */
      initTimeBar();      /* 年代尺事件 + render.tick 的 onTimeSync/onStopPlay 回调 */
      initSearch();       /* 搜索输入/下拉 + 全局 Escape 按键 */
      initTimeline();     /* 时间轴画布事件 + viewBuilders.timeline 注册 (T9) */
      initFlow();         /* 河流图画布事件 + onResize 回调 + viewBuilders.flow 注册 (T10) */
      initFrontier();     /* 前沿榜单与领域门户 + viewBuilders.frontier/domain 注册 (T10) */
      initApi();          /* 开放 API 视图 + viewBuilders.api 注册 (T11) */
      initCurate();       /* 策展台视图 + viewBuilders.curate 注册 (T12) */
      buildLegend();
      buildStories();
      const stamp = document.getElementById("stats");
      if (stamp) stamp.textContent = "第一版次 · " + NODES_.length + " 节点 · " + E.length + " 边";
      const stampNo = document.getElementById("stampNo");
      if (stampNo) stampNo.textContent = "底图 · 第一版次 · " + NODES_.length + " 节点 / " + E.length + " 边";
      const stampDate = document.getElementById("stampDate");
      if (stampDate) stampDate.textContent = "绘于 2026 年 10 月";
      S.k = 0.13; S.tx = canvasSize.W / 2; S.ty = canvasSize.H / 2;
      buildMetrics();     /* js/app.js:1641 (T11 接回) */
      if (createSimWorker()) sendSimInit();
      const warm = NODES_.length > 800 ? 80 : 240;   /* 大图降预热, 避免启动长阻塞 */
      for (let i = 0; i < warm; i++) step();   /* 预热布局, 防止 rAF 节流时开幕松散 */
      const h0 = location.hash.replace(/^#\/?/, "");
      const deepLink = h0 && h0 !== "atlas";
      if (REDUCED || deepLink) { S.year = YEAR_MAX; syncTimeUI(); }
      else { S.year = YEAR_MIN; syncTimeUI(); startPlay(6500); }   /* 开幕: 地图按年代生长 */
      if (deepLink) route(); else switchView("map", { silent: true });
      tick();
      extTimer = setTimeout(mergeExt, 1500);
    }

    /* ---------- 指针交互 (js/app.js:607-686 原样; forceDraw → setForceDraw,
     * simWorker&&workerReady 守卫已内置于 sendPin) ---------- */
    let drag: { mode: "pan" | "node"; idx?: number; mx?: number; my?: number; tx?: number; ty?: number; moved: boolean } | null = null;   /* {mode:'pan'|'node', idx, ox, oy, moved} */
    function pickNode(mx: number, my: number) {
      const R2 = 100;
      for (const n of NODES_) {
        if (!shownIdx(n.idx!)) continue;
        const x = SXA[n.idx!], y = SYA[n.idx!];
        const dx = mx - x, dy = my - y;
        const T = TYPES[n.t];
        const r = Math.max(T.r * Math.min(S.k * 1.5, 1), 5) + 4;
        if (dx * dx + dy * dy < r * r) return n;
        if (dx > R2 || dy > R2) continue;   /* 粗略远距跳过 */
      }
      return null;
    }
    const onPointerDown = (ev: PointerEvent) => {
      S.cam = null; S.userMoved = true; setForceDraw(true);
      const rect = cv.getBoundingClientRect();
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      const n = pickNode(mx, my);
      cv.setPointerCapture(ev.pointerId);
      if (n) { drag = { mode: "node", idx: n.idx, moved: false }; P.fixed[n.idx!] = true; sendPin(n.idx!); }
      else drag = { mode: "pan", mx, my, tx: S.tx, ty: S.ty, moved: false };
      cv.classList.add("dragging");
    };
    const onPointerMove = (ev: PointerEvent) => {
      setForceDraw(true);
      const rect = cv.getBoundingClientRect();
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      if (drag) {
        if (drag.mode === "node") {
          P.x[drag.idx!] = (mx - S.tx) / S.k; P.y[drag.idx!] = (my - S.ty) / S.k;
          P.vx[drag.idx!] = 0; P.vy[drag.idx!] = 0;
          drag.moved = true; reheat(0.05);
        sendPin(drag.idx!);
        } else {
          S.tx = drag.tx! + (mx - drag.mx!); S.ty = drag.ty! + (my - drag.my!);
          if (Math.abs(mx - drag.mx!) + Math.abs(my - drag.my!) > 3) drag.moved = true;
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
        tip!.hidden = false;
        tip!.style.left = (ev.clientX + 14) + "px";
        tip!.style.top = (ev.clientY + 12) + "px";
        tip!.innerHTML = "<b>" + n.zh + "</b>" +
          '<span class="tt-type">' + T.zh + (n.born ? " · " + n.born + " 年" : "") +
          (isFossil(n) ? " · 已被推翻" : "") + "</span>";
      } else tip!.hidden = true;
    };
    const onPointerUp = () => {
      if (!drag) return;
      if (drag.mode === "node") { P.fixed[drag.idx!] = false; sendUnpin(drag.idx!); }
      const wasClick = !drag.moved;
      if (wasClick && drag.mode === "node") {
        select(NODES_[drag.idx!].id);
      } else if (wasClick && drag.mode === "pan") {
        select(null);
      }
      drag = null;
      cv.classList.remove("dragging");
    };
    const onDblClick = (ev: MouseEvent) => {
      const rect = cv.getBoundingClientRect();
      const n = pickNode(ev.clientX - rect.left, ev.clientY - rect.top);
      if (n) flyTo(n.id);
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault(); S.userMoved = true; setForceDraw(true);
      const rect = cv.getBoundingClientRect();
      zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, Math.exp(-ev.deltaY * 0.0012));
    };

    /* ---------- tab 导航与哈希路由 (js/app.js:1200-1201 原样) ---------- */
    const tabs = Array.from(document.querySelectorAll<HTMLElement>(".tab"));
    tabs.forEach(t => { t.onclick = () => switchView(t.dataset.view!); });
    const onHashChange = () => route();

    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("dblclick", onDblClick);
    cv.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("resize", resize);

    /* ---------- 异步启动 ---------- */
    if (!started) {
      started = true;
      loadCore().then(core => { initGraph(core); boot(); })
        .catch(err => showError(err as Error));
    }

    return () => {
      cv.removeEventListener("pointerdown", onPointerDown);
      cv.removeEventListener("pointermove", onPointerMove);
      cv.removeEventListener("pointerup", onPointerUp);
      cv.removeEventListener("dblclick", onDblClick);
      cv.removeEventListener("wheel", onWheel);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("resize", resize);
      if (extTimer) clearTimeout(extTimer);
      if (errDiv) { errDiv.remove(); errDiv = null; }
      if (routeSelect.fn === select) routeSelect.fn = null;
      tabs.forEach(t => { t.onclick = null; });
    };
  }, []);

  return null;
}

/* 搜索框。搬运自 js/app.js:908-937(搜索输入+下拉) 与 1203-1210(全局 Escape 按键,
 * 其三个分支分别依赖 searchDrop/endStory/select, 就近收入本模块), 函数体逐字保留。
 * 改动点: 元素引用与监听注册收进 initSearch()(AtlasMap boot 调用, 带 inited 守卫)、
 * TS 空值断言。下拉 innerHTML 的插值全部来自本项目静态数据(core.json 节点名/类型色),
 * 不含用户输入(searchInput.value 仅用于过滤, 不拼进 HTML)。
 */
import { NODES_, S } from "../lib/state";
import { TYPES } from "../lib/theme";
import { flyTo } from "../lib/render";
import { select } from "./ConceptPanel";
import { endStory } from "./Stories";

let inited = false;
export function initSearch() {
  if (inited) return;   /* dev StrictMode 双挂载守卫 */
  inited = true;
  const searchInput = document.getElementById("search") as HTMLInputElement;
  const searchDrop = document.getElementById("searchDrop") as HTMLElement;
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchDrop.hidden = true; return; }
    const hits = NODES_.filter(n => n.zh.toLowerCase().includes(q) || n.en!.toLowerCase().includes(q)).slice(0, 9);
    if (!hits.length) { searchDrop.hidden = true; return; }
    searchDrop.innerHTML = hits.map(n =>
      '<div class="sd-item" data-id="' + n.id + '"><span class="sd-dot" style="background:' + TYPES[n.t].color + '"></span>' +
      n.zh + '<span class="sd-en">' + TYPES[n.t].zh + (n.born ? " · " + n.born : "") + "</span></div>").join("");
    searchDrop.hidden = false;
    searchDrop.querySelectorAll<HTMLElement>(".sd-item").forEach(el => {
      el.onmousedown = ev => {
        ev.preventDefault();
        const id = el.getAttribute("data-id")!;
        select(id); flyTo(id);
        searchDrop.hidden = true; searchInput.value = ""; searchInput.blur();
      };
    });
  });
  searchInput.addEventListener("keydown", ev => {
    if (ev.key === "Enter") {
      const first = searchDrop.querySelector(".sd-item");
      if (first) { const id = first.getAttribute("data-id"); select(id); flyTo(id!); searchDrop.hidden = true; searchInput.value = ""; searchInput.blur(); }
    }
    if (ev.key === "Escape") { searchDrop.hidden = true; searchInput.blur(); }
  });
  searchInput.addEventListener("blur", () => setTimeout(() => { searchDrop.hidden = true; }, 180));

  /* ---------- 全局按键 (js/app.js:1203-1210 原样) ---------- */
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape") {
      if (!searchDrop.hidden) { searchDrop.hidden = true; return; }
      if (S.story) { endStory(); return; }
      if (S.sel) select(null);
    }
  });
}

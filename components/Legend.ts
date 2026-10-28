/* 图例与筛选。搬运自 js/app.js:873-907(buildLegend), 函数体逐字保留。
 * 改动点: forceDraw = true → setForceDraw(true)。
 * innerHTML 的插值全部来自本项目静态数据(core.json 的域/类型名与计数), 与源码同信任级别。
 */
import { DOMAINS_, NODES_, S, byId, setForceDraw } from "../lib/state";
import { shownIdx } from "../lib/graph";
import { reheat } from "../lib/sim";
import { TYPES } from "../lib/theme";
import { select } from "./ConceptPanel";

export function buildLegend() {
  const ld = document.getElementById("legendDomains")!;
  const lt = document.getElementById("legendTypes")!;
  ld.innerHTML = DOMAINS_.map(d => {
    const c = NODES_.filter(n => n.dom === d.id).length;
    return '<button class="lg-chip" data-dom="' + d.id + '"><span class="dot" style="background:#5a7ba6"></span>' + d.zh + ' <span class="n">' + c + "</span></button>";
  }).join("");
  lt.innerHTML = Object.keys(TYPES).map(t => {
    const c = NODES_.filter(n => n.t === t).length;
    if (!c) return "";
    return '<button class="lg-chip" data-type="' + t + '"><span class="dot" style="background:' + TYPES[t].color + '"></span>' + TYPES[t].zh + ' <span class="n">' + c + "</span></button>";
  }).join("");
  document.querySelectorAll<HTMLElement>("#legend .lg-chip").forEach(b => {
    b.onclick = () => {
      if (b.dataset.dom) {
        const d = b.dataset.dom;
        S.domOff.has(d) ? S.domOff.delete(d) : S.domOff.add(d);
        b.classList.toggle("off");
      } else {
        const t = b.dataset.type!;
        S.typeOff.has(t) ? S.typeOff.delete(t) : S.typeOff.add(t);
        b.classList.toggle("off");
      }
      reheat(0.1); setForceDraw(true);
      if (S.sel && !shownIdx(byId[S.sel].idx!)) select(null);
    };
  });
  document.getElementById("legendReset")!.onclick = () => {
    S.typeOff.clear(); S.domOff.clear();
    document.querySelectorAll("#legend .lg-chip.off").forEach(b => b.classList.remove("off"));
    reheat(0.1);
  };
}

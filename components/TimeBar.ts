/* 年代尺(播放/滑杆)。搬运自 js/app.js:850-872(yearRange/yearLabel/playBtn 引用、
 * syncTimeUI、startPlay、stopPlay), 函数体逐字保留。
 * 改动点: 元素引用移入函数体(避免模块顶层 document 访问)、forceDraw → setForceDraw(true)、
 * "if (tlBuilt) updateTimelineCursor()" → onTlCursor 回调(TimelineView/T9 经 setOnTlCursor 注册)、
 * 事件注册与 render 回调挂载收进 initTimeBar()(AtlasMap boot 调用, 带 inited 守卫)。
 */
import { NODES_, S, YEAR_MAX, setForceDraw } from "../lib/state";
import { sliderToYear, yearToSlider, yearOK } from "../lib/graph";
import { reheat } from "../lib/sim";
import { setOnTimeSync, setOnStopPlay } from "../lib/render";

/* 时间轴光标回调 (源码 syncTimeUI 末行 "if (tlBuilt) updateTimelineCursor()" 的解耦形态) */
let onTlCursor: (() => void) | null = null;
export function setOnTlCursor(fn: (() => void) | null): void { onTlCursor = fn; }

export function syncTimeUI() {
  const yearRange = document.getElementById("yearRange") as HTMLInputElement;
  const yearLabel = document.getElementById("yearLabel") as HTMLElement;
  setForceDraw(true);
  yearRange.value = String(yearToSlider(S.year));   /* 源码: yearRange.value = yearToSlider(S.year) */
  const visible = NODES_.filter(yearOK).length;
  yearLabel.textContent = S.year >= YEAR_MAX ? "全部年代" : (S.year < 0 ? "前 " + (-S.year) + " 年" : S.year + " 年");
  yearLabel.title = visible + " / " + NODES_.length + " 节点可见";
  if (onTlCursor) onTlCursor();
}
function startPlay(durMs: number) {
  const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
  if (S.year >= YEAR_MAX) S.year = sliderToYear(0);
  S.playT0 = performance.now();
  S.playDur = durMs || 12000;
  S.playing = true;
  playBtn.textContent = "❚❚ 暂停";
}
function stopPlay() {
  const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
  S.playing = false; playBtn.textContent = "▷ 重放生长";
}

let inited = false;
export function initTimeBar() {
  if (inited) return;   /* dev StrictMode 双挂载守卫 */
  inited = true;
  const yearRange = document.getElementById("yearRange") as HTMLInputElement;
  const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
  yearRange.addEventListener("input", () => { stopPlay(); S.year = sliderToYear(+yearRange.value); syncTimeUI(); reheat(0.1); });
  playBtn.addEventListener("click", () => { S.playing ? stopPlay() : startPlay(12000); });
  setOnTimeSync(syncTimeUI);   /* render.tick 播放分支回调 (js/app.js:562) */
  setOnStopPlay(stopPlay);     /* render.tick 播放完成回调 (js/app.js:564) */
}

export { startPlay, stopPlay };

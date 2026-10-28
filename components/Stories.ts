/* 故事导览。搬运自 js/app.js:938-976(storyBox 引用、buildStories、startStory、storyStep、
 * endStory), 函数体逐字保留。
 * 改动点: storyBox/panel 元素引用移入函数体(避免模块顶层 document 访问)、
 * TS 空值断言。storyChips 的 innerHTML 插值全部来自本项目静态数据(core.json 故事名)。
 * 源码 startStory/storyStep 索引的 STORIES(静态 data.js 兜底表)统一取 STORIES_
 * (本迁移中二者同源于 core.json, 见任务报告)。
 */
import { S, STORIES_ } from "../lib/state";
import { flyTo, refreshHL } from "../lib/render";
import { select } from "./ConceptPanel";
import { stopPlay } from "./TimeBar";

export function buildStories() {
  document.getElementById("storyChips")!.innerHTML = STORIES_.map((s, i) =>
    '<button class="chip" data-i="' + i + '">▷ ' + s.zh + "</button>").join("");
  document.querySelectorAll<HTMLElement>("#storyChips .chip").forEach(b => {
    b.onclick = () => startStory(+b.dataset.i!);
  });
  document.getElementById("storyClose")!.onclick = endStory;
  document.getElementById("storyNext")!.onclick = () => storyStep(S.story!.i + 1);
  document.getElementById("storyPrev")!.onclick = () => storyStep(S.story!.i - 1);
}
function startStory(i: number) {
  const panel = document.getElementById("panel") as HTMLElement;
  const storyBox = document.getElementById("storyBox") as HTMLElement;
  stopPlay();
  S.story = { i: -1, s: STORIES_[i] };
  select(null); panel.hidden = true;
  document.getElementById("storyTitle")!.textContent = STORIES_[i].zh + " — " + STORIES_[i].desc;
  storyBox.hidden = false;
  storyStep(0);
}
function storyStep(i: number) {
  if (!S.story) return;
  const steps = S.story.s.steps;
  if (i < 0) return;
  if (i >= steps.length) { endStory(); return; }
  S.story.i = i;
  const st = steps[i];
  document.getElementById("storyText")!.textContent = st.text;
  document.getElementById("storyStep")!.textContent = (i + 1) + " / " + steps.length;
  S.sel = st.id; refreshHL();
  flyTo(st.id, Math.max(S.k, 1.35));
  if (S.storyTimer) clearTimeout(S.storyTimer);
  S.storyTimer = setTimeout(() => { if (S.story) storyStep(S.story.i + 1); }, 6200);
}
function endStory() {
  const storyBox = document.getElementById("storyBox") as HTMLElement;
  if (S.storyTimer) clearTimeout(S.storyTimer);
  S.story = null; storyBox.hidden = true;
}

export { startStory, storyStep, endStory };

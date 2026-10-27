import { ANCIENT, NODES_, S, YEAR_MAX, byId } from "./state";
import type { GraphNode } from "./types";

/** 年代可见性 (js/app.js:300 原样, 含远古层子句) */
export function yearOK(n: GraphNode, year: number = S.year): boolean {
  return n.born == null || n.born <= year || n.born < ANCIENT;
}

/** 综合可见性 (js/app.js:301-307 原样): 年代 + 类型开关 + 域开关 */
export function shownIdx(i: number): boolean {
  const n = NODES_[i];
  if (!yearOK(n)) return false;
  if (S.typeOff.has(n.t)) return false;
  if (S.domOff.has(n.dom)) return false;
  return true;
}

/** 化石判定 (js/app.js:308 原样) */
export function isFossil(n: GraphNode, year: number = S.year): boolean {
  return n.died != null && n.died <= year;
}

/** 邻居 id 集合 (js/app.js:311-316 改造为纯函数, 加空节点守卫) */
export function neighborsOf(id: string): Set<string> {
  const n = byId[id];
  const set = new Set<string>();
  if (!n) return set;
  for (const e of n.out || []) set.add(e.to);
  for (const e of n.in || []) set.add(e.from);
  return set;
}

/** 确定性字符串散列 (js/app.js:321 原样) */
export function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ---------- 年代尺(分段线性映射: 远古压缩, 近代展开) (js/app.js:829-849 原样) ---------- */
const SLIDER_ANCHORS: [number, number][] = [
  [0, -8000], [250, -4000], [400, -2000], [500, -500], [550, 500], [620, 1200], [720, 1600],
  [800, 1760], [880, 1870], [940, 1930], [975, 1970], [1000, 2026],
];

export function sliderToYear(s: number): number {
  for (let i = 1; i < SLIDER_ANCHORS.length; i++) {
    if (s <= SLIDER_ANCHORS[i][0]) {
      const [s0, y0] = SLIDER_ANCHORS[i - 1], [s1, y1] = SLIDER_ANCHORS[i];
      return Math.round(y0 + (y1 - y0) * (s - s0) / (s1 - s0));
    }
  }
  return YEAR_MAX;
}

export function yearToSlider(y: number): number {
  if (y <= SLIDER_ANCHORS[0][1]) return 0;
  for (let i = 1; i < SLIDER_ANCHORS.length; i++) {
    if (y <= SLIDER_ANCHORS[i][1]) {
      const [s0, y0] = SLIDER_ANCHORS[i - 1], [s1, y1] = SLIDER_ANCHORS[i];
      return s0 + (s1 - s0) * (y - y0) / (y1 - y0);
    }
  }
  return 1000;
}

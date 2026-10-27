import type { GraphNode } from "./types";

/* 节点/边的视觉样式表。搬运自 js/data.js:9-57(TYPES/EDGE_TYPES), 逐字保留。
 * draw()(lib/render.ts) 与 Legend(T8) 引用; 原计划未分配归属, 收录于此。
 */
export interface TypeStyle {
  zh: string;
  color: string;
  r: number;
}
export interface EdgeTypeStyle {
  zh: string;
  color: string;
  dashed?: boolean;
  dim?: boolean;
}

export const TYPES: Record<string, TypeStyle> = {
  Domain:      { zh: "学科域",   color: "#ffd166", r: 26 },
  Field:       { zh: "子领域",   color: "#ff9e64", r: 15 },
  Topic:       { zh: "主题",     color: "#ffd9a0", r: 10 },
  Concept:     { zh: "概念",     color: "#89ddff", r: 9  },
  Theory:      { zh: "理论",     color: "#82aaff", r: 12 },
  Proposition: { zh: "命题",     color: "#7fdbca", r: 10 },
  Method:      { zh: "方法",     color: "#c792ea", r: 10 },
  Skill:       { zh: "技能",     color: "#ff6b81", r: 9  },
  Technology:  { zh: "技术",     color: "#5fd68a", r: 13 },
  Process:     { zh: "工艺",     color: "#4ecdc4", r: 10 },
  Material:    { zh: "材料",     color: "#c3e88d", r: 10 },
  Instrument:  { zh: "仪器",     color: "#59c2ff", r: 11 },
  Product:     { zh: "产品",     color: "#f5e663", r: 12 },
  Problem:     { zh: "未解问题", color: "#ff5370", r: 11 },
  Dataset:     { zh: "数据/标准",color: "#d2a8ff", r: 10 },
  Controversy: { zh: "争议",     color: "#e040fb", r: 11 },
  Person:      { zh: "人物",     color: "#e6e1cf", r: 9  },
  Event:       { zh: "事件",     color: "#ffffff", r: 8  }
};

export const EDGE_TYPES: Record<string, EdgeTypeStyle> = {
  part_of:      { zh: "属于",   color: "#2a3a55", dashed: false, dim: true },
  depends_on:   { zh: "奠基",   color: "#4b6390", dashed: false },
  enables:      { zh: "使能",   color: "#3f7f74", dashed: false },
  inspired_by:  { zh: "启发",   color: "#d9b36c", dashed: true  },
  applied_in:   { zh: "应用",   color: "#3f7f74", dashed: false },
  composes_of:  { zh: "组合",   color: "#51708f", dashed: false },
  supersedes:   { zh: "替代",   color: "#e2606b", dashed: true  },
  refines:      { zh: "修正",   color: "#e2606b", dashed: true  },
  refutes:      { zh: "反驳",   color: "#e2606b", dashed: true  },
  formalizes:   { zh: "形式化", color: "#c792ea", dashed: true  },
  engineers:    { zh: "工程化", color: "#5a9a6f", dashed: false },
  productizes:  { zh: "产品化", color: "#5a9a6f", dashed: false },
  industrializes:{zh: "产业化", color: "#5a9a6f", dashed: false },
  transfers_to: { zh: "迁移",   color: "#d9b36c", dashed: true  },
  feeds_back:   { zh: "反哺",   color: "#d9b36c", dashed: true  },
  competes_with:{ zh: "竞争",   color: "#c96bd8", dashed: true  },
  contested_by: { zh: "争议",   color: "#c96bd8", dashed: true  },
  raises:       { zh: "提出",   color: "#ff7a92", dashed: false },
  solves:       { zh: "解决",   color: "#7fdbca", dashed: false },
  constrains:   { zh: "约束",   color: "#ff7a92", dashed: true  },
  explains:     { zh: "解释",   color: "#82aaff", dashed: false },
  accelerated:  { zh: "促成",   color: "#d9b36c", dashed: true  },
  blocked_by:   { zh: "受制于", color: "#ff5370", dashed: true  },
  marks:        { zh: "标记",   color: "#3a4a68", dashed: false, dim: true },
  did:          { zh: "完成",   color: "#8b8570", dashed: false, dim: true },
  relates_to:   { zh: "关联",   color: "#3a4a68", dashed: false, dim: true }
};

/* 生长热力着色。搬运自 js/app.js:1213-1221, 逐字保留。
 * draw()(S.heat 热力层)与 FlowView(T10)共用; 原计划归 FlowView, 为避免
 * render→components 反向依赖收录于此, T10 直接 import 即可。
 */
export function heatColor(n: GraphNode): string {
  if (n.born == null) return "#5a6678";
  if (n.born < 1900) return "#3d5a80";
  if (n.born < 1950) return "#3f7f74";
  if (n.born < 1990) return "#d9b36c";
  if (n.born < 2010) return "#ff9e64";
  return "#ff5370";
}

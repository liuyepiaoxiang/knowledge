/** 节点。字段命名与 scripts/export.py 输出一致；st(种子层)/status(导出层) 同义 */
export interface GraphNode {
  id: string;
  t: string; // Domain|Field|Theory|Tech|Material|Event|Question|Topic|Person|...
  zh: string;
  en?: string | null;
  dom: string;
  born?: number | null;
  died?: number | null;
  one?: string | null;
  why?: string | null;
  ex?: string | null;
  ev?: (string | number)[];
  conf?: number;
  st?: string | null;
  status?: string | null;
  tr?: string | null;
  /** 运行时字段（initGraph/mergeExt 填充） */
  idx?: number;
  deg?: number;
  out?: GraphEdge[];
  in?: GraphEdge[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  w: number;
  since: number | null;
  grade: string;
  ctx: string | null;
}

/** 导出层边为元组: [from, to, type, w, since, (ctx)?] */
export type EdgeTuple = (string | number | null)[];

export interface Domain {
  id: string;
  zh: string;
  en?: string;
}

export interface StoryStep {
  id: string;
  text: string;
}

export interface Story {
  id: string;
  zh: string;
  desc?: string;
  steps: StoryStep[];
}

/** public/data/core.json */
export interface GraphCore {
  domains: Domain[];
  nodes: GraphNode[];
  edges: EdgeTuple[];
  stories: Story[];
}

/** public/data/ext.json（ConceptNet 扩展层） */
export interface ExtData {
  nodes: GraphNode[];
  edges: EdgeTuple[];
}

/** public/data/meta.json */
export interface Meta {
  name: string;
  edition: string;
  generated: string;
  counts: { nodes: number; edges: number; domains: number };
  layers: { B: number; C: number };
  license: string;
  domains: Domain[];
}

export function toEdge(e: EdgeTuple): GraphEdge {
  return {
    from: String(e[0]),
    to: String(e[1]),
    type: String(e[2]),
    w: e[3] == null ? 0.5 : Number(e[3]),
    since: e[4] == null ? null : Number(e[4]),
    grade: e[2] === "marks" ? "A" : "B",
    ctx: e.length > 5 ? String(e[5]) : null,
  };
}

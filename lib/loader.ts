import type { ExtData, GraphCore, Meta } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`加载失败 ${url} (HTTP ${r.status})`);
  return r.json() as Promise<T>;
}

export function loadCore(): Promise<GraphCore> {
  return fetchJson<GraphCore>("/data/core.json");
}

export function loadExt(): Promise<ExtData> {
  return fetchJson<ExtData>("/data/ext.json");
}

export function loadMeta(): Promise<Meta> {
  return fetchJson<Meta>("/data/meta.json");
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadCore, loadExt, loadMeta } from "./loader";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("loadCore", () => {
  it("解析 core.json", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ domains: [], nodes: [{ id: "a", t: "Tech", zh: "A", dom: "d" }], edges: [], stories: [] }),
    }));
    const core = await loadCore();
    expect(core.nodes).toHaveLength(1);
    expect(core.nodes[0].zh).toBe("A");
  });

  it("404 时抛出含 URL 的错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadCore()).rejects.toThrow("/data/core.json");
  });
});

describe("loadExt", () => {
  it("解析 ext.json", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ nodes: [], edges: [["a", "b", "relates_to", 0.5, null]] }),
    }));
    const ext = await loadExt();
    expect(ext.edges[0][2]).toBe("relates_to");
  });

  it("失败时抛错（调用方决定静默）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(loadExt()).rejects.toThrow();
  });
});

describe("loadMeta", () => {
  it("解析 meta.json", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "x", edition: "v0.9", generated: "2026-10-27", counts: { nodes: 1, edges: 2, domains: 3 }, layers: { B: 1, C: 2 }, license: "", domains: [] }),
    }));
    const m = await loadMeta();
    expect(m.counts.nodes).toBe(1);
  });
});

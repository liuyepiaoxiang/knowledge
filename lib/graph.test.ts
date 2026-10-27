import { describe, it, expect } from "vitest";
import { yearOK, isFossil, hashStr, sliderToYear, yearToSlider } from "./graph";
import { ANCIENT, YEAR_MIN, YEAR_MAX } from "./state";

describe("yearOK", () => {
  const node = (born: number | null) => ({ born }) as any;
  it("born 为空恒可见", () => expect(yearOK(node(null))).toBe(true));
  it("born <= 当前年可见", () => {
    expect(yearOK(node(1900), 1950)).toBe(true);
    expect(yearOK(node(1950), 1900)).toBe(false);
  });
  it("远古节点(早于年代尺)永久可见", () => {
    expect(ANCIENT).toBeLessThan(YEAR_MIN);
    expect(yearOK(node(-8500), YEAR_MIN)).toBe(true);
  });
  it("默认年参取 state.S.year", () => {
    expect(yearOK(node(3000))).toBe(false); // S.year 初始 = YEAR_MAX
  });
});

describe("isFossil", () => {
  it("died <= 当前年为化石", () => {
    expect(isFossil({ died: 1887 } as any, 1900)).toBe(true);
    expect(isFossil({ died: 1887 } as any, 1800)).toBe(false);
    expect(isFossil({ died: null } as any, 9999)).toBe(false);
  });
});

describe("hashStr", () => {
  it("确定性且非负", () => {
    expect(hashStr("半导体")).toBe(hashStr("半导体"));
    expect(hashStr("半导体")).not.toBe(hashStr("集成电路"));
    expect(hashStr("x")).toBeGreaterThanOrEqual(0);
  });
});

describe("sliderToYear / yearToSlider 互逆", () => {
  it("往返一致(锚点处)", () => {
    for (const s of [0, 250, 500, 750, 1000]) {
      const y = sliderToYear(s);
      const back = yearToSlider(y);
      if (s === 0 || s === 1000) expect(back).toBe(s);
      else expect(Math.abs(back - s)).toBeLessThan(3);
    }
  });
  it("端点映射到 YEAR_MIN/YEAR_MAX", () => {
    expect(sliderToYear(0)).toBe(YEAR_MIN);
    expect(sliderToYear(1000)).toBe(YEAR_MAX);
  });
});

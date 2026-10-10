import test from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../src/renderer.js";
import { KEYWORDS } from "../src/data.js";
test("关键词及图标换行时保持在一起，避免充能被拆成两行", () => {
  const r = new Renderer();
  const ctx = { measureText: (text) => ({ width: [...text].length * 22 }) };
  const runs = r.rich([
    { type: "text", text: "使用相邻遗物时，为此物品充能" },
    { type: "number", text: "1" },
    { type: "text", text: "秒" },
  ]);
  const lines = r.wrap(ctx, runs, 290, 22);
  const charge = lines.flat().filter((u) => u.icon === "charge");
  assert.equal(charge.length, 1);
  assert.equal(charge[0].text, "充能");
  assert.equal(
    lines.flat().some((u) => u.text === "充" || u.text === "能"),
    false,
  );
});
test("黄金品质条件使用普通文字，黄金货币使用金币图标", () => {
  const r = new Renderer();
  const condition = r.rich([{ type: "text", text: "造访黄金级遭遇事件" }]);
  assert.equal(
    condition.some((run) => run.icon === "gold"),
    false,
  );
  const reward = r.rich([{ type: "text", text: "获得黄金" }]);
  assert.equal(
    reward.some((run) => run.icon === "gold"),
    true,
  );
});
test("高温霜冻使用原始纯色且无图标，转化升级使用独立图标", () => {
  const r = new Renderer();
  for (const [id, color, icon, text] of [
    ["heated", "#ffa550", null, "高温时："],
    ["chilled", "#8ff5fc", null, "霜冻时："],
    ["transform", "#5ae6e9", "transform", "转化"],
    ["upgrade", "#b3e4e5", "upgrade", "升级"],
  ]) {
    const kw = KEYWORDS.find((k) => k.id === id);
    assert.equal(kw.color, color);
    assert.equal(kw.icon, icon);
    const runs = r.rich([{ type: "text", text }]);
    assert.equal(runs.find((run) => run.id === id).color, color);
    assert.equal(runs.find((run) => run.id === id).icon, icon);
  }
});

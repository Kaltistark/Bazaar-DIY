import test from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../src/renderer.js";
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

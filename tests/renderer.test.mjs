import test from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../src/renderer.js";
import { KEYWORDS } from "../src/data.js";
test("数字、百分号与句末标点整体换行，不留下孤立百分号", () => {
  const renderer = new Renderer();
  const ctx = { measureText: text => ({ width: [...text].length * 10 }) };
  const runs = renderer.rich([{ type: "text", text: "提高" }, { type: "number", text: "10" }, { type: "text", text: "%。" }]);
  const lines = renderer.wrap(ctx, runs, 50, 20);
  const numericLine = lines.find(line => line.some(unit => unit.text === "10"));
  assert.ok(numericLine.some(unit => unit.text === "%"));
  assert.ok(numericLine.some(unit => unit.text === "。"));
});
test("多品质数值作为整体换行，箭头与数字拥有独立间距", () => {
  const renderer = new Renderer();
  const ctx = { measureText: text => ({ width: [...text].length * 12 }) };
  const values = [{ value: "2", color: "gold" }, { value: "3", color: "cyan" }];
  const runs = renderer.rich([
    { type: "text", text: "加速物品" },
    { type: "number", text: "2", values },
    { type: "text", text: "秒" },
  ]);
  const lines = renderer.wrap(ctx, runs, 130, 26);
  const line = lines.find(line => line.some(unit => unit.values));
  assert.ok(line.some(unit => unit.text === "秒"));
  assert.deepEqual(line.find(unit => unit.values).values, values);
  assert.equal(lines.flat().filter(unit => unit.values).length, 1);
  assert.ok(line.find(unit => unit.values).width > 2 * 12 + 26);
});
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
  assert.equal(charge[0].text, "1");
  assert.ok(lines.flat().some((u) => u.text === "充能"));
  assert.equal(
    lines.flat().some((u) => u.text === "充" || u.text === "能"),
    false,
  );
});
test("任务次数为普通文字颜色，时长图标位于目标后方", () => {
  const r = new Renderer();
  const quest = r.rich([{ type: "text", text: "触发剧毒" }, { type: "number", text: "30" }, { type: "text", text: "次" }]);
  assert.equal(quest.find((run) => run.kind === "number").color, "#ffe4b3");
  const timed = r.rich([{ type: "text", text: "减速" }, { type: "number", text: "1" }, { type: "text", text: "件物品" }, { type: "number", text: "1" }, { type: "text", text: "秒" }]);
  assert.equal(timed[0].icon, null);
  assert.equal(timed.at(-2).icon, "slow");
});
test("窄行仍将时长图标、数字与秒放在同一行", () => {
  const r = new Renderer();
  const ctx = { measureText: (text) => ({ width: [...text].length * 22 }) };
  const runs = r.rich([{ type: "text", text: "加速右侧物品" }, { type: "number", text: "2" }, { type: "text", text: "秒" }]);
  const lines = r.wrap(ctx, runs, 170, 22);
  const timing = lines.find((line) => line.some((u) => u.icon === "haste"));
  assert.ok(timing.some((u) => u.text === "2"));
  assert.ok(timing.some((u) => u.text === "秒"));
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

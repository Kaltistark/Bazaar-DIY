import test from "node:test";
import assert from "node:assert/strict";
import { cooldownParts, changeCooldown } from "../src/cooldown-picker.js";

test("冷却拆分到十分位，正确处理浮点数、上限和空值", () => {
  assert.deepEqual(cooldownParts("4.0"), { integer: 4, fraction: 0 });
  assert.deepEqual(cooldownParts("8.7"), { integer: 8, fraction: 7 });
  assert.deepEqual(cooldownParts("999.9"), { integer: 999, fraction: 9 });
  assert.deepEqual(cooldownParts(""), { integer: 0, fraction: 0 });
});
test("整数与十分位独立滚动，十分位循环而整数保留", () => {
  assert.equal(changeCooldown("4.9", "fraction", 1), "4.0");
  assert.equal(changeCooldown("4.0", "fraction", -1), "4.9");
  assert.equal(changeCooldown("4.7", "integer", 3), "7.7");
  assert.equal(changeCooldown("0.7", "integer", -1), "0.7");
  assert.equal(changeCooldown("999.7", "integer", 10), "999.7");
});

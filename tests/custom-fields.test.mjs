import test from "node:test";
import assert from "node:assert/strict";
import { createProject, validateProject } from "../src/model.js";
import { Renderer } from "../src/renderer.js";

test("自定义职业图标及类型随作品往返保存，旧作品补齐字段", () => {
  const p = createProject(); p.hero = "custom";
  p.customHero = { name: "文具师", icon: "data:image/png;base64,dGVzdA==" };
  p.customTypes = ["文具"]; p.types = ["文具"];
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  const old = createProject(); delete old.customTypes; delete old.customHero;
  assert.equal(validateProject(old).customHero.icon, null);
  assert.deepEqual(old.customTypes, []);
  const imported = createProject(); imported.types = ["文具"];
  assert.deepEqual(validateProject(imported).customTypes, ["文具"]);
});

test("自定义字段拒绝非法图片和过长或损坏的标签", () => {
  for (const icon of ["https://example.com/icon.png", "data:image/svg+xml;base64,dGVzdA==", 4]) {
    const p = createProject(); p.customHero.icon = icon;
    assert.throws(() => validateProject(p), /职业/);
  }
  for (const type of ["", "文\n具", " 文具", "文".repeat(13), 3]) {
    const p = createProject(); p.types = [type];
    assert.throws(() => validateProject(p));
  }
});

test("自定义类型在效果正文中高亮，类型长词优先且不影响关键词", () => {
  const r = new Renderer();
  const runs = r.rich([{ type: "text", text: "文具工具获得伤害" }], ["文具", "文具工具"]);
  assert.equal(runs[0].text, "文具工具");
  assert.equal(runs[0].color, "#b3baff");
  assert.ok(runs.some(run => run.id === "damage"));
});
